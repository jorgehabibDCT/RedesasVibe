import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetPegasusAuthCacheForTests } from '../auth/pegasusAuthCache.js';
import { createServer } from '../server.js';

describe('GET /api/v1/bitacora/operator-meta', () => {
  const originalEnv = { ...process.env };
  const app = createServer();

  beforeEach(() => {
    resetPegasusAuthCacheForTests();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    process.env.BITACORA_DATA_MODE = 'fixture';
    process.env.PEGASUS_AUTH_DISABLED = 'false';
    process.env.PEGASUS_SITE = 'https://pegasus.example.com';
    delete process.env.PEGASUS_OPERATOR_USER_IDS;
    delete process.env.PEGASUS_OPERATOR_GROUP_IDS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('returns 404 when user is not in operator lists', async () => {
    process.env.PEGASUS_OPERATOR_USER_IDS = 'only-other';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: new Headers(),
        clone() {
          return this;
        },
        json: async () => ({ user_id: 'u-normal' }),
      }),
    );

    const res = await request(app)
      .get('/api/v1/bitacora/operator-meta')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(404);
  });

  it('returns 200 with modes when user is an operator', async () => {
    process.env.PEGASUS_OPERATOR_USER_IDS = 'u-op';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: new Headers(),
        clone() {
          return this;
        },
        json: async () => ({ user_id: 'u-op' }),
      }),
    );

    const res = await request(app)
      .get('/api/v1/bitacora/operator-meta')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      bitacoraDataMode: 'fixture',
      pegasusAuthMode: 'pegasus_http',
    });
    expect(res.body.caseId).toBeNull();
  });
});
