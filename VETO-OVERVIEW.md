# VETO — Complete Application Brief

> **What this document is.** A self-contained explanation of the VETO product,
> its architecture, and every feature, written to be pasted into an LLM as
> context. It reflects the state of the repository on **13 August 2026**.
>
> **Ground rules for anyone reasoning about this app.** Do not invent statistics
> or regulation citations. The only figures that may be stated as fact are the
> ones in §15. Where this document says a feature is not built, it is not built —
> please do not describe it as existing. Where it names a known gap, that gap is
> real and deliberate, and the product must never claim otherwise.

---

## 1. One paragraph

VETO is API-first compliance middleware for Indonesian freight logistics. It is a
deterministic rule engine that turns ODOL (Over Dimension Over Load) regulations
into an operational gate at the loading point: before a delivery order is
printed, a dispatch payload is evaluated against versioned rule packs and VETO
returns **PASS** or **HOLD** with a specific, actionable correction. Rules are
authored with AI assistance offline, but every rule requires human approval, and
**no LLM is called at runtime**.

It was built for the RISTEK Hackathon 2026 Grand Final as a four-day MVP
(10–13 Aug 2026), with a live demo and a hands-on booth on 14 Aug 2026.

---

## 2. The problem

Indonesia's **Zero ODOL** enforcement deadline is January 2027. Trucks exceeding
legal weight or dimension limits damage roads, cause accidents, and attract
penalties.

The technical gap: **ERP and WMS platforms have no awareness of legal weight and
dimension thresholds.** A warehouse officer issues a delivery order for a
non-compliant load because nothing in their software warns them at the moment of
dispatch. The violation is caught later, at a weighbridge — after the truck has
already left, when correcting it is expensive and the paperwork already exists.

VETO moves the check to the moment before the delivery order is printed.

**Positioning:** VETO is a *compliance gate engine*. ODOL is its first rule pack,
not its definition. New regulatory domains are new rule packs, not a rewrite.

---

## 3. The core loop

```
dispatch data (truck + cargo)
  → deterministic evaluation against approved, versioned rule packs
  → PASS (HTTP 200) or HOLD (HTTP 403) + actionable directive
  → decision written to an append-only audit log
```

Everything else in the product supports this loop.

---

## 4. Locked design decisions

These are settled and should not be relitigated.

| Decision | Why |
|---|---|
| **HOLD + logged override**, never a hard block | Hard blocking is operationally unrealistic. Operators need an escape hatch, but one that creates accountability. |
| **Zero LLM at runtime** | Determinism, sub-300ms latency, no hallucination risk, legally defensible. AI runs only at rule-authoring time. |
| **Human-in-the-loop rule approval** | AI drafts a rule; a human approves it before it can affect any decision. This is the core differentiator. |
| **Versioned rule packs**, not hardcoded logic | A past decision must be explainable against the rules as they stood at the time. |
| **Central-default rule ownership** | ODOL regulations are government regulations — every customer relies on the same documents, so VETO maintains them. Customers never upload a government PDF. |

---

## 5. Users and surfaces

| User | Surface | What they do |
|---|---|---|
| **Warehouse / dispatch officer** *(primary)* | Their own ERP — never opens VETO directly | Enters dispatch data, receives PASS/HOLD inline, corrects the load |
| **Compliance / legal officer** | VETO → Rule Studio | Uploads internal policy documents, reviews AI-extracted rules, approves or rejects |
| **Client admin** | VETO → Profiling | Registers fleet, cargo, route parameters |

The warehouse officer is the primary user, and UX tensions resolve in their
favour. They must never have to learn a new interface — **VETO reaches them
inside the ERP they already use.** This is why the demo app contains a simulated
ERP rather than presenting VETO as a destination product.

---

## 6. Architecture

Two flows that meet at the database and are **not** live-connected to each other.

**Flow A — Rule authoring (asynchronous, setup phase, AI involved):**

