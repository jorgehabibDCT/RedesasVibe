import request from 'supertest';
import { describe, expect, it, beforeEach } from 'vitest';
import { createServer } from '../server.js';

process.env.PEGASUS_AUTH_DISABLED = 'true';

describe('requireAuth + /api/v1/bitacora', () => {
  const app = createServer();

  beforeEach(() => {
    process.env.PEGASUS_AUTH_DISABLED = 'true';
  });

  it('returns 401 missing_token without Authorization', async () => {
    const res = await request(app).get('/api/v1/bitacora');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ problem: 'missing_token' });
    expect(typeof res.body.message).toBe('string');
  });

  it('returns 401 malformed_auth_header for Basic scheme', async () => {
    const res = await request(app).get('/api/v1/bitacora').set('Authorization', 'Basic x');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ problem: 'malformed_auth_header' });
  });

  it('returns fixture JSON with valid Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/bitacora')
      .set('Authorization', 'Bearer dev-opaque-token');
    expect(res.status).toBe(200);
    expect(res.body.payload.policy_incident).toBe('0501227');
  });

  it('health is unauthenticated', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
