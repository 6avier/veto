# API Contract — VETO

Binding contract between `/frontend` and `/backend`. If a shape here changes, update this file and tell the other side **before** changing code.

Base URL: `/api/v1`

---

## 0. Conventions

**Units — canonical on the wire, no exceptions**

| Quantity | Unit | Type | Notes |
|---|---|---|---|
| Weight | kilograms (`kg`) | integer | No floats. 1.2 t → `1200` |
| Length / width / height | millimetres (`mm`) | integer | No floats. 12.5 m → `12500` |
| Latency | milliseconds | integer | |

Frontend converts for display (kg → tonnes, mm → metres). Backend never sends tonnes or metres.

**IDs** — UUID v4 strings.

**Timestamps** — ISO 8601 with timezone, e.g. `2026-08-11T14:32:10+07:00`. Server stores UTC, returns WIB offset.

**Auth** — none in MVP. A single hardcoded client is assumed. Requests may carry `X-Client-Id`, and the backend may ignore it; do not build logic that depends on it.

**Casing** — `snake_case` for all JSON keys, both directions.

**Enums** — always uppercase strings. Frontend must treat unknown enum values as a safe default rather than crashing.

### Error envelope

Every non-2xx response that isn't a HOLD uses this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "axle_loads must contain at least one entry",
    "field": "axle_loads"
  }
}
```

`field` is optional. `code` values: `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `UPSTREAM_TIMEOUT` (504), `INTERNAL_ERROR` (500).

---

## 1. Validation Engine

### `POST /validate`

The core endpoint. Everything else is supporting.

**Request**

```json
{
  "dispatch_ref": "DO-2026-08-11-0042",
  "vehicle": {
    "profile_id": "8f1c2e4a-3b7d-4c1e-9a2f-5d6e7f8a9b0c",
    "axle_config": "1.2",
    "tare_weight_kg": 8500
  },
  "load": {
    "gross_weight_kg": 24500,
    "axle_loads_kg": [7200, 17300],
    "dimensions_mm": {
      "length": 12500,
      "width": 2500,
      "height": 4100
    }
  },
  "loading_point_id": "LP-CIKARANG-01"
}
```

Notes:
- `profile_id` is optional. If present, backend may fill missing vehicle fields from the profile.
- `axle_loads_kg` is ordered front to rear. Length must match the axle count implied by `axle_config`.
- `dimensions_mm` is the loaded envelope, not the empty vehicle.

**Response — PASS, HTTP 200**

```json
{
  "decision_id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "outcome": "PASS",
  "dispatch_ref": "DO-2026-08-11-0042",
  "violations": [],
  "rule_packs_applied": [
    { "id": "…", "domain": "ODOL", "version": 3, "origin": "CENTRAL" }
  ],
  "latency_ms": 41,
  "evaluated_at": "2026-08-11T14:32:10+07:00"
}
```

**Response — HOLD, HTTP 403**

```json
{
  "decision_id": "9f8e7d6c-5b4a-4392-8171-6a5b4c3d2e1f",
  "outcome": "HOLD",
  "dispatch_ref": "DO-2026-08-11-0042",
  "violations": [
    {
      "dimension": "AXLE_LOAD",
      "axle_index": 1,
      "actual_value": 17300,
      "limit_value": 16000,
      "excess_value": 1300,
      "unit": "kg",
      "severity": "BLOCKING",
      "rule_origin": "CENTRAL",
      "legal_citation": "PP 55/2012 Lampiran (Asumsi Sumbu Ganda/Tandem)",
      "directive": "Reduce rear axle load by 1,300 kg"
    },
    {
      "dimension": "GROSS_WEIGHT",
      "actual_value": 24500,
      "limit_value": 24000,
      "excess_value": 500,
      "unit": "kg",
      "severity": "BLOCKING",
      "rule_origin": "CLIENT",
      "legal_citation": "SOP Internal Gudang Cikarang v2 §3.1",
      "directive": "Reduce total load by 500 kg — client policy is stricter than the legal limit of 25,000 kg"
    }
  ],
  "rule_packs_applied": [
    { "id": "…", "domain": "ODOL", "version": 3, "origin": "CENTRAL" },
    { "id": "…", "domain": "ODOL", "version": 1, "origin": "CLIENT" }
  ],
  "latency_ms": 58,
  "evaluated_at": "2026-08-11T14:32:10+07:00"
}
```

**Contract rules**

- `outcome` is `PASS` or `HOLD`. Nothing else.
- All violations are returned, not just the first.
- `dimension` enum: `GROSS_WEIGHT`, `AXLE_LOAD`, `DIMENSION_LENGTH`, `DIMENSION_WIDTH`, `DIMENSION_HEIGHT`, `AXLE_CONFIG`.
- `axle_index` is present only when `dimension` is `AXLE_LOAD`. Zero-based, front to rear.
- `severity` enum: `BLOCKING`, `WARNING`. MVP emits `BLOCKING` only; the field exists so warnings can be added without a contract change.
- `rule_origin` enum: `CENTRAL`, `CLIENT`.
- Where a client rule is stricter than a central rule on the same dimension, only the client rule appears, and `directive` names the legal limit for contrast (see the second violation above).
- `directive` is a complete, human-readable sentence in English. Frontend renders it as-is — do not build directive text on the frontend.
- A HOLD is a **successful evaluation**, not a server error.

