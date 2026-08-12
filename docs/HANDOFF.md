# VETO — Engineering Handoff

## 1. Header
| | |
|---|---|
| **Project** | VETO |
| **Date** | 2026-08-12, 13:40 WIB (refreshed) |
| **Branch** | `main` |
| **Commit** | HEAD is the commit adding this update. Last backend change: `7e1c94b`. |
| **Working tree** | Clean. |
| **Remote** | `https://github.com/6avier/veto.git` |
| **Primary objective** | `dispatch data -> PASS/HOLD + actionable directive`, end to end on seeded rules, for a live demo on 2026-08-14. Due **2026-08-13 23:55 WIB**. |
| **Handoff status** | **NEEDS_REVIEW.** All three frontend surfaces are built and two of them run against the live backend. What blocks a credible demo is regulatory and operational, not code: two enforced thresholds cite themselves as assumptions, no CLIENT rule pack is seeded, and nothing is deployed. |

**Two people work here.** Iqbal owns `backend/`. The other lane owns `frontend/`. The shared seam is `api-contract.md`, `contract/*.json`, and `frontend/src/api/`.

`AGENTS.md` is a pointer file, not context. Read this document first.
## 2. What VETO is

Compliance middleware for Indonesian freight logistics. A deterministic rule engine that converts ODOL (Over Dimension Over Load) vehicle regulations into a gate at the loading dock.

**Core problem.** ERP and WMS platforms have no awareness of legal weight and dimension limits. A warehouse officer issues a delivery order for an overloaded truck because nothing warns them at dispatch. The violation is discovered at a weighbridge, after the truck has left.

**Target users** (from `PRODUCT.md` §2):

- **Warehouse / dispatch officer** — *primary*. Works inside their own ERP, never opens VETO. Enters dispatch figures, gets PASS/HOLD inline, corrects the load or logs an override.
- **Compliance / legal officer** — uses VETO's Rule Studio to review and approve AI-extracted rules from internal policy documents.
- **Client admin** — registers fleet and route parameters. `P2`, not started.

**Core workflow.** Dispatch payload (vehicle axle config, per-axle weights, gross weight, cargo dimensions) is POSTed to the validation engine. The engine evaluates boolean conditions against versioned rule packs and returns `PASS` (HTTP 200) or `HOLD` (HTTP 403) with a list of violations, each carrying the actual value, the limit, the excess, a legal citation, the rule's origin, and a human-readable directive. Every decision is meant to be written to an append-only audit log.

**Rule ownership** is hybrid, central-default: VETO maintains the national ODOL rule base centrally; clients layer stricter internal policies on top; where both cover a dimension, **the stricter threshold wins**.

**Two locked architectural decisions** that constrain all work:

1. **Zero LLM calls at runtime.** AI runs only when authoring rules. Nothing under `backend/apps/validation/` may reach a model provider.
2. **HOLD plus a logged override**, never a hard block.

**What the MVP must accomplish:** one clean PASS scenario and one clean HOLD scenario, rehearsed, running on seeded rules, with an audit trail and article-level citations.

---

## 3. Tech stack (as actually used)

### Frontend — `frontend/`

| Concern | Choice | Where |
|---|---|---|
| Language | **JavaScript (JSX). No TypeScript.** No `tsconfig`, zero `.ts`/`.tsx` files. | `frontend/src/**` |
| Framework | React 19.2 | `frontend/src/main.jsx` |
| Build | Vite 8.2 | `frontend/vite.config.js` |
| Package manager | npm | `frontend/package.json` |
| Routing | react-router-dom 7.18 | `frontend/src/main.jsx` |
| CSS | Tailwind CSS 4.3 via `@tailwindcss/vite` (no `tailwind.config.js`; tokens live in CSS) | `frontend/src/index.css` |
| Fonts | `@fontsource-variable/archivo`, `@fontsource-variable/jetbrains-mono`, self-hosted | `frontend/src/index.css` |
| HTTP | axios 1.19 | `frontend/src/api/client.js` |
| State | React `useState` only. **No state library.** | `frontend/src/routes/Dispatch.jsx` |
| Lint | oxlint 1.75 | `frontend/.oxlintrc.json` |
| Component library | **None.** All components are hand-written. | — |
| Icons | **None installed.** No icon library, no inline icon SVGs in use. | — |
| Frontend tests | **None.** No test runner installed. Deliberate, per `CLAUDE.md` §4. | — |

### Backend — `backend/`

| Concern | Choice | Where |
|---|---|---|
| Language | Python 3.12 (pinned) | `backend/.python-version` |
| Package manager | **uv** | `backend/pyproject.toml`, `backend/uv.lock` |
| Framework | Django 6.1 | `backend/config/settings.py` |
| API layer | Django REST Framework 3.18, function-based views with `@api_view` | `backend/apps/validation/views.py` |
| Serialization | **Plain dicts, no DRF serializers.** Shapes are hand-built to match the contract. | `backend/apps/validation/views.py` |
| Database | SQLite locally (`backend/db.sqlite3`, gitignored). `dj-database-url` reads `DATABASE_URL` for Postgres/Supabase — **configured but never yet pointed at Postgres.** | `backend/config/settings.py` |
| CORS | django-cors-headers | `backend/config/settings.py` |
| Config | python-dotenv | `backend/config/settings.py` |
| Error format | Custom DRF exception handler producing the contract's error envelope | `backend/config/exceptions.py` |
| Auth | **None.** No login, no API key check, no permission classes. | — |
| Validation | Hand-rolled type/range checks inside the view | `backend/apps/validation/views.py` |
| Tests | Django `TestCase`, 10 passing | `backend/apps/validation/tests/test_contract.py` |