```
government regulation or internal policy PDF
  → PDF text extraction (pdfplumber / PyMuPDF)
  → document triage (cheap LLM classification on a truncated sample)
  → full LLM extraction with few-shot constrained prompting → structured JSON
  → staging queue of rule candidates
  → human approval
  → committed as a versioned rule in the active rule pack
```

**Flow B — Runtime validation (real-time, zero AI):**

```
ERP client POSTs truck + cargo + axle configuration
  → boolean evaluation against approved, versioned rule packs
  → 200 PASS / 403 HOLD + actionable directive
  → decision written to an immutable audit log
```

Rule Studio *fills* the rules database. The Validation Engine *reads* it. That is
the only coupling between them. **If the LLM is unreachable, the core product
still works**, because the central ODOL rules are already seeded.

---

## 7. Tech stack and repository layout

**Frontend** — Vite + React + Tailwind CSS + Axios. One single-page app with
routed surfaces, not separate apps. Plain JavaScript, no TypeScript, so there is
no typecheck step. Linting is `oxlint`.

**Backend** — Django + Django REST Framework. Parses the JSON payload, runs
boolean logic against active thresholds, returns an HTTP status. No AI on this
path.

**Database** — PostgreSQL (Supabase/Render in deployment, SQLite locally).
JSONB used for rule metadata and payload storage.

**Rule Studio AI pipeline** — asynchronous, setup-phase only. PDF extraction via
`pdfplumber` / `PyMuPDF` inside Django; structuring via the **OpenAI API** with
strict few-shot prompting constrained to emit `dimension`, `operator`,
`threshold`, `unit`, `applies_to.axle_config`, `legal_citation`, `tags`.

```
/frontend            Vite + React + Tailwind
  /src
    /routes          Dispatch.jsx, RuleStudio.jsx, AuditLog.jsx
    /layouts         ErpLayout.jsx (host ERP chrome), VetoLayout.jsx
    /components
      /dispatch      DispatchForm, TruckEnvelope, VerdictPanel,
                     ViolationDialog, PassDialog, WaybillDialog,
                     PrintableWaybill
      /rulestudio    DropZone, TriageResult, ExtractionStages,
                     CandidateReview, SourcePlate, RuleRegister
      Dialog.jsx     shared modal shell (focus trap, restore, scroll lock)
    /api             client.js, validation.js, audit.js, ruleStudio.js
    /lib             format.js, limits.js, session.js
/backend             Django + DRF
  /apps
    /validation      engine.py — the deterministic evaluator
    /rules           Rule Studio: documents, triage, extraction, candidates
    /audit           DispatchDecision, Violation, decision list/detail
    /profiles        vehicle profile CRUD
/contract            JSON fixtures the backend tests assert against
api-contract.md      the binding frontend/backend contract
docs/ENGINEERING.md  engineering context and constraints
PRODUCT.md           product requirements
DESIGN.md            the design system
```

**Deployment:** frontend on Vercel (`veto-gold.vercel.app`), backend on Render
(`veto-api-cgek.onrender.com`) with a managed Postgres.

**Running locally:**

```bash
cp backend/.env.example backend/.env      # add OPENAI_API_KEY
uv run --directory backend python manage.py migrate
uv run --directory backend python manage.py runserver 8000

cp frontend/.env.example frontend/.env.local
npm --prefix frontend install && npm --prefix frontend run dev
```

The frontend talks to the API only; mock mode was removed in `c5a03b4`. Django
must be running on `:8000` for any surface to load.

---

## 8. Domain reference — ODOL

**ODOL** = Over Dimension Over Load.

The engine validates four dimensions:

- **Gross weight** — total vehicle weight against the legal limit (JBI / JBKB)
- **Axle load** — per-axle weight against per-axle limits
- **Physical dimensions** — length, width, height against legal maxima
- **Axle configuration** — limits vary by configuration

**Axle configuration notation (JBI).** Dots group axles; a hyphen separates a
trailer. Only the digits count toward axle count.