> **Frontend gotcha:** axios throws on 403. A HOLD lands in `catch`, not `then`. Read the body from `err.response.data` and branch on `outcome`. Do not treat it as a failure state — it is the most important success path in the product.

---

## 2. Overrides

### `POST /decisions/{decision_id}/override`

Logs a human override of a HOLD. Does not change the decision — it appends to it.

**Request**

```json
{
  "reason": "Load verified manually at gate, weighbridge ticket #4471 attached",
  "overridden_by": "Operator Gudang A"
}
```

`reason` is required, minimum 10 characters. `overridden_by` is a free-text name in MVP.

**Response — HTTP 201**

```json
{
  "override_id": "…",
  "decision_id": "9f8e7d6c-5b4a-4392-8171-6a5b4c3d2e1f",
  "reason": "Load verified manually at gate, weighbridge ticket #4471 attached",
  "overridden_by": "Operator Gudang A",
  "created_at": "2026-08-11T14:35:02+07:00"
}
```

Errors: 404 if the decision does not exist. 400 if the decision outcome was `PASS` — there is nothing to override.

---

## 3. Audit Log

### `GET /decisions`

Query params, all optional:

| Param | Type | Default |
|---|---|---|
| `outcome` | `PASS` \| `HOLD` | all |
| `from` / `to` | ISO 8601 date | all |
| `has_override` | boolean | all |
| `limit` | integer, max 100 | 50 |
| `offset` | integer | 0 |

**Response — HTTP 200**

```json
{
  "results": [
    {
      "decision_id": "…",
      "dispatch_ref": "DO-2026-08-11-0042",
      "outcome": "HOLD",
      "violation_count": 2,
      "override": {
        "reason": "Load verified manually at gate…",
        "overridden_by": "Operator Gudang A",
        "created_at": "2026-08-11T14:35:02+07:00"
      },
      "latency_ms": 58,
      "evaluated_at": "2026-08-11T14:32:10+07:00"
    }
  ],
  "total": 137,
  "limit": 50,
  "offset": 0
}
```

`override` is `null` when absent. List rows carry `violation_count` only — full violations come from the detail endpoint.

### `GET /decisions/{decision_id}`

Returns the full decision object — identical shape to the `/validate` response, plus `override` and `payload` (the original request, for replay).

Always HTTP 200 when found, even for a HOLD. The 403 convention applies to `/validate` only.

---

## 4. Rule Studio

### `POST /documents`

`multipart/form-data`, field `file`. PDF only, max 10 MB.

Upload triggers triage immediately — one cheap classification call on a truncated sample. Extraction does **not** run here.

**Response — HTTP 201**

```json
{
  "document_id": "…",
  "filename": "SOP-Gudang-Cikarang-v2.pdf",
  "page_count": 7,
  "classification": "INTERNAL_POLICY",
  "classification_confidence": 0.94,
  "accepted": true,
  "rejection_reason": null,
  "needs_human_review": false,
  "uploaded_at": "2026-08-11T14:40:00+07:00"
}
```

**Rejected example**

```json
{
  "document_id": "…",
  "filename": "packing-list-0042.pdf",
  "page_count": 1,
  "classification": "OPERATIONAL_DOC",
  "classification_confidence": 0.97,
  "accepted": false,
  "rejection_reason_code": "OPERATIONAL_DOC",
  "needs_human_review": false,
  "uploaded_at": "2026-08-11T14:41:12+07:00"
}
```

**Classification enum and outcomes**

| `classification` | `accepted` | Meaning |
|---|---|---|
| `INTERNAL_POLICY` | `true` | Internal SOP, safety policy, or contract term containing load constraints |
| `PUBLIC_REGULATION` | `false` | Government regulation already in VETO's central rule base |
| `OPERATIONAL_DOC` | `false` | Invoice, packing list, DO, manifest — no rule content |
| `UNREADABLE` | `false` | No extractable text layer; OCR unsupported in MVP |
| `UNRELATED` | `false` | Outside the freight/load domain |

**Rejection copy lives on the frontend.** The backend returns `rejection_reason_code` (same value as `classification`); the frontend maps it to a sentence. No generated prose crosses the wire — this is the token saving.

`needs_human_review` is `true` when `classification_confidence` falls below the threshold. In that case `accepted` is `false` but the UI must offer "review anyway" rather than a hard rejection — the model narrows the decision, it does not make it.

Errors: 400 for non-PDF or oversize. 504 if the classification call times out.

### `POST /documents/{document_id}/extract`

Runs full extraction. Only valid when `accepted` is `true`, or when the human overrode a low-confidence rejection.

**Request**

```json
{ "force": false }
```

