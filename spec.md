# Specification: Bitácora de Siniestro REDESAS LITE (Pegasus iframe prototype)

**Version:** 0.3  
**Date:** 2026-04-06  
**Grounding:** `reference-findings.md` and `copy-vs-dont-copy.md` (patterns and anti-patterns from `qualitas-installations`), plus original product constraints.

**Canonical data sample:** The object below is the **authoritative example** for field names, nesting, and types for v0.3. The BFF SHOULD normalize this shape for the SPA; any future API may wrap or rename keys, but **display logic** is defined against this structure.

```json
{
  "payload": {
    "device_id": 472568141300009,
    "vehicle_vin": "3N6CD35A6TK810425",
    "vehicle_year": 2026,
    "vehicle_plates": "KV2987A",
    "vehicle_make": "NISSAN                 ",
    "vehicle_model": "CS NISSAN NP300 CH CAB 2P L4 2.5L V",
    "vehicle_color": "N/A",
    "insured_name": "TIP AUTO S.A. DE C.V. SOFOM E.N.R.",
    "incident_type": "Otro",
    "reporter_name": "OSIRI FERNANDO LOPEZ CORREA",
    "reporter_phone": "5524544400",
    "driver_name": "ALEJANDRO ESPINOZA GARCIA",
    "policy_number": "043130028769",
    "policy_incident": "0501227",
    "policy_start_date": "10/02/2026",
    "policy_end_date": "10/02/2027",
    "insured_amount": 505305,
    "agent_code": "43326"
  },
  "result": {
    "status": "success",
    "result": {
      "success": true,
      "message": "Vehicle theft incident reported successfully",
      "data": {
        "device_id": "472568141300009",
        "vin": "3N6CD35A6TK810425",
        "plates": "KV2987A",
        "status": "registered",
        "emergency_contact": {
          "name": "OSIRI FERNANDO LOPEZ CORREA",
          "phone": "5524544400"
        }
      }
    }
  },
  "env": "production"
}
```

**Assumptions for this revision**

- **Greenfield app** in a **single repository** (frontend + small backend/BFF unless integration proves BFF unnecessary).
- **Pegasus user token** in the **URL** on first load (same *class* of flow as `qualitas-installations`’s `access_token` handling in `client/src/router/index.ts`).
- **Backend validates** that token with **Pegasus** before trusting `Authorization: Bearer` (same *idea* as `api/src/auth/auth.guard.ts` → `GET ${PEGASUS_SITE}/api/login?auth=${token}`).
- **No second login** (no redirect to `auth.pegasusgateway.com` / `OAUTH_URL` for end users).
- **Iframe-first** embedding with **explicit CSP / `frame-ancestors`**.
- **Monitoring** and **documentation** are **first-class** deliverables.

---

## 1. Goal / business value

Deliver a **prototype** page, **Bitácora de Siniestro REDESAS LITE**, embedded in **Pegasus**, that surfaces **real** operational data for a **vehicle theft / incident** context: policy and insured context, vehicle identity, contacts, registration outcome, and environment metadata—with **no second login**.

**Clear deliverable with value added:** a working embedded view backed by the **documented payload shape**, instrumented for usage and health, with contributor and deployer docs.

---

## 2. Users / stakeholders

| Stakeholder | Interest |
|-------------|----------|
| **Field / ops users** | Read incident, vehicle, policy, contacts, and outcome inside Pegasus. |
| **Product** | UX fit, labels, acceptance. |
| **Engineering** | Secure iframe + token flow, maintainable transforms, observability. |
| **Security / compliance** | Token handling, PII display minimization, iframe restrictions. |
| **Platform (Pegasus)** | Embedding contract, origins, token issuance. |
| **SRE / operations** | Health signals, rollout. |

**Process requirement:** Product participation and a **clear engineering communication channel** (tool recorded in `plan.md`).

---

## 3. Scope

**In scope (prototype):**

