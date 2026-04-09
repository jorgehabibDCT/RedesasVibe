import type { BitacoraDocument } from '@redesas-lite/shared';
import { normalizeBitacoraDocumentToCaseRow } from '@redesas-lite/shared';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
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
