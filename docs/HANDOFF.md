# VETO — Engineering Handoff

## 1. Header
| | |
|---|---|
| **Project** | VETO |
| **Date** | 2026-08-13, updated ahead of a fresh-session handoff |
| **Branch** | `main` · HEAD `6fad2c8` · clean · pushed, 0 ahead 0 behind |
| **Remote** | `https://github.com/6avier/veto.git` |
| **Deadline** | Working product **2026-08-13 23:55 WIB**. Demo + booth **2026-08-14**. |
| **Handoff status** | **IN PROGRESS.** `TruckEnvelope` (the plain-rectangle dispatch gimmick) shipped and Iqbal's CLIENT rule pack seed landed — demo step 7 is now provable. Immediate next task is below: the illustrated redesign of `TruckEnvelope` has a committed, approved plan but **zero implementation** — nothing has been coded yet. |

**Lanes.** Iqbal owns `backend/`. The other lane owns `frontend/`. Shared seam: `api-contract.md`, `contract/*.json`, `frontend/src/api/`.

**Since the last refresh:** the truck-envelope dispatch widget (design → plan → subagent-driven build → real-browser Playwright verification, which caught bugs no source read did) shipped and merged (`66124b7`). Separately, Iqbal seeded the CLIENT rule pack (`65bc380`) — **P0-2 from §14 below is done**, demo step 7 (approve a client rule, watch a nationally-legal load HOLD) should now be provable; verify it before assuming so. A follow-up redesign of the same widget — illustrated truck instead of plain rectangles — went through a full visual brainstorm (screenshot-verified mockups, not just hand-eyeballed SVG) and has a committed design spec and task-by-task implementation plan, **not yet built**. See §15.

**Both lanes pushed to `main` the same day on 2026-08-12/13.** Fetch and rebase before starting. See §13.

`AGENTS.md` is a pointer, not context. For a cold start read
[HANDOFF-BRIEF.md](HANDOFF-BRIEF.md) first; this file is the full version.
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
### Working live against the backend

- **`POST /api/v1/validate`** — DB-backed engine, persists a decision plus violations. Swept 12 cases, 0 mismatches: every dimension fires, `LTE` boundaries exact, 3-axle configs evaluate per axle, four simultaneous violations all return, malformed payload returns the contract error envelope.
- **`/dispatch`** — verified end to end. Violations map to the correct fields, tronton `1.22` grows a third axle input, PASS unlocks *Cetak Surat Jalan*, editing re-locks it.
- **`/audit`** — reads `GET /decisions` and `/decisions/{id}` for real. 34 decisions render, rows expand to violations, citations, rule pack versions.
- **All twelve endpoints respond.**

- **`/rule-studio`** — **now verified live** (2026-08-12). Upload, triage, live Gemini extraction, source-page plate, split-screen review. Two things had to be fixed to get there, both in §14: extraction had never actually run, and the free-tier quota is 20 calls per day.

### Working on mocks only

Nothing. Every surface has been exercised against the live backend.

### Built this session, frontend

- **HOLD is a dialog then a settle.** Announces over a blurred backdrop, dismisses to the side panel, violations stay pinned under the offending fields. Warning icon is Phosphor `WarningIcon`, amber.
- **Fields report excess only.** `+1.340 kg melebihi batas` when over, silence otherwise. Ceilings come from `GET /rules` at runtime and are never displayed.
- **Digit caps.** Six digits for weights, five for dimensions, clamped on change. `9000000000000` is refused; `12000` is not.
- **Zero invalid on every numeric field**, including the three dimension fields which previously had no validation at all.
- **ERP has its own identity.** Forest green `#2d613b` sampled from the proposal mockup, and **SAP 72** — the actual SAP Fiori typeface, Apache-2.0, vendored in `frontend/src/assets/fonts/` with licence and notice. Brand and page heading at Bold 700.
- **`/audit`** built from nothing, append-only visible in the UI.

### Built 2026-08-12

- **Directives are Indonesian.** Settles open decision 4. `Kurangi muatan total 500 kg`, id-ID thousands separators, no em-dash, axles named `sumbu depan/tengah/belakang` to match the form's own labels. Engine, fixture and contract moved together.
- **Rule Studio source plate.** `GET /documents/{id}/pages/{n}` renders a page to an inline PNG and returns the rectangles each candidate clause occupies, as percentages of the page box. `SourcePlate.jsx` draws the page and marks the clause behind the rule under review. Only that one candidate is marked: drawing all of them lit 106 boxes across most of a table.
- **Live extraction unbroken.** See §14 P0-3.

### Placeholder

