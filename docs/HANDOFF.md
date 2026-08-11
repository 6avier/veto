# VETO — Engineering Handoff

## 1. Header

| | |
|---|---|
| **Project** | VETO |
| **Date** | 2026-08-11, 17:29 WIB |
| **Branch** | `main` |
| **Commit** | HEAD is the commit that added this file. `5247f90` is the last commit that changed code. |
| **Working tree** | Clean. No uncommitted changes, no untracked files. |
| **Unpushed** | 2 commits ahead of `origin/main` (`5247f90`, plus this handoff). **Push them.** |
| **Remote** | `https://github.com/6avier/veto.git` |
| **Tracked files** | 101 |
| **Primary objective** | Make `dispatch data → PASS/HOLD + actionable directive` work end to end, on real seeded rules, for a live demo on 2026-08-14. Working product due **2026-08-13 23:55 WIB**. |
| **Handoff status** | **NEEDS_REVIEW** — the code builds, runs, and is fully tested at its current scope, but the validation engine is an explicitly-marked stub and every legal threshold in the repo is unverified. See §10 and §16. |

There is **no `AGENTS.md`**. `CLAUDE.md` at the repo root is the authoritative agent instruction file and applies to any agent working here.

---

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

### Working

- **`POST /api/v1/validate`** — `backend/apps/validation/views.py`. Accepts the contract payload, validates input types, evaluates gross weight / per-axle load / three dimensions, returns contract-exact `PASS` (200) or `HOLD` (403) with all violations. Thresholds are hardcoded (see Placeholder).
- **`GET /health/`** — `backend/config/urls.py`. Returns `{"status":"ok","service":"veto-api"}`.
- **Contract error envelope** — `backend/config/exceptions.py`. A HOLD is exempted so it is never wrapped as an error.
- **10 backend tests, all passing** — `backend/apps/validation/tests/test_contract.py`. They assert live responses against `contract/*.json`, including that a HOLD is not an error envelope, that `axle_index` appears only on `AXLE_LOAD`, and that correcting the load flips HOLD to PASS.
- **`/dispatch` surface** — `frontend/src/routes/Dispatch.jsx` + `frontend/src/components/dispatch/DispatchForm.jsx`. Full loop verified in a browser: submit → `LOLOS`, the *Cetak Surat Jalan* button unlocks; change a figure → verdict clears and the button re-locks; submit an overloaded payload → `TAHAN` in amber with both violations, each showing actual/limit and its citation, `CLIENT`-origin rules prefixed `[ SOP KLIEN ]`.
- **The gate.** Editing any form field invalidates the decision and re-locks the print button. This is the core product behaviour and it works.
- **ERP/VETO shell** — `frontend/src/App.jsx`. Segmented control always visible, routes switch between the two systems.
- **Mock layer** — `frontend/src/mocks/index.js`. Every contract endpoint returns its fixture behind `VITE_USE_MOCKS=true`. The frontend runs with no backend at all.
- **axios 403 handling** — `frontend/src/api/validation.js`. `validateDispatch()` returns the decision for both PASS and HOLD and only throws on genuine failures.

### Partial

- **`frontend/src/api/`** — all eleven contract endpoints have working client functions and mock branches, but only `validateDispatch` has a live backend to talk to. `audit.js` and `ruleStudio.js` will 404 with `VITE_USE_MOCKS=false`.
- **`frontend/src/lib/format.js`** — `formatNumber`, `formatKg`, `formatMm`, `formatTonnes`, `parseInteger`, `formatTimestamp`, `axleCountFor` all exist. `parseInteger`, `formatMm`, and `formatTimestamp` are currently unused by any component.

### Placeholder

- **`STUB_LIMITS`** in `backend/apps/validation/views.py` — hardcoded thresholds standing in for a seeded rule pack. The module docstring marks it `STUB` and lists the four steps to replace it.
- **`RULE_PACKS`** in the same file — two hardcoded pack descriptors with fixed UUIDs and versions. No database rows exist.
- **`frontend/src/routes/RuleStudio.jsx`** and **`AuditLog.jsx`** — headed, styled, correctly grounded, but no functionality. Each names the plan file that specifies it.
- **Persona labels** in `App.jsx` (`Budi · Gudang Cikarang`, `Sari · Compliance`) are hardcoded strings, not a user model.
- **`loading_point_id: 'LP-CIKARANG-01'`** is hardcoded in `Dispatch.jsx`.

