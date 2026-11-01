"""Regressions for the Rule Studio review fixes."""

import io
import json
from unittest.mock import MagicMock, patch

from django.test import Client, TestCase

from apps.rules.models import Rule, RuleCandidate, RulePack


def _pdf(name, text="SOP muatan"):
    import fitz
    doc = fitz.open()
    doc.new_page().insert_text((50, 50), text)
    data = doc.write()
    doc.close()
    handle = io.BytesIO(data)
    handle.name = name
    return handle


class RuleStudioFixTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.patcher = patch("apps.rules.views.openai.OpenAI")
        mock_class = self.patcher.start()
        self.settings_patcher = self.settings(OPENAI_API_KEY="fake-key")
        self.settings_patcher.enable()
        self.mock_client = MagicMock()
        mock_class.return_value = self.mock_client
        self.answer([])

    def tearDown(self):
        self.patcher.stop()
        self.settings_patcher.disable()

    def answer(self, content):
        response = MagicMock()
        response.choices = [MagicMock()]
        response.choices[0].message.content = json.dumps(content)
        self.mock_client.chat.completions.create.return_value = response

    def upload(self):
        return self.client.post("/api/v1/documents", {"file": _pdf("SOP.pdf")}).json()["document_id"]

    def extract(self, doc_id):
        return self.client.post(f"/api/v1/documents/{doc_id}/extract")

    def approve(self, candidate_id):
        return self.client.post(
            f"/api/v1/rule-candidates/{candidate_id}/approve",
            json.dumps({"reviewed_by": "Legal"}),
            content_type="application/json",
        )

    def test_wrapped_or_malformed_model_output_does_not_500(self):
        self.answer({"rules": [
            {"dimension": "GROSS_WEIGHT", "operator": "LTE", "threshold": 22000, "unit": "kg"},
            {"dimension": "NONSENSE", "operator": "LTE", "threshold": 1, "unit": "kg"},
            "garbage",
        ]})
        res = self.extract(self.upload())
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()["candidates"]), 1)

    def test_re_extracting_replaces_pending_candidates(self):
        self.answer([{"dimension": "GROSS_WEIGHT", "operator": "LTE", "threshold": 22000, "unit": "kg"}])
        doc_id = self.upload()
        self.extract(doc_id)
        self.extract(doc_id)
        self.assertEqual(RuleCandidate.objects.filter(document_id=doc_id).count(), 1)

    def test_unmapped_vehicle_class_cannot_become_a_universal_rule(self):
        self.answer([{
            "dimension": "GROSS_WEIGHT", "operator": "LTE", "threshold": 3500, "unit": "kg",
            "applies_to": {"vehicle_class": "Pickup"},
        }])
        candidate_id = self.extract(self.upload()).json()["candidates"][0]["candidate_id"]
        self.assertEqual(self.approve(candidate_id).status_code, 409)
        self.assertFalse(Rule.objects.filter(rule_pack__origin="CLIENT").exists())

    def test_approval_twice_makes_one_rule_and_each_approval_bumps_the_pack(self):
        self.answer([
            {"dimension": "GROSS_WEIGHT", "operator": "LTE", "threshold": 22000, "unit": "kg"},
            {"dimension": "AXLE_LOAD", "operator": "LTE", "threshold": 8000, "unit": "kg",
             "applies_to": {"vehicle_class": "Tronton"}},
        ])
        first, second = [c["candidate_id"] for c in self.extract(self.upload()).json()["candidates"]]
        self.assertEqual(self.approve(first).json()["rule_pack_version"], 1)
        self.assertEqual(self.approve(first).status_code, 409)
        res = self.approve(second)
        self.assertEqual(res.json()["rule_pack_version"], 2)
        self.assertEqual(Rule.objects.get(id=res.json()["rule_id"]).axle_config, ["1.2.2"])
        self.assertEqual(RulePack.objects.filter(origin="CLIENT").count(), 1)

    def test_unreadable_pdf_is_a_400(self):
        bad = io.BytesIO(b"not a pdf at all")
        bad.name = "fake.pdf"
        res = self.client.post("/api/v1/documents", {"file": bad})
        self.assertEqual(res.status_code, 400)
