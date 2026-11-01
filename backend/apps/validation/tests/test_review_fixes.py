"""Regressions for the backend review fixes. Each test names the failure it pins."""

import json

from django.test import Client, TestCase

from apps.audit.models import DispatchDecision
from apps.rules.candidates import sanitize_candidate
from apps.rules.models import Rule, RulePack


def payload(axle_config="1.2.2", gross=20000, axles=(6000, 7000, 7000), dims=None, **extra):
    body = {
        "dispatch_ref": "DO-TEST",
        "vehicle": {"axle_config": axle_config},
        "load": {
            "gross_weight_kg": gross,
            "axle_loads_kg": list(axles),
            "dimensions_mm": dims or {"length": 9000, "width": 2400, "height": 3800},
        },
    }
    body.update(extra)
    return body


class ValidateInputTests(TestCase):
    def setUp(self):
        self.client = Client()

    def post(self, body):
        return self.client.post("/api/v1/validate", data=json.dumps(body), content_type="application/json")

    def test_malformed_fields_are_400_not_500(self):
        cases = [
            {**payload(), "vehicle": "abc"},
            {**payload(), "vehicle": {"axle_config": 122}},
            payload(dims={"height": "4500"}),
            {**payload(), "dispatch_ref": "x" * 101},
            {**payload(), "dispatch_ref": {"a": 1}},
        ]
        for body in cases:
            self.assertEqual(self.post(body).status_code, 400, body)

    def test_missing_axle_config_is_refused_instead_of_skipping_gross(self):
        body = payload()
        del body["vehicle"]
        self.assertEqual(self.post(body).status_code, 400)

    def test_unknown_axle_config_is_refused(self):
        res = self.post(payload(axle_config="1.22", gross=40000, axles=(13000, 13000, 14000)))
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["error"]["field"], "axle_config")

    def test_axle_sum_mismatch_is_a_validation_error_not_a_cited_violation(self):
        res = self.post(payload(gross=30000))
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["error"]["field"], "gross_weight_kg")
        self.assertEqual(DispatchDecision.objects.count(), 0)

    def test_single_rear_axle_on_1_2_is_not_held_to_the_tandem_limit(self):
        res = self.post(payload(axle_config="1.2", gross=16000, axles=(1000, 15000)))
        self.assertEqual(res.status_code, 403)
        axle = next(v for v in res.json()["violations"] if v["dimension"] == "AXLE_LOAD")
        self.assertEqual(axle["limit_value"], 10000)


class SuggestionTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_shift_goes_to_the_axle_with_room_for_it(self):
        res = self.client.post(
            "/api/v1/validate",
            data=json.dumps(payload(gross=23500, axles=(9800, 3000, 10700))),
            content_type="application/json",
        )
        directive = res.json()["violations"][0]["directive"]
        self.assertIn("700 kg ke sumbu tengah", directive)
        self.assertNotIn("sumbu depan", directive)

    def test_gross_reduction_takes_the_overloaded_axle_first_and_adds_up(self):
        res = self.client.post(
            "/api/v1/validate",
            data=json.dumps(payload(gross=24500, axles=(7200, 6000, 11300))),
            content_type="application/json",
        )
        gross = next(v for v in res.json()["violations"] if v["dimension"] == "GROSS_WEIGHT")
        # The rear axle is 1,300 over, which also covers the 500 kg gross excess.
        self.assertIn("1.300 kg dari sumbu belakang", gross["directive"])
        self.assertNotIn("sumbu depan", gross["directive"])


class ClientRuleTests(TestCase):
    def test_rule_with_list_axle_config_is_enforced(self):
        pack = RulePack.objects.create(domain="ODOL", origin="CLIENT", version=1)
        Rule.objects.create(
            rule_pack=pack, dimension="GROSS_WEIGHT", operator="LTE", threshold=20000,
            unit="kg", axle_config=["1.2.2"], legal_citation="SOP.pdf",
        )
        res = Client().post(
            "/api/v1/validate",
            data=json.dumps(payload(gross=22000, axles=(6000, 8000, 8000))),
            content_type="application/json",
        )
        self.assertEqual(res.json()["outcome"], "HOLD")
        self.assertEqual(res.json()["violations"][0]["rule_origin"], "CLIENT")


class OverrideTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        res = self.client.post(
            "/api/v1/validate",
            data=json.dumps(payload(gross=24500, axles=(7200, 6000, 11300))),
            content_type="application/json",
        )
        self.decision_id = res.json()["decision_id"]

    def override(self, reason="Pengiriman darurat untuk rumah sakit"):
        return self.client.post(
            f"/api/v1/decisions/{self.decision_id}/override",
            data=json.dumps({"reason": reason, "overridden_by": "Supervisor"}),
            content_type="application/json",
        )

    def test_override_works_without_a_csrf_token(self):
        self.assertEqual(self.override().status_code, 201)

    def test_override_cannot_be_rewritten(self):
        self.override()
        self.assertEqual(self.override("Alasan yang berbeda sama sekali").status_code, 409)

    def test_whitespace_reason_is_rejected(self):
        self.assertEqual(self.override(" " * 12).status_code, 400)


class CandidateSanitizingTests(TestCase):
    def test_units_are_converted_and_unknown_dimensions_dropped(self):
        self.assertEqual(
            sanitize_candidate({"dimension": "DIMENSION_LENGTH", "operator": "LTE", "threshold": 12.0, "unit": "m"}, 5)["threshold"],
            12000,
        )
        self.assertIsNone(sanitize_candidate({"dimension": "AXLE_CONFIG", "operator": "EQ", "threshold": 3, "unit": "kg"}, 5))
        self.assertIsNone(sanitize_candidate({"dimension": "GROSS_WEIGHT", "operator": "LTE", "threshold": "24 ton", "unit": "kg"}, 5))
        self.assertIsNone(sanitize_candidate("not a dict", 5))

    def test_vehicle_class_maps_to_axle_config_when_unambiguous(self):
        tronton = sanitize_candidate(
            {"dimension": "AXLE_LOAD", "operator": "LTE", "threshold": 8000, "unit": "kg", "applies_to": {"vehicle_class": "Tronton"}}, 5
        )
        self.assertEqual(tronton["applies_to"]["axle_config"], ["1.2.2"])
        pickup = sanitize_candidate(
            {"dimension": "GROSS_WEIGHT", "operator": "LTE", "threshold": 3500, "unit": "kg", "applies_to": {"vehicle_class": "Pickup"}}, 5
        )
        self.assertNotIn("axle_config", pickup["applies_to"])
