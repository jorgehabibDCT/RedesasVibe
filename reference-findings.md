# Reference findings: `qualitas-installations` (Pegasus-related patterns)

**Repo path:** `qualitas-installations/`  
**Purpose:** Extract reusable patterns for a new Pegasus-embedded app. This document is **not** a repo summary.

---

## 1. Where the Pegasus auth token is read from the URL

**Location:** `client/src/router/index.ts`

- **Parameter name:** `access_token` (checked via `to.fullPath.includes('access_token')`).
- **Extraction:** Regex `access_token=([a-zA-Z0-9]+)` on `to.fullPath`, then `result[1]` is used as the token.
- **Flow:** On match, the router sets `authStore.auth.token`, `authStore.auth.isSigned = true`, calls `authStore.saveAuth(UserTypes.Support)`, then `next({ name: 'index' })` (navigates to `/` without documenting a `replace` to strip the token from the address bar—behavior depends on Vue Router history and whether the token remains in history entries).

**Caveat:** The regex only allows `[a-zA-Z0-9]`. Tokens that include `.`, `-`, `_`, or other characters (e.g. JWT segments) may **not** match; this is an implementation detail to reassess when reusing the idea.

**Related env (OAuth redirect when not signed):** `client/.env.template` defines `OAUTH_URL` pointing at `https://auth.pegasusgateway.com/` with `response_type=token`, `redirect_uri=.../installations/`, `app=installations`, `client_id=installations`, etc.—that is the **standalone** login path, not the same as parsing `access_token` on the app’s own URL.

---

## 2. How auth is validated, exchanged, or stored

### Client (Support / Pegasus user session)

**Store:** `client/src/stores/auth-store.ts` (Pinia)

- State: `auth: { isSigned, token }` for **Support** (Pegasus flow) and separate `technician_auth` for technicians.
- **Persistence:** `localStorage` keys `support` and `technician` via `JSON.stringify(auth)`.
- **Getter `config`:** builds `Authorization: Bearer ${state.auth.token}` for the installations API.

**Technician path (different):** `client/src/pages/technician/TechnicianLogin.vue` posts to `auth/technician`; API returns `access_token` (JWT signed with `SECRET`), stored via `saveTechnicianAuth`—not Pegasus URL token.

### Server (Bearer token = Pegasus session token)

**Location:** `api/src/auth/auth.guard.ts` and `api/src/auth/auth.service.ts`

- **Guard:** Reads `Authorization: Bearer <token>` (`extractTokenFromHeader`).
- **Validation:** No local JWT verify for Pegasus users. Calls:
  - `GET ${process.env.PEGASUS_SITE}/api/login?auth=${token}` (via axios).
- **Cache:** On success, sets cache key `auth/${token}` for `TTL.FIVE_MIN` (`api/src/common/cache_constants.ts`: `300000` ms).
- **Failure:** `401` with `problem: 'token expired'` (Spanish user message), which the client axios interceptor treats as session end.

**`AuthService.validateTokenPegasus`:** Same Pegasus `GET .../api/login?auth=` pattern and cache.

**Server-to-Pegasus (service account):** `AuthService.loginPegasus()` returns `process.env.SERVER_PEG_AUTH` (opaque token). Used by backend code calling Pegasus APIs with `?auth=` (e.g. `api/src/qualitas/qualitas.service.ts`, `api/src/pegasus/pegasusManager.ts`)—**not** the end-user browser token.

---

## 3. How API requests attach auth

### Installations API (axios instance)

**Location:** `client/src/boot/axios.ts`

- `axios.create({ baseURL: process.env.MY_API })` where `MY_API` is wired from `SERVER` in `client/quasar.config.js` → `build.env`.
- **Request interceptor:** `config.headers.Authorization = auth.config.headers.Authorization` (Bearer token from Pinia).

**Response interceptor:** On axios error, if `error.response?.data?.problem === 'token expired'` → `auth.resetAuth()` (clears store, `localStorage.clear()`, redirects to `OAUTH_URL`). If `problem === 'jwt expired'` → `resetTechnicianAuth()`.

### Direct Pegasus HTTP API (browser)

**Example:** `client/src/components/details/ReviewProcess.vue` calls:

`https://api.pegasusgateway.com/devices/<id>?auth=${authStore.auth.token}`

So **some** client code uses **query parameter `auth=`** to `api.pegasusgateway.com`, not the installations API and not necessarily `Authorization` headers—parallel pattern to backend `PEGASUS_API` usage.

### Other API auth styles in the same repo (not Pegasus iframe user)

- **Qualitas integration:** `@UseGuards(AuthGuard('basic'))` with HTTP Basic (`auth-basic.strategy.ts` + env credentials).
- **Redesas webhook-style:** `@UseGuards(AuthGuard('redesas'))` with HTTP Basic and `REDESAS_QUALITAS_*` env (`auth-redesas.strategy.ts`).

These are **integration** guards, not the Support user Pegasus token flow.