- Persona strings in `ErpLayout.jsx` are hardcoded, not a user model.
- `loading_point_id: 'LP-CIKARANG-01'` hardcoded in `Dispatch.jsx`.
- Audit log was cleared and regenerated on 2026-08-12; all stored directives are Indonesian. Local SQLite only, `DATABASE_URL` unset.

### Not implemented

- No CLIENT rule pack seeded. No deployment. `apps/profiles` has endpoints but no UI (`P2`).
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
System of record is **`DESIGN.md`**, implemented in `frontend/src/index.css` as a Tailwind v4 `@theme`. Change `DESIGN.md` first.

### Two systems, two typefaces

| | ERP (host) | VETO |
|---|---|---|
| Typeface | **SAP 72** (Apache-2.0, vendored) | **Archivo** + JetBrains Mono for identifiers |
| Ground | `#eef0f2`, green `#2d613b` chrome | white panels, graphite only on `/audit` copy |
| Role | ordinary software the officer already uses | the instrument speaking inside it |

72 is metrically almost identical to Archivo (x/cap identical to three decimals), so it dropped in without retuning anything. **Scope is strict**: the verdict panel and HOLD dialog pin back to Archivo with `font-sans` even though they render inside the ERP's DOM tree.

### Decisions that are easy to get wrong

- **PASS has no colour.** The signal is *Cetak Surat Jalan* unlocking. Do not add a green tick.
- **Amber is the only VETO accent.** The ERP's green is a documented exception and belongs to the host. VETO never uses green.
- **No monospace in the ERP chrome.** Mono uppercase with wide tracking is a terminal signature; no shipping ERP uses it. It was the single thing making the host read as robotic.
- **Do not copy sap.com's marketing hero.** That is 72 Black at 56px. Fiori product UI looks nothing like it. Bold 700 is as far as product register goes; 72 Black is deliberately not vendored.
- **Section titles are not `<legend>`.** A legend renders on the fieldset's top border and `padding-top` cannot move it. Use an in-flow element with `aria-labelledby`.

### Known gaps

- Motion: dialog and settle are built; the other moments in `DESIGN.md` §6 are not.
- Mobile unverified below `lg`.
- Input treatment options (Fiori value-state / Fluent filled / ruled grid) were specced and shown but **not chosen**. See §16.
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

**Traced 2026-08-12 — the word "Asumsi" is ours, not the regulation's.** It appears zero times across `data/` and zero times in `VETO_Regulatory_Corpus.md`. `MISSING_REGULATIONS.md` names the cause as CRITICAL GAP #1: the Lampiran of PP 55/2012, which holds the definitive JBI tables by axle configuration, was never obtained. The corpus's own vehicle records carry `"verification_required": true` and the note `"JBI PERLU VERIFIKASI dari lampiran PP 55/2012"`.

