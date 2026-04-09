import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from './server.js';

describe('createServer CORS', () => {
  const saved = process.env.CORS_ORIGINS;

  afterEach(() => {
    if (saved === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = saved;
  });

  it('returns 403 cors_forbidden for disallowed Origin on /health', async () => {
    process.env.CORS_ORIGINS = 'http://localhost:5173';
    const app = createServer();

    const res = await request(app).get('/health').set('Origin', 'https://evil.example.com');

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'cors_forbidden' });
  });

  it('returns 403 cors_forbidden for disallowed Origin on /ready', async () => {
    process.env.CORS_ORIGINS = 'http://localhost:5173';
    const app = createServer();

    const res = await request(app).get('/ready').set('Origin', 'https://evil.example.com');

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'cors_forbidden' });
  });
});