### Not configured

**Deployment.** No `Dockerfile`, `vercel.json`, `railway.*`, `Procfile`, `render.yaml`, or `.github/workflows`. `gunicorn` and `whitenoise` are installed in anticipation but nothing consumes them. `.claude/launch.json` describes local dev servers only.

---

## 4. Repository map

```
CLAUDE.md                  Agent instructions. Authoritative. Read first.
PRODUCT.md                 Product requirements, features F1-F5, demo flow.
DESIGN.md                  The visual system. Tokens, typography, colour, motion.
api-contract.md            BINDING frontend/backend contract. 7 sections.
README.md                  Lane ownership, quick start, current state.
contract/*.json            14 canonical fixtures. Consumed by BOTH sides.
docs/plans/                Two implementation plans, task-by-task.
docs/HANDOFF.md            This file.

backend/
├── config/
│   ├── settings.py        Env-driven. CONTRACT_DIR points at /contract.
│   ├── urls.py            /admin, /health/, /api/v1/*
│   └── exceptions.py      Error envelope handler
└── apps/
    ├── validation/        ONLY app with implementation
    │   ├── views.py       POST /validate — STUB, see §5
    │   ├── urls.py
    │   └── tests/test_contract.py
    ├── rules/             Empty scaffold. urls.py has an empty urlpatterns.
    ├── audit/             Empty scaffold. urls.py has an empty urlpatterns.
    └── profiles/          Empty scaffold. urls.py has an empty urlpatterns.

frontend/src/
├── main.jsx               Router. Nested layouts.
├── App.jsx                Shell: the ERP/VETO segmented control
├── layouts/
│   ├── ErpLayout.jsx      Fake client WMS chrome (deliberately plain)
│   └── VetoLayout.jsx     VETO sub-nav
├── routes/
│   ├── Dispatch.jsx       The only built surface. Form + verdict panel.
│   ├── RuleStudio.jsx     Placeholder
│   └── AuditLog.jsx       Placeholder
├── components/dispatch/
│   └── DispatchForm.jsx   Controlled form
├── api/                   axios layer, one module per contract section
├── mocks/index.js         Imports /contract fixtures
├── lib/format.js          kg/mm → Indonesian display formatting
└── index.css              Tailwind v4 @theme — ALL design tokens
```

**Inspect before modifying:**

- Anything under `frontend/src/api/` or `contract/` → read `api-contract.md` first. These shapes are shared with the backend.
- Anything visual → read `DESIGN.md` first. It has an explicit banned list (§8).
- `backend/apps/validation/views.py` → read `docs/plans/2026-08-11-validation-engine-and-dispatch.md` Task B2/B3; the replacement is already specified in detail.

---

## 5. Current implementation
### Working, against the live backend

- **`POST /api/v1/validate`** — `backend/apps/validation/views.py` + `engine.py`. Loads active `Rule` rows, resolves CENTRAL/CLIENT conflicts by keeping the stricter, persists a `DispatchDecision` and its `Violation` rows, returns contract-exact PASS (200) / HOLD (403). Swept across 12 cases with 0 mismatches: every dimension fires, `LTE` boundaries are exact, 3-axle configs evaluate per axle, four simultaneous violations all return.
- **`/dispatch`** — verified end to end against the live API. Four violations map to the correct four fields; switching to tronton `1.22` adds a third axle input and an over-limit middle axle pins to it; PASS unlocks *Cetak Surat Jalan*; editing any field re-locks it.
- **`/audit`** — **now live**, not mocked. Reads `GET /decisions` and `GET /decisions/{id}`. Table of every decision, rows expand to real violations, citations, rule pack versions and decision id. Filters by outcome and date. Loading, empty and error states.
- **All twelve endpoints respond.** `/validate`, `/decisions`, `/decisions/{id}`, override, `/documents`, extract, `/rule-candidates`, approve, reject, `/rules`, `/vehicle-profiles`.

### Working, on mocks only

- **`/rule-studio`** — the full flow is built and verified: upload, triage with three outcomes, staged extraction reveal, split-screen review, approve and reject. Backend endpoints now exist, so this can be wired live next, but it has not been.

### Placeholder

- **Persona labels** in `frontend/src/layouts/ErpLayout.jsx` are hardcoded strings, not a user model.
- **`loading_point_id: 'LP-CIKARANG-01'`** hardcoded in `frontend/src/routes/Dispatch.jsx`.
- **`contract/rules.list.json` is stale** — old 16100 / `PM 111/2015` values. Nothing consumes it.
- **`DO-TEST` rows pollute the audit log** from integration sweeps. Dev data, needs clearing before the demo.

