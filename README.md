# Bitácora de Siniestro REDESAS LITE (monorepo)

Fixture-driven prototype: **React** SPA + **Express** BFF + **`@redesas-lite/shared`** pure helpers.  
Source of truth: `spec.md` v0.3, `plan.md`, `reference-findings.md`, `copy-vs-dont-copy.md`.

## Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Web** | React 18 + TypeScript + Vite 6 | Fast dev, simple SPA for iframe embedding |
| **BFF** | Express 4 + TypeScript + `tsx` | Minimal HTTP surface; Pegasus-ready auth middleware |
| **Shared** | TypeScript package, Vitest | One place for transform logic + tests (spec §10–11) |
| **Tests** | Vitest | Shared + BFF + web (helpers, auth integration, UI smoke) |

## Auth flow (current)

1. **Optional** `access_token` in the query string (Pegasus / parent may append it when loading the iframe).
2. The **SPA** parses it with `URLSearchParams` (no narrow regex), keeps the token **only in memory**, and **strips** `access_token` from the URL via `history.replaceState` when present.
3. Every **`GET /api/v1/bitacora`** request sends **`Authorization: Bearer <opaque token>`**.
4. The **BFF** runs **`requireAuthMiddleware`**: extracts Bearer, validates **opaque token shape**, then calls **`validatePegasusSession`** in `pegasusAuth.service.ts`.
5. **What is real vs stubbed today**
   - **Real:** Bearer extraction, shape checks, structured **`401`** JSON with `{ message, problem }` (stable codes: `missing_token`, `malformed_auth_header`, `invalid_token`, `token_expired`, `auth_unavailable`), **bounded Pegasus validation cache** (SHA-256 keyed; configurable TTLs), explicit **CORS** allowlist, production-oriented **security headers** (see Phase 4 below).
   - **Stubbed / dev:** With **`PEGASUS_AUTH_DISABLED=true`** (default in `.env.example`), the BFF **does not** call Pegasus HTTP. Set **`PEGASUS_AUTH_DISABLED=false`** and **`PEGASUS_SITE`** to enable **`GET ${PEGASUS_SITE}/api/login?auth=`** with timeout and HTTP status mapping (`pegasusAuth.service.ts`).
6. **Without a token**, the SPA shows a **standalone / degraded** message (`EmbedStandalone`) and **does not** call the BFF. This is UX only; enforcement is **BFF validation + CSP** where deployed.
7. **401 from BFF:** the client **clears** the in-memory token and surfaces the error (aligned with qualitas-style `problem` handling).

**No** OAuth redirect, **no** `localStorage` for the bearer token, **no** browser calls to Pegasus with `?auth=`.

## CSP / `frame-ancestors` (where headers apply)

