import type { BitacoraDocument, BitacoraPayload } from './types.js';
import { collapseInternalSpaces, normalizeDeviceId, trimOrEmpty } from './normalize.js';

export interface FieldResolution {
  display: string;
  /** True when payload vs registration disagree after normalization and registration success applies preference rules. */
  conflict: boolean;
}

function normVin(v: string | undefined): string {
  return trimOrEmpty(v).toUpperCase();
}

function normPlates(p: string | undefined): string {
  return trimOrEmpty(p).toUpperCase();
}

export function isRegistrationSuccess(doc: BitacoraDocument): boolean {
  return doc.result?.result?.success === true && doc.result?.result?.data != null;
}

/** Prefer result.result.data when success; else payload-only values. */
export function resolveVinResolution(doc: BitacoraDocument): FieldResolution {
  const payloadVin = normVin(doc.payload.vehicle_vin);
  const data = doc.result?.result?.data;
  const regVin = data?.vin != null ? normVin(data.vin) : '';

  if (!isRegistrationSuccess(doc) || !data) {
    return { display: payloadVin || '—', conflict: false };
  }

  if (!payloadVin) {
    return { display: regVin || '—', conflict: false };
  }

  const conflict = payloadVin !== regVin;
  const display = regVin || payloadVin;
  return { display: display || '—', conflict };
}

export function resolvePlatesResolution(doc: BitacoraDocument): FieldResolution {
  const payloadPlates = normPlates(doc.payload.vehicle_plates);
  const data = doc.result?.result?.data;
  const regPlates = data?.plates != null ? normPlates(data.plates) : '';

  if (!isRegistrationSuccess(doc) || !data) {
    return { display: payloadPlates || '—', conflict: false };
  }

  if (!payloadPlates) {
    return { display: regPlates || '—', conflict: false };
  }

  const conflict = payloadPlates !== regPlates;
  const display = regPlates || payloadPlates;
  return { display: display || '—', conflict };
}

export function resolveDeviceIdDisplay(doc: BitacoraDocument): string {
  const data = doc.result?.result?.data;
  if (isRegistrationSuccess(doc) && data?.device_id != null) {
    return normalizeDeviceId(data.device_id) || '—';
  }
  return normalizeDeviceId(doc.payload.device_id) || '—';
}

export function hasVinPlatesConflict(doc: BitacoraDocument): boolean {
  return resolveVinResolution(doc).conflict || resolvePlatesResolution(doc).conflict;
}

export function trimVehicleMakeModel(payload: BitacoraPayload): { make: string; model: string } {
  return {
    make: collapseInternalSpaces(payload.vehicle_make),
    model: collapseInternalSpaces(payload.vehicle_model),
  };
}

export type RegistrationStatusKey = string;

export function mapRegistrationStatusLabel(status: string | undefined): string {
  const s = trimOrEmpty(status);
  if (!s) return '—';
  if (s.toLowerCase() === 'registered') return 'Registrado';
  return s;
}

/**
 * Maps API `result.status` codes to short Spanish labels (avoids raw English like `success` in the UI).
 */
export function formatBitacoraResultStatusLabel(status: string | undefined): string {
  const s = trimOrEmpty(status);
  if (!s) return '—';
  const k = s.toLowerCase();
  if (k === 'success') return 'Exitoso';
  if (k === 'error') return 'Error';
  if (k === 'failed' || k === 'failure') return 'Fallido';
  if (k === 'pending') return 'Pendiente';
  if (k === 'cancelled' || k === 'canceled') return 'Cancelado';
  return s;
}

export function mapEnvLabel(env: string | undefined): string {
  const e = trimOrEmpty(env).toLowerCase();
  if (e === 'production') return 'Producción';
  return env ? env.toUpperCase() : '';
}
