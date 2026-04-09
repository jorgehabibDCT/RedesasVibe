import type { BitacoraDocument, EmergencyContact } from './types.js';
import { parsePolicyDate } from './dates.js';
import {
  collapseInternalSpaces,
  isEffectivelyMissingColor,
  normalizeDeviceId,
  trimOrEmpty,
} from './normalize.js';
import { isRegistrationSuccess } from './resolve.js';

/** Thrown when `policy_incident` is missing or blank (required business key). */
export class IngestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IngestValidationError';
  }
}

/** Flat row matching `bitacora_cases` normalized columns (excluding id, timestamps, latest_raw_id). */
export interface BitacoraCaseNormalizedRow {
  policy_incident: string;
  device_id: string | null;
  vehicle_vin: string | null;
  vehicle_year: number | null;
  vehicle_plates: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  insured_name: string | null;
  incident_type: string | null;
  reporter_name: string | null;
  reporter_phone: string | null;
  driver_name: string | null;
  policy_number: string | null;
  policy_start_date: string | null;
  policy_end_date: string | null;
  insured_amount: string | null;
  agent_code: string | null;
  env: string | null;
  result_status: string | null;
  result_success: boolean | null;
  result_message: string | null;
  reg_device_id: string | null;
  reg_vin: string | null;
  reg_plates: string | null;
  reg_vehicle_status: string | null;
  emergency_contact: EmergencyContact | null;
}

/** ISO `YYYY-MM-DD` for PostgreSQL DATE, or null if unparseable / missing. */
export function parsePolicyDateToIsoDate(value: string | null | undefined): string | null {
  const d = parsePolicyDate(value);
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function emptyToNull(s: string): string | null {
  return s === '' ? null : s;
}

function numOrNull(n: unknown): string | null {
  if (n == null) return null;
  if (typeof n === 'number' && Number.isFinite(n)) return String(n);
  return null;
}

/**
 * Emergency contact for persistence: prefer `result.result.data.emergency_contact` when registration
 * succeeded; otherwise synthesize from reporter when names/phones exist.
 */
export function normalizeEmergencyContactForDb(doc: BitacoraDocument): EmergencyContact | null {
  const data = doc.result?.result?.data;
  if (isRegistrationSuccess(doc) && data?.emergency_contact) {
    const ec = data.emergency_contact;
    const name = trimOrEmpty(ec?.name);
    const phone = trimOrEmpty(ec?.phone);
    if (name || phone) {
      return { name: name || '—', phone: phone || '' };
    }
  }
  const rn = trimOrEmpty(doc.payload.reporter_name);
  const rp = trimOrEmpty(doc.payload.reporter_phone);
  if (rn || rp) {
    return { name: rn || '—', phone: rp };
  }
  return null;
}

/**
 * Maps canonical `BitacoraDocument` to DB columns: trimmed strings, N/A color → null, parsed dates,
 * numeric amount as decimal string, registration fields from `result.result.data` when present.
 */
export function normalizeBitacoraDocumentToCaseRow(doc: BitacoraDocument): BitacoraCaseNormalizedRow {
  if (doc.payload == null) {
    throw new IngestValidationError('payload is required');
  }

  const pi = trimOrEmpty(doc.payload.policy_incident);
  if (!pi) {
    throw new IngestValidationError('policy_incident is required');
  }

  const p = doc.payload;
  const colorRaw = p?.vehicle_color;
  const vehicleColor = isEffectivelyMissingColor(colorRaw) ? null : emptyToNull(collapseInternalSpaces(colorRaw ?? ''));

  const { make, model } = {
    make: emptyToNull(collapseInternalSpaces(p?.vehicle_make ?? '')),
    model: emptyToNull(collapseInternalSpaces(p?.vehicle_model ?? '')),
  };

  const yearRaw = p?.vehicle_year as number | string | null | undefined;
  const vehicleYear =
    yearRaw == null || yearRaw === ''
      ? null
      : typeof yearRaw === 'number' && Number.isFinite(yearRaw)
        ? yearRaw
        : Number.isFinite(Number(yearRaw))
          ? Math.trunc(Number(yearRaw))
          : null;

  const data = doc.result?.result?.data;
  const hasReg = isRegistrationSuccess(doc) && data != null;

  let reg_device_id: string | null = null;
  let reg_vin: string | null = null;
  let reg_plates: string | null = null;
  let reg_vehicle_status: string | null = null;
  if (hasReg && data) {
    reg_device_id = emptyToNull(normalizeDeviceId(data.device_id));
    reg_vin = emptyToNull(trimOrEmpty(data.vin).toUpperCase());
    reg_plates = emptyToNull(trimOrEmpty(data.plates).toUpperCase());
    reg_vehicle_status = emptyToNull(trimOrEmpty(data.status));
  }

  const emergency_contact = normalizeEmergencyContactForDb(doc);

  const insuredRaw = p?.insured_amount;
  const insured_amount =
    insuredRaw == null
      ? null
      : typeof insuredRaw === 'number' && Number.isFinite(insuredRaw)
        ? String(insuredRaw)
        : numOrNull(insuredRaw);

  return {
    policy_incident: pi,
    device_id: emptyToNull(normalizeDeviceId(p?.device_id)),
    vehicle_vin: emptyToNull(trimOrEmpty(p?.vehicle_vin)),
    vehicle_year: vehicleYear,
    vehicle_plates: emptyToNull(trimOrEmpty(p?.vehicle_plates)),
    vehicle_make: make,
    vehicle_model: model,
    vehicle_color: vehicleColor,
    insured_name: emptyToNull(trimOrEmpty(p?.insured_name)),
    incident_type: emptyToNull(trimOrEmpty(p?.incident_type)),
    reporter_name: emptyToNull(trimOrEmpty(p?.reporter_name)),
    reporter_phone: emptyToNull(trimOrEmpty(p?.reporter_phone)),
    driver_name: emptyToNull(trimOrEmpty(p?.driver_name)),
    policy_number: emptyToNull(trimOrEmpty(p?.policy_number)),
    policy_start_date: parsePolicyDateToIsoDate(p?.policy_start_date),
    policy_end_date: parsePolicyDateToIsoDate(p?.policy_end_date),
    insured_amount,
    agent_code: emptyToNull(trimOrEmpty(p?.agent_code)),
    env: doc.env != null && String(doc.env).trim() !== '' ? trimOrEmpty(doc.env) : null,
    result_status: doc.result?.status != null ? trimOrEmpty(doc.result.status) : null,
    result_success:
      doc.result?.result?.success === undefined || doc.result?.result?.success === null
        ? null
        : Boolean(doc.result?.result?.success),
    result_message: emptyToNull(trimOrEmpty(doc.result?.result?.message)),
    reg_device_id,
    reg_vin,
    reg_plates,
    reg_vehicle_status,
    emergency_contact,
  };
}
