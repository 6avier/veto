# ENGINEERING.md — VETO

Engineering context. The constraints, the locked decisions, and the rules the
code is held to. Read with [PRODUCT.md](../PRODUCT.md) (what each surface is
for) and [DESIGN.md](../DESIGN.md) (how it looks and why).

---

## 1. What VETO is

API-first compliance middleware for Indonesian freight logistics. A
**deterministic rule engine** that converts ODOL (Over Dimension Over Load)
regulations into operational gates at loading points. Before a delivery order is
printed, VETO returns **PASS** or **HOLD**.

Positioning: a compliance gate engine, with ODOL as the first rule pack — not an
ODOL-only tool.

The flow that has to work end to end:

```
dispatch data (truck + cargo) → validation engine → PASS or HOLD + actionable directive
```

**The problem it solves technically:** ERP and WMS platforms have no awareness of
legal weight and dimension thresholds. Warehouse officers issue delivery orders
for non-compliant loads because nothing warns them at dispatch. Violations get
caught at weighbridges — after the truck has left.

### Locked design decisions

| Decision | Why |
|---|---|
| **HOLD + logged override**, not hard block | Hard blocking is operationally unrealistic. Operators need an escape hatch with accountability. |
| **Zero LLM at runtime** | Determinism, sub-300ms latency, no hallucination risk, legally defensible. AI runs only at rule-authoring time. |
| **Human-in-the-Loop rule approval** | AI drafts rules; a human approves before they go live. Core differentiator. |
| **Versioned rule packs**, not hardcoded logic | New regulatory domains need new rules, not a rewrite. |

---

## 2. Tech stack

**Frontend** — Vite + React + Tailwind CSS + Axios. One single app, routed
surfaces. Not separate apps.

**Backend** — Django + Django REST Framework. Parses the JSON payload from the
ERP client, runs boolean logic against active legal thresholds, returns an HTTP
status. Zero AI at runtime.

**Database** — PostgreSQL in deployment, SQLite locally, so the backend is never
blocked on a hosted database. JSONB for AI-generated tagging metadata.

**Rule Studio AI pipeline** — async, setup-phase only:

- PDF extraction: `pdfplumber` / `PyMuPDF` inside Django
- AI structuring: OpenAI API, strict few-shot prompting, constrained to emit
  `axle_config`, `max_weight`, `legal_citation`, `tags`
- HITL: the generated JSON draft sits in a staging queue and requires explicit
  manual approval before it is committed to the active rules table

`uv` is the Python package manager and `uv.lock` is the one source of dependency
truth — no second `requirements.txt` to drift out of sync.

### Repo layout

```
/frontend        Vite + React + Tailwind
/backend         Django + DRF
  /apps
    /validation  Validation Engine API
    /rules       Rule Studio API
    /audit       Immutable decision log
    /profiles    Smart Profiling CRUD
/contract        Canonical request/response fixtures, asserted by backend tests
/data            Regulatory corpus (unverified human reference material)
/docs            Engineering, deploy, handoff and plan documents
```

---

## 3. Architecture

Two flows meeting at the database. **Not** live-connected to each other.

**Flow A — Rule authoring (async, setup phase, AI involved):**

```
government regulation PDF
  → PDF extraction (pdfplumber / PyMuPDF)
  → LLM structuring (few-shot, constrained JSON)
  → staging queue
  → human approval
  → committed to rules DB
```

**Flow B — Runtime validation (real-time, zero AI):**

```
ERP client (truck + cargo + axle config)
  → POST to Validation Engine API
  → boolean evaluation against approved, versioned rule packs
  → 200 OK (PASS) / 403 Forbidden (HOLD) + actionable directive
  → decision written to immutable audit log
```

Rule Studio *fills* the rules DB. The Validation Engine *reads* it. That is the
only coupling.

### Frontend surfaces (one app, routed)

| Route | Surface | Primary user |
|---|---|---|
| `/dispatch` | ERP dispatch screen — truck & cargo metrics in, PASS/HOLD out | Ground / ops team — **the primary user** |
| `/rule-studio` | Split screen: source document vs extracted rule, Approve/Reject | Legal / compliance team |
| `/audit` | Immutable decision log | Compliance, auditors |

Navigation between surfaces is deliberate: it lets the product be walked through
as one continuous narrative — approve a rule, switch to dispatch, get the HOLD —
without opening a second window.

---

## 4. Build priorities

Written for a four-day build, kept because it still explains why the codebase is
shaped the way it is.

**P0 — nothing works without these**

1. Validation Engine API: accepts a dispatch payload, evaluates it against rule
   packs, returns PASS/HOLD + actionable directive
