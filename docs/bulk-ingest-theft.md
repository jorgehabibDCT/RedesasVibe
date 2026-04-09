# Bulk import — historical theft payloads

Use this to validate normalization and the DB upsert path against **`fixtures/theft-payloads-all.json`** (or another file in the same shape).

## Place the dataset

- Preferred path: **`fixtures/theft-payloads-all.json`** at the **repository root** (same level as `apps/` and `packages/`).

## File format

1. **JSON array** (if the first non-space character is `[`): an array of canonical **`BitacoraDocument`** objects (`payload` required; `result` / `env` optional).
2. **NDJSON** otherwise: one JSON object per non-empty line.

Malformed lines or array elements are **reported** in the summary and do not stop the rest of the file from loading.

## Prerequisites

- **Schema applied** for real import: `psql "$DATABASE_URL" -f db/migrations/001_bitacora.sql`
- **`DATABASE_URL`** in `.env` or the environment (required for **import**; optional for **dry-run** if you only want structural + normalize checks without DB classification).

## Commands

From the **repository root** (recommended):

```bash
npm run build:shared
```

**Dry-run** (no writes; does not require `DATABASE_URL` for basic counts; set `DATABASE_URL` to classify insert vs update using the current database):

Use **`--`** so npm forwards flags to the script:

```bash
npm run bulk-ingest:theft -- --dry-run
```

With an explicit path:

```bash
npm run bulk-ingest:theft -- fixtures/theft-payloads-all.json --dry-run
```

**Real import** (requires `DATABASE_URL`):

```bash
export DATABASE_URL='postgres://user:pass@localhost:5432/yourdb'
npm run bulk-ingest:theft -- fixtures/theft-payloads-all.json
```

If you run the script from **`apps/bff`** (`npm run bulk-ingest:theft` without going through the root), pass **`../../fixtures/theft-payloads-all.json`** or rely on the built-in fallback for the default filename.

## Behavior

- Each record uses **`normalizeBitacoraDocumentToCaseRow`** and **`upsertCaseAppendRaw`** (same as **`POST /api/v1/bitacora/ingest`**).
- One bad row does not abort the run unless the database connection fails fatally on startup (dry-run with DB) or `DATABASE_URL` is missing for a real import.
- Duplicate **`policy_incident`** values: the **second and later** rows **update** the same `bitacora_cases` row and each append a **`bitacora_ingest_raw`** row (see `docs/bitacora-db.md`).

## Output

The script prints counts only (no full PII payloads): totals, valid/invalid, inserted/updated, duplicate keys in file, and top error strings.
