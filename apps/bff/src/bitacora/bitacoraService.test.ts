import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { Request } from 'express';
import type { BitacoraCaseDbRow } from '@redesas-lite/shared';
import { createBitacoraService } from './bitacoraService.js';
import {
  BitacoraDbNoDefaultError,
  BitacoraDbNotFoundError,
  BitacoraDbUnavailableError,
} from './bitacoraDbErrors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, '../../../../fixtures');

function loadFixture() {
  return readFileSync(join(fixtures, 'bitacora-canonical.json'), 'utf-8');
}

function minimalReq(auth: string, query?: Record<string, string>): Request {
  return { headers: { authorization: auth }, query: query ?? {} } as Request;
}

const noopPool = (): null => null;

const sampleDbRow: BitacoraCaseDbRow = {
  id: 1,
  policy_incident: '0501227',
  device_id: '472568141300009',
  vehicle_vin: 'VIN',
  vehicle_year: 2026,
  vehicle_plates: 'P',
  vehicle_make: 'M',
  vehicle_model: 'M',
  vehicle_color: null,
  insured_name: 'I',
  incident_type: 'Otro',
  reporter_name: 'R',
  reporter_phone: '1',
  driver_name: 'D',
  policy_number: 'PN',
  policy_start_date: '2026-01-01',
  policy_end_date: '2027-01-01',
  insured_amount: 100,
  agent_code: 'A',
  env: 'staging',
  result_status: 'success',
  result_success: true,
  result_message: 'ok',
  reg_device_id: '1',
  reg_vin: 'VIN',
  reg_plates: 'P',
  reg_vehicle_status: 'registered',
  emergency_contact: { name: 'R', phone: '1' },
};

describe('createBitacoraService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    process.env = { ...originalEnv };
    process.env.BITACORA_DATA_MODE = 'fixture';
    process.env.PEGASUS_AUTH_DISABLED = 'true';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('fixture mode returns canonical fixture JSON', async () => {
    const svc = createBitacoraService({ loadFixtureJson: loadFixture, getPool: noopPool });
    const doc = await svc.getBitacoraDocument(minimalReq('Bearer x'));
    expect(doc.payload.policy_incident).toBe('0501227');
  });

  it('integration mode fetches upstream and normalizes', async () => {
    process.env.BITACORA_DATA_MODE = 'integration';
    process.env.BITACORA_UPSTREAM_BASE_URL = 'http://upstream.test';
    process.env.BITACORA_UPSTREAM_PATH = '/raw';

    const raw = readFileSync(join(fixtures, 'upstream-raw-sample.json'), 'utf-8');
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(JSON.parse(raw)),
    } as Response);

    const svc = createBitacoraService({ loadFixtureJson: loadFixture, getPool: noopPool });
    const doc = await svc.getBitacoraDocument(minimalReq('Bearer x'));
    expect(doc.env).toBe('production');
    expect(doc.payload.policy_number).toBe('043130028769');
    expect(fetch).toHaveBeenCalledWith(
      'http://upstream.test/raw',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer x' }),
      }),
    );
  });

  it('integration mode falls back to fixture when flag is set and upstream fails', async () => {
    process.env.BITACORA_DATA_MODE = 'integration';
    process.env.BITACORA_UPSTREAM_BASE_URL = 'http://upstream.test';
    process.env.BITACORA_FIXTURE_ON_UPSTREAM_ERROR = 'true';

    vi.mocked(fetch).mockRejectedValue(new Error('network'));

    const svc = createBitacoraService({ loadFixtureJson: loadFixture, getPool: noopPool });
    const doc = await svc.getBitacoraDocument(minimalReq('Bearer x'));
    expect(doc.payload.policy_incident).toBe('0501227');
  });

  it('integration mode propagates when fetch fails and no fallback', async () => {
    process.env.BITACORA_DATA_MODE = 'integration';
    process.env.BITACORA_UPSTREAM_BASE_URL = 'http://upstream.test';
    process.env.BITACORA_FIXTURE_ON_UPSTREAM_ERROR = 'false';

    vi.mocked(fetch).mockRejectedValue(new Error('network'));

    const svc = createBitacoraService({ loadFixtureJson: loadFixture, getPool: noopPool });
    await expect(svc.getBitacoraDocument(minimalReq('Bearer x'))).rejects.toThrow();
  });

  it('db mode returns document by policy_incident', async () => {
    process.env.BITACORA_DATA_MODE = 'db';
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('WHERE policy_incident')) {
          return { rows: [sampleDbRow as unknown as Record<string, unknown>], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    const svc = createBitacoraService({
      loadFixtureJson: loadFixture,
      getPool: () => pool as unknown as Pool,
    });
    const doc = await svc.getBitacoraDocument(
      minimalReq('Bearer x', { policy_incident: '0501227' }),
    );
    expect(doc.payload.policy_incident).toBe('0501227');
    expect(doc.payload.vehicle_vin).toBe('VIN');
  });

  it('db mode uses most recent case when policy_incident omitted', async () => {
    process.env.BITACORA_DATA_MODE = 'db';
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('ORDER BY updated_at')) {
          return { rows: [sampleDbRow as unknown as Record<string, unknown>], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    const svc = createBitacoraService({
      loadFixtureJson: loadFixture,
      getPool: () => pool as unknown as Pool,
    });
    const doc = await svc.getBitacoraDocument(minimalReq('Bearer x'));
    expect(doc.payload.policy_incident).toBe('0501227');
  });

  it('db mode throws when policy not found', async () => {
    process.env.BITACORA_DATA_MODE = 'db';
    const pool = {
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    };
    const svc = createBitacoraService({
      loadFixtureJson: loadFixture,
      getPool: () => pool as unknown as Pool,
    });
    await expect(
      svc.getBitacoraDocument(minimalReq('Bearer x', { policy_incident: 'missing' })),
    ).rejects.toBeInstanceOf(BitacoraDbNotFoundError);
  });

  it('db mode throws when no default and table empty', async () => {
    process.env.BITACORA_DATA_MODE = 'db';
    const pool = {
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    };
    const svc = createBitacoraService({
      loadFixtureJson: loadFixture,
      getPool: () => pool as unknown as Pool,
    });
    await expect(svc.getBitacoraDocument(minimalReq('Bearer x'))).rejects.toBeInstanceOf(
      BitacoraDbNoDefaultError,
    );
  });

  it('db mode throws when pool unavailable', async () => {
    process.env.BITACORA_DATA_MODE = 'db';
    const svc = createBitacoraService({ loadFixtureJson: loadFixture, getPool: () => null });
    await expect(svc.getBitacoraDocument(minimalReq('Bearer x'))).rejects.toBeInstanceOf(
      BitacoraDbUnavailableError,
    );
  });
});