| Config | Axles | Description |
|---|---|---|
| `1.1` | 2 | Two axles, light truck |
| `1.2` | 2 | Two axles, dual rear wheels |
| `1.2.2` | 3 | Three axles, tronton |
| `1.1-2.2` | 4 | Four axles, truck and trailer |
| `1.2-2.2` | 4 | Four axles, dual wheels and trailer |
| `1.2.2-2.2` | 5 | Five axles |
| `1.2.2-2.2.2` | 6 | Six axles, trailer |

**Seeded central thresholds currently in the rule base.** Gross weight by
configuration: `1.1` 12.000 kg · `1.2` 16.000 kg · `1.2.2` 24.000 kg ·
`1.1-2.2` 30.000 kg · `1.2-2.2` 34.000 kg · `1.2.2-2.2` 40.000 kg ·
`1.2.2-2.2.2` 43.000 kg. Dimensions: length 18.000 mm, width 2.500 mm, height
4.200 mm. Axle loads: front axle 10.000 kg, generic per-axle 10.000 kg, tandem
18.000 kg in production.

> **Caveat that must be preserved.** Two of these axle-load thresholds have not
> been verified against the Lampiran of PP 55/2012. They are seeded values marked
> for human verification. Do not present them as confirmed legal figures.

---

## 9. Rule ownership and precedence

**Hybrid, central-default.**

- VETO maintains a **central rule base** of national ODOL regulations, seeded and
  active from day one. All clients inherit it. **Nobody uploads a government
  PDF** — that is VETO's job, not the customer's.
- Clients may **add custom rules** on top: internal safety SOPs, customer
  contract terms, stricter-than-legal thresholds. This is the only reason a
  client ever uploads a document.
- **Precedence: the stricter threshold wins.** Where a client rule and a central
  rule cover the same dimension, the client threshold is enforced, and the
  directive names the legal limit for contrast.
- Every rule carries its origin (`CENTRAL` or `CLIENT`) and shows it in the UI.
  A judge asking "who is responsible if a rule is wrong?" gets a visible answer.

**Consequence:** the ODOL core loop runs entirely on seeded central rules and
never touches the LLM. Rule Studio's AI path is additive.

---

## 10. Data model

- **`rule_pack`** — id, domain (`ODOL`), version, status (`DRAFT`/`ACTIVE`/`SUPERSEDED`), origin (`CENTRAL`/`CLIENT`), client_id, effective_from
- **`rule`** — id, rule_pack_id, dimension, operator (`LTE`/`GTE`/`EQ`), threshold, unit, applies_to (JSONB axle selector), legal_citation, source_document_id, tags
- **`source_document`** — id, filename, uploaded_at, classification, classification_confidence, extracted_text, page_count, rejected_at
- **`rule_candidate`** — id, source_document_id, extracted JSONB, status (`PENDING`/`APPROVED`/`REJECTED`), reviewed_by, reviewed_at, source_text_excerpt, source_page
- **`vehicle_profile`** — id, client_id, name, axle_config, tare_weight, max_dimensions
- **`DispatchDecision`** — decision_id (UUID PK), outcome, dispatch_ref, payload (JSONB), rule_packs_applied (JSONB), latency_ms, evaluated_at, plus override fields (override_id, override_reason, overridden_by, override_created_at)
- **`Violation`** — id, decision FK, dimension, axle_index, actual_value, limit_value, excess_value, unit, severity, rule_origin, legal_citation, directive

Decisions and overrides are **append-only**. There is no edit or delete path in
either the API or the UI.

---

## 11. API contract

Base URL `/api/v1`. All JSON keys `snake_case`. Enums uppercase. IDs are UUID v4.
Timestamps ISO 8601 with offset.

**Units are canonical on the wire, with no exceptions:** weight in integer
kilograms, dimensions in integer millimetres, latency in integer milliseconds.
No floats, no tonnes, no metres. The frontend converts for display only.

