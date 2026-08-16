# Validation Engine and Dispatch Implementation Plan — P0

> **How to work this plan:** Steps use checkbox (`- [ ]`) syntax for tracking. Each task ends with a commit. Do not start a task until the one before it in your own track is committed.

**Goal:** A warehouse officer enters truck and cargo figures, gets `PASS` or `HOLD` with a specific correction, fixes the load, resubmits, and passes — with every decision written to an append-only trail carrying its article citation.

**Architecture:** The engine is a pure function over plain data — no ORM, no Django, no network — so it can be tested exhaustively and can never accidentally acquire an LLM call. Rules come from the database as a list of specs; the view loads them, calls the engine, persists the decision, and returns. Precedence (stricter wins) lives in the engine and is origin-agnostic, so it already works for client rules before any client rule exists.

**Tech Stack:** Django 6 + DRF, React 19 + Tailwind 4, axios.

**This plan replaces the stub** in `backend/apps/validation/views.py`. That stub's response shape is correct and must survive unchanged.

---

## Global Constraints

Every task inherits these. From `docs/ENGINEERING.md`, `PRODUCT.md`, and `api-contract.md`.

- **Zero LLM calls at runtime.** Verifiable by inspection: nothing under `apps/validation/` may import `apps.rules.llm`. Importing `apps.rules.models` is fine.
- **Validation latency p95 under 300 ms** on seeded data.
- **Every decision, PASS or HOLD, writes an audit record before the response returns.** The rule pack version is recorded per decision so a past decision can be explained against the rules as they stood.
- **Units on the wire:** integer kilograms, integer millimetres. No floats, no tonnes, no metres. Frontend converts for display.
- **JSON keys `snake_case`. Enum values UPPERCASE.**
- **A HOLD is HTTP 403 and is a successful evaluation**, never an error envelope.
- **All violations are returned, not just the first.**
- **`decision` and `override` are append-only.** No edit or delete path exists in the API or the UI.
- **Never fabricate a statistic or a regulation citation.** Unverified thresholds must not reach the database — Task B1 enforces this mechanically.
- **No overclaiming.** VETO validates *declared* data. Do not imply guaranteed compliance, error elimination, or incident reduction anywhere in the UI.
- **If a response shape must change**, update `api-contract.md` and `contract/*.json` and tell the other track *before* changing code.

**Testing posture.** Track B is test-first — the engine is the product, and its boolean logic is exactly what a demo failure would expose. Track F verifies in the browser at each task rather than adding a JS test runner, per `docs/ENGINEERING.md` §4. Deliberate deviation.

---

## File structure

**Track B — Iqbal**

| File | Responsibility |
|---|---|
| `backend/apps/validation/types.py` | `RuleSpec`, `Violation`, `Decision` dataclasses. No Django. |
| `backend/apps/validation/directives.py` | Violation → human sentence. Deterministic templates. |
| `backend/apps/validation/engine.py` | `evaluate()`. Pure. The product. |
| `backend/apps/validation/rules.py` | DB rules → `list[RuleSpec]`. The only ORM-aware bit of the engine path. |
| `backend/apps/validation/models.py` | `Decision`, `Override` |
| `backend/apps/validation/views.py` | `/validate`, `/decisions`, `/decisions/{id}`, override |
| `backend/apps/validation/seeds/odol_central.json` | Central rule pack. Every row carries a verification block. |
| `backend/apps/validation/management/commands/seed_rules.py` | Loader that refuses unverified rows |
| `backend/apps/validation/tests/` | Existing contract tests plus engine tests |

**Track F — Xavier**

| File | Responsibility |
|---|---|
| `DESIGN.md` | The visual system. Written before the UI, not after. |
| `frontend/src/routes/Dispatch.jsx` | Surface composition and submit flow |
| `frontend/src/components/dispatch/DispatchForm.jsx` | Input fields, retains state across submits |
| `frontend/src/components/dispatch/Verdict.jsx` | PASS / HOLD result |
| `frontend/src/components/dispatch/ViolationList.jsx` | Directive plus citation per violation |
| `frontend/src/components/dispatch/OverrideDialog.jsx` | Reason-required override |
| `frontend/src/routes/AuditLog.jsx` | Append-only decision trail |
| `frontend/src/lib/format.js` | kg/mm → Indonesian display units |

**Shared, needs a heads-up before editing:** `api-contract.md`, `contract/*.json`, `frontend/src/api/*`.

---

## Sync points

| When | What | Who |
|---|---|---|
| After **B3** | Iqbal runs the two curl commands from B3 Step 6 and pastes both bodies. Xavier diffs against `contract/validate.response.*.json`. | both |
| After **B6** and **F4** | **Integration checkpoint.** `VITE_USE_MOCKS=false`, full loop against the real API. Budget two hours. | both |
| After **F5** | Rehearse demo steps 1–4 from `PRODUCT.md` §7, twice, end to end. | both |

---

# Track B — Backend (Iqbal)

### Task B1: Verified central rule pack

**Files:**
- Create: `backend/apps/validation/seeds/odol_central.json`
- Create: `backend/apps/validation/management/commands/seed_rules.py`
- Create: `backend/apps/validation/management/__init__.py`, `.../commands/__init__.py`
- Create: `backend/apps/validation/tests/test_seed.py`

**Interfaces:**
- Produces: rows in `apps.rules.models.Rule` under a `CENTRAL` `RulePack`. B2 and B3 consume them.

**Depends on `apps.rules.models` from the Rule Studio plan Task B1.** Do that task first — it is 20 minutes and both plans need it.

This task exists because `docs/ENGINEERING.md` §5 says never hardcode an unverified threshold and never fabricate a citation. Rather than trusting discipline, the loader refuses to insert a row whose `verification.status` is not `VERIFIED`. You cannot accidentally ship a made-up number.

- [ ] **Step 1: Create the seed file with every row unverified**

