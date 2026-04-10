import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BitacoraDocument } from '@redesas-lite/shared';
import { clearMemoryToken, getBearerToken, setMemoryTokenForTests } from '../auth/memoryToken.js';
import { BitacoraAuthError } from './authErrors.js';
import { fetchBitacoraDocument } from './fetchBitacora.js';

const minimal: BitacoraDocument = {
  payload: {
    device_id: 1,
    vehicle_vin: 'V',
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
    policy_number: 'P',
    policy_incident: 'PI',
    policy_start_date: '01/01/2026',
    policy_end_date: '01/01/2027',
    insured_amount: 100,
    agent_code: 'A',
  },
  env: 'staging',
};

describe('fetchBitacoraDocument', () => {
  beforeEach(() => {
    clearMemoryToken();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws BitacoraAuthError when no bearer token', async () => {
    await expect(fetchBitacoraDocument()).rejects.toMatchObject({
      problem: 'missing_token',
    });
  });

  it('sends Authorization Bearer on every request', async () => {
    setMemoryTokenForTests('tok');
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(minimal),
    } as Response);

    await fetchBitacoraDocument();

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/bitacora',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer tok',
        }),
      }),
    );
  });

  it('appends policy_incident when provided', async () => {
    setMemoryTokenForTests('tok');
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(minimal),
    } as Response);

    await fetchBitacoraDocument('040003375123');

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/bitacora?policy_incident=040003375123',
      expect.any(Object),
    );
  });

  it('clears memory token and throws BitacoraAuthError on 401 with problem', async () => {
    setMemoryTokenForTests('bad');
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ problem: 'token_expired', message: 'exp' }),
    } as Response);

    await expect(fetchBitacoraDocument()).rejects.toBeInstanceOf(BitacoraAuthError);
    expect(getBearerToken()).toBeNull();
  });

  it('surfaces 403 authorization message', async () => {
    setMemoryTokenForTests('tok');
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ message: 'No autorizado para usar esta aplicación.' }),
    } as Response);

    await expect(fetchBitacoraDocument()).rejects.toThrow(
      'bitacora_client:403:No autorizado para usar esta aplicación.',
    );
  });
});
