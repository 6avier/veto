# Rule Studio Implementation Plan

> **How to work this plan:** Steps use checkbox (`- [ ]`) syntax for tracking. Each task ends with a commit. Do not start a task until the one before it in your own track is committed.

**Goal:** A client uploads an internal policy document, the system judges whether it contains rules at all, extracts the thresholds it finds, a human approves them, and those approved rules then tighten live dispatch validation.

**Architecture:** Two tracks running in parallel against a contract that is already frozen. Iqbal builds `backend/apps/rules` (Track B). Xavier builds `frontend/src/routes/RuleStudio.jsx` (Track F). Neither waits for the other — the frontend runs on `contract/*.json` fixtures until the integration checkpoint. The LLM is confined to two calls in Track B and is never on the dispatch path.

**Tech Stack:** Django 6 + DRF, PyMuPDF for text extraction, `google-genai` for Gemini, React 19 + Tailwind 4, axios.

---

## Global Constraints

Every task inherits these. They come from `docs/ENGINEERING.md`, `PRODUCT.md`, and `api-contract.md`.

- **Zero LLM at runtime on the dispatch path.** `POST /validate` must never call Gemini, directly or transitively. Rule Studio's AI runs only at authoring time.
- **Units on the wire:** weight in integer kilograms, dimensions in integer millimetres. No floats, no tonnes, no metres.
- **JSON keys are `snake_case`. Enum values are UPPERCASE strings.**
- **Never fabricate a statistic or a regulation citation** in code, seed data, or UI copy. Uncertain figures go in a config or seed file marked `TODO: verify`, never buried in logic.
- **No overclaiming in UI copy.** VETO validates *declared* data, not sensor-verified weight. Do not imply guaranteed compliance, error elimination, or incident reduction.
- **`decision` and `override` records are append-only.** No edit or delete path in API or UI.
- **Rejection copy lives on the frontend**, mapped from `rejection_reason_code`. No generated prose crosses the wire.
- **Rule precedence:** where a client rule and a central rule cover the same dimension, the stricter threshold wins, and this is explicit in the data model rather than implicit in evaluation order.
- **If a response shape must change**, update `api-contract.md` and `contract/*.json` and tell the other track *before* changing code.

**Testing posture.** `docs/ENGINEERING.md` §4 deprioritises test coverage beyond what stops the demo breaking, so this plan does not apply uniform TDD. Track B is test-first — the logic lives there, and the contract tests are what stop the two tracks drifting. Track F verifies in the browser at each task instead of adding a JS test runner. That is a deliberate deviation.

---

## File structure

**Track B — Iqbal**

| File | Responsibility |
|---|---|
| `backend/apps/rules/models.py` | `SourceDocument`, `RuleCandidate`, `RulePack`, `Rule` |
| `backend/apps/rules/pdf.py` | PDF text extraction and page count. No LLM, no Django. |
| `backend/apps/rules/llm.py` | The only file that talks to Gemini. Triage and extraction. |
| `backend/apps/rules/presenters.py` | Model → contract-shaped dict. Keeps shapes in one place. |
| `backend/apps/rules/views.py` | The six endpoints in api-contract.md §4–§5 |
| `backend/apps/rules/urls.py` | Route table |
| `backend/apps/rules/fallback.py` | Pre-processed extraction result for when Gemini fails |
| `backend/apps/rules/tests/` | Contract tests, fake LLM client |
| `backend/apps/validation/engine.py` | *(modified in B7)* client-rule precedence |

**Track F — Xavier**

| File | Responsibility |
|---|---|
| `frontend/src/routes/RuleStudio.jsx` | Surface composition and flow state only |
| `frontend/src/components/rulestudio/DropZone.jsx` | File selection |
| `frontend/src/components/rulestudio/TriageResult.jsx` | Accept / reject / needs-review states |
| `frontend/src/components/rulestudio/ExtractionStages.jsx` | The staged reveal |
| `frontend/src/components/rulestudio/CandidateReview.jsx` | Split-screen source vs extracted rule |
| `frontend/src/copy/rejectionReasons.js` | `rejection_reason_code` → sentence |

**Shared, needs a heads-up before editing:** `api-contract.md`, `contract/*.json`, `frontend/src/api/ruleStudio.js`.

---

## Sync points

| When | What | Who |
|---|---|---|
| After **B3** and **F2** | Iqbal posts a real PDF to `POST /documents` and pastes the JSON in chat. Xavier diffs it against `contract/documents.triage.accepted.json`. | both |
| After **B5** and **F4** | **Integration checkpoint.** Xavier sets `VITE_USE_MOCKS=false` and runs upload → extract → approve against Iqbal's local server. Budget two hours. | both |
| After **B7** | Rehearse demo steps 5–7 from `PRODUCT.md` §7 end to end. | both |

---

# Track B — Backend (Iqbal)

### Task B1: Models and migration

**Files:**
- Create: `backend/apps/rules/models.py`
- Create: `backend/apps/rules/tests/__init__.py`, `backend/apps/rules/tests/test_models.py`
- Delete: `backend/apps/rules/tests.py`

**Interfaces:**
- Produces: `SourceDocument`, `RuleCandidate`, `RulePack`, `Rule`. Later tasks import these from `apps.rules.models`.

- [ ] **Step 1: Write the models**

```python
# backend/apps/rules/models.py
"""Rule Studio data model. See PRODUCT.md §6 and api-contract.md §4–§5."""

import uuid

from django.db import models


class Classification(models.TextChoices):
    INTERNAL_POLICY = "INTERNAL_POLICY"
    PUBLIC_REGULATION = "PUBLIC_REGULATION"
    OPERATIONAL_DOC = "OPERATIONAL_DOC"
    UNREADABLE = "UNREADABLE"
    UNRELATED = "UNRELATED"


class Dimension(models.TextChoices):
    GROSS_WEIGHT = "GROSS_WEIGHT"
    AXLE_LOAD = "AXLE_LOAD"
    DIMENSION_LENGTH = "DIMENSION_LENGTH"
    DIMENSION_WIDTH = "DIMENSION_WIDTH"
    DIMENSION_HEIGHT = "DIMENSION_HEIGHT"
    AXLE_CONFIG = "AXLE_CONFIG"


class Operator(models.TextChoices):
    LTE = "LTE"
    GTE = "GTE"
    EQ = "EQ"


class Origin(models.TextChoices):
    CENTRAL = "CENTRAL"
    CLIENT = "CLIENT"


class CandidateStatus(models.TextChoices):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class SourceDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file = models.FileField(upload_to="rule-studio/")
    filename = models.CharField(max_length=255)
    page_count = models.PositiveIntegerField(default=0)
    extracted_text = models.TextField(blank=True)
    classification = models.CharField(max_length=32, choices=Classification.choices)
    classification_confidence = models.FloatField(default=0.0)
    accepted = models.BooleanField(default=False)
    needs_human_review = models.BooleanField(default=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]


class RulePack(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    domain = models.CharField(max_length=32, default="ODOL")
    version = models.PositiveIntegerField(default=1)
    origin = models.CharField(max_length=16, choices=Origin.choices)
    is_active = models.BooleanField(default=True)
    effective_from = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["origin", "-version"]


class Rule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rule_pack = models.ForeignKey(RulePack, on_delete=models.PROTECT, related_name="rules")
    dimension = models.CharField(max_length=32, choices=Dimension.choices)
    operator = models.CharField(max_length=8, choices=Operator.choices, default=Operator.LTE)
    threshold = models.IntegerField(help_text="kg for weights, mm for dimensions. Integers only.")
    unit = models.CharField(max_length=8)
    applies_to = models.JSONField(default=dict)
    legal_citation = models.CharField(max_length=255)
    tags = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)


class RuleCandidate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source_document = models.ForeignKey(
        SourceDocument, on_delete=models.CASCADE, related_name="candidates"
    )
    dimension = models.CharField(max_length=32, choices=Dimension.choices)
    operator = models.CharField(max_length=8, choices=Operator.choices, default=Operator.LTE)
    threshold = models.IntegerField()
    unit = models.CharField(max_length=8)
    applies_to = models.JSONField(default=dict)
    source_reference = models.CharField(max_length=255)
    source_text_excerpt = models.TextField()
    source_page = models.PositiveIntegerField(default=1)
    tags = models.JSONField(default=list)
    status = models.CharField(
        max_length=16, choices=CandidateStatus.choices, default=CandidateStatus.PENDING
    )
    reviewed_by = models.CharField(max_length=255, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True)
    approved_rule = models.OneToOneField(
        Rule, null=True, blank=True, on_delete=models.SET_NULL, related_name="candidate"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
```