| Layer | Role |
|-------|------|
| **BFF** (`securityHeadersMiddleware`) | Baseline headers (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`). If **`FRAME_ANCESTORS`** is set, adds `Content-Security-Policy: frame-ancestors …`. Optional **HSTS** only when **`ENABLE_HSTS_HEADER=true`** and **`HSTS_MAX_AGE`** is set — use only when the BFF is always served over HTTPS (often better to terminate TLS and set HSTS at the **edge**). |
| **CDN / reverse proxy / static host** | **Must** set `Content-Security-Policy: frame-ancestors …` (and typically **HSTS**) on responses that serve **`index.html`**. The SPA shell is what gets embedded; API JSON responses are not a substitute. |
| **Vite dev** | Optional: mirror headers via `server.headers` in `vite.config.ts` for parity (not required for API proxy). |

CSP alone does not authenticate users; pair with Bearer validation. **Do not** rely on client-side checks to “enforce” embedding; keep policy **server/edge-based**.

## Phase 4 — Auth hardening, security, observability

### Pegasus HTTP validation

- **Bypass:** `PEGASUS_AUTH_DISABLED=true` — no HTTP call (local/dev only).
- **Live:** `PEGASUS_AUTH_DISABLED=false`, **`PEGASUS_SITE`** set — `GET ${PEGASUS_SITE}/api/login?auth=` with **`PEGASUS_FETCH_TIMEOUT_MS`** (default 10s).
- **Classification (stable `problem` codes):** `401` → `token_expired`; `403` → `invalid_token`; other **4xx** → `invalid_token`; **5xx** / network / timeout → `auth_unavailable`. Missing **`PEGASUS_SITE`** when auth is required → `auth_unavailable`.
- **Cache:** SHA-256 key per token, LRU bounded by **`PEGASUS_AUTH_CACHE_MAX_ENTRIES`**. TTL: success **`PEGASUS_AUTH_CACHE_TTL_MS`**; negative validation **`PEGASUS_AUTH_CACHE_NEGATIVE_TTL_MS`**; transient failures **`PEGASUS_AUTH_CACHE_UNAVAILABLE_TTL_MS`**. Disable with **`PEGASUS_AUTH_CACHE_ENABLED=false`**.

### CORS

- **`CORS_ORIGINS`** — comma-separated browser origins. **Unset** defaults to `http://localhost:5173`. **Explicit empty** (`CORS_ORIGINS=`) denies any browser `Origin` (non-browser clients without `Origin` still work). Disallowed origins receive **`403`** `{ error: 'cors_forbidden' }`.

### Observability (BFF)

- **Request:** JSON lines with `event: request_complete`, `requestId` (from **`X-Request-Id`** or generated), method, path, status, `durationMs`. **Never** logs raw bearer tokens.
- **Auth:** `event: auth_failure` with `problem` (and `path` / `requestId`).
- **Upstream:** `event: upstream_failure` for bitácora integration errors.
- **Future Sentry/APM:** `captureExceptionForObservability` / `captureMessageForObservability` in `observability/sentryHooks.ts` (no-op unless **`OBSERVABILITY_CAPTURE_EXCEPTIONS`** / **`OBSERVABILITY_CAPTURE_MESSAGES`** are enabled for stub logging). Wire **`@sentry/node`** there when ready.

### Web client analytics (later)

Product analytics or client-side error reporting (e.g. browser SDK) would plug into **`apps/web`** (e.g. bootstrapped after load), **not** the BFF token path. Keep PII and tokens out of analytics payloads.

### Health and readiness (BFF)

| Endpoint | Purpose | HTTP |
|----------|---------|------|
| **`GET /health`** | **Liveness:** process is up and responding. Use for “is the Node process running?” (e.g. simple load-balancer ping). Does **not** validate Pegasus or bitácora configuration. | **200** — `{ "ok": true, "service": "redesas-lite-bff" }` |
| **`GET /ready`** | **Readiness:** configuration is coherent for this service (auth mode, Pegasus when HTTP auth is on, bitácora fixture vs integration). **No** secrets, URLs, or raw env values are returned—only booleans, modes, and opaque **reason** codes. | **200** if `status` is `ready`; **503** if `status` is `not_ready` |

**How to interpret `200` vs `503` on `/ready`**

- **200:** All checks passed; the pod/instance may receive traffic for **staging/prod readiness gates** (pair with `/health` and app-level checks).
- **503:** At least one check failed—see `checks.*.status` and optional `reason` (`pegasus_site_unset`, `upstream_base_url_unset`, `fixture_unreadable`). Fix configuration or mounted volumes; do **not** treat as “auth failure” for end users (this route is unauthenticated).

**Checks (summary)**

- **`process`** — always `ok` if the handler runs.
- **`pegasusAuth`** — `bypass` when `PEGASUS_AUTH_DISABLED=true`; otherwise `pegasus_http` requires **`PEGASUS_SITE`** to be set (non-empty).
- **`bitacoraData`** — `fixture` mode requires the canonical fixture file to be readable at the resolved path (default under the monorepo `fixtures/`); `integration` requires **`BITACORA_UPSTREAM_BASE_URL`**.

## Quick start

From repo root:

```bash
npm install
npm run build:shared   # required before BFF can resolve @redesas-lite/shared
```

Copy `.env.example` to `.env` (optional) or export variables. For local dev, keep **`PEGASUS_AUTH_DISABLED=true`**.

**Terminal 1 — BFF**

```bash
npm run dev -w @redesas-lite/bff
```

**Terminal 2 — Web** (proxies `/api` → `http://localhost:3000`)

```bash
npm run dev -w @redesas-lite/web
```

Open:

```text
http://localhost:5173/?access_token=local-dev-opaque-token
```

Without `access_token`, you will see the **standalone** message. With a token, **`GET /api/v1/bitacora`** returns the canonical bitácora document (fixture or normalized upstream, depending on **`BITACORA_DATA_MODE`** — see below).

## Demo runbook

Use this path for a **stable live demo** (predictable data, no Pegasus dependency).

| Item | Recommendation |
|------|------------------|
| **Mode** | **Fixture** — `BITACORA_DATA_MODE=fixture` or unset (default). Ensures `fixtures/bitacora-canonical.json` is served after auth. |
| **Auth for local demo** | **`PEGASUS_AUTH_DISABLED=true`** (default in `.env.example`) so the BFF does not call Pegasus HTTP. Still send a **non-empty** opaque token from the browser (`access_token`) so the SPA and BFF follow the same code path as production. |
| **URL** | **`http://localhost:5173/?access_token=demo-local-token`** (or any opaque string; not validated against Pegasus when auth is disabled). |

**Commands (two terminals from repo root, after `npm install` and `npm run build:shared`):**

```bash
# Terminal 1 — BFF with fixture + auth bypass (explicit env; same as npm run demo:bff)
BITACORA_DATA_MODE=fixture PEGASUS_AUTH_DISABLED=true npm run dev -w @redesas-lite/bff
```

```bash
# Terminal 2 — web (proxies /api → BFF)
npm run demo:web
# or: npm run dev -w @redesas-lite/web
```

Shortcut: **`npm run demo:bff`** in terminal 1 and **`npm run demo:web`** in terminal 2 (see root `package.json`).

**Backup if auth or integration misbehaves:** keep **`PEGASUS_AUTH_DISABLED=true`** and **`BITACORA_DATA_MODE=fixture`**; confirm **`GET /ready`** returns **200** (fixture readable). If the upstream is misconfigured but you only need the UI, avoid **`BITACORA_DATA_MODE=integration`** for the demo.

**Intentionally not demoed in this prototype:** live Pegasus token validation, upstream bitácora integration, **última posición** / map (empty state by design per spec), OAuth redirects, and production CSP/HSTS at the edge.

## Bitácora data: fixture, database, or integration (Phase 3)

The SPA always consumes the **same** JSON shape (`BitacoraDocument` in `@redesas-lite/shared`, aligned with `spec.md` v0.3). Only the BFF may call upstream systems; the browser does **not** call Pegasus or business APIs for bitácora data.

| Mode | Env | Behavior |
|------|-----|----------|
| **Fixture** | `BITACORA_DATA_MODE=fixture` or unset | After auth, the BFF reads `fixtures/bitacora-canonical.json` (or `FIXTURE_PATH`) and returns it as JSON. |
| **Database** | `BITACORA_DATA_MODE=db` + **`DATABASE_URL`** | After auth, the BFF reads **`bitacora_cases`**. Optional **`GET /api/v1/bitacora?policy_incident=...`**; omit to use the most recently updated row. **`GET /api/v1/bitacora/cases`** returns a compact list for the in-app case switcher (search + dropdown). See **`docs/bitacora-db.md`**. |
| **Integration** | `BITACORA_DATA_MODE=integration` | After auth, the BFF `GET`s **`BITACORA_UPSTREAM_BASE_URL` + `BITACORA_UPSTREAM_PATH`** (default path `/api/v1/bitacora/raw`), forwards **`Authorization`**, maps the raw body to the canonical shape in `mapUpstreamToCanonical`, and returns that. |

**Case switcher (db mode):** With **`BITACORA_DATA_MODE=db`** and imported rows, the SPA shows a **Buscar expediente** field and **Casos recientes** dropdown. Choosing a row sets **`policy_incident`** in the URL and reloads the detail. In **fixture** mode the list is empty and the hint explains that no DB rows are available.

**Optional dev fallback:** `BITACORA_FIXTURE_ON_UPSTREAM_ERROR=true` uses the canonical fixture when the upstream request fails (useful when the upstream is down locally).

**Errors (integration):** upstream HTTP/network issues → **`502`** with `{ error: 'upstream_unavailable', message }`. Malformed body that cannot be normalized → **`502`** with `{ error: 'upstream_invalid', message }`.

**Geolocation (deferred):** any future enrichment (e.g. resolve coordinates to an address) belongs **in the BFF** after raw fetch and before or inside normalization — e.g. extend `mapUpstreamToCanonical` or a small enrichment step that mutates the canonical payload. Do **not** add Pegasus or upstream business calls from the browser.

Required env when using integration mode: **`BITACORA_UPSTREAM_BASE_URL`**. See `.env.example` for all `BITACORA_*` variables.

## Commands

| Command | Description |
|---------|-------------|
| `npm run build:shared` | Compile `packages/shared` |
| `npm test` | Vitest: shared + BFF auth + web |
| `npm run build -w @redesas-lite/web` | Production build of SPA |
| `npm run build -w @redesas-lite/bff` | Compile BFF to `dist/` |

## Vercel: frontend only (`apps/web`)

The BFF is **not** deployed with this app. The SPA is built as a static Vite bundle and calls a **public** BFF base URL at runtime (browser `fetch`).

### Environment variable (browser)

| Variable | Required | Purpose |
|----------|----------|---------|
| **`VITE_API_BASE_URL`** | **Yes** for preview/production on Vercel | Public HTTPS origin of the hosted BFF (scheme + host, **no** trailing slash, **no** `/api` suffix). Example: `https://bff.example.com`. Inlined at **build** time. |

**Do not** prefix BFF-only secrets with `VITE_` — only values that must be visible to the browser belong here. The session token still comes from **`access_token`** in the URL (then memory); that flow is unchanged.

### Local development (unchanged)

- Leave **`VITE_API_BASE_URL`** unset (or empty). The SPA uses same-origin paths such as **`/api/v1/bitacora`**, and the Vite dev server **proxies** `/api` to **`http://localhost:3000`** (see `apps/web/vite.config.ts`).
- Query parameters **`access_token`**, **`policy_incident`**, etc. behave the same locally and when deployed.

### Vercel preview and production

1. Create a Vercel project with **Root Directory** **`apps/web`** (see below).
2. Set **`VITE_API_BASE_URL`** per environment (Preview can point at a staging BFF, Production at prod):

   ```text
   VITE_API_BASE_URL=https://your-bff-host.example.com
   ```

3. On the **BFF**, allow the Vercel origin in **`CORS_ORIGINS`** (e.g. `https://your-app.vercel.app` and your custom domain). The browser sends **`Authorization: Bearer …`** on API calls; CORS must permit that header from your SPA origin.

### Build settings (monorepo)

With **Root Directory** = **`apps/web`**, install and build must run from the **repository root** so **`npm install`** links workspaces and **`@redesas-lite/shared`** is built first. **`apps/web/vercel.json`** encodes:

- **Install:** `cd ../.. && npm install`
- **Build:** `cd ../.. && npm run build:shared && npm run build -w @redesas-lite/web`
- **Output:** `dist` (relative to `apps/web`)

SPA **fallback:** all routes rewrite to **`index.html`** so client-side routing keeps working on refresh.

**Alternative:** Root Directory = **repository root**, **Build Command** `npm run build:shared && npm run build -w @redesas-lite/web`, **Output Directory** **`apps/web/dist`** — set in the Vercel dashboard if you prefer a single root-level project.

See also **`apps/web/.env.example`**.

## Environment

See `.env.example` (auth, Pegasus cache, CORS, security headers, observability stubs, **`BITACORA_*`**). Do not commit secrets.

## Bitácora database (optional ingest)

PostgreSQL schema and **`POST /api/v1/bitacora/ingest`** are documented in [`docs/bitacora-db.md`](docs/bitacora-db.md). **`GET /api/v1/bitacora`** is unchanged and does not read from the database.

## Fixtures

- `fixtures/bitacora-canonical.json` — matches `spec.md` canonical JSON exactly.
- Other fixtures — edge cases for shared helper tests.

## Production readiness checklist

- **Web (Vercel / static host):** Set **`VITE_API_BASE_URL`** to the public BFF origin at build time; without it, production bundles use same-origin **`/api/...`** (fine for local Vite proxy only).
- **Pegasus:** `PEGASUS_AUTH_DISABLED=false`, **`PEGASUS_SITE`**, tune cache/TTL env vars; verify **`GET …/api/login?auth=`** in staging under load.
- **CORS:** Set **`CORS_ORIGINS`** on the BFF to exact production web origins (not `*`), including the Vercel preview/prod URLs if the SPA is hosted there.
- **Embed policy:** **`FRAME_ANCESTORS`** on the BFF **and** on the static host serving **`index.html`**.
- **TLS:** Terminate HTTPS at the load balancer / CDN; set **HSTS** at the edge (BFF HSTS is optional via **`ENABLE_HSTS_HEADER`**).
- **Observability:** Ship structured logs to your aggregator; add Sentry/APM via `observability/sentryHooks.ts` and alert on `auth_failure` / `upstream_failure` rates.
- **Secrets:** No tokens in logs; rotate credentials per org policy.

## What remains before a real production deployment

- Live Pegasus SLO validation, rate limits, and optional mutual TLS between BFF and Pegasus if required.
- Full **Sentry** (or similar) wiring—not only stubs.
- **Metrics** (Prometheus / Datadog) derived from log volume or explicit counters.
- **Web** CDN headers for CSP/HSTS on static assets; optional client-side analytics SDK.
- Geolocation enrichment (BFF), full ESLint rollout.

See `CONTRIBUTING.md` for contributor-focused notes.
