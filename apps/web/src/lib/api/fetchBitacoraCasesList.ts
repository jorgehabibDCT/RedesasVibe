import type { BitacoraCaseListResponse } from '@redesas-lite/shared';
import { getBearerToken } from '../auth/memoryToken.js';
import { apiUrl } from './apiBaseUrl.js';
import { BitacoraAuthError } from './authErrors.js';

/**
 * Lists compact cases for the switcher (`GET /api/v1/bitacora/cases`).
 * Returns `{ cases: [] }` in fixture/integration mode; requires db mode + DATABASE_URL for data.
 */
export async function fetchBitacoraCasesList(
  options?: { search?: string; limit?: number },
): Promise<BitacoraCaseListResponse> {
  const token = getBearerToken();
  if (!token) {
    throw new BitacoraAuthError(401, 'missing_token', 'Falta token de sesión');
  }

  const params = new URLSearchParams();
  params.set('limit', String(options?.limit ?? 50));
  const s = options?.search?.trim();
  if (s) params.set('search', s);

  const res = await fetch(apiUrl(`/api/v1/bitacora/cases?${params}`), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    throw new BitacoraAuthError(401, 'invalid_token', 'Sesión no válida');
  }

  if (!res.ok) {
    throw new Error(`bitacora_cases_fetch_failed:${res.status}`);
  }

  return res.json() as Promise<BitacoraCaseListResponse>;
}