- [ ] **Step 2: Write the test**

```python
# backend/apps/rules/tests/test_models.py
from django.test import TestCase

from apps.rules.models import CandidateStatus, Origin, Rule, RuleCandidate, RulePack, SourceDocument


class ModelTests(TestCase):
    def test_candidate_defaults_to_pending(self):
        document = SourceDocument.objects.create(filename="sop.pdf", classification="INTERNAL_POLICY")
        candidate = RuleCandidate.objects.create(
            source_document=document,
            dimension="GROSS_WEIGHT",
            threshold=24000,
            unit="kg",
            source_reference="SOP §3.1",
            source_text_excerpt="Muatan total tidak boleh melebihi 24 ton",
        )
        self.assertEqual(candidate.status, CandidateStatus.PENDING)

    def test_rule_belongs_to_a_versioned_pack(self):
        pack = RulePack.objects.create(origin=Origin.CLIENT, version=1)
        rule = Rule.objects.create(
            rule_pack=pack,
            dimension="GROSS_WEIGHT",
            threshold=24000,
            unit="kg",
            legal_citation="SOP §3.1",
        )
        self.assertEqual(rule.rule_pack.version, 1)
        self.assertEqual(rule.rule_pack.origin, Origin.CLIENT)
```

- [ ] **Step 3: Run — expect failure**

```bash
uv run --directory backend python manage.py test apps.rules -v 2
```

Expected: `ModuleNotFoundError` or `no such table`, because the migration does not exist yet.

- [ ] **Step 4: Make the migration and run again**

```bash
rm backend/apps/rules/tests.py
uv run --directory backend python manage.py makemigrations rules
uv run --directory backend python manage.py test apps.rules -v 2
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/rules/
git commit -m "feat(rules): add Rule Studio data model"
```

---

### Task B2: PDF text extraction

**Files:**
- Create: `backend/apps/rules/pdf.py`
- Create: `backend/apps/rules/tests/test_pdf.py`

**Interfaces:**
- Produces: `extract_text(file_like) -> tuple[str, int]` returning `(text, page_count)`, and `PdfUnreadable`. B3 consumes both.

This task is deliberately LLM-free. A scanned PDF with no text layer is detected here, deterministically, and classified `UNREADABLE` without spending a single token.

- [ ] **Step 1: Write the test**

```python
# backend/apps/rules/tests/test_pdf.py
import io

import fitz
from django.test import TestCase

from apps.rules.pdf import PdfUnreadable, extract_text


def make_pdf(pages):
    document = fitz.open()
    for body in pages:
        page = document.new_page()
        if body:
            page.insert_text((72, 72), body, fontsize=11)
    buffer = io.BytesIO(document.write())
    document.close()
    return buffer


class ExtractTextTests(TestCase):
    def test_returns_text_and_page_count(self):
        pdf = make_pdf(["Muatan total maksimum 24 ton", "Halaman dua"])
        text, page_count = extract_text(pdf)
        self.assertIn("24 ton", text)
        self.assertEqual(page_count, 2)

    def test_raises_when_there_is_no_text_layer(self):
        pdf = make_pdf(["", ""])
        with self.assertRaises(PdfUnreadable):
            extract_text(pdf)

    def test_rejects_a_file_that_is_not_a_pdf(self):
        with self.assertRaises(PdfUnreadable):
            extract_text(io.BytesIO(b"this is not a pdf"))
```

- [ ] **Step 2: Run — expect failure**

```bash
uv run --directory backend python manage.py test apps.rules.tests.test_pdf -v 2
```

Expected: `ModuleNotFoundError: No module named 'apps.rules.pdf'`

- [ ] **Step 3: Implement**

```python
# backend/apps/rules/pdf.py
"""PDF text extraction. No LLM, no Django imports — keep this unit testable alone."""

import fitz

# Below this, we treat the document as having no usable text layer. A scanned
# PDF typically yields a handful of stray characters at most.
MIN_USABLE_CHARS = 40


class PdfUnreadable(Exception):
    """No extractable text layer. OCR is out of scope for the MVP."""


def extract_text(file_like):
    """Return (text, page_count). Raises PdfUnreadable for scans and non-PDFs."""
    file_like.seek(0)
    payload = file_like.read()
    try:
        document = fitz.open(stream=payload, filetype="pdf")
    except Exception as error:
        raise PdfUnreadable("File could not be opened as a PDF") from error

    try:
        pages = [page.get_text() for page in document]
        page_count = document.page_count
    finally:
        document.close()

    text = "\n".join(pages).strip()
    if len(text) < MIN_USABLE_CHARS:
        raise PdfUnreadable("No extractable text layer")
    return text, page_count


def sample_for_triage(text, max_chars=4000):
    """Truncated sample for the cheap classification pass. PRODUCT.md F3a."""
    return text[:max_chars]
```

- [ ] **Step 4: Run — expect pass**

```bash
uv run --directory backend python manage.py test apps.rules.tests.test_pdf -v 2
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/rules/pdf.py backend/apps/rules/tests/test_pdf.py
git commit -m "feat(rules): extract PDF text and detect scans without OCR"
```

---

### Task B3: Gemini triage

**Files:**
- Create: `backend/apps/rules/llm.py`
- Create: `backend/apps/rules/tests/test_llm.py`
- Modify: `backend/pyproject.toml` (add `google-genai`)

**Interfaces:**
- Consumes: `sample_for_triage` from B2.
- Produces: `triage(text) -> TriageResult(classification: str, confidence: float)`, `extract_candidates(text) -> list[dict]`, `LlmUnavailable`. B4 and B5 consume these.

The model returns **one enum plus a confidence score**. No prose. That is the token saving described in `PRODUCT.md` F3a.

- [ ] **Step 1: Add the dependency**

```bash
uv add --directory backend google-genai
```

- [ ] **Step 2: Write the test**

The test never calls Gemini. It injects a fake client, so the suite runs offline and free.

