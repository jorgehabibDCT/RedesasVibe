# Zapier → Bitácora ingest

**Flow:** theft webhook → Zapier → **`POST /api/v1/bitacora/ingest`**

This app does not host Zapier or the theft feed; the BFF only exposes the HTTP contract below.

## Auth model (recommended for production)

| Mechanism | Purpose |
|-----------|---------|
| **`BITACORA_MACHINE_INGEST_TOKEN`** | Static value sent as **`Authorization: Bearer <token>`**. Identifies **automation** (Zapier) without a Pegasus user session. Validated with a **timing-safe** compare; **never** logged. |
| **`BITACORA_INGEST_SECRET`** | Sent as **`X-Bitacora-Ingest-Secret`**. Second factor so a leaked Bearer alone is not enough. **Strongly recommended** when `BITACORA_MACHINE_INGEST_TOKEN` is set. |

Pegasus **`GET /api/login`** is **not** called for machine Bearer tokens. App-level **`PEGASUS_ALLOWED_*`** lists **do not apply** to machine ingest (the machine token is the gate).

Human users in the Pegasus iframe continue to use **session Bearers** + allowlists as before.

## HTTP request spec (Zapier “Webhooks by Zapier” → Custom Request)

| Item | Value |
|------|--------|
| **URL** | **`https://<your-bff-host>/api/v1/bitacora/ingest`** |
| **Method** | **`POST`** |
| **Headers** | **`Authorization`**: `Bearer <BITACORA_MACHINE_INGEST_TOKEN>` |
| | **`X-Bitacora-Ingest-Secret`**: `<BITACORA_INGEST_SECRET>` (if configured on BFF) |
| | **`Content-Type`**: `application/json` |
| **Body** | JSON object: canonical **`BitacoraDocument`** (see below). |

### Success response

**HTTP 201**

```json
{ "ok": true, "caseId": "<uuid>", "rawId": "<uuid>" }
```

### Error responses (common)

| HTTP | `error` / notes |
|------|-----------------|
| **401** | Missing/invalid **`Authorization`** (not a valid Bearer, or not machine token / not Pegasus-valid). |
| **403** | **`ingest_forbidden`** — wrong/missing **`X-Bitacora-Ingest-Secret`** when required; or **`app_access_denied`** for Pegasus users blocked by allowlists (not used for machine ingest). |
| **400** | **`invalid_body`** / **`validation_error`** — body is not a **`BitacoraDocument`** or **`policy_incident`** invalid. |
| **503** | **`ingest_unavailable`** — BFF has no **`DATABASE_URL`**. |

## Body shape (`BitacoraDocument`)

Minimum: top-level **`payload`** object with **`policy_incident`** (non-empty string) and all fields required by **`spec.md`** / `@redesas-lite/shared` **`BitacoraPayload`**.

Optional: **`result`**, **`env`**.

Example skeleton (values are illustrative—map from your theft webhook fields in Zapier):

```json
{
  "payload": {
    "device_id": 0,
    "vehicle_vin": "",
    "vehicle_year": 2026,
    "vehicle_plates": "",
    "vehicle_make": "",
    "vehicle_model": "",
    "vehicle_color": "N/A",
    "insured_name": "",
    "incident_type": "Robo",
    "reporter_name": "",
    "reporter_phone": "",
    "driver_name": "",
    "policy_number": "",
    "policy_incident": "EXPEDIENTE-UNICO",
    "policy_start_date": "01/01/2026",
    "policy_end_date": "01/01/2027",
    "insured_amount": 0,
    "agent_code": ""
  },
  "env": "production"
}
```

### Mapping from the theft webhook

Zapier must map **their** field names → our **`BitacoraPayload`** fields. You must decide per field:

- **`policy_incident`** — stable business key for the case (required).
- Strings/dates/amounts — match formats expected by normalization (**`spec.md`**).
- If the webhook does not include registration **`result`** data, you may omit **`result`** or send payload-only; the ingest path still persists **`bitacora_cases`** + **`bitacora_ingest_raw`**.

## Example `curl` (replace placeholders)

```bash
curl -sS -X POST "https://<bff-host>/api/v1/bitacora/ingest" \
  -H "Authorization: Bearer <BITACORA_MACHINE_INGEST_TOKEN>" \
  -H "X-Bitacora-Ingest-Secret: <BITACORA_INGEST_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"payload":{...}}'
```

## Operations checklist

1. Set **`BITACORA_MACHINE_INGEST_TOKEN`** and **`BITACORA_INGEST_SECRET`** in the BFF environment (Render, etc.).
2. Configure Zapier headers and a JSON body (use Zapier’s formatter / Code step to build **`BitacoraDocument`**).
3. Confirm **`bff_listen`** logs show **`machineIngestTokenConfigured": true`** (boolean only, no token).
4. Watch for **`auth_success`** with implied machine path via **`authMode`** in logs and **`bitacora_ingest_success`** on success.

See also: **[`ongoing-ingest.md`](./ongoing-ingest.md)**, **[`bitacora-db.md`](./bitacora-db.md)**.