### Not implemented

- **No CLIENT rule pack is seeded.** Exists only inside `test_contract.py`'s `setUp`.
- **No extraction fallback.** See §14 P0-2.
- **`apps/profiles`** has endpoints but no UI, and is `P2`.

### Broken

Nothing is broken. `main` runs, `check` is clean, 32 of 34 tests pass; the 2 failures are the flaky live-LLM tests in §14 P0-3.
## 6. Current user flow

### Implemented

```
/  → redirect → /dispatch
     [ Client ERP | VETO ]  segmented control, always visible

Client ERP  (NUSANTARA WMS chrome, deliberately plain)
  → Buat Surat Jalan
  → 1. Identifikasi Kendaraan   nomor surat jalan, konfigurasi sumbu, berat kosong
  → 2. Data Muatan              berat kotor, one input per axle (count follows axle config)
  → 3. Dimensi Muatan           panjang, lebar, tinggi
  → "Validasi ke VETO"
      → client-side validation; errors render inline on the field
      → POST /api/v1/validate  (or mock)
      → VETO panel, on graphite, inside the ERP page:
          PASS → "LOLOS"  → "Cetak Surat Jalan" unlocks
          HOLD → "TAHAN" in amber, one entry per violation:
                 directive · actual/limit · citation · [ SOP KLIEN ] if client-origin
                 → "Cetak Surat Jalan" stays locked
      → editing any field clears the verdict and re-locks the button
```

Switching to **VETO** reaches `/rule-studio` and `/audit`, both of which render a heading and a "not built yet" line.

### PLANNED — specified, not built

- **PLANNED** Override: HOLD → typed reason (min 10 chars) → `POST /decisions/{id}/override` → decision still reads HOLD, override appended.
- **PLANNED** Audit log: list of decisions, filter by outcome and date, row expands to violations and citations.
- **PLANNED** Rule Studio: upload → triage classification → extraction with staged reveal → split-screen review → approve → the approved client rule then makes a nationally-legal load HOLD on `/dispatch`.

---

## 7. Design system

The system of record is **`DESIGN.md`**. It is implemented in `frontend/src/index.css` as a Tailwind v4 `@theme` block. Change `DESIGN.md` first, then the CSS.

### Intended direction

Industrial, operational, regulatory, high-density, restrained. Explicitly **not** generic AI SaaS. `DESIGN.md` §8 bans: green success ticks, a second accent colour, purple/blue gradients, cards inside cards, generic dashboard card grids, glassmorphism, pills, Inter, decorative status dots, section-number eyebrows, dismissible modals for compliance results, spinners, and fake precision.

### Two systems, two densities

- **Client ERP** (`ErpLayout.jsx`, `/dispatch`) — deliberately unremarkable enterprise software. Light `#eef0f2` ground, boxy bordered panels, a dull institutional blue `#2c5d8f`. This is intentional: `PRODUCT.md` F2 says the officer must not have to learn a new interface, and the only way to show that is to make the host look ordinary.
- **VETO instrumentation** (verdict panel, `/audit`) — graphite ground, dense readouts, amber for HOLD.
- **VETO register** (`/rule-studio`) — light `--color-paper`, editorial measure.

The ERP's blue is a **documented exception** to the one-accent lock, noted in `ErpLayout.jsx`. It earns its place by making VETO's amber unmistakably foreign to the host system.

### Typography

| Role | Face |
|---|---|
| Language **and quantity** | **Archivo Variable**, always with `tabular-nums` on numerics |
| Machine references only | **JetBrains Mono Variable** — decision IDs, dispatch refs, legal citations, timestamps, versions, latency |

Chosen on measured font metrics, then confirmed by rendering candidates at working sizes. Rationale and the comparison tables are in `DESIGN.md` §2.

Scale tokens in `index.css`: `text-display` 32/36 w600, `text-h1` 24/30 w600, `text-h2` 18/24 w500, `text-body` 15/23, `text-label` 13/16 w500, `text-data-lg` 22/26 w500, `text-data` 14/20, `text-mono` 13/18, `text-mono-xs` 11/16.

Dark surfaces get `.on-dark` (`letter-spacing: 0.005em`) to compensate for optical thinning.

### Colour

Graphite ramp `--color-ink-950` → `--color-ink-50` plus `--color-paper`. One accent: `--color-hold: #f2a93b`, and `--color-hold-ink: #8a5200` for light grounds (plain amber fails contrast on paper at 1.9:1). All ratios verified and listed in `DESIGN.md` §4.

**PASS has no colour.** No green tick. The signal is functional: the *Cetak Surat Jalan* button unlocks. This is load-bearing — do not add a green success state.

Rule origin is distinguished by **form, not hue**: `CENTRAL` renders the citation plain, `CLIENT` renders it as `[ SOP KLIEN ] …`.

### Shape, space, motion

