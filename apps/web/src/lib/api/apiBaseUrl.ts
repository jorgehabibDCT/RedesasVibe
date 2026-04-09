/**
 * Join public API path to a normalized base (pure; used in tests).
 * `base` empty → same-origin relative path.
 */
export function joinApiUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return b ? `${b}${p}` : p;
}

/**
 * Browser-exposed BFF origin. Only `VITE_*` vars are inlined at build time; never put secrets here.
 * - Empty: same-origin relative URLs (`/api/...`) — local Vite dev proxy.
 * - Set on Vercel: full HTTPS origin of the hosted BFF (no trailing slash).
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (raw == null || String(raw).trim() === '') {
    return '';
  }
  return String(raw).trim().replace(/\/+$/, '');
}

/** Join public API path (must start with `/`) to the configured base. */
export function apiUrl(path: string): string {
  return joinApiUrl(getApiBaseUrl(), path);
}