Structure only. The `threshold` and `legal_citation` values are filled in at Step 3, after you have read the regulation.

```json
{
  "domain": "ODOL",
  "version": 1,
  "origin": "CENTRAL",
  "rules": [
    {
      "dimension": "AXLE_LOAD",
      "operator": "LTE",
      "threshold": null,
      "unit": "kg",
      "applies_to": { "axle_config": ["1.2"], "axle_index": 0 },
      "legal_citation": null,
      "tags": ["odol", "axle"],
      "verification": {
        "status": "UNVERIFIED",
        "source_url": null,
        "source_page": null,
        "verified_by": null,
        "verified_at": null,
        "note": "Front axle limit for 1.2 configuration"
      }
    }
  ]
}
```

Add one entry per rule you intend to enforce. At minimum, to make demo steps 1–4 work:

- `GROSS_WEIGHT` for axle configs `1.2` and `1.22` (JBI)
- `AXLE_LOAD` per axle index for `1.2` and `1.22` (MST)
- `DIMENSION_LENGTH`, `DIMENSION_WIDTH`, `DIMENSION_HEIGHT`

- [ ] **Step 2: Write the loader**

```python
# backend/apps/validation/management/commands/seed_rules.py
"""Loads the central rule pack.

Refuses to insert a rule that has not been verified against the regulation
text. docs/ENGINEERING.md §5: never hardcode an unverified threshold, never fabricate a
citation. This makes that mechanical rather than aspirational.
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.rules.models import Origin, Rule, RulePack

SEED_PATH = Path(__file__).resolve().parents[2] / "seeds" / "odol_central.json"

REQUIRED_VERIFICATION_FIELDS = ("source_url", "verified_by", "verified_at")


class Command(BaseCommand):
    help = "Seed the central ODOL rule pack from seeds/odol_central.json"

    def add_arguments(self, parser):
        parser.add_argument(
            "--allow-unverified",
            action="store_true",
            help="Load unverified rules. Local development only — never for the demo build.",
        )

    def handle(self, *args, **options):
        payload = json.loads(SEED_PATH.read_text())
        allow_unverified = options["allow_unverified"]

        problems = []
        for index, rule in enumerate(payload["rules"]):
            label = f"rule[{index}] {rule.get('dimension')}"
            verification = rule.get("verification") or {}

            if verification.get("status") != "VERIFIED":
                problems.append(f"{label}: verification.status is not VERIFIED")
                continue
            for field in REQUIRED_VERIFICATION_FIELDS:
                if not verification.get(field):
                    problems.append(f"{label}: verification.{field} is empty")
            if rule.get("threshold") is None:
                problems.append(f"{label}: threshold is null")
            if not rule.get("legal_citation"):
                problems.append(f"{label}: legal_citation is empty")

        if problems and not allow_unverified:
            for problem in problems:
                self.stderr.write(self.style.ERROR(problem))
            raise CommandError(
                f"{len(problems)} unverified or incomplete rule(s). "
                "Verify them against the regulation text, or pass --allow-unverified "
                "for local development only."
            )

        with transaction.atomic():
            RulePack.objects.filter(origin=Origin.CENTRAL).update(is_active=False)
            pack = RulePack.objects.create(
                domain=payload["domain"], version=payload["version"], origin=Origin.CENTRAL
            )
            loaded = 0
            for rule in payload["rules"]:
                if rule.get("threshold") is None or not rule.get("legal_citation"):
                    continue
                Rule.objects.create(
                    rule_pack=pack,
                    dimension=rule["dimension"],
                    operator=rule["operator"],
                    threshold=rule["threshold"],
                    unit=rule["unit"],
                    applies_to=rule["applies_to"],
                    legal_citation=rule["legal_citation"],
                    tags=rule.get("tags", []),
                )
                loaded += 1

        self.stdout.write(self.style.SUCCESS(f"Seeded pack v{pack.version} with {loaded} rule(s)"))
```

- [ ] **Step 3: Do the verification**

For each row, read the regulation text and fill in `threshold`, `legal_citation`, and the whole `verification` block. Regulations to check:

- **UU 22/2009** — road classes and the general framework
- **PP 55/2012** — vehicle technical requirements
- **PM 111/2015** — speed and road-class limits, if you use it for MST
- **PM 60/2019** — freight transport by road

Two cautions:

1. **The official PM 60/2019 PDF from BPK is a 24 MB scan with no text layer.** `peraturan.bpk.go.id/Download/141279/PM_60_TAHUN_2019_rev.pdf`. Reading it means reading it, not extracting it.
2. **`PM 111/2015 Pasal 4 ayat (2)` and the 16,100 kg axle limit currently in `api-contract.md` and the stub are unverified.** They came from the contract draft, not from a source. Either confirm them or replace them. Do not carry them forward on trust.

`legal_citation` must name the article precisely — `PM 60/2019 Pasal 3 ayat (2)`, not `PM 60/2019`. It appears on screen and in the audit trail.

- [ ] **Step 4: Write the test**

```python
# backend/apps/validation/tests/test_seed.py
import json
from pathlib import Path

from django.core.management import CommandError, call_command
from django.test import TestCase

from apps.rules.models import Origin, Rule, RulePack

SEED_PATH = (
    Path(__file__).resolve().parents[1] / "seeds" / "odol_central.json"
)


class SeedTests(TestCase):
    def test_every_seeded_rule_is_verified(self):
        """The demo build must not contain an unverified threshold."""
        payload = json.loads(SEED_PATH.read_text())
        unverified = [
            rule["dimension"]
            for rule in payload["rules"]
            if (rule.get("verification") or {}).get("status") != "VERIFIED"
        ]
        self.assertEqual(unverified, [], f"unverified rules: {unverified}")

    def test_every_rule_cites_an_article_not_just_a_regulation(self):
        payload = json.loads(SEED_PATH.read_text())
        for rule in payload["rules"]:
            citation = rule.get("legal_citation") or ""
            self.assertIn(
                "Pasal", citation, f"{rule['dimension']} citation lacks an article: {citation!r}"
            )

    def test_seeding_creates_an_active_central_pack(self):
        call_command("seed_rules")
        pack = RulePack.objects.get(origin=Origin.CENTRAL, is_active=True)
        self.assertGreater(pack.rules.count(), 0)

    def test_reseeding_supersedes_rather_than_overwrites(self):
        call_command("seed_rules")
        call_command("seed_rules")
        self.assertEqual(RulePack.objects.filter(origin=Origin.CENTRAL, is_active=True).count(), 1)
        self.assertEqual(RulePack.objects.filter(origin=Origin.CENTRAL).count(), 2)
```