- **Radius: `--radius-veto` = 2px, everywhere.** No pills, no `rounded-xl`.
- Spacing on a 4px base. No cards; group with borders and `divide-y`.
- Motion: only three moments animate (verdict arrival 180ms, HOLD→PASS 240ms, Rule Studio stage reveal 400ms), all `cubic-bezier(0.16, 1, 0.3, 1)`, all collapsing to opacity-only under `prefers-reduced-motion`.

### Where implementation differs from the intended direction

1. **Motion is specified but not implemented.** The verdict currently appears instantly. No `transition` or animation exists on the verdict panel in `Dispatch.jsx`.
2. **Responsive behaviour is only partly done.** `DispatchForm` collapses `sm:grid-cols-2 lg:grid-cols-3`, and the page grid collapses below `lg`. Nothing has been checked at mobile width; `DESIGN.md`'s "collapse to one column at `px-16`" is unverified.
3. **The `/dispatch` page has a large empty region** below the form at desktop width. Cosmetic, not yet addressed.
4. **`index.html` still has `<title>frontend</title>`** and the default Vite favicon.
5. **Light/dark mode:** there is no toggle and none is planned. Theme is a property of each surface, locked. This matches `DESIGN.md` §4.

---

## 8. Important UI components

There are no generic UI primitives yet, and **no component library**. Everything below is hand-written. Reuse these rather than creating parallel versions.

| Component | Path | Purpose | API | Reuse? |
|---|---|---|---|---|
| `App` | `frontend/src/App.jsx` | Shell. ERP/VETO segmented control, persona label, MOCKS badge. Renders `<Outlet/>`. | none | **Yes** — add nothing to the shell without a reason; it must stay 44px tall. |
| `SystemTab` | `frontend/src/App.jsx` (local) | One segment of the system switcher. | `{ to, active, children }` | Internal to `App`. |
| `ErpLayout` | `frontend/src/layouts/ErpLayout.jsx` | Fake client WMS chrome: product strip, five nav tabs. | none | **Yes** for any new ERP-side surface. |
| `VetoLayout` | `frontend/src/layouts/VetoLayout.jsx` | VETO sub-nav (Rule Studio, Jejak Audit). | none | **Yes** for any new VETO surface; add the link here. |
| `DispatchForm` | `frontend/src/components/dispatch/DispatchForm.jsx` | The whole dispatch entry form. Controlled. Axle input count derives from `axleConfig`. | `{ value, onChange, onSubmit, pending, errors }` | **Yes.** Do not build a second dispatch form. |
| `Section` | `DispatchForm.jsx` (local) | Numbered `fieldset` with a responsive grid. | `{ title, children }` | Extract to shared if a second form appears. |
| `Field` | `DispatchForm.jsx` (local) | Label above input, hint or error below. Never placeholder-as-label. | `{ label, hint, error, children }` | Extract to shared when a second form needs it. |
| `TextInput` / `NumberInput` | `DispatchForm.jsx` (local) | Bordered ERP-styled inputs. `NumberInput` carries `tnum`. | native input props | Extract if reused. |
| `VerdictPanel` | `frontend/src/components/dispatch/VerdictPanel.jsx` | VETO's graphite panel inside the ERP page. Idle / pending / error / decision states. | `{ decision, error, pending }` | **Extract this before F2.** It is the demo's hero and belongs in `frontend/src/components/dispatch/`. |

| `ViolationDialog` | `frontend/src/components/dispatch/ViolationDialog.jsx` | HOLD announcement over a blurred scrim. Escape and backdrop close it; closing clears nothing. | `{ decision, onClose }` | **Yes.** |
| `DropZone` · `TriageResult` · `ExtractionStages` · `CandidateReview` | `frontend/src/components/rulestudio/` | The Rule Studio flow. | see each file | **Yes.** |
| `limitsFromRules` · `deltaFromLimit` | `frontend/src/lib/limits.js` | Turns `GET /rules` into per-field ceilings and signed distances. | pure functions | **Yes.** Do not hardcode a limit anywhere. |

Icons come from `@phosphor-icons/react`. One family, no hand-rolled SVG, no emoji.

**Not built, and needed:** override dialog, audit table and row detail, badge/status primitive, Rule Studio drop zone, triage result, extraction stage reveal, candidate split-screen review, loading skeletons, empty states. All are specified in the two plan files under `docs/plans/`.

No charts exist and none are specified.

---

## 9. Data model
### ACTUAL IMPLEMENTED MODEL

Real Django models now exist. Migrations: `rules/0001_initial`, `rules/0002_seed_odol_central_rules`, `audit/0001_initial`.

**`apps/rules/models.py`**

- `RulePack` — `id` UUID pk, `domain` (default `ODOL`), `version` int, `origin` (`CENTRAL`|`CLIENT`), `effective_from`
- `Rule` — `id` UUID pk, `rule_pack` FK, `dimension`, `operator` (`LTE`|`GTE`|`EQ`), `threshold` int, `unit`, `axle_config` JSON, `axle_index` int, `legal_citation`, `status` (`ACTIVE`|...)

Note `Rule` has **`axle_config` and `axle_index` as separate columns**, not the `applies_to` JSON blob the plan documents. The plan is out of date here; the code wins.

**`apps/audit/models.py`**

