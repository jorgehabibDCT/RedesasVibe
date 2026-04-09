import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { BitacoraDocument } from '@redesas-lite/shared';
import { normalizeBitacoraDocumentToCaseRow } from '@redesas-lite/shared';
import { upsertCaseAppendRaw } from './bitacoraIngestRepository.js';

const minimalDoc: BitacoraDocument = {
  payload: {
    device_id: 1,
    vehicle_vin: 'VIN',
    vehicle_year: 2026,
    vehicle_plates: 'P',
    vehicle_make: 'M',
    vehicle_model: 'M',
    vehicle_color: 'N/A',
    insured_name: 'I',
    incident_type: 'Otro',
    reporter_name: 'R',
    reporter_phone: '1',
    driver_name: 'D',
    policy_number: 'PN',
    policy_incident: 'PI-001',
    policy_start_date: '01/01/2026',
    policy_end_date: '01/01/2027',
    insured_amount: 100,
    agent_code: 'A',
  },
  env: 'staging',
};

describe('upsertCaseAppendRaw', () => {
  it('upserts case, inserts raw jsonb, updates latest_raw_id', async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        calls.push({ sql, params: params ?? [] });
        if (sql.includes('INSERT INTO bitacora_cases')) {
          return { rows: [{ id: 7 }] };
        }
        if (sql.includes('INSERT INTO bitacora_ingest_raw')) {
          return { rows: [{ id: 99 }] };
        }
        if (sql.includes('UPDATE bitacora_cases')) {
          return { rowCount: 1, rows: [] };
        }
        return { rows: [] };
      }),
    } as unknown as PoolClient;

    const row = normalizeBitacoraDocumentToCaseRow(minimalDoc);
    const out = await upsertCaseAppendRaw(client, minimalDoc, row);

    expect(out).toEqual({ caseId: '7', rawId: '99' });

    const rawCall = calls.find((c) => c.sql.includes('bitacora_ingest_raw'));
    expect(rawCall).toBeDefined();
    const rawPayload = rawCall!.params[2] as Record<string, unknown>;
    expect(rawPayload.payload).toEqual(minimalDoc.payload);
    expect(rawPayload.env).toBe('staging');

    const updateCall = calls.find((c) => c.sql.includes('UPDATE bitacora_cases'));
    expect(updateCall?.params).toEqual(['99', '7']);
  });

  it('uses ON CONFLICT (policy_incident) so duplicate business keys update the same case row', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('INSERT INTO bitacora_cases')) {
        return { rows: [{ id: 7 }] };
      }
      if (sql.includes('INSERT INTO bitacora_ingest_raw')) {
        return { rows: [{ id: 100 }] };
      }
      if (sql.includes('UPDATE bitacora_cases')) {
        return { rowCount: 1, rows: [] };
      }
      return { rows: [] };
    });
    const client = { query } as unknown as PoolClient;

    const row = normalizeBitacoraDocumentToCaseRow(minimalDoc);
    await upsertCaseAppendRaw(client, minimalDoc, row);
    expect(query.mock.calls[0][0] as string).toContain('ON CONFLICT (policy_incident)');
  });
});