- [ ] **Step 5: Run**

```bash
mkdir -p backend/apps/validation/management/commands backend/apps/validation/seeds
touch backend/apps/validation/management/__init__.py backend/apps/validation/management/commands/__init__.py
uv run --directory backend python manage.py test apps.validation.tests.test_seed -v 2
```

The first two tests fail until Step 3 is genuinely done. That is the point — they are the gate.

- [ ] **Step 6: Commit**

```bash
git add backend/apps/validation/seeds/ backend/apps/validation/management/ backend/apps/validation/tests/test_seed.py
git commit -m "feat(validation): add verified central ODOL rule pack and loader"
```

---

### Task B2: The engine

**Files:**
- Create: `backend/apps/validation/types.py`
- Create: `backend/apps/validation/directives.py`
- Create: `backend/apps/validation/engine.py`
- Create: `backend/apps/validation/tests/test_engine.py`

**Interfaces:**
- Produces:
  - `RuleSpec(dimension, operator, threshold, unit, applies_to, legal_citation, origin, pack_id, pack_version)`
  - `Violation(dimension, actual_value, limit_value, excess_value, unit, severity, rule_origin, legal_citation, directive, axle_index=None)`
  - `Decision(outcome, violations, rule_packs_applied)`
  - `evaluate(payload: dict, rules: list[RuleSpec]) -> Decision`
- B3 consumes `evaluate` and the dataclasses.

No Django import in `engine.py`, `types.py`, or `directives.py`. That keeps the engine testable in isolation and makes the zero-LLM guarantee inspectable: a file with no imports cannot reach a model provider.

**Engine test data is invented and clearly local to the test.** It never reads the seed file. Real regulation values are Task B1's problem; the engine's correctness must not depend on them.

- [ ] **Step 1: Write the failing tests**

