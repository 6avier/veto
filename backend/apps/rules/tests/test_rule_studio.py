import json
import io
from unittest.mock import patch, MagicMock
from django.test import TestCase, Client
from apps.rules.models import Document, DocumentClassification, RuleCandidate, CandidateStatus, Rule, RulePack

class RuleStudioTests(TestCase):
    def setUp(self):
        self.client = Client()
        
        # Inject fake Gemini client to bypass API calls and quota
        self.patcher = patch('apps.rules.views.genai.Client')
        self.mock_client_class = self.patcher.start()
        
        self.settings_patcher = self.settings(GEMINI_API_KEY='fake-key')
        self.settings_patcher.enable()
        
        self.mock_client = MagicMock()
        self.mock_client_class.return_value = self.mock_client
        
        self.mock_response = MagicMock()
        self.mock_response.text = json.dumps([{
            "dimension": "GROSS_WEIGHT",
            "operator": "LTE",
            "threshold": 25000,
            "unit": "kg",
            "applies_to": None,
            "source_text_excerpt": "Maksimal muatan 25 ton",
            "source_page": 1,
            "tags": ["gemini-extracted"]
        }])
        self.mock_client.models.generate_content.return_value = self.mock_response

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
