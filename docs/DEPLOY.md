# VETO — Deployment

Status as of **2026-08-13, mid-afternoon**. Deadline is **23:55 WIB the same day**.

**Where this stands in one line: every config file is written, committed and
verified locally. Nothing has been deployed yet.**

Frontend → Vercel. Backend → Render. Both repos are already connected to
GitHub by the owner; neither has had a successful deploy.

---

## 1. What is already done

| Artifact | State |
|---|---|
| `render.yaml` | Committed. Blueprint documenting the service; the service itself is made in the dashboard. |
| `backend/render-build.sh` | Committed, executable (`chmod +x` is in the tree). |
| `vercel.json` | Committed **at the repo root**, not in `frontend/`. See §4. |
| `.vercelignore` | Committed. Keeps the upload lean. |
| `backend/.env.example` | Updated: records the deployed variable set, and no longer says GEMINI. |

`settings.py` needed **no changes**. `DEBUG`, `ALLOWED_HOSTS`,
`CSRF_TRUSTED_ORIGINS`, `CORS_ALLOWED_ORIGINS` and `DATABASE_URL` were already
env-driven, whitenoise was already in the middleware, and
`SECURE_PROXY_SSL_HEADER` was already set for a proxied host.

### Verified locally, under production settings

- `manage.py check --deploy` — clean apart from two ignorable warnings (a short
  test key, and HSTS preload which does not apply to an `onrender.com` subdomain)
- `collectstatic` — 157 files copied, 453 post-processed
- `config.wsgi:application` imports
- Vercel's exact commands from the repo root: `npm --prefix frontend ci` then
  `npm --prefix frontend run build` → 924 KB in `frontend/dist`, and the bundle
  contains a string that exists only in `contract/rules.list.json`, which proves
  the fixtures resolved

Relevant commits: `91c544a` (Render + first Vercel config), `3aaab16` (move
Vercel config to root).

---

## 2. What has NOT happened

- No Render Postgres instance created
- No Render web service deployed
- No Vercel project deployed
- No environment variables set anywhere

---

## 3. Decisions already made — do not relitigate

**Postgres, not SQLite.** Render's disk is ephemeral: SQLite would reset the
audit trail on every deploy and every wake from sleep, taking the approved
client rules with it. Owner chose Postgres.

**Free tier, spin-down accepted.** Render free sleeps after ~15 minutes idle and
takes ~50 s to wake. Owner chose to warm it manually rather than add a cron
pinger or pay. **Open `/health/` 2–3 minutes before the demo, and again before
the booth opens.**

**Backend stays on Render. It cannot go on Vercel.** The owner asked; the
answer is grounded in the code, not preference. Rule Studio touches disk across
three separate requests:

| Request | File | Line | Action |
|---|---|---|---|
| Upload | `apps/rules/views.py` | 79 | writes the PDF into `MEDIA_ROOT` |
| Extract | `apps/rules/views.py` | 138 | reads `doc.file_path` |
| Source plate | `apps/rules/views.py` | 385 | checks the file exists, renders the page |

Vercel Python is serverless: each request can land on a different instance and
`/tmp` is not shared between invocations. Upload would succeed, then extraction
would fail with `"Failed to read PDF text"` and the source plate would 404 with
`"Document file is no longer on disk"`. The dispatch path (`/validate`,
`/audit`, `/rules`) is pure DB and would be fine — it is only the AI
differentiator that breaks. Dependencies are also 188 MB against Vercel Hobby's
250 MB unzipped limit, with PyMuPDF alone at 58 MB.

A version that works exists — store uploaded PDFs as bytes in the database
instead of on disk — but that is a schema change plus a migration touching the
backend lane, which is not a same-day move.

---

## 4. Why `vercel.json` sits at the repo root

The frontend build reads **ten fixtures from `contract/`**, which is outside
`frontend/`:

```
frontend/src/mocks/index.js:11-20   import … from '@contract/…json'
```

Those imports are static, so Vite resolves them at build time **even when mocks
are off**. A build scoped to `frontend/` cannot see them and fails on
unresolved `@contract` imports.

Vercel's "include source files outside of the Root Directory" toggle **does not
appear** on the project-creation screen in the owner's account, so the build
runs from the repo root instead: `installCommand` and `buildCommand` reach into
`frontend/` with `--prefix`, and `outputDirectory` is `frontend/dist`.

**Do not "fix" this by copying `contract/` into `frontend/`.** That creates two
copies of the same fact, which this repo has already been bitten by twice.

`frontend/vercel.json` was deleted, not left beside the root one, so there is no
ignored config lying in the tree to mislead the next reader.

---

## 5. Steps remaining, in order