```python
# backend/apps/validation/tests/test_engine.py
"""Engine tests use invented thresholds, not the seeded regulation values.

The engine's job is comparison and precedence. Whether 24,000 is the real legal
limit is Task B1's concern. Coupling these tests to the seed would make a
regulation correction look like an engine regression.
"""

from django.test import SimpleTestCase

from apps.validation.engine import evaluate
from apps.validation.types import RuleSpec

CENTRAL_PACK = ("11111111-1111-4111-8111-111111111111", 3)
CLIENT_PACK = ("22222222-2222-4222-8222-222222222222", 1)


def central(dimension, threshold, unit="kg", applies_to=None):
    return RuleSpec(
        dimension=dimension,
        operator="LTE",
        threshold=threshold,
        unit=unit,
        applies_to=applies_to or {},
        legal_citation="TEST-REG Pasal 1",
        origin="CENTRAL",
        pack_id=CENTRAL_PACK[0],
        pack_version=CENTRAL_PACK[1],
    )


def client(dimension, threshold, unit="kg", applies_to=None):
    return RuleSpec(
        dimension=dimension,
        operator="LTE",
        threshold=threshold,
        unit=unit,
        applies_to=applies_to or {},
        legal_citation="SOP Internal §1",
        origin="CLIENT",
        pack_id=CLIENT_PACK[0],
        pack_version=CLIENT_PACK[1],
    )


def payload(gross=20000, axles=(6000, 14000), length=12000, width=2500, height=4100, config="1.2"):
    return {
        "dispatch_ref": "DO-TEST-0001",
        "vehicle": {"axle_config": config, "tare_weight_kg": 8500},
        "load": {
            "gross_weight_kg": gross,
            "axle_loads_kg": list(axles),
            "dimensions_mm": {"length": length, "width": width, "height": height},
        },
        "loading_point_id": "LP-TEST-01",
    }


class OutcomeTests(SimpleTestCase):
    def test_compliant_load_passes(self):
        decision = evaluate(payload(), [central("GROSS_WEIGHT", 25000)])
        self.assertEqual(decision.outcome, "PASS")
        self.assertEqual(decision.violations, [])

    def test_overweight_load_holds(self):
        decision = evaluate(payload(gross=26000), [central("GROSS_WEIGHT", 25000)])
        self.assertEqual(decision.outcome, "HOLD")

    def test_boundary_value_passes(self):
        """LTE means exactly at the limit is legal."""
        decision = evaluate(payload(gross=25000), [central("GROSS_WEIGHT", 25000)])
        self.assertEqual(decision.outcome, "PASS")

    def test_no_rules_means_nothing_to_violate(self):
        self.assertEqual(evaluate(payload(gross=99999), []).outcome, "PASS")


class ViolationDetailTests(SimpleTestCase):
    def test_violation_carries_actual_limit_and_excess(self):
        decision = evaluate(payload(gross=26340), [central("GROSS_WEIGHT", 25000)])
        violation = decision.violations[0]
        self.assertEqual(violation.actual_value, 26340)
        self.assertEqual(violation.limit_value, 25000)
        self.assertEqual(violation.excess_value, 1340)
        self.assertEqual(violation.unit, "kg")
        self.assertEqual(violation.legal_citation, "TEST-REG Pasal 1")

    def test_all_violations_are_returned_not_just_the_first(self):
        decision = evaluate(
            payload(gross=26000, height=4500),
            [central("GROSS_WEIGHT", 25000), central("DIMENSION_HEIGHT", 4200, unit="mm")],
        )
        self.assertEqual(len(decision.violations), 2)

    def test_axle_violation_carries_a_zero_based_index(self):
        rules = [central("AXLE_LOAD", 10000, applies_to={"axle_index": 1})]
        decision = evaluate(payload(axles=(6000, 11000)), rules)
        self.assertEqual(decision.violations[0].axle_index, 1)

    def test_non_axle_violation_has_no_axle_index(self):
        decision = evaluate(payload(gross=26000), [central("GROSS_WEIGHT", 25000)])
        self.assertIsNone(decision.violations[0].axle_index)


class ApplicabilityTests(SimpleTestCase):
    def test_rule_scoped_to_another_axle_config_does_not_apply(self):
        rules = [central("GROSS_WEIGHT", 20000, applies_to={"axle_config": ["1.22"]})]
        self.assertEqual(evaluate(payload(gross=24000, config="1.2"), rules).outcome, "PASS")

    def test_rule_scoped_to_this_axle_config_applies(self):
        rules = [central("GROSS_WEIGHT", 20000, applies_to={"axle_config": ["1.2", "1.22"]})]
        self.assertEqual(evaluate(payload(gross=24000, config="1.2"), rules).outcome, "HOLD")

    def test_unscoped_rule_applies_to_every_config(self):
        rules = [central("GROSS_WEIGHT", 20000)]
        self.assertEqual(evaluate(payload(gross=24000, config="1.22"), rules).outcome, "HOLD")


class PrecedenceTests(SimpleTestCase):
    """Stricter wins, regardless of origin. PRODUCT.md §4."""

    def test_stricter_client_rule_wins_over_central(self):
        rules = [central("GROSS_WEIGHT", 25000), client("GROSS_WEIGHT", 24000)]
        decision = evaluate(payload(gross=24500), rules)
        self.assertEqual(decision.outcome, "HOLD")
        self.assertEqual(decision.violations[0].rule_origin, "CLIENT")
        self.assertEqual(decision.violations[0].limit_value, 24000)

    def test_only_the_stricter_rule_produces_a_violation(self):
        rules = [central("GROSS_WEIGHT", 25000), client("GROSS_WEIGHT", 24000)]
        self.assertEqual(len(evaluate(payload(gross=26000), rules).violations), 1)

    def test_looser_client_rule_never_weakens_the_legal_limit(self):
        """A client cannot buy themselves a higher limit than the law allows."""
        rules = [central("GROSS_WEIGHT", 25000), client("GROSS_WEIGHT", 30000)]
        decision = evaluate(payload(gross=26000), rules)
        self.assertEqual(decision.outcome, "HOLD")
        self.assertEqual(decision.violations[0].rule_origin, "CENTRAL")
        self.assertEqual(decision.violations[0].limit_value, 25000)

    def test_directive_names_the_legal_limit_when_a_client_rule_wins(self):
        rules = [central("GROSS_WEIGHT", 25000), client("GROSS_WEIGHT", 24000)]
        directive = evaluate(payload(gross=24500), rules).violations[0].directive
        self.assertIn("25,000", directive)
        self.assertIn("500", directive)

    def test_packs_applied_lists_every_pack_consulted(self):
        rules = [central("GROSS_WEIGHT", 25000), client("GROSS_WEIGHT", 24000)]
        packs = evaluate(payload(), rules).rule_packs_applied
        self.assertEqual({p["origin"] for p in packs}, {"CENTRAL", "CLIENT"})


class DirectiveTests(SimpleTestCase):
    def test_weight_directive_states_the_correction(self):
        directive = evaluate(payload(gross=26340), [central("GROSS_WEIGHT", 25000)]).violations[0].directive
        self.assertIn("1,340", directive)

    def test_dimension_directive_uses_millimetres(self):
        rules = [central("DIMENSION_HEIGHT", 4200, unit="mm")]
        directive = evaluate(payload(height=4450), rules).violations[0].directive
        self.assertIn("250", directive)
        self.assertIn("mm", directive)
```

- [ ] **Step 2: Run — expect failure**

```bash
uv run --directory backend python manage.py test apps.validation.tests.test_engine -v 2
```

Expected: `ModuleNotFoundError: No module named 'apps.validation.engine'`

- [ ] **Step 3: Write the types**

```python
# backend/apps/validation/types.py
"""Plain data for the engine. No Django, no ORM — deliberately."""

from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class RuleSpec:
    dimension: str
    operator: str
    threshold: int
    unit: str
    applies_to: dict
    legal_citation: str
    origin: str
    pack_id: str
    pack_version: int


@dataclass
class Violation:
    dimension: str
    actual_value: int
    limit_value: int
    excess_value: int
    unit: str
    severity: str
    rule_origin: str
    legal_citation: str
    directive: str
    axle_index: Optional[int] = None

    def to_dict(self):
        """Contract shape. axle_index appears only for AXLE_LOAD — api-contract.md §1."""
        body = {"dimension": self.dimension}
        if self.dimension == "AXLE_LOAD":
            body["axle_index"] = self.axle_index
        body.update(
            {
                "actual_value": self.actual_value,
                "limit_value": self.limit_value,
                "excess_value": self.excess_value,
                "unit": self.unit,
                "severity": self.severity,
                "rule_origin": self.rule_origin,
                "legal_citation": self.legal_citation,
                "directive": self.directive,
            }
        )
        return body


@dataclass
class Decision:
    outcome: str
    violations: list = field(default_factory=list)
    rule_packs_applied: list = field(default_factory=list)
```

Key order matches `contract/validate.response.hold.json` for readability, though JSON object order is not semantically significant. What *is* significant: `axle_index` must be absent, not `null`, on non-axle violations — `test_axle_index_present_only_for_axle_load` in the existing contract suite asserts this.

