import type { Request } from 'express';
import type { BitacoraService } from './bitacoraService.js';
import { getBitacoraDataMode } from '../config/bitacoraDataMode.js';
import { getCaseByPolicyIncident, listRecentCases } from '../db/bitacoraCaseReadRepository.js';
import { getPool } from '../db/pool.js';

export interface CaseDeviceResolution {
  policyIncident: string | null;
  deviceId: string | null;
  /** High-level source for operators (not a secret). */
  source: 'db' | 'fixture' | 'document' | 'none';
  note?: string;
}

function normalizeDeviceId(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function parsePolicyFromQuery(req: Request): string | undefined {
  const raw = req.query.policy_incident;
  if (typeof raw === 'string' && raw.trim() !== '') return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].trim() !== '') return raw[0].trim();
  return undefined;
}

/**
 * Resolves **`payload.device_id`** for the same case selection semantics as operator-meta / bitácora read.
 */
export async function resolveCaseDeviceIdForJoinProof(
  req: Request,
  service: BitacoraService,
): Promise<CaseDeviceResolution> {
  const mode = getBitacoraDataMode();
  const policyFromQuery = parsePolicyFromQuery(req);

  if (mode === 'db') {
    const pool = getPool();
    if (!pool) {
      return { policyIncident: policyFromQuery ?? null, deviceId: null, source: 'none', note: 'db_unavailable' };
    }
    if (policyFromQuery) {
      const row = await getCaseByPolicyIncident(pool, policyFromQuery);
      if (!row) {
        return { policyIncident: policyFromQuery, deviceId: null, source: 'none', note: 'case_not_found' };
      }
      return {
        policyIncident: row.policy_incident,
        deviceId: normalizeDeviceId(row.device_id),
        source: 'db',
      };
    }
    const recent = await listRecentCases(pool, 1);
    if (recent.length === 0) {
      return { policyIncident: null, deviceId: null, source: 'none', note: 'no_cases' };
    }
    const row = recent[0];
    return {
      policyIncident: row.policy_incident,
      deviceId: normalizeDeviceId(row.device_id),
      source: 'db',
    };
  }

  try {
    const doc = await service.getBitacoraDocument(req);
    const piRaw = doc.payload?.policy_incident;
    const policyIncident =
      piRaw == null ? null : typeof piRaw === 'string' && piRaw.trim() === '' ? null : String(piRaw).trim();
    return {
      policyIncident,
      deviceId: normalizeDeviceId(doc.payload?.device_id),
      source: mode === 'fixture' ? 'fixture' : 'document',
    };
  } catch {
    return {
      policyIncident: policyFromQuery ?? null,
      deviceId: null,
      source: 'none',
      note: 'document_resolution_failed',
    };
  }
}
