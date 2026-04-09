import type { CorsOptions } from 'cors';

/**
 * Explicit CORS allowlist. When `CORS_ORIGINS` is **unset**, defaults to local Vite dev.
 * When set to an **empty string** (`CORS_ORIGINS=`), no browser `Origin` is allowed (non-browser clients without `Origin` still work).
 */
export function parseCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS;
  if (raw === undefined) {
    return ['http://localhost:5173'];
  }
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function createCorsOptions(): CorsOptions {
  const origins = parseCorsOrigins();
  return {
    origin(origin, cb) {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (origins.length === 0) {
        cb(new Error('CORS: no allowed origins configured'));
        return;
      }
      if (origins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error('CORS blocked for origin'));
    },
  };
}
