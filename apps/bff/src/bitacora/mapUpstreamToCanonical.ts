import type { BitacoraDocument, BitacoraPayload, RegistrationData, ResultInner, ResultWrapper } from '@redesas-lite/shared';
import type { UpstreamBitacoraRaw } from '../upstream/upstreamRaw.types.js';
import { UpstreamNormalizeError } from '../upstream/upstreamErrors.js';

function str(v: unknown, fallback = ''): string {
  if (v == null) return fallback;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return fallback;
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function payloadDeviceId(v: unknown): number | string {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') return v.trim();
  return 0;
}

/**
 * Maps an upstream-specific JSON object into the **canonical** `BitacoraDocument` (spec.md v0.3).
 * All business normalization stays server-side — the frontend contract is unchanged.
 */
export function mapUpstreamToCanonical(raw: unknown): BitacoraDocument {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new UpstreamNormalizeError('Upstream payload must be a JSON object');
  }

  const u = raw as UpstreamBitacoraRaw;
  const vehicle = u.vehicle ?? {};
  const policy = u.policy ?? {};
  const reg = u.registrationOutcome;

  const payload: BitacoraPayload = {
    device_id: payloadDeviceId(vehicle.deviceId),
    vehicle_vin: str(vehicle.vin),
    vehicle_year: num(vehicle.year),
    vehicle_plates: str(vehicle.licensePlate),
    vehicle_make: str(vehicle.make),
    vehicle_model: str(vehicle.model),
    vehicle_color: str(vehicle.color),
    insured_name: str(policy.insuredName),
    incident_type: str(policy.incidentType),
    reporter_name: str(policy.reporterName),
    reporter_phone: str(policy.reporterPhone),
    driver_name: str(policy.driverName),
    policy_number: str(policy.policyNumber),
    policy_incident: str(policy.incidentId),
    policy_start_date: str(policy.validFrom),
    policy_end_date: str(policy.validTo),
    insured_amount: num(policy.insuredAmount),
    agent_code: str(policy.agentCode),
  };

  const env = str(u.meta?.environment, 'production');

  const doc: BitacoraDocument = {
    payload,
    env,
  };

  if (!reg) {
    return doc;
  }

  const data: RegistrationData = {
    device_id: str(reg.deviceId),
    vin: str(reg.vin),
    plates: str(reg.plates),
    status: str(reg.vehicleStatus),
  };

  if (reg.emergencyContact === null) {
    data.emergency_contact = null;
  } else if (reg.emergencyContact && typeof reg.emergencyContact === 'object') {
    data.emergency_contact = {
      name: str(reg.emergencyContact.fullName),
      phone: str(reg.emergencyContact.phone),
    };
  }

  const inner: ResultInner = {
    success: typeof reg.success === 'boolean' ? reg.success : undefined,
    message: str(reg.message),
    data,
  };

  const wrapper: ResultWrapper = {
    status: str(reg.overallStatus, 'unknown'),
    result: inner,
  };

  doc.result = wrapper;
  return doc;
}
