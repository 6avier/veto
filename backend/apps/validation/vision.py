"""VETO Vision Service — Over-Dimension Detection, ALPR OCR & Security Guardrails.

Encapsulates all computer vision inference behind 5 security guardrails:
1. Server-side API credentials only (never exposed to clients).
2. Daily spend cap & frame/session caching for OpenAI Vision ALPR calls.
3. Base64 payload size ceiling (~512 KB) & binary magic-bytes check (JPEG/PNG).
4. Strict output sanitization (Indonesian license plate regex & body-type enum whitelist).
5. Hardcoded upstream hosts, 12-second timeouts, and upstream error masking.
"""

import base64
import binascii
import hashlib
import json
import logging
import re
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone as django_timezone
import openai
from rest_framework import status

from .fleet_registry import ALLOWED_BODY_TYPES, lookup_or_match_fleet

logger = logging.getLogger(__name__)

# Guardrail 3: ~512 KB binary image ceiling (~700,000 Base64 chars)
MAX_BASE64_CHARS = 700_000
JPEG_MAGIC = b"\xff\xd8\xff"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"

# Guardrail 4: Strict Indonesian vehicle license plate pattern (e.g., B 9482 UEX)
PLATE_REGEX = re.compile(r"^([A-Z]{1,2})\s*(\d{1,4})\s*([A-Z]{1,3})$")

# Guardrail 5: Strict network timeout for upstream AI calls
UPSTREAM_TIMEOUT_SECONDS = 12

_OPENAI_CLIENT = None


def _get_openai_client(api_key):
    """Reuse OpenAI client instance to keep HTTP connection pool alive for low latency."""
    global _OPENAI_CLIENT
    if _OPENAI_CLIENT is None or _OPENAI_CLIENT.api_key != api_key:
        _OPENAI_CLIENT = openai.OpenAI(
            api_key=api_key,
            timeout=float(UPSTREAM_TIMEOUT_SECONDS),
            max_retries=1,
        )
    return _OPENAI_CLIENT


