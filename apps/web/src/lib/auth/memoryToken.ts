/**
 * Pegasus may pass `access_token` in the query string (see spec / reference repo).
 * Uses URLSearchParams — no narrow character-class regex.
 * Token is kept in memory only (no default localStorage).
 */
let memoryToken: string | null = null;

/**
 * Read `access_token` from a query string (for unit tests and shared parsing logic).
 */
export function parseAccessTokenFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const raw = params.get('access_token');
  if (raw == null || raw === '') return null;
  return raw;
}

/**
 * Capture token from the current window URL, store in memory, strip from address bar when present.
 */
export function captureTokenFromUrlOnce(): string | null {
  if (typeof window === 'undefined') return null;
  const token = parseAccessTokenFromSearch(window.location.search);
  if (token) {
    memoryToken = token;
    const url = new URL(window.location.href);
    url.searchParams.delete('access_token');
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