**And the numbers disagree.** The corpus records `MST_rear_tandem_kg: 18000`; the engine enforces `16000`. See §14 P0-1 for the full trace and the source PDF link.

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
- **Branch:** `main`, the only branch on the remote. Everything ships straight to it. (The plain-rectangle `TruckEnvelope` shipped via a short-lived `feature/truck-envelope` branch + PR-style merge, per its own plan's process — that branch is deleted, both locally and on the remote, work is fully on `main`.)
- **HEAD:** `6fad2c8` as of 2026-08-13. Working tree clean, pushed, in sync.
- **Two contributors.** `6avier` and `iqbalvirdiansyah-commits`. Iqbal's commits land as `6avier <6avier@users.noreply.github.com>`.
- **`.superpowers/`** is now gitignored (added alongside the truck-envelope illustrated-redesign brainstorm) — scratch workspace for SDD ledgers and the visual-companion brainstorming server, never meant to be committed.
- **A stale worktree exists** at `/private/tmp/veto-dispatch-finish` on `codex/dispatch-finish`, 2 commits, superseded by `main`. Not cleaned up.
- **`.agents/`** is a directory of vendored agent skill packs. It is gitignored on purpose. Do not commit it.

```
6fad2c8  docs(dispatch): add the illustrated truck envelope implementation plan
b381d44  docs(dispatch): resolve the two open questions in the illustrated redesign spec
7e45491  docs(dispatch): design the illustrated truck envelope redesign
66124b7  Merge branch 'feature/truck-envelope'
65bc380  feat(rules): seed Client SOP rules and finalize closing beat   (Iqbal)
19a29ea  docs: refresh both handoffs for the evening session
5c867c7  feat(rule-studio): show the source page with the clause marked
```

Commits are authored `6avier`. **Do not add a `Co-Authored-By` trailer or any AI attribution.**
## 14. Known issues
### P0 — blocks a credible demo. None of these are frontend.

**P0-1 · Two enforced thresholds cite themselves as assumptions.**
`PP 55/2012 Lampiran (Asumsi Sumbu Ganda/Tandem)` (16000 kg) and `PP 55/2012 Lampiran JBI (Asumsi Kelas I)` (25000 kg). These are the two rules the demo triggers, and the word *Asumsi* renders on screen as the legal basis for a HOLD.

Traced 2026-08-12. **The word is ours, not the regulation's.** It appears zero times in `data/` and zero times in `VETO_Regulatory_Corpus.md`. The cause is in `data/regulations/MISSING_REGULATIONS.md`, CRITICAL GAP #1: the Lampiran of PP 55/2012 — the annex holding the definitive JBI tables — was never obtained. The corpus records flag themselves too: `"verification_required": true`, `"JBI PERLU VERIFIKASI dari lampiran PP 55/2012"`.

**There is also a numeric conflict.** The corpus carries `MST_rear_tandem_kg: 18000` (VRULE_002, VRULE_003) while the engine enforces **16000**. Two different figures, and the one in use is not the one in the corpus.

Source PDF: https://peraturan.bpk.go.id/Details/5307
Files: `backend/apps/rules/migrations/0002_seed_odol_central_rules.py`, `0005_seed_detailed_axle_rules.py`. **Human task, not an agent task. Do not choose values.**

If the annex cannot be verified in time, the safer move is not to change the number but to change the string so it cannot be read as a citation — e.g. `PP 55/2012 Lampiran · angka belum diverifikasi`. **Owner decides.**

**P0-2 · No CLIENT rule pack is seeded.**
It exists only inside `test_contract.py`'s `setUp`. `PRODUCT.md` §7 step 7 — approve a client rule, watch a nationally-legal load HOLD — **has never been demonstrated and cannot be today.** This is the demo's closing beat.

**P0-3 · The Gemini free tier allows 20 extraction calls per day, and extraction had never actually run.**

Two separate findings, both 2026-08-12.

*The bug.* `apps/rules/views.py` called `json.loads` without ever importing `json`. Every extraction raised `NameError`, was swallowed by a broad `except`, and returned the hardcoded fallback. **Live AI extraction had never once succeeded.** The `25.000 kg` tagged `gemini-extracted` on screen was never read from any document. Fixed in `3912607`; the same 26-page PDF then yielded 15 real candidates.

*The quota.* What looked like non-determinism is rate limiting:

```
quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier
quotaValue: 20
```

Twenty calls **per day**, per model. At a booth this runs out in minutes and every visitor after that sees the fallback. `gemini-flash-lite-latest` works and carries a separate daily quota — verified. `gemini-2.0-flash` and `gemini-2.5-flash` both 404 for this key. To switch: `echo "GEMINI_MODEL=gemini-flash-lite-latest" >> backend/.env`.

*Consequence for the suite.* `test_approve_candidate` and `test_reject_candidate` now error. They were green **because** extraction was broken: the fallback always returned exactly one candidate, so `["candidates"][0]` always worked. Confirmed by stashing the fix — old code passes, fixed code fails. The mock PDF contains only the word `"SOP"`, so real extraction returns `[]`. Injecting a fake client fixes both the flakiness and the quota dependency.
File: `backend/apps/rules/tests/test_rule_studio.py`.

*Also.* If `GEMINI_API_KEY` is empty, `candidates_data` stays `[]` and `used_fallback` stays `False` — zero candidates with no signal that extraction never ran.

**P0-4 · Nothing is deployed.** No `Dockerfile`, `vercel.json`, `railway.*`, `Procfile` or CI. `gunicorn` and `whitenoise` are installed and unused. Roughly a day and a half remains.

### P1

- ~~Directives are English~~ **Fixed 2026-08-12** (`2fc63ba`). Indonesian, id-ID separators, no em-dash, axles named to match the form labels.
- ~~`evaluated_at` returns `+00:00`~~ **Fixed.** Now returns `+07:00`.
- **`backend/api-contract.md` is a stale tracked duplicate** of the root `api-contract.md`, 16 lines out of date: English directives, the old `1.22` axle notation, and a different citation (`PM 111/2015 Pasal 4 ayat (2)` with 16100/1200). The root file is canonical per `CLAUDE.md` §2. Anyone reading the backend copy builds to a wrong contract. Left in place because it is the other lane's file — **needs a decision, then deletion.**
- **Clause highlighting is text search.** A figure that also appears elsewhere on the page gets marked too. UI copy says *kemunculan*, not *sumber*, and must keep saying so.
- **`GEMINI_API_KEY` was pasted into a chat transcript.** It lives only in gitignored `backend/.env` and appears in zero commits, verified with `git log --all -S`. **Rotate after the event.**
- **`GEMINI_MODEL` matters.** `gemini-2.5-flash` returns 404 for keys created after its cutoff even though `models.list()` still advertises it. Default is now `gemini-flash-latest` via `settings.GEMINI_MODEL`.

### P2

Dead template assets (`hero.png`, `vite.svg`, `public/icons.svg`); `@types/react` with no TypeScript; mobile unverified; `RowSkeleton` and table primitives still local to `AuditLog.jsx`; pyright configured but not installed so there is still no typecheck; `rule_packs_applied` lists every active pack rather than those consulted.
## 15. Next task
### Goal

Execute `docs/plans/2026-08-13-truck-envelope-illustrated-implementation.md` — replace `TruckEnvelope.jsx`'s plain-rectangle rendering with an illustrated truck (cab, wheels, panel lines), task by task. **Nothing in this plan is built yet** — the design spec and implementation plan are both committed and approved, but the code is still the plain-rectangle version that shipped in `66124b7`.

### Why

Pure P2 demo polish (`CLAUDE.md` §4) on top of an already-working, already-merged widget — this is not blocking the demo the way P0-1/P0-3/P0-4 below are. It exists because the product owner asked for it after seeing the shipped plain-rectangle version and wanted more visual "wow" for the booth. If time runs short before 2026-08-14, **this is the thing to drop**, not the P0 items.

### Read first

`docs/plans/2026-08-12-truck-envelope-illustrated-design.md` (the design — read this for the *why* behind each decision) then `docs/plans/2026-08-13-truck-envelope-illustrated-implementation.md` (the 7-task plan — this is what you actually execute). The design doc's §7 is worth internalizing before starting: hand-computed SVG coordinates produced several real, invisible-from-source bugs during the brainstorm (floating disconnected mirrors, misaligned centering, inconsistent per-state wheel offsets) that were only caught by an actual Playwright screenshot. **Every visual task in the plan has a mandatory self-verification screenshot step — do not skip it and do not trust the coordinates as written without looking at the render.**

### Order of work

The plan's 7 tasks are already ordered and each ends in a commit: (1) green colour + `DESIGN.md` exception, (2) bottom-anchor the side view's height (a real prerequisite once wheels/cab sit on a fixed ground line, not just polish), (3) side cab, (4) top cab, (5) panel lines, (6) side wheels (fixed), (7) top-down wheels (animated, anchored to the live input box on both axes — flagged in the plan as the task most likely to need iteration).

### Acceptance

All 7 tasks committed, `npm --prefix frontend run lint`/`build` clean throughout, every visual task's self-verification screenshot checklist actually confirmed (not assumed), no regression to the widget's existing behaviour (geometry math, reduced-motion handling, placement on `/dispatch` all unchanged per the design doc §1).

### Verification

```bash
npm --prefix frontend run lint
npm --prefix frontend run build
```

No backend changes in this plan, so no `manage.py test` run is required for it specifically — but if this session also touches anything under `backend/` for an unrelated reason, run the full suite per §19.
## 16. Open decisions
Codex must not silently decide these.

**1 · Input treatment.** Three options were built and shown at `scratchpad/fonts/input-specimen.html`: **A** Fiori value-state (unit inside the field, number right-aligned, 2px green bottom edge on focus), **B** Fluent filled (grey wells, white on focus), **C** ruled data grid (no boxes, hairline rows). All three right-align numerics and move the unit into the field, which is the strongest "enterprise software" signal available. Recommended **A**. C has an affordance risk at the booth: fields do not look like fields until hover. **Owner decides.**

**2 · VETO's typeface.** Archivo is still VETO's face. The owner wants to revisit it now that the ERP has 72. Not started.

**3 · Warning icon colour.** The HOLD dialog icon is amber, matching the one-accent lock. The owner's reference image was red. Switching means switching the whole set, not one icon. **Owner decides.**

**4 · Directive language. SETTLED 2026-08-12 — Indonesian.** Owner chose it. Shipped in `2fc63ba` across `engine.py`, `contract/validate.response.hold.json` and `api-contract.md` §1, with id-ID thousands separators and the em-dash replaced by a second sentence. Axles are named `sumbu depan/tengah/belakang` to match the form's own labels. Kept here as a record; not open.

**5 · Regulation thresholds.** Must be verified by a human against source text. **Codex must not choose values or invent citations.**

**6 · Deployment target.** Nothing configured. Owner decides.
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
