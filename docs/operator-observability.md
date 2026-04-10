# Operator observability (admin-only UI)

## What we use as the “admin” signal

The BFF does **not** parse Pegasus OAuth **`scope`** strings or generic “role” fields today. Those shapes vary by deployment and are not present in a stable form in our extracted principal.

**Reliable gate:** environment allowlists matched against the **same** Pegasus-derived **`userId`** and **`groupIds`** we already extract from `/api/login` JSON and optional identity headers:

- **`PEGASUS_OPERATOR_USER_IDS`** — comma-separated user ids
- **`PEGASUS_OPERATOR_GROUP_IDS`** — comma-separated group ids

If **both** are unset, **no one** is treated as an operator (safe default). **`machine_ingest`** and **`bypass`** sessions never see the operator UI.

This is **independent** of **`PEGASUS_ALLOWED_*`** (app access): a user can be allowed to use the app but **not** see operator metadata unless listed here.

## API

**`GET /api/v1/bitacora/operator-meta`** (same Bearer as the SPA)

- **Operators:** **200** JSON with `bitacoraDataMode`, `pegasusAuthMode`, `policyIncident`, `caseId`, `latestRawId`, `caseUpdatedAt`, `documentEnv` (see handler).
- **Non-operators:** **404** `{ "error": "not_found" }` — same shape as an unknown route so the capability is not advertised.

## SPA

When the endpoint returns **200**, the Bitácora page shows a small **“Detalle operativo (solo operadores)”** block. Normal users get **404** and **no** extra UI.

## Uncertainty / next steps

If Pegasus later exposes a **documented** admin or scope claim in `/api/login` (or headers), we can add **optional** parsing and map it to `isOperator` **in addition to** env lists—without removing the env escape hatch for ops.