- UI sections driven by the **canonical payload** (see below): **header / summary**, **vehicle details**, **contact directory**, **status cards**, **audit / result metadata**.
- **Latest geolocation / position** is **not present** in the canonical JSON; the UI **reserves** a position block that shows **empty / “Sin datos de posición”** until a future API provides coordinates or the BFF enriches from Pegasus devices (pattern reference: server-side device calls in `qualitas-installations`, **not** browser `?auth=`—see `copy-vs-dont-copy.md`).
- **HTTPS-only**, **iframe-first**, **CSP `frame-ancestors`**, **BFF Pegasus token validation** (see §14–15).
- **Single repo**; **monitoring** and **docs** as release criteria.

---

## 4. Non-goals

- Full CRUD on incidents.
- Offline-first or native apps.
- Guaranteed dynamic in-app theme from Pegasus without an API (optional later).
- Forwarder/proxy unless required (last resort).
- Copying `qualitas-installations` anti-patterns listed in §6.

---

## 5. Architecture decisions informed by reference repo

| Decision | Informed by (reference) | Choice for this app |
|----------|-------------------------|---------------------|
| **URL token bootstrap** | `client/src/router/index.ts` | Single bootstrap; **safe** param parsing (not narrow regex). |
| **Bearer to BFF** | `client/src/boot/axios.ts` | One client + interceptors; memory/HttpOnly; no `localStorage.clear()`. |
| **Server-side Pegasus validation** | `api/src/auth/auth.guard.ts` | `GET ${PEGASUS_SITE}/api/login?auth=` + bounded cache. |
| **User vs service token** | `SERVER_PEG_AUTH` in `pegasusManager.ts` | User token never used as server `?auth=`; device/geo enrichment **server-side** only if added. |
| **Deploy** | `ServeStaticModule` | One deployable when possible; explicit CORS allowlist. |
| **Observability** | Sentry in `app.module.ts` | APM/Sentry on BFF + client events. |

---

## 6. What we are intentionally not copying from qualitas-installations

| Anti-pattern (reference) | Source | Our stance |
|--------------------------|--------|------------|
| **Narrow regex** `access_token=([a-zA-Z0-9]+)` | `client/src/router/index.ts` | Do **not** reuse; use Pegasus-documented format + robust parsing. |
| **`localStorage` for Pegasus user token** | `client/src/stores/auth-store.ts` | Do **not** default to this; prefer **memory** or **HttpOnly cookie**. |
| **`localStorage.clear()` on auth reset** | `auth-store.ts` / interceptors | Do **not** blanket-clear; scope to owned keys only. |
| **Default unauthenticated → `OAUTH_URL`** | `client/src/router/index.ts` | **Forbidden** for this product (iframe-first / no second login). |
| **No CSP / no `frame-ancestors` in app** | `client/index.html`, `api/src/main.ts` | **Forbidden** to ship without explicit **`frame-ancestors`**. |
| **Permissive CORS** | `app.enableCors()` with no allowlist in `main.ts` | **Do not** copy; explicit production allowlist. |
| **Hardcoded Pegasus API / `?auth=` from browser** | e.g. `ReviewProcess.vue` | **Avoid**; BFF + env URLs; no user token in query from browser unless security-approved. |
| **Mixed auth models on one surface** | Basic / Redesas vs Pegasus Bearer | **One** primary user auth path for this app. |
| **Secrets in compose / repo** | `docker-compose.yml` | **Never** commit real secrets. |
| **In-app branding from Pegasus** | Not in reference SPA | Optional **new** mechanism only. |

---

## 7. UX description (page-level)

The page opens **inside Pegasus’s iframe** with **no login step**. Layout:

1. **Header / summary** — policy and incident identifiers, insured, incident type, policy window, insured amount, agent, environment.
2. **Vehicle details** — device id, VIN, year, plates, make/model/color (trimmed for display).
3. **Status cards** — top-level operation status, inner success flag, registration state from `result`, optional message snippet.
4. **Contact directory** — reporter, driver, emergency contact (with deduplication rules).
5. **Audit / result metadata** — human-readable result message, technical success path, `env`.
6. **Latest position** (reserved) — placeholder until coordinates exist from BFF/Pegasus enrichment.

---

## 8. UI sections and payload ownership

Explicit assignment of **JSON paths** to UI regions. Types refer to the canonical sample above.

