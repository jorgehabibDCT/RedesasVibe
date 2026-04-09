# Implementation plan: Bitácora de Siniestro REDESAS LITE

**Date:** 2026-04-06  
**Spec:** `spec.md` (v0.3 — **canonical JSON payload** in spec header)  
**Grounding:** `reference-findings.md`, `copy-vs-dont-copy.md` (Pegasus auth/embed patterns from `qualitas-installations`).

**Baseline assumptions**

- **New app from scratch**, **single repo**, **SPA + small BFF** (unless later review drops BFF).
- **Pegasus URL token** → **BFF validates** with Pegasus (`GET ${PEGASUS_SITE}/api/login?auth=` pattern from `api/src/auth/auth.guard.ts`).
- **No second login** / no default `OAUTH_URL` redirect.
- **Iframe-first** + **CSP `frame-ancestors`** (explicit; reference had none in app code).
- **Data model** = **`spec.md` canonical payload** (`payload`, `result`, `env`); transforms and fallbacks in **`spec.md` §9–12**.

---

## 1. Primary implementation order (concrete)

| Step | Name | What to deliver | Notes |
|------|------|-----------------|-------|
| **1** | **Scaffold repo** | `apps/web`, `apps/bff`, TS, lint, CI, `.env.example`, CONTRIBUTING skeleton; optional static-from-BFF deploy (`ServeStaticModule`-style). | No permissive CORS / no secrets in compose (`copy-vs-dont-copy.md`). |
| **2** | **Auth bootstrap (client)** | Safe URL token parse; memory session; axios/fetch interceptors (`Authorization: Bearer`) per `client/src/boot/axios.ts` pattern; **no** `localStorage` default; **no** OAuth redirect when token missing. | |
| **3** | **Backend token validation** | Bearer extract; Pegasus login check + cache (`auth.guard.ts` pattern); structured `401` + `problem`; **CORS allowlist**. | |
| **4** | **Iframe / CSP policy** | `Content-Security-Policy` with `frame-ancestors`; document dev exceptions. | |
| **5** | **Page UI — mocked real shape** | All sections from **`spec.md` §8–12** using a **fixture identical** to the canonical JSON (commit as `fixtures/bitacora-canonical.json` or similar). Components: HeaderSummary, **VehicleDetails**, ContactDirectory, StatusCards, **AuditResultMetadata**, **PositionPlaceholder** (empty state per §12 F). Implement **§10–11** transforms in **`packages/shared`** or `apps/web/src/lib/bitacora/` with **unit tests**. | No placeholder field names—use **`payload.policy_incident`**, **`result.result.data.device_id`**, etc. |
| **6** | **Wire real data** | BFF route returns the canonical shape (from upstream or static file first); SPA consumes typed response. **No** browser `?auth=` to Pegasus (`ReviewProcess.vue` anti-pattern). Optional later: BFF enriches position from Pegasus devices **server-side** only. | |
| **7** | **Monitoring** | Client events (section load, `env` tag); BFF Sentry/metrics; validation cache metrics. | |
| **8** | **Docs** | CONTRIBUTING, DEPLOYING (CSP, `PEGASUS_SITE`), security-iframe; document **transform helpers** and **fixture** location. | |
| **9** | **Rollout** | Feature flag if needed; staging iframe smoke; pilot → GA. | |

---

## 2. Architecture decisions informed by reference repo

Implementation must follow **`spec.md` §5–6** (reuse: central auth bootstrap, Bearer interceptors, Pegasus validation cache, static+BFF deploy option; avoid: narrow regex, `localStorage` token, missing CSP, permissive CORS, browser Pegasus `?auth=`).

---

## 3. Payload-driven module layout

| Path | Purpose |
|------|---------|
| `packages/shared/src/bitacora/types.ts` (or `apps/web/src/lib/bitacora/types.ts`) | TypeScript types mirroring **`payload`**, **`result`**, **`env`**; `device_id` as **string \| number** at edges, normalized in helpers |
| `.../normalize.ts` | `normalizeDeviceId`, `trimOrEmpty`, `isEffectivelyNaColor`, `parsePolicyDate` |
| `.../resolve.ts` | Prefer `result.result.data` vs `payload` when `success`; **conflict** detection for VIN/plates |
| `.../contacts.ts` | Dedupe reporter vs `emergency_contact`; missing emergency fallback |
| `fixtures/bitacora-canonical.json` | Exact copy of **`spec.md`** sample JSON for tests and Storybook |
| `apps/bff/src/routes/bitacora.get.ts` | Returns composite document (later: fetch upstream) |
| `apps/web/src/features/bitacora/HeaderSummary.tsx` | Maps §12 A |
| `apps/web/src/features/bitacora/VehicleDetails.tsx` | Maps §12 B |
| `apps/web/src/features/bitacora/ContactDirectory.tsx` | Maps §12 C |
| `apps/web/src/features/bitacora/StatusCards.tsx` | Maps §12 D |
| `apps/web/src/features/bitacora/AuditResultMetadata.tsx` | Maps §12 E |
| `apps/web/src/features/bitacora/LatestPosition.tsx` | Empty state only until §20 open question resolved |

