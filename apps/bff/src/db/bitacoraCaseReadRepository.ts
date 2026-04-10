import type { Pool } from 'pg';
import type { BitacoraCaseDbRow, BitacoraCaseListItem } from '@redesas-lite/shared';

const SELECT_COLUMNS = `
  id,
  policy_incident,
  device_id,
  vehicle_vin,
  vehicle_year,
  vehicle_plates,
  vehicle_make,
  vehicle_model,
  vehicle_color,
  insured_name,
  incident_type,
  reporter_name,
  reporter_phone,
  driver_name,
  policy_number,
  policy_start_date,
  policy_end_date,
  insured_amount,
  agent_code,
  env,
  result_status,
  result_success,
  result_message,
  reg_device_id,
  reg_vin,
  reg_plates,
  reg_vehicle_status,
  emergency_contact
`;

function rowToCase(r: Record<string, unknown>): BitacoraCaseDbRow {
  return {
    id: r.id as string | number,
    policy_incident: String(r.policy_incident ?? ''),
    device_id: r.device_id == null ? null : String(r.device_id),
    vehicle_vin: r.vehicle_vin == null ? null : String(r.vehicle_vin),
    vehicle_year: r.vehicle_year == null ? null : Number(r.vehicle_year),
    vehicle_plates: r.vehicle_plates == null ? null : String(r.vehicle_plates),
    vehicle_make: r.vehicle_make == null ? null : String(r.vehicle_make),
    vehicle_model: r.vehicle_model == null ? null : String(r.vehicle_model),
    vehicle_color: r.vehicle_color == null ? null : String(r.vehicle_color),
    insured_name: r.insured_name == null ? null : String(r.insured_name),
    incident_type: r.incident_type == null ? null : String(r.incident_type),
    reporter_name: r.reporter_name == null ? null : String(r.reporter_name),
    reporter_phone: r.reporter_phone == null ? null : String(r.reporter_phone),
    driver_name: r.driver_name == null ? null : String(r.driver_name),
    policy_number: r.policy_number == null ? null : String(r.policy_number),
    policy_start_date: r.policy_start_date as BitacoraCaseDbRow['policy_start_date'],
    policy_end_date: r.policy_end_date as BitacoraCaseDbRow['policy_end_date'],
    insured_amount: r.insured_amount as BitacoraCaseDbRow['insured_amount'],
    agent_code: r.agent_code == null ? null : String(r.agent_code),
    env: r.env == null ? null : String(r.env),
    result_status: r.result_status == null ? null : String(r.result_status),
    result_success: r.result_success == null ? null : Boolean(r.result_success),
    result_message: r.result_message == null ? null : String(r.result_message),
    reg_device_id: r.reg_device_id == null ? null : String(r.reg_device_id),
    reg_vin: r.reg_vin == null ? null : String(r.reg_vin),
    reg_plates: r.reg_plates == null ? null : String(r.reg_plates),
    reg_vehicle_status: r.reg_vehicle_status == null ? null : String(r.reg_vehicle_status),
    emergency_contact: r.emergency_contact as BitacoraCaseDbRow['emergency_contact'],
  };
}

