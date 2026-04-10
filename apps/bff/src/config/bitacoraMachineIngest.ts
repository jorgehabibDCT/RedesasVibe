import { timingSafeEqual } from 'node:crypto';

/**
 * Optional static **`Authorization: Bearer`** value for automation (e.g. Zapier) that cannot use Pegasus
 * user sessions. When set, a request whose Bearer matches this token is authenticated as
 * **`machine_ingest`** without calling Pegasus.
 *
 * Use a long random value; rotate like an API key. Never commit real values.
 */
export function getBitacoraMachineIngestToken(): string | undefined {
  const v = process.env.BITACORA_MACHINE_INGEST_TOKEN?.trim();
  return v && v.length > 0 ? v : undefined;
}

function timingSafeEqualUtf8(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(actual, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** True when `token` matches **`BITACORA_MACHINE_INGEST_TOKEN`** (timing-safe). */
export function isMachineIngestBearerToken(token: string): boolean {
  const configured = getBitacoraMachineIngestToken();
  if (!configured) return false;
  return timingSafeEqualUtf8(configured, token);
}