```python
# backend/apps/rules/tests/test_llm.py
import json

from django.test import TestCase

from apps.rules.llm import LlmUnavailable, extract_candidates, triage


class FakeResponse:
    def __init__(self, payload):
        self.text = json.dumps(payload)


class FakeModels:
    def __init__(self, payload=None, error=None):
        self.payload = payload
        self.error = error
        self.calls = []

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return FakeResponse(self.payload)


class FakeClient:
    def __init__(self, payload=None, error=None):
        self.models = FakeModels(payload, error)


class TriageTests(TestCase):
    def test_returns_classification_and_confidence(self):
        client = FakeClient({"classification": "INTERNAL_POLICY", "confidence": 0.94})
        result = triage("Muatan total maksimum 24 ton", client=client)
        self.assertEqual(result.classification, "INTERNAL_POLICY")
        self.assertAlmostEqual(result.confidence, 0.94)

    def test_unknown_category_falls_back_to_unrelated(self):
        """PRODUCT.md F3a: anything unrecognised is UNRELATED, never passed through."""
        client = FakeClient({"classification": "SOMETHING_NEW", "confidence": 0.9})
        self.assertEqual(triage("...", client=client).classification, "UNRELATED")

    def test_raises_when_the_model_is_unreachable(self):
        client = FakeClient(error=RuntimeError("connection reset"))
        with self.assertRaises(LlmUnavailable):
            triage("...", client=client)

    def test_sends_only_a_truncated_sample(self):
        client = FakeClient({"classification": "UNRELATED", "confidence": 0.5})
        triage("x" * 10000, client=client)
        sent = client.models.calls[0]["contents"]
        self.assertLess(len(sent), 6000)


class ExtractTests(TestCase):
    def test_returns_normalised_candidates(self):
        client = FakeClient(
            {
                "candidates": [
                    {
                        "dimension": "GROSS_WEIGHT",
                        "operator": "LTE",
                        "threshold": 24000,
                        "unit": "kg",
                        "applies_to": {"axle_config": ["1.2"]},
                        "source_reference": "SOP §3.1",
                        "source_text_excerpt": "Muatan total tidak boleh melebihi 24 ton",
                        "source_page": 3,
                        "tags": ["internal"],
                    }
                ]
            }
        )
        candidates = extract_candidates("...", client=client)
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0]["threshold"], 24000)
        self.assertIsInstance(candidates[0]["threshold"], int)

    def test_drops_candidates_with_an_unknown_dimension(self):
        client = FakeClient({"candidates": [{"dimension": "COLOUR", "threshold": 1, "unit": "kg"}]})
        self.assertEqual(extract_candidates("...", client=client), [])
```

- [ ] **Step 3: Run — expect failure**

```bash
uv run --directory backend python manage.py test apps.rules.tests.test_llm -v 2
```

Expected: `ModuleNotFoundError: No module named 'apps.rules.llm'`

- [ ] **Step 4: Implement**

```python
# backend/apps/rules/llm.py
"""The only module that talks to Gemini.

Called at rule-authoring time only. Nothing here may ever be imported by
apps.validation — see the zero-LLM-at-runtime constraint in docs/ENGINEERING.md §1.
"""

import json
from dataclasses import dataclass

from django.conf import settings

from .pdf import sample_for_triage

MODEL = "gemini-2.5-flash"

CLASSIFICATIONS = {
    "INTERNAL_POLICY",
    "PUBLIC_REGULATION",
    "OPERATIONAL_DOC",
    "UNREADABLE",
    "UNRELATED",
}
DIMENSIONS = {
    "GROSS_WEIGHT",
    "AXLE_LOAD",
    "DIMENSION_LENGTH",
    "DIMENSION_WIDTH",
    "DIMENSION_HEIGHT",
    "AXLE_CONFIG",
}
OPERATORS = {"LTE", "GTE", "EQ"}


class LlmUnavailable(Exception):
    """Gemini could not be reached or returned something unusable."""


@dataclass
class TriageResult:
    classification: str
    confidence: float


def _client():
    if not settings.GEMINI_API_KEY:
        raise LlmUnavailable("GEMINI_API_KEY is not set")
    from google import genai

    return genai.Client(api_key=settings.GEMINI_API_KEY)


def _generate(client, prompt, schema):
    from google.genai import types

    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=schema,
                temperature=0,
            ),
        )
        return json.loads(response.text)
    except LlmUnavailable:
        raise
    except Exception as error:
        raise LlmUnavailable(str(error)) from error


TRIAGE_PROMPT = """You classify documents for a freight-compliance system.

Return the single category that best describes the document below.

INTERNAL_POLICY - an internal SOP, safety policy, or contract term that states
  load, weight, or dimension constraints for vehicles
PUBLIC_REGULATION - a government regulation
OPERATIONAL_DOC - an invoice, packing list, delivery order, or manifest
UNREADABLE - unintelligible or empty
UNRELATED - anything not about freight, load, or vehicle constraints

Also return your confidence from 0.0 to 1.0.

DOCUMENT:
{sample}
"""

TRIAGE_SCHEMA = {
    "type": "object",
    "properties": {
        "classification": {"type": "string", "enum": sorted(CLASSIFICATIONS)},
        "confidence": {"type": "number"},
    },
    "required": ["classification", "confidence"],
}


def triage(text, client=None):
    """One cheap classification call on a truncated sample. PRODUCT.md F3a."""
    client = client or _client()
    payload = _generate(
        client, TRIAGE_PROMPT.format(sample=sample_for_triage(text)), TRIAGE_SCHEMA
    )
    classification = payload.get("classification")
    if classification not in CLASSIFICATIONS:
        classification = "UNRELATED"
    try:
        confidence = float(payload.get("confidence", 0.0))
    except (TypeError, ValueError):
        confidence = 0.0
    return TriageResult(classification, max(0.0, min(1.0, confidence)))


EXTRACT_PROMPT = """Extract every load or dimension constraint stated in the
document below. Convert all weights to integer kilograms and all dimensions to
integer millimetres.

Only extract constraints the document actually states. Do not infer, do not
supply values from your own knowledge of regulations, and return an empty list
if the document states none.

source_text_excerpt must be copied verbatim from the document.

DOCUMENT:
{text}
"""

EXTRACT_SCHEMA = {
    "type": "object",
    "properties": {
        "candidates": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "dimension": {"type": "string", "enum": sorted(DIMENSIONS)},
                    "operator": {"type": "string", "enum": sorted(OPERATORS)},
                    "threshold": {"type": "integer"},
                    "unit": {"type": "string", "enum": ["kg", "mm"]},
                    "applies_to": {"type": "object", "properties": {}},
                    "source_reference": {"type": "string"},
                    "source_text_excerpt": {"type": "string"},
                    "source_page": {"type": "integer"},
                    "tags": {"type": "array", "items": {"type": "string"}},
                },
                "required": [
                    "dimension",
                    "operator",
                    "threshold",
                    "unit",
                    "source_reference",
                    "source_text_excerpt",
                    "source_page",
                ],
            },
        }
    },
    "required": ["candidates"],
}


def extract_candidates(text, client=None):
    """Full extraction. Only run on INTERNAL_POLICY documents. PRODUCT.md F3b."""
    client = client or _client()
    payload = _generate(client, EXTRACT_PROMPT.format(text=text[:30000]), EXTRACT_SCHEMA)

    # Whitelist the keys. These become RuleCandidate(**candidate) in B5, so an
    # unexpected key from the model would raise TypeError at create() time.
    FIELDS = (
        "dimension",
        "operator",
        "threshold",
        "unit",
        "applies_to",
        "source_reference",
        "source_text_excerpt",
        "source_page",
        "tags",
    )

    candidates = []
    for raw in payload.get("candidates", []):
        if raw.get("dimension") not in DIMENSIONS:
            continue
        try:
            threshold = int(raw["threshold"])
        except (KeyError, TypeError, ValueError):
            continue

        candidate = {key: raw[key] for key in FIELDS if key in raw}
        candidate["threshold"] = threshold
        if candidate.get("operator") not in OPERATORS:
            candidate["operator"] = "LTE"
        candidate.setdefault("unit", "kg")
        candidate.setdefault("applies_to", {})
        candidate.setdefault("tags", [])
        candidate.setdefault("source_page", 1)
        candidate.setdefault("source_reference", "")
        candidate.setdefault("source_text_excerpt", "")
        candidates.append(candidate)
    return candidates
```