- [ ] **Step 4: Write the directives**

```python
# backend/apps/validation/directives.py
"""Violation → one complete English sentence.

Deterministic templates. The frontend renders these as-is and never composes
directive text itself — api-contract.md §1.
"""


def _thousands(value):
    return f"{value:,}"


def gross_weight(excess, client_rule_wins, legal_limit):
    if client_rule_wins:
        return (
            f"Reduce total load by {_thousands(excess)} kg — client policy is stricter "
            f"than the legal limit of {_thousands(legal_limit)} kg"
        )
    return f"Reduce total load by {_thousands(excess)} kg"


def axle_load(excess, axle_index, axle_count):
    position = "rear axle" if axle_index == axle_count - 1 else f"axle {axle_index + 1}"
    return f"Reduce {position} load by {_thousands(excess)} kg"


def dimension(excess, axis):
    return f"Reduce load {axis} by {_thousands(excess)} mm"
```

- [ ] **Step 5: Write the engine**

Shape it as three stages, each small enough to read in one go:

1. `applicable(rules, axle_config)` — drop rules whose `applies_to.axle_config` excludes this vehicle. A rule with no `axle_config` key applies to everything.
2. `strictest(rules)` — group by `(dimension, applies_to.axle_index)` and keep one winner per group. For `LTE`, lowest threshold wins; for `GTE`, highest. Keep the losing central rule alongside the winner so the directive can name the legal limit for contrast.
3. `compare(payload, winners)` — produce a `Violation` per exceeded rule.

`rule_packs_applied` lists every distinct pack among the **applicable** rules, not only those that produced violations — a PASS must still record which pack version cleared it.

- [ ] **Step 6: Run — expect pass**

```bash
uv run --directory backend python manage.py test apps.validation.tests.test_engine -v 2
```

Expected: all engine tests pass.

- [ ] **Step 7: Prove the zero-LLM guarantee**

```bash
grep -rn "genai\|llm\|gemini" backend/apps/validation/ --include=*.py
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add backend/apps/validation/types.py backend/apps/validation/directives.py backend/apps/validation/engine.py backend/apps/validation/tests/test_engine.py
git commit -m "feat(validation): add deterministic rule engine with precedence"
```

---

### Task B3: Wire the engine into `POST /validate`

**Files:**
- Create: `backend/apps/validation/rules.py`
- Modify: `backend/apps/validation/views.py` — delete `STUB_LIMITS` and every `_check_*` helper

**Interfaces:**
- Consumes: `evaluate` (B2), the seeded pack (B1).
- Produces: `load_active_rules() -> list[RuleSpec]`.

The ten existing tests in `tests/test_contract.py` must stay green. They were written against the stub, and their whole purpose is that the shape survives this replacement. **If one fails, the shape moved — fix the code, not the test**, unless `api-contract.md` genuinely needs to change, in which case tell Xavier first.

Two of them will need their setup adjusted, because the stub had rules baked in and the real view has none until you seed. Add `call_command("seed_rules")` in `setUp`, or a small rule factory. Adjusting setup is fine; changing an assertion is not.

- [ ] **Step 1: Write the rule loader**

```python
# backend/apps/validation/rules.py
"""DB rules → engine specs. The only ORM-aware file on the validation path."""

from apps.rules.models import Rule

from .types import RuleSpec


def load_active_rules():
    queryset = (
        Rule.objects.filter(is_active=True, rule_pack__is_active=True)
        .select_related("rule_pack")
    )
    return [
        RuleSpec(
            dimension=rule.dimension,
            operator=rule.operator,
            threshold=rule.threshold,
            unit=rule.unit,
            applies_to=rule.applies_to or {},
            legal_citation=rule.legal_citation,
            origin=rule.rule_pack.origin,
            pack_id=str(rule.rule_pack.id),
            pack_version=rule.rule_pack.version,
        )
        for rule in queryset
    ]
```

- [ ] **Step 2: Rewrite the view**

Keep the request validation already in `views.py` — it is correct and the contract test depends on it. Replace only the evaluation: `evaluate(payload, load_active_rules())`, then build the response body from the `Decision`. Persisting comes in B4.

Delete `STUB_LIMITS`, `_check_gross_weight`, `_check_axle_loads`, `_check_dimensions`, `RULE_PACKS`, and the stub docstring.

- [ ] **Step 3: Run the whole suite**

```bash
uv run --directory backend python manage.py test apps -v 2
```

- [ ] **Step 4: Confirm the stub is gone**

```bash
grep -rn "STUB" backend/apps/validation/
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/validation/
git commit -m "feat(validation): replace stub with the real engine"
```

- [ ] **Step 6: Sync point — post real responses to Xavier**

```bash
uv run --directory backend python manage.py seed_rules
uv run --directory backend python manage.py runserver 8000
```

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/validate -H 'Content-Type: application/json' -d @contract/validate.request.pass.json | python3 -m json.tool
curl -s -X POST http://127.0.0.1:8000/api/v1/validate -H 'Content-Type: application/json' -d @contract/validate.request.hold.json | python3 -m json.tool
```

Paste both. Xavier diffs against the fixtures. **The real thresholds from B1 will differ from the fixture's example values** — that is expected and fine. What must match is the *shape*. If the fixture request no longer produces a HOLD at all, update the fixture request so it does, and tell Xavier.

---

### Task B4: Persist every decision

**Files:**
- Modify: `backend/apps/validation/models.py`, `backend/apps/validation/views.py`
- Create: `backend/apps/validation/tests/test_audit_write.py`

**Interfaces:**
- Produces: `Decision`, `Override` models. B5 and B6 consume them.

Name the model `DecisionRecord` in `models.py` to avoid colliding with the engine's `Decision` dataclass. Two things called `Decision` in one app is exactly the kind of ambiguity that costs an hour at 2am.

- [ ] **Step 1: Write the test**

```python
# backend/apps/validation/tests/test_audit_write.py
import json

