import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProblems } from './authProblems.js';
import { resetPegasusAuthCacheForTests } from './pegasusAuthCache.js';
import {
  pegasusResultFromHttpStatus,
  validatePegasusSession,
} from './pegasusAuth.service.js';

describe('pegasusResultFromHttpStatus', () => {
  it('maps 2xx to success', () => {
    expect(pegasusResultFromHttpStatus(200)).toEqual({ ok: true, mode: 'pegasus_http' });
    expect(pegasusResultFromHttpStatus(204)).toEqual({ ok: true, mode: 'pegasus_http' });
  });

  it('maps 401 to token_expired', () => {
    expect(pegasusResultFromHttpStatus(401)).toEqual({
      ok: false,
      problem: AuthProblems.tokenExpired,
      mode: 'pegasus_http',
      reason: 'pegasus_http_401',
    });
  });

  it('maps 403 to invalid_token', () => {
    expect(pegasusResultFromHttpStatus(403)).toEqual({
      ok: false,
      problem: AuthProblems.invalidToken,
      mode: 'pegasus_http',
      reason: 'pegasus_http_403',
    });
  });

  it('maps other 4xx to invalid_token', () => {
    expect(pegasusResultFromHttpStatus(404)).toEqual({
      ok: false,
      problem: AuthProblems.invalidToken,
      mode: 'pegasus_http',
      reason: 'pegasus_http_4xx',
    });
  });

  it('maps 5xx to auth_unavailable', () => {
    expect(pegasusResultFromHttpStatus(503)).toEqual({
      ok: false,
      problem: AuthProblems.authUnavailable,
      mode: 'pegasus_http',
      reason: 'pegasus_http_5xx',
    });
  });
});

describe('validatePegasusSession + cache', () => {
  const original = { ...process.env };

  beforeEach(() => {
    vi.unstubAllEnvs();
    resetPegasusAuthCacheForTests();
    process.env.PEGASUS_AUTH_DISABLED = 'false';
    process.env.PEGASUS_SITE = 'http://pegasus.test';
    process.env.PEGASUS_AUTH_CACHE_ENABLED = 'true';
    process.env.PEGASUS_AUTH_CACHE_TTL_MS = '300000';
    process.env.PEGASUS_AUTH_CACHE_NEGATIVE_TTL_MS = '60000';
    process.env.PEGASUS_AUTH_CACHE_UNAVAILABLE_TTL_MS = '5000';
    process.env.PEGASUS_FETCH_TIMEOUT_MS = '5000';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetPegasusAuthCacheForTests();
    Object.assign(process.env, original);
  });

  it('returns bypass when PEGASUS_AUTH_DISABLED=true without calling fetch', async () => {
    process.env.PEGASUS_AUTH_DISABLED = 'true';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await validatePegasusSession('token-a');
    expect(r).toEqual({ ok: true, mode: 'bypass' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed with explicit reason when PEGASUS_SITE is missing', async () => {
    delete process.env.PEGASUS_SITE;
    const r = await validatePegasusSession('tok');
    expect(r).toEqual({
      ok: false,
      problem: AuthProblems.authUnavailable,
      mode: 'pegasus_http',
      reason: 'pegasus_site_unset',
    });
  });

  it('caches success: second call does not invoke fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      clone() {
        return this;
      },
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    await validatePegasusSession('same-token');
    await validatePegasusSession('same-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('different tokens invoke fetch separately', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      clone() {
        return this;
      },
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    await validatePegasusSession('token-one');
    await validatePegasusSession('token-two');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('Pegasus network failure returns auth_unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const r = await validatePegasusSession('tok');
    expect(r).toEqual({
      ok: false,
      problem: AuthProblems.authUnavailable,
      mode: 'pegasus_http',
      reason: 'pegasus_network_error',
    });
  });

  it('skips cache when PEGASUS_AUTH_CACHE_ENABLED=false', async () => {
    process.env.PEGASUS_AUTH_CACHE_ENABLED = 'false';
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      clone() {
        return this;
      },
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    await validatePegasusSession('same');
    await validatePegasusSession('same');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('extracts user id from /api/login response headers when JSON has no identity fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: new Headers({ 'x-peg-user-id': 'user-from-header' }),
        clone() {
          return this;
        },
        json: async () => ({}),
      }),
    );

    const r = await validatePegasusSession('tok-hdr');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.principal?.userId).toBe('user-from-header');
      expect(r.principalExtraction?.hasUserId).toBe(true);
      expect(r.principalExtraction?.pathsMatched).toContain('response.header.x-peg-user-id');
    }
  });

  it('prefers JSON body user id over duplicate header', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: new Headers({ 'x-peg-user-id': 'from-header' }),
        clone() {
          return this;
        },
        json: async () => ({ user_id: 'from-body' }),
      }),
    );

    const r = await validatePegasusSession('tok-pref');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.principal?.userId).toBe('from-body');
      expect(r.principalExtraction?.pathsMatched).toContain('root.user_id');
      expect(r.principalExtraction?.pathsMatched).not.toContain('response.header.x-peg-user-id');
    }
  });

  it('extracts principal metadata from /api/login JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        clone() {
          return this;
        },
        json: async () => ({
          user_id: 'u-99',
          group_ids: ['g1', 'g2'],
        }),
      }),
    );

    const r = await validatePegasusSession('tok-meta');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.principal?.userId).toBe('u-99');
      expect(r.principal?.groupIds).toEqual(['g1', 'g2']);
      expect(r.principalExtraction?.hasUserId).toBe(true);
      expect(r.principalExtraction?.groupCount).toBe(2);
      expect(r.principalExtraction?.pathsMatched).toContain('root.user_id');
      expect(r.principalExtraction?.pathsMatched).toContain('root.group_ids');
    }
  });
});
