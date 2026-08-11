"""POST /api/v1/validate — api-contract.md §1.

STUB. Shapes are contract-exact and safe to build the frontend against, but the
thresholds below are hardcoded rather than read from a seeded rule pack, and no
decision is persisted yet.

Replacing this is the backend lane's first real task:
  1. Seed the central ODOL rule pack (origin=CENTRAL) from verified regulation text
  2. Move evaluation into apps/validation/engine.py as a pure function
  3. Write the DispatchDecision audit record before returning
  4. Delete STUB_LIMITS and this docstring

The response shape must not change when that happens. If it has to, update
api-contract.md and tell the frontend lane before touching code.
"""

import time
import uuid
from datetime import datetime, timezone

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

# TODO(backend): delete once the seeded rule pack lands. Values mirror the
# worked example in api-contract.md §1 so the fixtures and the stub agree.
STUB_LIMITS = {
    "gross_weight_kg": {
        "central": 25000,
        "client": 24000,
        "central_citation": "PM 111/2015 Pasal 4 ayat (2)",
        "client_citation": "SOP Internal Gudang Cikarang v2 §3.1",
    },
    "axle_load_kg": {
        "central": [10000, 16100],
        "central_citation": "PM 111/2015 Pasal 4 ayat (2)",
    },
    # Road class I figures. TODO: verify against the regulation text before these
    # become seed data — see CLAUDE.md §5, "never hardcode an unverified threshold".
    "dimensions_mm": {
        "length": 18000,
        "width": 2500,
        "height": 4200,
        "citation": "PM 111/2015 Pasal 5",
    },
}

DIMENSION_BY_AXIS = {
    "length": "DIMENSION_LENGTH",
    "width": "DIMENSION_WIDTH",
    "height": "DIMENSION_HEIGHT",
}

RULE_PACKS = [
    {"id": "c0a80101-0000-4000-8000-000000000001", "domain": "ODOL", "version": 3, "origin": "CENTRAL"},
    {"id": "c0a80101-0000-4000-8000-000000000002", "domain": "ODOL", "version": 1, "origin": "CLIENT"},
]


def _error(message, field=None, code="VALIDATION_ERROR", http_status=status.HTTP_400_BAD_REQUEST):
    error = {"code": code, "message": message}
    if field:
        error["field"] = field
    return Response({"error": error}, status=http_status)


def _now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _check_gross_weight(gross):
    """Client policy is stricter than the legal limit, so it is the one enforced.

    Per api-contract.md §1, only the stricter rule appears, and the directive
    names the legal limit for contrast.
    """
    limits = STUB_LIMITS["gross_weight_kg"]
    if gross <= limits["client"]:
        return None
    excess = gross - limits["client"]
    return {
        "dimension": "GROSS_WEIGHT",
        "actual_value": gross,
        "limit_value": limits["client"],
        "excess_value": excess,
        "unit": "kg",
        "severity": "BLOCKING",
        "rule_origin": "CLIENT",
        "legal_citation": limits["client_citation"],
        "directive": (
            f"Reduce total load by {excess:,} kg — client policy is stricter "
            f"than the legal limit of {limits['central']:,} kg"
        ),
    }


def _check_axle_loads(axle_loads):
    limits = STUB_LIMITS["axle_load_kg"]["central"]
    citation = STUB_LIMITS["axle_load_kg"]["central_citation"]
    violations = []
    for index, load in enumerate(axle_loads):
        limit = limits[index] if index < len(limits) else limits[-1]
        if load <= limit:
            continue
        excess = load - limit
        position = "rear axle" if index == len(axle_loads) - 1 else f"axle {index + 1}"
        violations.append(
            {
                "dimension": "AXLE_LOAD",
                "axle_index": index,
                "actual_value": load,
                "limit_value": limit,
                "excess_value": excess,
                "unit": "kg",
                "severity": "BLOCKING",
                "rule_origin": "CENTRAL",
                "legal_citation": citation,
                "directive": f"Reduce {position} load by {excess:,} kg",
            }
        )
    return violations


def _check_dimensions(dimensions):
    limits = STUB_LIMITS["dimensions_mm"]
    violations = []
    for axis, dimension_enum in DIMENSION_BY_AXIS.items():
        actual = dimensions.get(axis)
        if actual is None or actual <= limits[axis]:
            continue
        excess = actual - limits[axis]
        violations.append(
            {
                "dimension": dimension_enum,
                "actual_value": actual,
                "limit_value": limits[axis],
                "excess_value": excess,
                "unit": "mm",
                "severity": "BLOCKING",
                "rule_origin": "CENTRAL",
                "legal_citation": limits["citation"],
                "directive": f"Reduce load {axis} by {excess:,} mm",
            }
        )
    return violations


@api_view(["POST"])
def validate(request):
    started = time.perf_counter()
    payload = request.data

    if not isinstance(payload, dict):
        return _error("Request body must be a JSON object")

    dispatch_ref = payload.get("dispatch_ref")
    if not dispatch_ref:
        return _error("dispatch_ref is required", field="dispatch_ref")

    load = payload.get("load")
    if not isinstance(load, dict):
        return _error("load is required", field="load")

    gross = load.get("gross_weight_kg")
    if not isinstance(gross, int) or isinstance(gross, bool) or gross <= 0:
        return _error("gross_weight_kg must be a positive integer in kilograms", field="gross_weight_kg")

    axle_loads = load.get("axle_loads_kg")
    if not isinstance(axle_loads, list) or not axle_loads:
        return _error("axle_loads_kg must contain at least one entry", field="axle_loads_kg")
    if not all(isinstance(a, int) and not isinstance(a, bool) and a >= 0 for a in axle_loads):
        return _error("axle_loads_kg must contain integers in kilograms", field="axle_loads_kg")

    dimensions = load.get("dimensions_mm") or {}
    if not isinstance(dimensions, dict):
        return _error("dimensions_mm must be an object", field="dimensions_mm")

    violations = []
    gross_violation = _check_gross_weight(gross)
    if gross_violation:
        violations.append(gross_violation)
    violations.extend(_check_axle_loads(axle_loads))
    violations.extend(_check_dimensions(dimensions))

    outcome = "HOLD" if violations else "PASS"
    packs = RULE_PACKS if outcome == "HOLD" else RULE_PACKS[:1]

    body = {
        "decision_id": str(uuid.uuid4()),
        "outcome": outcome,
        "dispatch_ref": dispatch_ref,
        "violations": violations,
        "rule_packs_applied": packs,
        "latency_ms": max(1, round((time.perf_counter() - started) * 1000)),
        "evaluated_at": _now_iso(),
    }

    if outcome == "HOLD":
        # A HOLD is a successful evaluation. The flag keeps the error-envelope
        # handler in config/exceptions.py from rewriting this body.
        request._veto_is_hold = True
        return Response(body, status=status.HTTP_403_FORBIDDEN)
    return Response(body, status=status.HTTP_200_OK)
