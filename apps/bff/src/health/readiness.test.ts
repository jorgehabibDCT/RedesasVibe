import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../server.js';
import { computeReadiness } from './readiness.js';

describe('computeReadiness', () => {
  let envBackup: Record<string, string | undefined>;

  beforeEach(() => {
    envBackup = {
      PEGASUS_AUTH_DISABLED: process.env.PEGASUS_AUTH_DISABLED,
      PEGASUS_SITE: process.env.PEGASUS_SITE,
      BITACORA_DATA_MODE: process.env.BITACORA_DATA_MODE,
      BITACORA_UPSTREAM_BASE_URL: process.env.BITACORA_UPSTREAM_BASE_URL,
      FIXTURE_PATH: process.env.FIXTURE_PATH,
      DATABASE_URL: process.env.DATABASE_URL,
    };
  });

  afterEach(() => {
    for (const k of Object.keys(envBackup) as (keyof typeof envBackup)[]) {
      const v = envBackup[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('is ready for default local fixture + Pegasus bypass', () => {
    process.env.PEGASUS_AUTH_DISABLED = 'true';
    delete process.env.BITACORA_DATA_MODE;
    delete process.env.FIXTURE_PATH;

    const r = computeReadiness();
    expect(r.status).toBe('ready');
    expect(r.checks.process.status).toBe('ok');
    expect(r.checks.pegasusAuth).toMatchObject({ status: 'ok', mode: 'bypass' });
    expect(r.checks.bitacoraData).toMatchObject({ status: 'ok', mode: 'fixture' });
  });

  it('is not ready when Pegasus HTTP is required but site is unset', () => {
    process.env.PEGASUS_AUTH_DISABLED = 'false';
    delete process.env.PEGASUS_SITE;

    const r = computeReadiness();
    expect(r.status).toBe('not_ready');
    expect(r.checks.pegasusAuth).toMatchObject({
      status: 'error',
      mode: 'pegasus_http',
      reason: 'pegasus_site_unset',
    });
  });

  it('is not ready in integration mode without upstream base URL', () => {
    process.env.PEGASUS_AUTH_DISABLED = 'true';
    process.env.BITACORA_DATA_MODE = 'integration';
    delete process.env.BITACORA_UPSTREAM_BASE_URL;

    const r = computeReadiness();
    expect(r.status).toBe('not_ready');
    expect(r.checks.bitacoraData).toMatchObject({
      status: 'error',
      mode: 'integration',
      reason: 'upstream_base_url_unset',
    });
  });

  it('is ready in db mode when DATABASE_URL is set', () => {
    process.env.PEGASUS_AUTH_DISABLED = 'true';
    process.env.BITACORA_DATA_MODE = 'db';
    process.env.DATABASE_URL = 'postgres://localhost/test';

    const r = computeReadiness();
    expect(r.status).toBe('ready');
    expect(r.checks.bitacoraData).toMatchObject({ status: 'ok', mode: 'db' });
  });

  it('is not ready in db mode without DATABASE_URL', () => {
    process.env.PEGASUS_AUTH_DISABLED = 'true';
    process.env.BITACORA_DATA_MODE = 'db';
    delete process.env.DATABASE_URL;

    const r = computeReadiness();
    expect(r.status).toBe('not_ready');
    expect(r.checks.bitacoraData).toMatchObject({
      status: 'error',
      mode: 'db',
      reason: 'database_url_unset',
    });
  });

  it('is not ready when fixture file is unreadable', () => {
    process.env.PEGASUS_AUTH_DISABLED = 'true';
    process.env.FIXTURE_PATH = '/nonexistent/path/bitacora-canonical.json';

    const r = computeReadiness();
    expect(r.status).toBe('not_ready');
    expect(r.checks.bitacoraData).toMatchObject({
      status: 'error',
      mode: 'fixture',
      reason: 'fixture_unreadable',
    });
  });
});

describe('GET /ready', () => {
  let envBackup: Record<string, string | undefined>;
  const app = createServer();

  beforeEach(() => {
    envBackup = {
      PEGASUS_AUTH_DISABLED: process.env.PEGASUS_AUTH_DISABLED,
      PEGASUS_SITE: process.env.PEGASUS_SITE,
      BITACORA_DATA_MODE: process.env.BITACORA_DATA_MODE,
      BITACORA_UPSTREAM_BASE_URL: process.env.BITACORA_UPSTREAM_BASE_URL,
      FIXTURE_PATH: process.env.FIXTURE_PATH,
    };
  });

  afterEach(() => {
    for (const k of Object.keys(envBackup) as (keyof typeof envBackup)[]) {
      const v = envBackup[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('returns 200 when configuration is ready', async () => {
    process.env.PEGASUS_AUTH_DISABLED = 'true';
    delete process.env.BITACORA_DATA_MODE;
    delete process.env.FIXTURE_PATH;

    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.service).toBe('redesas-lite-bff');
  });

  it('returns 503 when not ready', async () => {
    process.env.PEGASUS_AUTH_DISABLED = 'false';
    delete process.env.PEGASUS_SITE;

    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('not_ready');
    expect(res.body.checks.pegasusAuth.reason).toBe('pegasus_site_unset');
  });
});

