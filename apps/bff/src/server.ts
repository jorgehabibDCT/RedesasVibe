import cors from 'cors';
import express, { type NextFunction, type Request, type Response, Router } from 'express';
import { readFileSync } from 'node:fs';
import { createBitacoraService } from './bitacora/bitacoraService.js';
import { createCorsOptions } from './config/corsConfig.js';
import { getCanonicalFixturePath } from './config/fixturePath.js';
import { getMonorepoRoot } from './config/repoRoot.js';
import { createBitacoraIngestService } from './db/bitacoraIngestService.js';
import type { BitacoraIngestService } from './db/bitacoraIngestService.js';
import { getPool } from './db/pool.js';
import { computeReadiness } from './health/readiness.js';
import { captureExceptionForObservability } from './observability/sentryHooks.js';
import { logCorsBlocked } from './observability/log.js';
import { bitacoraRouter } from './routes/bitacora.js';
import { requireAuthMiddleware } from './middleware/requireAuth.js';
import { requireAuthorizationMiddleware } from './middleware/requireAuthorization.js';
import { requestLoggingMiddleware } from './middleware/requestLogging.js';
import { securityHeadersMiddleware } from './middleware/securityHeaders.js';

/** Monorepo root (contains `fixtures/`, `apps/`, `packages/`). */
export function repoRoot(): string {
  return getMonorepoRoot();
}

export function loadCanonicalFixture(): string {
  return readFileSync(getCanonicalFixturePath(), 'utf-8');
}

export function createServer(options?: { bitacoraIngestService?: BitacoraIngestService | null }) {
  const app = express();

  app.disable('x-powered-by');

  app.use(requestLoggingMiddleware());
  app.use(cors(createCorsOptions()));
  app.use(securityHeadersMiddleware());

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'redesas-lite-bff' });
  });

  app.get('/ready', (_req, res) => {
    const body = computeReadiness();
    res.status(body.status === 'ready' ? 200 : 503).json(body);
  });

  app.use(express.json());

  const bitacoraService = createBitacoraService({
    loadFixtureJson: loadCanonicalFixture,
    getPool,
  });

  const ingestService: BitacoraIngestService | null =
    options?.bitacoraIngestService !== undefined
      ? options.bitacoraIngestService
      : (() => {
          const pool = getPool();
          return pool ? createBitacoraIngestService(pool) : null;
        })();

  const protectedApi = Router();
  protectedApi.use(requireAuthMiddleware);
  protectedApi.use(requireAuthorizationMiddleware);
  protectedApi.use(bitacoraRouter(bitacoraService, { ingest: ingestService }));
  app.use('/api/v1', protectedApi);

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof Error && err.message.startsWith('CORS')) {
      logCorsBlocked({ requestId: req.requestId ?? 'unknown' });
      res.status(403).json({ error: 'cors_forbidden', message: 'Origin not allowed' });
      return;
    }
    next(err);
  });

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    captureExceptionForObservability(err, {
      requestId: req.requestId ?? 'unknown',
      path: req.path,
    });
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        event: 'unhandled_error',
        service: 'redesas-lite-bff',
        requestId: req.requestId ?? 'unknown',
        path: req.path,
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    if (res.headersSent) {
      return;
    }
    res.status(500).json({ error: 'internal_error', message: 'Internal server error' });
  });

  return app;
}
