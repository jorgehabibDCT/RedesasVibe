# Contributing

## Prerequisites

- Node.js 20+
- npm 7+ (workspaces)

## Install

```bash
npm install
```

## Build shared package first

The BFF imports `@redesas-lite/shared` from compiled output (`packages/shared/dist`). Before running the BFF:

```bash
npm run build:shared
```

`npm run dev -w @redesas-lite/bff` from the repo root runs `predev` to build shared automatically.

## Run locally

```bash
# Terminal 1
npm run dev -w @redesas-lite/bff

# Terminal 2
npm run dev -w @redesas-lite/web
```

Load the app **with** a dev token (BFF requires `Authorization: Bearer`):

```text
http://localhost:5173/?access_token=local-dev-opaque-token
```

or `http://localhost:5173/?auth=local-dev-opaque-token` (same bootstrap; `access_token` wins if both are set).

Vite proxies `/api/*` to the BFF. **`GET /api/v1/bitacora`** is protected by **`requireAuthMiddleware`**. By default (**`BITACORA_DATA_MODE=fixture`** or unset) it returns the canonical fixture; set **`BITACORA_DATA_MODE=integration`** and **`BITACORA_UPSTREAM_BASE_URL`** to exercise real upstream normalization (see README). **`GET /health`** (liveness) and **`GET /ready`** (readiness, 200 vs 503) are unauthenticated—see README.

Set env vars from `.env.example` (e.g. **`PEGASUS_AUTH_DISABLED=true`** for local dev without Pegasus HTTP).

## Auth & fixtures

- **Fixture mode:** BFF reads `fixtures/bitacora-canonical.json` (or `FIXTURE_PATH`) **after** auth succeeds.
- **Integration mode:** BFF fetches upstream raw JSON, normalizes to the same canonical shape, then responds.
- **Query token:** `access_token` or `auth` is parsed safely (`access_token` preferred if both), stored **in memory only**, stripped from the URL when possible.
- **No** OAuth redirect; **no** default `localStorage` bearer storage.

## Tests

```bash
npm test
```

- **Shared:** pure bitácora helpers.
- **BFF:** Bearer extraction, `401` responses, Pegasus cache/classification, CORS/security headers, structured logging smoke, protected `/api/v1/bitacora` with **`PEGASUS_AUTH_DISABLED=true`** in Vitest env.
- **Web:** URL bootstrap, `fetch` Bearer + `401` handling, Bitácora page (standalone vs fixture).

## Production checklist (short)

See **README → Production readiness checklist**. In particular: set **`CORS_ORIGINS`** and **`FRAME_ANCESTORS`** for real hosts, disable **`PEGASUS_AUTH_DISABLED`** with a real **`PEGASUS_SITE`**, and terminate TLS (HSTS at edge). Do not log bearer tokens; rely on BFF structured logs + future Sentry wiring in `apps/bff/src/observability/sentryHooks.ts`.

## Code review checklist (informal)

- No narrow regex for tokens.
- No permissive CORS (`CORS_ORIGINS` must be explicit for production).
- No `?auth=` Pegasus calls from the browser.
- No secrets in the repo.
- No raw bearer tokens in logs.

## Formatting

```bash
npm run format
```

(Prettier at repo root.)
