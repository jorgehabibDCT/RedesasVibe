# Research: Bitácora de Siniestro REDESAS LITE (Pegasus-embedded prototype)

**Research date:** 2026-04-06  
**Workspace:** `/Users/jorgehabib/proto`  
**Status:** **No application codebase present in this workspace.** Findings below separate **verified facts** (filesystem) from **requirements** (user brief) and **unknowns** (cannot be resolved without source, APIs, or Pegasus integration docs).

---

## 1. Executive summary

The repository directory is **empty** (no `package.json`, no source files, no routes, no docs). Therefore:

- There is **no** deep codebase reading possible for routing, auth, APIs, or iframe behavior.
- All architecture answers for “current app structure,” “existing patterns,” and “real file paths” are **gaps** until code (or another repo path) is added.
- This document records **what must be discovered** when a real codebase exists, and **constraints** already stated for the feature.

---

## 2. Verified: current repository state

| Check | Result |
|--------|--------|
| List workspace root | Only `.` / `..` — no files |
| Search for Pegasus / iframe / token | No matches (no files to search) |
| Search for REDESAS / bitácora | No matches |

**Conclusion:** Phase 1 “deep read” of *this* codebase yields **zero** implementation-specific patterns.

---

## 3. Where this page should live (intended — not verifiable here)

**Expected (typical SPA):** A dedicated route (e.g. `/bitacora-siniestro` or `/redesas-lite/...`) mounted under the app router, with a layout that supports embedded-only access and token bootstrap.

**Research finding:** **Unknown** — no router, framework, or `src/` tree exists in workspace.

**When code exists, locate:**

- Entry (`main.tsx` / `index.tsx`), router config (React Router, Next.js `app/`, Vue router, etc.).
- Feature folders (`features/`, `pages/`, `routes/`).
- Any existing “embedded” or “external” pages.

---

## 4. Iframe embedding — how it works today

**Finding:** **Not applicable in this repo** — no HTML shell, no `X-Frame-Options` / CSP `frame-ancestors`, no `postMessage` handlers, no parent-origin allowlists.

**Industry patterns to validate when implementing:**

- **HTTP headers:** `Content-Security-Policy: frame-ancestors https://pegasus-host...` (or equivalent) so only Pegasus can frame the app.
- **Reverse proxy / gateway:** Same-origin or trusted embedding; avoid opening the app in a new tab without token if “iframe-only” is required (may need **referrer + token + short session** — see security section in spec).

**Gap:** Actual Pegasus parent URL(s), sandbox attributes, and whether Pegasus uses `postMessage` for resize/theme must come from **Pegasus team / integration guide**.

---

## 5. Pegasus auth token from URL — read / validate / use

**Finding:** **No code** — no query-param parsing (`?token=`), hash fragments, `sessionStorage` bootstrap, or JWT validation.

**What to discover in a real codebase:**

| Topic | What to search for |
|--------|---------------------|
| Token param name | `URLSearchParams`, `useSearchParams`, route loaders |
| Validation | JWT verify (library + secret/JWKS), opaque token exchange |
| Storage | memory-only vs `sessionStorage` (security tradeoff) |
| API attachment | `Authorization` header, `fetch` interceptors, Apollo links |

**Gap:** Whether the token is JWT, opaque, or exchanged server-side is **unknown**.

---

## 6. User context (units, preferences, groups, resources)

**Finding:** **No** user store, context providers, or Pegasus profile types in workspace.

**What to discover:**

- Global auth/context module (React Context, Zustand, Redux, etc.).
- API endpoints that return entitlements and preferences.
- Whether “units” map to organizational hierarchy for REDESAS LITE.

**Gap:** Field names and APIs are **unknown** until backend/Pegasus contracts exist.

---

## 7. API client patterns

**Finding:** **None** — no `fetch` wrapper, axios instance, React Query, tRPC, or OpenAPI client.

**When code exists, document:**

