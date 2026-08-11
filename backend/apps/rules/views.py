import json
from django.views import View
from django.http import JsonResponse
from django.utils.dateparse import parse_datetime
from .models import Rule, RuleOrigin, RuleDimension, RuleStatus

class RuleListView(View):
    def get(self, request):
        queryset = Rule.objects.select_related('rule_pack')
        
        # Filtering
        origin = request.GET.get('origin')
        if origin in [RuleOrigin.CENTRAL, RuleOrigin.CLIENT]:
            queryset = queryset.filter(rule_pack__origin=origin)
            
        dimension = request.GET.get('dimension')
        if dimension:
            queryset = queryset.filter(dimension=dimension)
            
        status = request.GET.get('status', RuleStatus.ACTIVE)
        if status:
            queryset = queryset.filter(status=status)
            
        results = []
        for r in queryset:
            # Map applies_to
            applies_to = {}
            if r.axle_config:
                applies_to["axle_config"] = r.axle_config
            if r.axle_index is not None:
                applies_to["axle_index"] = r.axle_index
                
            results.append({
                "rule_id": str(r.id),
                "dimension": r.dimension,
                "operator": r.operator,
                "threshold": r.threshold,
                "unit": r.unit,
                "applies_to": applies_to if applies_to else None,
                "legal_citation": r.legal_citation,
                "origin": r.rule_pack.origin,
                "rule_pack_version": r.rule_pack.version,
                "status": r.status,
                "effective_from": r.rule_pack.effective_from.isoformat()
            })
            
        return JsonResponse({
            "results": results,
            "total": len(results)
        })

import os
import fitz
from django.conf import settings
from google import genai
from google.genai import types
import time
from datetime import datetime, timezone
from django.utils import timezone as django_timezone
from .models import Document, DocumentClassification, RuleCandidate, CandidateStatus, RuleOperator, RulePack

class DocumentUploadView(View):
    def post(self, request):
        if 'file' not in request.FILES:
            return JsonResponse({"error": {"code": "VALIDATION_ERROR", "message": "file is required"}}, status=400)
            
        file = request.FILES['file']
        if not file.name.lower().endswith('.pdf'):
            return JsonResponse({"error": {"code": "VALIDATION_ERROR", "message": "Only PDF files are supported"}}, status=400)
            
        if file.size > 10 * 1024 * 1024:
            return JsonResponse({"error": {"code": "VALIDATION_ERROR", "message": "File exceeds 10MB limit"}}, status=400)
            
        # Save file locally. MEDIA_ROOT is gitignored, so the directory does not
        # exist on a fresh clone or a new deploy and has to be created here.
        upload_dir = os.path.join(settings.MEDIA_ROOT, 'documents')
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, os.path.basename(file.name))
        with open(file_path, 'wb+') as destination:
            for chunk in file.chunks():
                destination.write(chunk)
                
        # Triage using PyMuPDF (fitz)
        page_count = 0
        first_page_text = ""
        try:
            with fitz.open(file_path) as pdf_doc:
                page_count = pdf_doc.page_count
                if page_count > 0:
                    first_page_text = pdf_doc[0].get_text().lower()
        except Exception:
            return JsonResponse({"error": {"code": "INTERNAL_ERROR", "message": "Failed to read PDF"}}, status=500)
            
        # Check text for relevance
        is_relevant = any(word in first_page_text for word in ["sop", "kebijakan", "peraturan", "standar", "muatan", "logistik", "berat"])
        
        doc = Document.objects.create(
            filename=file.name,
            file_path=file_path,
            page_count=page_count,
            classification=DocumentClassification.INTERNAL_POLICY if is_relevant else DocumentClassification.OPERATIONAL_DOC,
            classification_confidence=0.95 if is_relevant else 0.98,
            accepted=is_relevant,
            rejection_reason_code=None if is_relevant else DocumentClassification.OPERATIONAL_DOC,
            needs_human_review=False
        )
        
        return JsonResponse({
            "document_id": str(doc.document_id),
            "filename": doc.filename,
            "page_count": doc.page_count,
            "classification": doc.classification,
            "classification_confidence": doc.classification_confidence,
            "accepted": doc.accepted,
            "rejection_reason_code": doc.rejection_reason_code,
            "needs_human_review": doc.needs_human_review,
            "uploaded_at": doc.uploaded_at.isoformat()
        }, status=201)

