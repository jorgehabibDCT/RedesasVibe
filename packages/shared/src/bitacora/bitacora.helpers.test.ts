import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { BitacoraDocument } from './types.js';
import {
  collapseInternalSpaces,
  deviceIdsEqual,
  displayColorOrUnspecified,
  isEffectivelyMissingColor,
  normalizeDeviceId,
  trimOrEmpty,
} from './normalize.js';
import { formatInsuredAmountMxn } from './currency.js';
import { formatPolicyDate, parsePolicyDate } from './dates.js';
import {
  formatBitacoraResultStatusLabel,
  hasVinPlatesConflict,
  resolveDeviceIdDisplay,
  resolvePlatesResolution,
  resolveVinResolution,
  trimVehicleMakeModel,
} from './resolve.js';
import { buildContactRows } from './contacts.js';
import { isResultFailure, resultMessageOrFallback } from './resultStatus.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = join(__dirname, '../../../..', 'fixtures');

function loadFixture(name: string): BitacoraDocument {
  const raw = readFileSync(join(fixturesRoot, name), 'utf-8');
  return JSON.parse(raw) as BitacoraDocument;
}

describe('normalize', () => {
  it('trims padded vehicle_make', () => {
    expect(trimOrEmpty('NISSAN                 ')).toBe('NISSAN');
    expect(collapseInternalSpaces('NISSAN                 ')).toBe('NISSAN');
  });

  it('treats N/A color as missing for display', () => {
    expect(isEffectivelyMissingColor('N/A')).toBe(true);
    expect(isEffectivelyMissingColor('  n/a  ')).toBe(true);
    expect(displayColorOrUnspecified('N/A')).toBe('No especificado');
    expect(displayColorOrUnspecified('Azul')).toBe('Azul');
  });

  it('normalizes device_id number vs string to same string', () => {
    expect(normalizeDeviceId(472568141300009)).toBe('472568141300009');
    expect(normalizeDeviceId('472568141300009')).toBe('472568141300009');
    expect(deviceIdsEqual(472568141300009, '472568141300009')).toBe(true);
  });
});

describe('dates & currency', () => {
  it('parses and formats policy dates DD/MM/YYYY', () => {
    const d = parsePolicyDate('10/02/2026');
    expect(d?.getFullYear()).toBe(2026);
    expect(formatPolicyDate('10/02/2026')).toMatch(/2026/);
    expect(formatPolicyDate('bad')).toBe('—');
  });

  it('formats insured amount as MXN', () => {
    expect(formatInsuredAmountMxn(505305)).toContain('505');
    expect(formatInsuredAmountMxn(undefined)).toBe('—');
  });
});

describe('resolve vehicle identity', () => {
  it('canonical: no VIN/plates conflict', () => {
    const doc = loadFixture('bitacora-canonical.json');
    expect(resolveVinResolution(doc).conflict).toBe(false);
    expect(resolvePlatesResolution(doc).conflict).toBe(false);
    expect(hasVinPlatesConflict(doc)).toBe(false);
    expect(resolveDeviceIdDisplay(doc)).toBe('472568141300009');
  });

  it('detects VIN mismatch when registration success', () => {
    const doc = loadFixture('bitacora-vin-mismatch.json');
    expect(resolveVinResolution(doc).conflict).toBe(true);
    expect(resolveVinResolution(doc).display).toBe('3N6CD35A6TK810425');
    expect(hasVinPlatesConflict(doc)).toBe(true);
  });

  it('payload-only: uses payload VIN without conflict', () => {
    const doc = loadFixture('bitacora-payload-only.json');
    expect(resolveVinResolution(doc).conflict).toBe(false);
    expect(resolveVinResolution(doc).display).toBe('3N6CD35A6TK810425');
    expect(isResultFailure(doc)).toBe(false);
  });

  it('trimVehicleMakeModel collapses padded make', () => {
    const doc = loadFixture('bitacora-canonical.json');
    const { make, model } = trimVehicleMakeModel(doc.payload);
    expect(make).toBe('NISSAN');
    expect(model).toContain('NP300');
  });
});

describe('contacts', () => {
  it('dedupes reporter and emergency when same name+phone', () => {
    const doc = loadFixture('bitacora-canonical.json');
    const rows = buildContactRows(doc);
    const merged = rows.find((r) => r.role === 'Reporter / contacto de emergencia');
    expect(merged).toBeDefined();
    expect(merged?.name).toContain('OSIRI');
  });

  it('missing emergency_contact uses reporter (merged row)', () => {
    const doc = loadFixture('bitacora-missing-emergency-contact.json');
    const rows = buildContactRows(doc);
    const merged = rows.find((r) => r.role === 'Reporter / contacto de emergencia');
    expect(merged).toBeDefined();
  });

  it('payload-only still builds reporter + driver', () => {
    const doc = loadFixture('bitacora-payload-only.json');
    const rows = buildContactRows(doc);
    expect(rows.some((r) => r.role.includes('Reporter'))).toBe(true);
    expect(rows.some((r) => r.role === 'Conductor')).toBe(true);
  });
});

describe('formatBitacoraResultStatusLabel', () => {
  it('maps common API status codes to Spanish', () => {
    expect(formatBitacoraResultStatusLabel(undefined)).toBe('—');
    expect(formatBitacoraResultStatusLabel('')).toBe('—');
    expect(formatBitacoraResultStatusLabel('success')).toBe('Exitoso');
    expect(formatBitacoraResultStatusLabel('SUCCESS')).toBe('Exitoso');
    expect(formatBitacoraResultStatusLabel('error')).toBe('Error');
    expect(formatBitacoraResultStatusLabel('pending')).toBe('Pendiente');
  });

  it('passes through unknown status strings', () => {
    expect(formatBitacoraResultStatusLabel('custom_state')).toBe('custom_state');
  });
});

describe('result status', () => {
  it('payload-only: no failure flag from missing result', () => {
    const doc = loadFixture('bitacora-payload-only.json');
    expect(isResultFailure(doc)).toBe(false);
    expect(resultMessageOrFallback(doc)).toBe('—');
  });

  it('marks failure when status is not success', () => {
    const doc = loadFixture('bitacora-canonical.json');
    const failed = {
      ...doc,
      result: { status: 'error', result: { success: false, message: 'x' } },
    } as BitacoraDocument;
    expect(isResultFailure(failed)).toBe(true);
    expect(resultMessageOrFallback(failed)).toBe('x');
  });
});