### Not implemented

- **Every Django model.** All four `models.py` files contain only Django's generated `# Create your models here.` comment. There are no app migrations, no `Rule`, no `RulePack`, no `DecisionRecord`, no `SourceDocument`.
- **No decision is persisted.** `PRODUCT.md` F1 requires an audit record before the response returns. Nothing is written.
- **Endpoints in `api-contract.md` with no implementation:** `POST /decisions/{id}/override`, `GET /decisions`, `GET /decisions/{id}`, `POST /documents`, `POST /documents/{id}/extract`, `GET /rule-candidates`, approve/reject, `GET /rules`, all of `/vehicle-profiles`. Their `urls.py` files exist with empty `urlpatterns`.
- **No rule-pack precedence engine.** The stub hardcodes which rule wins.
- **No LLM integration.** `pymupdf` is installed but imported nowhere.

### Broken

Nothing is broken. Build passes, lint is clean, all 10 tests pass, `manage.py check` reports no issues.

Two **correctness** problems that are not crashes but must not ship — see §10 and §14.

---

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
| `VerdictPanel` | `frontend/src/routes/Dispatch.jsx` (local) | VETO's graphite panel inside the ERP page. Idle / pending / error / decision states. | `{ decision, error, pending }` | **Extract this before F2.** It is the demo's hero and belongs in `frontend/src/components/dispatch/`. |

**Not built, and needed:** override dialog, audit table and row detail, badge/status primitive, Rule Studio drop zone, triage result, extraction stage reveal, candidate split-screen review, loading skeletons, empty states. All are specified in the two plan files under `docs/plans/`.

No charts exist and none are specified.

---

## 9. Data model

### ACTUAL IMPLEMENTED MODEL

**There are no database models.** All four `models.py` files are Django's empty generated stubs. The only data structures that exist are:

**1. The wire contract** — defined in `api-contract.md`, exemplified in `contract/*.json`, and hand-built in `backend/apps/validation/views.py`. Units are integer kilograms and integer millimetres; keys are `snake_case`; enums are UPPERCASE.

Validate request:
```
dispatch_ref: string
vehicle: { profile_id?: uuid, axle_config: string, tare_weight_kg: int }
load: { gross_weight_kg: int, axle_loads_kg: int[], dimensions_mm: {length,width,height} }
loading_point_id: string
```

Validate response:
```
decision_id: uuid, outcome: "PASS"|"HOLD", dispatch_ref: string,
violations: Violation[], rule_packs_applied: RulePackRef[],
latency_ms: int, evaluated_at: ISO8601+07:00
```

`Violation`:
```
dimension: GROSS_WEIGHT | AXLE_LOAD | DIMENSION_LENGTH | DIMENSION_WIDTH
         | DIMENSION_HEIGHT | AXLE_CONFIG
axle_index?: int          // present ONLY when dimension === AXLE_LOAD
actual_value: int, limit_value: int, excess_value: int, unit: "kg"|"mm"
severity: "BLOCKING" | "WARNING"      // MVP emits BLOCKING only
rule_origin: "CENTRAL" | "CLIENT"
legal_citation: string
directive: string          // complete sentence, rendered verbatim by the UI
```

`RulePackRef`: `{ id: uuid, domain: "ODOL", version: int, origin: "CENTRAL"|"CLIENT" }`

**2. Frontend form state** — `DEFAULTS` in `frontend/src/routes/Dispatch.jsx`. camelCase, all values held as **strings** while editing, converted to integers by `toPayload()`.

**3. Constants** — `STUB_LIMITS` and `RULE_PACKS` in `backend/apps/validation/views.py`.

There are **no TypeScript types or interfaces anywhere**; the project is plain JavaScript.

### PLANNED MODEL — specified, no code exists

Fully specified in `docs/plans/2026-08-11-rule-studio.md` Task B1 (Django model code is written out there, ready to paste) and `PRODUCT.md` §6:

`SourceDocument`, `RulePack`, `Rule`, `RuleCandidate`, `DecisionRecord`, `Override`, `VehicleProfile`.

Note the naming decision recorded in the P0 plan: the persisted model is **`DecisionRecord`**, not `Decision`, to avoid colliding with the engine's `Decision` dataclass.

Concepts named in the product but **absent from both code and the planned model**: `Route` and `Road Class`. Road-class-aware validation is explicitly out of scope (`PRODUCT.md` §3) and is a documented known gap — do not add it, and do not let UI copy imply it exists.

