import type { BitacoraDocument } from './types.js';

/** Spec §11: failure styling when status or success indicates error. */
export function isResultFailure(doc: BitacoraDocument): boolean {
  if (doc.result == null) return false;
  if (doc.result.status !== 'success') return true;
  if (doc.result.result?.success === false) return true;
  return false;
}

export function resultMessageOrFallback(doc: BitacoraDocument): string {
  const m = doc.result?.result?.message?.trim();
  if (m) return m;
  if (isResultFailure(doc)) return 'Error en el registro del incidente';
  return '—';
}
