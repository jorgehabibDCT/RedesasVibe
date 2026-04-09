import { describe, expect, it } from 'vitest';
import type { BitacoraDocument } from './types.js';
import {
  IngestValidationError,
  normalizeBitacoraDocumentToCaseRow,
  normalizeEmergencyContactForDb,
  parsePolicyDateToIsoDate,
} from './ingestNormalize.js';

const basePayload = {
  device_id: 472568141300009 as number | string,
  vehicle_vin: '  3N6CD35A6TK810425 ',
  vehicle_year: 2026,
  vehicle_plates: 'KV2987A',
  vehicle_make: 'NISSAN                 ',
  vehicle_model: 'CS NISSAN NP300 CH CAB 2P L4 2.5L V',
  vehicle_color: 'N/A',
  insured_name: 'TIP AUTO S.A. DE C.V. SOFOM E.N.R.',
  incident_type: 'Otro',
  reporter_name: 'OSIRI FERNANDO LOPEZ CORREA',
  reporter_phone: '5524544400',
  driver_name: 'ALEJANDRO ESPINOZA GARCIA',
  policy_number: '043130028769',
  policy_incident: '0501227',
  policy_start_date: '10/02/2026',
  policy_end_date: '10/02/2027',
  insured_amount: 505305,
  agent_code: '43326',
};

function doc(over?: Partial<BitacoraDocument>): BitacoraDocument {
  return {
    payload: { ...basePayload, ...over?.payload },
    result: over?.result,
    env: over?.env,
  };
}

describe('parsePolicyDateToIsoDate', () => {
  it('parses DD/MM/YYYY to ISO date', () => {
    expect(parsePolicyDateToIsoDate('10/02/2026')).toBe('2026-02-10');
  });

  it('returns null for invalid input', () => {
    expect(parsePolicyDateToIsoDate(undefined)).toBeNull();
    expect(parsePolicyDateToIsoDate('bad')).toBeNull();
  });
});

describe('normalizeBitacoraDocumentToCaseRow', () => {
  it('trims padded strings and maps canonical fixture-like doc', () => {
    const row = normalizeBitacoraDocumentToCaseRow(doc());
    expect(row.policy_incident).toBe('0501227');
    expect(row.vehicle_vin).toBe('3N6CD35A6TK810425');
    expect(row.vehicle_make).toBe('NISSAN');
    expect(row.vehicle_color).toBeNull();
    expect(row.policy_start_date).toBe('2026-02-10');
    expect(row.insured_amount).toBe('505305');
    expect(row.device_id).toBe('472568141300009');
  });

  it('normalizes device_id from string payload', () => {
    const row = normalizeBitacoraDocumentToCaseRow(
      doc({ payload: { ...basePayload, device_id: ' 472568141300009 ' } as typeof basePayload }),
    );
    expect(row.device_id).toBe('472568141300009');
  });

  it('prefers registration data when success', () => {
    const row = normalizeBitacoraDocumentToCaseRow(
      doc({
        result: {
          status: 'success',
          result: {
            success: true,
            message: 'ok',
            data: {
              device_id: '472568141300009',
              vin: 'VINREG',
              plates: 'PLREG',
              status: 'registered',
              emergency_contact: { name: 'EC', phone: '555' },
            },
          },
        },
      }),
    );
    expect(row.reg_vin).toBe('VINREG');
    expect(row.reg_plates).toBe('PLREG');
    expect(row.reg_vehicle_status).toBe('registered');
    expect(row.reg_device_id).toBe('472568141300009');
  });

  it('handles missing optional result and env', () => {
    const row = normalizeBitacoraDocumentToCaseRow({
      payload: {
        ...basePayload,
        vehicle_year: undefined as unknown as number,
        driver_name: '',
      },
    });
    expect(row.result_success).toBeNull();
    expect(row.env).toBeNull();
    expect(row.vehicle_year).toBeNull();
    expect(row.driver_name).toBeNull();
  });

  it('throws without policy_incident', () => {
    expect(() =>
      normalizeBitacoraDocumentToCaseRow({
        payload: { ...basePayload, policy_incident: '   ' },
      }),
    ).toThrow(IngestValidationError);
  });

  it('throws without payload', () => {
    expect(() => normalizeBitacoraDocumentToCaseRow({} as BitacoraDocument)).toThrow(
      IngestValidationError,
    );
  });
});

describe('normalizeEmergencyContactForDb', () => {
  it('uses registration emergency_contact when present', () => {
    const ec = normalizeEmergencyContactForDb(
      doc({
        result: {
          status: 'success',
          result: {
            success: true,
            data: {
              device_id: '1',
              vin: 'v',
              plates: 'p',
              status: 'registered',
              emergency_contact: { name: 'A', phone: '123' },
            },
          },
        },
      }),
    );
    expect(ec).toEqual({ name: 'A', phone: '123' });
  });

  it('falls back to reporter when no registration emergency', () => {
    const ec = normalizeEmergencyContactForDb(
      doc({
        result: { status: 'success', result: { success: false } },
      }),
    );
    expect(ec?.name).toContain('OSIRI');
  });

  it('returns null when no reporter and no emergency', () => {
    const ec = normalizeEmergencyContactForDb(
      doc({
        payload: {
          ...basePayload,
          reporter_name: '',
          reporter_phone: '',
        },
        result: undefined,
      }),
    );
    expect(ec).toBeNull();
  });
});