- `DispatchDecision` — `decision_id` UUID pk, `outcome`, `dispatch_ref` indexed, `payload` JSON, `rule_packs_applied` JSON, `latency_ms`, `evaluated_at`, plus `override_reason` / `overridden_by` / `override_created_at`
- `Violation` — FK to decision, `dimension`, `axle_index`, `actual_value`, `limit_value`, `excess_value`, `unit`, `severity`, `rule_origin`, `legal_citation`, `directive`

Override is modelled as **nullable columns on the decision**, not a separate `Override` table. This departs from `PRODUCT.md` §6 and from the plan. It still satisfies append-only in practice as long as nothing rewrites the original outcome.

**Wire contract** — unchanged and authoritative in `api-contract.md`. Integer kg and mm, `snake_case`, UPPERCASE enums. `axle_index` appears only on `AXLE_LOAD` violations.

**Frontend form state** — `DEFAULTS` in `frontend/src/routes/Dispatch.jsx`, camelCase, values held as strings while editing and converted by `toPayload()`.

There are **no TypeScript types**; the frontend is plain JavaScript.

### PLANNED MODEL — no code exists

`SourceDocument`, `RuleCandidate`, `VehicleProfile`. Specified in `docs/plans/2026-08-11-rule-studio.md` Task B1 and `PRODUCT.md` §6.

`Route` and `Road Class` appear in neither. Road-class-aware validation is explicitly out of scope (`PRODUCT.md` §3). Do not add it and do not let UI copy imply it exists.
## 10. Compliance logic
Evaluation lives in `backend/apps/validation/engine.py` and is now **data-driven**: it reads `Rule` rows and keeps the stricter of a CENTRAL/CLIENT pair per dimension.

### Seeded CENTRAL rules — the six rules actually enforced

From `backend/apps/rules/migrations/0002_seed_odol_central_rules.py`:

| Dimension | Op | Threshold | Citation as stored |
|---|---|---|---|
| `AXLE_LOAD` | LTE | 10000 kg | `PM 18/2021 Pasal 4 ayat (1) huruf a` |
| `AXLE_LOAD` | LTE | 16000 kg | `PP 55/2012 Lampiran (Asumsi Sumbu Ganda/Tandem)` |
| `GROSS_WEIGHT` | LTE | 25000 kg | `PP 55/2012 Lampiran JBI (Asumsi Kelas I)` |
| `DIMENSION_LENGTH` | LTE | 18000 mm | `PP 55/2012 Pasal 9` |
| `DIMENSION_WIDTH` | LTE | 2500 mm | `PP 55/2012 Pasal 7 ayat (1)` |
| `DIMENSION_HEIGHT` | LTE | 4200 mm | `PP 55/2012 Pasal 7 ayat (3)` |

### CRITICAL — two citations declare themselves assumptions

`PP 55/2012 Lampiran (Asumsi Sumbu Ganda/Tandem)` and `PP 55/2012 Lampiran JBI (Asumsi Kelas I)` contain the word **Asumsi** (assumption). They are the basis for the axle and gross-weight decisions, which are the two the demo actually exercises, and they render on screen as the legal basis for a HOLD.

`data/regulations/` contains a **scraped** corpus plus `MISSING_REGULATIONS.md` and `conflicts.json`. The repository owner has confirmed it is unverified reference material for humans, not a validated source. `CLAUDE.md` §5 forbids fabricating a regulation citation in code, seed data, or UI copy.

**Do not** treat these as verified, propagate them into new seed data, or invent replacements. Either a human verifies them against source text, or the UI must state plainly that they are provisional.

### No CLIENT rules are seeded

Precedence is implemented but currently has nothing to resolve. `PRODUCT.md` §7 step 7 depends on approving a client rule and watching a nationally-legal load turn into a HOLD. That cannot be demonstrated today.
## 11. API / backend
Base URL `/api/v1`. No authentication anywhere. `X-Client-Id` may be sent and is ignored.

| Method | Path | Output | Source | Status |
|---|---|---|---|---|
| GET | `/health/` | `{status, service}` | `backend/config/urls.py` | **Working** |
| POST | `/api/v1/validate` | 200 PASS / 403 HOLD / 400 envelope | `backend/apps/validation/views.py` + `engine.py` | **Working, DB-backed, persists a decision** |
| POST | `/api/v1/decisions/{id}/override` | 201 | *(spec only)* | Not implemented; model columns exist |
| GET | `/api/v1/decisions` | list | *(spec only)* | Not implemented |
| GET | `/api/v1/decisions/{id}` | detail, always 200 | *(spec only)* | Not implemented |
| POST | `/api/v1/documents` | triage | *(spec only)* | Not implemented |
| POST | `/api/v1/documents/{id}/extract` | candidates | *(spec only)* | Not implemented |
| GET | `/api/v1/rule-candidates` + approve/reject | | *(spec only)* | Not implemented |
| GET | `/api/v1/rules` | list | *(spec only)* | Not implemented |
| * | `/api/v1/vehicle-profiles*` | CRUD | *(spec only)* | Not implemented, `P2` |

