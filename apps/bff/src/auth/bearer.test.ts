import { describe, expect, it } from 'vitest';
import { extractBearerToken, validateOpaqueTokenShape } from './bearer.js';

describe('extractBearerToken', () => {
  it('extracts bearer token', () => {
    const r = extractBearerToken('Bearer opaque-token-123');
    expect(r).toEqual({ ok: true, token: 'opaque-token-123' });
  });

  it('returns missing_token when header absent', () => {
    const r = extractBearerToken(undefined);
    expect(r).toEqual({ ok: false, problem: 'missing_token' });
  });

  it('returns malformed for non-Bearer scheme', () => {
    const r = extractBearerToken('Basic xyz');
    expect(r).toEqual({ ok: false, problem: 'malformed_auth_header' });
  });

  it('returns malformed for Bearer without token', () => {
    const r = extractBearerToken('Bearer');
    expect(r).toEqual({ ok: false, problem: 'malformed_auth_header' });
  });
});

describe('validateOpaqueTokenShape', () => {
  it('rejects newlines in token', () => {
    const r = validateOpaqueTokenShape('a\nb');
    expect(r).toEqual({ ok: false, problem: 'invalid_token' });
  });
});
