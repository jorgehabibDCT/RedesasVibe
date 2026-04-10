import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAppAuthorizationConfig } from '../config/authzConfig.js';
import { createServer } from '../server.js';

describe('requireAuthorizationMiddleware', () => {
  const originalEnv = { ...process.env };
  const app = createServer();

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    process.env.BITACORA_DATA_MODE = 'fixture';
    process.env.PEGASUS_AUTH_DISABLED = 'false';
    process.env.PEGASUS_SITE = 'https://pegasus.example.com';
    delete process.env.PEGASUS_ALLOWED_USER_IDS;
    delete process.env.PEGASUS_ALLOWED_GROUP_IDS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('allows authenticated user when no app-level allowlist is configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        clone() {
          return this;
        },
        json: async () => ({ user: { id: 'u-1', groups: [{ id: 'g-1' }] } }),
      }),
    );

    const res = await request(app).get('/api/v1/bitacora').set('Authorization', 'Bearer tok-no-allowlist');
    expect(res.status).toBe(200);
  });

  it('returns 403 for authenticated but unauthorized user', async () => {
    process.env.PEGASUS_ALLOWED_USER_IDS = 'u-allowed';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        clone() {
          return this;
        },
        json: async () => ({ user: { id: 'u-denied', groups: [{ id: 'g-2' }] } }),
      }),
    );

    const res = await request(app).get('/api/v1/bitacora').set('Authorization', 'Bearer tok-denied');
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'forbidden', problem: 'app_access_denied' });
  });

  it('allows user by user-id allowlist', async () => {
    process.env.PEGASUS_ALLOWED_USER_IDS = 'u-x,u-y';
    expect(getAppAuthorizationConfig().allowedUserIds.has('u-x')).toBe(true);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        clone() {
          return this;
        },
        json: async () => ({ user_id: 'u-x', group_ids: ['g-admin'] }),
      }),
    );

    const res = await request(app).get('/api/v1/bitacora').set('Authorization', 'Bearer tok-allowed');
    expect(res.status).toBe(200);
  });
});
