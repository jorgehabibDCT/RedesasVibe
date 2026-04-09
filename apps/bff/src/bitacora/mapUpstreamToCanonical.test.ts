import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mapUpstreamToCanonical } from './mapUpstreamToCanonical.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, '../../../../fixtures');

describe('mapUpstreamToCanonical', () => {
  it('maps upstream-raw-sample.json to the same shape as bitacora-canonical.json', () => {
    const raw = JSON.parse(readFileSync(join(fixtures, 'upstream-raw-sample.json'), 'utf-8'));
    const expected = JSON.parse(readFileSync(join(fixtures, 'bitacora-canonical.json'), 'utf-8'));
    const out = mapUpstreamToCanonical(raw);
    expect(out).toEqual(expected);
  });

  it('throws on non-object upstream payload', () => {
    expect(() => mapUpstreamToCanonical(null)).toThrow();
    expect(() => mapUpstreamToCanonical([])).toThrow();
    expect(() => mapUpstreamToCanonical('x')).toThrow();
  });

  it('fills missing optional sections with safe defaults (payload-only style)', () => {
    const raw = JSON.parse(readFileSync(join(fixtures, 'upstream-raw-partial.json'), 'utf-8'));
    const out = mapUpstreamToCanonical(raw);
    expect(out.payload.device_id).toBe(99);
    expect(out.payload.vehicle_vin).toBe('');
    expect(out.result).toBeUndefined();
    expect(out.env).toBe('production');
  });
});
