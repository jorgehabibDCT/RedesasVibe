import type { BitacoraDocument } from '@redesas-lite/shared';
import { normalizeBitacoraDocumentToCaseRow } from '@redesas-lite/shared';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from '../server.js';

process.env.PEGASUS_AUTH_DISABLED = 'true';

const sample: BitacoraDocument = {
  payload: {
    device_id: 1,
    vehicle_vin: 'V',
    vehicle_year: 2026,
    vehicle_plates: 'P',
    vehicle_make: 'M',
    vehicle_model: 'M',
    vehicle_color: 'N/A',
    insured_name: 'I',
    incident_type: 'Otro',
    reporter_name: 'R',
    reporter_phone: '1',
    driver_name: 'D',
    policy_number: 'PN',
    policy_incident: 'INGEST-1',
    policy_start_date: '01/01/2026',
    policy_end_date: '01/01/2027',
    insured_amount: 100,
    agent_code: 'A',
  },
};

describe('POST /api/v1/bitacora/ingest', () => {
  const originalIngestSecret = process.env.BITACORA_INGEST_SECRET;
  const originalMachineToken = process.env.BITACORA_MACHINE_INGEST_TOKEN;

  afterEach(() => {
    if (originalIngestSecret === undefined) {
      delete process.env.BITACORA_INGEST_SECRET;
    } else {
      process.env.BITACORA_INGEST_SECRET = originalIngestSecret;
    }
    if (originalMachineToken === undefined) {
      delete process.env.BITACORA_MACHINE_INGEST_TOKEN;
    } else {
      process.env.BITACORA_MACHINE_INGEST_TOKEN = originalMachineToken;
    }
  });

  it('returns 503 when ingest service not configured', async () => {
    const app = createServer({ bitacoraIngestService: null });
    const res = await request(app)
      .post('/api/v1/bitacora/ingest')
      .set('Authorization', 'Bearer t')
      .send(sample);
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('ingest_unavailable');
  });

  it('returns 201 when ingest succeeds', async () => {
    const ingest = {
      ingestCanonicalDocument: vi.fn().mockResolvedValue({ caseId: '10', rawId: '20' }),
    };
    const app = createServer({ bitacoraIngestService: ingest });
    const res = await request(app)
      .post('/api/v1/bitacora/ingest')
      .set('Authorization', 'Bearer t')
      .send(sample);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ok: true, caseId: '10', rawId: '20' });
    expect(ingest.ingestCanonicalDocument).toHaveBeenCalledOnce();
  });

  it('returns 400 for invalid body', async () => {
    const ingest = { ingestCanonicalDocument: vi.fn() };
    const app = createServer({ bitacoraIngestService: ingest });
    const res = await request(app)
      .post('/api/v1/bitacora/ingest')
      .set('Authorization', 'Bearer t')
      .send({ foo: 1 });
    expect(res.status).toBe(400);
    expect(ingest.ingestCanonicalDocument).not.toHaveBeenCalled();
  });

  it('returns 403 ingest_forbidden when BITACORA_INGEST_SECRET is set and header is missing', async () => {
    process.env.BITACORA_INGEST_SECRET = 'expected-secret';
    const ingest = { ingestCanonicalDocument: vi.fn() };
    const app = createServer({ bitacoraIngestService: ingest });
    const res = await request(app)
      .post('/api/v1/bitacora/ingest')
      .set('Authorization', 'Bearer t')
      .send(sample);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ingest_forbidden');
    expect(ingest.ingestCanonicalDocument).not.toHaveBeenCalled();
  });

  it('returns 403 when ingest secret header does not match', async () => {
    process.env.BITACORA_INGEST_SECRET = 'expected-secret';
    const ingest = { ingestCanonicalDocument: vi.fn() };
    const app = createServer({ bitacoraIngestService: ingest });
    const res = await request(app)
      .post('/api/v1/bitacora/ingest')
      .set('Authorization', 'Bearer t')
      .set('X-Bitacora-Ingest-Secret', 'wrong')
      .send(sample);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ingest_forbidden');
    expect(ingest.ingestCanonicalDocument).not.toHaveBeenCalled();
  });

  it('returns 201 for machine ingest bearer plus ingest secret (Zapier-style)', async () => {
    process.env.BITACORA_MACHINE_INGEST_TOKEN = 'zapier-static-bearer';
    process.env.BITACORA_INGEST_SECRET = 'shared-ingest-secret';
    const ingest = {
      ingestCanonicalDocument: vi.fn().mockResolvedValue({ caseId: '10', rawId: '20' }),
    };
    const app = createServer({ bitacoraIngestService: ingest });
    const res = await request(app)
      .post('/api/v1/bitacora/ingest')
      .set('Authorization', 'Bearer zapier-static-bearer')
      .set('X-Bitacora-Ingest-Secret', 'shared-ingest-secret')
      .send(sample);
    expect(res.status).toBe(201);
    expect(ingest.ingestCanonicalDocument).toHaveBeenCalledOnce();
  });

  it('returns 201 when ingest secret header matches', async () => {
    process.env.BITACORA_INGEST_SECRET = 'expected-secret';
    const ingest = {
      ingestCanonicalDocument: vi.fn().mockResolvedValue({ caseId: '10', rawId: '20' }),
    };
    const app = createServer({ bitacoraIngestService: ingest });
    const res = await request(app)
      .post('/api/v1/bitacora/ingest')
      .set('Authorization', 'Bearer t')
      .set('X-Bitacora-Ingest-Secret', 'expected-secret')
      .send(sample);
    expect(res.status).toBe(201);
    expect(ingest.ingestCanonicalDocument).toHaveBeenCalledOnce();
  });

  it('returns 400 when policy_incident missing', async () => {
    const ingest = {
      ingestCanonicalDocument: vi.fn(async (doc: BitacoraDocument) => {
        normalizeBitacoraDocumentToCaseRow(doc);
        return { caseId: '1', rawId: '2' };
      }),
    };
    const app = createServer({ bitacoraIngestService: ingest });
    const bad = { ...sample, payload: { ...sample.payload, policy_incident: '   ' } };
    const res = await request(app)
      .post('/api/v1/bitacora/ingest')
      .set('Authorization', 'Bearer t')
      .send(bad);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });
});
