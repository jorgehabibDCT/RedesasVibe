import { describe, expect, it, vi } from 'vitest';
import { PegasusAuthCache, hashTokenForCacheKey } from './pegasusAuthCache.js';
import { AuthProblems } from './authProblems.js';

describe('hashTokenForCacheKey', () => {
  it('is deterministic and does not echo the raw token', () => {
    const h = hashTokenForCacheKey('secret-token');
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(h).not.toContain('secret');
  });
});

describe('PegasusAuthCache', () => {
  it('evicts oldest when over max entries', () => {
    const cache = new PegasusAuthCache(2);
    cache.set(
      'a',
      { ok: false, problem: AuthProblems.invalidToken },
      60_000,
    );
    cache.set(
      'b',
      { ok: false, problem: AuthProblems.tokenExpired },
      60_000,
    );
    cache.set(
      'c',
      { ok: true, mode: 'pegasus_http' },
      60_000,
    );
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toEqual({ ok: false, problem: AuthProblems.tokenExpired });
    expect(cache.get('c')).toEqual({ ok: true, mode: 'pegasus_http' });
  });

  it('returns undefined for expired entries', () => {
    vi.useFakeTimers();
    const cache = new PegasusAuthCache(100);
    cache.set('k', { ok: true, mode: 'pegasus_http' }, 1000);
    expect(cache.get('k')).toBeDefined();
    vi.advanceTimersByTime(1001);
    expect(cache.get('k')).toBeUndefined();
    vi.useRealTimers();
  });
});
