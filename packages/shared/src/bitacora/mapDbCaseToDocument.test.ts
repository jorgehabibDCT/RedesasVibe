import { describe, expect, it } from 'vitest';
import { formatDbDateToPolicyField, mapDbCaseRowToBitacoraDocument } from './mapDbCaseToDocument.js';
import type { BitacoraCaseDbRow } from './mapDbCaseToDocument.js';

describe('formatDbDateToPolicyField', () => {
  it('formats ISO date strings', () => {
    expect(formatDbDateToPolicyField('2026-02-10')).toBe('10/02/2026');
  });

  it('handles empty', () => {
    expect(formatDbDateToPolicyField(null)).toBe('');
  });
});

describe('mapDbCaseRowToBitacoraDocument', () => {
  const base: BitacoraCaseDbRow = {
    id: 1,
    policy_incident: '0501227',
    device_id: '472568141300009',
    vehicle_vin: 'VIN',
    vehicle_year: 2026,
    vehicle_plates: 'KV2987A',
    vehicle_make: 'NISSAN',
    vehicle_model: 'NP300',
    vehicle_color: null,
    insured_name: 'ACME',
    incident_type: 'Otro',
    reporter_name: 'R',
    reporter_phone: '555',
    driver_name: 'D',
    policy_number: '043',
    policy_start_date: '2026-02-10',
    policy_end_date: '2027-02-10',
    insured_amount: 505305,
    agent_code: '43326',
    env: 'production',
    result_status: 'success',
    result_success: true,
    result_message: 'ok',
    reg_device_id: '472568141300009',
    reg_vin: 'VIN',
    reg_plates: 'KV2987A',
    reg_vehicle_status: 'registered',
    emergency_contact: { name: 'R', phone: '555' },
  };

  it('maps row to BitacoraDocument shape', () => {
    const doc = mapDbCaseRowToBitacoraDocument(base);
    expect(doc.payload.policy_incident).toBe('0501227');
    expect(doc.payload.vehicle_color).toBe('N/A');
    expect(doc.payload.policy_start_date).toBe('10/02/2026');
    expect(doc.payload.insured_amount).toBe(505305);
    expect(doc.payload.device_id).toBe(472568141300009);
    expect(doc.result?.status).toBe('success');
    expect(doc.result?.result?.data?.vin).toBe('VIN');
    expect(doc.env).toBe('production');
  });

  it('handles minimal row without result block', () => {
    const row: BitacoraCaseDbRow = {
      ...base,
      result_status: null,
      result_success: null,
      result_message: null,
      reg_device_id: null,
      reg_vin: null,
      reg_plates: null,
      reg_vehicle_status: null,
      emergency_contact: null,
    };
    const doc = mapDbCaseRowToBitacoraDocument(row);
    expect(doc.result).toBeUndefined();
  });
});
