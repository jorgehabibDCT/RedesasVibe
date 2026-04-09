# peg2 — embedded / external app shell (targeted findings)

Scope: `peg2/` frontend (AngularJS + webpack). Focus: how **legacy / embedded apps** and related URLs behave—not a repo tour.

---

## Launch / URL construction

### Primary pattern — “Applications” (`legacy_apps` + `embapp_url`)

- **Route / menu registration:** `apps/applications/applications.loader.coffee` — `pegasusProvider.add_app` registers `name: 'applications'`, `state: 'app.applications'`, `icon: 'apps'`; UI state `app.applications` at URL `applications`.
- **Data source:** `apps/applications/controllers/applications.ctrl.coffee` loads **`pegasus.api.get 'legacy_apps'`** into `pegasus.store 'legacy_apps'`. Per-app detail can use **`pegasus.api.get 'legacy_apps', app.id`** for `html_full`.
- **Launch UX:** `applications.pane.jade` — user clicks `load_app(app)` when `app.embapp_url.length` is truthy; opens fullscreen dialog.
- **URL finalization:** Same controller — after async **`sessions(app)`** (see Token passing), **`embapp_url = _.replace(app.embapp_url, "{{auth}}", token)`**, then **`$sce.trustAsResourceUrl(embapp_url)`** bound to iframe `ng-src` in `apps/applications/templates/iframe.jade`.
- **Verified (peg2 source only):** Only **`{{auth}}`** is substituted in `applications.ctrl.coffee`; **`{{pid}}` / `{{domain}}`** do **not** appear anywhere under `peg2/` (if those placeholders exist in stored URLs, they are not handled by this client).

### Secondary pattern — Reports “job_engine” iframe (`app_url` from manifest)

- **Where:** `apps/reports/reports.coffee` — `templateProvider` for `app.reports.create_report`: if `job_engine isnt "default"`, resolves `app_url` from report **manifest** `template.scripts[].app_url` and returns raw HTML string  
  `"<iframe src='#{app_url}' allowfullscreen style='width: 100%;height: 100%;'></iframe>"`  
  (*No* `{{auth}}` / `$sce` in this branch—different contract.)

### Tertiary — Tracking share link (token in query for **external** open)

- **Where:** `apps/tracking/components/share/sharelink.coffee` — after **`pegasus.api.post "user", "sessions", req_payload`**, builds  
  `site_url + "v2/?auth=" + response.data.token + "#!/app/tracking" + …`  
  So **query param name `auth`** is used for **deep-linking** into peg2, not only `{{auth}}` in `embapp_url`.

---

## Token passing

### Embedded apps: `{{auth}}` + `POST user/sessions`

- **Where:** `apps/applications/controllers/applications.ctrl.coffee`
  - **`sessions(app)`** runs only if `app.embapp_url.includes("{{auth}}")`.
  - Request: **`pegasus.api.post "user", "sessions", session`** with  
    `session = _.assign(origin: "pegapp", app: app.name)` (lodash `assign` to object literal).
  - Response: **`data.token`** → string replace into `embapp_url`.
- **Param name in embedded URL:** Whatever the **`embapp_url` template** contains; the **placeholder** Pegasus replaces is **`{{auth}}`**, not a fixed query key in code. In practice, templates often use a query like `?auth={{auth}}` (inferred from share-link pattern using `?auth=`—*partial inference*).

### API calls from the peg2 shell (not the iframe child)

- **Where:** `scripts/services/interceptor.coffee` — for requests to `pegasusConfig.server`, sets  
  **`config.headers.Authenticate = pegasusConfig.token`**  
  (i.e. **header name `Authenticate`**, **not** `Authorization: Bearer`).
- **Meta header:** If token present, appends **`&auth=<last 6 chars of token>`** to **`x-app-meta`** (debugging / correlation—not the full token).

### OAuth / storage (adjacent, not iframe embed)

- **Where:** `apps/main/controllers/oauth.ctrl.js` — `pegasusApi.set_token(token)` after OAuth callback params; `oauth_token` in `$localForage`.
- **Where:** `scripts/providers/config.coffee` — if `config.url_args.state` exists, **`localStorage.setItem('peg_bearer', config.url_args.state)`** (OAuth-style state handling).

### Token format assumptions

- *Verified in-controller:* Token is whatever **`POST user/sessions`** returns as **`data.token`** (opaque string); no JWT parsing in `applications.ctrl.coffee`.
- *Guess:* Backend aligns with Pegasus REST token model (opaque); **not** validated in peg2 source.

---

## Context passing

### In `POST user/sessions` for embedded app

- *Verified:* Payload includes **`origin: "pegapp"`** and **`app: app.name`** (app **name** string from legacy app record).

### Not passed in the reviewed embed path

- *Verified missing in `applications.ctrl.coffee`:* No explicit **site id**, **tenant**, **user id**, **groups**, **vehicles**, or **preferences** appended to `embapp_url` in this file—only **`{{auth}}`** substitution after session creation.

### User-application KV store (separate feature)

