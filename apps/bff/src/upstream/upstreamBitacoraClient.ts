import type { Request } from 'express';
import { UpstreamFetchError } from './upstreamErrors.js';

/**
 * Raw upstream HTTP fetch — **no** Pegasus `?auth=` here; only Bearer to the configured business API.
 */
export async function fetchUpstreamBitacoraRaw(req: Request): Promise<unknown> {
  const base = process.env.BITACORA_UPSTREAM_BASE_URL?.trim();
  const path = (process.env.BITACORA_UPSTREAM_PATH ?? '/api/v1/bitacora/raw').trim();
  if (!base) {
    throw new UpstreamFetchError('BITACORA_UPSTREAM_BASE_URL is not set');
  }

  const baseUrl = base.replace(/\/$/, '');
  const rel = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${rel}`;

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    throw new UpstreamFetchError('Missing Authorization on upstream request (internal)');
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: auth,
      },
    });
  } catch (e) {
    throw new UpstreamFetchError('Upstream network error', undefined, e);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new UpstreamFetchError(`Upstream returned ${res.status}`, res.status, text);
  }

  try {
    return await res.json();
  } catch (e) {
    throw new UpstreamFetchError('Upstream response is not valid JSON', res.status, e);
  }
}
