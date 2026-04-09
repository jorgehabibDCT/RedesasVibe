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
import type { PegasusValidateResult } from './pegasusAuth.types.js';

export type { PegasusValidateResult } from './pegasusAuth.types.js';

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
    return { ok: false, problem: AuthProblems.tokenExpired };
  }
  if (status === 403) {
    return { ok: false, problem: AuthProblems.invalidToken };
  }
  if (status >= 400 && status < 500) {
    return { ok: false, problem: AuthProblems.invalidToken };
  }
  return { ok: false, problem: AuthProblems.authUnavailable };
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
    return { ok: false, problem: AuthProblems.authUnavailable };
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
    const result = pegasusResultFromHttpStatus(res.status);
    if (cacheEnabled) {
      const ttl = result.ok
        ? getPegasusCacheTtlMs()
        : result.problem === AuthProblems.authUnavailable
          ? getPegasusCacheUnavailableTtlMs()
          : getPegasusCacheNegativeTtlMs();
      getPegasusAuthCache().set(key, result, ttl);
    }
    return result;
  } catch {
    clearTimeout(timer);
    const result: PegasusValidateResult = { ok: false, problem: AuthProblems.authUnavailable };
    if (cacheEnabled) {
      getPegasusAuthCache().set(key, result, getPegasusCacheUnavailableTtlMs());
    }
    return result;
  }
}

export { resetPegasusAuthCacheForTests };
