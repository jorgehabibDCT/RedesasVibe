import request from 'supertest';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { securityHeadersMiddleware } from './securityHeaders.js';

describe('securityHeadersMiddleware', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sets baseline security headers', async () => {
    const app = express();
    app.use(securityHeadersMiddleware());
    app.get('/t', (_req, res) => res.send('ok'));

    const res = await request(app).get('/t');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['permissions-policy']).toBeDefined();
  });

  it('sets CSP frame-ancestors when FRAME_ANCESTORS is set', async () => {
    vi.stubEnv('FRAME_ANCESTORS', 'https://parent.example.com');
    const app = express();
    app.use(securityHeadersMiddleware());
    app.get('/t', (_req, res) => res.send('ok'));

    const res = await request(app).get('/t');
    expect(res.headers['content-security-policy']).toBe(
      'frame-ancestors https://parent.example.com',
    );
  });

  it('sets HSTS only when enabled with numeric max-age', async () => {
    vi.stubEnv('ENABLE_HSTS_HEADER', 'true');
    vi.stubEnv('HSTS_MAX_AGE', '31536000');
    const app = express();
    app.use(securityHeadersMiddleware());
    app.get('/t', (_req, res) => res.send('ok'));

    const res = await request(app).get('/t');
    expect(res.headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
  });
});