class DocumentExtractView(View):
    def post(self, request, document_id):
        try:
            doc = Document.objects.get(document_id=document_id)
        except Document.DoesNotExist:
            return JsonResponse({"error": {"code": "NOT_FOUND", "message": "Document not found"}}, status=404)
            
        try:
            body = json.loads(request.body) if request.body else {}
        except json.JSONDecodeError:
            body = {}
            
        force = body.get("force", False)
        
        if not doc.accepted and not force:
            return JsonResponse({"error": {"code": "VALIDATION_ERROR", "message": "Document was rejected during triage"}}, status=409)
            
        started = time.perf_counter()
        
        # Read text from PDF
        pdf_text = ""
        try:
            with fitz.open(doc.file_path) as pdf_doc:
                for i in range(pdf_doc.page_count):
                    pdf_text += f"\n--- Page {i+1} ---\n" + pdf_doc[i].get_text()
        except Exception:
            return JsonResponse({"error": {"code": "INTERNAL_ERROR", "message": "Failed to read PDF text"}}, status=500)
            
        # Call Gemini API
        candidates_data = []
        try:
            if settings.GEMINI_API_KEY:
                client = genai.Client(api_key=settings.GEMINI_API_KEY)
                prompt = f"""
                You are a logistics compliance officer. Read the following SOP document text.
                Extract any rules related to vehicle payload limits (Gross Weight, Axle Load, Dimensions).
                
                Respond ONLY with a valid JSON array of objects. Do not wrap in markdown or backticks.
                Each object must have these exact keys:
                - dimension: enum (GROSS_WEIGHT, AXLE_LOAD, DIMENSION_LENGTH, DIMENSION_WIDTH, DIMENSION_HEIGHT, AXLE_CONFIG)
                - operator: enum (LTE, GTE, EQ)
                - threshold: integer (convert to raw number, e.g. 24 ton -> 24000)
                - unit: string (must be "kg" or "mm")
                - applies_to: object (e.g. {{"axle_config": ["1.2"]}} or null)
                - source_text_excerpt: string (the exact sentence from the text)
                - source_page: integer (guess the page number based on '--- Page N ---' markers)
                
                Document Text:
                {pdf_text[:10000]} # Limit text to avoid token limits in MVP
                """
                
                response = client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.1,
                    )
                )
                
                raw_json = response.text.strip()
                if raw_json.startswith('```json'):
                    raw_json = raw_json[7:-3]
                elif raw_json.startswith('```'):
                    raw_json = raw_json[3:-3]
                    
                candidates_data = json.loads(raw_json)
        except Exception as e:
            # Fallback if API fails or is unavailable
            candidates_data = [
                {
                    "dimension": "GROSS_WEIGHT",
                    "operator": "LTE",
                    "threshold": 25000,
                    "unit": "kg",
                    "applies_to": None,
                    "source_text_excerpt": "Fallback extraction due to API error: " + str(e),
                    "source_page": 1
                }
            ]
            
        created_candidates = []
        for cdata in candidates_data:
            c = RuleCandidate.objects.create(
                document=doc,
                dimension=cdata.get("dimension", RuleDimension.GROSS_WEIGHT),
                operator=cdata.get("operator", RuleOperator.LTE),
                threshold=cdata.get("threshold", 0),
                unit=cdata.get("unit", "kg"),
                applies_to=cdata.get("applies_to"),
                source_reference=doc.filename,
                source_text_excerpt=cdata.get("source_text_excerpt", ""),
                source_page=cdata.get("source_page", 1),
                tags=["gemini-extracted"],
                status=CandidateStatus.PENDING
            )
            created_candidates.append({
                "candidate_id": str(c.candidate_id),
                "dimension": c.dimension,
                "operator": c.operator,
                "threshold": c.threshold,
                "unit": c.unit,
                "applies_to": c.applies_to,
                "source_reference": c.source_reference,
                "source_text_excerpt": c.source_text_excerpt,
                "source_page": c.source_page,
                "tags": c.tags,
                "status": c.status
            })
            
        extraction_ms = max(1, round((time.perf_counter() - started) * 1000))
        
        return JsonResponse({
            "document_id": str(doc.document_id),
            "candidates": created_candidates,
            "extraction_ms": extraction_ms,
            "used_fallback": len(candidates_data) > 0 and "API error" in candidates_data[0].get("source_text_excerpt", "")
        })