- [ ] **Step 5: Run — expect pass**

```bash
uv run --directory backend python manage.py test apps.rules -v 2
```

Expected: all tests pass, no network calls.

- [ ] **Step 6: Commit**

```bash
git add backend/apps/rules/llm.py backend/apps/rules/tests/test_llm.py backend/pyproject.toml backend/uv.lock
git commit -m "feat(rules): add Gemini triage and constrained extraction"
```

---

### Task B4: `POST /documents` — upload and triage

**Files:**
- Create: `backend/apps/rules/presenters.py`
- Modify: `backend/apps/rules/views.py`, `backend/apps/rules/urls.py`
- Create: `backend/apps/rules/tests/test_documents_api.py`

**Interfaces:**
- Consumes: `extract_text`, `PdfUnreadable` (B2); `triage`, `LlmUnavailable` (B3).
- Produces: `POST /api/v1/documents`. Response shape is `contract/documents.triage.accepted.json`.

- [ ] **Step 1: Write the test**

```python
# backend/apps/rules/tests/test_documents_api.py
import io
import json

import fitz
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from unittest.mock import patch

from apps.rules.llm import TriageResult


def fixture(name):
    with open(settings.CONTRACT_DIR / name) as handle:
        return json.load(handle)


def pdf_upload(name="SOP-Gudang-Cikarang-v2.pdf", body="Muatan total maksimum 24 ton per unit."):
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), body, fontsize=11)
    payload = document.write()
    document.close()
    return SimpleUploadedFile(name, payload, content_type="application/pdf")


class UploadTests(TestCase):
    def post(self, upload):
        return self.client.post("/api/v1/documents", {"file": upload})

    @patch("apps.rules.views.triage", return_value=TriageResult("INTERNAL_POLICY", 0.94))
    def test_accepted_document_matches_the_fixture_shape(self, _mock):
        response = self.post(pdf_upload())
        self.assertEqual(response.status_code, 201)
        self.assertEqual(set(response.json()), set(fixture("documents.triage.accepted.json")))
        self.assertTrue(response.json()["accepted"])

    @patch("apps.rules.views.triage", return_value=TriageResult("OPERATIONAL_DOC", 0.97))
    def test_operational_doc_is_rejected(self, _mock):
        body = self.post(pdf_upload("packing-list-0042.pdf")).json()
        self.assertFalse(body["accepted"])
        self.assertEqual(body["rejection_reason_code"], "OPERATIONAL_DOC")

    @patch("apps.rules.views.triage", return_value=TriageResult("INTERNAL_POLICY", 0.40))
    def test_low_confidence_is_not_accepted_but_flags_human_review(self, _mock):
        body = self.post(pdf_upload()).json()
        self.assertFalse(body["accepted"])
        self.assertTrue(body["needs_human_review"])

    def test_scanned_pdf_is_unreadable_and_never_calls_the_model(self):
        document = fitz.open()
        document.new_page()
        payload = document.write()
        document.close()
        upload = SimpleUploadedFile("scan.pdf", payload, content_type="application/pdf")
        with patch("apps.rules.views.triage") as mock_triage:
            body = self.post(upload).json()
        mock_triage.assert_not_called()
        self.assertEqual(body["classification"], "UNREADABLE")

    def test_non_pdf_is_rejected_with_the_error_envelope(self):
        upload = SimpleUploadedFile("notes.txt", b"hello", content_type="text/plain")
        response = self.post(upload)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "VALIDATION_ERROR")
```

- [ ] **Step 2: Run — expect failure (404, no route yet)**

```bash
uv run --directory backend python manage.py test apps.rules.tests.test_documents_api -v 2
```

- [ ] **Step 3: Implement the presenter**

```python
# backend/apps/rules/presenters.py
"""Model → contract-shaped dict. Every response shape lives here, once."""


def document_payload(document):
    return {
        "document_id": str(document.id),
        "filename": document.filename,
        "page_count": document.page_count,
        "classification": document.classification,
        "classification_confidence": round(document.classification_confidence, 2),
        "accepted": document.accepted,
        "rejection_reason_code": None if document.accepted else document.classification,
        "needs_human_review": document.needs_human_review,
        "uploaded_at": document.uploaded_at.astimezone().isoformat(timespec="seconds"),
    }


def candidate_payload(candidate):
    return {
        "candidate_id": str(candidate.id),
        "dimension": candidate.dimension,
        "operator": candidate.operator,
        "threshold": candidate.threshold,
        "unit": candidate.unit,
        "applies_to": candidate.applies_to,
        "source_reference": candidate.source_reference,
        "source_text_excerpt": candidate.source_text_excerpt,
        "source_page": candidate.source_page,
        "tags": candidate.tags,
        "status": candidate.status,
    }


def rule_payload(rule):
    return {
        "rule_id": str(rule.id),
        "dimension": rule.dimension,
        "operator": rule.operator,
        "threshold": rule.threshold,
        "unit": rule.unit,
        "applies_to": rule.applies_to,
        "legal_citation": rule.legal_citation,
        "origin": rule.rule_pack.origin,
        "rule_pack_version": rule.rule_pack.version,
        "status": "ACTIVE" if rule.is_active else "ARCHIVED",
        "effective_from": rule.rule_pack.effective_from.astimezone().isoformat(timespec="seconds"),
    }
```

- [ ] **Step 4: Implement the view**

```python
# backend/apps/rules/views.py
"""Rule Studio endpoints — api-contract.md §4 and §5."""

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from .llm import LlmUnavailable, triage
from .models import Classification, SourceDocument
from .pdf import PdfUnreadable, extract_text
from .presenters import document_payload

# Below this the model is not confident enough to decide alone, so the human does.
# api-contract.md §8 open item 1 — placeholder, needs testing with real documents.
CONFIDENCE_THRESHOLD = 0.75


def error(message, field=None, code="VALIDATION_ERROR", http_status=status.HTTP_400_BAD_REQUEST):
    body = {"code": code, "message": message}
    if field:
        body["field"] = field
    return Response({"error": body}, status=http_status)


@api_view(["POST"])
@parser_classes([MultiPartParser])
def upload_document(request):
    upload = request.FILES.get("file")
    if not upload:
        return error("A PDF file is required", field="file")
    if upload.size > settings.MAX_UPLOAD_BYTES:
        return error("File exceeds the 10 MB limit", field="file")
    if not upload.name.lower().endswith(".pdf"):
        return error("Only PDF files are accepted", field="file")

    try:
        text, page_count = extract_text(upload)
    except PdfUnreadable:
        document = SourceDocument.objects.create(
            file=upload,
            filename=upload.name,
            page_count=0,
            classification=Classification.UNREADABLE,
            classification_confidence=1.0,
            accepted=False,
            needs_human_review=False,
        )
        return Response(document_payload(document), status=status.HTTP_201_CREATED)

    try:
        result = triage(text)
    except LlmUnavailable as exc:
        return error(str(exc), code="UPSTREAM_TIMEOUT", http_status=status.HTTP_504_GATEWAY_TIMEOUT)

    confident = result.confidence >= CONFIDENCE_THRESHOLD
    document = SourceDocument.objects.create(
        file=upload,
        filename=upload.name,
        page_count=page_count,
        extracted_text=text,
        classification=result.classification,
        classification_confidence=result.confidence,
        accepted=confident and result.classification == Classification.INTERNAL_POLICY,
        needs_human_review=not confident,
    )
    return Response(document_payload(document), status=status.HTTP_201_CREATED)
```

- [ ] **Step 5: Wire the route**

```python
# backend/apps/rules/urls.py
"""Rule Studio + Rules routes — api-contract.md §4 and §5."""

from django.urls import path

from . import views

urlpatterns = [
    path("documents", views.upload_document, name="upload-document"),
]
```

