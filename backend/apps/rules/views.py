from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Rule, RuleOrigin, RuleDimension, RuleStatus

class RuleListView(APIView):
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
            
        return Response({
            "results": results,
            "total": len(results)
        })

import base64
import json
import os
import fitz
from django.conf import settings
from google import genai
from google.genai import types
import time
from datetime import datetime, timezone
from django.utils import timezone as django_timezone
from .models import Document, DocumentClassification, RuleCandidate, CandidateStatus, RuleOperator, RulePack

class DocumentUploadView(APIView):
    def post(self, request):
        if 'file' not in request.FILES:
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "file is required"}}, status=status.HTTP_400_BAD_REQUEST)
            
        file = request.FILES['file']
        if not file.name.lower().endswith('.pdf'):
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "Only PDF files are supported"}}, status=status.HTTP_400_BAD_REQUEST)
            
        if file.size > 10 * 1024 * 1024:
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "File exceeds 10MB limit"}}, status=status.HTTP_400_BAD_REQUEST)
            
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
            return Response({"error": {"code": "INTERNAL_ERROR", "message": "Failed to read PDF"}}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
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
        
        return Response({
            "document_id": str(doc.document_id),
            "filename": doc.filename,
            "page_count": doc.page_count,
            "classification": doc.classification,
            "classification_confidence": doc.classification_confidence,
            "accepted": doc.accepted,
            "rejection_reason_code": doc.rejection_reason_code,
            "needs_human_review": doc.needs_human_review,
            "uploaded_at": doc.uploaded_at.isoformat()
        }, status=status.HTTP_201_CREATED)

class DocumentExtractView(APIView):
    def post(self, request, document_id):
        try:
            doc = Document.objects.get(document_id=document_id)
        except Document.DoesNotExist:
            return Response({"error": {"code": "NOT_FOUND", "message": "Document not found"}}, status=status.HTTP_404_NOT_FOUND)
            
        body = request.data or {}
        force = body.get("force", False)
        
        if not doc.accepted and not force:
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "Document was rejected during triage"}}, status=status.HTTP_409_CONFLICT)
            
        started = time.perf_counter()
        
        # Read text from PDF
        pdf_text = ""
        try:
            with fitz.open(doc.file_path) as pdf_doc:
                for i in range(pdf_doc.page_count):
                    pdf_text += f"\n--- Page {i+1} ---\n" + pdf_doc[i].get_text()
        except Exception:
            return Response({"error": {"code": "INTERNAL_ERROR", "message": "Failed to read PDF text"}}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        # Call Gemini API
        candidates_data = []
        used_fallback = False
        fallback_reason = None
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
            # Fallback if API fails or is unavailable. It keeps the booth demo
            # alive when the model is unreachable, so it must never pass itself
            # off as something read out of the document: no gemini-extracted
            # tag, and an excerpt that states plainly what happened instead of
            # sitting under SUMBER looking like a quotation.
            #
            # CLAUDE.md §5: the threshold below is a placeholder, not a figure
            # taken from any regulation or document. TODO: verify.
            used_fallback = True
            fallback_reason = str(e)
            candidates_data = [
                {
                    "dimension": "GROSS_WEIGHT",
                    "operator": "LTE",
                    "threshold": 25000,
                    "unit": "kg",
                    "applies_to": None,
                    "source_text_excerpt": (
                        "Ekstraksi otomatis tidak tersedia. Angka di bawah adalah contoh "
                        "cadangan dan belum diverifikasi terhadap dokumen ini."
                    ),
                    "source_page": 1,
                    "tags": ["cadangan", "belum-diverifikasi"],
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
                tags=cdata.get("tags") or ["gemini-extracted"],
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
        
        # used_fallback is set where the fallback is built, not sniffed back out
        # of the excerpt text. String-matching the excerpt meant that rewording
        # the message silently turned the flag off.
        return Response({
            "document_id": str(doc.document_id),
            "candidates": created_candidates,
            "extraction_ms": extraction_ms,
            "used_fallback": used_fallback,
            "fallback_reason": fallback_reason,
        })

class RuleCandidateListView(APIView):
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
            
        return Response({
            "results": results,
            "total": len(results)
        })

class RuleCandidateApproveView(APIView):
    def post(self, request, candidate_id):
        try:
            c = RuleCandidate.objects.get(candidate_id=candidate_id)
        except RuleCandidate.DoesNotExist:
            return Response({"error": {"code": "NOT_FOUND", "message": "Candidate not found"}}, status=status.HTTP_404_NOT_FOUND)
            
        if c.status != CandidateStatus.PENDING:
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "Candidate is not PENDING"}}, status=status.HTTP_409_CONFLICT)
            
        body = request.data or {}
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
        
        return Response({
            "candidate_id": str(c.candidate_id),
            "status": c.status,
            "rule_id": str(c.rule_id),
            "rule_pack_id": str(pack.id),
            "rule_pack_version": pack.version,
            "reviewed_by": c.reviewed_by,
            "reviewed_at": c.reviewed_at.isoformat()
        })

