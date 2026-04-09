# Pegasus embedded app integration — open questions

Items that **need confirmation from the Pegasus team** or that **this repo does not fully prove**, for a new embedded app.

---

## Routing / deployment

1. **`extapps` URL:** In `src/urls.py`, the `aplugins/` route to `appmarket.views.extapps` is **commented out**. How is `extapps` reached in production (another router, nginx, forked `urls.py`)? **Risk:** copying URL assumptions from this tree alone.

2. **Runtime health of `extapps` view:** `getCometCfg` is called in `src/apps/appmarket/views.py` but the import is commented. Is this branch dead code, or does the real deployment differ? **Risk:** the view may error at runtime in this snapshot.

---

## Token and URL contract

3. **`{{auth}}` in list vs detail:** `loadEAppsSelector` does **not** substitute `{{auth}}`, while `getDetail` (view `extapps`) **does**. Is the OPEN button in the grid supposed to receive a token-free URL, or is this an oversight? **Risk:** embedded apps that require `{{auth}}` in the URL may break when opened from the selector list.

4. **Exact query parameter naming:** **Resolved for this app contract** with live evidence from Pegasus custom apps (`include_token: true`, `token_name: "access_token"`). Keep `access_token` as the launch param for this app unless Pegasus installation config changes.

5. **`GET /api/login` vs `Login` resource:** `rest/rest.py` mounts `Login` at `/login` under the Flask API root. Is the **public** path literally `/api/login` in your gateway? **Risk:** qualitas-style `GET …/api/login?auth=` may depend on **reverse proxy prefix** not visible here.

6. **Bearer vs `Authenticate`/`auth`:** The Flask REST layer (`rest/resources/__init__.py`) documents **`Authenticate`** header and **`auth`** query — **not** `Authorization: Bearer`. If your BFF uses Bearer, is that a **different gateway** or a wrapper? **Risk:** copying auth header style from another codebase without aligning to this API.

---

## Context and product surface

7. **User/tenant/site in iframe:** Only `{{pid}}`, `{{domain}}`, `{{auth}}` appear in the ajax builders. Are **tenant**, **units**, or **selected device** ever appended by **another layer** (DB template, nginx, or newer code)? **Risk:** under-specifying embedded app bootstrap.

8. **`Application` / OAuth models:** `src/apps/appmarket/models.py` defines `Application`, `UserApplicationData`, `scopes` — how do these relate to **`embapp_url`** apps vs internal-only apps? **Risk:** mixing OAuth app registry rules with iframe `embapp_url` rules.

---

## Security and embedding

9. **CSP / `frame-ancestors`:** This tree’s `xframemiddleware.py` sets **`X-Frame-Options`** for Pegasus responses; **no** `Content-Security-Policy: frame-ancestors` was found in the quick grep. Where is **parent embedding** of Pegasus allowed (e.g. only same-site)? **Risk:** iframe embedding Pegasus in a parent portal may require **edge/nginx** config not in this repo.

10. **Sandbox limits:** `extapps.html` uses `sandbox='allow-forms allow-scripts allow-same-origin'`. If your embedded app needs **popups**, **downloads**, or **top navigation**, is this **ever** relaxed in production? **Risk:** feature gaps in embedded UX.

11. **postMessage contract:** No standard `postMessage` protocol between **parent Pegasus shell** and **embedded iframe** was found in the `extapps` path. Is there an undocumented **handshake**? **Risk:** relying on postMessage without a contract.

---

## JProxy vs iframe

12. **When to use JProxy vs `embapp_url`:** JProxy (`src/apps/jproxy/`) is a **separate** integration (JS SDK, server methods, permissions `webservices_jproxy`). Team guidance on **which pattern** applies to which product is **not** derivable from this tree alone.

---

## Risks of copying assumptions directly

| Assumption | Risk |
|------------|------|
| `access_token` query param for Pegasus iframe | **Resolved for this app** by live `custom_apps` config (`token_name: "access_token"`). |
| `Authorization: Bearer` on REST | **Medium** — REST parsers use **`Authenticate`** / **`auth`**. |
| Grid OPEN always has a valid token in URL | **High** if `{{auth}}` not replaced in `loadEAppsSelector`. |
| This `urls.py` is authoritative for all routes | **Medium** — many routes commented; prod may differ. |
| Token is JWT | **Low** in this path — `create_token` is opaque hex + Redis metadata. |

---

## Suggested confirmations (short checklist for the team)

- [ ] Canonical **production URL** for the embedded apps page (`extapps`).
- [ ] Canonical **`embapp_url` examples** for live apps (redacted).
- [ ] Whether **`{{auth}}`** must be present for all embedded apps, and how the **OPEN** button is supposed to work from the grid.
- [ ] Exact **API base path** and whether **`GET /login`** (or `/api/login`) with **`?auth=`** is the supported session check.
- [ ] **CSP / frame-ancestors** and **X-Frame-Options** policy for Pegasus when embedded in a parent portal.
