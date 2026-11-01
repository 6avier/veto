from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Rule, RulePack, RuleOrigin, RuleStatus

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


class RuleClientResetView(APIView):
    """Clears rules approved out of uploaded client documents.

    A demo runs Rule Studio end to end, which leaves its approved rules in the
    live base. Running it again stacks another set on top, and by the third pass
    the register is a pile of duplicates. This puts the base back to what the
    seed migration created.

    Deliberately scoped to CLIENT origin. The CENTRAL ODOL pack is what makes
    the ERP screen return HOLD at all, so wiping it would leave the dispatch
    demo passing everything — the failure would surface on the wrong stage.

    Throttled as a write: it is the one unauthenticated endpoint that deletes
    rows, and the reset button behind it is pressed once between demo runs.
    """

    throttle_scope = "write"

    def post(self, request):
        rules = Rule.objects.filter(rule_pack__origin=RuleOrigin.CLIENT)
        removed = rules.count()
        rules.delete()

        # The packs those rules hung off are meaningless once empty, and leaving
        # them behind makes the next approval open at v4 of a pack with nothing
        # in it.
        packs = RulePack.objects.filter(origin=RuleOrigin.CLIENT, rules__isnull=True)
        packs_removed = packs.count()
        packs.delete()

        return Response({
            "rules_removed": removed,
            "rule_packs_removed": packs_removed,
            "central_rules_retained": Rule.objects.filter(
                rule_pack__origin=RuleOrigin.CENTRAL
            ).count(),
        })

import base64
import json
import logging
import os
import uuid
from functools import lru_cache

import fitz
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone as django_timezone
import openai
import time
from .candidates import (
    axle_configs_for_class,
    entries_from_model_output,
    normalize_axle_config,
    reviewer_name,
    sanitize_candidate,
)
from .models import Document, DocumentClassification, RuleCandidate, CandidateStatus

# How much of a document the extractor reads. The sample SOP runs to ~27,000
# characters and its weight table starts around 7,000; the old 10,000 ceiling
# cut the dimension table off mid-row.
EXTRACT_TEXT_LIMIT = 60_000

# Tagged on the placeholder the fallback produces. Approving it is allowed, so
# the booth demo survives the model being down, but the rule it makes says so.
FALLBACK_TAG = "belum-diverifikasi"

logger = logging.getLogger(__name__)