### Validation

**`POST /validate`** — the core endpoint.

Request:

```json
{
  "dispatch_ref": "DO-2026-08-11-0042",
  "vehicle": { "axle_config": "1.2", "tare_weight_kg": 8500 },
  "load": {
    "gross_weight_kg": 24500,
    "axle_loads_kg": [7200, 17300],
    "dimensions_mm": { "length": 12500, "width": 2500, "height": 4100 }
  },
  "loading_point_id": "LP-CIKARANG-01"
}
```

- **PASS → HTTP 200** with `decision_id`, `outcome`, `dispatch_ref`, empty
  `violations`, `rule_packs_applied`, `latency_ms`, `evaluated_at`.
- **HOLD → HTTP 403** with the same shape plus a populated `violations` array.
  Each violation carries `dimension`, `axle_index` (axle-load only),
  `actual_value`, `limit_value`, `excess_value`, `unit`, `severity`,
  `rule_origin`, `legal_citation`, and `directive`.

Contract rules that matter:

- **A HOLD is a successful evaluation, not a server error.** It uses 403 because
  the semantic is "this dispatch is forbidden", and that status is what an ERP
  integrator's error handling will naturally gate on. A frontend gotcha follows:
  axios throws on 403, so a HOLD lands in `catch`, not `then`.
- **All violations are returned, not just the first.**
- `directive` is a complete human-readable sentence **in Indonesian**, with
  Indonesian thousands separators (`1.300`) and no em-dash. The backend composes
  it; the frontend renders it as-is and must never build directive text itself.
  Field names and enums stay English.

### Overrides

**`POST /decisions/{id}/override`** — logs a human override of a HOLD. It does
not change the decision; it appends to it. `reason` required, minimum 10
characters. Returns 201. Returns 400 if the decision was a PASS — there is
nothing to override.

### Audit

- **`GET /decisions`** — filters: `outcome`, `from`, `to`, `has_override`,
  `limit` (max 100, default 50), `offset`. Returns `results`, `total`, `limit`,
  `offset`. Rows carry `violation_count` only.
- **`GET /decisions/{id}`** — full decision, always HTTP 200 even for a HOLD. The
  403 convention applies to `/validate` only.

### Rule Studio

- **`POST /documents`** — multipart PDF upload, max 10 MB. Triggers **triage
  only**, one cheap classification call on a truncated sample. Returns
  `classification`, `classification_confidence`, `accepted`,
  `rejection_reason_code`, `needs_human_review`.
- **`POST /documents/{id}/extract`** — full extraction. Returns `candidates[]`
  with `dimension`, `operator`, `threshold`, `unit`, `applies_to`,
  `source_reference`, `source_text_excerpt`, `source_page`, `tags`, `status`,
  plus `extraction_ms`, `used_fallback`, `fallback_reason`.
- **`GET /documents/{id}/pages/{n}`** — one rendered page as an inline PNG data
  URI at 110 dpi, plus `regions[]` whose `rects` are **percentages of the page
  box**, not pixels, so overlays stay aligned at any render width.
- **`GET /rule-candidates`** — filter by `status`.
- **`POST /rule-candidates/{id}/approve`** — creates a versioned rule with
  `origin = CLIENT` and commits it. **`/reject`** discards it.
- **`GET /rules`** — read-only. Filters: `origin`, `dimension`, `status`.

### Profiles

**`GET/POST /vehicle-profiles`**, **`PATCH/DELETE /vehicle-profiles/{id}`** —
standard CRUD, backend implemented.

---

## 12. Features and build status

### F1 — Validation Engine API · **built**

The deterministic core. No AI, no model-provider calls, no session state.
Evaluates the payload against all active applicable rule packs using boolean
logic and returns every violation.

Notable behaviour in `backend/apps/validation/engine.py`:

- **Stricter-rule resolution** — where central and client rules cover the same
  dimension, the stricter one is selected and only it appears in the response.
