import { afterEach, describe, expect, it, vi } from 'vitest';
import { logAuthFailure, logRequestComplete } from './log.js';

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
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0][0] as string;
    expect(line).toContain('"event":"auth_failure"');
    expect(line).toContain('"problem":"missing_token"');
    expect(line).not.toMatch(/Bearer/i);
    expect(line).not.toContain('secret');
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
