import type { Request } from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { getBitacoraIngestSecret, isBitacoraIngestSecretValid } from './bitacoraIngestSecret.js';

describe('bitacoraIngestSecret', () => {
  const orig = process.env.BITACORA_INGEST_SECRET;

  afterEach(() => {
    if (orig === undefined) delete process.env.BITACORA_INGEST_SECRET;
    else process.env.BITACORA_INGEST_SECRET = orig;
  });

  it('treats empty or whitespace-only env as unset', () => {
    delete process.env.BITACORA_INGEST_SECRET;
    expect(getBitacoraIngestSecret()).toBeUndefined();
    process.env.BITACORA_INGEST_SECRET = '   ';
    expect(getBitacoraIngestSecret()).toBeUndefined();
  });

  it('when secret unset, any header is valid', () => {
    delete process.env.BITACORA_INGEST_SECRET;
    const req = { headers: {} } as Request;
    expect(isBitacoraIngestSecretValid(req)).toBe(true);
  });

  it('when secret set, requires matching header', () => {
    process.env.BITACORA_INGEST_SECRET = 'abc';
    const ok = { headers: { 'x-bitacora-ingest-secret': 'abc' } } as Request;
    const bad = { headers: { 'x-bitacora-ingest-secret': 'abz' } } as Request;
    expect(isBitacoraIngestSecretValid(ok)).toBe(true);
    expect(isBitacoraIngestSecretValid(bad)).toBe(false);
  });
});
