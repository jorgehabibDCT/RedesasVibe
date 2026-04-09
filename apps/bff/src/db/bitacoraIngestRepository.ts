import type { PoolClient } from 'pg';
import type { BitacoraDocument } from '@redesas-lite/shared';
import type { BitacoraCaseNormalizedRow } from '@redesas-lite/shared';

const UPSERT_CASE_SQL = `
INSERT INTO bitacora_cases (
  policy_incident, device_id, vehicle_vin, vehicle_year, vehicle_plates,
  vehicle_make, vehicle_model, vehicle_color,
  insured_name, incident_type, reporter_name, reporter_phone, driver_name,
  policy_number, policy_start_date, policy_end_date, insured_amount, agent_code,
  env, result_status, result_success, result_message,
  reg_device_id, reg_vin, reg_plates, reg_vehicle_status, emergency_contact
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::date, $16::date, $17::numeric, $18,
  $19, $20, $21, $22, $23, $24, $25, $26, $27::jsonb
)
ON CONFLICT (policy_incident) DO UPDATE SET
  device_id = EXCLUDED.device_id,
  vehicle_vin = EXCLUDED.vehicle_vin,
  vehicle_year = EXCLUDED.vehicle_year,
  vehicle_plates = EXCLUDED.vehicle_plates,
  vehicle_make = EXCLUDED.vehicle_make,
  vehicle_model = EXCLUDED.vehicle_model,
  vehicle_color = EXCLUDED.vehicle_color,
  insured_name = EXCLUDED.insured_name,
  incident_type = EXCLUDED.incident_type,
  reporter_name = EXCLUDED.reporter_name,
  reporter_phone = EXCLUDED.reporter_phone,
  driver_name = EXCLUDED.driver_name,
  policy_number = EXCLUDED.policy_number,
  policy_start_date = EXCLUDED.policy_start_date,
  policy_end_date = EXCLUDED.policy_end_date,
  insured_amount = EXCLUDED.insured_amount,
  agent_code = EXCLUDED.agent_code,
  env = EXCLUDED.env,
  result_status = EXCLUDED.result_status,
  result_success = EXCLUDED.result_success,
  result_message = EXCLUDED.result_message,
  reg_device_id = EXCLUDED.reg_device_id,
  reg_vin = EXCLUDED.reg_vin,
  reg_plates = EXCLUDED.reg_plates,
  reg_vehicle_status = EXCLUDED.reg_vehicle_status,
  emergency_contact = EXCLUDED.emergency_contact,
  updated_at = now()
RETURNING id
`;

const INSERT_RAW_SQL = `
INSERT INTO bitacora_ingest_raw (policy_incident, device_id, raw_payload, case_id)
VALUES ($1, $2, $3::jsonb, $4)
RETURNING id
`;

const UPDATE_CASE_LATEST_RAW_SQL = `
UPDATE bitacora_cases SET latest_raw_id = $1, updated_at = now() WHERE id = $2
`;

function caseInsertValues(row: BitacoraCaseNormalizedRow): unknown[] {
  return [
    row.policy_incident,
    row.device_id,
    row.vehicle_vin,
    row.vehicle_year,
    row.vehicle_plates,
    row.vehicle_make,
    row.vehicle_model,
    row.vehicle_color,
    row.insured_name,
    row.incident_type,
    row.reporter_name,
    row.reporter_phone,
    row.driver_name,
    row.policy_number,
    row.policy_start_date,
    row.policy_end_date,
    row.insured_amount,
    row.agent_code,
    row.env,
    row.result_status,
    row.result_success,
    row.result_message,
    row.reg_device_id,
    row.reg_vin,
    row.reg_plates,
    row.reg_vehicle_status,
    row.emergency_contact,
  ];
}

/** Returns whether a case row already exists for this business key (before upsert). */
export async function caseExistsByPolicyIncident(
  client: PoolClient,
  policyIncident: string,
): Promise<boolean> {
  const r = await client.query(
    'SELECT 1 FROM bitacora_cases WHERE policy_incident = $1 LIMIT 1',
    [policyIncident],
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * Upserts normalized case row, appends raw payload, sets `latest_raw_id` on the case.
 * Caller must run inside a transaction (`BEGIN` / `COMMIT`).
 */
export async function upsertCaseAppendRaw(
  client: PoolClient,
  doc: BitacoraDocument,
  row: BitacoraCaseNormalizedRow,
): Promise<{ caseId: string; rawId: string }> {
  const up = await client.query(UPSERT_CASE_SQL, caseInsertValues(row));
  const caseId = String((up.rows[0] as { id: string | number }).id);

  const rawPayload = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;

  const rawIns = await client.query(INSERT_RAW_SQL, [
    row.policy_incident,
    row.device_id,
    rawPayload,
    caseId,
  ]);
  const rawId = String((rawIns.rows[0] as { id: string | number }).id);

  await client.query(UPDATE_CASE_LATEST_RAW_SQL, [rawId, caseId]);

  return { caseId, rawId };
}