- **Smart Directives** — a violation does not just state the excess; it proposes
  a proportional redistribution across axles, e.g. *"Kurangi muatan total 500 kg.
  Batas maksimal SOP Klien adalah 24.000 kg. Saran proporsional: Turunkan 138 kg
  dari sumbu depan, dan 222 kg dari sumbu tengah, dan 138 kg dari sumbu belakang
  agar keseimbangan terjaga."*
- **Gross-vs-axle integrity check** — flags a payload whose declared gross weight
  disagrees with the sum of its axle loads. This can no longer be triggered from
  the UI (see F2) but still guards a direct API client.

Target: p95 latency under 300 ms. Every decision writes an audit record before
the response returns. **LLM calls at runtime: zero, verifiable by code path.**

### F2 — ERP Simulation UI · **built**

Route `/dispatch`. A mock warehouse dispatch screen that deliberately looks like
an ERP rather than like VETO — the point is that VETO reaches the officer without
a new interface. The host is a fictional "NUSANTARA WMS" with its own green left
icon rail and its own typeface (SAP 72).

- The form opens **empty** except for the delivery-order number carrying today's
  date. A form that opens already holding a weight reads as a rigged demo.
- **Gross weight is derived and locked** — it is the sum of the axle loads, which
  is what a vehicle's gross weight physically is, so it is computed and read-only
  rather than typed.
- Client-side ceilings are read from `GET /rules`, so a field shows `+N melebihi
  batas` while the operator types, before any submission.
- A **Truck Envelope** illustration renders top and side views of the load
  against the legal envelope in real millimetre space, turning green or red.
- On submit: **HOLD opens `ViolationDialog`**, listing every violation with its
  directive and citation; **PASS opens `PassDialog`**, showing declared value
  against limit for gross weight and the three dimensions, plus the rule pack
  version and decision ID.
- Violations also pin **inline, under the field that caused them**.
- `Cetak Surat Jalan` (print delivery order) is **locked until the engine returns
  PASS**, and editing any figure re-locks it, because a verdict about numbers
  that have since changed is not a verdict. The print gate is enforced on the
  verdict itself, not merely by disabling the button — otherwise `Ctrl+P` would
  bypass it.
- `WaybillDialog` previews the printable delivery order on screen using the same
  component the print stylesheet renders, so preview and paper cannot disagree.

**Not built:** the override submission flow. `PRODUCT.md` F2 requires it and the
backend endpoint exists, but there is no UI to submit an override. The audit log
displays overrides if present.

### F3 — AI Rule Studio · **built**

Route `/rule-studio`. For **custom client rules only**.

**F3a — Document triage.** Before spending tokens on extraction, the uploaded
document is classified on a truncated sample, returning a single enum plus a
confidence score — no free-text generation.

| Category | Accepted | Meaning |
|---|---|---|
| `INTERNAL_POLICY` | yes | Internal SOP, safety policy, or contract term with load constraints |
| `PUBLIC_REGULATION` | no | Government regulation already in the central rule base |
| `OPERATIONAL_DOC` | no | Invoice, packing list, delivery order, manifest |
| `UNREADABLE` | no | No extractable text layer; OCR unsupported |
| `UNRELATED` | no | Outside the freight domain |

**Rejection copy is written by us and mapped from the enum, not generated by the
model.** The model returns a category; the UI supplies the sentence. That is the
token saving — one short classification instead of generated prose, and no
full-document extraction call on documents that were never going to yield rules.

Low-confidence classifications are surfaced to the human rather than
auto-rejected: **the model narrows the decision, it does not make it.**

**F3b — Extraction and approval.** Accepted documents go to full extraction with
few-shot constrained prompting. Progress is shown as **discrete stages, not a
spinner** — the reveal of the AI working is the point. The four stages are
*Membaca dokumen*, *Menemukan klausa ketentuan*, *Menyusun ambang batas*,
*Membandingkan dengan basis aturan VETO*; the last two carry a fast readout of
the payload fields being assembled and the real rule citations being compared
against.