- [ ] **Step 6: Run — expect pass**

```bash
uv run --directory backend python manage.py test apps -v 2
```

Expected: all tests pass, including the ten existing validation contract tests.

- [ ] **Step 7: Sync point — post a real response to Xavier**

```bash
uv run --directory backend python manage.py runserver 8000
curl -s -X POST http://127.0.0.1:8000/api/v1/documents -F "file=@<a real PDF>" | python3 -m json.tool
```

Paste the output in chat. Xavier compares it to `contract/documents.triage.accepted.json`. Any difference is a contract bug — fix the fixture and the code together, and say so.

- [ ] **Step 8: Commit**

```bash
git add backend/apps/rules/
git commit -m "feat(rules): add document upload with triage"
```

---

### Task B5: Extraction, candidates, approve and reject

**Files:**
- Create: `backend/apps/rules/fallback.py`
- Modify: `backend/apps/rules/views.py`, `backend/apps/rules/urls.py`
- Create: `backend/apps/rules/tests/test_candidates_api.py`

**Interfaces:**
- Consumes: `extract_candidates`, `LlmUnavailable` (B3); `candidate_payload`, `rule_payload` (B4).
- Produces: `POST /documents/{id}/extract`, `GET /rule-candidates`, `POST /rule-candidates/{id}/approve`, `POST /rule-candidates/{id}/reject`, `GET /rules`.

- [ ] **Step 1: Write the test**

```python
# backend/apps/rules/tests/test_candidates_api.py
import json

from django.conf import settings
from django.test import TestCase
from unittest.mock import patch

from apps.rules.llm import LlmUnavailable
from apps.rules.models import CandidateStatus, Origin, RuleCandidate, SourceDocument


def fixture(name):
    with open(settings.CONTRACT_DIR / name) as handle:
        return json.load(handle)


GEMINI_CANDIDATE = {
    "dimension": "GROSS_WEIGHT",
    "operator": "LTE",
    "threshold": 24000,
    "unit": "kg",
    "applies_to": {"axle_config": ["1.2", "1.22"]},
    "source_reference": "SOP Internal Gudang Cikarang v2 §3.1",
    "source_text_excerpt": "Muatan total tidak boleh melebihi 24 ton…",
    "source_page": 3,
    "tags": ["internal", "stricter_than_legal"],
}


class ExtractionTests(TestCase):
    def setUp(self):
        self.document = SourceDocument.objects.create(
            filename="SOP-Gudang-Cikarang-v2.pdf",
            page_count=7,
            extracted_text="Muatan total tidak boleh melebihi 24 ton",
            classification="INTERNAL_POLICY",
            classification_confidence=0.94,
            accepted=True,
        )

    def url(self):
        return f"/api/v1/documents/{self.document.id}/extract"

    @patch("apps.rules.views.extract_candidates", return_value=[GEMINI_CANDIDATE])
    def test_response_matches_the_fixture_shape(self, _mock):
        response = self.client.post(self.url(), {"force": False}, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(set(body), set(fixture("documents.extract.json")))
        self.assertEqual(
            set(body["candidates"][0]), set(fixture("documents.extract.json")["candidates"][0])
        )
        self.assertFalse(body["used_fallback"])

    @patch("apps.rules.views.extract_candidates", side_effect=LlmUnavailable("timeout"))
    def test_falls_back_and_says_so(self, _mock):
        body = self.client.post(self.url(), {"force": False}, content_type="application/json").json()
        self.assertTrue(body["used_fallback"])
        self.assertTrue(body["candidates"])

    @patch("apps.rules.views.extract_candidates", return_value=[GEMINI_CANDIDATE])
    def test_rejected_document_returns_409_unless_forced(self, _mock):
        self.document.accepted = False
        self.document.save()
        response = self.client.post(self.url(), {"force": False}, content_type="application/json")
        self.assertEqual(response.status_code, 409)
        forced = self.client.post(self.url(), {"force": True}, content_type="application/json")
        self.assertEqual(forced.status_code, 200)


class ApprovalTests(TestCase):
    def setUp(self):
        document = SourceDocument.objects.create(
            filename="sop.pdf", classification="INTERNAL_POLICY", accepted=True
        )
        self.candidate = RuleCandidate.objects.create(
            source_document=document,
            dimension="GROSS_WEIGHT",
            threshold=24000,
            unit="kg",
            source_reference="SOP §3.1",
            source_text_excerpt="Muatan total tidak boleh melebihi 24 ton",
        )

    def test_approve_creates_a_versioned_client_rule(self):
        response = self.client.post(
            f"/api/v1/rule-candidates/{self.candidate.id}/approve",
            {"reviewed_by": "Compliance Officer"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(set(body), set(fixture("rule-candidate.approve.json")))
        self.assertEqual(body["status"], "APPROVED")

        self.candidate.refresh_from_db()
        self.assertEqual(self.candidate.status, CandidateStatus.APPROVED)
        self.assertEqual(self.candidate.approved_rule.rule_pack.origin, Origin.CLIENT)

    def test_rejected_candidate_creates_no_rule(self):
        response = self.client.post(
            f"/api/v1/rule-candidates/{self.candidate.id}/reject",
            {"reviewed_by": "Compliance Officer", "note": "Threshold ambiguous"},
            content_type="application/json",
        )
        self.assertEqual(response.json()["status"], "REJECTED")
        self.assertIsNone(response.json()["rule_id"])
        self.candidate.refresh_from_db()
        self.assertIsNone(self.candidate.approved_rule)

    def test_double_review_returns_409(self):
        url = f"/api/v1/rule-candidates/{self.candidate.id}/approve"
        self.client.post(url, {"reviewed_by": "A"}, content_type="application/json")
        second = self.client.post(url, {"reviewed_by": "B"}, content_type="application/json")
        self.assertEqual(second.status_code, 409)

    def test_pending_candidates_are_listed(self):
        body = self.client.get("/api/v1/rule-candidates?status=PENDING").json()
        self.assertEqual(set(body), {"results", "total"})
        self.assertEqual(body["total"], 1)
```

- [ ] **Step 2: Run — expect failure**

```bash
uv run --directory backend python manage.py test apps.rules.tests.test_candidates_api -v 2
```

- [ ] **Step 3: Write the fallback**

```python
# backend/apps/rules/fallback.py
"""Pre-processed extraction result for the demo SOP.

PRODUCT.md §8: build the fallback alongside the live path, not after. If Gemini
is unreachable at the booth, the reveal still runs and the UI says it fell back.
"""

FALLBACK_CANDIDATES = [
    {
        "dimension": "GROSS_WEIGHT",
        "operator": "LTE",
        "threshold": 24000,
        "unit": "kg",
        "applies_to": {"axle_config": ["1.2", "1.22"]},
        "source_reference": "SOP Internal Gudang Cikarang v2 §3.1",
        "source_text_excerpt": "Muatan total tidak boleh melebihi 24 ton untuk kendaraan sumbu ganda…",
        "source_page": 3,
        "tags": ["internal", "stricter_than_legal"],
    }
]
```

- [ ] **Step 4: Add the views**

Append to `backend/apps/rules/views.py`:

```python
import time

from django.utils import timezone

from .fallback import FALLBACK_CANDIDATES
from .llm import extract_candidates
from .models import CandidateStatus, Origin, Rule, RuleCandidate, RulePack
from .presenters import candidate_payload, rule_payload


@api_view(["POST"])
def extract_document(request, document_id):
    try:
        document = SourceDocument.objects.get(id=document_id)
    except (SourceDocument.DoesNotExist, ValueError):
        return error("Document not found", code="NOT_FOUND", http_status=status.HTTP_404_NOT_FOUND)

    force = bool(request.data.get("force", False))
    if not document.accepted and not force:
        return error(
            "Document was rejected at triage",
            code="CONFLICT",
            http_status=status.HTTP_409_CONFLICT,
        )

    started = time.perf_counter()
    used_fallback = False
    try:
        raw_candidates = extract_candidates(document.extracted_text)
    except LlmUnavailable:
        raw_candidates = FALLBACK_CANDIDATES
        used_fallback = True

    document.candidates.filter(status=CandidateStatus.PENDING).delete()
    candidates = [
        RuleCandidate.objects.create(source_document=document, **raw) for raw in raw_candidates
    ]

    return Response(
        {
            "document_id": str(document.id),
            "candidates": [candidate_payload(c) for c in candidates],
            "extraction_ms": max(1, round((time.perf_counter() - started) * 1000)),
            "used_fallback": used_fallback,
        }
    )


@api_view(["GET"])
def list_candidates(request):
    wanted = request.query_params.get("status", CandidateStatus.PENDING)
    queryset = RuleCandidate.objects.filter(status=wanted)
    return Response(
        {"results": [candidate_payload(c) for c in queryset], "total": queryset.count()}
    )


def _review(candidate_id, reviewed_by, note, approve):
    try:
        candidate = RuleCandidate.objects.get(id=candidate_id)
    except (RuleCandidate.DoesNotExist, ValueError):
        return None, error(
            "Candidate not found", code="NOT_FOUND", http_status=status.HTTP_404_NOT_FOUND
        )
    if candidate.status != CandidateStatus.PENDING:
        return None, error(
            f"Candidate is already {candidate.status}",
            code="CONFLICT",
            http_status=status.HTTP_409_CONFLICT,
        )

    candidate.reviewed_by = reviewed_by
    candidate.reviewed_at = timezone.now()
    candidate.review_note = note or ""
    candidate.status = CandidateStatus.APPROVED if approve else CandidateStatus.REJECTED

    if approve:
        # A new version rather than an overwrite. PRODUCT.md F3b.
        latest = RulePack.objects.filter(origin=Origin.CLIENT).order_by("-version").first()
        pack = RulePack.objects.create(
            origin=Origin.CLIENT, version=(latest.version + 1) if latest else 1
        )
        if latest:
            latest.is_active = False
            latest.save(update_fields=["is_active"])
            for rule in latest.rules.filter(is_active=True):
                Rule.objects.create(
                    rule_pack=pack,
                    dimension=rule.dimension,
                    operator=rule.operator,
                    threshold=rule.threshold,
                    unit=rule.unit,
                    applies_to=rule.applies_to,
                    legal_citation=rule.legal_citation,
                    tags=rule.tags,
                )
        candidate.approved_rule = Rule.objects.create(
            rule_pack=pack,
            dimension=candidate.dimension,
            operator=candidate.operator,
            threshold=candidate.threshold,
            unit=candidate.unit,
            applies_to=candidate.applies_to,
            legal_citation=candidate.source_reference,
            tags=candidate.tags,
        )

    candidate.save()
    return candidate, None


def _review_payload(candidate):
    rule = candidate.approved_rule
    return {
        "candidate_id": str(candidate.id),
        "status": candidate.status,
        "rule_id": str(rule.id) if rule else None,
        "rule_pack_id": str(rule.rule_pack.id) if rule else None,
        "rule_pack_version": rule.rule_pack.version if rule else None,
        "reviewed_by": candidate.reviewed_by,
        "reviewed_at": candidate.reviewed_at.astimezone().isoformat(timespec="seconds"),
    }


@api_view(["POST"])
def approve_candidate(request, candidate_id):
    candidate, failure = _review(candidate_id, request.data.get("reviewed_by", ""), "", approve=True)
    return failure or Response(_review_payload(candidate))


@api_view(["POST"])
def reject_candidate(request, candidate_id):
    candidate, failure = _review(
        candidate_id, request.data.get("reviewed_by", ""), request.data.get("note", ""), approve=False
    )
    return failure or Response(_review_payload(candidate))


@api_view(["GET"])
def list_rules(request):
    queryset = Rule.objects.filter(is_active=True, rule_pack__is_active=True).select_related("rule_pack")
    if origin := request.query_params.get("origin"):
        queryset = queryset.filter(rule_pack__origin=origin)
    if dimension := request.query_params.get("dimension"):
        queryset = queryset.filter(dimension=dimension)
    return Response({"results": [rule_payload(r) for r in queryset], "total": queryset.count()})
```

- [ ] **Step 5: Wire the routes**

```python
# backend/apps/rules/urls.py
from django.urls import path

from . import views

urlpatterns = [
    path("documents", views.upload_document, name="upload-document"),
    path("documents/<uuid:document_id>/extract", views.extract_document, name="extract-document"),
    path("rule-candidates", views.list_candidates, name="list-candidates"),
    path("rule-candidates/<uuid:candidate_id>/approve", views.approve_candidate, name="approve-candidate"),
    path("rule-candidates/<uuid:candidate_id>/reject", views.reject_candidate, name="reject-candidate"),
    path("rules", views.list_rules, name="list-rules"),
]
```

- [ ] **Step 6: Run — expect pass**

```bash
uv run --directory backend python manage.py test apps -v 2
```

- [ ] **Step 7: Commit, then the integration checkpoint**

```bash
git add backend/apps/rules/
git commit -m "feat(rules): add extraction, candidate review, and rule listing"
```

Tell Xavier the backend is ready. This is the **integration checkpoint** — see the sync table.

---

### Task B6: The demo SOP document

**Files:**
- Create: `backend/apps/rules/management/commands/make_demo_sop.py`
- Create: `backend/apps/rules/management/__init__.py`, `backend/apps/rules/management/commands/__init__.py`

**Interfaces:**
- Produces: `demo/SOP-Gudang-Cikarang-v2.pdf`, the document used in demo steps 5–7.

Seed data is endorsed by `docs/ENGINEERING.md` §6. This is a fictional client SOP, not a government document — so nothing here is a regulation citation, and the stricter-than-legal threshold is the client's own policy.

- [ ] **Step 1: Write the command**

```python
# backend/apps/rules/management/commands/make_demo_sop.py
"""Generates the fictional client SOP used in the Rule Studio demo.

This is invented seed data for a fictional company, not a real document and not
a regulation. It exists so the demo has an INTERNAL_POLICY document with a
stricter-than-legal threshold to extract.
"""

from pathlib import Path

import fitz
from django.core.management.base import BaseCommand

PAGES = [
    (
        "SOP INTERNAL — PT SINAR KARGO NUSANTARA",
        [
            "Standar Operasional Prosedur Pemuatan Armada",
            "Gudang Cikarang · Versi 2 · Berlaku 1 Februari 2026",
            "",
            "Dokumen internal. Bukan peraturan pemerintah.",
        ],
    ),
    (
        "§2  RUANG LINGKUP",
        [
            "SOP ini berlaku untuk seluruh pengiriman keluar dari Gudang Cikarang",
            "menggunakan armada milik sendiri maupun armada rekanan.",
            "",
            "Ketentuan dalam dokumen ini bersifat lebih ketat daripada batas legal",
            "nasional dan tidak menggantikannya.",
        ],
    ),
    (
        "§3  BATAS MUATAN",
        [
            "§3.1  Muatan total tidak boleh melebihi 24 ton untuk kendaraan sumbu",
            "ganda dengan konfigurasi 1.2 dan 1.22, meskipun batas legal nasional",
            "mengizinkan lebih. Selisih ini adalah margin keselamatan internal.",
            "",
            "§3.2  Tinggi muatan terukur dari permukaan jalan tidak boleh melebihi",
            "4.100 mm.",
            "",
            "§3.3  Pengawas gudang wajib menolak penerbitan delivery order apabila",
            "salah satu batas di atas terlampaui.",
        ],
    ),
]


class Command(BaseCommand):
    help = "Generate the fictional demo SOP PDF for Rule Studio"

    def handle(self, *args, **options):
        target = Path("demo/SOP-Gudang-Cikarang-v2.pdf")
        target.parent.mkdir(parents=True, exist_ok=True)

        document = fitz.open()
        for heading, lines in PAGES:
            page = document.new_page()
            page.insert_text((72, 90), heading, fontsize=14)
            for offset, line in enumerate(lines):
                page.insert_text((72, 125 + offset * 18), line, fontsize=10.5)
        document.save(str(target))
        document.close()

        self.stdout.write(self.style.SUCCESS(f"Wrote {target}"))
```

