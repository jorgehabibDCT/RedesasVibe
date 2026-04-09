import type { BitacoraDocument, BitacoraPayload, EmergencyContact, RegistrationData } from './types.js';

/**
 * Row shape returned from `bitacora_cases` (Postgres `pg` driver).
 * Dates may be `Date` or ISO strings depending on driver settings.
 */
export interface BitacoraCaseDbRow {
  id: string | number;
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
  policy_start_date: Date | string | null;
  policy_end_date: Date | string | null;
  insured_amount: string | number | null;
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

function str(v: string | null | undefined, fallback = ''): string {
  return v ?? fallback;
}

/** Format Postgres DATE / ISO date string to DD/MM/YYYY (spec display). */
export function formatDbDateToPolicyField(value: Date | string | null | undefined): string {
  if (value == null) return '';
  if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (m) {
      return `${m[3]}/${m[2]}/${m[1]}`;
    }
    return value;
  }
  const d = value;
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function deviceIdForPayload(deviceId: string | null): number | string {
  if (deviceId == null || deviceId === '') return '';
  const n = Number(deviceId);
  if (Number.isFinite(n) && String(n) === deviceId.trim()) return n;
  return deviceId;
}

function insuredAmountNumber(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Maps a normalized `bitacora_cases` row to the canonical `BitacoraDocument` for the SPA.
 */
export function mapDbCaseRowToBitacoraDocument(row: BitacoraCaseDbRow): BitacoraDocument {
  const vehicleYear = row.vehicle_year != null && Number.isFinite(Number(row.vehicle_year))
    ? Number(row.vehicle_year)
    : 0;

  const payload: BitacoraPayload = {
    device_id: deviceIdForPayload(row.device_id),
    vehicle_vin: str(row.vehicle_vin),
    vehicle_year: vehicleYear,
    vehicle_plates: str(row.vehicle_plates),
    vehicle_make: str(row.vehicle_make),
    vehicle_model: str(row.vehicle_model),
    vehicle_color: row.vehicle_color == null || row.vehicle_color === '' ? 'N/A' : str(row.vehicle_color),
    insured_name: str(row.insured_name),
    incident_type: str(row.incident_type),
    reporter_name: str(row.reporter_name),
    reporter_phone: str(row.reporter_phone),
    driver_name: str(row.driver_name),
    policy_number: str(row.policy_number),
    policy_incident: str(row.policy_incident),
    policy_start_date: formatDbDateToPolicyField(row.policy_start_date),
    policy_end_date: formatDbDateToPolicyField(row.policy_end_date),
    insured_amount: insuredAmountNumber(row.insured_amount),
    agent_code: str(row.agent_code),
  };

  const hasReg =
    (row.reg_device_id != null && row.reg_device_id !== '') ||
    (row.reg_vin != null && row.reg_vin !== '') ||
    (row.reg_plates != null && row.reg_plates !== '');

  const hasResultMeta =
    row.result_status != null ||
    row.result_success !== null ||
    (row.result_message != null && row.result_message !== '') ||
    hasReg;

  let result: BitacoraDocument['result'];
  if (hasResultMeta) {
    let data: RegistrationData | null = null;
    if (hasReg) {
      const ec = row.emergency_contact;
      data = {
        device_id: str(row.reg_device_id),
        vin: str(row.reg_vin),
        plates: str(row.reg_plates),
        status: str(row.reg_vehicle_status),
        emergency_contact:
          ec && (str(ec.name) || str(ec.phone)) ? { name: str(ec.name, '—'), phone: str(ec.phone) } : undefined,
      };
    }

    result = {
      status: str(row.result_status, 'success'),
      result: {
        success: row.result_success === null ? undefined : row.result_success,
        message: row.result_message == null ? undefined : str(row.result_message),
        data: data ?? undefined,
      },
    };
  }

  const doc: BitacoraDocument = { payload };
  if (result) doc.result = result;
  if (row.env != null && String(row.env).trim() !== '') {
    doc.env = str(row.env);
  }

  return doc;
}