---

## 10. Compliance logic

**All compliance logic lives in one file:** `backend/apps/validation/views.py`. It is **hardcoded, not data-driven**, and the module docstring marks it `STUB`.

### Rule 1 — Gross weight

- **Input:** `load.gross_weight_kg`
- **Condition:** `gross_weight_kg <= 24000`
- **Threshold:** client limit `24000` kg. A central limit of `25000` kg is stored but only ever quoted inside the directive text for contrast; it is never independently enforced.
- **Output:** `GROSS_WEIGHT` violation, `rule_origin: CLIENT`
- **Citation in code:** `SOP Internal Gudang Cikarang v2 §3.1`
- **Source:** `backend/apps/validation/views.py` → `STUB_LIMITS["gross_weight_kg"]`, `_check_gross_weight()`
- **Status:** hardcoded

### Rule 2 — Per-axle load

- **Input:** `load.axle_loads_kg[]`, ordered front to rear
- **Condition:** `axle_loads_kg[i] <= [10000, 16100][i]`; indexes beyond the list reuse the last value
- **Output:** one `AXLE_LOAD` violation per exceeded axle, with zero-based `axle_index`, `rule_origin: CENTRAL`
- **Citation in code:** `PM 111/2015 Pasal 4 ayat (2)`
- **Source:** `STUB_LIMITS["axle_load_kg"]`, `_check_axle_loads()`
- **Status:** hardcoded

### Rule 3 — Load dimensions

- **Input:** `load.dimensions_mm.{length,width,height}`
- **Condition:** `length <= 18000`, `width <= 2500`, `height <= 4200`
- **Output:** `DIMENSION_LENGTH` / `DIMENSION_WIDTH` / `DIMENSION_HEIGHT`, `rule_origin: CENTRAL`
- **Citation in code:** `PM 111/2015 Pasal 5`
- **Source:** `STUB_LIMITS["dimensions_mm"]`, `_check_dimensions()`
- **Status:** hardcoded, and already carries an inline `TODO: verify` comment

### Precedence

Not implemented as logic. The stub simply decides in code that the client gross-weight limit is the one enforced. Real precedence (strictest wins, origin-agnostic) is specified in `docs/plans/2026-08-11-validation-engine-and-dispatch.md` Task B2.

### CRITICAL — every legal citation in this repository is UNVERIFIED

The three citation strings above (`PM 111/2015 Pasal 4 ayat (2)`, `PM 111/2015 Pasal 5`, `SOP Internal Gudang Cikarang v2 §3.1`) and all associated numbers originated in the `api-contract.md` draft as illustrative examples. **They have not been checked against any regulation text.** They also appear in `contract/validate.response.hold.json` and `contract/rules.list.json`.

`CLAUDE.md` §5 forbids fabricating a statistic or a regulation citation in code, seed data, or UI copy.

**Codex must not** treat these as authoritative, propagate them into new seed data, or invent replacements. Verification is a human research task, specified as Task B1 of the P0 plan, which includes a seed loader that mechanically refuses any rule lacking `verification.status = VERIFIED`, a source URL, and an article-level citation.

Note also that the official PM 60/2019 PDF published by BPK is a ~24 MB **scan with no text layer**, so it cannot be parsed programmatically.

---

## 11. API / backend

Base URL `/api/v1`. No authentication on any endpoint. `X-Client-Id` may be sent and is ignored.

| Method | Path | Input | Output | Source | Status |
|---|---|---|---|---|---|
| GET | `/health/` | — | `{status, service}` | `backend/config/urls.py` | **Working** |
| POST | `/api/v1/validate` | validate request | 200 PASS / 403 HOLD / 400 envelope | `backend/apps/validation/views.py` | **Working (stub thresholds, no persistence)** |
| POST | `/api/v1/decisions/{id}/override` | `{reason, overridden_by}` | 201 override | *(spec only)* | Not implemented |
| GET | `/api/v1/decisions` | query filters | `{results,total,limit,offset}` | *(spec only)* | Not implemented |
| GET | `/api/v1/decisions/{id}` | — | decision + override + payload, always 200 | *(spec only)* | Not implemented |
| POST | `/api/v1/documents` | multipart `file` | 201 triage result | *(spec only)* | Not implemented |
| POST | `/api/v1/documents/{id}/extract` | `{force}` | candidates + `used_fallback` | *(spec only)* | Not implemented |
| GET | `/api/v1/rule-candidates` | `?status=` | `{results,total}` | *(spec only)* | Not implemented |
| POST | `/api/v1/rule-candidates/{id}/approve` | `{reviewed_by}` | approval result | *(spec only)* | Not implemented |
| POST | `/api/v1/rule-candidates/{id}/reject` | `{reviewed_by,note}` | rejection result | *(spec only)* | Not implemented |
| GET | `/api/v1/rules` | `?origin=&dimension=` | `{results,total}` | *(spec only)* | Not implemented |
| * | `/api/v1/vehicle-profiles*` | CRUD | — | *(spec only)* | Not implemented — `P2` |

