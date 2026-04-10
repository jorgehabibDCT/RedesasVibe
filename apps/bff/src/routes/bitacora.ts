import type { BitacoraDocument } from '@redesas-lite/shared';
import { Router, type Request, type Response } from 'express';
import type { BitacoraService } from '../bitacora/bitacoraService.js';
import {
  BitacoraDbNoDefaultError,
  BitacoraDbNotFoundError,
  BitacoraDbUnavailableError,
} from '../bitacora/bitacoraDbErrors.js';
import { getBitacoraDataMode } from '../config/bitacoraDataMode.js';
import { isBitacoraIngestSecretValid } from '../config/bitacoraIngestSecret.js';
import { getCaseOperatorMeta, listCasesCompact } from '../db/bitacoraCaseReadRepository.js';
import { getPool } from '../db/pool.js';
import type { BitacoraIngestService } from '../db/bitacoraIngestService.js';
import {
  logBitacoraIngestForbidden,
  logBitacoraIngestSuccess,
  logUpstreamFailure,
} from '../observability/log.js';
import { captureExceptionForObservability } from '../observability/sentryHooks.js';
import { UpstreamFetchError, UpstreamNormalizeError } from '../upstream/upstreamErrors.js';

export function bitacoraRouter(
  service: BitacoraService,
  opts?: { ingest: BitacoraIngestService | null },
) {
  const r = Router();

  /**
   * Compact case list for UI switcher (db mode only).
   * Query: `limit` (default 50, max 100), optional `search` (ILIKE on expediente, plates, insured name).
   */
  r.get('/bitacora/cases', async (req: Request, res: Response) => {
    if (getBitacoraDataMode() !== 'db') {
      res.json({ cases: [] });
      return;
    }
    const pool = getPool();
    if (!pool) {
      res.status(503).json({
        error: 'bitacora_db_unavailable',
        message: 'Database not configured',
      });
      return;
    }
    const rawLimit = req.query.limit;
    const limitParsed =
      typeof rawLimit === 'string' && rawLimit !== ''
        ? parseInt(rawLimit, 10)
        : typeof rawLimit === 'number'
          ? rawLimit
          : 50;
    const limit = Number.isFinite(limitParsed) ? limitParsed : 50;

    const rawSearch = req.query.search;
    const search =
      typeof rawSearch === 'string' && rawSearch.trim() !== ''
        ? rawSearch
        : Array.isArray(rawSearch) && typeof rawSearch[0] === 'string'
          ? rawSearch[0]
          : undefined;

    try {
      const cases = await listCasesCompact(pool, { limit, search });
      res.json({ cases });
    } catch (e) {
      const requestId = req.requestId ?? 'unknown';
      captureExceptionForObservability(e, { requestId, route: 'bitacora/cases' });
      res.status(500).json({ error: 'bitacora_cases_failed', message: 'Could not list cases' });
    }
  });

  /**
   * Operator-only metadata (ids, mode). Non-operators receive **404** (no capability leak).
   */
  r.get('/bitacora/operator-meta', async (req: Request, res: Response) => {
    if (!req.pegasusIsOperator) {
      res.status(404).json({ error: 'not_found', message: 'Not found' });
      return;
    }

    const mode = getBitacoraDataMode();
    const pegasusAuthMode = req.pegasusAuthMode ?? 'pegasus_http';
    const rawPolicy = req.query.policy_incident;
    const policyIncident =
      typeof rawPolicy === 'string' && rawPolicy.trim() !== ''
        ? rawPolicy.trim()
        : Array.isArray(rawPolicy) && typeof rawPolicy[0] === 'string'
          ? rawPolicy[0].trim()
          : undefined;

    if (mode === 'db') {
      const pool = getPool();
      if (!pool) {
        res.status(503).json({ error: 'bitacora_db_unavailable', message: 'Database not configured' });
        return;
      }
      try {
        const row = await getCaseOperatorMeta(pool, policyIncident);
        if (!row) {
          res.json({
            bitacoraDataMode: mode,
            pegasusAuthMode,
            policyIncident: policyIncident ?? null,
            caseId: null,
            latestRawId: null,
            caseUpdatedAt: null,
            documentEnv: null,
          });
          return;
        }
        res.json({
          bitacoraDataMode: mode,
          pegasusAuthMode,
          policyIncident: row.policyIncident,
          caseId: row.caseId,
          latestRawId: row.latestRawId,
          caseUpdatedAt: row.updatedAtUtc,
          documentEnv: row.env,
        });
        return;
      } catch (e) {
        const requestId = req.requestId ?? 'unknown';
        captureExceptionForObservability(e, { requestId, route: 'bitacora/operator-meta' });
        res.status(500).json({ error: 'operator_meta_failed', message: 'Could not load operator metadata' });
        return;
      }
    }

    res.json({
      bitacoraDataMode: mode,
      pegasusAuthMode,
      policyIncident: policyIncident ?? null,
      caseId: null,
      latestRawId: null,
      caseUpdatedAt: null,
      documentEnv: null,
    });
  });

  /**
   * Canonical bitácora document (spec.md v0.3).
   * Mode: `BITACORA_DATA_MODE=fixture|db|integration` (see README).
   * **db** mode: optional `?policy_incident=`; omit to use most recently updated case.
   */
  r.get('/bitacora', async (req: Request, res: Response) => {
    try {
      const doc = await service.getBitacoraDocument(req);
      res.json(doc);
    } catch (e) {
      const requestId = req.requestId ?? 'unknown';
      if (e instanceof BitacoraDbNotFoundError) {
        res.status(404).json({ error: 'bitacora_not_found', message: e.message });
        return;
      }
      if (e instanceof BitacoraDbNoDefaultError) {
        res.status(400).json({ error: 'bitacora_no_default', message: e.message });
        return;
      }
      if (e instanceof BitacoraDbUnavailableError) {
        res.status(503).json({ error: 'bitacora_db_unavailable', message: e.message });
        return;
      }
      if (e instanceof UpstreamFetchError) {
        logUpstreamFailure({
          requestId,
          kind: 'upstream_unavailable',
          message: e.message,
        });
        res.status(502).json({
          error: 'upstream_unavailable',
          message: e.message,
        });
        return;
      }
      if (e instanceof UpstreamNormalizeError) {
        logUpstreamFailure({
          requestId,
          kind: 'upstream_invalid',
          message: e.message,
        });
        res.status(502).json({
          error: 'upstream_invalid',
          message: e.message,
        });
        return;
      }
      logUpstreamFailure({
        requestId,
        kind: 'bitacora_failed',
        message: e instanceof Error ? e.message : String(e),
      });
      captureExceptionForObservability(e, { requestId, route: 'bitacora' });
      res.status(500).json({ error: 'bitacora_failed' });
    }
  });

  /**
   * Persist canonical document: raw JSON row + upsert normalized case on `policy_incident`.
   * Requires `DATABASE_URL` (ingest service); same Bearer auth + app allowlists as GET /bitacora.
   * When **`BITACORA_INGEST_SECRET`** is set, also requires header **`X-Bitacora-Ingest-Secret`**.
   */
  r.post('/bitacora/ingest', async (req: Request, res: Response) => {
    if (!opts?.ingest) {
      res.status(503).json({
        error: 'ingest_unavailable',
        message: 'Ingest requires DATABASE_URL',
      });
      return;
    }

    if (!isBitacoraIngestSecretValid(req)) {
      logBitacoraIngestForbidden({ requestId: req.requestId ?? 'unknown', path: req.path });
      res.status(403).json({
        error: 'ingest_forbidden',
        message: 'Ingest not permitted for this caller',
      });
      return;
    }

    const body = req.body as unknown;
    if (
      body == null ||
      typeof body !== 'object' ||
      !('payload' in body) ||
      body.payload == null ||
      typeof body.payload !== 'object'
    ) {
      res.status(400).json({
        error: 'invalid_body',
        message: 'Expected JSON body matching BitacoraDocument with payload',
      });
      return;
    }

    try {
      const doc = body as BitacoraDocument;
      const result = await opts.ingest.ingestCanonicalDocument(doc);
      logBitacoraIngestSuccess({
        requestId: req.requestId ?? 'unknown',
        path: req.path,
        caseId: result.caseId,
        rawId: result.rawId,
      });
      res.status(201).json({ ok: true, caseId: result.caseId, rawId: result.rawId });
    } catch (e) {
      if (e instanceof Error && e.name === 'IngestValidationError') {
        res.status(400).json({ error: 'validation_error', message: e.message });
        return;
      }
      const requestId = req.requestId ?? 'unknown';
      captureExceptionForObservability(e, { requestId, route: 'bitacora/ingest' });
      res.status(500).json({ error: 'ingest_failed', message: 'Ingest failed' });
    }
  });

  return r;
}
