import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchPegasusUserResourcesProfile,
  isPegasusUserResourcesFetchEnabled,
  parsePegasusUserResourcesBody,
} from './pegasusUserResources.js';

describe('parsePegasusUserResourcesBody', () => {
  it('reads root snake_case and camelCase booleans', () => {
    expect(parsePegasusUserResourcesBody({ id: 7, is_staff: true, is_superuser: false })).toEqual({
      id: '7',
      isStaff: true,
      isSuperuser: false,
    });
    expect(parsePegasusUserResourcesBody({ isStaff: false, isSuperuser: true })).toEqual({
      isStaff: false,
      isSuperuser: true,
    });
  });

  it('reads nested user and optional username/email', () => {
    expect(
      parsePegasusUserResourcesBody({
        user: { id: 'a', username: 'bob', email: 'bob@example.com', is_staff: true },
      }),
    ).toEqual({
      id: 'a',
      username: 'bob',
      email: 'bob@example.com',
      isStaff: true,
      isSuperuser: false,
    });
  });

  it('returns undefined for non-object JSON', () => {
    expect(parsePegasusUserResourcesBody(null)).toBeUndefined();
    expect(parsePegasusUserResourcesBody('x')).toBeUndefined();
  });
});

describe('fetchPegasusUserResourcesProfile', () => {
  const original = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    Object.assign(process.env, original);
  });

  it('returns undefined when disabled', async () => {
    process.env.PEGASUS_USER_RESOURCES_DISABLED = 'true';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await fetchPegasusUserResourcesProfile('https://p.test', 'tok', 5000);
    expect(r).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isPegasusUserResourcesFetchEnabled()).toBe(false);
  });

  it('GETs configured path with Bearer and parses body', async () => {
    delete process.env.PEGASUS_USER_RESOURCES_DISABLED;
    process.env.PEGASUS_USER_RESOURCES_PATH = 'user/resources';
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ is_superuser: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const r = await fetchPegasusUserResourcesProfile('https://p.test', 'secret-token', 5000);

    expect(r).toEqual({ isStaff: false, isSuperuser: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://p.test/user/resources');
    expect(init.method).toBe('GET');
    const h = init.headers as Record<string, string>;
    expect(h.Authorization).toBe('Bearer secret-token');
    expect(h.Accept).toBe('application/json');
  });

  it('returns undefined on non-2xx without throwing', async () => {
    delete process.env.PEGASUS_USER_RESOURCES_DISABLED;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 503, ok: false, json: async () => ({}) }),
    );
    const r = await fetchPegasusUserResourcesProfile('https://p.test', 't', 5000);
    expect(r).toBeUndefined();
  });
});