Django admin is mounted at `/admin/` with default auth; no models are registered.

**Error handling.** `backend/config/exceptions.py` rewrites DRF exceptions into `{"error":{"code","message","field?"}}` with codes `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `CONFLICT` (409), `UPSTREAM_TIMEOUT` (504), `INTERNAL_ERROR`. A HOLD sets `request._veto_is_hold` so it is never wrapped.

**Database queries:** none. **External APIs:** none called.

---

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

**There is no typecheck command.** The project is JavaScript with no TypeScript configuration. Do not add one to a task's verification list.

---

## 13. Git / working tree

- **Branch:** `main`. It is the only branch, local or remote.
- **HEAD:** the commit adding this handoff. Last code change: `5247f90`.
- **Working tree:** clean — `git status --short` is empty, `git diff HEAD` is empty.
- **Unpushed:** 2 commits ahead of `origin/main`. **Push them.**
- **Work in progress:** none. There are no stashes, no partial edits, no intentionally-uncommitted files.

```
<HEAD>   docs: add engineering handoff  (this file)
5247f90  feat(dispatch): build the ERP shell, design tokens, and dispatch form
f0b42f0  docs(design): pick Archivo and JetBrains Mono on measured evidence
5ab0c51  docs: establish the VETO visual system
927484f  docs: add implementation plans for P0 and Rule Studio
4e51849  feat: scaffold split frontend and backend lanes
7f61c58  feat(contract): freeze the frontend/backend API contract
22f115c  chore: initial commit — project docs and hackathon materials
```

Commits are authored `6avier <xavierkemas@gmail.com>`. **Do not add a `Co-Authored-By` trailer or any AI attribution** — this is an explicit standing instruction from the repository owner.

---

## 14. Known issues

### P0 — blocks development

**P0-1 · The validation engine is a stub with no rule packs and no persistence.**
Impact: `PRODUCT.md` F1 requires an audit record before the response returns and a recorded rule-pack version per decision. Neither exists, so the audit log, override, and Rule Studio precedence features have nothing to build on.
Files: `backend/apps/validation/views.py`, all four empty `models.py`.
Cause: established — the scaffold deliberately shipped contract-exact shapes first.
Next action: `docs/plans/2026-08-11-validation-engine-and-dispatch.md`, Tasks B2 → B4.

**P0-2 · Every legal threshold and citation in the repo is unverified.**
Impact: presenting invented citations at a judged demo, against an explicit rule in `CLAUDE.md` §5.
Files: `backend/apps/validation/views.py` (`STUB_LIMITS`), `contract/validate.response.hold.json`, `contract/rules.list.json`, `api-contract.md` §1 and §5.
Cause: established — example values from the contract draft were carried into code.
Next action: human research, Task B1 of the P0 plan. **Not an agent task.**

### P1 — important

**P1-1 · Directive strings are English inside an all-Indonesian interface.**
`"Reduce rear axle load by 1,200 kg"` renders beside `Berat Kotor` and `Cetak Surat Jalan`. `api-contract.md` §1 mandates English; `DESIGN.md` §7 mandates Indonesian UI and says directives render verbatim from the server. The two documents genuinely conflict. This is the most-read string in the demo.
Files: `api-contract.md` §1, `contract/validate.response.hold.json`, `backend/apps/validation/views.py`.
Next action: needs a decision — see §16.

**P1-2 · A directive contains an em-dash**, which `DESIGN.md` §8 bans in user-visible copy: `"Reduce total load by 500 kg — client policy is stricter…"`. Same files as P1-1; fix together.

**P1-3 · No deployment configuration exists** although a public URL is the stated plan for the booth. `gunicorn` and `whitenoise` are installed but unused.
Next action: decide the target (see §16), then add config early, not on demo day.

**P1-4 · `index.html` still says `<title>frontend</title>`** and ships the Vite default favicon.
File: `frontend/index.html`.

**P1-5 · Specified motion is not implemented.** `DESIGN.md` §6 defines three animated moments; the verdict currently appears instantly.
File: `frontend/src/routes/Dispatch.jsx`.

### P2 — polish

**P2-1 · Dead template assets**, tracked but referenced nowhere: `frontend/src/assets/hero.png`, `frontend/src/assets/vite.svg`, `frontend/public/icons.svg`. Only `favicon.svg` is used.

**P2-2 · `@types/react` and `@types/react-dom` are installed** but the project has no TypeScript.

**P2-3 · Mobile layout unverified.** Nothing has been checked below `lg`.

**P2-4 · `VerdictPanel` is defined inside `Dispatch.jsx`** rather than in `frontend/src/components/dispatch/`. Extract it before growing it.

**P2-5 · Unused exports** in `frontend/src/lib/format.js`: `parseInteger`, `formatMm`, `formatTimestamp`.

---

## 15. Next task

### Goal

Replace the stub evaluation in `backend/apps/validation/views.py` with a pure, unit-tested engine in `backend/apps/validation/engine.py`, keeping the existing hardcoded thresholds exactly as they are and preserving every response shape.

### Why

It is the single change that unblocks the most: decision persistence, the audit endpoints, the override endpoint, and Rule Studio's client-rule precedence all need an engine that evaluates a *list of rules* rather than a hardcoded ladder. It is also safely agentic — it is pure refactoring plus tests, and it requires **no legal research and no new threshold values**, which keeps it clear of P0-2.

### Files likely involved

- Create `backend/apps/validation/types.py` — `RuleSpec`, `Violation`, `Decision` dataclasses, no Django imports
- Create `backend/apps/validation/directives.py` — the three directive templates
- Create `backend/apps/validation/engine.py` — `evaluate(payload: dict, rules: list[RuleSpec]) -> Decision`
- Create `backend/apps/validation/tests/test_engine.py`
- Modify `backend/apps/validation/views.py` — call the engine; keep request validation and the response body as they are

Task B2 of `docs/plans/2026-08-11-validation-engine-and-dispatch.md` contains the full test suite and the engine's three-stage structure already written out. Follow it.

### Acceptance criteria

1. `evaluate()` is pure: no ORM, no I/O, no Django import in `engine.py`, `types.py`, or `directives.py`.
2. Precedence is origin-agnostic — strictest threshold wins per `(dimension, axle_index)`, regardless of `CENTRAL` or `CLIENT`. A looser client rule must never weaken a central limit.
3. When a client rule wins where a central rule also exists, the directive names the central limit for contrast, as `api-contract.md` §1 shows.
4. Engine tests use invented threshold values defined locally in the test file. They must **not** read the stub constants or `contract/*.json` thresholds, so that correcting a regulation later cannot look like an engine regression.
5. All 10 existing tests in `test_contract.py` still pass **unmodified**. If one fails, the response shape moved: fix the code, not the test.
6. `grep -rn "genai\|llm\|gemini" backend/apps/validation/ --include=*.py` returns nothing.
7. The stub thresholds keep their current values and their `TODO: verify` marking. Do not "improve" any number.

### Verification commands

```bash
uv run --directory backend python manage.py test apps
uv run --directory backend python manage.py check
grep -rn "genai\|llm\|gemini" backend/apps/validation/ --include=*.py
```

Then confirm the UI still works end to end: start both servers, set `VITE_USE_MOCKS=false` in `frontend/.env.local`, open `/dispatch`, submit the default load (expect `LOLOS` and the print button unlocking), then set gross weight `24500` and rear axle `17300` (expect `TAHAN`, two violations, print button locked).

---

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

**Backend**

- Function-based DRF views with `@api_view`. No class-based views, no ViewSets.
- **No DRF serializers.** Response dicts are constructed by hand so they match the contract exactly. The planned pattern for this is a `presenters.py` module per app.
- Private helpers are prefixed `_`.
- Input validation is explicit and returns the contract error envelope through a local `_error()` helper.
- Module docstrings state what the file is for and, where relevant, what still has to replace it.
- Constants that are placeholders are named loudly (`STUB_LIMITS`) and carry a `TODO: verify`.
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