class RuleCandidateListView(View):
    def get(self, request):
        status_filter = request.GET.get('status', CandidateStatus.PENDING)
        queryset = RuleCandidate.objects.filter(status=status_filter)
        
        results = []
        for c in queryset:
            results.append({
                "candidate_id": str(c.candidate_id),
                "dimension": c.dimension,
                "operator": c.operator,
                "threshold": c.threshold,
                "unit": c.unit,
                "applies_to": c.applies_to,
                "source_reference": c.source_reference,
                "source_text_excerpt": c.source_text_excerpt,
                "source_page": c.source_page,
                "tags": c.tags,
                "status": c.status
            })
            
        return JsonResponse({
            "results": results,
            "total": len(results)
        })

class RuleCandidateApproveView(View):
    def post(self, request, candidate_id):
        try:
            c = RuleCandidate.objects.get(candidate_id=candidate_id)
        except RuleCandidate.DoesNotExist:
            return JsonResponse({"error": {"code": "NOT_FOUND", "message": "Candidate not found"}}, status=404)
            
        if c.status != CandidateStatus.PENDING:
            return JsonResponse({"error": {"code": "VALIDATION_ERROR", "message": "Candidate is not PENDING"}}, status=409)
            
        try:
            body = json.loads(request.body)
        except json.JSONDecodeError:
            body = {}
            
        reviewed_by = body.get("reviewed_by", "Unknown")
        
        # Get or create active CLIENT RulePack
        pack, _ = RulePack.objects.get_or_create(
            domain="ODOL",
            origin=RuleOrigin.CLIENT,
            defaults={"version": 1}
        )
        
        # Create actual Rule
        r = Rule.objects.create(
            rule_pack=pack,
            dimension=c.dimension,
            operator=c.operator,
            threshold=c.threshold,
            unit=c.unit,
            axle_config=c.applies_to.get("axle_config") if c.applies_to else None,
            axle_index=c.applies_to.get("axle_index") if c.applies_to else None,
            legal_citation=c.source_reference,
            status=RuleStatus.ACTIVE
        )
        
        c.status = CandidateStatus.APPROVED
        c.rule_id = r.id
        c.reviewed_by = reviewed_by
        c.reviewed_at = django_timezone.now()
        c.save()
        
        return JsonResponse({
            "candidate_id": str(c.candidate_id),
            "status": c.status,
            "rule_id": str(c.rule_id),
            "rule_pack_id": str(pack.id),
            "rule_pack_version": pack.version,
            "reviewed_by": c.reviewed_by,
            "reviewed_at": c.reviewed_at.isoformat()
        })

class RuleCandidateRejectView(View):
    def post(self, request, candidate_id):
        try:
            c = RuleCandidate.objects.get(candidate_id=candidate_id)
        except RuleCandidate.DoesNotExist:
            return JsonResponse({"error": {"code": "NOT_FOUND", "message": "Candidate not found"}}, status=404)
            
        if c.status != CandidateStatus.PENDING:
            return JsonResponse({"error": {"code": "VALIDATION_ERROR", "message": "Candidate is not PENDING"}}, status=409)
            
        try:
            body = json.loads(request.body)
        except json.JSONDecodeError:
            body = {}
            
        reviewed_by = body.get("reviewed_by", "Unknown")
        
        c.status = CandidateStatus.REJECTED
        c.reviewed_by = reviewed_by
        c.reviewed_at = django_timezone.now()
        c.save()
        
        return JsonResponse({
            "candidate_id": str(c.candidate_id),
            "status": c.status,
            "reviewed_by": c.reviewed_by,
            "reviewed_at": c.reviewed_at.isoformat()
        })
