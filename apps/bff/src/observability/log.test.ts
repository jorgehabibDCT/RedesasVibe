import { afterEach, describe, expect, it, vi } from 'vitest';
import { logAuthFailure, logAuthSuccess, logRequestComplete } from './log.js';

describe('structured logging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logAuthFailure emits JSON without bearer tokens', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logAuthFailure({
      requestId: 'rid-1',
      path: '/api/v1/bitacora',
      problem: 'missing_token',
      authMode: 'pegasus_http',
      reason: 'authorization_header_missing_or_invalid',
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0][0] as string;
    expect(line).toContain('"event":"auth_failure"');
    expect(line).toContain('"problem":"missing_token"');
    expect(line).toContain('"authMode":"pegasus_http"');
    expect(line).toContain('"reason":"authorization_header_missing_or_invalid"');
    expect(line).not.toMatch(/Bearer/i);
    expect(line).not.toContain('secret');
  });

  it('logAuthSuccess emits concise JSON', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logAuthSuccess({
      requestId: 'rid-2',
      path: '/api/v1/bitacora',
      authMode: 'pegasus_http',
    });
    const line = spy.mock.calls[0][0] as string;
    expect(line).toContain('"event":"auth_success"');
    expect(line).toContain('"authMode":"pegasus_http"');
    expect(line).not.toMatch(/Bearer/i);
  });

  it('logRequestComplete never includes Authorization', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logRequestComplete({
      requestId: 'r2',
      method: 'GET',
      path: '/api/v1/bitacora',
      statusCode: 200,
      durationMs: 3,
    });
    const line = spy.mock.calls[0][0] as string;
    expect(line).toContain('"event":"request_complete"');
    expect(line).not.toMatch(/Bearer/i);
  });
});
