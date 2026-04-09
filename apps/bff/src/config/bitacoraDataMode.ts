export type BitacoraDataMode = 'fixture' | 'integration' | 'db';

/**
 * How the BFF obtains data for `GET /api/v1/bitacora`:
 * - **fixture**: read local JSON (see `FIXTURE_PATH` / default canonical fixture).
 * - **db**: read normalized row from PostgreSQL (`BITACORA_DATA_MODE=db`, `DATABASE_URL`).
 * - **integration**: call upstream HTTP API, then normalize to canonical shape.
 */
export function getBitacoraDataMode(): BitacoraDataMode {
  const raw = process.env.BITACORA_DATA_MODE?.trim().toLowerCase();
  if (raw === 'integration') return 'integration';
  if (raw === 'db') return 'db';
  return 'fixture';
}

/** When true and mode is integration, upstream failures fall back to the fixture (dev/test only). */
export function shouldFallbackToFixtureOnUpstreamError(): boolean {
  return process.env.BITACORA_FIXTURE_ON_UPSTREAM_ERROR === 'true';
}
