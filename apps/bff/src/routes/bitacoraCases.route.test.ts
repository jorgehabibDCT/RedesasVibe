import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../server.js';

describe('GET /api/v1/bitacora/cases', () => {
  const envBackup: Record<string, string | undefined> = {};

  beforeEach(() => {
    envBackup.PEGASUS_AUTH_DISABLED = process.env.PEGASUS_AUTH_DISABLED;
    envBackup.BITACORA_DATA_MODE = process.env.BITACORA_DATA_MODE;
    process.env.PEGASUS_AUTH_DISABLED = 'true';
  });

  afterEach(() => {
    for (const k of Object.keys(envBackup) as (keyof typeof envBackup)[]) {
      const v = envBackup[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('returns empty cases when not in db mode (fixture default)', async () => {
    delete process.env.BITACORA_DATA_MODE;
    const app = createServer();
    const res = await request(app)
      .get('/api/v1/bitacora/cases')
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ cases: [] });
  });
});