export async function getCaseByPolicyIncident(
  pool: Pool,
  policyIncident: string,
): Promise<BitacoraCaseDbRow | null> {
  const r = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM bitacora_cases WHERE policy_incident = $1 LIMIT 1`,
    [policyIncident],
  );
  if (r.rows.length === 0) return null;
  return rowToCase(r.rows[0] as Record<string, unknown>);
}

/** Minimal row for operator observability (ids + timestamps). */
export interface CaseOperatorMetaRow {
  caseId: string;
  policyIncident: string;
  latestRawId: string | null;
  updatedAtUtc: string;
  env: string | null;
}

function rowToOperatorMeta(row: Record<string, unknown>): CaseOperatorMetaRow {
  const updated = (row as { updated_at?: unknown }).updated_at;
  let updatedAtUtc: string;
  if (updated instanceof Date) {
    updatedAtUtc = updated.toISOString();
  } else if (typeof updated === 'string') {
    const d = new Date(updated);
    updatedAtUtc = Number.isNaN(d.getTime()) ? updated : d.toISOString();
  } else {
    updatedAtUtc = new Date(0).toISOString();
  }
  const lid = (row as { latest_raw_id?: unknown }).latest_raw_id;
  const latestRawId =
    lid == null ? null : typeof lid === 'bigint' ? lid.toString() : String(lid);
  return {
    caseId: String((row as { id?: unknown }).id ?? ''),
    policyIncident: String((row as { policy_incident?: unknown }).policy_incident ?? ''),
    latestRawId,
    updatedAtUtc,
    env: (row as { env?: unknown }).env == null ? null : String((row as { env?: unknown }).env),
  };
}

/**
 * One case for operator panel: by **`policy_incident`**, or most recently updated if omitted.
 */
export async function getCaseOperatorMeta(
  pool: Pool,
  policyIncident: string | undefined,
): Promise<CaseOperatorMetaRow | null> {
  if (policyIncident != null && policyIncident.trim() !== '') {
    const r = await pool.query(
      `SELECT id, policy_incident, latest_raw_id, updated_at, env
       FROM bitacora_cases WHERE policy_incident = $1 LIMIT 1`,
      [policyIncident.trim()],
    );
    if (r.rows.length === 0) return null;
    return rowToOperatorMeta(r.rows[0] as Record<string, unknown>);
  }
  const r = await pool.query(
    `SELECT id, policy_incident, latest_raw_id, updated_at, env
     FROM bitacora_cases ORDER BY updated_at DESC LIMIT 1`,
  );
  if (r.rows.length === 0) return null;
  return rowToOperatorMeta(r.rows[0] as Record<string, unknown>);
}

export async function listRecentCases(pool: Pool, limit: number): Promise<BitacoraCaseDbRow[]> {
  const capped = Math.min(Math.max(1, limit), 100);
  const r = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM bitacora_cases ORDER BY updated_at DESC LIMIT $1`,
    [capped],
  );
  return r.rows.map((row) => rowToCase(row as Record<string, unknown>));
}

function toIsoUpdatedAt(v: unknown): string {
  if (v instanceof Date) {
    return v.toISOString();
  }
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toISOString();
  }
  return new Date(0).toISOString();
}

/**
 * Compact list for the case switcher: policy_incident, plates, insured_name, updated_at.
 * Optional `search` filters with ILIKE on policy_incident, vehicle_plates, insured_name.
 */
export async function listCasesCompact(
  pool: Pool,
  options: { limit: number; search?: string },
): Promise<BitacoraCaseListItem[]> {
  const capped = Math.min(Math.max(1, options.limit), 100);
  const q = options.search?.trim() ?? '';

  if (q === '') {
    const r = await pool.query(
      `SELECT policy_incident, vehicle_plates, insured_name, updated_at
       FROM bitacora_cases
       ORDER BY updated_at DESC
       LIMIT $1`,
      [capped],
    );
    return r.rows.map((row) => ({
      policy_incident: String((row as Record<string, unknown>).policy_incident ?? ''),
      plates:
        (row as Record<string, unknown>).vehicle_plates == null
          ? null
          : String((row as Record<string, unknown>).vehicle_plates),
      insured_name:
        (row as Record<string, unknown>).insured_name == null
          ? null
          : String((row as Record<string, unknown>).insured_name),
      updated_at: toIsoUpdatedAt((row as Record<string, unknown>).updated_at),
    }));
  }

  const escapeLike = (s: string) => s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  const like = `%${escapeLike(q)}%`;
  const r = await pool.query(
    `SELECT policy_incident, vehicle_plates, insured_name, updated_at
     FROM bitacora_cases
     WHERE policy_incident ILIKE $1 ESCAPE '\\'
        OR COALESCE(vehicle_plates, '') ILIKE $1 ESCAPE '\\'
        OR COALESCE(insured_name, '') ILIKE $1 ESCAPE '\\'
     ORDER BY updated_at DESC
     LIMIT $2`,
    [like, capped],
  );
  return r.rows.map((row) => ({
    policy_incident: String((row as Record<string, unknown>).policy_incident ?? ''),
    plates:
      (row as Record<string, unknown>).vehicle_plates == null
        ? null
        : String((row as Record<string, unknown>).vehicle_plates),
    insured_name:
      (row as Record<string, unknown>).insured_name == null
        ? null
        : String((row as Record<string, unknown>).insured_name),
    updated_at: toIsoUpdatedAt((row as Record<string, unknown>).updated_at),
  }));
}
