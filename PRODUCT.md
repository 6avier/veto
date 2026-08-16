# PRODUCT.md — VETO

Product requirements for the RISTEK Hackathon 2026 Grand Final build. Scope is the 4-day MVP only (10–13 Aug 2026), not the full product vision.

---

## 1. Product summary

VETO is API-first compliance middleware for Indonesian freight logistics. A deterministic rule engine converts ODOL (Over Dimension Over Load) regulations into operational gates at loading points: before a delivery order is printed, VETO returns **PASS** or **HOLD**.

**Core loop:** dispatch data in → deterministic evaluation against approved rule packs → PASS or HOLD with an actionable directive → decision written to an immutable audit log.

**What makes it defensible:** zero LLM calls at runtime. AI is used only when authoring rules, and every AI-drafted rule requires human approval before it can affect a decision.

---

## 2. Users

| User | Surface | What they do |
|---|---|---|
| **Warehouse / dispatch officer** *(primary)* | Their own ERP — never opens VETO | Enters dispatch data, receives PASS/HOLD inline, corrects the load or logs an override |
| **Compliance / legal officer** | VETO Dashboard → Rule Studio | Uploads internal policy documents, reviews AI-extracted rules, approves or rejects |
| **Client admin** | VETO Dashboard → Profiling | Registers fleet, cargo, and route parameters |

The warehouse officer is the primary user. UX decisions resolve in their favour when there is tension. They must never be required to learn a new interface — VETO reaches them through the ERP they already use.

---

## 3. Scope

### In scope (MVP)