Candidates land in a staging queue and are reviewed in **split-screen**: the
extracted rule beside the rendered source page, with the source clause
highlighted. The reviewer steps through every candidate, then approves or
rejects. Only approved rules reach the active rule base, versioned and tagged
`origin = CLIENT`.

A **fallback path** exists: if live extraction fails, a fallback candidate is
served, tagged `cadangan` / `belum-diverifikasi`, whose excerpt states that
extraction was unavailable rather than posing as a quotation, and whose threshold
is an explicit placeholder rather than an invented figure.

**Rule register.** The register of active rules sits below, split by origin
(Pusat / Klien) and grouped into collapsible sections — *berlaku semua
kendaraan*, *beban per sumbu*, then one group per axle configuration ordered by
axle count.

### F4 — Audit Log · **built**

Route `/audit`. Every decision the engine has made, with timestamp, dispatch
reference, outcome, violation count, override, and latency. Expanding a row loads
the full violation list with citations, the decision ID, and the rule pack
versions applied.

Append-only is a property of the interface, not only the database: there is
deliberately no edit or delete affordance anywhere on the screen, and the API
exposes no path to one.

**Session scoping.** By default the trail shows only decisions made in the
current browser session, because at a booth a visitor opening a shared trail of
strangers' decisions reads as seed data rather than as an audit trail. Scoping
is a *view* filter implemented through the API's existing `from` parameter —
**nothing is deleted**. A `Semua catatan` toggle shows the complete history, and
`Mulai sesi baru` restamps the session so an operator can hand a clean screen to
the next visitor.

### F5 — Smart Profiling · **backend only**

Vehicle profile CRUD exists in the backend (`GET/POST /vehicle-profiles`,
`PATCH/DELETE /vehicle-profiles/{id}`). **There is no `/profiling` frontend route
— the UI was not built.**

---

## 13. Design system

Recorded in full in `DESIGN.md`. The essentials:

- **Two visual systems on one screen.** The host ERP is grey, boxy, dense, and
  uses the SAP 72 typeface. VETO is white, quiet, hairline-ruled, and uses
  Archivo with JetBrains Mono for data and citations. VETO is distinguished from
  the host by being *cleaner* than it, not darker.
- **Amber `#f2a93b` is the alert accent — HOLD and nothing else.** On light
  grounds amber is a marker, never text (it measures 1.9:1 and fails contrast),
  so the word `TAHAN` is written in graphite beside an amber square.
- **PASS carries a green marker `#2f8f4e`, also a marker and never text.** This
  was a deliberate, owner-approved reversal of an earlier "PASS has no colour"
  rule; the reversal and its cost are recorded in `DESIGN.md` §4 rather than
  applied silently.
- **One radius (2px).** Instruments have square corners.
- **Zero em-dashes in anything a user sees.**
- Banned: green tick success states, a third accent colour, purple/blue
  gradients, cards inside cards, generic dashboard card grids, glassmorphism,
  pills and heavily rounded containers, spinners.
- **Every visible async operation gets a visible state.** The system working must
  be legible; invisible backend work is worth nothing in a demo.

---

## 14. Demo script

**Core sequence — runs entirely on seeded rules, no AI, must never fail:**

1. `/dispatch` — dispatch a compliant load → **PASS**.
2. Dispatch an overloaded truck → **HOLD**, naming the specific axle and the
   exact tonnage to remove. *This is the moment that lands.*
3. Correct the load, resubmit → **PASS**, delivery order unlocks.
4. `/audit` — both decisions present, with rule versions and citations.

**Rule Studio showcase — additive, roughly 40 seconds:**

5. Upload an operational document (a packing list) → **rejected at triage** with
   a specific reason. This proves the system exercises judgment rather than
   accepting anything.
6. Upload an internal SOP with a stricter-than-legal limit → accepted, extraction
   stages visible, rule candidate produced.
