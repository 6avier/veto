# VETO

**A compliance gate for Indonesian freight logistics.** Dispatch data goes in —
truck configuration, axle loads, cargo dimensions. `PASS` or `HOLD` comes out,
and a `HOLD` arrives with the article of law it broke and the exact correction
that would clear it.

> **Finalist — RISTEK Hackathon 2026.** Built by **Team GabisaNgoding**,
> Fakultas Ilmu Komputer Universitas Indonesia, angkatan 2025.

**Live demo:** [veto-gold.vercel.app](https://veto-gold.vercel.app) ·
**API:** [veto-backend-ebon.vercel.app](https://veto-backend-ebon.vercel.app/health/)

The API runs as a serverless function in Vercel's Singapore region, next to its
database. The first request after a quiet spell can take a few seconds while the
function starts; everything after that answers in well under a second.

---

## The problem

Indonesia's **Zero ODOL** (Over Dimension Over Load) enforcement deadline is
**January 2027**. Compliance today is reactive: a truck is loaded, a delivery
order is printed, the truck leaves, and the violation is discovered at a
weighbridge kilometres down the road.

The gap is a software gap. ERP and WMS platforms track quantity, destination and
customer — they have no idea that PP 55/2012 caps a two-axle rigid at 16.000 kg.
So a warehouse officer issues a delivery order for a non-compliant load because
nothing in their screen ever told them not to.

VETO moves that check to the moment before the delivery order is printed.

## What it does

Send it a dispatch payload — a three-axle tronton carrying 24.500 kg:

```json
POST /api/v1/validate
{
  "dispatch_ref": "DO-2026-08-11-0042",
  "vehicle": { "axle_config": "1.2.2", "tare_weight_kg": 8500 },
  "load": {
    "gross_weight_kg": 24500,
    "axle_loads_kg": [7200, 6000, 11300],
    "dimensions_mm": { "length": 12500, "width": 2500, "height": 4100 }
  },
  "loading_point_id": "LP-CIKARANG-01"
}
```

`PASS` is `200 OK`. `HOLD` is `403 Forbidden`, and every violation carries the
actual value, the limit, the excess, the article it broke, and a directive
written for the person standing at the loading dock:

```json
403 Forbidden
{
  "outcome": "HOLD",
  "violations": [
    {
      "dimension": "GROSS_WEIGHT",
      "actual_value": 24500, "limit_value": 24000, "excess_value": 500,
      "legal_citation": "PP 55/2012 Lampiran II (Konfigurasi 1.2.2)",
      "directive": "Kurangi muatan total 500 kg …"
    },
    {
      "dimension": "AXLE_LOAD", "axle_index": 2,
      "actual_value": 11300, "limit_value": 10000, "excess_value": 1300,
      "legal_citation": "PP 55/2012 (Batas Sumbu Tunggal Universal)",
      "directive": "Kurangi beban sumbu belakang 1.300 kg"
    }
  ],
  "rule_packs_applied": [ … ],
  "latency_ms": 4
}
```

Note the second violation. The truck is only 500 kg over its gross limit, but its
rear axle is 1.300 kg over — the load is both too heavy *and* badly distributed,
and the engine says so separately, because they are two different corrections.
The response above is a real one, taken from the deployed API.

A `HOLD` is not a hard block. It is a hold plus a **logged override** — the
operator can proceed, but the override is written to an append-only audit trail
with their name against it. Hard blocking a loading dock is not something a
warehouse would ever deploy; accountability is.

## How it works

Two flows that meet at the database and are never wired to each other, plus an
optional camera layer that only ever fills in the form.

**Rule authoring — asynchronous, setup time, AI involved.**

```
client SOP PDF → triage → text extraction
              → LLM structuring (strict JSON schema, enums enforced by the API)
              → staging queue → human approval → versioned company rule pack
```

National ODOL rules are a **central** rule pack VETO maintains and seeds by
migration; clients never upload government regulations. What a client uploads is
its own SOP — internal limits, contract terms, anything stricter than the law.
When an SOP names a vehicle class ("Medium Truck") rather than an axle
configuration, the model copies the document's own definition of that class, and
code — not the model — turns its wheel and axle count into a configuration,
quoting the sentence it used so the reviewer can check it. A definition that
gives a range ("4-6 roda") maps to nothing and can only be rejected.

**Runtime validation — real time, zero AI.**

```
ERP dispatch payload → POST /api/v1/validate
                     → boolean evaluation against approved rule packs
                     → 200 PASS / 403 HOLD + directive
                     → immutable audit log
```

**There are no LLM calls on the validation path, by design.** A model that
hallucinates a weight limit is a legal liability, and a model that takes two
seconds is not a gate — it is a delay an operator learns to click past. The
engine is boolean logic against versioned thresholds, which makes every decision
deterministic, fast, and reproducible in an audit six months later.

AI earns its place upstream instead, where a human still signs off: it reads a
client's SOP and drafts structured rules, and **nothing it drafts goes live
until a person approves it**.

Where a national rule and a stricter internal client policy both cover the same
dimension, **the stricter threshold wins**.

**VETO Vision — optional, perception only.**

```
CAM-01 (side)  → Roboflow object detection → Normal / Possible Overload
CAM-02 (front) → OpenAI vision → licence plate + body type
               → matched against the fleet registry → VERIFIED / MISMATCH_ALERT / …
```

A verified plate fills the truck's configuration and tare weight from the fleet
registry; a body type that does not match the registered one is flagged as a
possible plate swap. The cameras suggest inputs. The `PASS` / `HOLD` decision is
still the deterministic engine's alone. In the demo, uploaded photos and video
stand in for the CCTV feed.

## The three surfaces

One React app, three routes, deliberately built to look like two different
products sharing a window — because that is what middleware is.

| Route | What it is | Who uses it |
|---|---|---|
| `/dispatch` | The dispatch screen of a fictional host ERP ("NUSANTARA WMS"): camera panel, a truck drawing filled to its load, the load form, and VETO's verdict arriving as a dialog — DITAHAN with the override, or LOLOS with the delivery order unlocked | Warehouse / dispatch officer — the primary user |
| `/rule-studio` | Upload an SOP, watch it read, then review each proposed rule beside the page it came from, with its clause boxed; Approve or Reject. Below it, every active rule, central and company, and which one is in force | Legal / compliance officer |
| `/audit` | The append-only log — every PASS, HOLD and override, and on the Aturan tab every rule a person approved or rejected | Compliance, auditors |

`/dispatch` is drawn in the host ERP's visual language, down to the typeface, so
the demo shows what integration actually feels like: the officer never opens
VETO, VETO appears inside the tool they already use.

## Stack

**Frontend** — `frontend/`

| | |
|---|---|
| React 19 + Vite 8 | JavaScript, no TypeScript |
| Tailwind CSS 4 | Design tokens in CSS, no `tailwind.config.js` |
| react-router-dom 7 | Three routes, two layouts |
| axios | Thin API client per domain |
| Motion | Restrained; the verdict arriving, the staged extraction reveal |
| Phosphor Icons | One icon family, no hand-rolled SVG |
| oxlint | |

No component library. Every component is hand-written, against a design system
recorded in [DESIGN.md](DESIGN.md) before the UI was built rather than after.

**Backend** — `backend/`

| | |
|---|---|
| Python 3.12, managed with uv | `uv.lock` is the single source of dependency truth |
| Django 6.1 + Django REST Framework 3.18 | |
| PostgreSQL in deployment, SQLite locally | via `dj-database-url`; nothing in the code changes between them |
| PyMuPDF | PDF text extraction for Rule Studio |
| OpenAI API (`gpt-4o-mini`) | Rule authoring with structured outputs, and plate reading for Vision — never the validation path |
| Roboflow | Over-dimension detection for Vision |
| gunicorn + WhiteNoise | |

**Deployment** — frontend and API are two Vercel projects; the API runs in the
`sin1` region against Supabase Postgres. The frontend proxies `/api` to it, so
the browser only ever talks to one origin.

## Running it locally

Two terminals. You do not need Python installed — `uv` handles it.

```bash
cp backend/.env.example backend/.env && uv run --directory backend python manage.py migrate && uv run --directory backend python manage.py runserver 8000
```

```bash
cp frontend/.env.example frontend/.env.local && npm --prefix frontend install && npm --prefix frontend run dev
```

Frontend on `http://localhost:5173`, API on `http://127.0.0.1:8000`. The Vite dev
server proxies `/api` to Django, so there is no CORS setup in development.

The rule packs are seeded by migration, so the engine has real thresholds to
evaluate against the moment `migrate` finishes. Rule Studio's live extraction
additionally needs an `OPENAI_API_KEY`; without one it falls back to an honest
"extraction unavailable" state rather than pretending the document held no rules.

**Tests:**

```bash
uv run --directory backend python manage.py test apps
```

69 tests, all passing. They include contract tests that assert the live API's
responses against the canonical fixtures in `contract/*.json`, which is what
stops the frontend and backend drifting apart.

## What it does not do

Stated plainly, because a compliance tool that overstates itself is worse than
none.

- **It validates *declared* weight, not weighed weight.** If the figure typed
  into the ERP is wrong, VETO passes it. Weighbridge and IoT sensor integration
  is a later phase. VETO does not guarantee actual compliance — it removes the
  excuse of not knowing.
- **Road class is not part of validation.** Legal limits vary by road class under
  PM 18/2021. Routes are stored as profile data and are not yet evaluated.
- **Tandem axles are checked one axle at a time.** The tandem limit is applied to
  a single axle rather than to the axle group, which needs modelling of axle
  groups and a verified figure.
- **Camera dimensions are estimates, not measurements.** The Vision detector
  classifies a truck as Normal or Possible Overload; it does not measure length,
  width or height, and the figures it puts in the form are placeholders for that
  class.
- **There is no authentication.** No login, no API keys, no permission classes.
  This was a scoped decision for a four-day competition build, and it means the
  audit trail must not be described as access-controlled: anything the hosted
  demo has been shown is readable by anyone who finds the URL, so nothing real
  should be typed into it. Because the demo is public, the endpoints are rate
  limited per client address, document extraction carries a daily ceiling across
  all callers, and the Django admin is not routed outside local development —
  those bound the cost and the blast radius of an open API, but they are not
  access control and are not offered as a substitute for it.
- **Every threshold in the repository should be re-verified against source text
  before it is trusted operationally.** No figure and no citation in this product
  is invented, but "not invented" is a lower bar than "verified".

## Repository

```
frontend/          Vite + React + Tailwind. One app, three routed surfaces.
backend/
  apps/validation  engine.py — the deterministic evaluator; vision.py and
                   fleet_registry.py — the camera layer and the fleet registry
  apps/rules       Rule Studio: upload, triage, extraction, candidate approval
  apps/audit       DispatchDecision, Violation, override
  apps/profiles    vehicle profile CRUD
contract/          Canonical JSON fixtures the backend tests assert against
data/              Regulatory corpus — unverified human reference material
docs/              Engineering context, deployment, handoff, design plans
```

| Document | What it holds |
|---|---|
| [PRODUCT.md](PRODUCT.md) | Product requirements and feature scope |
| [DESIGN.md](DESIGN.md) | The visual system — typography, colour, motion, and what is banned |
| [api-contract.md](api-contract.md) | The binding frontend/backend contract |
| [docs/ENGINEERING.md](docs/ENGINEERING.md) | Constraints, locked decisions, domain reference |
| [docs/DEPLOY.md](docs/DEPLOY.md) | How the two halves are deployed — still describes the earlier Render setup and is being rewritten for Vercel |

## Team

**GabisaNgoding** — Fakultas Ilmu Komputer, Universitas Indonesia, angkatan 2025.

Code contributors: [@6avier](https://github.com/6avier) — frontend, design
system, Rule Studio · [@iqbalvirdiansyah-commits](https://github.com/iqbalvirdiansyah-commits)
— backend, validation engine, VETO Vision.

## Licence

Copyright © 2026 Team GabisaNgoding.

VETO is licensed under the **GNU Affero General Public License v3.0** — see
[LICENSE](LICENSE).

That choice is deliberate and worth reading before you reuse any of this. AGPL is
copyleft, and its §13 covers network use: if you run a modified version of VETO
as a service — which is the only shape this product has — you must make the
complete corresponding source of your version available to its users, under this
same licence. Building on VETO means building in the open, with attribution
intact. If those terms do not suit you, ask us rather than assume.

Third-party components carry their own terms and are **not** covered by the
above: see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). The short version is
that the fictional host ERP surface uses Plus Jakarta Sans, VETO's own surfaces
use Satoshi, Archivo and JetBrains Mono, and NUSANTARA WMS is invented for the
demo and is not a real product.
