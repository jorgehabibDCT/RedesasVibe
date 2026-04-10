import { AuthProblems } from './authProblems.js';
import {
  getPegasusAuthCache,
  getPegasusCacheNegativeTtlMs,
  getPegasusCacheTtlMs,
  getPegasusCacheUnavailableTtlMs,
  hashTokenForCacheKey,
  isPegasusCacheEnabled,
  resetPegasusAuthCacheForTests,
} from './pegasusAuthCache.js';
import type {
  PegasusPrincipal,
  PegasusPrincipalExtractionMeta,
  PegasusValidateResult,
} from './pegasusAuth.types.js';
import { fetchPegasusUserResourcesProfile } from './pegasusUserResources.js';

export type { PegasusValidateResult } from './pegasusAuth.types.js';

function asNonEmptyString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function collectGroupIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === 'string' && item.trim() !== '') {
      out.push(item.trim());
      continue;
    }
    if (item && typeof item === 'object') {
      const id = asNonEmptyString((item as Record<string, unknown>).id);
      const gid = asNonEmptyString((item as Record<string, unknown>).group_id);
      const value = id ?? gid;
      if (value) out.push(value);
    }
  }
  return Array.from(new Set(out));
}

function extractUserIdWithPath(
  root: Record<string, unknown>,
  user: Record<string, unknown> | undefined,
): { userId?: string; path?: string } {
  const candidates: [string, unknown][] = [
    ['root.user_id', root.user_id],
    ['root.uid', root.uid],
    ['root.id', root.id],
  ];
  if (user) {
    candidates.push(
      ['nested.user.user_id', user.user_id],
      ['nested.user.uid', user.uid],
      ['nested.user.id', user.id],
    );
  }
  for (const [path, v] of candidates) {
    const s = asNonEmptyString(v);
    if (s) return { userId: s, path };
  }
  return {};
}

function mergeGroupsWithPaths(
  root: Record<string, unknown>,
  user: Record<string, unknown> | undefined,
): { groupIds: string[]; paths: string[] } {
  const paths: string[] = [];
  const all: string[] = [];
  const sources: [string, unknown][] = [
    ['root.group_ids', root.group_ids],
    ['root.groupIds', root.groupIds],
    ['root.groups', root.groups],
  ];
  if (user) {
    sources.push(
      ['nested.user.group_ids', user.group_ids],
      ['nested.user.groupIds', user.groupIds],
      ['nested.user.groups', user.groups],
    );
  }
  for (const [label, v] of sources) {
    const ids = collectGroupIds(v);
    if (ids.length > 0) paths.push(label);
    all.push(...ids);
  }
  const groupIds = Array.from(new Set(all));
  return { groupIds, paths };
}

function extractPrincipalWithMeta(body: unknown): {
  principal: PegasusPrincipal;
  meta: PegasusPrincipalExtractionMeta;
} {
  if (!body || typeof body !== 'object') {
    return {
      principal: { groupIds: [] },
      meta: { hasUserId: false, groupCount: 0, pathsMatched: [], bodyParseFailed: true },
    };
  }
  const root = body as Record<string, unknown>;
  const user =
    (root.user && typeof root.user === 'object' ? (root.user as Record<string, unknown>) : undefined) ??
    (root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : undefined);

  const { userId, path: userPath } = extractUserIdWithPath(root, user);
  const { groupIds, paths: groupPaths } = mergeGroupsWithPaths(root, user);

  const pathsMatched: string[] = [];
  if (userPath) pathsMatched.push(userPath);
  pathsMatched.push(...groupPaths);

  return {
    principal: { userId, groupIds: groupIds.length > 0 ? groupIds : [] },
    meta: {
      hasUserId: Boolean(userId),
      groupCount: groupIds.length,
      pathsMatched,
      bodyParseFailed: false,
    },
  };
}

/** Env override: comma-separated header names tried first (before built-in defaults). */
function configuredUserIdHeaderNames(): string[] {
  const raw = process.env.PEGASUS_USER_ID_HEADERS?.trim();
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}