class DocumentUploadView(APIView):
    throttle_scope = "upload"

    def post(self, request):
        if 'file' not in request.FILES:
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "file is required"}}, status=status.HTTP_400_BAD_REQUEST)
            
        file = request.FILES['file']
        if not file.name.lower().endswith('.pdf'):
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "Only PDF files are supported"}}, status=status.HTTP_400_BAD_REQUEST)
            
        if file.size > 10 * 1024 * 1024:
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "File exceeds 10MB limit"}}, status=status.HTTP_400_BAD_REQUEST)
            
        # Kept in the database, not on disk: see Document.content.
        data = b"".join(file.chunks())

        # Triage using PyMuPDF (fitz)
        page_count = 0
        first_page_text = ""
        try:
            with fitz.open(stream=data, filetype="pdf") as pdf_doc:
                page_count = pdf_doc.page_count
                if page_count > 0:
                    first_page_text = pdf_doc[0].get_text().lower()
        except Exception:
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "File is not a readable PDF", "field": "file"}}, status=status.HTTP_400_BAD_REQUEST)
            
        # Check text for relevance
        is_relevant = any(word in first_page_text for word in ["sop", "kebijakan", "peraturan", "standar", "muatan", "logistik", "berat"])
        
        doc = Document.objects.create(
            # filename is a CharField(255); a longer name is a write error, not
            # a validation one, so it is cut here rather than left to the DB.
            filename=file.name[:255],
            content=data,
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
    """Reads a document and asks the model for the rules in it.

    The only endpoint in the product that costs money per call, on an API that
    asks nobody who they are. It carries two independent ceilings: the per-address
    throttle below, and a daily total across all callers, because an address is
    not a thing an attacker is obliged to keep.
    """

    throttle_scope = "extract"

    @staticmethod
    def _daily_cap_key():
        return f"veto-extract-count-{django_timezone.now():%Y-%m-%d}"

    def post(self, request, document_id):
        cap_key = self._daily_cap_key()
        used = cache.get_or_set(cap_key, 0, 60 * 60 * 26)
        if used >= settings.EXTRACT_DAILY_CAP:
            return Response(
                {
                    "error": {
                        "code": "RATE_LIMITED",
                        "message": (
                            "Batas ekstraksi harian sudah tercapai. Coba lagi besok."
                        ),
                    }
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        try:
            doc = Document.objects.get(document_id=document_id)
        except Document.DoesNotExist:
            return Response({"error": {"code": "NOT_FOUND", "message": "Document not found"}}, status=status.HTTP_404_NOT_FOUND)
            
        body = request.data if isinstance(request.data, dict) else {}
        force = body.get("force") is True
        
        if not doc.accepted and not force:
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "Document was rejected during triage"}}, status=status.HTTP_409_CONFLICT)
            
        started = time.perf_counter()
        
        # Read text from PDF
        pdf_text = ""
        try:
            with _open_pdf(doc) as pdf_doc:
                for i in range(pdf_doc.page_count):
                    pdf_text += f"\n--- Page {i+1} ---\n" + pdf_doc[i].get_text()
        except Exception:
            return Response({"error": {"code": "INTERNAL_ERROR", "message": "Failed to read PDF text"}}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        # Call the model
        candidates_data = []
        used_fallback = False
        fallback_reason = None
        try:
            # An unset key used to leave candidates_data empty and used_fallback
            # false, so the UI reported "no payload clauses in this document"
            # for a document nothing had read. Route it through the fallback
            # path instead, which says plainly that extraction was unavailable.
            if not settings.OPENAI_API_KEY:
                raise RuntimeError("OPENAI_API_KEY is not configured")

            if settings.OPENAI_API_KEY:
                # Counted here, where the spend actually happens — not at entry,
                # where a rejected document would have burned a slot for nothing.
                try:
                    cache.incr(cap_key)
                except ValueError:
                    cache.set(cap_key, 1, 60 * 60 * 26)

                client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
                prompt = f"""
                You are a logistics compliance officer. Read the following SOP document text.
                Extract any rules related to vehicle payload limits (Gross Weight, Axle Load, Dimensions).
                
                Respond ONLY with a valid JSON array of objects. Do not wrap in markdown or backticks.
                Each object must have these exact keys:
                - dimension: enum (GROSS_WEIGHT, AXLE_LOAD, DIMENSION_LENGTH, DIMENSION_WIDTH, DIMENSION_HEIGHT)
                - operator: enum (LTE, GTE, EQ)
                - threshold: integer (convert to raw number, e.g. 24 ton -> 24000, 12.0 m -> 12000)
                - unit: string (must be "kg" or "mm")
                - applies_to: object or null. Keys, all optional:
                    vehicle_class: the row label when the limit comes from a table of vehicle classes (e.g. "Tronton")
                    axle_config: array of axle configurations, only when the document states them (e.g. ["1.2.2"])
                - source_text_excerpt: string (the exact text snippet or table row from the document)
                - source_page: integer (guess the page number based on '--- Page N ---' markers)
                
                GROSS_WEIGHT is the total vehicle weight (GVW / JBI / JBB). A payload or
                cargo-only limit is not GROSS_WEIGHT; skip it. Skip any parameter that is not
                one of the dimensions above (for example overhang).
                
                Document Text:
                {pdf_text[:EXTRACT_TEXT_LIMIT]}
                """
                
                response = client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,
                )
                
                raw_json = (response.choices[0].message.content or "").strip()
                if raw_json.startswith('```json'):
                    raw_json = raw_json[7:-3]
                elif raw_json.startswith('```'):
                    raw_json = raw_json[3:-3]

                candidates_data = [
                    clean
                    for clean in (
                        sanitize_candidate(entry, doc.page_count)
                        for entry in entries_from_model_output(json.loads(raw_json))
                    )
                    if clean
                ]
        except Exception as e:
            # Fallback if API fails or is unavailable. It keeps the booth demo
            # alive when the model is unreachable, so it must never pass itself
            # off as something read out of the document: no gemini-extracted
            # tag, and an excerpt that states plainly what happened instead of
            # sitting under SUMBER looking like a quotation.
            #
            # docs/ENGINEERING.md §5: the threshold below is a placeholder, not a figure
            # taken from any regulation or document.
            used_fallback = True
            # The real exception goes to the server log. What comes back to the
            # browser is a category: an OpenAI client error carries the model,
            # the endpoint and sometimes the organisation, and none of that is
            # the caller's business on an endpoint anyone can reach.
            logger.warning("Rule extraction fell back for %s: %s", doc.document_id, e)
            fallback_reason = (
                "extraction_unavailable"
                if not settings.OPENAI_API_KEY
                else "extraction_failed"
            )
            candidates_data = [
                {
                    "dimension": "GROSS_WEIGHT",
                    "operator": "LTE",
                    "threshold": 24000,
                    "unit": "kg",
                    "applies_to": None,
                    "source_text_excerpt": (
                        "Ekstraksi otomatis tidak tersedia. Angka di bawah adalah contoh "
                        "cadangan dan belum diverifikasi terhadap dokumen ini."
                    ),
                    "source_page": 1,
                    "tags": ["cadangan", FALLBACK_TAG],
                }
            ]
            
        created_candidates = []
        with transaction.atomic():
            # Extracting the same document again replaces what is still waiting
            # for review instead of stacking a second copy of every clause on
            # top of it. Reviewed candidates are history and stay.
            RuleCandidate.objects.filter(document=doc, status=CandidateStatus.PENDING).delete()
            candidates = [
                RuleCandidate.objects.create(
                    document=doc,
                    dimension=cdata["dimension"],
                    operator=cdata["operator"],
                    threshold=cdata["threshold"],
                    unit=cdata["unit"],
                    applies_to=cdata["applies_to"],
                    source_reference=doc.filename,
                    source_text_excerpt=cdata["source_text_excerpt"],
                    source_page=cdata["source_page"],
                    tags=cdata["tags"] or ["openai-extracted"],
                    status=CandidateStatus.PENDING
                )
                for cdata in candidates_data
            ]
        for c in candidates:
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
        # Newest review first, so the audit trail's rule tab reads like the
        # decision log beside it. PENDING rows have no review time, so their
        # order is left as it was for Rule Studio.
        queryset = RuleCandidate.objects.filter(status=status_filter).select_related("document")
        if status_filter != CandidateStatus.PENDING:
            queryset = queryset.order_by("-reviewed_at")

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
                "status": c.status,
                # Who decided and when: the human half of human-in-the-loop,
                # read by the Aturan tab on /audit.
                "rule_id": str(c.rule_id) if c.rule_id else None,
                "reviewed_by": c.reviewed_by,
                "reviewed_at": c.reviewed_at.isoformat() if c.reviewed_at else None,
                "document_filename": c.document.filename,
            })
            
        return Response({
            "results": results,
            "total": len(results)
        })