| UI section | Primary JSON roots | Role |
|------------|-------------------|------|
| **Header / summary** | `payload.policy_*`, `payload.insured_name`, `payload.incident_type`, `payload.insured_amount`, `payload.agent_code`, `env` | Policy + incident + commercial context |
| **Vehicle details** | `payload.device_id`, `payload.vehicle_*`, merged with `result.result.data` for canonical VIN/plates/device after registration | Identity of vehicle and device |
| **Contact directory** | `payload.reporter_*`, `payload.driver_name`, `result.result.data.emergency_contact` | People to call; dedupe rules in §10 |
| **Status cards** | `result.status`, `result.result.success`, `result.result.data.status` | Operational / registration outcome |
| **Audit / result metadata** | `result.result.message`, `result.result.success`, `result.status`, `env` | Traceability and environment |
| **Latest position** | *Not in sample* | Empty state or future `latitude`/`longitude` from BFF |

---

## 9. Real payload mapping

Maps **every leaf field** used in the UI to its **JSON path**, **type**, and **UI consumer**. “Source” here is the **composite document** returned by the BFF (or client-held state shaped like the sample).

| JSON path | Type (sample) | UI section(s) | Notes |
|-----------|---------------|---------------|-------|
| `payload.device_id` | number | Vehicle, Header (optional chip) | Coerce for display/compare with `result.result.data.device_id` |
| `payload.vehicle_vin` | string | Vehicle | Duplicate semantic of `result.result.data.vin` |
| `payload.vehicle_year` | number | Vehicle | |
| `payload.vehicle_plates` | string | Vehicle | Duplicate semantic of `result.result.data.plates` |
| `payload.vehicle_make` | string | Vehicle | Often padded; **trim** (§10) |
| `payload.vehicle_model` | string | Vehicle | |
| `payload.vehicle_color` | string | Vehicle | May be `"N/A"` |
| `payload.insured_name` | string | Header | |
| `payload.incident_type` | string | Header | e.g. `"Otro"` |
| `payload.reporter_name` | string | Contacts | |
| `payload.reporter_phone` | string | Contacts | Display/format (§10) |
| `payload.driver_name` | string | Contacts | No phone in sample |
| `payload.policy_number` | string | Header | |
| `payload.policy_incident` | string | Header | Treat as incident / file reference |
| `payload.policy_start_date` | string (`DD/MM/YYYY`) | Header | Parse/display in locale (§10) |
| `payload.policy_end_date` | string (`DD/MM/YYYY`) | Header | |
| `payload.insured_amount` | number | Header | Currency format MXN unless product says otherwise (§10) |
| `payload.agent_code` | string | Header | |
| `result.status` | string | Status, Audit | e.g. `"success"` |
| `result.result.success` | boolean | Status, Audit | |
| `result.result.message` | string | Status (subtitle), Audit | User-facing outcome text |
| `result.result.data.device_id` | string | Vehicle, Status | **String** in sample vs number in `payload` |
| `result.result.data.vin` | string | Vehicle | Prefer for “registered” view if `success` |
| `result.result.data.plates` | string | Vehicle | |
| `result.result.data.status` | string | Status | e.g. `"registered"` |
| `result.result.data.emergency_contact.name` | string | Contacts | May duplicate reporter |
| `result.result.data.emergency_contact.phone` | string | Contacts | |
| `env` | string | Header, Audit | e.g. `"production"` |

---

## 10. Derived display transformations

Rules applied **after** null/fallback handling (§11). Implement in shared helpers (BFF and/or SPA—single source of truth documented in `plan.md`).

