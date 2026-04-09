import { describe, expect, it } from 'vitest';
import { parseTheftDatasetContent, validateBitacoraDocumentShape } from './theftDatasetLoader.js';

const minimal = { payload: { policy_incident: '1', policy_number: 'p' } };

describe('validateBitacoraDocumentShape', () => {
  it('accepts minimal valid shape', () => {
    expect(validateBitacoraDocumentShape(minimal).ok).toBe(true);
  });

  it('rejects missing payload', () => {
    const r = validateBitacoraDocumentShape({ foo: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/payload/);
  });

  it('rejects empty policy_incident', () => {
    const r = validateBitacoraDocumentShape({
      payload: { policy_incident: '  ', policy_number: 'p' },
    });
    expect(r.ok).toBe(false);
  });
});

describe('parseTheftDatasetContent', () => {
  it('parses JSON array with mixed valid/invalid elements', () => {
    const r = parseTheftDatasetContent(
      JSON.stringify([
        { payload: { policy_incident: 'A', policy_number: '1' } },
        { payload: {} },
        { payload: { policy_incident: 'B', policy_number: '2' } },
      ]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.format).toBe('json-array');
    expect(r.records).toHaveLength(2);
    expect(r.loadErrors).toHaveLength(1);
    expect(r.totalSourceItems).toBe(3);
  });

  it('parses NDJSON with a bad line', () => {
    const r = parseTheftDatasetContent(
      '{"payload":{"policy_incident":"X","policy_number":"1"}}\nnot json\n{"payload":{"policy_incident":"Y","policy_number":"2"}}',
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.format).toBe('ndjson');
    expect(r.records).toHaveLength(2);
    expect(r.loadErrors.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty file', () => {
    const r = parseTheftDatasetContent('   \n  ');
    expect(r.ok).toBe(false);
    expect(r.fatalError).toMatch(/empty/i);
  });
});
