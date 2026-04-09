# Runbook: hosted PostgreSQL for Bitácora (Render BFF)

Use this when moving the **BFF** from **fixture** mode to **`BITACORA_DATA_MODE=db`** against a **hosted** Postgres (Render Postgres, Neon, RDS, etc.). The **frontend contract and URLs do not change** — only the BFF reads from the database instead of the JSON fixture.

---

## A. Step-by-step cutover

### 1. Create hosted Postgres

- Provision a database in your provider (e.g. **Render** → New → PostgreSQL, or Neon / RDS).
- Note the **internal** vs **external** connection string:
  - For **`npm run db:migrate`** and **`bulk-ingest`** from your **laptop**, use a URL that is reachable from your machine (often “external” / “pooled” / public host).
  - For the **Render BFF** service env **`DATABASE_URL`**, prefer the provider’s **same-region** / private / internal URL if available (lower latency, no public exposure of the DB port).

### 2. Apply migration

From the **repository root**, with `psql` installed locally:

```bash
export DATABASE_URL='postgres://USER:PASSWORD@HOST:5432/DATABASE'
npm run db:migrate
```

Or equivalently:

```bash
psql "$DATABASE_URL" -f db/migrations/001_bitacora.sql
```

**Important:** `001_bitacora.sql` uses **`CREATE TABLE`** without `IF NOT EXISTS`. Run it **once** per empty database. If tables already exist, the command will fail — that is expected; do not “double-apply” on the same DB.

### 3. Bulk import historical payloads

Still from **repo root**, after **`npm run build:shared`** (the ingest script builds shared automatically via the BFF script, but building shared first avoids surprises):

```bash
export DATABASE_URL='postgres://USER:PASSWORD@HOST:5432/DATABASE'
npm run bulk-ingest:theft -- fixtures/theft-payloads-all.json
```

Use **`--dry-run`** first if you want counts without writes:

```bash
npm run bulk-ingest:theft -- fixtures/theft-payloads-all.json --dry-run
```

See **[`bulk-ingest-theft.md`](./bulk-ingest-theft.md)** for paths and NDJSON/array formats.

### 4. Update Render environment variables

In the **Render** dashboard → your **BFF Web Service** → **Environment**:

| Variable | Action |
|----------|--------|
| **`DATABASE_URL`** | Set to the **BFF-facing** connection string (see step 1). |
| **`BITACORA_DATA_MODE`** | Set to **`db`**. |

Save. Do **not** change **`PORT`**, **`CORS_ORIGINS`**, or Pegasus-related vars unless you are fixing a separate issue.

### 5. Redeploy and verify

- Trigger a **manual deploy** or wait for auto-deploy after env change.
- Run the **verification** checks below.

---

## B. Safety: prechecks and order of operations

**Safest order**

1. **Create** the hosted DB (empty).
2. **Migrate** (schema only).
3. **Import** data (or accept starting with an empty `bitacora_cases` — then **`GET /api/v1/bitacora`** without `policy_incident` returns **400** `bitacora_no_default`).
4. **Set** Render **`DATABASE_URL`** + **`BITACORA_DATA_MODE=db`** and redeploy.

**Do not** set **`BITACORA_DATA_MODE=db`** on Render until:

| Check | How |
|-------|-----|
| **Migration applied** | `psql "$DATABASE_URL" -c '\dt'` lists **`bitacora_cases`** and **`bitacora_ingest_raw`**. |
| **Rows in `bitacora_cases`** (if you expect data) | `SELECT count(*) FROM bitacora_cases;` — **> 0** after bulk import (or **0** only if you intentionally skipped import). |
| **Rows in `bitacora_ingest_raw`** (if you imported) | `SELECT count(*) FROM bitacora_ingest_raw;` — typically **≥** number of ingest operations. |
| **`/health`** | `curl -sS https://<your-bff-host>/health` → **200**, JSON with **`"ok": true`**. |
| **`/ready`** | `curl -sS https://<your-bff-host>/ready` → **200** when auth + bitácora config are coherent; **503** if e.g. Pegasus is required but misconfigured. |

Verify **before** cutover while the service is still on **fixture** mode if you want a baseline; after cutover, repeat **`/health`**, **`/ready`**, and a **`GET /api/v1/bitacora`** with a valid **`Authorization: Bearer`** token (same as today).

**Secrets:** Do not paste **`DATABASE_URL`** or tokens into tickets or logs.

---

## C. Helper commands (repo root)

| Command | Purpose |
|---------|---------|
| **`npm run db:migrate`** | Runs **`scripts/bitacora-db-migrate.sh`** — requires **`DATABASE_URL`** and local **`psql`**. |
| **`npm run bulk-ingest:theft`** | Delegates to **`@redesas-lite/bff`** bulk script; pass **`--`** then file path and flags. |

---

## D. Related docs

- **[`bitacora-db.md`](./bitacora-db.md)** — schema, API behavior in **db** mode.
- **[`bulk-ingest-theft.md`](./bulk-ingest-theft.md)** — import file format and options.
- **README** — **Render** section and **Switching Render from fixture to db mode**.