- [ ] **Step 2: Generate and verify it round-trips**

```bash
mkdir -p backend/apps/rules/management/commands
touch backend/apps/rules/management/__init__.py backend/apps/rules/management/commands/__init__.py
uv run --directory backend python manage.py make_demo_sop
```

Then upload it and confirm triage says `INTERNAL_POLICY`:

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/documents -F "file=@backend/demo/SOP-Gudang-Cikarang-v2.pdf" | python3 -m json.tool
```

Expected: `"classification": "INTERNAL_POLICY"`, `"accepted": true`. If it comes back `UNRELATED`, the prompt needs work — do not lower the confidence threshold to force it through.

- [ ] **Step 3: Also produce the rejection demo document**

Demo step 5 needs a packing list that gets rejected. Any real packing list PDF works. If you have none, add a second command block to `PAGES` — but a genuine operational document is more convincing.

- [ ] **Step 4: Commit**

```bash
git add backend/apps/rules/management/ backend/demo/
git commit -m "feat(rules): add demo SOP generator"
```

---

### Task B7: Client rules tighten live validation

**Files:**
- Modify: `backend/apps/validation/views.py` or `backend/apps/validation/engine.py`
- Create: `backend/apps/validation/tests/test_precedence.py`

**Interfaces:**
- Consumes: `Rule`, `RulePack`, `Origin` from `apps.rules.models`.

**Depends on Iqbal's P0 work** — the real engine reading rule packs from the database. Do this task after that, not before. This is the task that makes demo step 7 land: approve a client rule in Rule Studio, switch to dispatch, and a load that is legal nationally now HOLDs.

This must not import `apps.rules.llm`. Importing the models is fine; importing the LLM module would put Gemini on the dispatch path.

- [ ] **Step 1: Write the test**

```python
# backend/apps/validation/tests/test_precedence.py
from django.test import TestCase

from apps.rules.models import Origin, Rule, RulePack


class PrecedenceTests(TestCase):
    def setUp(self):
        central = RulePack.objects.create(origin=Origin.CENTRAL, version=3)
        Rule.objects.create(
            rule_pack=central,
            dimension="GROSS_WEIGHT",
            operator="LTE",
            threshold=25000,
            unit="kg",
            legal_citation="PM 111/2015 Pasal 4 ayat (2)",
        )
        client_pack = RulePack.objects.create(origin=Origin.CLIENT, version=1)
        Rule.objects.create(
            rule_pack=client_pack,
            dimension="GROSS_WEIGHT",
            operator="LTE",
            threshold=24000,
            unit="kg",
            legal_citation="SOP Internal Gudang Cikarang v2 §3.1",
        )

    def payload(self, gross):
        return {
            "dispatch_ref": "DO-TEST-0001",
            "vehicle": {"axle_config": "1.2", "tare_weight_kg": 8500},
            "load": {
                "gross_weight_kg": gross,
                "axle_loads_kg": [6800, 15600],
                "dimensions_mm": {"length": 12000, "width": 2500, "height": 4100},
            },
            "loading_point_id": "LP-CIKARANG-01",
        }

    def post(self, gross):
        return self.client.post(
            "/api/v1/validate", self.payload(gross), content_type="application/json"
        )

    def test_load_legal_nationally_but_over_client_policy_is_held(self):
        """Demo step 7. 24,500 kg is under the 25,000 kg legal limit but over
        the client's own 24,000 kg policy."""
        response = self.post(24500)
        self.assertEqual(response.status_code, 403)
        violation = next(
            v for v in response.json()["violations"] if v["dimension"] == "GROSS_WEIGHT"
        )
        self.assertEqual(violation["rule_origin"], "CLIENT")
        self.assertEqual(violation["limit_value"], 24000)

    def test_only_the_stricter_rule_appears(self):
        body = self.post(24500).json()
        gross_violations = [v for v in body["violations"] if v["dimension"] == "GROSS_WEIGHT"]
        self.assertEqual(len(gross_violations), 1)

    def test_directive_names_the_legal_limit_for_contrast(self):
        body = self.post(24500).json()
        violation = next(v for v in body["violations"] if v["dimension"] == "GROSS_WEIGHT")
        self.assertIn("25,000", violation["directive"])

    def test_load_under_both_limits_passes(self):
        self.assertEqual(self.post(22400).status_code, 200)
```

- [ ] **Step 2: Run — expect failure**

```bash
uv run --directory backend python manage.py test apps.validation.tests.test_precedence -v 2
```

- [ ] **Step 3: Expect this to pass with no new engine code**

**Precedence is already implemented** in Task B2 of `docs/plans/2026-08-11-validation-engine-and-dispatch.md`, and it is origin-agnostic — it compares thresholds without caring whether a rule came from VETO or a client. So the moment a `CLIENT` rule exists in the database, it participates automatically.

This task is therefore **verification, not implementation**. If the tests above pass as soon as you write them, that is the correct outcome — commit them and move on. They are the proof that demo step 7 works.

If they fail, the bug is in the P0 engine's `strictest()` stage, not here. Fix it there, where its own unit tests live.

- [ ] **Step 4: Run the whole suite**

```bash
uv run --directory backend python manage.py test apps -v 2
```

- [ ] **Step 5: Commit**

```bash
git add backend/apps/validation/
git commit -m "feat(validation): client rules override central when stricter"
```

---

# Track F — Frontend (Xavier)

Everything here runs on `VITE_USE_MOCKS=true`. You are not blocked by Iqbal at any point before the integration checkpoint.

**Before you start:** read `docs/ENGINEERING.md` §7. Rule Studio is the *register* surface — light ground, editorial measure, hairline rules, citations set as legal references, the source page treated as a document plate. It should look like a different tool from `/dispatch`, because a different person uses it.

Verification for every task is the same shape: `npm --prefix frontend run dev`, open the route, exercise the flow, confirm what the step says. No JS test runner — see the testing posture note.

### Task F1: Upload surface and flow state

**Files:**
- Modify: `frontend/src/routes/RuleStudio.jsx`
- Create: `frontend/src/components/rulestudio/DropZone.jsx`

**Interfaces:**
- Consumes: `uploadDocument` from `@/api`.
- Produces: flow state machine `idle → uploading → triaged → extracting → reviewing`. F2–F4 render off it.

- [ ] **Step 1: Build the drop zone** — accepts a single `.pdf`, click and drag-and-drop both, shows the filename once chosen, disabled while a request is in flight. Reject non-PDF and over-10 MB files client-side with a clear message before any request goes out; the backend also enforces both, and the two limits must agree.

- [ ] **Step 2: Hold the flow state in `RuleStudio.jsx`** as a single `stage` string plus `document`, `candidates`, and `error`. Do not spread this across component-local state — F3 and F4 both read it.

- [ ] **Step 3: Verify** — pick a PDF, see the filename, see a loading state during the ~900 ms mocked delay, land on `triaged` with the mock's `INTERNAL_POLICY` result. Name a file `packing-list.pdf` and confirm the mock returns the rejected fixture instead.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/RuleStudio.jsx frontend/src/components/rulestudio/
git commit -m "feat(rule-studio): add upload surface and flow state"
```

