import type { Pool } from 'pg';
import type { BitacoraDocument } from '@redesas-lite/shared';
import { normalizeBitacoraDocumentToCaseRow } from '@redesas-lite/shared';
import { upsertCaseAppendRaw } from './bitacoraIngestRepository.js';

export function createBitacoraIngestService(pool: Pool) {
  return {
    async ingestCanonicalDocument(doc: BitacoraDocument): Promise<{ caseId: string; rawId: string }> {
      const row = normalizeBitacoraDocumentToCaseRow(doc);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = await upsertCaseAppendRaw(client, doc, row);
        await client.query('COMMIT');
        return out;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

export type BitacoraIngestService = ReturnType<typeof createBitacoraIngestService>;
