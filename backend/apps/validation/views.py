import time
import uuid
from datetime import datetime, timezone

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .engine import evaluate_payload
from apps.rules.models import Rule, RuleStatus
from apps.audit.models import DispatchDecision, Violation

def _error(message, field=None, code="VALIDATION_ERROR", http_status=status.HTTP_400_BAD_REQUEST):
    error = {"code": code, "message": message}
    if field:
        error["field"] = field
    return Response({"error": error}, status=http_status)


def _now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


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

    # Fetch active rules
    active_rules = list(Rule.objects.filter(status=RuleStatus.ACTIVE).select_related('rule_pack'))
    
    # Evaluate using the pure engine
    outcome, violations = evaluate_payload(payload, active_rules)

    latency_ms = max(1, round((time.perf_counter() - started) * 1000))
    evaluated_at_dt = datetime.now(timezone.utc)

    # Determine which rule packs were applied
    applied_pack_ids = set()
    for r in active_rules:
        applied_pack_ids.add(r.rule_pack)
        
    packs_data = []
    for pack in applied_pack_ids:
        packs_data.append({
            "id": str(pack.id),
            "domain": pack.domain,
            "version": pack.version,
            "origin": pack.origin,
        })
        
    # In api contract, if outcome is PASS, the example shows only CENTRAL is returned, 
    # but the contract text says "rule_packs_applied: [ {id...} ]". 
    # Let's just return all applied packs. The STUB returned only CENTRAL if PASS.
    # The requirement: "packs = RULE_PACKS if outcome == "HOLD" else RULE_PACKS[:1]" was a stub behavior.
    
    decision = DispatchDecision.objects.create(
        outcome=outcome,
        dispatch_ref=dispatch_ref,
        payload=payload,
        rule_packs_applied=packs_data,
        latency_ms=latency_ms,
        evaluated_at=evaluated_at_dt
    )

    violation_records = []
    for v in violations:
        violation_records.append(Violation(
            decision=decision,
            dimension=v["dimension"],
            axle_index=v.get("axle_index"),
            actual_value=v["actual_value"],
            limit_value=v["limit_value"],
            excess_value=v["excess_value"],
            unit=v["unit"],
            severity=v["severity"],
            rule_origin=v["rule_origin"],
            legal_citation=v["legal_citation"],
            directive=v["directive"]
        ))
    if violation_records:
        Violation.objects.bulk_create(violation_records)

    body = {
        "decision_id": str(decision.decision_id),
        "outcome": outcome,
        "dispatch_ref": dispatch_ref,
        "violations": violations,
        "rule_packs_applied": packs_data,
        "latency_ms": latency_ms,
        "evaluated_at": evaluated_at_dt.astimezone().isoformat(timespec="seconds"),
    }

    if outcome == "HOLD":
        # A HOLD is a successful evaluation. The flag keeps the error-envelope
        # handler in config/exceptions.py from rewriting this body.
        request._veto_is_hold = True
        return Response(body, status=status.HTTP_403_FORBIDDEN)
    return Response(body, status=status.HTTP_200_OK)