1. Validation Engine API
2. ERP Simulation UI (mock of a client's dispatch screen)
3. AI Rule Studio with live upload, document triage, and extraction
4. Audit log view
5. Smart Profiling CRUD
6. Seeded central rule pack + demo dataset

### Out of scope

- Authentication (single hardcoded user), RBAC, multi-tenancy
- API gateway, rate limiting, key rotation
- Real ERP connectors (SAP, Odoo) — the ERP Simulation stands in
- Weighbridge / IoT sensor integration
- Route and road-class-aware validation
- Regulation change monitoring
- Rule packs beyond ODOL
- Billing, tier enforcement, onboarding flows
- Mobile-native app

---

## 4. Rule ownership model

**Hybrid, central-default.**

- VETO maintains a **central rule base** of national ODOL regulations, seeded and active from day one. Clients inherit it. **Nobody uploads a government PDF** — that is VETO's job, not the customer's.
- Clients may **add custom rules** on top: internal safety SOPs, customer contract terms, stricter-than-legal thresholds. This is the only reason a client ever uploads anything.
- Precedence: where a custom rule and a central rule cover the same dimension, **the stricter threshold wins**. This must be explicit in the data model, not implicit in evaluation order.
- Every rule carries its origin (`central` or `client`) and shows it in the UI. A judge asking "who's responsible if a rule is wrong?" needs a visible answer.

**Consequence for the build:** the ODOL flow — dispatch → validate → PASS/HOLD — runs entirely off seeded central rules and **never touches the LLM**. Rule Studio's AI path is an additive feature for custom rules, not a dependency of the core loop. If the LLM is unreachable, the core product still works.

Rule Studio is available to all clients; what differs by tier is authority level — approve-only, author-with-review, or full self-service. Tier enforcement is out of scope for the MVP, but the data model should carry the field.

---

## 5. Features

### F1 — Validation Engine API `P0`

The deterministic core. No AI, no network calls to model providers, no session state.

**Input:** dispatch payload — vehicle axle configuration, per-axle weights, gross weight, cargo dimensions, origin loading point.

**Behaviour:** evaluates the payload against all active rule packs applicable to the client, central and custom. Boolean logic only. Returns all violations, not just the first.

**Output:**
- `PASS` → HTTP 200, decision ID, rule versions evaluated
- `HOLD` → HTTP 403, decision ID, list of violations, each with: the dimension violated, actual value, legal limit, article citation, rule origin, and an actionable directive (e.g. "reduce rear axle load by 1.2 t")

**Acceptance criteria**
- p95 latency under 300 ms on seeded data
- Zero LLM calls at runtime — verifiable by inspecting the code path
- Every decision, PASS or HOLD, writes an audit record before the response returns
- Rule pack version recorded per decision, so a past decision can be explained against the rules as they stood
- Where a custom rule is stricter than a central rule on the same dimension, the custom threshold is the one enforced, and the response says so

### F2 — ERP Simulation UI `P0`

A mock of a warehouse dispatch screen. Deliberately looks like an ERP, not like VETO — the point is that VETO reaches the officer without a new interface.

**Behaviour:** officer fills dispatch details, submits, gets a result inline. On HOLD, the violation and directive appear in context with the field that caused it. An override is available and requires a typed reason.

**Acceptance criteria**
- PASS and HOLD both render distinctly and legibly at a glance from ~1.5 m (booth visitors read this over someone's shoulder)
- HOLD names the specific violated dimension and the correction needed, not a generic failure message
- Override is possible, requires a reason, and is written to the audit log
- The request to the API is visible as it happens — the system working must be legible, not silent
- Form retains input after a HOLD so the officer can correct and resubmit without retyping

### F3 — AI Rule Studio `P1`

Live upload → document triage → extraction → human approval → commit to rule base. For **custom client rules only**; central ODOL regulations are already seeded.

#### F3a — Document triage (cheap classification pass)

Before spending tokens on extraction, the uploaded document is classified. This runs on a **truncated sample** (first ~2 pages or a fixed character budget), not the full document, and returns a **single enum value plus a confidence score** — no free-text generation.

| Category | Meaning | Outcome |
|---|---|---|
| `INTERNAL_POLICY` | Internal SOP, safety policy, customer contract term containing load or dimension constraints | **Accept** → proceed to extraction |
| `PUBLIC_REGULATION` | Government regulation already covered by VETO's central rule base | Reject — already maintained centrally, no upload needed |
| `OPERATIONAL_DOC` | Invoice, packing list, delivery order, manifest — operational paperwork, contains no rules | Reject — no policy content |
| `UNREADABLE` | Scanned image, no extractable text layer, corrupt file | Reject — OCR not supported in MVP |
| `UNRELATED` | Nothing to do with freight, load, or vehicle constraints | Reject — out of domain |

Rejection copy is **written by us and mapped from the enum**, not generated by the model. The model returns a category; the UI supplies the sentence. This is the token saving: one short classification output instead of a generated explanation, and no full-document extraction call on documents that were never going to yield rules.

Extraction only runs on `INTERNAL_POLICY`. Everything else stops at triage — one cheap call instead of two expensive ones.

#### F3b — Extraction and approval

Accepted documents go to full extraction: text is sent to the LLM with few-shot constrained prompting, returning structured rule candidates (`axle_config`, `max_weight`, `dimension_limits`, `source_reference`, `tags`). Candidates land in a staging queue. The compliance officer reviews each against the source text in split-screen, then approves or rejects. Only approved rules reach the active rule base.

**Acceptance criteria**
- Triage returns a category from the fixed enum; anything unrecognised is treated as `UNRELATED` rather than passed through
- Rejected documents show the mapped reason and do not trigger an extraction call
- Low-confidence classifications are surfaced to the human rather than auto-rejected — the model narrows the decision, it does not make it
- Split-screen shows source text alongside the extracted rule, so the officer can verify the reference
- Extraction progress is shown as discrete stages, not a spinner — the reveal of the AI working is the point
- Rejected candidates are discarded and logged; they never reach the validation engine
- Approved rules are versioned, not overwritten, and tagged `origin = client`
- A fallback path exists (see §8) — if live extraction fails, a pre-processed result can be loaded without leaving the UI

### F4 — Audit Log `P1`

A queryable list of every decision the engine has made.

**Acceptance criteria**
- Shows: timestamp, dispatch reference, PASS/HOLD, violations, rule versions applied, rule origin, override flag and reason if present
- Records are append-only — no edit or delete path exists in the API or the UI
- Filterable by outcome and date range

### F5 — Smart Profiling `P2`

CRUD for fleet, cargo, and route parameters. No AI. Profiles supply the vehicle defaults that pre-fill the ERP dispatch form.

**Acceptance criteria**
- Create, read, update, delete for vehicle profiles with axle configuration
- Selecting a profile in ERP Simulation pre-fills the axle configuration
- Routes can be stored but are **not** used in validation — a known gap, and the UI should not imply otherwise

---

## 6. Data model (indicative)

- **`rule_pack`** — id, domain (`odol`), version, status (`draft` / `active` / `superseded`), origin (`central` / `client`), client_id (null for central), effective_from
- **`rule`** — id, rule_pack_id, dimension (`gross_weight` / `axle_load` / `dimension` / `axle_config`), operator, threshold, unit, applies_to (axle config selector), legal_citation, source_document_id, tags (JSONB)
- **`source_document`** — id, filename, uploaded_at, classification (enum from F3a), classification_confidence, extracted_text, page_count, rejected_at
- **`rule_candidate`** — id, source_document_id, extracted JSONB, status (`pending` / `approved` / `rejected`), reviewed_by, reviewed_at, source_text_excerpt
- **`vehicle_profile`** — id, client_id, name, axle_config, tare_weight, max_dimensions (JSONB)
- **`decision`** — id, client_id, dispatch_ref, payload (JSONB), outcome, violations (JSONB), rule_pack_versions (JSONB), latency_ms, created_at
- **`override`** — id, decision_id, reason, created_at

`decision` and `override` are append-only.

---

## 7. Demo flow

**Core sequence (must never fail — runs entirely on seeded rules, no AI):**

1. **ERP Simulation** — dispatch a compliant load. PASS.
2. **Dispatch an overloaded truck.** HOLD, naming the specific axle and the exact tonnage to remove.
3. **Correct the load, resubmit.** PASS.
4. **Audit Log** — both decisions present, with rule versions and citations.

Step 2 is the moment that lands.

**Rule Studio showcase (additive, ~40 seconds):**

5. Upload an operational document — a packing list. **Rejected at triage** with a specific reason. This demonstrates the system exercises judgment rather than accepting anything.
6. Upload an internal SOP with a stricter-than-legal limit. Accepted, extraction stages visible, rule candidate produced.
7. Approve it. Return to ERP Simulation and dispatch a load that is legal nationally but violates the client's own SOP — HOLD, citing the client rule.

Steps 5–7 prove three things at once: the AI has judgment, a human gate exists, and the hybrid rule model actually works. They are also the only part of the demo that depends on a live LLM, so they sit **after** the core sequence. If the model is unreachable, steps 1–4 still tell a complete story.

**Booth requirement:** a visitor must be able to run steps 1–3 themselves, unassisted, in under a minute. Pre-fill sensible defaults so they only need to change one number to flip PASS to HOLD. Rule Studio stays operator-driven at the booth to avoid uncontrolled LLM spend.

---

## 8. Risks

**AI extraction is additive, not critical path.** Because central ODOL rules are seeded, an LLM outage costs one demo segment, not the demo. Still needs guardrails:

- **Fallback.** A pre-processed extraction result for the demo SOP, loadable in one action if the live path fails or hangs. Build it alongside the live path, not after.
- **Rehearsed documents.** Both demo files — the packing list and the SOP — are fixed and pre-tested. Do not upload an untested document in front of judges.
- **Hard timeout.** If extraction exceeds a set duration, fail cleanly to the fallback rather than spinning.
- **Offline.** Exhibition wifi is unreliable. Steps 1–4 must work with no network beyond localhost.
- **Cost control.** Triage before extraction already caps spend on junk uploads. Booth visitors do not drive Rule Studio.

**Other risks**

- **Declared-weight gap.** VETO validates entered weight, not measured weight. Do not write UI copy implying guaranteed real-world compliance.
- **Route validation absent.** Road-class-dependent limits under PM 18/2021 are not implemented. Profiling stores routes but the engine ignores them.
- **Regulation accuracy.** Any threshold not verified against a real regulation goes in a seed file marked `TODO: verify`. Never fabricate a citation.
- **Merge crunch.** Four days, six people, one repo. Merge on completion, not at the end.

---

## 9. Open items

1. Feature owners — who builds F1–F5. Outstanding.
2. Which two documents are the fixed demo files (rejected operational doc + accepted internal SOP).
3. Exact confidence threshold below which a triage result is escalated to the human rather than auto-rejected.