const DEFAULT_USER_ID_HEADERS = [
  'x-peg-user-id',
  'x-pegasus-user-id',
  'x-peg-uid',
  'x-user-id',
  'pegasus-user-id',
];

function extractUserIdFromHeaders(res: Response): { userId?: string; headerName?: string } {
  const names = [...configuredUserIdHeaderNames(), ...DEFAULT_USER_ID_HEADERS];
  const seen = new Set<string>();
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const v = res.headers.get(name);
    const id = asNonEmptyString(v);
    if (id) return { userId: id, headerName: name };
  }
  return {};
}

/** Optional comma-separated group ids in a single response header (gateway-specific). */
function extractGroupIdsFromConfiguredHeader(res: Response): { ids: string[]; pathLabel?: string } {
  const headerName = process.env.PEGASUS_GROUP_IDS_HEADER?.trim();
  if (!headerName) return { ids: [] };
  const raw = res.headers.get(headerName);
  if (!raw) return { ids: [] };
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (ids.length === 0) return { ids: [] };
  return { ids, pathLabel: `response.header.${headerName}` };
}

/**
 * Merge JSON body principal with **non-secret** identity headers on the same `/api/login` response.
 * Body wins for user id when both are present; otherwise headers can supply user id / optional group ids.
 */
function mergeHeaderPrincipal(
  res: Response,
  bodyPrincipal: PegasusPrincipal,
  bodyMeta: PegasusPrincipalExtractionMeta,
): { principal: PegasusPrincipal; meta: PegasusPrincipalExtractionMeta } {
  const hadBodyUserId = Boolean(bodyPrincipal.userId);
  const pathsMatched = [...bodyMeta.pathsMatched];
  let userId = bodyPrincipal.userId;
  let groupIds = [...bodyPrincipal.groupIds];

  if (!userId) {
    const h = extractUserIdFromHeaders(res);
    if (h.userId && h.headerName) {
      userId = h.userId;
      pathsMatched.push(`response.header.${h.headerName}`);
    }
  }

  const headerGroups = extractGroupIdsFromConfiguredHeader(res);
  if (headerGroups.ids.length > 0) {
    groupIds = Array.from(new Set([...groupIds, ...headerGroups.ids]));
    if (headerGroups.pathLabel) pathsMatched.push(headerGroups.pathLabel);
  }

  const userIdSource: 'body' | 'header' | undefined =
    userId ? (hadBodyUserId ? 'body' : 'header') : undefined;

  return {
    principal: { userId, groupIds },
    meta: {
      ...bodyMeta,
      hasUserId: Boolean(userId),
      groupCount: groupIds.length,
      pathsMatched,
      userIdSource,
    },
  };
}

/**
 * Pegasus session validation (reference: qualitas-installations `auth.guard.ts`):
 * `GET ${PEGASUS_SITE}/api/login?auth=${token}`.
 *
 * HTTP status mapping (stable `problem` codes):
 * - 2xx → success
 * - 401 → `token_expired` (session ended / invalid session)
 * - 403 → `invalid_token` (forbidden)
 * - other 4xx → `invalid_token`
 * - 5xx → `auth_unavailable` (Pegasus server error)
 * - network / timeout / abort → `auth_unavailable`
 */
export function pegasusResultFromHttpStatus(status: number): PegasusValidateResult {
  if (status >= 200 && status < 300) {
    return { ok: true, mode: 'pegasus_http' };
  }
  if (status === 401) {
    return { ok: false, problem: AuthProblems.tokenExpired, mode: 'pegasus_http', reason: 'pegasus_http_401' };
  }
  if (status === 403) {
    return { ok: false, problem: AuthProblems.invalidToken, mode: 'pegasus_http', reason: 'pegasus_http_403' };
  }
  if (status >= 400 && status < 500) {
    return { ok: false, problem: AuthProblems.invalidToken, mode: 'pegasus_http', reason: 'pegasus_http_4xx' };
  }
  return { ok: false, problem: AuthProblems.authUnavailable, mode: 'pegasus_http', reason: 'pegasus_http_5xx' };
}