class RuleCandidateRejectView(APIView):
    def post(self, request, candidate_id):
        try:
            c = RuleCandidate.objects.get(candidate_id=candidate_id)
        except RuleCandidate.DoesNotExist:
            return Response({"error": {"code": "NOT_FOUND", "message": "Candidate not found"}}, status=status.HTTP_404_NOT_FOUND)
            
        if c.status != CandidateStatus.PENDING:
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "Candidate is not PENDING"}}, status=status.HTTP_409_CONFLICT)
            
        body = request.data or {}
        reviewed_by = body.get("reviewed_by", "Unknown")
        
        c.status = CandidateStatus.REJECTED
        c.reviewed_by = reviewed_by
        c.reviewed_at = django_timezone.now()
        c.save()
        
        return Response({
            "candidate_id": str(c.candidate_id),
            "status": c.status,
            "reviewed_by": c.reviewed_by,
            "reviewed_at": c.reviewed_at.isoformat()
        })


class DocumentPageView(APIView):
    """One rendered page plus the regions the extractor drew its rules from.

    Rule Studio is specified as split-screen, source document against extracted
    rule (CLAUDE.md §3). Until now the frontend had the rule but no way to show
    the document, because nothing served the PDF. This serves both halves of the
    comparison in a single request: the page as an image, and the location of
    every candidate clause on it.

    Rectangles are returned as percentages of the page box rather than pixels,
    so the overlay stays aligned at any rendered width and the frontend never
    has to know the DPI.
    """

    DPI = 110
    MAX_DPI_PIXELS = 4000

    def get(self, request, document_id, page_number):
        try:
            doc = Document.objects.get(document_id=document_id)
        except Document.DoesNotExist:
            return Response(
                {"error": {"code": "NOT_FOUND", "message": "Document not found"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not doc.file_path or not os.path.exists(doc.file_path):
            return Response(
                {"error": {"code": "NOT_FOUND", "message": "Document file is no longer on disk"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        if page_number < 1 or page_number > doc.page_count:
            return Response(
                {
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": f"page_number must be between 1 and {doc.page_count}",
                        "field": "page_number",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with fitz.open(doc.file_path) as pdf_doc:
                page = pdf_doc[page_number - 1]
                box = page.rect
                pixmap = page.get_pixmap(dpi=self.DPI)
                image_b64 = base64.b64encode(pixmap.tobytes("png")).decode("ascii")

                # Candidates that cite this page. search_for gives the clause its
                # coordinates back; a excerpt the extractor paraphrased simply
                # returns nothing, which degrades to an un-highlighted page
                # rather than a wrong highlight.
                regions = []
                for c in RuleCandidate.objects.filter(document=doc, source_page=page_number):
                    rects = []
                    for line in (c.source_text_excerpt or "").split("\n"):
                        line = line.strip()
                        if len(line) < 3:
                            continue
                        for hit in page.search_for(line):
                            rects.append(
                                {
                                    "x": round(hit.x0 / box.width * 100, 3),
                                    "y": round(hit.y0 / box.height * 100, 3),
                                    "w": round((hit.x1 - hit.x0) / box.width * 100, 3),
                                    "h": round((hit.y1 - hit.y0) / box.height * 100, 3),
                                }
                            )
                    regions.append(
                        {
                            "candidate_id": str(c.candidate_id),
                            "dimension": c.dimension,
                            "threshold": c.threshold,
                            "unit": c.unit,
                            "status": c.status,
                            "rects": rects,
                        }
                    )
        except Exception:
            return Response(
                {"error": {"code": "INTERNAL_ERROR", "message": "Failed to render PDF page"}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "document_id": str(doc.document_id),
                "filename": doc.filename,
                "page_number": page_number,
                "page_count": doc.page_count,
                "width": round(box.width, 2),
                "height": round(box.height, 2),
                "image": f"data:image/png;base64,{image_b64}",
                "regions": regions,
            }
        )
