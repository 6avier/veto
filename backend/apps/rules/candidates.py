"""Turns what the model returned into candidates the rest of the system can trust.

The extractor's output went straight into RuleCandidate.objects.create. A
dimension outside the enum, a threshold written as "24 ton", or an object where
an array belonged either landed in the review queue as nonsense or crashed the
request with a 500. Everything is checked here, and an entry that cannot be made
sound is dropped rather than guessed at.
"""

import re

from .models import RuleDimension, RuleOperator

# Dimensions the validation engine actually evaluates. AXLE_CONFIG is in the
# enum but nothing reads it at dispatch, so a rule approved on it would sit in
# the register doing nothing.
EVALUATED_DIMENSIONS = {
    RuleDimension.GROSS_WEIGHT: "kg",
    RuleDimension.AXLE_LOAD: "kg",
    RuleDimension.DIMENSION_LENGTH: "mm",
    RuleDimension.DIMENSION_WIDTH: "mm",
    RuleDimension.DIMENSION_HEIGHT: "mm",
}

# Units the model sometimes answers in despite being asked for kg and mm.
UNIT_FACTORS = {
    "kg": ("kg", 1),
    "ton": ("kg", 1000),
    "t": ("kg", 1000),
    "mm": ("mm", 1),
    "cm": ("mm", 10),
    "m": ("mm", 1000),
}

MAX_THRESHOLD = 1_000_000
MAX_EXCERPT_CHARS = 2000
MAX_TAGS = 10
MAX_TAG_CHARS = 40

# Client documents name vehicle classes ("Tronton"), the engine matches axle
# configurations ("1.2.2"). Only names that point at one family of
# configurations are listed. "Light Truck" or "Heavy Truck" could be several,
# and guessing would make a rule bind trucks it was never written for.
# TODO: verify these against the client's own fleet definitions.
VEHICLE_CLASS_AXLE_CONFIGS = {
    "tronton": ["1.2.2"],
    "trailer": ["1.2.2-2.2", "1.2.2-2.2.2"],
    "trailer combination": ["1.2.2-2.2", "1.2.2-2.2.2"],
    "truk gandeng": ["1.1-2.2", "1.2-2.2"],
    "gandengan": ["1.1-2.2", "1.2-2.2"],
}


def axle_configs_for_class(vehicle_class):
    if not isinstance(vehicle_class, str):
        return None
    return VEHICLE_CLASS_AXLE_CONFIGS.get(vehicle_class.strip().lower())


# The configurations the central pack sets a gross weight for (rules
# migrations 0002, 0005). A rule bound to any other string could never match a
# dispatch, so one is dropped rather than stored.
KNOWN_AXLE_CONFIGS = ["1.1", "1.2", "1.2.2", "1.1-2.2", "1.2-2.2", "1.2.2-2.2", "1.2.2-2.2.2"]

MAX_BASIS_CHARS = 300


def normalize_axle_config(value):
    """A list of known configuration strings, or None. The engine reads a list
    as "any of these"."""
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        return None
    configs = [v.strip() for v in value if isinstance(v, str) and v.strip() in KNOWN_AXLE_CONFIGS]
    return configs or None


def normalize_applies_to(value):
    if not isinstance(value, dict):
        return None
    applies = {}

    vehicle_class = value.get("vehicle_class")
    if isinstance(vehicle_class, str) and vehicle_class.strip():
        applies["vehicle_class"] = vehicle_class.strip()[:60]

    axle_config = normalize_axle_config(value.get("axle_config"))
    basis = value.get("axle_config_basis")
    basis = basis.strip()[:MAX_BASIS_CHARS] if isinstance(basis, str) and basis.strip() else None
    if axle_config is None and "vehicle_class" in applies:
        axle_config = axle_configs_for_class(applies["vehicle_class"])
        basis = None
    if axle_config:
        applies["axle_config"] = axle_config
        if basis:
            applies["axle_config_basis"] = basis

    axle_index = value.get("axle_index")
    if isinstance(axle_index, int) and not isinstance(axle_index, bool) and 0 <= axle_index < 12:
        applies["axle_index"] = axle_index

    return applies or None


def _threshold(raw, factor):
    if isinstance(raw, bool) or not isinstance(raw, (int, float)):
        return None
    value = round(raw * factor)
    return value if 0 < value <= MAX_THRESHOLD else None


def sanitize_candidate(raw, page_count):
    """One model entry as RuleCandidate fields, or None when it is unusable."""
    if not isinstance(raw, dict):
        return None

    dimension = raw.get("dimension")
    if dimension not in EVALUATED_DIMENSIONS:
        return None
    operator = raw.get("operator")
    if operator not in RuleOperator.values:
        return None

    unit_raw = raw.get("unit")
    unit_key = unit_raw.strip().lower() if isinstance(unit_raw, str) else EVALUATED_DIMENSIONS[dimension]
    unit, factor = UNIT_FACTORS.get(unit_key, (None, None))
    if unit != EVALUATED_DIMENSIONS[dimension]:
        return None
    threshold = _threshold(raw.get("threshold"), factor)
    if threshold is None:
        return None

    page = raw.get("source_page")
    if isinstance(page, bool) or not isinstance(page, int):
        page = 1
    page = min(max(page, 1), max(page_count, 1))

    excerpt = raw.get("source_text_excerpt")
    excerpt = excerpt[:MAX_EXCERPT_CHARS] if isinstance(excerpt, str) else ""

    tags = raw.get("tags")
    if isinstance(tags, list):
        tags = [t[:MAX_TAG_CHARS] for t in tags if isinstance(t, str)][:MAX_TAGS]
    else:
        tags = None

    return {
        "dimension": dimension,
        "operator": operator,
        "threshold": threshold,
        "unit": unit,
        "applies_to": normalize_applies_to(raw.get("applies_to")),
        "source_text_excerpt": excerpt,
        "source_page": page,
        "tags": tags,
    }


