import uuid
from django.db import transaction
from django.utils.dateparse import parse_datetime
from django.db.models import Count
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.rules.candidates import clean_name
from .models import DispatchDecision, Outcome

# These were plain Django views. Django's CSRF middleware applies to those, so
# the override POST from the frontend (another origin, no CSRF cookie) came back
# 403 in production while the test client, which skips CSRF, kept passing. As
# DRF views they share the API's parsing, error envelope and rate limits.

MIN_REASON_CHARS = 10
MAX_REASON_CHARS = 2000


def _not_found():
    return Response({"error": {"code": "NOT_FOUND", "message": "Decision not found"}}, status=status.HTTP_404_NOT_FOUND)


class DecisionListView(APIView):
    def get(self, request):
        queryset = DispatchDecision.objects.annotate(violation_count=Count('violations')).order_by('-evaluated_at')
        
        # Filtering
        outcome = request.GET.get('outcome')
        if outcome in ["PASS", "HOLD"]:
            queryset = queryset.filter(outcome=outcome)
            
        from_date = request.GET.get('from')
        if from_date:
            parsed_from = parse_datetime(from_date)
            if parsed_from:
                queryset = queryset.filter(evaluated_at__gte=parsed_from)
                
        to_date = request.GET.get('to')
        if to_date:
            parsed_to = parse_datetime(to_date)
            if parsed_to:
                queryset = queryset.filter(evaluated_at__lte=parsed_to)
                
        has_override = request.GET.get('has_override')
        if has_override is not None:
            if has_override.lower() == 'true':
                queryset = queryset.filter(override_reason__isnull=False)
            elif has_override.lower() == 'false':
                queryset = queryset.filter(override_reason__isnull=True)
                
        # Pagination
        try:
            limit = int(request.GET.get('limit', 50))
            if limit > 100:
                limit = 100
            elif limit < 1:
                limit = 50
        except ValueError:
            limit = 50
            
        try:
            offset = int(request.GET.get('offset', 0))
            if offset < 0:
                offset = 0
        except ValueError:
            offset = 0
            
        total = queryset.count()
        results = queryset[offset:offset+limit]
        
        data = []
        for d in results:
            override = None
            if d.override_reason:
                override = {
                    "reason": d.override_reason,
                    "overridden_by": d.overridden_by,
                    "created_at": d.override_created_at.isoformat() if d.override_created_at else None
                }
            
            data.append({
                "decision_id": str(d.decision_id),
                "dispatch_ref": d.dispatch_ref,
                "outcome": d.outcome,
                "violation_count": d.violation_count,
                "override": override,
                "latency_ms": d.latency_ms,
                "evaluated_at": d.evaluated_at.isoformat()
            })
            
        return Response({
            "results": data,
            "total": total,
            "limit": limit,
            "offset": offset
        })

class DecisionDetailView(APIView):
    def get(self, request, decision_id):
        try:
            d = DispatchDecision.objects.prefetch_related('violations').get(decision_id=decision_id)
        except DispatchDecision.DoesNotExist:
            return _not_found()
            
        override = None
        if d.override_reason:
            override = {
                "reason": d.override_reason,
                "overridden_by": d.overridden_by,
                "created_at": d.override_created_at.isoformat() if d.override_created_at else None
            }
            
        violations_data = []
        for v in d.violations.all():
            vd = {
                "dimension": v.dimension,
                "actual_value": v.actual_value,
                "limit_value": v.limit_value,
                "excess_value": v.excess_value,
                "unit": v.unit,
                "severity": v.severity,
                "rule_origin": v.rule_origin,
                "legal_citation": v.legal_citation,
                "directive": v.directive
            }
            if v.axle_index is not None:
                vd["axle_index"] = v.axle_index
            violations_data.append(vd)
            
        return Response({
            "decision_id": str(d.decision_id),
            "outcome": d.outcome,
            "dispatch_ref": d.dispatch_ref,
            "violations": violations_data,
            "rule_packs_applied": d.rule_packs_applied,
            "latency_ms": d.latency_ms,
            "evaluated_at": d.evaluated_at.isoformat(),
            "override": override,
            "payload": d.payload
        })

class DecisionOverrideView(APIView):
    throttle_scope = "write"

    def post(self, request, decision_id):
        body = request.data if isinstance(request.data, dict) else {}

        reason = body.get("reason")
        reason = reason.strip() if isinstance(reason, str) else ""
        if len(reason) < MIN_REASON_CHARS:
            return Response({"error": {"code": "VALIDATION_ERROR", "message": f"Reason must be at least {MIN_REASON_CHARS} characters long", "field": "reason"}}, status=status.HTTP_400_BAD_REQUEST)
        if len(reason) > MAX_REASON_CHARS:
            return Response({"error": {"code": "VALIDATION_ERROR", "message": f"Reason must be at most {MAX_REASON_CHARS} characters long", "field": "reason"}}, status=status.HTTP_400_BAD_REQUEST)

        overridden_by = clean_name(body.get("overridden_by"))

        with transaction.atomic():
            try:
                d = DispatchDecision.objects.select_for_update().get(decision_id=decision_id)
            except DispatchDecision.DoesNotExist:
                return _not_found()

            if d.outcome == Outcome.PASS:
                return Response({"error": {"code": "VALIDATION_ERROR", "message": "Cannot override a PASS decision"}}, status=status.HTTP_400_BAD_REQUEST)

            # An override is part of the audit trail, and the trail is
            # append-only. A second override used to overwrite the first, and
            # with it the only record of who released the truck and why.
            if d.override_id:
                return Response({"error": {"code": "CONFLICT", "message": "Decision has already been overridden"}}, status=status.HTTP_409_CONFLICT)

            d.override_id = uuid.uuid4()
            d.override_reason = reason
            d.overridden_by = overridden_by
            d.override_created_at = timezone.now()
            d.save(update_fields=["override_id", "override_reason", "overridden_by", "override_created_at"])

        return Response({
            "override_id": str(d.override_id),
            "decision_id": str(d.decision_id),
            "reason": d.override_reason,
            "overridden_by": d.overridden_by,
            "created_at": d.override_created_at.isoformat()
        }, status=status.HTTP_201_CREATED)