- **Where:** `scripts/services/user_app.coffee` — reads/writes **`pegasusApi.put "apps/#{user_data.app}?user=#{user_data.user}"`** with JSON `data`. Resolved via **`pegasusConfig.user_app_promise`** (`scripts/providers/config.coffee`, `scripts/providers/pegasus.coffee`). **Not** shown wired to iframe `src` in files reviewed.

### Session data prefetch elsewhere

- **Where:** `apps/main/main.coffee` (grep hit) — **`pegasus.api.get('user/sessions/data')`** — different flow from Applications embed; *not* traced into iframe URL here.

---

## App registry / enablement

- **API surface:** **`legacy_apps`** list/detail from peg2 API client (`applications.ctrl.coffee`).
- **Shell registry:** `scripts/providers/pegasus.coffee` — **`pegasusProvider.add_app` / `add_section`** builds in-memory menu (`_apps`, `_groups`). Applications module registers via `applications.loader.coffee`.
- **Per-feature:** `embapp_url` presence gates UI in `applications.pane.jade` (`ng-if="app.embapp_url.length"`).

---

## Iframe / communication behavior

### Applications embed

- **Where:** `apps/applications/templates/iframe.jade` —  
  **`iframe(ng-src="{{trusted_url}}" style="border:none;" flex)`**  
  inside fullscreen `md-dialog`. **No `sandbox` attribute** (*contrast with older Pegasus `extapps.html` which used `sandbox='allow-forms allow-scripts allow-same-origin'` in the archaeology of repo `pegasus`).

### Reports embed

- **Where:** `apps/reports/reports.coffee` — raw **`<iframe src='…'>`** string (not `ng-src` / `$sce`).

### postMessage

- **Where:** `scripts/service_worker/*.ts` — **Service Worker** `postMessage` to/from clients—**not** parent↔embedded-app iframe protocol for `legacy_apps`.

### CSP / frame-related config

- **Where:** `index.template.html` — **Content-Security-Policy `meta` is commented out** (example CSP block references `*.pegasusgateway.com`, `unsafe-inline`, etc.). **Not enforced** in the checked-in template as active policy.

---

## Branding / theming

- **Shell:** `index.template.html` — `body` uses `ng-class` with **`md-dark`** for dark theme; Material toolbar in `iframe.jade` uses **`md-colors` background `md-primary`** for dialog chrome—**Pegasus shell branding**, not passed into arbitrary `embapp_url`.
- **Assets:** `applications.ctrl.coffee` — **`load_asset_url`** uses  
  `"#{pegasusConfig.server}images/legacy_apps/#{app.id}/#{asset}"` for cover/thumbnail in grid.

---

## Differences vs older Pegasus (`pegasus` repo) findings

| Topic | Older `pegasus` (Django app market) | `peg2` (this tree) |
|--------|-------------------------------------|---------------------|
| Where `{{auth}}` is filled | Server-side in `appmarket/ajax.py` (`create_token` + string replace) | **Browser**: `POST user/sessions` then **`_.replace(..., "{{auth}}", token)`** in `applications.ctrl.coffee` |
| iframe sandbox | Present on `extapps.html` iframe | **No sandbox** on Applications dialog iframe (`iframe.jade`) |
| Token for shell API | N/A (server-rendered) | **`Authenticate` header** on XHR (`interceptor.coffee`) |
| Share / deep link | Not the focus there | **`v2/?auth=<token>`** in `sharelink.coffee` |

---

## Reusable takeaways for our app

1. **`embapp_url` + `{{auth}}`** remains the **string template** concept; **peg2** obtains the token via **`POST user/sessions`** with **`origin: "pegapp"`** and **`app: <legacy app name>`** before replace.
2. Pegasus2 **XHR** convention in this client is **`Authenticate: <token>`**, matching REST expectations from the main API layer—not **`Authorization: Bearer`** (unless a gateway translates).
3. **Deep links** in this codebase use **`?auth=`** for opening peg2 with a session token (`sharelink.coffee`); embedded templates may align with that or embed token in path per **`embapp_url`** authoring.
4. **iframe** in Applications has **no sandbox** in source—embedded apps should assume **full iframe defaults** unless deployment adds headers/CSP elsewhere.
5. **Reports** and **Applications** use **different** iframe strategies (`$sce` + `ng-src` vs raw `src` string)—do not assume one contract for all iframes.

---

## Verified vs guess / partial

| Statement | Status |
|-----------|--------|
| Applications embed uses `legacy_apps` + `{{auth}}` + `user/sessions` | **Verified** (`applications.ctrl.coffee`) |
| API uses `Authenticate` header | **Verified** (`interceptor.coffee`) |
| Share links use `?auth=` | **Verified** (`sharelink.coffee`) |
| `embapp_url` templates use `?auth=` for token | **Partial** (likely; not every template is in-repo) |
| Backend semantics of `POST user/sessions` | **Out of tree** (server not in `peg2`) |

---

## Outdated / contradictory in-tree

- **`sessions(app)`** returns nothing if `{{auth}}` missing, but **`load_app`** still runs **`_.replace(..., "{{auth}}", token)`** with **`undefined`** token—possible **bug** if `embapp_url` lacks `{{auth}}` but user opens app.
- **CSP commented** — production may inject headers at CDN; **don’t** treat `index.template.html` as final security posture.
