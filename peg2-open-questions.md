# peg2 — open questions (embedded apps / shell)

## Things still needing team confirmation

1. **`legacy_apps` schema:** Exact fields returned by **`GET legacy_apps`** (including `embapp_url`, `name`, ids)—and whether **`{{pid}}` / `{{domain}}`** placeholders still appear in any deployments (not replaced in `applications.ctrl.coffee`; *guess:* either server returns fully expanded URLs or some installs only use `{{auth}}`).

2. **`POST user/sessions` contract:** Full request/response shape for **`origin: "pegapp"`**, **`app: <name>`**—TTL, revocation, relationship to tokens created server-side in older Pegasus app market.

3. **Whether embedded apps are expected to call Pegasus API** using the same token passed in `embapp_url` via **`Authenticate`** vs query **`auth`**—peg2 shell uses **header `Authenticate`** for its own calls; embedded origin may differ.

4. **CSP / iframe embedding of peg2** in a parent portal: `index.template.html` CSP is **commented**—where is production CSP / `frame-ancestors` defined?

5. **Applications without `{{auth}}`:** Is opening an app with **`embapp_url` but no `{{auth}}`** supported? Current controller may still run replace with **undefined** token (*suspected bug*).

---

## Contradictions with older Pegasus or reference findings

| Topic | Older `pegasus` archaeology | `peg2` (this tree) |
|--------|----------------------------|----------------------|
| Who substitutes `{{auth}}` | Django **`ajax.py`** (`getDetail` / app market) | **Browser** (`applications.ctrl.coffee`) after **`user/sessions`** |
| iframe `sandbox` | Present on `extapps` template | **Absent** on Applications `iframe.jade` |
| API header name | REST parsers: **`Authenticate`** + query **`auth`** (Flask `pegasus` repo) | **`Authenticate`** on XHR (`interceptor.coffee`) — **aligned** |
| Bearer vs Authenticate | Some gateways/BFFs use **`Authorization: Bearer`** | **peg2 client** sets **`Authenticate`**, not Bearer |

**Risk:** A **BFF** or **embedded SPA** that only implements **`Authorization: Bearer`** may **not** match what **peg2** sends unless an API gateway normalizes headers.

---

## Risks in assuming peg2 is the final source of truth

1. **Frontend-only repo:** No Pegasus **server** here—**token lifecycle**, **`user/sessions`** implementation, and **`legacy_apps`** persistence are **not provable** from `peg2` alone.

2. **Multiple iframe patterns:** **Applications** (`$sce` + `ng-src`), **Reports** (raw `src` string), **share links** (`?auth=`)—**one size does not fit all**.

3. **OAuth / `localStorage` / `$localForage`:** Login and token storage paths exist for the **shell**; embedded third-party apps should **not** assume they share storage or OAuth state unless explicitly designed.

4. **Version drift:** File paths reference **`pegasus2.0`**, **`v2/`** URLs—contracts may differ by **site / deployment**.

5. **`peg_bearer` / `peg1_auth_token`:** `config.coffee` and `interceptor.coffee` touch **legacy token storage keys**—**migration-era** behavior; confirm what production still relies on.

---

## Short checklist for the team

- [ ] Confirm **`POST /user/sessions`** payload for embedded apps (`pegapp` origin) and token format.
- [ ] Confirm whether **`embapp_url`** is still authored with **`{{pid}}` / `{{domain}}`** and who expands them (API vs static config).
- [ ] Confirm **canonical** way for an embedded app to call APIs: **`?auth=`**, **`Authenticate`**, or **Bearer** at the gateway.
- [ ] Confirm **sandbox** policy: intentional removal vs oversight for Applications iframe.