`force: true` bypasses the `accepted` check for the human-review path.

**Response — HTTP 200**

```json
{
  "document_id": "…",
  "candidates": [
    {
      "candidate_id": "…",
      "dimension": "GROSS_WEIGHT",
      "operator": "LTE",
      "threshold": 24000,
      "unit": "kg",
      "applies_to": { "axle_config": ["1.2", "1.22"] },
      "source_reference": "SOP Internal Gudang Cikarang v2 §3.1",
      "source_text_excerpt": "Muatan total tidak boleh melebihi 24 ton untuk kendaraan sumbu ganda…",
      "source_page": 3,
      "tags": ["internal", "stricter_than_legal"],
      "status": "PENDING"
    }
  ],
  "extraction_ms": 4120,
  "used_fallback": false
}
```

- `operator` enum: `LTE`, `GTE`, `EQ`.
- `source_text_excerpt` and `source_page` drive the split-screen verification view. Both required.
- `used_fallback` is `true` when the live LLM path failed and a pre-processed result was served. Frontend should indicate this in the UI rather than hiding it.
- Errors: 409 if the document was rejected and `force` is false. 504 on LLM timeout **only when no fallback exists**.

### `GET /rule-candidates`

Query param `status`: `PENDING` (default), `APPROVED`, `REJECTED`.

Returns `{ "results": [ …candidate objects… ], "total": n }`.

### `POST /rule-candidates/{candidate_id}/approve`

```json
{ "reviewed_by": "Compliance Officer" }
```

Creates a versioned rule with `origin = CLIENT` and commits it to the active rule pack.

**Response — HTTP 200**

```json
{
  "candidate_id": "…",
  "status": "APPROVED",
  "rule_id": "…",
  "rule_pack_id": "…",
  "rule_pack_version": 2,
  "reviewed_by": "Compliance Officer",
  "reviewed_at": "2026-08-11T14:46:30+07:00"
}
```

### `POST /rule-candidates/{candidate_id}/reject`

```json
{ "reviewed_by": "Compliance Officer", "note": "Threshold ambiguous in source" }
```

Returns the same shape with `status: "REJECTED"` and no `rule_id`. Rejected candidates never reach the validation engine.

Both endpoints return 409 if the candidate is not `PENDING`.

---

## 5. Rules

### `GET /rules`

Query params: `origin` (`CENTRAL` | `CLIENT`), `dimension`, `status` (`ACTIVE` default).

```json
{
  "results": [
    {
      "rule_id": "…",
      "dimension": "AXLE_LOAD",
      "operator": "LTE",
      "threshold": 16100,
      "unit": "kg",
      "applies_to": { "axle_config": ["1.2"], "axle_index": 1 },
      "legal_citation": "PM 111/2015 Pasal 4 ayat (2)",
      "origin": "CENTRAL",
      "rule_pack_version": 3,
      "status": "ACTIVE",
      "effective_from": "2026-01-01T00:00:00+07:00"
    }
  ],
  "total": 24
}
```

Read-only in MVP. Rules are created through the candidate approval flow or seeded.

---

## 6. Vehicle Profiles

Standard CRUD. `P2` priority — build last.

### `GET /vehicle-profiles`

```json
{
  "results": [
    {
      "profile_id": "…",
      "name": "Tronton 6x2 — Fleet A",
      "axle_config": "1.22",
      "axle_count": 3,
      "tare_weight_kg": 8500,
      "max_dimensions_mm": { "length": 12000, "width": 2500, "height": 4200 }
    }
  ],
  "total": 6
}
```

### `POST /vehicle-profiles` · `PATCH /vehicle-profiles/{id}` · `DELETE /vehicle-profiles/{id}`

Request body matches the object above minus `profile_id` and `axle_count` (derived from `axle_config`). `POST` returns 201, `PATCH` 200, `DELETE` 204.

---

## 7. Build order

Backend ships in this order so the frontend is never blocked:

1. `POST /validate` — hardcoded response matching the contract exactly, real logic after
2. `GET /decisions` + `GET /decisions/{id}`
3. `POST /decisions/{id}/override`
4. `POST /documents` (triage)
5. `POST /documents/{id}/extract`
6. `GET /rule-candidates` + approve/reject
7. `GET /rules`
8. Vehicle profiles CRUD

Frontend mocks every endpoint from day one at `/frontend/src/mocks/`, using the exact payloads in this document. Swap mocks for axios per endpoint as each one goes live.

**First integration checkpoint: end of day 2.** `POST /validate` wired end to end, PASS and HOLD both rendering. Do not let the first real request happen on day 4.

---

## 8. Open

1. `classification_confidence` threshold for `needs_human_review`. Placeholder: `0.75`. Needs testing.
2. Whether `GET /decisions` needs full-text search on `dispatch_ref`. Not in MVP unless the audit view feels unusable without it.
3. `X-Client-Id` — kept in the contract for shape, ignored by the backend in MVP. Revisit only if multi-tenancy lands, which it will not.