from django.conf import settings
from django.core.management import call_command
from django.test import TestCase

from apps.validation.models import DecisionRecord


def fixture(name):
    with open(settings.CONTRACT_DIR / name) as handle:
        return json.load(handle)


class AuditWriteTests(TestCase):
    def setUp(self):
        call_command("seed_rules")

    def post(self, name):
        return self.client.post(
            "/api/v1/validate", fixture(name), content_type="application/json"
        )

    def test_a_pass_is_recorded(self):
        response = self.post("validate.request.pass.json")
        record = DecisionRecord.objects.get(id=response.json()["decision_id"])
        self.assertEqual(record.outcome, "PASS")

    def test_a_hold_is_recorded_with_its_violations(self):
        response = self.post("validate.request.hold.json")
        record = DecisionRecord.objects.get(id=response.json()["decision_id"])
        self.assertEqual(record.outcome, "HOLD")
        self.assertTrue(record.violations)

    def test_the_original_payload_is_stored_for_replay(self):
        response = self.post("validate.request.hold.json")
        record = DecisionRecord.objects.get(id=response.json()["decision_id"])
        self.assertEqual(record.payload["dispatch_ref"], fixture("validate.request.hold.json")["dispatch_ref"])

    def test_rule_pack_versions_are_recorded(self):
        response = self.post("validate.request.pass.json")
        record = DecisionRecord.objects.get(id=response.json()["decision_id"])
        self.assertTrue(record.rule_packs_applied)

    def test_an_invalid_payload_writes_no_record(self):
        payload = fixture("validate.request.hold.json")
        payload["load"]["axle_loads_kg"] = []
        self.client.post("/api/v1/validate", payload, content_type="application/json")
        self.assertEqual(DecisionRecord.objects.count(), 0)
```

- [ ] **Step 2: Run — expect failure, then add the models**

`DecisionRecord`: `id` UUID pk, `dispatch_ref`, `payload` JSON, `outcome`, `violations` JSON, `rule_packs_applied` JSON, `latency_ms`, `created_at`. `Override`: `id` UUID pk, one-to-one to `DecisionRecord`, `reason`, `overridden_by`, `created_at`.

Append-only is a discipline, not a database constraint here. Do not write an update or delete path, and do not register these in the Django admin with change permissions.

- [ ] **Step 3: Write the record before returning**

`latency_ms` measures the evaluation, not the database write — it is the number that has to stay under 300 ms and it appears in the UI.

- [ ] **Step 4: Run, then commit**

```bash
uv run --directory backend python manage.py makemigrations validation
uv run --directory backend python manage.py test apps -v 2
git add backend/apps/validation/
git commit -m "feat(validation): persist every decision to an append-only trail"
```

---

### Task B5: `GET /decisions` and `GET /decisions/{id}`

**Files:**
- Modify: `backend/apps/validation/views.py`, `backend/apps/audit/urls.py`
- Create: `backend/apps/validation/tests/test_decisions_api.py`

**Interfaces:**
- Produces: the two read endpoints in `api-contract.md` §3.

Routes live in `apps/audit/urls.py` — already included by `config/urls.py` — while the views stay in `apps/validation` next to the models. If that split annoys you, move the views to `apps/audit`; just do not leave them in two places.

- [ ] **Step 1: Write the test**

Assert against `contract/decisions.list.json`:
- list rows carry `violation_count`, never the full `violations` array
- `override` is `null` when absent
- `outcome`, `from`/`to`, `has_override`, `limit`, `offset` all filter
- `limit` is capped at 100
- detail returns the same shape as `/validate` plus `override` and `payload`
- **detail returns HTTP 200 for a HOLD** — the 403 convention is `/validate` only
- unknown id returns 404 in the error envelope

- [ ] **Step 2: Run — expect failure, then implement**

- [ ] **Step 3: Run, then commit**

```bash
uv run --directory backend python manage.py test apps -v 2
git add backend/apps/validation/ backend/apps/audit/
git commit -m "feat(audit): add decision list and detail endpoints"
```

---

### Task B6: `POST /decisions/{id}/override`

**Files:**
- Modify: `backend/apps/validation/views.py`, `backend/apps/audit/urls.py`
- Create: `backend/apps/validation/tests/test_override_api.py`

**Interfaces:**
- Produces: the override endpoint in `api-contract.md` §2.

This is the locked design decision from `docs/ENGINEERING.md` §1 made real: HOLD plus a logged override, not a hard block. The override appends; it never mutates the decision.

- [ ] **Step 1: Write the test**

- 201 with the `contract/override.response.json` shape
- `reason` under 10 characters → 400
- overriding a `PASS` → 400, there is nothing to override
- unknown decision → 404
- the original `DecisionRecord.outcome` is **still `HOLD`** afterwards
- overriding twice → 409, not a second row

- [ ] **Step 2: Run — expect failure, then implement**

- [ ] **Step 3: Run, then commit**

```bash
uv run --directory backend python manage.py test apps -v 2
git add backend/apps/validation/ backend/apps/audit/
git commit -m "feat(audit): add logged override for held dispatches"
```

Tell Xavier the backend is ready. This is the **integration checkpoint**.

---

### Task B7: Measure the latency

**Files:**
- Create: `backend/apps/validation/tests/test_latency.py`

**Interfaces:** none. This task adds no feature.

`PRODUCT.md` F1 sets p95 under 300 ms. Measure before optimising — with a few dozen seeded rules a plain query will almost certainly clear it, and caching you do not need is a bug you invited.

- [ ] **Step 1: Write the measurement**

Seed, then run 100 sequential `POST /validate` calls, collect `latency_ms`, assert the 95th percentile is under 300.

- [ ] **Step 2: Run**

```bash
uv run --directory backend python manage.py test apps.validation.tests.test_latency -v 2
```

- [ ] **Step 3: Only if it fails**, cache `load_active_rules()` in a module-level variable keyed on the active pack versions, and invalidate on `Rule` save. Do not add caching if the test passes.

- [ ] **Step 4: Commit**

```bash
git add backend/apps/validation/tests/test_latency.py
git commit -m "test(validation): assert p95 latency under 300ms"
```

---

# Track F — Frontend (Xavier)

Everything before F6 runs on `VITE_USE_MOCKS=true`. You are not blocked by Iqbal.

### Task F0: Write `DESIGN.md` first

**Files:**
- Create: `DESIGN.md`

`docs/ENGINEERING.md` §7 asks for `DESIGN.md`, and it does not exist yet. Write it before the UI, not after — otherwise it becomes a description of whatever you happened to build.

Use the `design-taste-frontend` skill to establish the direction, then record the decisions. It should be short and specific enough that a second person could build a new screen that looks like it belongs:

- [ ] **Step 1: Typefaces.** Which display face, which text face, which mono, and where each is used. Every numeric in this product is mono with tabular figures — weights, dimensions, latency, timestamps, citations. The numbers are the product.
- [ ] **Step 2: The two densities.** `/dispatch` is instrumentation: dark ground, high-density readouts, safety-signal colour. `/rule-studio` is a register: light ground, editorial measure, hairline rules. Same type system, different density. Write down what makes them one family.
- [ ] **Step 3: Colour.** Amber for HOLD, green for PASS, and what carries `CENTRAL` versus `CLIENT` rule origin. Include contrast ratios — a booth judge reads this from 1.5 m.
- [ ] **Step 4: Spacing scale and one grid.**
- [ ] **Step 5: Motion.** What animates and why. Per `docs/ENGINEERING.md` §7: the verdict arriving, the Rule Studio staged reveal, the HOLD→PASS transition. Nothing else. Name the easing and durations.
- [ ] **Step 6: The banned list** from `docs/ENGINEERING.md` §7 — no purple/blue gradients, no card-within-card, no meaningless glassmorphism, no decorative animation.

- [ ] **Step 7: Commit**

```bash
git add DESIGN.md
git commit -m "docs: establish the VETO visual system"
```

---

### Task F1: The dispatch form

**Files:**
- Modify: `frontend/src/routes/Dispatch.jsx` — replace the scaffold entirely
- Create: `frontend/src/components/dispatch/DispatchForm.jsx`
- Create: `frontend/src/lib/format.js`

**Interfaces:**
- Produces: `<DispatchForm value onChange onSubmit pending />`, a controlled component; `formatKg`, `formatMm`, `formatTonnes` in `lib/format.js`.

It should read as a warehouse ERP screen, not as VETO. `PRODUCT.md` F2: *the point is that VETO reaches the officer without a new interface.*

- [ ] **Step 1: Write the formatters.** The wire carries integer kg and mm. Display uses Indonesian separators — `24.500 kg`, `4.100 mm`. Never render a raw `24500`. Keep parsing and formatting in this one file so the payload always leaves as integers.

- [ ] **Step 2: Build the fields** — `dispatch_ref`, `axle_config` (select), `tare_weight_kg`, `gross_weight_kg`, one input per axle load, and length/width/height. The axle-load input count follows `axle_config`: `1.2` gives two, `1.22` gives three.

- [ ] **Step 3: Pre-fill sensible defaults.** `PRODUCT.md` §7: a booth visitor must run steps 1–3 unassisted in under a minute, changing **one number** to flip PASS to HOLD. Default to a compliant load with `gross_weight_kg` as the obvious thing to raise.

- [ ] **Step 4: Client-side validation** matching the backend — positive integers, axle count matching the config. Show the message inline on the field, before any request goes out.

- [ ] **Step 5: Verify** — the form renders, defaults are compliant, switching `axle_config` changes the axle input count, and bad input is caught before submitting.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes/Dispatch.jsx frontend/src/components/dispatch/ frontend/src/lib/
git commit -m "feat(dispatch): add the ERP dispatch form"
```