def structured_entry(raw):
    """A flat entry from the structured-output schema, reshaped into the
    nested form sanitize_candidate reads. Strict schemas cannot have optional
    keys, so the scope fields arrive at the top level, null when absent."""
    if not isinstance(raw, dict) or "applies_to" in raw:
        return raw
    entry = dict(raw)
    entry["applies_to"] = {
        key: entry.pop(key)
        for key in ("vehicle_class", "axle_config", "axle_config_basis", "axle_index")
        if key in entry
    }
    return entry


def entries_from_model_output(parsed):
    """The list of entries, whether the model sent a bare array or wrapped it
    in an object such as {"rules": [...]}."""
    if isinstance(parsed, list):
        return parsed
    if isinstance(parsed, dict):
        if isinstance(parsed.get("rules"), list):
            return parsed["rules"]
        for value in parsed.values():
            if isinstance(value, list):
                return value
    return []


# A rigid truck's wheel count names one configuration: 4 wheels is two axles
# on single tyres, 6 is two axles with a dual rear, 10 is a tronton. Any other
# count, or a range, names none. Combinations are left to the class table above,
# since their names say more than their wheel counts.
# TODO: verify against the client's own fleet definitions.
WHEELS_AXLE_CONFIG = {4: ("1.1", 2), 6: ("1.2", 2), 10: ("1.2.2", 3)}


WHEELS_RE = re.compile(r"(\d+)\s*(?:-|–|sampai|s/d|to)?\s*(\d+)?\s*(?:roda|wheels?)\b", re.IGNORECASE)
AXLES_RE = re.compile(r"(\d+)\s*(?:sumbu|gandar|axles?)\b", re.IGNORECASE)


def config_from_definition(text):
    """The one configuration a class definition's own words name, or None.

    Counts are read from the sentence here rather than taken from the model,
    which once reported "1 sumbu" for a definition that names no axles at all.
    A range ("4-6 roda"), several counts, or an axle count that contradicts
    the wheels all name no single configuration.
    """
    wheels = WHEELS_RE.findall(text)
    if len(wheels) != 1:
        return None
    low, high = wheels[0]
    if high and high != low:
        return None
    entry = WHEELS_AXLE_CONFIG.get(int(low))
    if not entry:
        return None
    config, expected_axles = entry
    axles = AXLES_RE.findall(text)
    if axles and any(int(a) != expected_axles for a in axles):
        return None
    return config


def _class_key(name):
    return " ".join(name.lower().split()) if isinstance(name, str) else ""


def apply_class_definitions(entries, classes):
    """Fill axle_config for rules that name a class the document itself
    defines with one exact wheel count, quoting the definition as the basis.

    The model only reports what each definition says; the mapping is here, so
    every row for "Medium Truck" gets the same answer and the reviewer sees the
    sentence it came from. A definition that matches the name of a rule's class
    only as part of a longer heading ("Trailer / Trailer Combination") counts.
    """
    definitions = {}
    for item in classes if isinstance(classes, list) else []:
        if not isinstance(item, dict):
            continue
        definition = item.get("definition")
        if not isinstance(definition, str) or not definition.strip():
            continue
        found = config_from_definition(definition)
        if not found:
            continue
        page = item.get("page")
        name = str(item.get("name", "")).strip()
        quote = definition.strip()
        # The model sometimes copies the sentence without its "Name:" lead-in;
        # the reviewer should still read which class it defines.
        if name and not quote.lower().startswith(name.lower()):
            quote = f"{name}: {quote}"
        basis = (quote + (f" (hal. {page})" if isinstance(page, int) else ""))[:MAX_BASIS_CHARS]
        for part in str(item.get("name", "")).split("/"):
            if _class_key(part):
                definitions[_class_key(part)] = (found, basis)

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        configs = entry.get("axle_config")
        if configs and entry.get("vehicle_class"):
            # The model is told to copy a configuration only when the rule
            # states one. If the quoted text does not contain it, the model
            # inferred it after all, so it goes and the class is mapped below.
            excerpt = entry.get("source_text_excerpt") or ""
            if not any(isinstance(c, str) and c in excerpt for c in configs):
                entry["axle_config"] = configs = None
                entry["axle_config_basis"] = None
        if configs:
            continue
        found = definitions.get(_class_key(entry.get("vehicle_class")))
        if found:
            entry["axle_config"] = [found[0]]
            entry["axle_config_basis"] = found[1]
    return entries


def reviewer_name(body):
    """reviewed_by / overridden_by as stored: a trimmed string that fits the
    CharField(255) it goes into."""
    value = body.get("reviewed_by") if isinstance(body, dict) else None
    return clean_name(value)


def clean_name(value):
    if not isinstance(value, str) or not value.strip():
        return "Unknown"
    return value.strip()[:255]
