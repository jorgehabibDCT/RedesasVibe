import { afterEach, describe, expect, it } from 'vitest';
import { getBitacoraMachineIngestToken, isMachineIngestBearerToken } from './bitacoraMachineIngest.js';

describe('bitacoraMachineIngest', () => {
  const orig = process.env.BITACORA_MACHINE_INGEST_TOKEN;

  afterEach(() => {
    if (orig === undefined) delete process.env.BITACORA_MACHINE_INGEST_TOKEN;
    else process.env.BITACORA_MACHINE_INGEST_TOKEN = orig;
  });

  it('treats empty env as unset', () => {
    delete process.env.BITACORA_MACHINE_INGEST_TOKEN;
    expect(getBitacoraMachineIngestToken()).toBeUndefined();
    expect(isMachineIngestBearerToken('x')).toBe(false);
  });

  it('matches bearer token when configured', () => {
    process.env.BITACORA_MACHINE_INGEST_TOKEN = 'zapier-static-bearer';
    expect(isMachineIngestBearerToken('zapier-static-bearer')).toBe(true);
    expect(isMachineIngestBearerToken('wrong')).toBe(false);
  });
});