| Input field(s) | Transformation | Output use |
|----------------|----------------|--------------|
| `payload.vehicle_make`, `payload.vehicle_model`, any string known to be padded | `trim()`; collapse internal repeated spaces if needed | Single-line labels |
| `payload.vehicle_color` | If trimmed upper case is `N/A` or empty → display **“No especificado”** (or product copy) | Vehicle color row |
| `payload.insured_amount` | Format as currency (default **MXN** `$505,305.00`-style or locale-aware); integer in sample | Header |
| `payload.policy_start_date`, `payload.policy_end_date` | Parse `DD/MM/YYYY` safely; display in user locale; validate date parts | Header range |
| `payload.reporter_phone`, `emergency_contact.phone` | Strip non-digits for logic; display with spacing/parentheses per locale | Contacts |
| `payload.device_id` vs `result.result.data.device_id` | Normalize to **string** for comparison: e.g. `String(BigInt(payload.device_id))` if within safe integer range, else string from API | Single “Device ID” line |
| `result.result.data.vin` vs `payload.vehicle_vin` | If both present and equal after **uppercase trim**, show once; if differ → show **warning chip** “Datos inconsistentes” and prefer `result.result.data` when `result.result.success === true` | Vehicle |
| `result.result.data.plates` vs `payload.vehicle_plates` | Same dedupe / conflict rule as VIN | Vehicle |
| `result.result.message` | Single line in status hero; full string in audit block | Status + Audit |
| `result.result.data.status` | Map to badge: `registered` → label TBD with product (e.g. “Registrado”) | Status card |
| `env` | Uppercase for badge; map `production` → “Producción” if i18n | Header or audit |

---

## 11. Null, missing, and inconsistent data handling

| Scenario | Rule |
|----------|------|
| **Padded strings** (e.g. trailing spaces in `vehicle_make`) | Always **trim** before display and compare; do not render trailing whitespace. |
| **Literal `"N/A"`** (e.g. `vehicle_color`) | Treat as *missing color*; show **“No especificado”** (or hide row if product prefers). |
| **Nested duplicates** (`vin`/`vehicle_vin`, `plates`/`vehicle_plates`, reporter vs `emergency_contact`) | **Prefer** `result.result.data.*` when `result.result.success === true`; else show `payload.*`. If both exist and differ after normalization → **conflict UI** (§10). If `emergency_contact` equals reporter (same name+phone), **collapse to one row** with role “Reporter / contacto de emergencia” or two lines under one card—product picks copy. |
| **Missing `emergency_contact`** | If `result.result.data.emergency_contact` is absent or null, show **reporter** from `payload` as primary contact; if reporter also missing, show **“Sin contacto de emergencia”** in contacts section. |
| **`device_id` type mismatch** (number in `payload`, string in `result.result.data`) | Never use `===` across types; **normalize to string** for display and equality; document in API types. |
| **Missing `result` or partial failure** | If `result.status !== 'success'` or `result.result.success === false`, status cards show **failure** styling; message from `result.result.message` if present, else generic error string. |
| **Missing optional UI fields** | Show **“—”** for scalar strings; omit optional rows; never throw on missing nested keys—**optional chaining** end-to-end. |

---

## 12. Field mapping (visible values, concrete paths)

### A. Header / summary

| Field label | JSON path(s) | Transform | Fallback |
|-------------|--------------|-----------|----------|
| Incident / expediente | `payload.policy_incident` | trim | “—” |
| Póliza | `payload.policy_number` | trim | “—” |
| Asegurado / contratante | `payload.insured_name` | trim | “—” |
| Tipo de incidente | `payload.incident_type` | trim | “—” |
| Vigencia (inicio) | `payload.policy_start_date` | §10 date | “—” |
| Vigencia (fin) | `payload.policy_end_date` | §10 date | “—” |
| Suma asegurada / monto | `payload.insured_amount` | §10 currency | “—” |
| Clave de agente | `payload.agent_code` | trim | “—” |
| Entorno | `env` | §10 env badge | hide if missing |

### B. Vehicle details

| Field label | JSON path(s) | Transform | Fallback |
|-------------|--------------|-----------|----------|
| ID dispositivo | `result.result.data.device_id` or `payload.device_id` | §10 normalize id | “—” |
| VIN | `result.result.data.vin` or `payload.vehicle_vin` | upper trim; conflict §10 | “—” |
| Año | `payload.vehicle_year` | number | “—” |
| Placas | `result.result.data.plates` or `payload.vehicle_plates` | trim; conflict §10 | “—” |
| Marca | `payload.vehicle_make` | trim | “—” |
| Modelo | `payload.vehicle_model` | trim | “—” |
| Color | `payload.vehicle_color` | §10 N/A handling | “No especificado” |

### C. Contact directory

