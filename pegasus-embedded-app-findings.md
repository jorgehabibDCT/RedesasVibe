# Pegasus embedded / external app integration — targeted findings

> Note: this is historical source-code analysis. Current live evidence for this app's launch contract indicates Pegasus custom apps append the token as `access_token` (`include_token: true`, `token_name: "access_token"`). Prefer the operational contract documented in `README.md`.

Scope: patterns in the copied `pegasus/` tree relevant to **embedding third-party web UIs** (iframe / external URLs) and related auth. Not a repo overview.

**Legend:** *Verified* = directly supported by file contents below. *Guess* = plausible but not proven in-tree. *Partial* = code suggests behavior but wiring or usage is incomplete/outdated.

---

## App launch / URL construction

### Pattern A — App Market “external apps” + iframe (`embapp_url`)

- **Where the shell loads:** Django view `extapps` in `src/apps/appmarket/views.py` renders `./apps/appmarket/extapps.html` (requires login, checks `GetUser`, passes `looks`, `uid`, `user_prefs`, etc.).
- **Where the iframe is defined:** `src/templates/apps/appmarket/extapps.html` — `<iframe id='eapp_iframe' …>` (see **Iframe / embedding** below).
- **Where the URL is applied:** `src/static/js/apps/appmarket/extapps.js`, function `open(app_id, url)` — `$('#eapp_iframe').attr('src', url)`. User must confirm loading (`window.confirm`).
- **Where the URL string is built (server):** `src/apps/appmarket/ajax.py`
  - **`loadEAppsSelector`:** For each installed app with `definition.embapp_url`, builds `url` from `app_ins.definition.embapp_url` and replaces:
    - `{{pid}}` → numeric site id from `settings.PEGASUS_SITE_ID` (parsed via `"pegasus".replace` pattern; failures → `0`)
    - `{{domain}}` → `Site.objects.latest('id').domain`
    - *Does not* call `auth.create_token` or replace `{{auth}}` here (see **Token passing** — *inconsistency*).
  - **`getDetail`** with `view == 'extapps'`: same `{{pid}}` / `{{domain}}`, **and** replaces `{{auth}}` using `rest.core.auth.create_token` (see **Token passing**).

### Pattern B — URL template stored on the app definition

- **Model field:** `src/apps/appmarket/models.py` — `AppDefinition.embapp_url` (`TextField`, nullable). This is the **authoring surface** for “where the embedded app lives” (full URL template with placeholders).

### Pattern C — JProxy (programmatic API bridge, not iframe launch)

- **Not iframe embedding:** `src/apps/jproxy/` — server-side proxy + `jproxy.js` client SDK (`src/templates/apps/jproxy/jproxy.js`) for **remote callers** to obtain tokens and call Pegasus-backed methods. Relevant as a **second integration style** (external JS app talking to Pegasus), distinct from `extapps` iframe.
- **Entry:** e.g. `src/apps/jproxy/views.py` serves `jproxy.js` with a computed base URL; permissions like `webservices_jproxy` in `src/apps/jproxy/ajax.py`.

---

## Token passing

### Embedded URL template (`{{auth}}`)

- *Verified:* In `src/apps/appmarket/ajax.py` inside `getDetail` when `view == 'extapps'`, the code sets `url = app_definition.get('embapp_url', '')`, then:
  - `auth_tok = auth.create_token(user['user'].id, origin=None, app=str(app_definition))`
  - `url = url.replace("{{auth}}", "%s" % auth_tok.get('token'))`
- **Token generator:** `rest/core/auth.py` — `create_token` builds a **hex** token via `hashlib.sha224("{SALT}{user}{now}").hexdigest()` (and stores metadata in Redis). **Shape assumption:** opaque string suitable for URL substitution; not JWT in this path.
- **Query parameter name:** *Not fixed by Pegasus.* The template author controls whether the token becomes `?foo=`, path segment, etc. The placeholder is literally **`{{auth}}`** in `embapp_url`, **not** a documented `access_token` query name in this code path.

### REST API session check (`auth` query vs header)

- *Verified:* `rest/resources/__init__.py` — Flask `RequestParser` accepts:
  - Header **`Authenticate`** → `__active_token`
  - Query **`auth`** → same `__active_token`
- *Verified:* `rest/resources/user.py` — `Login.get` is decorated with `@require_auth` and returns success when the token is valid (session/token validation).
- **`GET /api/login`:** Registered in `rest/rest.py` as `user.Login` on `/login` (prefix depends on API mount). **This repo’s** `Login.get` validates an **existing** token; **login with password** is `Login.post`.

### Competing / inconsistent behavior

- **`loadEAppsSelector`** vs **`getDetail`:** The selector list path (`loadEAppsSelector`) **does not** replace `{{auth}}`, while `getDetail` for `extapps` **does**. The grid template `src/templates/apps/appmarket/apps_covers.html` uses `onclick='eapps.open(..., "{{ app.url }}")'` for `view == 'extapps'`. If `embapp_url` still contains `{{auth}}`, the OPEN button may pass a **non-substituted** `{{auth}}` string unless URLs are always token-free in that list flow. *Treat as a potential integration bug or intentional “open from detail only” flow — not fully resolved in-tree.*

---

## Context passing

### Site / domain / “pid”

