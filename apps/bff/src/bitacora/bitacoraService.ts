import type { Pool } from 'pg';
import type { Request } from 'express';
import type { BitacoraDocument } from '@redesas-lite/shared';
import { mapDbCaseRowToBitacoraDocument } from '@redesas-lite/shared';
import {
  getBitacoraDataMode,
  shouldFallbackToFixtureOnUpstreamError,
} from '../config/bitacoraDataMode.js';
import { getCaseByPolicyIncident, listRecentCases } from '../db/bitacoraCaseReadRepository.js';
import { fetchUpstreamBitacoraRaw } from '../upstream/upstreamBitacoraClient.js';
import { UpstreamFetchError, UpstreamNormalizeError } from '../upstream/upstreamErrors.js';
import {
  BitacoraDbNoDefaultError,
  BitacoraDbNotFoundError,
  BitacoraDbUnavailableError,
} from './bitacoraDbErrors.js';
import { mapUpstreamToCanonical } from './mapUpstreamToCanonical.js';

export interface BitacoraServiceDeps {
  loadFixtureJson: () => string;
  /** Used when `BITACORA_DATA_MODE=db`. */
  getPool: () => Pool | null;
}

export function createBitacoraService(deps: BitacoraServiceDeps) {
  return {
    async getBitacoraDocument(req: Request): Promise<BitacoraDocument> {
      const mode = getBitacoraDataMode();

      if (mode === 'fixture') {
        return JSON.parse(deps.loadFixtureJson()) as BitacoraDocument;
      }

      if (mode === 'db') {
        const pool = deps.getPool();
        if (!pool) {
          throw new BitacoraDbUnavailableError();
        }
        const raw = req.query.policy_incident;
        const policyIncident =
          typeof raw === 'string' && raw.trim() !== ''
            ? raw.trim()
            : Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].trim() !== ''
              ? raw[0].trim()
              : '';

        if (policyIncident) {
          const row = await getCaseByPolicyIncident(pool, policyIncident);
          if (!row) {
            throw new BitacoraDbNotFoundError();
          }
          return mapDbCaseRowToBitacoraDocument(row);
        }

        const recent = await listRecentCases(pool, 1);
        if (recent.length === 0) {
          throw new BitacoraDbNoDefaultError();
        }
        return mapDbCaseRowToBitacoraDocument(recent[0]);
      }

      try {
        const raw = await fetchUpstreamBitacoraRaw(req);
        return mapUpstreamToCanonical(raw);
      } catch (e) {
        if (shouldFallbackToFixtureOnUpstreamError()) {
          return JSON.parse(deps.loadFixtureJson()) as BitacoraDocument;
        }
        if (e instanceof UpstreamFetchError || e instanceof UpstreamNormalizeError) {
          throw e;
        }
        throw new UpstreamFetchError('Upstream request failed', undefined, e);
      }
    },
  };
}

export type BitacoraService = ReturnType<typeof createBitacoraService>;
