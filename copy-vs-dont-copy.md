# Copy vs don’t copy: lessons from `qualitas-installations`

Use this when designing a **new** Pegasus-embedded app. Items are grounded in files under `qualitas-installations/` only.

---

## Patterns we should reuse (conceptually)

1. **Dedicated router hook for URL token**  
   Central place (e.g. Vue Router `beforeEach`) that detects a known query param (`access_token` here), writes token into app state, then continues—avoids scattering parsing across components.  
   *Source:* `client/src/router/index.ts`

2. **Server-side validation of the same token Pegasus issued**  
   API trusts `Authorization: Bearer` only after verifying with Pegasus (`GET ${PEGASUS_SITE}/api/login?auth=...`), plus short TTL caching to reduce load.  
   *Source:* `api/src/auth/auth.guard.ts`, `api/src/auth/auth.service.ts`

3. **Single HTTP client with interceptors**  
   One axios (or fetch wrapper) instance that attaches auth and maps auth failures to a controlled logout/session reset.  
   *Source:* `client/src/boot/axios.ts`

4. **Clear separation of “human Pegasus token” vs “server Pegasus service token”**  
   User session uses Bearer + `/api/login` validation; background jobs use `SERVER_PEG_AUTH` (or equivalent) for `?auth=` to Pegasus APIs.  
   *Source:* `auth.guard.ts` / `auth.service.ts` vs `qualitas.service.ts`, `pegasusManager.ts`

5. **Pinia (or equivalent) auth module with a `config`/`headers` getter**  
   Keeps `Authorization` construction in one place for the main API client.  
   *Source:* `client/src/stores/auth-store.ts`

6. **Monolith-friendly deploy**  
   Nest `ServeStaticModule` serving `client/dist/spa` keeps one deployment unit for API + static UI.  
   *Source:* `api/src/app.module.ts`

7. **Sentry wiring on the API**  
   Middleware + interceptor pattern for request-scoped error context.  
   *Source:* `api/src/app.module.ts`, `api/src/sentry/sentry.middleware.ts`

8. **Route `meta` for public paths**  
   `NotRequiresAuth` (and similar) keeps exceptions explicit.  
   *Source:* `client/src/router/routes.ts`, `client/src/router/index.ts`

---

## Patterns that are app-specific or should not be copied blindly

1. **Regex `access_token=([a-zA-Z0-9]+)`**  
   Too narrow for many real tokens; copying as-is risks silent auth failure. Prefer a safer parser or a Pegasus-documented format.

2. **`localStorage` for Pegasus user token**  
   Survives refresh and is readable to JS; XSS impact is higher than memory-only or HttpOnly cookie patterns. For a high-assurance embedded app, reassess storage strategy with security.

3. **`localStorage.clear()` on Support token expiry**  
   Wipes **all** keys (including technician session if both ever coexist in one tab). Scope clearing to the keys you own.

4. **Hardcoded Pegasus API host in a component**  
   `ReviewProcess.vue` uses `https://api.pegasusgateway.com/devices/...?auth=` instead of env-driven base URL—works but hurts environment parity and reviewability.

5. **Direct browser calls with `?auth=` to Pegasus**  
   Parallel to Bearer-to-installations-API; increases surface (query strings in logs, referrer). Prefer one consistent pattern after product/security sign-off.

6. **OAuth redirect (`OAUTH_URL`) as default unauthenticated path**  
   Right for a standalone-capable app; **wrong** if the new product mandate is **iframe-only / no second login** without that redirect—needs an explicit embedded bootstrap instead.

7. **No CSP / no `frame-ancestors`**  
   Acceptable only if the edge layer adds them; for iframe-only products, **do not** copy this absence—instrument headers in app or proxy.

8. **`app.enableCors()` with no explicit origin list**  
   Tighten for production APIs that should only accept known web origins.

9. **Mixed auth models on different controllers**  
   Pegasus Bearer guard vs HTTP Basic for Qualitas/Redesas is correct for **integrations** but confusing if copied wholesale into a small embedded app—keep one primary user auth path.

10. **Secrets and credentials in `docker-compose.yml`**  
    Treat as **anti-pattern** for reuse; use secrets manager / env injection, never commit real credentials (this file contains many).

11. **`api/todo.md` note (“authorization issues paused”)**  
    Signals historical incompleteness; don’t assume auth posture is finished.

---

## Unknowns that still require Pegasus / product confirmation

1. **Exact token format** for the new app (opaque vs JWT) and whether `access_token` remains the standard query name for embedded returns.

2. **Whether Pegasus `/api/login?auth=`** is the long-term contract for validating browser tokens, or if a different endpoint/JWKS flow is preferred.

3. **Iframe embedding policy** for the target host: allowed parent origins, sandbox attributes, and whether the parent passes context via `postMessage` in addition to URL params.

4. **CSP / `frame-ancestors`** values Pegasus or security will require for production—**not** derivable from this repo.

5. **Runtime branding API** (logo, colors, tenant) for in-app Quasar/React—this repo only passes branding **to the OAuth login URL**, not into the SPA.

6. **Whether the new app must refuse standalone OAuth** (no `window.location` to `auth.pegasusgateway.com`) and rely solely on URL token inside iframe—**product decision**, not implemented here.

7. **CORS** requirements when the SPA is served from a different origin than the API (this repo often implies same-origin static + API).

8. **Rate limits and caching semantics** on Pegasus validation calls—needed to size cache TTL and backoff.