- *Verified:* `{{pid}}` and `{{domain}}` substitution in `src/apps/appmarket/ajax.py` (`loadEAppsSelector`, `getDetail` extapps branch) uses:
  - `settings.PEGASUS_SITE_ID` (string like `pegasus<N>`) → integer `siteid` for `{{pid}}`
  - `django.contrib.sites.models.Site` — `Site.objects.latest('id').domain` for `{{domain}}`

### User / tenant / groups / preferences

- *Verified:* `create_token(user['user'].id, origin=None, app=str(app_definition), …)` — user id is bound into the token; `app` metadata set to string form of app definition.
- *Verified:* `extapps` view passes `user_prefs` as JSON (`Preferences` model) into the **Pegasus page** context (`src/apps/appmarket/views.py`). **Not** shown being appended to `embapp_url` in the ajax builders reviewed — *context for the shell, not proven for the iframe child*.
- *Verified (separate subsystem):* `src/apps/appmarket/models.py` — `Application` / `UserApplicationData` with `scopes`, `groups`, `redirect_url`, `in_house` — OAuth-like **application registry** (may be used for REST/OAuth flows; not wired in the `embapp_url` iframe snippet in the same file).

### Selected record / device / claim

- *Not found* in the `embapp_url` / `extapps` path in the files reviewed. *Guess:* would require extending `embapp_url` templates or a different launcher.

---

## App registry / enablement

- *Verified:* `AppDefinition` (`defid`, `status` like `available` / `hidden`, …) and `InstalledApp` (`status`: `waiting_user_set_up`, `rdy_to_install`, `installed`, …) in `src/apps/appmarket/models.py`.
- *Verified:* `loadEAppsSelector` filters `InstalledApp` with `definition__embapp_url__isnull=False` and `status='installed'`.
- *Verified:* `loadEAppsSelector` requires permission `user['perms']['appsplugins'] == True` (`src/apps/appmarket/ajax.py`).
- *Verified:* `appmarket_view` / `appmarket_edit` permissions gate other app market AJAX (`getAvailable`, etc.).

---

## Iframe / embedding behavior

### iframe attributes (external app surface)

- *Verified:* `src/templates/apps/appmarket/extapps.html` — `<iframe id='eapp_iframe' sandbox='allow-forms allow-scripts allow-same-origin' …>`.

### Pegasus HTTP responses (clickjacking)

- *Verified:* `src/apps/main/xframemiddleware.py` — sets **`X-Frame-Options`** (default from settings `X_FRAME_OPTIONS`, else **`SAMEORIGIN`** unless exempt). Affects **Pegasus pages**, not the third-party iframe document.

### postMessage

- *Verified (separate legacy bridge):* `src/static/xsdrBridge_v2.html` — `postMessageToParent(msg, "*")` for Orbited/comet-style bridging; **not** referenced from `extapps.html` in the reviewed path.
- *Verified (RPC docs):* `src/templates/apps/rpc/ajax/rpcforw_*.html` — examples mentioning JSON-RPC `postMessage` method names (documentation / demo, not extapps).

### Parent origin / CSP

- *Not found:* `frame-ancestors` CSP configuration in the grep pass over `pegasus/` (may live in nginx/nginx config outside this tree). **Do not assume** this repo contains full CSP embed policy.

---

## Branding / theming

- *Verified:* Pegasus shell theming via `looks` (e.g. `looks.theme.css`, `looks.vc.token` cache-busting) in `src/templates/base.html` and `extapps.html` head loads.
- *Not verified:* Automatic propagation of theme variables to **embedded** app URLs — embeds load arbitrary `embapp_url`; branding is **Shell-side** unless the template adds query params.

---

## Reusable takeaways for a new embedded app

1. **Contract to plan for:** `embapp_url` templates with placeholders **`{{pid}}`**, **`{{domain}}`**, **`{{auth}}`** — see `src/apps/appmarket/ajax.py`
2. **Token opaque string** from `rest/core/auth.py` `create_token` — hex SHA-224–style string; **not** self-describing JWT in this implementation.
3. **REST validation** uses query **`auth`** or header **`Authenticate`** — `rest/resources/__init__.py`
4. **iframe sandbox** reduces privilege of embedded document — `extapps.html`; align your app’s needs with `allow-forms allow-scripts allow-same-origin` (no `allow-top-navigation` etc. in this template).
5. **Two integration families:** (a) **iframe + `embapp_url`** for full-page embed; (b) **JProxy** for RPC-style integration — different security and UX assumptions.
6. **Treat `loadEAppsSelector` vs `getDetail` auth substitution** as a **risk area** — verify with your deployment which code path builds the URL users open.

---

## Outdated / partial / unclear in this tree

- `src/urls.py` line ~161: `aplugins/` → `appmarket.views.extapps` is **commented out** — deployment may mount routes elsewhere; **URL path to `extapps` not proven from `urls.py` alone**.
- `src/apps/appmarket/views.py`: `extapps` references `getCometCfg(req)` but import is commented at top — may be **broken in this snapshot** if that function is undefined at runtime.
- `jproxyapp` FK and several JProxy install paths are **commented out** in `models.py` / `ajax.py` — partial deprecation.

---

## Guesses (explicit)

- *Guess:* Production deployments may use **reverse proxy** routes not present in this `urls.py` snippet.
- *Guess:* Some teams may pass tokens only via **`getDetail`** modal (full `{{auth}}`) vs grid OPEN — depends on product UX not in code.
- *Guess:* `access_token` naming in **OAuth** path (`OAuthLogin` in `rest/resources/user.py`) is **unrelated** to `embapp_url` `{{auth}}` substitution unless explicitly bridged.
