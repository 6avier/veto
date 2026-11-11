import json
import io
from unittest.mock import patch, MagicMock
from django.test import TestCase, Client
from apps.rules.models import Document, DocumentClassification, RuleCandidate, CandidateStatus, Rule, RulePack

class RuleStudioTests(TestCase):
    def setUp(self):
        self.client = Client()
        
        # Inject fake OpenAI client to bypass API calls and quota
        self.patcher = patch('apps.rules.views.openai.OpenAI')
        self.mock_client_class = self.patcher.start()
        
        self.settings_patcher = self.settings(OPENAI_API_KEY='fake-key')
        self.settings_patcher.enable()
        
        self.mock_client = MagicMock()
        self.mock_client_class.return_value = self.mock_client
        
        self.mock_response = MagicMock()
        self.mock_response.choices = [MagicMock()]
        self.mock_response.choices[0].message.content = json.dumps([{
            "dimension": "GROSS_WEIGHT",
            "operator": "LTE",
            "threshold": 25000,
            "unit": "kg",
            "applies_to": None,
            "source_text_excerpt": "Maksimal muatan 25 ton",
            "source_page": 1,
            "tags": ["openai-extracted"]
        }])
        self.mock_client.chat.completions.create.return_value = self.mock_response

    def tearDown(self):
        self.patcher.stop()
        self.settings_patcher.disable()

    def _create_mock_pdf(self, name, text="SOP"):
        import fitz
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((50, 50), text)
        pdf_bytes = doc.write()
        doc.close()
        file_obj = io.BytesIO(pdf_bytes)
        file_obj.name = name
        return file_obj
        
    def test_upload_document_success(self):
        file_obj = self._create_mock_pdf("SOP-Gudang.pdf", "SOP maksimal muatan 25 ton")
        
        res = self.client.post("/api/v1/documents", {"file": file_obj})
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["classification"], DocumentClassification.INTERNAL_POLICY)
        self.assertTrue(data["accepted"])
        
    def test_upload_document_rejected(self):
        file_obj = self._create_mock_pdf("invoice-123.pdf", "Invoice")
        
        res = self.client.post("/api/v1/documents", {"file": file_obj})
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["classification"], DocumentClassification.OPERATIONAL_DOC)
        self.assertFalse(data["accepted"])
        
    def test_extract_document(self):
        file_obj = self._create_mock_pdf("SOP-Gudang.pdf", "SOP maksimal muatan 25 ton")
        upload_res = self.client.post("/api/v1/documents", {"file": file_obj})
        doc_id = upload_res.json()["document_id"]
        
        # Then extract
        res = self.client.post(f"/api/v1/documents/{doc_id}/extract")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data["candidates"]), 1)
        self.assertEqual(data["candidates"][0]["dimension"], "GROSS_WEIGHT")
        
    def test_extract_rejected_document_fails(self):
        file_obj = self._create_mock_pdf("invoice.pdf", "Invoice")
        upload_res = self.client.post("/api/v1/documents", {"file": file_obj})
        doc_id = upload_res.json()["document_id"]
        
        # Then extract
        res = self.client.post(f"/api/v1/documents/{doc_id}/extract")
        self.assertEqual(res.status_code, 409)
        
    def test_extract_rejected_document_force(self):
        file_obj = self._create_mock_pdf("invoice.pdf", "Invoice")
        upload_res = self.client.post("/api/v1/documents", {"file": file_obj})
        doc_id = upload_res.json()["document_id"]
        
        # Then extract with force
        res = self.client.post(f"/api/v1/documents/{doc_id}/extract", json.dumps({"force": True}), content_type="application/json")
        self.assertEqual(res.status_code, 200)
        
    def test_approve_candidate(self):
        file_obj = self._create_mock_pdf("SOP-Gudang.pdf", "SOP")
        doc_id = self.client.post("/api/v1/documents", {"file": file_obj}).json()["document_id"]
        candidate_id = self.client.post(f"/api/v1/documents/{doc_id}/extract").json()["candidates"][0]["candidate_id"]
        
        # Approve
        res = self.client.post(f"/api/v1/rule-candidates/{candidate_id}/approve", json.dumps({"reviewed_by": "Test User"}), content_type="application/json")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "APPROVED")
        
        # Verify it became a Rule
        rule_id = data["rule_id"]
        rule = Rule.objects.get(id=rule_id)
        self.assertEqual(rule.dimension, "GROSS_WEIGHT")
        self.assertEqual(rule.rule_pack.origin, "CLIENT")
        
    def test_reject_candidate(self):
        file_obj = self._create_mock_pdf("SOP-Gudang.pdf", "SOP")
        doc_id = self.client.post("/api/v1/documents", {"file": file_obj}).json()["document_id"]
        candidate_id = self.client.post(f"/api/v1/documents/{doc_id}/extract").json()["candidates"][0]["candidate_id"]
        
        # Reject
        res = self.client.post(f"/api/v1/rule-candidates/{candidate_id}/reject", json.dumps({"reviewed_by": "Test User"}), content_type="application/json")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "REJECTED")
        
        # Ensure it didn't become a Rule
        self.assertNotIn("rule_id", data)

    def test_reviewed_candidates_list_who_and_when(self):
        file_obj = self._create_mock_pdf("SOP-Gudang.pdf", "SOP")
        doc_id = self.client.post("/api/v1/documents", {"file": file_obj}).json()["document_id"]
        candidate_id = self.client.post(f"/api/v1/documents/{doc_id}/extract").json()["candidates"][0]["candidate_id"]
        self.client.post(f"/api/v1/rule-candidates/{candidate_id}/approve", json.dumps({"reviewed_by": "Test User"}), content_type="application/json")

        res = self.client.get("/api/v1/rule-candidates", {"status": "APPROVED"})
        self.assertEqual(res.status_code, 200)
        row = next(r for r in res.json()["results"] if r["candidate_id"] == candidate_id)
        self.assertEqual(row["reviewed_by"], "Test User")
        self.assertIsNotNone(row["reviewed_at"])
        self.assertIsNotNone(row["rule_id"])
        self.assertEqual(row["document_filename"], "SOP-Gudang.pdf")

    # --- Structured outputs and class-to-configuration mapping ---

    MEDIUM = {
        "name": "Medium Truck",
        "definition": "Medium Truck: Truk sedang (6 roda) standar komersial.",
        "page": 1,
    }

    def _structured(self, classes=(), **overrides):
        entry = {
            "dimension": "GROSS_WEIGHT",
            "operator": "LTE",
            "threshold": 10000,
            "unit": "kg",
            "vehicle_class": "Medium Truck",
            "axle_config": None,
            "axle_index": None,
            "source_text_excerpt": "Medium Truck 10,000 kg",
            "source_page": 1,
        }
        entry.update(overrides)
        self.mock_response.choices[0].message.content = json.dumps(
            {"rules": [entry], "vehicle_classes": list(classes)}
        )
        self.mock_response.choices[0].message.refusal = None

    def _extract_one(self):
        file_obj = self._create_mock_pdf("SOP-Gudang.pdf", "SOP")
        doc_id = self.client.post("/api/v1/documents", {"file": file_obj}).json()["document_id"]
        return self.client.post(f"/api/v1/documents/{doc_id}/extract").json()

    def _approve(self, candidate_id):
        return self.client.post(
            f"/api/v1/rule-candidates/{candidate_id}/approve",
            json.dumps({"reviewed_by": "Test User"}),
            content_type="application/json",
        )

    def test_extraction_asks_for_strict_schema(self):
        self._structured()
        self._extract_one()
        kwargs = self.mock_client.chat.completions.create.call_args.kwargs
        self.assertEqual(kwargs["response_format"]["type"], "json_schema")
        self.assertTrue(kwargs["response_format"]["json_schema"]["strict"])

    def test_class_defined_in_document_maps_with_its_basis(self):
        self._structured(classes=[self.MEDIUM])
        candidate = self._extract_one()["candidates"][0]
        self.assertEqual(candidate["applies_to"]["axle_config"], ["1.2"])
        self.assertIn("6 roda", candidate["applies_to"]["axle_config_basis"])
        res = self._approve(candidate["candidate_id"])
        self.assertEqual(res.status_code, 200)
        rule = Rule.objects.get(id=res.json()["rule_id"])
        self.assertEqual(rule.axle_config, ["1.2"])

    def test_range_definition_stays_unmapped(self):
        light = dict(self.MEDIUM, name="Light Truck", definition="Light Truck: Truk ringan (4-6 roda).")
        self._structured(classes=[light], vehicle_class="Light Truck")
        candidate = self._extract_one()["candidates"][0]
        self.assertNotIn("axle_config", candidate["applies_to"])
        self.assertEqual(self._approve(candidate["candidate_id"]).status_code, 409)

    def test_definition_contradicting_its_axle_count_is_ignored(self):
        odd = dict(self.MEDIUM, definition="Medium Truck: Truk 3 sumbu (6 roda).")
        self._structured(classes=[odd])
        candidate = self._extract_one()["candidates"][0]
        self.assertNotIn("axle_config", candidate["applies_to"])

    def test_inferred_config_not_in_the_quote_is_dropped(self):
        self._structured(axle_config=["1.2"])
        candidate = self._extract_one()["candidates"][0]
        self.assertNotIn("axle_config", candidate["applies_to"])
        self.assertEqual(self._approve(candidate["candidate_id"]).status_code, 409)

    def test_config_stated_in_the_quote_is_kept(self):
        self._structured(axle_config=["1.2.2"], vehicle_class="Tronton",
                         source_text_excerpt="Tronton (1.2.2): 24,000 kg")
        candidate = self._extract_one()["candidates"][0]
        self.assertEqual(candidate["applies_to"]["axle_config"], ["1.2.2"])

    def test_class_named_inside_a_combined_heading_maps(self):
        tronton = dict(self.MEDIUM, name="Tronton / Rigid 3 Axle",
                       definition="Tronton: Truk rigid 3 sumbu (10 roda).")
        self._structured(classes=[tronton], vehicle_class="Tronton", threshold=24000)
        candidate = self._extract_one()["candidates"][0]
        self.assertEqual(candidate["applies_to"]["axle_config"], ["1.2.2"])
        self.assertIn("10 roda", candidate["applies_to"]["axle_config_basis"])

    def test_unknown_configuration_is_dropped(self):
        self._structured(vehicle_class=None, axle_config=["1.22"])
        candidate = self._extract_one()["candidates"][0]
        self.assertIsNone(candidate["applies_to"])