class VisionServiceError(Exception):
    """Structured error raised by the vision pipeline with safe client-facing metadata."""

    def __init__(
        self,
        message,
        code="VALIDATION_ERROR",
        field=None,
        http_status=status.HTTP_400_BAD_REQUEST,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.field = field
        self.http_status = http_status


def validate_image_base64(image_base64):
    """Validate Base64 image length, encoding, and binary JPEG/PNG magic bytes.

    Returns (clean_base64_str, mime_type).
    Raises VisionServiceError on invalid or oversized payloads.
    """
    if not image_base64 or not isinstance(image_base64, str):
        raise VisionServiceError(
            "image_base64 is required",
            code="VALIDATION_ERROR",
            field="image_base64",
            http_status=status.HTTP_400_BAD_REQUEST,
        )

    if len(image_base64) > MAX_BASE64_CHARS:
        raise VisionServiceError(
            "Ukuran frame gambar melebihi batas maksimum (512 KB).",
            code="PAYLOAD_TOO_LARGE",
            field="image_base64",
            http_status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )

    clean_b64 = image_base64.strip()
    if "," in clean_b64 and clean_b64.lower().startswith("data:"):
        clean_b64 = clean_b64.split(",", 1)[1].strip()
    clean_b64 = re.sub(r"\s+", "", clean_b64)

    try:
        raw_bytes = base64.b64decode(clean_b64, validate=True)
    except (binascii.Error, ValueError):
        raise VisionServiceError(
            "Encoding Base64 gambar tidak valid.",
            code="VALIDATION_ERROR",
            field="image_base64",
            http_status=status.HTTP_400_BAD_REQUEST,
        )

    if raw_bytes.startswith(JPEG_MAGIC):
        return clean_b64, "image/jpeg"
    if raw_bytes.startswith(PNG_MAGIC):
        return clean_b64, "image/png"

    raise VisionServiceError(
        "Format file tidak valid. Hanya gambar JPEG atau PNG yang diizinkan.",
        code="VALIDATION_ERROR",
        field="image_base64",
        http_status=status.HTTP_400_BAD_REQUEST,
    )


def sanitize_plate(raw_plate):
    """Sanitize OCR license plate string against Indonesian plate format.

    Prevents visual prompt injection or arbitrary text on truck bodies from
    entering the response or database.
    """
    if not raw_plate or not isinstance(raw_plate, str):
        return None
    cleaned = re.sub(r"[^A-Z0-9 ]", " ", raw_plate.upper())
    cleaned = re.sub(r"^(?:\b(?:PLAT|NOMOR|POLISI|NO)\b|\s)+", "", cleaned).strip()[:15]
    match = PLATE_REGEX.match(cleaned)
    if not match:
        return None
    return f"{match.group(1)} {match.group(2)} {match.group(3)}"


def sanitize_body_type(raw_body):
    """Validate truck body classification against strict enum whitelist."""
    if not raw_body or not isinstance(raw_body, str):
        return "BAK_TERPAL"
    cleaned = re.sub(r"[^A-Z_]", "", raw_body.upper()).strip()
    return cleaned if cleaned in ALLOWED_BODY_TYPES else "BAK_TERPAL"


def sanitize_visual_notes(raw_notes):
    """Strip any unsafe characters from visual notes."""
    if not raw_notes or not isinstance(raw_notes, str):
        return "Truk terdeteksi pada kamera gerbang."
    cleaned = re.sub(r"[^a-zA-Z0-9 .,/()-]", "", raw_notes).strip()
    return cleaned[:120] or "Truk terdeteksi pada kamera gerbang."


def detect_overdimension(clean_b64):
    """Run server-side over-dimension detection on a validated Base64 frame."""
    api_key = getattr(settings, "ROBOFLOW_API_KEY", "")
    if not api_key:
        raise VisionServiceError(
            "VETO Vision API key is not configured on the server.",
            code="VISION_UNAVAILABLE",
            http_status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    model_id = str(getattr(settings, "ROBOFLOW_MODEL_ID", "truck-overload-project"))
    version = str(getattr(settings, "ROBOFLOW_MODEL_VERSION", "8"))

    def _call_model(ver):
        url = (
            f"https://detect.roboflow.com/{urllib.parse.quote(model_id)}/{urllib.parse.quote(ver)}"
            f"?api_key={urllib.parse.quote(api_key)}&confidence=15&overlap=25"
        )
        req = urllib.request.Request(
            url,
            data=clean_b64.encode("utf-8"),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=UPSTREAM_TIMEOUT_SECONDS) as resp:
            return json.loads(resp.read().decode("utf-8"))

    try:
        data = _call_model(version)
        if not data.get("predictions") and version == "8":
            try:
                fallback = _call_model("6")
                if fallback.get("predictions"):
                    data = fallback
            except Exception as fallback_exc:
                logger.warning("Vision fallback model call failed: %s", fallback_exc)
    except urllib.error.HTTPError as exc:
        logger.warning("Vision upstream HTTP error: status=%s", exc.code)
        raise VisionServiceError(
            "Layanan pendeteksi dimensi sedang mengalami gangguan.",
            code="VISION_UPSTREAM_ERROR",
            http_status=status.HTTP_502_BAD_GATEWAY,
        )
    except Exception as exc:
        logger.warning("Vision upstream connection error: %s", exc)
        raise VisionServiceError(
            "Tidak dapat terhubung ke layanan pendeteksi dimensi.",
            code="VISION_UPSTREAM_ERROR",
            http_status=status.HTTP_502_BAD_GATEWAY,
        )

    return data.get("predictions", [])


def _alpr_daily_cap_key():
    return f"veto-alpr-count-{django_timezone.now():%Y-%m-%d}"


def detect_alpr_and_fleet(clean_b64, mime_type="image/jpeg", use_session_cache=False):
    """Run ALPR license plate OCR + physical body classification + Master Armada lookup.

    - Uses SHA-256 frame caching (120s) and optional session caching (60s) so
      rapid video frames do not repeatedly bill OpenAI Vision.
    - Enforces VISION_ALPR_DAILY_CAP across all callers.
    - Sanitizes all OCR outputs before matching against FLEET_REGISTRY.
    """
    frame_hash = hashlib.sha256(clean_b64.encode("ascii", errors="ignore")).hexdigest()[:16]
    frame_cache_key = f"veto-alpr-frame-{frame_hash}"
    session_cache_key = "veto-alpr-latest-session"

    cached = cache.get(frame_cache_key)
    if cached:
        return cached

    if use_session_cache:
        recent = cache.get(session_cache_key)
        if recent:
            return recent

    cap_key = _alpr_daily_cap_key()
    daily_cap = int(getattr(settings, "VISION_ALPR_DAILY_CAP", 120))
    used = cache.get_or_set(cap_key, 0, 60 * 60 * 26)

    openai_key = getattr(settings, "OPENAI_API_KEY", "")
    model_name = getattr(settings, "OPENAI_MODEL", "gpt-4o-mini") or "gpt-4o-mini"

    alpr_data = None
    if openai_key and used < daily_cap:
        try:
            try:
                cache.incr(cap_key)
            except ValueError:
                cache.set(cap_key, 1, 60 * 60 * 26)

            client = _get_openai_client(openai_key)
            prompt = (
                "Fast ALPR. OCR Indonesian vehicle license plate and truck body type. "
                "Return JSON ONLY with keys:\n"
                "- license_plate: string or null (e.g. 'B 505 WLG')\n"
                "- detected_body_type: one of ['DUMP_TRUCK', 'BAK_TERPAL', 'BOX_TERTUTUP', 'FLATBED']\n"
                "- plate_confidence: float 0.0 to 1.0"
            )
            response = client.chat.completions.create(
                model=model_name,
                response_format={"type": "json_object"},
                temperature=0.0,
                max_tokens=60,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{clean_b64}",
                                    "detail": "low",
                                },
                            },
                        ],
                    }
                ],
            )
            raw_content = (response.choices[0].message.content or "{}").strip()
            parsed = json.loads(raw_content)

            sanitized_plate = sanitize_plate(parsed.get("license_plate"))
            sanitized_body = sanitize_body_type(parsed.get("detected_body_type"))
            raw_conf = parsed.get("plate_confidence", 0.0)
            try:
                confidence = max(0.0, min(1.0, float(raw_conf)))
            except (TypeError, ValueError):
                confidence = 0.0

            alpr_data = {
                "plate_detected": bool(sanitized_plate),
                "license_plate": sanitized_plate,
                "plate_confidence": round(confidence, 3) if sanitized_plate else 0.0,
                "detected_body_type": sanitized_body,
                "visual_notes": f"Truk karoseri {sanitized_body}",
                "source": "OPENAI_VISION_OCR",
            }
        except Exception as exc:
            logger.warning("Vision ALPR OpenAI call fell back: %s", exc)

    if alpr_data is None:
        alpr_data = {
            "plate_detected": False,
            "license_plate": None,
            "plate_confidence": 0.0,
            "detected_body_type": "BAK_TERPAL",
            "visual_notes": "Identifikasi profil fisik karoseri truk dari kamera gerbang.",
            "source": "VISUAL_PROFILE_FALLBACK",
        }

    fleet_match = lookup_or_match_fleet(
        detected_plate=alpr_data["license_plate"],
        detected_body_type=alpr_data["detected_body_type"],
    )

    result = {
        "alpr": alpr_data,
        "fleet_match": fleet_match,
    }
    cache.set(frame_cache_key, result, 120)
    cache.set(session_cache_key, result, 60)
    return result