---

## 4. How iframe embedding is allowed / configured

**Finding:** **No application-level configuration** found for iframe embedding.

- `client/index.html` has no `Content-Security-Policy` or `frame-ancestors`.
- `api/src/main.ts` does not set `helmet()` or custom `X-Frame-Options` / CSP.
- Grep across the repo did not find `iframe`, `frame-ancestors`, or `X-Frame-Options` in app source (only unrelated mentions in lockfiles / Quasar docs comments).

**Implication:** Embedding policy, if any, is likely enforced **outside** this codebase (reverse proxy, CDN, or host defaults)—not documented here.

---

## 5. Standalone access: blocked or degraded?

**Finding:** **Not blocked** for the main Support flow.

- `client/src/router/index.ts`: If the route is not public and `access_token` is not present and `!authStore.auth.isSigned`, the app sets `window.location.href = process.env.OAUTH_URL`—a **full redirect** to Pegasus OAuth (`response_type=token` in `.env.template`).
- So users can open the app **outside** an iframe and still authenticate via OAuth redirect (subject to Pegasus auth configuration).

There is **no** check for `window.parent !== window` or `Sec-Fetch-Dest` to restrict usage to iframe-only.

---

## 6. CSP, `frame-ancestors`, `X-Frame-Options`, HTTPS, env config

| Topic | Finding |
|--------|---------|
| **CSP** | Not set in `client/index.html` or Nest `main.ts`. |
| **frame-ancestors** | Not present in repo. |
| **X-Frame-Options** | Not set in app code. |
| **HTTPS** | Production-oriented URLs in `client/.env.template` and `docker-compose.yml` use `https://` for Pegasus hosts, API, sockets. **Local dev:** `client/quasar.config.js` `devServer.https` is commented (`// https: true`). |
| **CORS** | `app.enableCors()` in `api/src/main.ts` (default permissive behavior unless configured elsewhere). |
| **Env → client** | `client/quasar.config.js` maps `SERVER` → `MY_API`, `OAUTH_URL`, `MY_SOCKET`, `SOCKET_PATH` into Quasar `build.env`. |
| **Env → API** | `PEGASUS_SITE`, `PEGASUS_API`, `SERVER_PEG_AUTH`, `MONGO_URL`, `SENTRY_DSN`, etc. (see `docker-compose.yml`). |

---

## 7. Site branding / theme loading

**Pegasus login branding (redirect only):** `client/.env.template` `OAUTH_URL` includes query parameters such as `auth_logo`, `auth_header` (e.g. Fleet Metriks)—these customize the **auth host’s** login page, not the Quasar app’s runtime theme.

**Quasar UI:** `client/quasar.config.js` has `framework: { config: {} }`—no dynamic theme from Pegasus in-app.

**Global CSS:** `client/src/css/app.scss` is effectively empty (comment only).

**Conclusion:** This repo does **not** implement “load theme from Pegasus/app context” inside the SPA; branding for embedded chrome would need a **new** mechanism.

---

## 8. App structure worth copying for a new embedded app

| Area | Pattern |
|------|---------|
| **Monorepo layout** | `client/` (Quasar Vue 3) + `api/` (NestJS) in one tree; `api` can **serve** the built SPA via `ServeStaticModule` (`api/src/app.module.ts` → `client/dist/spa`). |
| **Router auth gate** | Central `beforeEach` in `client/src/router/index.ts` for token capture and redirect-to-OAuth. |
| **State** | Pinia store dedicated to auth (`client/src/stores/auth-store.ts`) with getters for default headers. |
| **HTTP client** | Single axios instance + interceptors in `client/src/boot/axios.ts` (registered in Quasar `boot` array). |
| **API protection** | Nest `AuthGuard` validating Pegasus token server-side via `PEGASUS_SITE` + cache (`api/src/auth/auth.guard.ts`). |
| **Observability** | Sentry: `SentryModule`, global interceptor, `SentryMiddleware` on all routes (`api/src/app.module.ts`, `api/src/sentry/sentry.middleware.ts`). |
| **Public routes** | Route `meta.NotRequiresAuth` (e.g. technician login) checked in router guard. |

---

## Quick file index (Pegasus user path)

| File | Role |
|------|------|
| `client/src/router/index.ts` | Reads `access_token`, OAuth redirect |
| `client/src/stores/auth-store.ts` | Bearer token, `localStorage` |
| `client/src/boot/axios.ts` | Attach Bearer, handle `token expired` |
| `client/.env.template` | `SERVER`, `OAUTH_URL` |
| `client/quasar.config.js` | `publicPath`, env injection |
| `api/src/auth/auth.guard.ts` | Validate via Pegasus `/api/login?auth=` |
| `api/src/auth/auth.service.ts` | Same validation + technician JWT |
| `api/src/main.ts` | CORS, global prefix `api/v1`, no security headers |
| `api/src/app.module.ts` | Static SPA + Sentry |
