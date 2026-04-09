# pegcelery — backend auth / embedded-app findings (targeted)

Scope: the `pegcelery/` tree only. Focus: **Pegasus auth/session validation** and **embedded/external app** backend behavior.

**Executive summary (verified):** This repository is a **Celery worker** codebase (event digest, geofences, forwarders, triggers, live cache, routes, satcom tasks). It **does not** implement HTTP session validation, does **not** reference `embapp_url`, **extapps**, or app market models, and **does not** parse `auth`, `Authenticate`, or `Authorization: Bearer` for user sessions.

---

## Token validation flow

### Verified: no user-session token validation in this repo

- Full-text search over `pegcelery/**/*.py` for patterns including `Bearer`, `Authenticate`, `create_token`, `destroy_token`, `get_token`, `auth-tokens`, `login`, `session` (in an auth sense) yields **no** token-validation implementation for browser/API users.
- **Conclusion:** The canonical path for validating Pegasus API tokens remains in the **main Pegasus / REST service** (e.g. Flask/Django REST layer), **not** in `pegcelery`.

### Verified: `API-` Redis key prefix — **domain cache**, not auth tokens

Workers use Redis keys shaped like `API-{site_id}::…` for **telemetry/domain state**, for example:

- `pegcelery/chains/fwds.py` — `API-{0}::rpc.fqueue.{1}`, `.queue`, `.flush`, etc. (forwarder / RPC queue state).
- `pegcelery/chains/triggers.py` — `API-{0}::vehicle.vehicle.{1}`, `API-{0}::vehicle-triggers.{1}`.
- `pegcelery/chains/live.py` — `API-{0}::device.device.{1}` (comment/context in file).
- `pegcelery/utils/georef.py` — `API-{0}::georef.georeference.{1}`.
- `pegcelery/routines/routes.py` — `API-{0}::Route_{0}.{1}`.

*Guess:* This naming mirrors Pegasus’s broader Redis key conventions; **do not** assume these keys are the same Redis DB or the same key family as `rest/core/auth.py` token keys in the main Pegasus repo without ops confirmation.

---

## Token storage / expiry / revocation

### Verified: no auth-token lifecycle in pegcelery

- No `create_token`, `destroy_token`, token TTL, or `auth-tokens` set manipulation appears in `pegcelery/**/*.py`.
- Redis usage here is for **worker state**: forwarder queues, triggers, geo store, live publish, sequence (`CCACHE`), digest control hashes, etc. — see `pegcelery/utils/storage.py` (`RCACHE`), `pegcelery/utils/sequence.py` (`CCACHE`), `pegcelery/chains/live.py` (`LIVE_STORE`, `LIVE_PUBLISH`), `pegcelery/utils/fwds.py` (`FWD_REDIS`), etc.

### Verified: unrelated `Authorization` header

- `pegcelery/utils/fwds.py` — outbound HTTP uses `'Authorization': "token {0}".format(GITHUB_TOKEN)` for **GitHub**, not Pegasus user tokens.

---

## External app / extapp related backend logic

### Verified: zero references

- Grep for `embapp`, `extapp`, `appmarket`, `AppDefinition`, `installedapp` (case-insensitive) over `pegcelery/**/*.py`: **no matches**.

### Verified: no “embedded app launch contract” in workers

- Nothing in this tree defines or consumes `embapp_url` templates, iframe launch, or external app registration.

---

## API endpoint or worker contracts relevant to embedded apps

### Celery tasks (verified scope)

- `pegcelery/tasks.py` — `digest` task orchestrates chains (`trigger_chain`, `fwd_chain`, `live_chain`, `digest_route`); `control()` reads `pegcelery.digest.control` keys from `RCACHE` to block/allow chains per site/vehicle — **operational pipeline control**, not user auth.
- `pegcelery/csettings.py` — beat schedule: `pegcelery.chains.triggers.run_delayed_triggers`, `pegcelery.routines.routes.rotate_routes`.
- `pegcelery/atasks/satcom/` — device/message/send tasks (satellite coms).

*None* of these implement or clarify **browser/API token** contracts for embedded apps.

### REST API

- **No** Flask/Django REST app in this package; no `/api/login` or similar.

---

## Config / env assumptions

### Verified: worker-oriented configuration

- `pegcelery/app.py` — loads `get_config('PEGCELERY_SETTINGS_CONFIG_PATH', '/pegasus/pcelery.config')` and merges into Celery config; optional `PEGCELERY_BROKER_URL` env override.
- `pegcelery/utils/config_loader.py` — reads JSON from env (e.g. `PEGCELERY_SETTINGS_REDIS`) **or** `key=value` lines from a file path.
- Multiple Redis config paths via env vars (examples in source):  
  `PEGCELERY_SETTINGS_REDIS_PATH` → default `/pegasus/pcelery_redis.config` (`storage.py`)  
  `PEGCELERY_SETTINGS_LIVE_REDIS_PATH` → `/pegasus/pcelery_live_cache_redis.config` (`chains/live.py`)  
  `PEGCELERY_SETTINGS_FWD_REDIS_PATH` → `/pegasus/pcelery_fwd_redis.config` (`utils/fwds.py`)  
  and similar for geo, triggers, continuity, device (`atasks/satcom/device.py` references `/pegasus/pcelery_device_redis.yaml` or `PEGCELERY_SETTINGS_DEVICE_REDIS`).

### Verified: `docker-compose.yml` (example deployment)

- Mounts `pegenvs`, sets `PEGENV`, `PEGCELERY_BROKER_URL`, inline JSON for Redis DB indices per subsystem — **infrastructure for workers**, not embedded-app auth.

### Outdated / environment-specific

- Default paths like `/pegasus/...` assume a **container or host layout**; local paths may differ.
- `docker-compose.yml` volume paths reference `/Users/juan/projects/...` — **developer-specific**, not portable.

---

## Reusable takeaways for our embedded app

1. **Do not use `pegcelery` as the source of truth for** how Pegasus validates `auth` / `Authenticate` / Bearer tokens — that logic is **not present** here.
2. **Redis `API-*` keys in workers** are for **processing state** (vehicles, forwarders, geofences). They do **not** substitute for reading `rest/core/auth.py` or REST parsers in the main Pegasus codebase.
3. **Operational coupling:** Embedded apps that only need **HTTP API** access should align with the **REST/gateway** contract from Pegasus; workers are **offline/event** processing.
4. If a future design **must** revoke tokens from async jobs, that would live in **Pegasus services** or a shared library — **not** evidenced in this `pegcelery` snapshot.

---

## Verified vs guess

| Topic | Status |
|-------|--------|
| No session token validation in pegcelery | **Verified** |
| No embapp/extapps/app market | **Verified** |
| `API-{site}::…` keys are worker/cache domain | **Verified** |
| Same Redis DB as Pegasus REST auth | **Guess / unknown** |
| Any hidden auth in non-Python files | **Not searched** (repo is overwhelmingly `.py` + yaml/json samples) |
