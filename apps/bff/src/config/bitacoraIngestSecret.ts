import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/**
 * When **`BITACORA_INGEST_SECRET`** is non-empty, `POST /bitacora/ingest` requires header
 * **`X-Bitacora-Ingest-Secret`** to match (in addition to normal Bearer auth + app allowlists).
 * Omit or leave empty for legacy behavior (any authenticated+authorized caller may ingest).
 */
export function getBitacoraIngestSecret(): string | undefined {
  const v = process.env.BITACORA_INGEST_SECRET?.trim();
  return v && v.length > 0 ? v : undefined;
}

function headerIngestSecret(req: Request): string {
  const v = req.headers['x-bitacora-ingest-secret'];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string') return v[0];
  return '';
}

function timingSafeEqualString(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(actual, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Returns true when the request may proceed to ingest body handling. */
export function isBitacoraIngestSecretValid(req: Request): boolean {
  const configured = getBitacoraIngestSecret();
  if (!configured) return true;
  return timingSafeEqualString(configured, headerIngestSecret(req));
}
