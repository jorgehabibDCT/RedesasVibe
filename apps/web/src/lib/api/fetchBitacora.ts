import type { BitacoraDocument } from '@redesas-lite/shared';
import { clearMemoryToken, getBearerToken } from '../auth/memoryToken.js';
import { apiUrl } from './apiBaseUrl.js';
import { BitacoraAuthError } from './authErrors.js';

/**
 * Fetches canonical bitácora JSON from the BFF.
 * When `policyIncident` is set (e.g. from `?policy_incident=` in the embed URL), the BFF resolves that case in **db** mode.
 */
export async function fetchBitacoraDocument(policyIncident?: string | null): Promise<BitacoraDocument> {
  const token = getBearerToken();
  if (!token) {
    throw new BitacoraAuthError(401, 'missing_token', 'Falta token de sesión');
  }

  const headers: HeadersInit = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const params = new URLSearchParams();
  if (policyIncident != null && policyIncident.trim() !== '') {
    params.set('policy_incident', policyIncident.trim());
  }
  const qs = params.toString();
  const path = qs ? `/api/v1/bitacora?${qs}` : '/api/v1/bitacora';
  const url = apiUrl(path);

  const res = await fetch(url, { headers });

  if (res.status === 401) {
    clearMemoryToken();
    let problem = 'invalid_token';
    let message = 'Sesión no válida';
    try {
      const body = (await res.json()) as { problem?: string; message?: string };
      if (typeof body.problem === 'string') problem = body.problem;
      if (typeof body.message === 'string') message = body.message;
    } catch {
      /* ignore */
    }
    throw new BitacoraAuthError(401, problem, message);
  }

  if (res.status === 404) {
    let message = 'No se encontró el expediente solicitado.';
    try {
      const body = (await res.json()) as { message?: string };
      if (typeof body.message === 'string') message = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(`bitacora_client:404:${message}`);
  }

  if (res.status === 400) {
    let message = 'Solicitud no válida.';
    try {
      const body = (await res.json()) as { message?: string };
      if (typeof body.message === 'string') message = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(`bitacora_client:400:${message}`);
  }

  if (!res.ok) {
    throw new Error(`bitacora_fetch_failed:${res.status}`);
  }

  return res.json() as Promise<BitacoraDocument>;
}
