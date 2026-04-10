import type { PegasusUserResourcesProfile } from './pegasusAuth.types.js';

function asNonEmptyString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function idAsString(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return asNonEmptyString(v);
}

/**
 * Parse minimal fields from **`GET …/user/resources`** JSON (root or nested **`user`**).
 * Exported for unit tests only.
 */
export function parsePegasusUserResourcesBody(body: unknown): PegasusUserResourcesProfile | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const root = body as Record<string, unknown>;
  const u =
    root.user && typeof root.user === 'object' ? (root.user as Record<string, unknown>) : root;

  const id = idAsString(u.id);
  const username = asNonEmptyString(u.username);
  const email = asNonEmptyString(u.email);
  const isStaff = u.is_staff === true || u.isStaff === true;
  const isSuperuser = u.is_superuser === true || u.isSuperuser === true;

  return {
    ...(id ? { id } : {}),
    ...(username ? { username } : {}),
    ...(email ? { email } : {}),
    isStaff,
    isSuperuser,
  };
}

export function isPegasusUserResourcesFetchEnabled(): boolean {
  return process.env.PEGASUS_USER_RESOURCES_DISABLED !== 'true';
}

function userResourcesPath(): string {
  const raw = process.env.PEGASUS_USER_RESOURCES_PATH?.trim();
  if (!raw) return '/user/resources';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

/**
 * **`GET ${PEGASUS_SITE}${path}`** with **`Authorization: Bearer <token>`**.
 * Returns **`undefined`** on any failure (non-2xx, network, timeout, parse) — caller degrades without granting staff.
 */
export async function fetchPegasusUserResourcesProfile(
  siteBaseNoTrailingSlash: string,
  token: string,
  timeoutMs: number,
): Promise<PegasusUserResourcesProfile | undefined> {
  if (!isPegasusUserResourcesFetchEnabled()) {
    return undefined;
  }

  const url = `${siteBaseNoTrailingSlash}${userResourcesPath()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    clearTimeout(timer);

    if (!res.ok || res.status < 200 || res.status >= 300) {
      return undefined;
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return undefined;
    }
    return parsePegasusUserResourcesBody(body);
  } catch {
    clearTimeout(timer);
    return undefined;
  }
}
