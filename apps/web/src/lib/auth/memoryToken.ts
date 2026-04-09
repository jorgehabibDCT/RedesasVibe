/**
 * Pegasus may pass the session token in the query string as `access_token` and/or `auth`
 * (live iframe launches have been observed with `?auth=...`).
 * Uses URLSearchParams — no narrow character-class regex.
 * Token is kept in memory only (no default localStorage).
 */
let memoryToken: string | null = null;

/**
 * Read session token from a query string (for unit tests and shared parsing logic).
 * Precedence: non-empty `access_token` wins over `auth` when both are present.
 */
export function parseAccessTokenFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const accessToken = params.get('access_token');
  const auth = params.get('auth');
  if (accessToken != null && accessToken !== '') return accessToken;
  if (auth != null && auth !== '') return auth;
  return null;
}

/**
 * Capture token from the current window URL, store in memory, strip from address bar when present.
 * Removes both `access_token` and `auth` from the query after capture so the bar stays clean.
 */
export function captureTokenFromUrlOnce(): string | null {
  if (typeof window === 'undefined') return null;
  const token = parseAccessTokenFromSearch(window.location.search);
  if (token) {
    memoryToken = token;
    const url = new URL(window.location.href);
    url.searchParams.delete('access_token');
    url.searchParams.delete('auth');
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, '', next);
  }
  return memoryToken;
}

export function getBearerToken(): string | null {
  return memoryToken;
}

/** For tests / future logout — scoped clear, not localStorage.clear(). */
export function clearMemoryToken(): void {
  memoryToken = null;
}

/**
 * @internal Test-only: set in-memory token without URL (avoids coupling tests to window.location).
 */
export function setMemoryTokenForTests(token: string | null): void {
  memoryToken = token;
}