function getPegasusFetchTimeoutMs(): number {
  const n = Number(process.env.PEGASUS_FETCH_TIMEOUT_MS ?? '10000');
  return Number.isFinite(n) && n > 0 ? n : 10_000;
}

/**
 * When `PEGASUS_AUTH_DISABLED=true`, skip HTTP call (local/dev). **Not for production.**
 * When disabled flag is false and `PEGASUS_SITE` is set, perform HTTP validation with optional bounded cache.
 * When disabled flag is false and `PEGASUS_SITE` is missing, fail closed with `auth_unavailable`.
 */
export async function validatePegasusSession(token: string): Promise<PegasusValidateResult> {
  const bypass = process.env.PEGASUS_AUTH_DISABLED === 'true';
  if (bypass) {
    return { ok: true, mode: 'bypass' };
  }

  const site = process.env.PEGASUS_SITE?.trim();
  if (!site) {
    return { ok: false, problem: AuthProblems.authUnavailable, mode: 'pegasus_http', reason: 'pegasus_site_unset' };
  }

  const cacheEnabled = isPegasusCacheEnabled();
  const key = hashTokenForCacheKey(token);

  if (cacheEnabled) {
    const hit = getPegasusAuthCache().get(key);
    if (hit) {
      return hit;
    }
  }

  const base = site.replace(/\/$/, '');
  const url = `${base}/api/login?auth=${encodeURIComponent(token)}`;

  const timeoutMs = getPegasusFetchTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    const baseResult = pegasusResultFromHttpStatus(res.status);
    let result: PegasusValidateResult = baseResult;
    if (baseResult.ok) {
      let principal: PegasusPrincipal | undefined;
      let principalExtraction: PegasusPrincipalExtractionMeta | undefined;
      try {
        if (typeof (res as Response).clone === 'function') {
          const body = (await res.clone().json()) as unknown;
          const extracted = extractPrincipalWithMeta(body);
          const merged = mergeHeaderPrincipal(res, extracted.principal, extracted.meta);
          principal = merged.principal;
          principalExtraction = merged.meta;
        } else {
          principal = { groupIds: [] };
          principalExtraction = { hasUserId: false, groupCount: 0, pathsMatched: [], bodyParseFailed: true };
          const merged = mergeHeaderPrincipal(res, principal, principalExtraction);
          principal = merged.principal;
          principalExtraction = merged.meta;
        }
      } catch {
        principal = { groupIds: [] };
        principalExtraction = { hasUserId: false, groupCount: 0, pathsMatched: [], bodyParseFailed: true };
        const merged = mergeHeaderPrincipal(res, principal, principalExtraction);
        principal = merged.principal;
        principalExtraction = merged.meta;
      }

      const resourcesProfile = await fetchPegasusUserResourcesProfile(base, token, timeoutMs);
      if (resourcesProfile) {
        principal = { ...principal, resources: resourcesProfile };
      }

      result = { ...baseResult, principal, principalExtraction };
    }
    if (cacheEnabled) {
      const ttl = result.ok
        ? getPegasusCacheTtlMs()
        : result.problem === AuthProblems.authUnavailable
          ? getPegasusCacheUnavailableTtlMs()
          : getPegasusCacheNegativeTtlMs();
      getPegasusAuthCache().set(key, result, ttl);
    }
    return result;
  } catch (e) {
    clearTimeout(timer);
    const reason = e instanceof Error && e.name === 'AbortError' ? 'pegasus_timeout' : 'pegasus_network_error';
    const result: PegasusValidateResult = {
      ok: false,
      problem: AuthProblems.authUnavailable,
      mode: 'pegasus_http',
      reason,
    };
    if (cacheEnabled) {
      getPegasusAuthCache().set(key, result, getPegasusCacheUnavailableTtlMs());
    }
    return result;
  }
}

export { resetPegasusAuthCacheForTests };