Django admin is mounted at `/admin/`; no models are registered.

**Error handling** — `backend/config/exceptions.py` produces `{"error":{"code","message","field?"}}`. A HOLD sets `request._veto_is_hold` so it is never wrapped.
## 12. Environment

Names only. Never commit values. `backend/.env` and `frontend/.env.local` exist locally and are gitignored.

**Backend** (`backend/.env`, template at `backend/.env.example`):

```
DJANGO_DEBUG=required
DJANGO_SECRET_KEY=required when DJANGO_DEBUG is off (settings raises ImproperlyConfigured)
DJANGO_ALLOWED_HOSTS=optional, defaults to 127.0.0.1,localhost
DJANGO_CSRF_TRUSTED_ORIGINS=optional
CORS_ALLOWED_ORIGINS=optional, defaults to the Vite dev origins
DATABASE_URL=optional, falls back to local SQLite
SECURE_SSL_REDIRECT=optional, production only
GEMINI_API_KEY=optional today, required for Rule Studio
```

**Frontend** (`frontend/.env.local`, template at `frontend/.env.example`):

```
VITE_USE_MOCKS=required ("true" runs with no backend)
VITE_API_BASE_URL=optional, defaults to /api/v1
VITE_PROXY_TARGET=optional, defaults to http://127.0.0.1:8000
```

### Commands

```bash
# install
uv sync --directory backend
npm --prefix frontend install

# develop  (two terminals; Vite proxies /api to :8000)
uv run --directory backend python manage.py runserver 8000
npm --prefix frontend run dev

# database
uv run --directory backend python manage.py migrate

# test        (backend only — there is no frontend test runner)
uv run --directory backend python manage.py test apps

# lint        (frontend only — there is no backend linter configured)
npm --prefix frontend run lint

# build
npm --prefix frontend run build

# django system check
uv run --directory backend python manage.py check
```

**There is no runnable typecheck.** The frontend is JavaScript with no TypeScript configuration. The backend has a `[tool.pyright]` block in `backend/pyproject.toml`, but pyright is not a declared dependency, so there is nothing to run. Do not put a typecheck step in a task's verification list until one actually exists.

---

## 13. Git / working tree
- **Branch:** `main`, the only branch.
- **HEAD:** `4f7cbb5`. Working tree clean. 1 commit unpushed.
- **Two contributors.** `6avier` and `iqbalvirdiansyah-commits`. A merge has already happened once.
- **`.agents/`** is a directory of vendored agent skill packs. It is gitignored on purpose. Do not commit it.

```
4f7cbb5  fix(mocks): derive thresholds from the contract fixture, ignore .agents
97240c4  feat(validation): implement dynamic evaluation engine with persistence
5730bb5  docs: add engineering handoff
1f478c5  feat(dispatch): build the ERP shell, design tokens, and dispatch form
408d1f1  feat(backend): add audit and rules models, migrations, pyright config
a4530c2  Merge branch 'main'
999082e  Add files via upload            (iqbalvirdiansyah-commits)
84b5a5f  add: data folder and VETO Regulatory Corpus
```

Commits are authored `6avier`. **Do not add a `Co-Authored-By` trailer or any AI attribution.**
## 14. Known issues
### P0 — blocks a credible demo

**P0-1 · Two enforced thresholds cite themselves as assumptions.**
`PP 55/2012 Lampiran (Asumsi Sumbu Ganda/Tandem)` (16000 kg) and `PP 55/2012 Lampiran JBI (Asumsi Kelas I)` (25000 kg). These are the two rules the demo actually triggers, and the word *Asumsi* renders on screen as the legal basis for a HOLD. `data/regulations/` is scraped, unverified reference material, confirmed by the repository owner.
Files: `backend/apps/rules/migrations/0002_seed_odol_central_rules.py`.
Next action: human verification, or explicit provisional labelling in the UI. **Not an agent task.**

**P0-2 · No CLIENT rule pack is seeded, and there is no extraction fallback.**
Two symptoms of one gap. `PRODUCT.md` §7 step 7 needs a client rule to exist. `PRODUCT.md` §8 needs a pre-processed extraction result so an LLM outage costs one demo segment rather than the demo. What exists is `views.py` line 235, which infers `used_fallback` by sniffing for the string `"API error"` inside a candidate excerpt, so it cannot fire when there are zero candidates, which is exactly the failure case.

**P0-3 · The backend test suite calls Gemini live and is non-deterministic.**
Three consecutive runs on identical input gave 2, 2, then 1 errors. The suite takes 33 seconds and spends tokens on every run. This is also why `main` shipped broken earlier: the tests could not run without a key, so nothing caught a missing dependency.
Files: `backend/apps/rules/tests/test_rule_studio.py`.
Next action: inject a fake client so the suite is offline, free and deterministic.

**P0-4 · Nothing is deployed.** No `Dockerfile`, `vercel.json`, `railway.*`, `Procfile` or CI. `gunicorn` and `whitenoise` are installed and unused.

### P1