---

### Task F2: The verdict

**Files:**
- Create: `frontend/src/components/dispatch/Verdict.jsx`
- Create: `frontend/src/components/dispatch/ViolationList.jsx`

**Interfaces:**
- Consumes: the decision object from `validateDispatch`.

This is the moment the demo turns on. `PRODUCT.md` §7: *step 2 is the moment that lands.*

- [ ] **Step 1: Make PASS and HOLD unmistakable at 1.5 m.** Not a coloured badge — a state the whole panel enters. Someone watching over a shoulder should know the outcome before reading a word.

- [ ] **Step 2: Render each violation** with its `directive` verbatim — never compose directive text on the frontend — plus actual versus limit, and the `legal_citation` set as a legal reference.

- [ ] **Step 3: Show rule origin.** `CENTRAL` and `CLIENT` must be visually distinct. `PRODUCT.md` §4: a judge asking "who's responsible if a rule is wrong?" needs a visible answer.

- [ ] **Step 4: Make the request visible.** `PRODUCT.md` F2 requires the API call be legible as it happens, and `docs/ENGINEERING.md` §6 requires every visible async operation to have a visible state. Show the round trip and the returned `latency_ms`. Sub-300 ms is a claim worth showing rather than stating.

- [ ] **Step 5: Handle failure cleanly.** A caught `ApiError` renders as a plain Indonesian message. Never a stack trace, never a raw code, in front of judges.

- [ ] **Step 6: Watch the copy.** Nothing may imply VETO guarantees compliance. It validates *declared* figures — say so somewhere honest and quiet.

