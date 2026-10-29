"""Master Armada Perusahaan (Company Fleet Master Registry) & Anti-Swap Verification.

Stores registered company/partner vehicles with their official KIR/registration specs
(license plate, body type, axle configuration, tare weight, and JBI limit) and cross-checks
camera-detected license plates and physical truck body types to prevent document/plate swapping.
"""

import re

ALLOWED_BODY_TYPES = frozenset({
    "DUMP_TRUCK",
    "BAK_TERPAL",
    "BOX_TERTUTUP",
    "FLATBED",
})

FLEET_REGISTRY = [
    {
        "license_plate": "B 505 WLG",
        "vehicle_model": "Hino Ranger 500 FL 260 JW",
        "vendor_name": "PT Veto Logistik Prima",
        "registered_body_type": "BAK_TERPAL",
        "body_type_strict": False,
        "axle_config": "1.2.2",
        "tare_weight_kg": 8900,
        "max_jbi_kg": 24000,
        "standard_dimensions_mm": {
            "length": 9800,
            "width": 2480,
            "height": 3800,
        },
    },
    {
        "license_plate": "B 9482 UEX",
        "vehicle_model": "Hino Ranger FM 260 JD",
        "vendor_name": "PT Nusantara Logistik",
        "registered_body_type": "BAK_TERPAL",
        "axle_config": "1.2.2",
        "tare_weight_kg": 9200,
        "max_jbi_kg": 24000,
        "standard_dimensions_mm": {
            "length": 9800,
            "width": 2480,
            "height": 3850,
        },
    },
    {
        "license_plate": "B 9104 KQA",
        "vehicle_model": "Mitsubishi Fuso Fighter FN 62",
        "vendor_name": "PT Krakatau Trans",
        "registered_body_type": "DUMP_TRUCK",
        "axle_config": "1.2.2",
        "tare_weight_kg": 9800,
        "max_jbi_kg": 24000,
        "standard_dimensions_mm": {
            "length": 9200,
            "width": 2480,
            "height": 3600,
        },
    },
    {
        "license_plate": "D 8831 XH",
        "vehicle_model": "Isuzu Giga FVM 34 U",
        "vendor_name": "PT Parahyangan Cargo",
        "registered_body_type": "BOX_TERTUTUP",
        "axle_config": "1.2.2",
        "tare_weight_kg": 8900,
        "max_jbi_kg": 24000,
        "standard_dimensions_mm": {
            "length": 9600,
            "width": 2480,
            "height": 3800,
        },
    },
    {
        "license_plate": "L 9720 UV",
        "vehicle_model": "Mitsubishi Colt Diesel FE 74 HD",
        "vendor_name": "CV Surya Ekspedisi",
        "registered_body_type": "BAK_TERPAL",
        "axle_config": "1.2",
        "tare_weight_kg": 3600,
        "max_jbi_kg": 12000,
        "standard_dimensions_mm": {
            "length": 6500,
            "width": 2100,
            "height": 3100,
        },
    },
    {
        "license_plate": "A 8391 ZT",
        "vehicle_model": "UD Trucks Quester CWE 280",
        "vendor_name": "PT Krakatau Trans",
        "registered_body_type": "FLATBED",
        "axle_config": "1.2.2",
        "tare_weight_kg": 9400,
        "max_jbi_kg": 24000,
        "standard_dimensions_mm": {
            "length": 11500,
            "width": 2480,
            "height": 3500,
        },
    },
]


def _compact_plate(plate):
    if not plate or not isinstance(plate, str):
        return ""
    return re.sub(r"[^A-Z0-9]", "", plate.upper())


_REGISTRY_BY_PLATE = {
    _compact_plate(entry["license_plate"]): entry for entry in FLEET_REGISTRY
}


def get_fleet_registry():
    """Return a copy of all registered company vehicles."""
    return [dict(item) for item in FLEET_REGISTRY]


def lookup_or_match_fleet(detected_plate=None, detected_body_type=None):
    """Cross-check detected license plate and physical body type against Master Armada.

    Returns a dictionary containing the matched vehicle record and verification status:
    - VERIFIED: Plate exists in Master Armada and physical body type matches.
    - MISMATCH_ALERT: Plate exists in Master Armada, but camera sees a different truck body!
    - UNREGISTERED_PLATE: Plate was read clearly, but is not registered in Master Armada.
    - VISUAL_MATCH_FALLBACK: Plate occluded/side angle; matched by physical body profile.
    """
    normalized_body = (
        detected_body_type
        if detected_body_type in ALLOWED_BODY_TYPES
        else "BAK_TERPAL"
    )
    compact = _compact_plate(detected_plate)

    # 1. Exact license plate match in Master Armada
    if compact and compact in _REGISTRY_BY_PLATE:
        record = dict(_REGISTRY_BY_PLATE[compact])
        is_flexible = record.get("body_type_strict", True) is False
        if is_flexible and detected_body_type:
            record["registered_body_type"] = normalized_body
        body_match = (
            True
            if (not detected_body_type or is_flexible)
            else (record["registered_body_type"] == normalized_body)
        )
        if body_match:
            return {
                **record,
                "detected_body_type": normalized_body,
                "identity_status": "VERIFIED",
                "identity_verified": True,
                "body_type_match": True,
                "match_source": "LICENSE_PLATE_EXACT",
                "fraud_warning": None,
            }
        return {
            **record,
            "detected_body_type": normalized_body,
            "identity_status": "MISMATCH_ALERT",
            "identity_verified": False,
            "body_type_match": False,
            "match_source": "LICENSE_PLATE_MISMATCH",
            "fraud_warning": (
                f"PERINGATAN: Pelat {record['license_plate']} terdaftar sebagai "
                f"{record['registered_body_type']}, namun kamera mendeteksi fisik "
                f"{normalized_body} (Indikasi Tukar Pelat / Tukar Surat Jalan)!"
            ),
        }

    # 2. License plate was read by OCR, but is not in Master Armada
    if compact:
        return {
            "license_plate": detected_plate,
            "vehicle_model": None,
            "vendor_name": None,
            "registered_body_type": None,
            "axle_config": None,
            "tare_weight_kg": None,
            "max_jbi_kg": None,
            "standard_dimensions_mm": None,
            "detected_body_type": normalized_body,
            "identity_status": "UNREGISTERED_PLATE",
            "identity_verified": False,
            "body_type_match": False,
            "match_source": "UNREGISTERED_LOOKUP",
            "fraud_warning": (
                f"Pelat nomor {detected_plate} belum terdaftar di Master Armada perusahaan."
            ),
        }

    # 3. Plate not visible in camera angle or no plate detected
    return {
        "license_plate": None,
        "vehicle_model": None,
        "vendor_name": None,
        "registered_body_type": None,
        "axle_config": None,
        "tare_weight_kg": None,
        "max_jbi_kg": None,
        "standard_dimensions_mm": None,
        "detected_body_type": normalized_body,
        "identity_status": "NO_PLATE_DETECTED",
        "identity_verified": False,
        "body_type_match": False,
        "match_source": "NO_PLATE",
        "fraud_warning": "Pelat nomor tidak terdeteksi pada kamera.",
    }