- **Directives are English inside an all-Indonesian interface**, and one carries an em-dash banned by `DESIGN.md` §8. Pinned to `engine.py` line 69. The front-axle directive also reads `"Reduce axle 1 load"` while the UI labels that field *Sumbu depan*.
- **`evaluated_at` returns a `+00:00` offset**, but `api-contract.md` §0 specifies a WIB offset. Cosmetic today because the frontend formatter renders in local time.
- **Specified motion is only partly implemented.** `DESIGN.md` §6 lists five moments; the dialog and settle are built, the rest are not.
- **`GEMINI_API_KEY` was pasted into a chat transcript.** It lives only in the gitignored `backend/.env` and appears in zero commits, but treat it as exposed and rotate after the event.

### P2

- Dead template assets: `frontend/src/assets/hero.png`, `vite.svg`, `frontend/public/icons.svg`.
- `@types/react` installed with no TypeScript in the project.
- Mobile layout unverified below `lg`.
- `VerdictPanel` and `ViolationDialog` now live in `frontend/src/components/dispatch/`; `RowSkeleton` and the table primitives in `AuditLog.jsx` are still local.
- `[tool.pyright]` is configured but pyright is not a dependency, so there is still no runnable typecheck.
- `rule_packs_applied` lists every active pack rather than only those consulted.
## 15. Next task
### Goal

Wire `/rule-studio` to the live backend. It is the last surface still on mocks, and every endpoint it needs now exists and responds.

### Why

Until it runs live, the differentiator has never been exercised against real extraction, and the demo's closing segment is unproven.

### Files likely involved

- `frontend/.env.local` — already `VITE_USE_MOCKS=false`
- `frontend/src/routes/RuleStudio.jsx` — real ids instead of fixture ids
- `frontend/src/api/ruleStudio.js` — written, mock branch only needs bypassing

### Acceptance criteria

1. Uploading a real PDF returns a real `document_id` and triage classification.
2. A document with no load constraints is rejected at triage and **no extraction call is made**.
3. Extraction returns real candidates and the split screen shows the source sentence.
4. Approve creates a real `Rule` with `origin = CLIENT`.
5. **Then demo step 7:** after approving a client rule, a nationally-legal load must HOLD on `/dispatch`, and the form's per-field ceiling for that dimension must drop to the client value, since `limits.js` keeps the strictest rule. This is the payoff and it has never been demonstrated.
6. Flip `VITE_USE_MOCKS=true` afterwards and confirm the mocked path still works, since mocks are the booth fallback.

### Verification

```bash
npm --prefix frontend run lint
npm --prefix frontend run build
uv run --directory backend python manage.py test apps
node ~/.claude/skills/impeccable/scripts/detect.mjs --json frontend/src
```

### Known risk

Extraction is non-deterministic (§14 P0-3). A short synthetic PDF sometimes yields no candidates. Use a document with a clearly worded load limit and expect to retry.
## 16. Open decisions

**DECISION 1 — Directive language**
Current options: (a) keep English per `api-contract.md` §1; (b) switch directives to Indonesian and update the contract, the fixtures, and the backend templates.
Recommended: (b). Everything around the directive is Indonesian, the proposal's own mockups used Indonesian, and this is the string judges read most. Fix the em-dash (P1-2) in the same change.
Who must decide: the repository owner. It changes a frozen contract and affects the backend lane.

**DECISION 2 — Regulation thresholds and citations**
Current options: (a) verify against primary regulation text and replace; (b) keep placeholders and never display them.
Recommended: (a), via Task B1's verified-seed mechanism.
Who must decide: a human must do the research. **Codex must not choose values.**

**DECISION 3 — Deployment target**
Current options: (a) Vercel for the frontend plus a container host for Django; (b) localhost only for the demo.
Recommended: not yet settled. Nothing is configured either way.
Who must decide: the repository owner.

**DECISION 4 — How the client rule pack comes into existence**
Current options: (a) seed it alongside the central pack; (b) create it only through Rule Studio approval.
Why it matters: the demo's closing beat depends on approving a client rule and watching a nationally-legal load turn into a HOLD. If it is already seeded, that beat is gone.
Recommended: (b).
Who must decide: the repository owner, with the Rule Studio owner.

**DECISION 5 — Whether `POST /validate` should require an API key**
`api-contract.md` §0 says no auth in MVP and that `X-Client-Id` may be ignored. Leaving it open is a deliberate, documented MVP choice.
Recommended: leave as is. Do not describe any endpoint as access-controlled.

---

## 17. Do not change