7. Approve it, return to `/dispatch`, and dispatch a load that is legal
   nationally but violates the client's own SOP → **HOLD, citing the client
   rule** and displaying `[ SOP KLIEN ]`.

Steps 5–7 prove three things at once: the AI has judgment, a human gate exists,
and the hybrid rule model actually works. They sit **after** the core sequence
because they are the only part depending on a live LLM. If the model is
unreachable, steps 1–4 still tell a complete story.

**Booth requirement:** a visitor must be able to run steps 1–3 unassisted in
under a minute. Rule Studio stays operator-driven at the booth to control LLM
spend.

---

## 15. Known gaps and honesty constraints

These are real, deliberate, and must never be papered over in product copy.

**1. Declared-weight gap.** VETO validates the weight a human *declared* on the
delivery order, not a sensor-measured weight. Wrong input passes. Weighbridge and
IoT integration is a later phase. The dispatch screen states this in plain
Indonesian on the page itself. **Never write copy implying VETO guarantees
real-world compliance.**

**2. Route and road-class validation is not implemented.** Legal weight limits
vary by road class under PM 18/2021. Routes are stored as profile data only and
the engine ignores them entirely.

**3. No authentication.** A single hardcoded client is assumed. Auth, RBAC,
multi-tenancy, API gateway, and rate limiting are all out of scope for the MVP.

**4. Two seeded axle-load thresholds are unverified** against the Lampiran of
PP 55/2012 and are marked for human verification.

**5. Seven Rule Studio backend tests currently fail.** Pre-existing. Some were
previously green only because extraction was broken and always returned exactly
one fallback candidate; with extraction working, a document containing no policy
clauses correctly yields an empty list and those tests fail honestly.

### Numbers policy

Only these figures may be stated, and only with their labels:

- **Measured internally, time-trial, n=10:** 8 minutes manual verification time;
  300 minutes audit preparation time.
- **From Kemenhub data (Jan–Jun 2026):** 75.64% compliance baseline; violation
  breakdown daya angkut 48.49%, dimensi 2.70%, giving roughly **51% of violations
  addressable from delivery-order data**.

**Never fabricate a statistic or a regulation citation** in code, seed data, UI
copy, or conversation. Do not claim near-100% compliance, error elimination, or
incident reduction anywhere.

---

## 16. Glossary

| Indonesian | English |
|---|---|
| Surat jalan | Delivery order / waybill |
| Buat Surat Jalan | Create delivery order |
| Berat kotor | Gross weight |
| Berat kosong | Tare weight |
| Beban sumbu | Axle load |
| Sumbu depan / tengah / belakang | Front / middle / rear axle |
| Konfigurasi sumbu | Axle configuration |
| Muatan | Load, cargo |
| Panjang / Lebar / Tinggi | Length / Width / Height |
| LOLOS | PASS |
| TAHAN | HOLD |
| Aturan yang berlaku | Active rules |
| Jejak Audit | Audit trail |
| Ambang batas | Threshold |
| Pusat / Klien | Central / Client (rule origin) |
| Kepatuhan | Compliance |
| Patuh | Compliant |
| JBI / JBKB | Legal gross vehicle weight ratings |
| Kemenhub | Ministry of Transportation |

---

## 17. Open decisions

Not settled. Anyone reasoning about the product should treat these as open
questions rather than assuming an answer.

1. **Tier model for Rule Studio authority** — approve-only, author-with-review,
   or full self-service. The data model should carry the field; enforcement is
   out of MVP scope.
2. **The exact confidence threshold** below which a triage result escalates to a
   human rather than auto-rejecting. Placeholder is 0.75, untested.
3. **Whether live AI extraction runs in the demo**, or Rule Studio uses
   pre-processed results with an animated reveal. Guidance leans toward having a
   tested fallback ready either way.
4. **Which two documents are the fixed demo files** — the rejected operational
   document and the accepted internal SOP.