2. Dispatch UI: input form, submit, PASS/HOLD result with the directive
3. Seeded rule pack in the database so the engine has something real to evaluate
4. One clean PASS scenario and one clean HOLD scenario

**P1**

5. Rule Studio UI: split screen, staged analysis reveal, extracted rule fields,
   Approve/Reject
6. Navigation between surfaces with considered transitions
7. Audit log view — visible proof of the immutable trail

**P2**

8. Smart Profiling CRUD
9. Live PDF upload → extraction → LLM structuring
10. Polish: micro-interactions, empty states, loading states

**Deliberately out of scope**

- Auth. A single hardcoded user is acceptable at this stage.
- RBAC, API gateway, encryption at rest, key management, multi-tenancy
- Frontend test coverage — there is no frontend test runner installed, by choice

Deprioritising auth **does not** mean deprioritising security in what does
exist. Input validation, injection safety, secrets handling and API route
hygiene still apply.

---

## 5. Domain reference — ODOL

**ODOL** = Over Dimension Over Load: trucks exceeding legal dimension or weight
limits. Indonesia's **Zero ODOL** enforcement deadline is **January 2027**.

Validation dimensions the engine handles:

- **Weight** — gross vehicle weight vs. legal limit (JBI / JBKB)
- **Axle load** — per-axle weight distribution against per-axle limits
- **Dimension** — length, width, height vs. legal maxima
- **Axle configuration** — limits vary by config (e.g. 1.1, 1.2, 1.2.2)

Baseline (Kemenhub, Jan–Jun 2026): **75.64% patuh**. Violation breakdown: daya
angkut 48.49%, dimensi 2.70% → roughly **51%** of violations are addressable from
delivery-order data.

**Verify current regulation details before hardcoding any threshold.** Uncertain
figures belong in a config or seed file marked `TODO: verify`, never buried in
logic.

### Known gaps — do not paper over these

**1. Data integrity gap.** VETO validates *declared* weight, not sensor-verified
weight. Wrong input passes. Weighbridge/IoT integration is a later phase. No UI
copy may imply VETO guarantees actual compliance.

**2. Route/road-class-aware validation is not implemented.** Legal weight limits
vary by road class under PM 18/2021. Routes are stored as profile data only and
are not used in validation.

Because of these gaps: **never overclaim compliance outcomes in UI copy.** Do not
state or imply near-100% compliance, error elimination, or incident reduction
anywhere in the product.

### Numbers policy

Only these claims may appear in the product:

- **Measured internally** (label as such): 8 min manual verification time,
  300 min audit prep time — time trial, n=10
- **From Kemenhub data**: 75.64% patuh baseline, ~51% of violations addressable
  from delivery-order data

Never fabricate a statistic or a regulation citation in code, seed data, or UI
copy. A fallback rule candidate carries a placeholder threshold and says so; it
does not invent a figure.

### Target metrics

- Validation latency p95: **under 300 ms**
- Dispatch decisions carrying an article-level audit trail: 100%
- **LLM calls at runtime: 0**

---

## 6. Working conventions

- **Prefer boring, working code.** No clever abstractions.
- **Seed data is endorsed.** Realistic fake data that makes the system work beats
  real data that isn't ready. Plausible Indonesian logistics values: real truck
  configs, real corridor names (Cikarang–Karawang), realistic tonnage.
- **Every visible async operation needs a visible state.** Loading states,
  real-time feedback. Invisible backend work is worth nothing to a user.
- **Handle failure gracefully in the UI.** A caught error with a clean message
  beats a stack trace.
- **The contract is the seam.** [api-contract.md](../api-contract.md) is binding
  and `contract/*.json` holds the canonical fixtures the backend tests assert
  against. Change the fixture and the contract document first, then the code.
- **Verify the rendered application** before calling work complete — not the
  code, not a green build, the running thing.

---

## 7. Design direction

The full system is in [DESIGN.md](../DESIGN.md); this is the short version of
what it refuses to be.

Avoid:

- Generic Inter/system-font-only interfaces
- Purple/blue gradient backgrounds without a design reason
- Excessive rounded cards, cards within cards
- Generic dashboard grids
- Meaningless glassmorphism, excessive pills
- Decorative animation with no purpose
- Repetitive layouts that make every section look identical

Prioritise distinctive typography, strong visual hierarchy, intentional spacing
and density, clear composition, purposeful motion, a coherent visual language.

Animation should communicate hierarchy, state, interaction or spatial
relationship. Nothing moves only to look impressive.

When making trade-offs, the order is:

**Correctness → Security → Usability → Design quality → Performance → Polish**