- Base URL configuration (env vars).
- Error normalization, retries, idempotency.
- Auth header injection.

---

## 8. Theming / branding

**Finding:** **None** — no design tokens, CSS variables, MUI/Chakra theme, or Tailwind config.

**Optional requirement (user brief):** Load theme from Pegasus/app context when available — **not researchable** here.

---

## 9. Routes, pages, layouts, components

**Finding:** **None.**

**Imitation target (once scaffold exists):** Match existing page shell: app chrome vs minimal chrome for iframe, typography, spacing, table patterns, card patterns.

---

## 10. Monitoring / logging / analytics

**Finding:** **None** — no OpenTelemetry, Sentry, Datadog, `analytics.track`, or structured logging.

**What to add (spec/plan):** Client + server health, usage counters, error rates for this route — **greenfield** in this workspace.

---

## 11. Deployment / docs / contributing

**Finding:** **None** — no CI, Dockerfile, `CONTRIBUTING.md`, or deploy runbooks.

**User requirement:** Contributing guide and deploying guide are **deliverables** (to be created with the repo).

---

## 12. Security controls relevant to iframe-only access

**Not verifiable in repo.** Design considerations (to carry into spec):

- **frame-ancestors** (or legacy `X-Frame-Options` where still used) aligned with Pegasus origin(s).
- **Token in URL:** high leakage risk (logs, Referer); prefer **one-time exchange** to session cookie on first load inside iframe, or **short-lived token** + strict referrer checks — **product/security decision**.
- **Deep-link blocking:** If the same URL must not work outside iframe, combine CSP embedding, optional `Sec-Fetch-Dest` / `Sec-Fetch-Site` checks server-side, and session binding to embedding context (see open questions).

---

## 13. Forwarder: needed or not?

**Definition:** A server or edge “forwarder” that proxies API calls or rewrites paths between Pegasus and backend services.

**Research finding:** No evidence either way — **no APIs in repo**.

**When a forwarder might be justified:**

- Browser cannot call backend directly (CORS, mTLS, IP allowlists).
- Centralized auth translation at the edge.
- Audit logging of all API access in one place.

**Why to avoid unless necessary (per user brief):**

- Extra latency, failure domain, and operational cost.
- Harder local dev and testing.
- Duplication of security logic if not carefully bounded.

**Default recommendation (conceptual):** Prefer **direct browser → BFF/API** with proper CORS and token validation; introduce a forwarder only if **constraints prove** direct access is infeasible.

---

## 14. Gaps, risks, unknowns, assumptions

### Gaps (must close before build)

1. **Actual codebase** (framework, monorepo layout, existing Pegasus hooks if any).
2. **Backend APIs** for claim summary, status, geolocation, contacts, audit table — OpenAPI or examples.
3. **Pegasus integration contract:** token format, validation endpoint, user context payload, theme payload.
4. **Mockup / design asset** (“attached/mockup”) — not present in workspace; UI details are assumption-driven until provided.
5. **Identity of “source systems”** per field (core insurance system vs REDESAS vs messaging).

### Risks

- **Token-in-URL** exposure and logging.
- **Iframe-only** policy may conflict with “open in new tab” debugging unless gated environments exist.
- **Data volume** for audit/evidence table without pagination/streaming.

### Assumptions (documented in spec; validate)

- A single repo will contain app + minimal server/BFF if needed.
- HTTPS everywhere in production.
- Product and engineering share a named channel (process — not code).

---

## 15. Research deliverable conclusion

**This workspace does not contain an application to analyze.** `research.md` therefore **cannot** name real routes, modules, or files beyond stating they are absent.

**Next step for research (blocking implementation):** Point this effort at the **real repository** (or import scaffold), then re-run Phase 1 against:

- Router and layout files  
- Auth and token handling  
- API layer and env config  
- Security headers and CSP  
- CI/CD and observability  

Until then, **`spec.md`** and **`plan.md`** define the feature using **stated constraints** and **explicit TBD** backend paths.