- **`api-contract.md` response shapes** without also updating `contract/*.json` and telling both lanes. The backend tests and the frontend mocks both consume those fixtures; that is the drift alarm.
- **`contract/*.json`** as a private copy. Both sides read the same files.
- **The 10 tests in `backend/apps/validation/tests/test_contract.py`.** They exist to survive the stub's replacement.
- **HTTP 403 for HOLD** and the `_veto_is_hold` exemption in `backend/config/exceptions.py`. A HOLD is a successful evaluation.
- **The gate behaviour** in `Dispatch.jsx`: editing any field invalidates the decision and re-locks *Cetak Surat Jalan*.
- **PASS has no colour.** Do not add a green success state; the unlocking button is the signal.
- **The two-system shell.** The ERP is meant to look plain and unremarkable. That is the argument, not an oversight.
- **The design tokens** in `frontend/src/index.css`. Change `DESIGN.md` first.
- **Existing routes:** `/dispatch`, `/rule-studio`, `/audit`.
- **Legal citation strings** — do not silently rewrite them, and do not invent new ones.
- **Package choices:** uv + Django + DRF, Vite + React + Tailwind v4 + axios. `CLAUDE.md` §2 marks the stack locked.
- **Python pinned to 3.12** in `backend/.python-version`.
- **Commit authorship:** `6avier` only, no AI co-author trailer.
- **JavaScript, not TypeScript.** Do not introduce `.ts`/`.tsx` or a `tsconfig` without a decision.

---

## 18. Coding conventions

Extracted from the existing code.

**Frontend**

- `.jsx` for anything with JSX, `.js` for plain modules. One default-exported component per file, named the same as the file.
- Small presentational helpers (`Section`, `Field`, `SystemTab`) live as non-exported functions below the default export in the same file until a second consumer appears.
- Imports: React first, then `@/…` aliases, then relative. `@` → `frontend/src`, `@contract` → repo-root `contract/`, both defined in `vite.config.js`.
- State is `useState` in the route component; child components are controlled via `{ value, onChange }`.
- **camelCase in JS, `snake_case` on the wire.** Conversion happens in one place per direction: `toPayload()` in `Dispatch.jsx`, and the API modules for responses.
- All number formatting goes through `frontend/src/lib/format.js`. Never inline `toLocaleString`.
- Styling is Tailwind utilities inline. Semantic tokens (`text-ink-300`, `bg-ink-900`, `rounded-veto`, `text-label`) are preferred over raw values. Raw hex appears only in `ErpLayout.jsx` and the ERP-side parts of `DispatchForm.jsx`, deliberately, because those belong to the host system's palette rather than VETO's.
- Errors surface as `ApiError` with `{ code, message, field, status }` and render as clean Indonesian sentences. Never a raw stack trace.
- Comments explain **why**, and cite the governing document by section (`PRODUCT.md F2`, `api-contract.md §1`, `DESIGN.md §4`).

- Forms carry `noValidate` and own their validation. HTML5 constraint attributes (`min`, `max`) stay for the steppers and for clamping, but native validation must not arbitrate submission: it blocks `onSubmit` before React sees it, which produces a dead button and no message.
- Numeric inputs clamp on change rather than relying on `max`, which only fails validation and does not stop typing.

- Do not use `<legend>` for a section heading you intend to space. A legend is lifted out of flow and painted on the fieldset's top border, so `padding-top` cannot move it. Use an in-flow element and keep the grouping with `aria-labelledby` on the fieldset.

**Backend**

- Function-based DRF views with `@api_view`. No class-based views, no ViewSets.
- **No DRF serializers.** Response dicts are constructed by hand so they match the contract exactly. The planned pattern for this is a `presenters.py` module per app.
- Private helpers are prefixed `_`.
- Input validation is explicit and returns the contract error envelope through a local `_error()` helper.
- Module docstrings state what the file is for and, where relevant, what still has to replace it.
- Placeholder constants are named loudly and carry a `TODO: verify`. The former `STUB_LIMITS` is gone; thresholds now live in the seed migration, where unverified figures are flagged in the citation string itself.
- Tests are `django.test.TestCase`. Test method names are full sentences describing the behaviour (`test_correcting_the_load_flips_hold_to_pass`).

**Commits**

Conventional commits (`feat`, `docs`, `chore`, `test`) with an optional scope: `feat(dispatch):`, `docs(design):`. Body explains the reasoning, not the diff.

---

## 19. Verification

Only these commands exist in this repository.

```bash
uv run --directory backend python manage.py test apps      # 10 tests, must stay green
uv run --directory backend python manage.py check
npm --prefix frontend run lint                             # oxlint
npm --prefix frontend run build                            # vite build
```

There is no design-linter checked into this repository. A local Impeccable detector was used during development from outside the repo; do not depend on it.

There is **no** `typecheck`, **no** frontend test command, and **no** backend linter. Do not invent them.

`CLAUDE.md` §6 requires verifying the rendered application, not just a passing build, before calling frontend work complete.

---

## 20. Handoff contract

### Codex Instructions

1. Read this `HANDOFF.md` first.
2. Inspect the repository before editing.
3. Read the relevant files referenced in this document.
4. There is no `AGENTS.md`; read `CLAUDE.md` and obey it. `PRODUCT.md`, `DESIGN.md`, and `api-contract.md` are also binding.
5. Do not rewrite working code without a reason.
6. Do not create duplicate components when an existing component can be reused — check §8 first.
7. Do not invent missing requirements.
8. Do not invent regulatory rules or legal citations. Every threshold currently in the repo is unverified; treat verification as a human task.
9. Do not expose secrets. `backend/.env` and `frontend/.env.local` are gitignored and must stay that way.
10. Run the verification commands in §19 after implementation.
11. Report exactly what changed, what was verified, and what remains unresolved.
