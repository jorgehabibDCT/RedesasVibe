/**
 * Bulk import historical theft payloads into `bitacora_cases` / `bitacora_ingest_raw`
 * using the same normalization + `upsertCaseAppendRaw` path as POST /api/v1/bitacora/ingest.
 *
 * Usage:
 *   npx tsx scripts/bulk-ingest-theft.ts [path] [--dry-run]
 *
 * @see docs/bulk-ingest-theft.md
 */
import 'dotenv/config';
import {
  IngestValidationError,
  normalizeBitacoraDocumentToCaseRow,
  parseTheftDatasetContent,
} from '@redesas-lite/shared';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import {
  caseExistsByPolicyIncident,
  upsertCaseAppendRaw,
} from '../src/db/bitacoraIngestRepository.js';

function parseArgs(): { filePath: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const positional = args.filter((a) => !a.startsWith('--'));
  const filePath = positional[0] ?? 'fixtures/theft-payloads-all.json';
  return { filePath, dryRun };
}

/** Resolves default fixture path when invoked from repo root or from `apps/bff`. */
function resolveInputPath(filePath: string): string {
  const abs = resolve(process.cwd(), filePath);
  if (existsSync(abs)) return abs;
  if (filePath === 'fixtures/theft-payloads-all.json') {
    const fromBff = resolve(process.cwd(), '../../fixtures/theft-payloads-all.json');
    if (existsSync(fromBff)) return fromBff;
  }
  return abs;
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function topEntries(map: Map<string, number>, limit: number): [string, number][] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

async function main(): Promise<void> {
  const { filePath, dryRun } = parseArgs();
  const absolute = resolveInputPath(filePath);

  let raw: string;
  try {
    raw = readFileSync(absolute, 'utf-8');
  } catch (e) {
    console.error(`Fatal: cannot read file: ${absolute}`);
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const parsed = parseTheftDatasetContent(raw);
  if (!parsed.ok || parsed.fatalError) {
    console.error(`Fatal: ${parsed.fatalError ?? 'parse failed'}`);
    process.exit(1);
  }

  const errorCounts = new Map<string, number>();
  for (const le of parsed.loadErrors) {
    bump(errorCounts, `load: ${le.error}`);
  }

  const poolUrl = process.env.DATABASE_URL?.trim();
  let pool: pg.Pool | null = null;

  if (!dryRun) {
    if (!poolUrl) {
      console.error('Fatal: DATABASE_URL is required for real import (omit --dry-run only when DB is configured).');
      process.exit(1);
    }
    pool = new pg.Pool({ connectionString: poolUrl });
  }

  let existingInDb = new Set<string>();
  if (dryRun && poolUrl) {
    const p = new pg.Pool({ connectionString: poolUrl });
    try {
      const r = await p.query('SELECT policy_incident FROM bitacora_cases');
      for (const row of r.rows as { policy_incident: string }[]) {
        existingInDb.add(row.policy_incident);
      }
    } catch (e) {
      console.error('Fatal: could not read existing cases from database (dry-run with DB).');
      console.error(e instanceof Error ? e.message : e);
      await p.end();
      process.exit(1);
    }
    await p.end();
  }

  /** Simulates case existence after prior rows in this run (for dry-run classification). */
  const simulatedExists = new Set<string>(existingInDb);

  let valid = 0;
  let invalid = 0;
  let inserted = 0;
  let updated = 0;
  let duplicateSamePolicyInFile = 0;
  let dbErrors = 0;
  const seenPolicyInOrder: string[] = [];

  for (const rec of parsed.records) {
    let row;
    try {
      row = normalizeBitacoraDocumentToCaseRow(rec.doc);
    } catch (e) {
      invalid++;
      if (
        (e instanceof IngestValidationError || (e instanceof Error && e.name === 'IngestValidationError'))
      ) {
        bump(errorCounts, `normalize: ${(e as Error).message}`);
      } else {
        bump(errorCounts, `normalize: ${e instanceof Error ? e.message : String(e)}`);
      }
      continue;
    }

    valid++;

    const pi = row.policy_incident;
    const seenBeforeInFile = seenPolicyInOrder.includes(pi);
    if (seenBeforeInFile) {
      duplicateSamePolicyInFile++;
    }
    seenPolicyInOrder.push(pi);

    if (dryRun) {
      const existed = simulatedExists.has(pi);
      if (existed) {
        updated++;
      } else {
        inserted++;
        simulatedExists.add(pi);
      }
      continue;
    }

    if (!pool) {
      throw new Error('pool missing');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existed = await caseExistsByPolicyIncident(client, pi);
      await upsertCaseAppendRaw(client, rec.doc, row);
      await client.query('COMMIT');
      if (existed) {
        updated++;
      } else {
        inserted++;
      }
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      dbErrors++;
      bump(errorCounts, `db: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      client.release();
    }
  }

  if (pool) {
    await pool.end();
  }

  const totalSource = parsed.totalSourceItems;
  const loadRejected = parsed.loadErrors.length;
  const skippedStructural = parsed.skippedEmptyLines + loadRejected;

  console.log('');
  console.log('Theft dataset bulk ingest — summary');
  console.log('====================================');
  console.log(`File:              ${absolute}`);
  console.log(`Detected format:   ${parsed.format ?? '—'}`);
  console.log(`Mode:              ${dryRun ? 'DRY-RUN (no writes)' : 'IMPORT (writes enabled)'}`);
  console.log('');
  console.log(`Total source rows: ${totalSource}`);
  console.log(`Skipped:           ${skippedStructural} (empty lines: ${parsed.skippedEmptyLines}, structural rejects: ${loadRejected})`);
  console.log(`Structurally OK:   ${parsed.records.length}`);
  console.log(`Valid (normalize): ${valid}`);
  console.log(`Invalid (norm.):   ${invalid}`);
  if (!dryRun) {
    console.log(`DB errors (row):   ${dbErrors}`);
  }
  console.log('');
  console.log(`Inserted (new case row): ${inserted}`);
  console.log(`Updated (case existed):  ${updated}`);
  console.log(
    `Duplicate policy_incident in file: ${duplicateSamePolicyInFile} (later rows upsert the same case as earlier rows)`,
  );
  console.log('');
  console.log('Note: duplicate policy_incident across the run uses ON CONFLICT — one row in bitacora_cases,');
  console.log('      one new bitacora_ingest_raw per accepted row.');
  console.log('');

  const tops = topEntries(errorCounts, 12);
  if (tops.length > 0) {
    console.log('Top errors (counts):');
    for (const [msg, n] of tops) {
      console.log(`  ${n}x  ${msg}`);
    }
    console.log('');
  }
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