- [ ] **Step 7: Verify** both outcomes on mocks, plus the error state (stop the mock delay and throw from `mocks.validate` temporarily).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/dispatch/
git commit -m "feat(dispatch): add PASS/HOLD verdict and violation list"
```

---

### Task F3: Correct and resubmit

**Files:**
- Modify: `frontend/src/routes/Dispatch.jsx`

This is the hero loop — HOLD → fix → PASS — and the thing a booth visitor actually does.

- [ ] **Step 1: Retain input after a HOLD.** `PRODUCT.md` F2 requires it. The officer corrects one number; they do not retype the form.

- [ ] **Step 2: Point at the offending field.** Each violation names a dimension; link it to the input that caused it. `PRODUCT.md` F2: the violation appears *in context with the field*.

- [ ] **Step 3: Make the transition mean something.** HOLD → PASS on resubmit is the emotional beat of the demo. Per `DESIGN.md`, this is one of the three things allowed to animate.

- [ ] **Step 4: Verify the full loop** on mocks: submit HOLD, see the directive, change one number, resubmit, get PASS. Time yourself — under a minute from a cold start, or the booth requirement is not met.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/Dispatch.jsx
git commit -m "feat(dispatch): retain input and support correct-and-resubmit"
```

---

### Task F4: Override

**Files:**
- Create: `frontend/src/components/dispatch/OverrideDialog.jsx`

**Interfaces:**
- Consumes: `overrideDecision` from `@/api`.

The escape hatch with accountability. It should feel weightier than the normal path — a deliberate act, not a dismissal.

- [ ] **Step 1: Require a reason,** minimum 10 characters, enforced before the request. The backend enforces it too.
- [ ] **Step 2: Capture `overridden_by`.**
- [ ] **Step 3: Say plainly that this is logged** and that the HOLD stands on the record. It appends, it does not erase.
- [ ] **Step 4: On success,** show the decision as held-but-overridden. Do not flip it to PASS — that would misrepresent the audit trail.
- [ ] **Step 5: Verify** on mocks, including the under-10-character rejection.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/dispatch/OverrideDialog.jsx
git commit -m "feat(dispatch): add logged override with required reason"
```

---

### Task F5: The audit log

**Files:**
- Modify: `frontend/src/routes/AuditLog.jsx`

**Interfaces:**
- Consumes: `listDecisions`, `getDecision` from `@/api`.

`PRODUCT.md` F4. One screen that answers "is this legally defensible?".

- [ ] **Step 1: The table** — timestamp, `dispatch_ref`, outcome, violation count, override flag, `latency_ms`. Mono, tabular figures, dense. This is a log, so let it look like one.
- [ ] **Step 2: Row expands to detail** via `getDecision` — full violations, rule pack versions, origins, citations, and the override reason if present.
- [ ] **Step 3: Filter** by outcome and date range.
- [ ] **Step 4: No edit or delete affordance anywhere.** Append-only should be visible in the interface, not just true in the database. Say it on screen.
- [ ] **Step 5: Empty state** that reads as a working system with nothing in it yet, not as a broken screen.
- [ ] **Step 6: Verify** on mocks, including the empty state.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/routes/AuditLog.jsx
git commit -m "feat(audit): add the append-only decision trail view"
```

---

### Task F6: Integration

Do this with Iqbal, together, after B6.

- [ ] **Step 1:** `VITE_USE_MOCKS=false`, restart Vite, Iqbal's backend on 8000 with `seed_rules` run.
- [ ] **Step 2:** Full loop against the real API — PASS, HOLD, correct, resubmit, override, then check the audit log shows all of it.
- [ ] **Step 3:** **Real thresholds will differ from the fixtures.** Update the defaults in `DispatchForm` so the pre-filled load is genuinely compliant against the seeded rules, and so raising one number genuinely trips a HOLD. Re-time the booth minute.
- [ ] **Step 4:** For every shape mismatch, decide which side is wrong *against `api-contract.md`*, not against whichever is easier to change. Fix fixture, backend, and mocks in one commit.
- [ ] **Step 5:** Set `VITE_USE_MOCKS=true` and confirm the mocked path still works. Both stay green — mocks are the demo fallback if the backend dies at the booth.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: wire dispatch and audit to the live API"
```

---

## Definition of done

- [ ] `uv run --directory backend python manage.py test apps` is green
- [ ] `grep -rn "genai\|llm\|gemini" backend/apps/validation/ --include=*.py` returns nothing
- [ ] `grep -rn "STUB" backend/apps/validation/` returns nothing
- [ ] Every seeded rule has `verification.status = VERIFIED`, a source URL, and an article-level citation
- [ ] p95 latency under 300 ms, measured, not assumed
- [ ] PASS and HOLD are distinguishable from 1.5 m away
- [ ] A HOLD names the violated dimension and the exact correction, and the form keeps its input
- [ ] Override requires a reason, is logged, and the decision still reads HOLD afterwards
- [ ] Audit log shows both decisions with rule versions and citations, and offers no way to edit or delete
- [ ] No fabricated statistic or citation anywhere on screen
- [ ] A stranger runs demo steps 1–3 unassisted in under a minute
- [ ] Demo steps 1–4 rehearsed end to end, twice

## Deferred

- Rule pack caching, unless B7 measures a failure.
- Road-class-aware validation. Limits vary by road class under PM 18/2021; routes are profile data only and are not used in validation. A known gap — do not let UI copy imply otherwise.
- Declared versus sensor-verified weight. VETO validates what is typed in. Weighbridge integration is a later phase.
- Vehicle profiles CRUD (`api-contract.md` §6) — P2, and cut unless everything above is done.
- No auth on any endpoint. Anyone who can reach the API can validate or override. Accepted per `docs/ENGINEERING.md` §4; do not describe the audit trail as access-controlled.

## Relationship to the Rule Studio plan

Precedence is implemented **here**, in B2, and is origin-agnostic — it compares thresholds without caring whether a rule came from VETO or a client. So when Rule Studio approves its first `CLIENT` rule, no engine change is needed.

That makes Rule Studio plan Task B7 a **verification task, not an implementation task**: keep its tests, drop its `strictest_rules_by_dimension` step, since B2 here already provides it. Demo step 7 then works the moment a client rule exists.