class RuleCandidateApproveView(APIView):
    throttle_scope = "write"

    def post(self, request, candidate_id):
        reviewed_by = reviewer_name(request.data)

        # The check that the candidate is still pending and the write that
        # approves it happen under one row lock. Apart, a double click went
        # through twice and put two copies of the rule into the live base.
        with transaction.atomic():
            try:
                c = RuleCandidate.objects.select_for_update().get(candidate_id=candidate_id)
            except RuleCandidate.DoesNotExist:
                return Response({"error": {"code": "NOT_FOUND", "message": "Candidate not found"}}, status=status.HTTP_404_NOT_FOUND)

            if c.status != CandidateStatus.PENDING:
                return Response({"error": {"code": "CONFLICT", "message": "Candidate is not PENDING"}}, status=status.HTTP_409_CONFLICT)

            applies = c.applies_to if isinstance(c.applies_to, dict) else {}
            axle_config = normalize_axle_config(applies.get("axle_config"))
            vehicle_class = applies.get("vehicle_class")
            if axle_config is None and vehicle_class:
                axle_config = axle_configs_for_class(vehicle_class)
                if axle_config is None:
                    # Without a configuration the engine applies a rule to
                    # every truck, so a "Pickup: 3,500 kg" row approved as-is
                    # would put every tronton on HOLD.
                    return Response(
                        {
                            "error": {
                                "code": "CONFLICT",
                                "message": (
                                    f"Kelas kendaraan \"{vehicle_class}\" belum bisa dipetakan ke "
                                    "konfigurasi sumbu. Kalau disetujui, rule ini akan berlaku "
                                    "untuk semua truk. Tolak kandidat ini."
                                ),
                            }
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

            # One CLIENT pack, versioned: every approval changes what the engine
            # enforces, so every approval is a new version of the pack. A
            # decision's rule_packs_applied then says which state it ran under.
            pack = (
                RulePack.objects.select_for_update()
                .filter(domain="ODOL", origin=RuleOrigin.CLIENT)
                .order_by("-version")
                .first()
            )
            if pack is None:
                pack = RulePack.objects.create(domain="ODOL", origin=RuleOrigin.CLIENT, version=1)
            else:
                pack.version += 1
                pack.save(update_fields=["version"])

            axle_index = applies.get("axle_index")
            citation = c.source_reference
            if FALLBACK_TAG in (c.tags or []):
                citation = f"{citation} (cadangan, belum diverifikasi)"

            r = Rule.objects.create(
                rule_pack=pack,
                dimension=c.dimension,
                operator=c.operator,
                threshold=c.threshold,
                unit=c.unit,
                axle_config=axle_config,
                axle_index=axle_index if isinstance(axle_index, int) and not isinstance(axle_index, bool) else None,
                legal_citation=citation[:255],
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
    throttle_scope = "write"

    def post(self, request, candidate_id):
        reviewed_by = reviewer_name(request.data)

        with transaction.atomic():
            try:
                c = RuleCandidate.objects.select_for_update().get(candidate_id=candidate_id)
            except RuleCandidate.DoesNotExist:
                return Response({"error": {"code": "NOT_FOUND", "message": "Candidate not found"}}, status=status.HTTP_404_NOT_FOUND)

            if c.status != CandidateStatus.PENDING:
                return Response({"error": {"code": "CONFLICT", "message": "Candidate is not PENDING"}}, status=status.HTTP_409_CONFLICT)

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


def _has_pdf(doc):
    return bool(doc.content) or bool(doc.file_path and os.path.exists(doc.file_path))


def _open_pdf(doc):
    """The document's PDF, from the database or, for older rows, from disk."""
    if doc.content:
        return fitz.open(stream=bytes(doc.content), filetype="pdf")
    return fitz.open(doc.file_path)


@lru_cache(maxsize=32)
def _render_page_png(document_id, page_number, dpi):
    """A page as base64 PNG. A document's PDF is never rewritten, so
    (document, page) always means the same pixels; flipping between pages in
    Rule Studio used to re-rasterise each one on every visit."""
    doc = Document.objects.only("content", "file_path").get(document_id=document_id)
    with _open_pdf(doc) as pdf_doc:
        pixmap = pdf_doc[page_number - 1].get_pixmap(dpi=dpi)
        return base64.b64encode(pixmap.tobytes("png")).decode("ascii")


class DocumentPageView(APIView):
    """One rendered page plus the regions the extractor drew its rules from.

    Rule Studio is specified as split-screen, source document against extracted
    rule (docs/ENGINEERING.md §3). Until now the frontend had the rule but no way to show
    the document, because nothing served the PDF. This serves both halves of the
    comparison in a single request: the page as an image, and the location of
    every candidate clause on it.

    Rectangles are returned as percentages of the page box rather than pixels,
    so the overlay stays aligned at any rendered width and the frontend never
    has to know the DPI.
    """

    DPI = 110

    @staticmethod
    def _row_label(candidate):
        """The table row a candidate came from, when it came from a table.

        Payload limits in these documents live in tables, not sentences, so
        applies_to often carries the row's own label ("Light Truck"). An axle
        configuration ("1.2") is not a label — searching a PDF for it matches
        decimals anywhere on the page — so a label has to contain letters.
        """
        applies = candidate.applies_to or {}
        for key in ("vehicle_class", "axle_config"):
            value = applies.get(key)
            if isinstance(value, list):
                value = value[0] if value else None
            if isinstance(value, str) and len(value.strip()) >= 3 and any(
                ch.isalpha() for ch in value
            ):
                return value.strip()
        return None

    @staticmethod
    def _threshold_variants(candidate):
        """How the threshold might be written on the page, most specific first."""
        grouped = f"{candidate.threshold:,}"
        unit = candidate.unit or ""
        return [
            f"{grouped} {unit}".strip(),
            f"{grouped.replace(',', '.')} {unit}".strip(),
            grouped,
            grouped.replace(",", "."),
            str(candidate.threshold),
        ]

    def _locate(self, page, candidate):
        """Where on the page this candidate's clause actually sits.

        The extractor is asked for the exact sentence behind a rule, but a rule
        read out of a table has no sentence. It answers either by joining the
        row's cells with newlines or by gluing a column header to a cell, and
        neither string exists on the page as one run of text: the first matched
        every identical figure in the table (a 6,000 kg cell appears five times
        on one page), the second matched nothing at all.

        So a tabular candidate is located the way a person reads a table. Find
        the row by its label, then look for the figure only within that row's
        band. Prose keeps the old verbatim search, which is exact and right for
        it.
        """
        label = self._row_label(candidate)
        if label:
            label_hits = page.search_for(label)
            if label_hits:
                row = label_hits[0]
                # A hair over half the line's height each way: enough to survive
                # cells whose baselines sit a point or two apart, tight enough
                # not to reach the rows above and below.
                pad = (row.y1 - row.y0) * 0.6
                band = fitz.Rect(0, row.y0 - pad, page.rect.width, row.y1 + pad)
                for variant in self._threshold_variants(candidate):
                    value_hits = page.search_for(variant, clip=band)
                    if value_hits:
                        return [row] + value_hits
                # The row is real even when the figure is written some way this
                # does not predict. Marking it alone still points somewhere true.
                return [row]

        hits = []
        for line in (candidate.source_text_excerpt or "").split("\n"):
            line = line.strip()
            if len(line) < 3:
                continue
            hits.extend(page.search_for(line))
        return hits

    def get(self, request, document_id, page_number):
        try:
            doc = Document.objects.get(document_id=document_id)
        except Document.DoesNotExist:
            return Response(
                {"error": {"code": "NOT_FOUND", "message": "Document not found"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not _has_pdf(doc):
            return Response(
                {"error": {"code": "NOT_FOUND", "message": "Document file is no longer available"}},
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
            with _open_pdf(doc) as pdf_doc:
                page = pdf_doc[page_number - 1]
                box = page.rect
                image_b64 = _render_page_png(doc.document_id, page_number, self.DPI)

                # Candidates that cite this page. A clause the extractor
                # paraphrased beyond recognition still returns nothing, which
                # degrades to an un-highlighted page rather than a wrong
                # highlight.
                regions = []
                for c in RuleCandidate.objects.filter(document=doc, source_page=page_number):
                    rects = [
                        {
                            "x": round(hit.x0 / box.width * 100, 3),
                            "y": round(hit.y0 / box.height * 100, 3),
                            "w": round((hit.x1 - hit.x0) / box.width * 100, 3),
                            "h": round((hit.y1 - hit.y0) / box.height * 100, 3),
                        }
                        for hit in self._locate(page, c)
                    ]
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
