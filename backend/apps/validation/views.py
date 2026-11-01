import time

from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response

from config.throttling import (
    DispatchRateThrottle,
    VisionAlprRateThrottle,
    VisionDetectRateThrottle,
    client_ident,
)

from .engine import axle_sum_mismatch, evaluate_payload, has_gross_rule, _format_number
from .fleet_registry import get_fleet_registry, lookup_or_match_fleet
from .vision import (
    VisionServiceError,
    detect_alpr_and_fleet,
    detect_overdimension,
    sanitize_body_type,
    sanitize_plate,
    validate_image_base64,
)
from apps.rules.models import Rule, RuleStatus
from apps.audit.models import DispatchDecision, Violation

# DispatchDecision.dispatch_ref is a CharField(100). Postgres raises on a longer
# value, which surfaced as a 500 instead of a validation error.
MAX_DISPATCH_REF_LENGTH = 100
# The longest configuration in the seed has six axles. The ceiling is generous
# and only exists so a request cannot ask the engine to walk a huge list.
MAX_AXLES = 12
# Well past any road vehicle, low enough that nothing overflows an IntegerField.
MAX_KG = 1_000_000
MAX_MM = 100_000


def _error(message, field=None, code="VALIDATION_ERROR", http_status=status.HTTP_400_BAD_REQUEST):
    error = {"code": code, "message": message}
    if field:
        error["field"] = field
    return Response({"error": error}, status=http_status)


def _is_int(value, minimum, maximum):
    return isinstance(value, int) and not isinstance(value, bool) and minimum <= value <= maximum


@api_view(["POST"])
@throttle_classes([DispatchRateThrottle])
def validate(request):
    started = time.perf_counter()
    payload = request.data

    if not isinstance(payload, dict):
        return _error("Request body must be a JSON object")

    # Every field the engine touches is type-checked here. A string where a
    # number belonged used to reach a comparison in the engine and come back as
    # a 500, which is the one thing a booth visitor must never see.
    dispatch_ref = payload.get("dispatch_ref")
    if not isinstance(dispatch_ref, str) or not dispatch_ref.strip():
        return _error("dispatch_ref is required", field="dispatch_ref")
    if len(dispatch_ref) > MAX_DISPATCH_REF_LENGTH:
        return _error(
            f"dispatch_ref must be at most {MAX_DISPATCH_REF_LENGTH} characters",
            field="dispatch_ref",
        )

    vehicle = payload.get("vehicle")
    if vehicle is None:
        vehicle = {}
    if not isinstance(vehicle, dict):
        return _error("vehicle must be an object", field="vehicle")

    load = payload.get("load")
    if not isinstance(load, dict):
        return _error("load is required", field="load")

    gross = load.get("gross_weight_kg")
    if not _is_int(gross, 1, MAX_KG):
        return _error("gross_weight_kg must be a positive integer in kilograms", field="gross_weight_kg")

    axle_config = vehicle.get("axle_config")
    if not isinstance(axle_config, str) or not axle_config.strip():
        return _error("axle_config is required and must be a string such as \"1.2.2\"", field="axle_config")

    axle_loads = load.get("axle_loads_kg")
    if not isinstance(axle_loads, list) or not axle_loads:
        return _error("axle_loads_kg must contain at least one entry", field="axle_loads_kg")
    if len(axle_loads) > MAX_AXLES:
        return _error(f"axle_loads_kg must have at most {MAX_AXLES} entries", field="axle_loads_kg")
    if not all(_is_int(a, 0, MAX_KG) for a in axle_loads):
        return _error("axle_loads_kg must contain integers in kilograms", field="axle_loads_kg")

    # Count the axles in the config: '1.2.2' -> 3, '1.2-2.2' -> 4.
    expected_axles = sum(1 for char in axle_config if char.isdigit())
    if expected_axles > 0 and len(axle_loads) != expected_axles:
        return _error(f"axle_loads_kg length ({len(axle_loads)}) does not match expected axles ({expected_axles}) for config {axle_config}", field="axle_loads_kg")

    dimensions = load.get("dimensions_mm") or {}
    if not isinstance(dimensions, dict):
        return _error("dimensions_mm must be an object", field="dimensions_mm")
    for key in ("length", "width", "height"):
        value = dimensions.get(key)
        if value is not None and not _is_int(value, 0, MAX_MM):
            return _error(f"dimensions_mm.{key} must be a non-negative integer in millimetres", field="dimensions_mm")

    gap = axle_sum_mismatch(load)
    if gap is not None:
        return _error(
            f"Total beban sumbu ({_format_number(sum(axle_loads))} kg) tidak sesuai dengan "
            f"berat kotor ({_format_number(gross)} kg). Selisih {_format_number(gap)} kg. "
            "Perbaiki data masukan.",
            field="gross_weight_kg",
        )

    # Fetch active rules
    active_rules = list(Rule.objects.filter(status=RuleStatus.ACTIVE).select_related('rule_pack'))

    if not has_gross_rule(active_rules, axle_config):
        return _error(
            f"Konfigurasi sumbu {axle_config} belum punya batas berat kotor di rule base aktif.",
            field="axle_config",
        )

    # Evaluate using the pure engine
    outcome, violations = evaluate_payload(payload, active_rules)

    latency_ms = max(1, round((time.perf_counter() - started) * 1000))

    # Every pack that contributed an active rule, in a stable order so the same
    # request always records the same list.
    packs = {r.rule_pack.id: r.rule_pack for r in active_rules}.values()
    packs_data = [
        {
            "id": str(pack.id),
            "domain": pack.domain,
            "version": pack.version,
            "origin": pack.origin,
        }
        for pack in sorted(packs, key=lambda p: (p.origin, p.domain, str(p.id)))
    ]

    # The decision and its violations are one audit record. Written apart, a
    # failure between the two left a HOLD in the log with no reasons attached.
    with transaction.atomic():
        decision = DispatchDecision.objects.create(
            outcome=outcome,
            dispatch_ref=dispatch_ref,
            payload=payload,
            rule_packs_applied=packs_data,
            latency_ms=latency_ms,
        )
        Violation.objects.bulk_create([
            Violation(
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
                directive=v["directive"],
            )
            for v in violations
        ])

    body = {
        "decision_id": str(decision.decision_id),
        "outcome": outcome,
        "dispatch_ref": dispatch_ref,
        "violations": violations,
        "rule_packs_applied": packs_data,
        "latency_ms": latency_ms,
        # evaluated_at is auto_now_add, so the stored value is the one that
        # counts. The response used to carry a second timestamp taken a moment
        # earlier, and the audit log disagreed with it.
        "evaluated_at": decision.evaluated_at.astimezone().isoformat(timespec="seconds"),
    }

    if outcome == "HOLD":
        # A HOLD is a successful evaluation. The flag keeps the error-envelope
        # handler in config/exceptions.py from rewriting this body.
        request._veto_is_hold = True
        return Response(body, status=status.HTTP_403_FORBIDDEN)
    return Response(body, status=status.HTTP_200_OK)


