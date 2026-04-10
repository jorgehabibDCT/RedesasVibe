# Ongoing Bitácora ingestion (operations)

This document describes **how new records reach PostgreSQL** in an ongoing way, given the current monorepo—without adding a new pipeline framework.

**Choosing among HTTP push, polling, or file exports:** see **[`source-feed-integration.md`](./source-feed-integration.md)**.

## What already exists

| Path | How it works | Auth / access |
|------|----------------|---------------|
| **`POST /api/v1/bitacora/ingest`** | HTTP on the BFF; body is a canonical **`BitacoraDocument`** (same shape as **`GET /api/v1/bitacora`**). Normalizes + upserts **`bitacora_cases`** and appends **`bitacora_ingest_raw`**. | Same stack as other protected routes: **`Authorization: Bearer`**, Pegasus validation when enabled, optional app-level allowlists, plus **optional ingest secret** (see below). Returns **503** `ingest_unavailable` if **`DATABASE_URL`** is not configured. |
| **`npm run bulk-ingest:theft`** | CLI: reads a JSON/NDJSON file, same normalization and DB writes as the HTTP path. | **No HTTP.** Uses **`DATABASE_URL`** directly from the environment where the script runs (operator laptop, CI, or job runner). See **[`bulk-ingest-theft.md`](./bulk-ingest-theft.md)**. |
| **Hosted DB setup** | Migration + env + verification. | **[`runbook-hosted-postgres.md`](./runbook-hosted-postgres.md)**. |

There is **no** built-in webhook receiver, message queue, or in-repo cron scheduler. Those can wrap the options above if you need them later.

## Trusted ingest call (HTTP)

| Item | Value |
|------|--------|
| **Method / path** | **`POST /api/v1/bitacora/ingest`** |
| **Auth** | **`Authorization: Bearer <token>`** — same Pegasus-validated session as UI reads (and same **`PEGASUS_ALLOWED_*`** allowlists if configured). |
| **Ingest secret (recommended in production)** | If **`BITACORA_INGEST_SECRET`** is set in the BFF environment, callers must also send **`X-Bitacora-Ingest-Secret: <same value>`**. Comparison is timing-safe on the server. **Unset** = legacy behavior (any authenticated+authorized user may POST ingest). |
| **Body** | **`Content-Type: application/json`**, canonical **`BitacoraDocument`** with a non-empty **`payload.policy_incident`**. |
| **Success** | **201** `{ "ok": true, "caseId": "…", "rawId": "…" }` |
| **Forbidden ingest** | **403** `{ "error": "ingest_forbidden", "message": "…" }` — missing/wrong ingest secret when configured. Logs **`ingest_forbidden`** (no secret values). |

**Why the secret:** Normal app users in the iframe have a Pegasus Bearer but **do not** know the shared ingest key. Automation (cron, worker, **Zapier**) can use **`BITACORA_MACHINE_INGEST_TOKEN`** as **`Authorization: Bearer`** (no Pegasus session) plus **`X-Bitacora-Ingest-Secret`** — see **[`zapier-ingest.md`](./zapier-ingest.md)**.

## Recommended first model for “continuous” ingestion

**Use `POST /api/v1/bitacora/ingest` as the single integration contract** for any upstream that can call your BFF over HTTPS with a **valid Bearer token** (and passes allowlists if enabled).

- **Why:** Reuses existing **authentication**, **authorization**, and **structured logging**; no new services; duplicates are handled as documented in **[`bitacora-db.md`](./bitacora-db.md)** (upsert + new raw row).
- **How to run it on a schedule:** an external **cron** (Render Cron Job, internal scheduler, GitHub Actions, etc.) that performs **`curl`** or an HTTP client with a bearer obtained by **your organization’s** token/session policy. This repo does **not** implement Pegasus token refresh or long-lived service tokens—that belongs in your ops story.
- **When the HTTP path is awkward:** if automation cannot hold a Pegasus-valid token, **batch files + `bulk-ingest:theft`** on a trusted host with **`DATABASE_URL`** is the simplest alternative (protect credentials; no Bearer).

**Not recommended as a first step:** building a custom webhook + queue inside this repo unless volume or latency forces it—the **POST** endpoint is already the minimal “push” surface.

## Payload expectations (safe contract)

- **`Content-Type: application/json`**
- Body: **`BitacoraDocument`** with a non-empty **`payload.policy_incident`** (business key). Other fields follow **`spec.md`** / shared types.
- **201** response: `{ "ok": true, "caseId": "<uuid>", "rawId": "<uuid>" }` (internal row identifiers for support; not secrets).
- Validation failures: **400** with `validation_error` or `invalid_body`; server errors: **500** / **503** as documented in **[`bitacora-db.md`](./bitacora-db.md)**.

## Example call (Bearer + ingest secret when `BITACORA_INGEST_SECRET` is set)

```bash
curl -sS -X POST "${BFF_BASE_URL}/api/v1/bitacora/ingest" \
  -H "Authorization: Bearer <opaque-token>" \
  -H "X-Bitacora-Ingest-Secret: <same-as-BITACORA_INGEST_SECRET>" \
  -H "Content-Type: application/json" \
  -d @path/to/bitacora-document.json
```

Omit the **`X-Bitacora-Ingest-Secret`** line only when the BFF has **no** ingest secret configured (e.g. local dev).

## Observability

- **`request_complete`** lines include method/path/status for all API routes.
- Successful ingests also emit **`bitacora_ingest_success`** with **`caseId`**, **`rawId`**, and **`requestId`** (no bearer token, no full JSON body).
- Rejected ingest (missing/wrong secret when required): **`ingest_forbidden`** (no header values logged).

## Next practical steps (outside this repo)

1. Decide **which system** produces canonical **`BitacoraDocument`** JSON (export, middleware, or manual upload converted to JSON).
2. Decide **Bearer strategy** for automation (session vs batch job with **`DATABASE_URL`** only).
3. Monitor **`bitacora_ingest_raw`** growth and ingest logs; define **retention** when needed (see open questions in **`bitacora-db.md`**).
