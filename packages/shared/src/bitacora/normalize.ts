const FALLBACK_DASH = '—';

/** Trim; treat null/undefined as empty (display fallback handled by caller). */
export function trimOrEmpty(value: string | null | undefined): string {
  if (value == null) return '';
  return value.trim();
}

/**
 * Collapse repeated internal whitespace after trim (spec §10: optional for make/model).
 */
export function collapseInternalSpaces(value: string): string {
  return trimOrEmpty(value).replace(/\s+/g, ' ');
}

/** Spec §10–11: N/A or empty color → missing. */
export function isEffectivelyMissingColor(value: string | null | undefined): boolean {
  const t = trimOrEmpty(value).toUpperCase();
  return t === '' || t === 'N/A';
}

export function displayColorOrUnspecified(value: string | null | undefined): string {
  return isEffectivelyMissingColor(value) ? 'No especificado' : collapseInternalSpaces(value ?? '');
}

/**
 * Normalize device_id across number (payload) vs string (registration data).
 * Uses String() for safe integers; for larger IDs still string-coerces.
 */
export function normalizeDeviceId(value: string | number | null | undefined): string {
  if (value == null) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return String(value);
  }
  return trimOrEmpty(value);
}

export function deviceIdsEqual(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): boolean {
  if (a == null || b == null) return false;
  return normalizeDeviceId(a) === normalizeDeviceId(b);
}

/** Digits only — for phone comparison (spec §10). */
export function digitsOnly(value: string | null | undefined): string {
  if (value == null) return '';
  return value.replace(/\D/g, '');
}

export function displayScalar(value: string | null | undefined): string {
  const t = trimOrEmpty(value);
  return t === '' ? FALLBACK_DASH : t;
}

export { FALLBACK_DASH };