@api_view(["POST"])
@throttle_classes([VisionDetectRateThrottle])
def vision_detect(request):
    """Server-side proxy for VETO Vision over-dimension + integrated ALPR & Fleet lookup."""
    payload = request.data if isinstance(request.data, dict) else {}
    raw_b64 = payload.get("image_base64")

    try:
        clean_b64, mime_type = validate_image_base64(raw_b64)
        predictions = detect_overdimension(clean_b64)
    except VisionServiceError as exc:
        return _error(
            exc.message,
            field=exc.field,
            code=exc.code,
            http_status=exc.http_status,
        )

    response_body = {"predictions": predictions}
    if payload.get("include_alpr", False):
        alpr_bundle = detect_alpr_and_fleet(
            clean_b64,
            mime_type=mime_type,
            session_owner=client_ident(request),
        )
        response_body["alpr"] = alpr_bundle["alpr"]
        response_body["fleet_match"] = alpr_bundle["fleet_match"]

    return Response(response_body, status=status.HTTP_200_OK)


@api_view(["POST"])
@throttle_classes([VisionAlprRateThrottle])
def vision_alpr(request):
    """Dedicated ALPR license plate recognition & Master Armada cross-check endpoint."""
    payload = request.data if isinstance(request.data, dict) else {}
    raw_b64 = payload.get("image_base64")

    try:
        clean_b64, mime_type = validate_image_base64(raw_b64)
        alpr_bundle = detect_alpr_and_fleet(
            clean_b64,
            mime_type=mime_type,
        )
    except VisionServiceError as exc:
        return _error(
            exc.message,
            field=exc.field,
            code=exc.code,
            http_status=exc.http_status,
        )

    return Response(alpr_bundle, status=status.HTTP_200_OK)


@api_view(["GET"])
def vision_fleet_registry(request):
    """Return Master Armada vehicles or verify a specific plate + body type combination."""
    plate_query = request.GET.get("plate")
    body_query = request.GET.get("body_type")
    if plate_query or body_query:
        sanitized_plate = sanitize_plate(plate_query) if plate_query else None
        sanitized_body = sanitize_body_type(body_query) if body_query else None
        match = lookup_or_match_fleet(
            detected_plate=sanitized_plate,
            detected_body_type=sanitized_body,
        )
        return Response({"fleet_match": match}, status=status.HTTP_200_OK)

    registry = get_fleet_registry()
    return Response(
        {"results": registry, "total": len(registry)},
        status=status.HTTP_200_OK,
    )