Backend first — the frontend needs its URL.

### 5.1 Render Postgres

**New → Postgres**, plan **Free**, name `veto-db`. Wait for *available*, then
copy the **Internal Database URL**.

Render's free Postgres expires ~30 days after creation. That outlasts the event.

### 5.2 Render web service

Settings:

| Field | Value |
|---|---|
| Root Directory | `backend` |
| Runtime | Python |
| Build Command | `./render-build.sh` |
| Start Command | `uv run gunicorn config.wsgi:application --bind 0.0.0.0:$PORT` |
| Health Check Path | `/health/` |

Environment:

```
PYTHON_VERSION=3.12
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=<generate, see below>
DATABASE_URL=<Internal Database URL from 5.1>
DJANGO_ALLOWED_HOSTS=<service>.onrender.com
OPENAI_API_KEY=<real key>
```

Generate the secret key with:

```bash
uv run --directory backend python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
```

`DJANGO_SECRET_KEY` is not optional. `settings.py` deliberately refuses to boot
when `DEBUG=False` and the key is still the dev value, so a missing key fails
the deploy loudly instead of shipping something insecure and quiet.

Confirm with `https://<service>.onrender.com/health/` →
`{"status":"ok","service":"veto-api"}`.

### 5.3 Vercel

| Field | Value |
|---|---|
| Application Preset | **not** `Services` — a single-framework preset |
| Root Directory | `./` (repo root, leave as-is) |
| Build / Output / Install Command | leave blank; the root `vercel.json` declares all three |

Environment Variables — add the first, click **+ Add More**, add the second:

```
VITE_API_BASE_URL = https://<service>.onrender.com/api/v1
VITE_USE_MOCKS    = false
```

Leave `Environments` on **Production and Preview**. Leave the sensitive/lock
toggle **off**: `VITE_` values are baked into the client bundle and are
therefore public. **Never put a secret in a `VITE_` variable.**

### 5.4 Back to Render — CORS

Once the Vercel domain exists, add these and redeploy:

```
CORS_ALLOWED_ORIGINS=https://<project>.vercel.app
DJANGO_CSRF_TRUSTED_ORIGINS=https://<project>.vercel.app
```

CORS was invisible in development because the Vite proxy made everything
same-origin. In production the two hosts differ and CORS becomes load-bearing.
**Symptom if skipped: `curl` against the API succeeds while every request from
the browser fails.**

---

## 6. Traps, each one already paid for

**`VITE_API_BASE_URL` replaces the whole base path, it does not extend it.**

```js
// frontend/src/api/client.js:11
baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1'
```

Setting it to `https://…onrender.com` without `/api/v1` sends every request to
`/decisions` instead of `/api/v1/decisions`, and everything 404s. **The value
must end in `/api/v1`.**

**Vite bakes env vars at build time.** Changing one in the Vercel dashboard does
nothing until a redeploy. Restarting is not enough.

**Vercel offers a multi-service preset** because it detects `backend/` as
Django. Reject it, and do not copy the `vercel.json` it shows on screen — it
would try to build Django on Vercel and override the root config.

**Uploaded PDFs do not survive a redeploy or a wake from sleep.** Render's disk
is ephemeral. A document uploaded before a redeploy will have no source page to
render afterwards. **Upload during the demo, not before it.**

**The audit trail starts empty** on a fresh Postgres. Run a few dispatches to
populate it before a judge sees `/audit`, or it renders its empty state.

---

## 7. One thing that works in your favour

A fresh Postgres is migrated from scratch, so the deployed instance gets the
**corrected** thresholds: tandem at 18000, and no `Asumsi` in any citation.

This machine's local database still holds the stale row, because `d9e4a12`
corrected an already-applied migration and nothing rewrites existing data.

**So the deployed demo is cleaner than a demo from this laptop.** Prefer the
deployed URL on the day.

`0007_seed_client_rules` also runs on that first deploy, so the client rules
(22.000 kg, 4.000 mm) are seeded automatically and the closing beat works with
no manual setup.

Note on `0007`: its `get_or_create` keys on `id` while the unique constraint is
`(domain, origin, version)`, so it crashes on a database where somebody already
approved a client rule through the UI. **On a fresh deploy it is harmless** —
it runs before anyone can approve anything. It still needs fixing for existing
databases; that is a backend-lane task, not a release blocker.

---

## 8. Worth doing if there is time

A **second Vercel deployment with `VITE_USE_MOCKS=true`** as a standby URL. If
Render sleeps or dies mid-booth, that URL keeps working with no backend at all.
Vite locks env vars at build time, so this cannot be switched live — the standby
has to be built ahead of time.
