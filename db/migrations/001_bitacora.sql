-- Bitácora: raw intake + normalized latest state per policy_incident
-- Apply with: psql "$DATABASE_URL" -f db/migrations/001_bitacora.sql

BEGIN;

CREATE TABLE bitacora_cases (
  id BIGSERIAL PRIMARY KEY,
  policy_incident TEXT NOT NULL UNIQUE,
  device_id TEXT,
  vehicle_vin TEXT,
  vehicle_year INTEGER,
  vehicle_plates TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_color TEXT,
  insured_name TEXT,
  incident_type TEXT,
  reporter_name TEXT,
  reporter_phone TEXT,
  driver_name TEXT,
  policy_number TEXT,
  policy_start_date DATE,
  policy_end_date DATE,
  insured_amount NUMERIC(18, 2),
  agent_code TEXT,
  env TEXT,
  result_status TEXT,
  result_success BOOLEAN,
  result_message TEXT,
  reg_device_id TEXT,
  reg_vin TEXT,
  reg_plates TEXT,
  reg_vehicle_status TEXT,
  emergency_contact JSONB,
  latest_raw_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bitacora_ingest_raw (
  id BIGSERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  policy_incident TEXT NOT NULL,
  device_id TEXT,
  raw_payload JSONB NOT NULL,
  case_id BIGINT NOT NULL REFERENCES bitacora_cases (id) ON DELETE CASCADE
);

CREATE INDEX idx_bitacora_ingest_raw_case_id ON bitacora_ingest_raw (case_id);
CREATE INDEX idx_bitacora_ingest_raw_policy_incident ON bitacora_ingest_raw (policy_incident);
CREATE INDEX idx_bitacora_ingest_raw_received_at ON bitacora_ingest_raw (received_at DESC);

ALTER TABLE bitacora_cases
  ADD CONSTRAINT fk_bitacora_cases_latest_raw FOREIGN KEY (latest_raw_id) REFERENCES bitacora_ingest_raw (id) ON DELETE SET NULL;

COMMIT;