---

## 4. Component breakdown

```
BitacoraPage
├── EmbedShell
├── HeaderSummary          ← payload.* header fields + env
├── VehicleDetails         ← payload vehicle + result.result.data
├── StatusCards            ← result.status, result.result.*
├── ContactDirectory       ← reporter, driver, emergency_contact
├── AuditResultMetadata    ← message, success, env
└── LatestPosition         ← empty / TBD enrichment
```

**Shared:** `ConflictBanner` (VIN/plates mismatch), `SectionSkeleton`, `EmptyState`, helpers from §10–11.

---

## 5. Data-fetching approach

1. Single **GET** (e.g. `/api/v1/bitacora` or by id) returning the **canonical object** until APIs split.
2. Client runs **pure functions** on response (same as unit tests) for display strings.
3. **Parallel** requests only if BFF later splits summary vs device vs geo.

---

## 6. Auth handling

Unchanged from prior plan: robust URL parse, memory/HttpOnly, Pegasus guard, no OAuth redirect, scoped logout—**`spec.md` §14** and `copy-vs-dont-copy.md`.

---

## 7. Monitoring approach

Tag client events with **`env`** when present. Per-section render success/failure. BFF: Pegasus validation cache hits/misses, 401 rate.

---

## 8. Documentation deliverables

| Doc | Must include |
|-----|----------------|
| CONTRIBUTING | How to run web + BFF; run **transform unit tests** |
| DEPLOYING | CSP, origins, secrets |
| security-iframe | Token flow |
| *(inline in CONTRIBUTING or README)* | Link to **canonical fixture** and **`spec.md` §9–12** as source of truth for fields |

---

## 9. Testing strategy

| Type | Scope |
|------|--------|
| **Unit** | **§10–11**: trim padded `vehicle_make`; `N/A` → “No especificado”; `device_id` number vs string equality; missing `emergency_contact`; duplicate reporter/emergency collapse; VIN conflict when `success` |
| **Component** | Each section with fixture + edge-case variants (conflict JSON, partial `result`) |
| **Integration** | BFF auth guard + mock Pegasus |
| **E2E** | Iframe + fixture API response |

**Fixture variants to add in repo (non-code spec):**

- `bitacora-canonical.json` (as in spec)
- `bitacora-payload-only.json` (missing `result`)
- `bitacora-vin-mismatch.json` (payload vs result differ)

---

## 10. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Type drift at API | Zod/io-ts on BFF response; narrow `device_id` at boundary |
| Silent wrong display | Unit tests for conflict + dedupe |
| Position forever empty | Product comms; optional phase-2 Pegasus device API via BFF only |

---

## 11. Explicit tradeoffs

| Tradeoff | Choice |
|----------|--------|
| Shared transforms BFF vs client | **Same pure functions** in shared package; BFF may pre-normalize for non-JS consumers later |
| Position section | **Ship empty** with explicit copy per §12 F |

---

## 12. TODO checklist (mapped to §1)

### Step 1 — Scaffold

- [ ] Monorepo; `apps/web`, `apps/bff`; optional `packages/shared` for types + transforms.
- [ ] CI: lint, typecheck, test, build.
- [ ] `.env.example`: `PEGASUS_SITE`, etc.

### Step 2 — Auth bootstrap

- [ ] Safe `access_token` (or confirmed name) parse.
- [ ] API client + interceptors; embedded-only message if no token.

### Step 3 — Backend token validation

- [ ] Pegasus `login?auth=` validation + cache; CORS allowlist.

### Step 4 — Iframe / CSP

- [ ] `frame-ancestors`; DEPLOYING dev notes.

### Step 5 — UI + mocked real shape

- [ ] Commit **`fixtures/bitacora-canonical.json`** matching **`spec.md`** JSON.
- [ ] Implement **§10–11** helpers + **100% path coverage** for canonical sample in unit tests.
- [ ] Build **HeaderSummary, VehicleDetails, ContactDirectory, StatusCards, AuditResultMetadata, LatestPosition (empty)**.
- [ ] `ConflictBanner` when VIN/plates mismatch per **§11**.

### Step 6 — Wire real data

- [ ] BFF endpoint returns canonical shape; wire SPA; remove only mock flag.

### Step 7 — Monitoring

- [ ] Client + server instrumentation; `env` tag.

### Step 8 — Docs

- [ ] CONTRIBUTING, DEPLOYING, security-iframe; reference **spec §9–12**.

### Step 9 — Rollout

- [ ] Staging iframe test; flag if needed.

---

## 13. What we are intentionally not copying from qualitas-installations

(See **`spec.md` §6** and `copy-vs-dont-copy.md`—unchanged list: no narrow regex, no default localStorage, no OAuth redirect, no missing CSP, no permissive CORS, no browser `?auth=` to Pegasus.)

---

## 14. Unknowns

| Unknown | Impact |
|---------|--------|
| Upstream API name for composite payload | BFF route contract |
| Position / device enrichment | `LatestPosition` phase 2 |
| Pegasus `access_token` confirmation | Client bootstrap |

---

**Awaiting review** of `spec.md` (v0.3) and this `plan.md` before implementation.
