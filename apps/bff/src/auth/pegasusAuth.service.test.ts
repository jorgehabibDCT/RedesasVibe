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
    });
  });

  it('maps 403 to invalid_token', () => {
    expect(pegasusResultFromHttpStatus(403)).toEqual({
      ok: false,
      problem: AuthProblems.invalidToken,
    });
  });

  it('maps other 4xx to invalid_token', () => {
    expect(pegasusResultFromHttpStatus(404)).toEqual({
      ok: false,
      problem: AuthProblems.invalidToken,
    });
  });

  it('maps 5xx to auth_unavailable', () => {
    expect(pegasusResultFromHttpStatus(503)).toEqual({
      ok: false,
      problem: AuthProblems.authUnavailable,
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

  it('caches success: second call does not invoke fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await validatePegasusSession('same-token');
    await validatePegasusSession('same-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('different tokens invoke fetch separately', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await validatePegasusSession('token-one');
    await validatePegasusSession('token-two');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('Pegasus network failure returns auth_unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const r = await validatePegasusSession('tok');
    expect(r).toEqual({ ok: false, problem: AuthProblems.authUnavailable });
  });

  it('skips cache when PEGASUS_AUTH_CACHE_ENABLED=false', async () => {
    process.env.PEGASUS_AUTH_CACHE_ENABLED = 'false';
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await validatePegasusSession('same');
    await validatePegasusSession('same');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
