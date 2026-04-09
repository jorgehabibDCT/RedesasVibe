/**
 * Grounded in spec.md v0.3 — no extra fields.
 */
export interface EmergencyContact {
  name: string;
  phone: string;
}

export interface RegistrationData {
  device_id: string;
  vin: string;
  plates: string;
  status: string;
  emergency_contact?: EmergencyContact | null;
}

export interface ResultInner {
  success?: boolean;
  message?: string;
  data?: RegistrationData | null;
}

export interface ResultWrapper {
  status: string;
  result?: ResultInner;
}

export interface BitacoraPayload {
  device_id: number | string;
  vehicle_vin: string;
  vehicle_year: number;
  vehicle_plates: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_color: string;
  insured_name: string;
  incident_type: string;
  reporter_name: string;
  reporter_phone: string;
  driver_name: string;
  policy_number: string;
  policy_incident: string;
  policy_start_date: string;
  policy_end_date: string;
  insured_amount: number;
  agent_code: string;
}

/** Composite document returned by BFF — result may be absent (payload-only). */
export interface BitacoraDocument {
  payload: BitacoraPayload;
  result?: ResultWrapper;
  env?: string;
}
