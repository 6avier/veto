import json
import uuid
from django.test import TestCase, Client
from django.utils import timezone
from apps.audit.models import DispatchDecision, Outcome, Violation, ViolationSeverity

class AuditLogTests(TestCase):
    def setUp(self):
        self.client = Client()
        
        # Create a few decisions
        self.d1 = DispatchDecision.objects.create(
            outcome=Outcome.HOLD,
            dispatch_ref="DO-1",
            payload={"test": "payload1"},
            rule_packs_applied=[],
            latency_ms=10,
            evaluated_at=timezone.now()
        )
        Violation.objects.create(
            decision=self.d1,
            dimension="GROSS_WEIGHT",
            actual_value=25000,
            limit_value=24000,
            excess_value=1000,
            unit="kg",
            severity=ViolationSeverity.BLOCKING,
            rule_origin="CLIENT",
            legal_citation="SOP 1",
            directive="Reduce weight"
        )
        
        self.d2 = DispatchDecision.objects.create(
            outcome=Outcome.PASS,
            dispatch_ref="DO-2",
            payload={"test": "payload2"},
            rule_packs_applied=[],
            latency_ms=15,
            evaluated_at=timezone.now()
        )
        
        self.d3 = DispatchDecision.objects.create(
            outcome=Outcome.HOLD,
            dispatch_ref="DO-3",
            payload={"test": "payload3"},
            rule_packs_applied=[],
            latency_ms=20,
            evaluated_at=timezone.now(),
            override_id=uuid.uuid4(),
            override_reason="Manually checked",
            overridden_by="Supervisor A",
            override_created_at=timezone.now()
        )
        
    def test_list_decisions(self):
        res = self.client.get("/api/v1/decisions")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total"], 3)
        self.assertEqual(len(data["results"]), 3)
        
    def test_list_decisions_filter_outcome(self):
        res = self.client.get("/api/v1/decisions?outcome=HOLD")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total"], 2)
        
    def test_list_decisions_filter_has_override(self):
        res = self.client.get("/api/v1/decisions?has_override=true")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["results"][0]["dispatch_ref"], "DO-3")
        
    def test_decision_detail(self):
        res = self.client.get(f"/api/v1/decisions/{self.d1.decision_id}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["dispatch_ref"], "DO-1")
        self.assertEqual(len(data["violations"]), 1)
        self.assertEqual(data["violations"][0]["dimension"], "GROSS_WEIGHT")
        self.assertEqual(data["payload"]["test"], "payload1")
        
    def test_decision_detail_404(self):
        res = self.client.get(f"/api/v1/decisions/{uuid.uuid4()}")
        self.assertEqual(res.status_code, 404)
        
    def test_override_decision(self):
        res = self.client.post(f"/api/v1/decisions/{self.d1.decision_id}/override", 
            json.dumps({
                "reason": "This is a valid reason because it is long enough",
                "overridden_by": "Operator B"
            }), content_type="application/json")
            
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["reason"], "This is a valid reason because it is long enough")
        
        self.d1.refresh_from_db()
        self.assertEqual(self.d1.override_reason, "This is a valid reason because it is long enough")
        
    def test_override_pass_fails(self):
        res = self.client.post(f"/api/v1/decisions/{self.d2.decision_id}/override", 
            json.dumps({
                "reason": "This is a valid reason because it is long enough",
                "overridden_by": "Operator B"
            }), content_type="application/json")
            
        self.assertEqual(res.status_code, 400)
        
    def test_override_short_reason_fails(self):
        res = self.client.post(f"/api/v1/decisions/{self.d1.decision_id}/override", 
            json.dumps({
                "reason": "Short",
                "overridden_by": "Operator B"
            }), content_type="application/json")
            
        self.assertEqual(res.status_code, 400)
