# Source feed integration (decision guide)

This document maps **how the real upstream feed behaves** to the **smallest integration** supported by this repo today. It does not add new services—only clarifies which existing path to use.

For HTTP auth, headers, and **`BitacoraDocument`** shape, see **[`ongoing-ingest.md`](./ongoing-ingest.md)** and **[`bitacora-db.md`](./bitacora-db.md)**.

---

## A. Three source-feed capabilities → how they connect

### 1. Source can POST HTTP directly (push)

**Simplest connection:** The feed (or a small proxy you control) sends **`POST /api/v1/bitacora/ingest`** to the BFF with a canonical **`BitacoraDocument`** body.

- **Auth:** **`Authorization: Bearer`** — either **Pegasus-validated** (iframe users) + optional **`PEGASUS_ALLOWED_*`**, or **`BITACORA_MACHINE_INGEST_TOKEN`** (automation such as **Zapier**, no Pegasus call) + recommended **`X-Bitacora-Ingest-Secret`**. See **[`zapier-ingest.md`](./zapier-ingest.md)**.
- **Nothing new in this repo:** the route already exists.

### 2. Pull-only / pollable (no outbound push to you)

**Simplest connection:** A **small scheduled job outside this repo** (cron, systemd timer, Render Cron, internal worker) runs on an interval: **pull** from the source API or export location, transform each item to **`BitacoraDocument`**, then **`POST`** to **`/api/v1/bitacora/ingest`** (same headers as above).

- **This repo does not include** a poller, scheduler, or queue—only the **ingest HTTP contract**. The “integration” is the **thin runner** you or the source team deploys.

### 3. File export only (batch files, no live API)

**Simplest connection (two options):**

| Option | When to use |
|--------|-------------|
| **`npm run bulk-ingest:theft`** | Trusted host has **`DATABASE_URL`**; file matches formats in **[`bulk-ingest-theft.md`](./bulk-ingest-theft.md)**. **No** Bearer/ingest secret—**DB credentials** must be protected. |
| **File → loop of `POST` ingest** | Avoid DB creds on the job host; job reads the export, maps rows to **`BitacoraDocument`**, and **POSTs** to the BFF (Bearer + ingest secret). More HTTP calls, same security model as (1). |

---

## B. Recommended first real source-feed model

**Prefer direct HTTP POST (shape 1)** when the source can call HTTPS or can place a **tiny forwarder** next to it: one **`BitacoraDocument`** per accepted event (or batched in your runner with sequential POSTs).

**Why:** Uses the **existing** BFF path—Pegasus auth, app allowlists, optional **`BITACORA_INGEST_SECRET`**, **`bitacora_ingest_raw`** audit rows—without new infrastructure in this repository.

**If the source only offers files:** start with **`bulk-ingest:theft`** (shape 3, CLI) for backfills and periodic drops; move to POST ingest when they can expose an API or automation can POST for you.

**If the source is pull-only:** use shape 2—a **minimal external poller** that only translates “their record” → **`BitacoraDocument`** → **`POST` ingest**. Still no queue required at low volume.

---

## C. Next conversation with the source owner (checklist)

Use this to lock the **smallest** contract:

1. **Delivery mode:** Can they **POST JSON to our URL**, or only **expose pull/file**?
2. **Payload:** Can they emit fields that map to **`BitacoraDocument`** / `spec.md`, or do we need a **one-time mapping layer** (their field names → ours)?
3. **Frequency / volume:** Events per day (rough)—enough for **synchronous POST** only, or will we need a queue later?
4. **Security:** Who holds the **Pegasus Bearer** for automation, and who stores **`BITACORA_INGEST_SECRET`** (if used)?
5. **Idempotency:** Same **`policy_incident`** resubmitted is an **upsert** in our DB (see **`bitacora-db.md`**); confirm that matches their semantics.

---

## D. What this repo does *not* include yet

- Inbound webhooks as a **separate** product surface (POST ingest *is* the webhook-shaped endpoint).
- Built-in **cron**, **retry queue**, or **dead-letter** handling—add only when volume or reliability demands it.