| Role (label) | JSON path(s) | Transform | Fallback |
|--------------|--------------|-----------|----------|
| Reportante | `payload.reporter_name`, `payload.reporter_phone` | phone §10 | name “—”, phone hide row if empty |
| Conductor | `payload.driver_name` | trim | “—” (no phone in sample) |
| Contacto de emergencia | `result.result.data.emergency_contact` | dedupe vs reporter §11 | use reporter if missing |

### D. Status cards

| Card | JSON path(s) | Transform | Fallback |
|------|--------------|-----------|----------|
| Resultado operación | `result.status` | lowercase label map | raw string |
| Éxito registro | `result.result.success` | boolean → Sí/No | “—” |
| Estado vehículo / registro | `result.result.data.status` | badge map | “—” |
| Mensaje | `result.result.message` | clamp length in card | “—” |

### E. Audit / result metadata

| Field | JSON path(s) | Transform | Fallback |
|-------|--------------|-----------|----------|
| Mensaje completo | `result.result.message` | full text | “—” |
| Éxito | `result.result.success` | boolean | “—” |
| Status envoltorio | `result.status` | string | “—” |
| Entorno | `env` | §10 | “—” |

### F. Latest position (reserved)

| Field label | JSON path | Notes |
|-------------|-----------|--------|
| *TBD* | — | No fields in canonical payload; show empty state until BFF provides e.g. `position.lat` / `position.lon` |

---

## 13. Loading / empty / stale / error states

| State | Behavior |
|-------|----------|
| **Loading** | Skeletons per section; position block may share vehicle skeleton or minimal placeholder. |
| **Empty subsection** | Use §11 fallbacks; contacts may show only one row if others missing. |
| **Stale** | If BFF adds `retrievedAt`, show “Datos del …” banner. |
| **Partial error** | e.g. `result` missing but `payload` present → show payload sections + warning banner on status. |
| **Total failure** | Auth / network; no stack traces; align `problem` codes with client per `qualitas-installations` axios pattern. |
| **Auth expired** | Parent refresh or embedded message. |

---

## 14. Auth + iframe constraints

| Requirement | Specification |
|---------------|----------------|
| HTTPS | Required for token + PII. |
| Token from URL | Default candidate `access_token`; never log raw token or full query. |
| No second login | BFF session only; no `OAUTH_URL` redirect. |
| Backend validation | `GET ${PEGASUS_SITE}/api/login?auth=` + cache. |
| Embed only | CSP **`frame-ancestors`** for Pegasus origins. |
| Standalone | Degraded UX; not a substitute for CSP + validation. |

---

## 15. Security expectations

- No default `localStorage` for bearer token; explicit CORS allowlist; no secrets in repo; output encoding for all string fields from payload; PII minimization for contacts.

---

## 16. Monitoring / usage / health (first-class)

Include events tagged with **`env`** from payload when present for segmentation. Section-level success/failure for header, vehicle, contacts, status, audit, position.

---

## 17. Stability / scalability / data volume

Single-document payload is small; **audit** table in future may paginate—canonical sample is one row of metadata, not a list. If backend later sends **arrays** of events, add pagination then.

---

## 18. Repo-level deliverables

CONTRIBUTING, DEPLOYING, security-iframe, **fixture file** matching canonical JSON for tests.

---

## 19. Acceptance criteria

1. Iframe + HTTPS + URL token + BFF Pegasus validation per §14.
2. All sections **A–E** render values from the **canonical paths** when data is present; **§11** rules verified with unit tests for trim, `N/A`, dedupe, `device_id` coercion, missing `emergency_contact`.
3. **Vehicle** and **contacts** show **conflict warning** when normalized payload vs `result.result.data` disagree and `success` is true.
4. **Position** section shows explicit empty state until data exists.
5. CSP + monitoring + docs as prior spec.

---

## 20. Open questions

1. Currency/locale for `insured_amount` (MXN assumed).
2. Badge labels Spanish copy for `result.result.data.status` values beyond `registered`.
3. When Pegasus provides coordinates, field names and BFF contract.
4. Confirm `access_token` param and validation endpoint.

---

## Appendix: Hard constraints checklist

| Constraint | Section |
|------------|---------|
| Real payload mapping | §8–12 |
| Derived transforms | §10 |
| Fallbacks | §11–12 |
| Reference auth architecture | §5, §14 |
| Iframe + CSP | §3, §14 |
