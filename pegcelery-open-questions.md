# pegcelery — open questions (auth / embedded apps)

## Things that still need confirmation from the team

1. **Is there any deployment** where `pegcelery` workers import or call into Pegasus `rest.core.auth` (or equivalent) at runtime? This snapshot contains **no** such imports — confirm for your environment.

2. **Redis topology:** Do Pegasus REST auth tokens and pegcelery `API-*::` keys ever share the **same Redis instance/DB**? The **key naming** looks related to Pegasus conventions, but **this repo does not read auth tokens**.

3. **Satellite / device tasks** (`pegcelery/atasks/satcom/`): Could any future “embedded” flow depend on these workers? Only relevant if your product ties **device identity** to the same pipelines — **not** evidenced for iframe/embed auth.

---

## Contradictions or gaps vs `pegasus` (main repo) findings

| Topic | `pegasus` (prior archaeology) | `pegcelery` (this repo) |
|-------|------------------------------|-------------------------|
| User session / API token validation | Present in REST layer (`rest/resources/__init__.py`, `rest/core/auth.py`, etc.) | **Absent** — no equivalent code |
| `embapp_url` / `extapps` / app market | Present in Django app market (`src/apps/appmarket/`) | **No references** |
| Token query/header contract | `auth` query + `Authenticate` header on REST | **Not implemented here** |
| Token creation | `create_token` in `rest/core/auth.py` | **Not called** in pegcelery |

**Conclusion:** There is **no contradiction in code** — these are **different subsystems**. The risk is **conceptual**: assuming “pegcelery” implements or clarifies **browser/API auth** for embedded apps.

---

## Risks in assuming this repo is the source of truth

1. **False confidence:** Searching only `pegcelery` could wrongly suggest Pegasus has **no** token story — auth lives in the **main Pegasus / gateway** codebase.

2. **Redis confusion:** Seeing `API-` prefixes might suggest workers **validate** sessions; they **do not** in this tree — they use Redis for **worker/geodata state**.

3. **Deployment docs:** `docker-compose.yml` and `/pegasus/*.config` paths are **examples**; production may use different env names or split services.

4. **Incomplete search:** If auth integration existed only in a **private fork**, **sidecar**, or **not checked into this copy**, it would not appear here.

---

## Suggested follow-ups (short)

- [ ] Confirm with platform team: **which repo/service** owns token validation for embedded apps (monolithic Pegasus vs API gateway vs BFF).
- [ ] Confirm whether **Celery workers** ever **invalidate** or **audit** user tokens (likely **no** in this snapshot).
- [ ] Keep using **`pegasus`** REST/Django findings for **`auth` / `Authenticate` / login**; use **`pegcelery`** only for **async pipeline + Redis worker behavior**.
