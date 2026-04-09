# Bitácora database & ingest

## Why `policy_incident` is the business key

The expediente / incident reference (`policy_incident` in the canonical payload) is the stable identifier operations use to correlate a theft/incident report across systems. Device IDs and plates can repeat or change representation; the incident key is the agreed join point for “latest state” per case in this design.

## Why both raw and normalized tables

| Table | Role |
|-------|------|
| **`bitacora_ingest_raw`** | **Traceability**: each accepted payload is stored as **`jsonb`** exactly as ingested (after JSON parse/stringify round-trip for safe cloning). Supports audits, replays, and debugging when normalized fields disagree with the source. |
| **`bitacora_cases`** | **Serving & reporting**: one row per `policy_incident` with trimmed strings, parsed dates, nulls for missing color (`N/A`), numeric amount, and registration fields derived from `result.result.data` when the registration succeeded. |

No history/version tables in v1: duplicates overwrite the normalized row and append a new raw row.

## Duplicate ingest (same `policy_incident`)

1. **`INSERT … ON CONFLICT (policy_incident) DO UPDATE`** updates all normalized columns on `bitacora_cases` and bumps **`updated_at`**.
2. A **new** row is always appended to **`bitacora_ingest_raw`** with the full payload.
3. **`bitacora_cases.latest_raw_id`** is set to the new raw row’s id.

So: **one normalized row per incident key**, **many raw rows** over time if the same key is submitted again.

## API

- **`POST /api/v1/bitacora/ingest`** — body: canonical **`BitacoraDocument`** (same shape as spec / GET). Requires **`Authorization: Bearer`** like other protected routes.
- **`GET /api/v1/bitacora/cases`** — compact list for the SPA case switcher (`policy_incident`, `plates`, `insured_name`, `updated_at`). Query: **`limit`**, optional **`search`**. In fixture mode returns **`{ cases: [] }`**; in **`BITACORA_DATA_MODE=db`** reads from **`bitacora_cases`**.
- **`GET /api/v1/bitacora`** — same JSON contract everywhere. **Fixture** mode: from the canonical file. **`BITACORA_DATA_MODE=db`**: from **`bitacora_cases`** (see table below). **Integration** mode: from the configured upstream.

## Bulk historical import

For large offline files (e.g. `fixtures/theft-payloads-all.json`), use the CLI documented in **[`bulk-ingest-theft.md`](./bulk-ingest-theft.md)** — same normalization and upsert as **`POST /api/v1/bitacora/ingest`**, with dry-run and summary reporting.

## Reading from PostgreSQL (UI / BFF)

Set **`BITACORA_DATA_MODE=db`** and **`DATABASE_URL`**. The BFF serves **`GET /api/v1/bitacora`** from **`bitacora_cases`**:

| Query | Behavior |
|--------|----------|
| **`?policy_incident=&lt;id&gt;`** | Return that case (404 if not found). |
| **(no param)** | Return the most recently **updated** row (`ORDER BY updated_at DESC LIMIT 1`). If the table is empty → **400** `bitacora_no_default`. |

The JSON shape is still **`BitacoraDocument`** (mapped from normalized columns via `mapDbCaseRowToBitacoraDocument` in `@redesas-lite/shared`).

**SPA:** pass **`policy_incident`** in the embed URL together with a session token as **`access_token`** and/or **`auth`** (live Pegasus often uses `?auth=...`; if both are present, the SPA prefers `access_token`), e.g.  
`http://localhost:5173/?auth=…&policy_incident=040003375123`  
The web app forwards it as **`GET /api/v1/bitacora?policy_incident=...`**.

**Fixture mode** (`BITACORA_DATA_MODE` unset or `fixture`) is unchanged for demos and does not use the database.

## Setup

1. Create schema:

   ```bash
   psql "$DATABASE_URL" -f db/migrations/001_bitacora.sql
   ```

   Or from the repo root: **`npm run db:migrate`** (requires **`DATABASE_URL`** and **`psql`**). The migration is **not** idempotent — use a fresh database or expect failure if tables already exist.

2. Set **`DATABASE_URL`** for the BFF (see `.env.example`). Without it, ingest returns **503** `ingest_unavailable`.

## Hosted Postgres cutover (e.g. Render BFF)

For a step-by-step switch from **fixture** to **db** mode on a hosted database (migration, bulk import, Render env vars, verification), see **[`runbook-hosted-postgres.md`](./runbook-hosted-postgres.md)**.

## Remaining product/DB questions

- Retention policy for `bitacora_ingest_raw` (archive vs delete).
- Whether ingest should be **async** (queue) at higher volume.
- Optional unique constraint on raw rows (usually not: duplicates are allowed by design).