---

### Task F2: Triage result — three states

**Files:**
- Create: `frontend/src/components/rulestudio/TriageResult.jsx`
- Create: `frontend/src/copy/rejectionReasons.js`

**Interfaces:**
- Consumes: the `document` object from F1.
- Produces: `<TriageResult document onProceed onOverride />`.

The rejection sentences live here, not on the server. This is the token saving in `PRODUCT.md` F3a — the model returns a category, we supply the words.

- [ ] **Step 1: Write the copy map**

```javascript
// frontend/src/copy/rejectionReasons.js
/**
 * rejection_reason_code → what the operator reads.
 * The backend sends a category; the wording is ours. api-contract.md §4.
 */
export const REJECTION_REASONS = {
  PUBLIC_REGULATION:
    'Ini peraturan pemerintah. VETO sudah memelihara aturan nasional secara terpusat — tidak perlu diunggah.',
  OPERATIONAL_DOC:
    'Ini dokumen operasional, bukan dokumen kebijakan. Tidak ada aturan muatan yang bisa diambil dari sini.',
  UNREADABLE:
    'Dokumen ini hasil pindaian tanpa lapisan teks. VETO belum mendukung OCR.',
  UNRELATED:
    'Dokumen ini tidak berkaitan dengan muatan, dimensi, atau kendaraan angkutan.',
}

export const rejectionReason = (code) =>
  REJECTION_REASONS[code] ?? 'Dokumen ini tidak bisa diproses.'
```

- [ ] **Step 2: Render three distinct states**

1. `accepted: true` → show classification and confidence, offer **Ekstrak aturan**.
2. `accepted: false, needs_human_review: false` → show the mapped sentence. No extract button.
3. `needs_human_review: true` → show the sentence **plus** a secondary "Tinjau tetap" action calling extract with `force: true`. Per `PRODUCT.md` F3a the model narrows the decision, it does not make it — so this must never be a hard wall.

- [ ] **Step 3: Verify all three** — the accepted and rejected paths come from the two mock fixtures. For the third, temporarily edit `mocks.uploadDocument` to return `needs_human_review: true`, confirm the review-anyway action appears, then revert.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/rulestudio/TriageResult.jsx frontend/src/copy/
git commit -m "feat(rule-studio): add triage result states with mapped rejection copy"
```

---

### Task F3: The staged extraction reveal

**Files:**
- Create: `frontend/src/components/rulestudio/ExtractionStages.jsx`

**Interfaces:**
- Consumes: `extractRules` from `@/api`.
- Produces: `<ExtractionStages documentId onComplete />`.

`PRODUCT.md` F3b: *discrete stages, not a spinner — the reveal of the AI working is the point.* This is the highest-value 40 seconds in the demo. It is also the one thing here that must not look generic.

- [ ] **Step 1: Define the stages** — reading the document, locating constraint clauses, structuring thresholds, checking against the central rule base. Each resolves in turn while the single real request is in flight.

- [ ] **Step 2: Decouple stage timing from the response.** Stages advance on their own schedule; when the response lands, jump to complete. Never let a fast response skip the reveal entirely, and never let a slow response strand a stage forever — cap the reveal and show a settling state if the request outruns it.

- [ ] **Step 3: Surface the fallback honestly.** When `used_fallback` is `true`, say so — a small "hasil pra-proses" marker. `api-contract.md` §4 requires this be indicated rather than hidden.

- [ ] **Step 4: Respect `prefers-reduced-motion`** — collapse to a plain progress list.

- [ ] **Step 5: Verify** — the mock delays 2500 ms, enough to watch the whole sequence. Confirm the stages read as work happening, not decoration. Then temporarily set `used_fallback: true` in the mock and confirm the marker appears.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/rulestudio/ExtractionStages.jsx
git commit -m "feat(rule-studio): add staged extraction reveal"
```

---

### Task F4: Split-screen candidate review

**Files:**
- Create: `frontend/src/components/rulestudio/CandidateReview.jsx`

**Interfaces:**
- Consumes: `approveCandidate`, `rejectCandidate` from `@/api`; the `candidates` array from F3.
- Produces: `<CandidateReview candidate onApproved onRejected />`.

This is the human-in-the-loop gate — the differentiator. A judge should see instantly that a person decides, not the model.

- [ ] **Step 1: Build the split** — source on one side (`source_text_excerpt`, `source_reference`, `source_page`), extracted rule on the other (dimension, operator, threshold with unit, `applies_to`). The point is verification, so the excerpt and the threshold must be visually linked, not merely adjacent.

- [ ] **Step 2: Display units correctly.** The wire carries integer kg and mm. Show `24.000 kg` or `24 ton` and `4.100 mm` — Indonesian thousands separators. Never render a raw `24000`.

- [ ] **Step 3: Approve and reject.** Approve is the primary action. Reject asks for a note. Both send `reviewed_by`. On approve, show the new `rule_pack_version` — versioning made visible is what answers "who is responsible if a rule is wrong".

- [ ] **Step 4: Handle 409.** If the candidate was already reviewed, show a clean message and refresh the list. Do not leave a dead button.

- [ ] **Step 5: Verify** — full flow on mocks: upload → triage → extract → review → approve. Confirm the approved state shows the version. Confirm reject requires a note.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/rulestudio/CandidateReview.jsx
git commit -m "feat(rule-studio): add split-screen candidate review"
```

---

### Task F5: Integration

**Files:**
- Modify: `frontend/.env.local`

Do this with Iqbal, together, after B5.

- [ ] **Step 1:** Set `VITE_USE_MOCKS=false`, restart Vite, start Iqbal's backend on 8000.

- [ ] **Step 2:** Run upload → extract → approve against the real API using the demo SOP from B6.

- [ ] **Step 3:** For every mismatch, decide which side is wrong *against `api-contract.md`*, not against whichever is easier to change. Fix the fixture, the backend, and the mocks together in one commit so they never diverge.

- [ ] **Step 4:** Set `VITE_USE_MOCKS=true` again and confirm the mocked path still works. Both must stay green — the mocks are the demo fallback if the backend dies at the booth.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(rule-studio): wire frontend to live API"
```

---

## Definition of done

- [ ] `uv run --directory backend python manage.py test apps` is green
- [ ] Upload → triage → extract → approve works on mocks **and** against the live API
- [ ] A packing list is rejected at triage with a specific reason, and **no extraction call is made**
- [ ] Approving a client rule makes a nationally-legal load HOLD on `/dispatch` (demo step 7)
- [ ] Gemini being unreachable degrades to the fallback and says so, rather than breaking the flow
- [ ] `grep -r "llm" backend/apps/validation/` returns nothing
- [ ] No fabricated statistic or regulation citation anywhere in the surface
- [ ] Demo steps 5–7 rehearsed end to end, twice

## Deferred

- `CONFIDENCE_THRESHOLD` is 0.75 on a guess. Tune it once there are five or six real documents to test with.
- Uploaded files land on local disk. On Railway that filesystem is ephemeral, so uploads do not survive a redeploy. Fine for the demo; note it if anyone asks.
- No auth on any of these endpoints. Anyone who can reach the API can approve a rule. Accepted for the MVP per `docs/ENGINEERING.md` §4, but do not describe Rule Studio as access-controlled.
