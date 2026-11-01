from typing import Dict, List, Any, Optional, Tuple, Union

# Dimension mapping for easy lookup. These values are payload keys under
# load.dimensions_mm — wire format, never display text. Do not translate them.
DIMENSION_NAMES = {
    "DIMENSION_LENGTH": "length",
    "DIMENSION_WIDTH": "width",
    "DIMENSION_HEIGHT": "height"
}

# What a directive calls each dimension. DESIGN.md §7: the interface is
# Indonesian, and directives render verbatim from the server, so the sentence
# the operator reads exists here and nowhere else.
DIMENSION_SUBJECTS = {
    "DIMENSION_LENGTH": "panjang muatan",
    "DIMENSION_WIDTH": "lebar muatan",
    "DIMENSION_HEIGHT": "tinggi muatan",
}

def _format_number(num: int) -> str:
    """1300 -> "1.300". Indonesian separators, matching the frontend's id-ID
    formatting so a directive agrees with the figures printed beside it."""
    return f"{num:,}".replace(",", ".")

def _axle_subject(axle_index: Optional[int], total_axles: int) -> str:
    """Mirrors axleLabel() in DispatchForm.jsx. A directive must name an axle the
    same way the field the operator is about to correct names it."""
    if axle_index is None:
        return "beban sumbu"
    if axle_index == 0:
        return "beban sumbu depan"
    if axle_index == total_axles - 1:
        return "beban sumbu belakang"
    return "beban sumbu tengah"

def _find_stricter_rule(central_rule: Any, client_rule: Any, operator: str) -> Tuple[Any, Any]:
    """
    Returns (strictest_rule, other_rule).
    For LTE (Less Than or Equal), lower threshold is stricter.
    For GTE, higher threshold is stricter.
    """
    if not central_rule:
        return client_rule, None
    if not client_rule:
        return central_rule, None
    
    if operator == "LTE":
        if client_rule.threshold < central_rule.threshold:
            return client_rule, central_rule
        return central_rule, client_rule
    elif operator == "GTE":
        if client_rule.threshold > central_rule.threshold:
            return client_rule, central_rule
        return central_rule, client_rule
    return central_rule, client_rule

def _config_matches(rule_config: Any, axle_config: Optional[str]) -> bool:
    """A rule's axle_config is a single config ("1.2.2") from the seed, or a
    list of them (["1.2", "1.2.2"]) from Rule Studio, meaning "any of these".
    Comparing the list to the payload's string with == never matched, so every
    rule approved out of a client document was silently skipped."""
    if rule_config is None or axle_config is None:
        return False
    if isinstance(rule_config, list):
        return axle_config in rule_config
    return rule_config == axle_config

def _get_applicable_rule(rules: List[Any], origin: str, axle_index: Optional[int], axle_config: Optional[str]) -> Any:
    origin_rules = [r for r in rules if r.rule_pack.origin == origin]

    # 1. Try exact match for both axle_config and axle_index
    exact_rule = next((r for r in origin_rules if r.axle_index == axle_index and _config_matches(r.axle_config, axle_config)), None)
    if exact_rule: return exact_rule

    # 2. Match axle_index exactly, but generic axle_config (None)
    index_only = next((r for r in origin_rules if r.axle_index == axle_index and r.axle_config is None and r.axle_index is not None), None)
    if index_only: return index_only

    # 3. Match axle_config exactly, but generic axle_index (None)
    config_only = next((r for r in origin_rules if r.axle_index is None and _config_matches(r.axle_config, axle_config)), None)
    if config_only: return config_only
    
    # 4. Fallback to fully general rule (both are None)
    return next((r for r in origin_rules if r.axle_index is None and r.axle_config is None), None)

def _evaluate_dimension(
    dimension: str,
    actual_value: int,
    rules: List[Any],
    unit: str,
    axle_index: Optional[int] = None,
    total_axles: int = 1,
    axle_config: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    if actual_value is None:
        return None
        
    dim_rules = [r for r in rules if r.dimension == dimension]
    if not dim_rules:
        return None

    central_rule = _get_applicable_rule(dim_rules, "CENTRAL", axle_index, axle_config)
    client_rule = _get_applicable_rule(dim_rules, "CLIENT", axle_index, axle_config)
    
    if not central_rule and not client_rule:
        return None
    
    # Fetch operator dynamically based on strictest rule
    operator = client_rule.operator if client_rule else central_rule.operator
    strictest_rule, other_rule = _find_stricter_rule(central_rule, client_rule, operator)
    actual_operator = strictest_rule.operator if strictest_rule else operator
    
    is_violation = False
    excess = 0
    if strictest_rule:
        if actual_operator == "LTE" and actual_value > strictest_rule.threshold:
            is_violation = True
            excess = actual_value - strictest_rule.threshold
        elif actual_operator == "GTE" and actual_value < strictest_rule.threshold:
            is_violation = True
            excess = strictest_rule.threshold - actual_value
        elif actual_operator == "EQ" and actual_value != strictest_rule.threshold:
            is_violation = True
            excess = abs(actual_value - strictest_rule.threshold)
            
    if is_violation:
        
        # Build directive
        subject = ""
        if dimension == "GROSS_WEIGHT":
            subject = "muatan total"
        elif dimension == "AXLE_LOAD":
            subject = _axle_subject(axle_index, total_axles)
        elif dimension in DIMENSION_SUBJECTS:
            subject = DIMENSION_SUBJECTS[dimension]

        if actual_operator == "GTE" or (actual_operator == "EQ" and actual_value < strictest_rule.threshold):
            action = "Tambah"
        else:
            action = "Kurangi"

        directive = f"{action} {subject} {_format_number(excess)} {unit}"

        # Contract: If client is stricter, contrast with legal limit.
        # A second sentence, not an em-dash: DESIGN.md \u00a77 bans em-dashes in
        # anything a user sees, directives included.
        if strictest_rule.rule_pack.origin == "CLIENT" and other_rule and other_rule.rule_pack.origin == "CENTRAL":
            directive += f". Batas maksimal SOP Klien adalah {_format_number(strictest_rule.threshold)} {unit}"

        # Build violation dict
        violation: Dict[str, Any] = {
            "dimension": dimension,
            "actual_value": actual_value,
            "limit_value": strictest_rule.threshold,
            "excess_value": excess,
            "unit": unit,
            "severity": "BLOCKING",
            "rule_origin": strictest_rule.rule_pack.origin,
            "legal_citation": strictest_rule.legal_citation,
            "directive": directive,
        }
        if axle_index is not None:
            violation["axle_index"] = axle_index
            
        return violation
    return None

# The most a declared gross may differ from the sum of the declared axle loads.
# A gap wider than this is an input error, not a load to evaluate.
AXLE_SUM_TOLERANCE_KG = 500

def axle_sum_mismatch(load: Dict[str, Any]) -> Optional[int]:
    """The gap between gross and the axle sum when it is too wide to evaluate.

    This used to be reported as a GROSS_WEIGHT violation with a CENTRAL origin
    and "Integritas Data Sumbu vs Total" as its legal citation, which put a
    citation in the audit trail that no regulation contains. It is a data
    error, so the view now rejects it as one before anything is evaluated.
    """
    axle_loads = load.get("axle_loads_kg") or []
    gross = load.get("gross_weight_kg")
    if gross is None or not axle_loads:
        return None
    gap = abs(sum(axle_loads) - gross)
    return gap if gap > AXLE_SUM_TOLERANCE_KG else None

def has_gross_rule(active_rules: List[Any], axle_config: Optional[str]) -> bool:
    """Whether any gross weight ceiling covers this configuration.

    The generic JBI rule was replaced by per-configuration ones (migration
    0005), so a configuration outside that list, or no configuration at all,
    had no gross check and a 60 t load came back PASS. The view refuses those
    instead of passing them unchecked.

    Only the CENTRAL pack counts: a client SOP limit is an extra ceiling on
    top of the legal one, not a stand-in for it.
    """
    gross_rules = [
        r for r in active_rules
        if r.dimension == "GROSS_WEIGHT" and r.rule_pack.origin == "CENTRAL"
    ]
    return any(
        r.axle_index is None and (r.axle_config is None or _config_matches(r.axle_config, axle_config))
        for r in gross_rules
    )

def evaluate_payload(payload: Dict[str, Any], active_rules: List[Any]) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Evaluates the vehicle payload against active rules.
    Returns (outcome, violations).
    """
    violations = []
    
    vehicle = payload.get("vehicle") or {}
    axle_config = vehicle.get("axle_config")
    
    load = payload.get("load") or {}
    axle_loads = load.get("axle_loads_kg") or []
    gross = load.get("gross_weight_kg")

    # 1. Gross Weight Rule Evaluation
    if gross is not None:
        v = _evaluate_dimension("GROSS_WEIGHT", gross, active_rules, "kg", axle_config=axle_config)
        if v: violations.append(v)
        
    # 2. Axle Loads
    total_axles = len(axle_loads)
    for idx, load_val in enumerate(axle_loads):
        v = _evaluate_dimension("AXLE_LOAD", load_val, active_rules, "kg", axle_index=idx, total_axles=total_axles, axle_config=axle_config)
        if v: 
            violations.append(v)
            
    # 3. Dimensions
    dims = load.get("dimensions_mm") or {}
    for dim_key, dim_enum in DIMENSION_NAMES.items():
        val = dims.get(dim_enum)
        if val is not None:
            v = _evaluate_dimension(dim_key, val, active_rules, "mm", axle_config=axle_config)
            if v: violations.append(v)
            
    # 4. Smart Directives (Konsultan Muatan Cerdas)
    _apply_smart_recommendations(violations, axle_loads, active_rules, axle_config)
            
    outcome = "HOLD" if violations else "PASS"
    return outcome, violations

def _axle_limit(active_rules: List[Any], idx: int, axle_config: Optional[str]) -> Optional[int]:
    """The binding ceiling for one axle, or None when no rule covers it."""
    axle_rules = [r for r in active_rules if r.dimension == "AXLE_LOAD"]
    central_rule = _get_applicable_rule(axle_rules, "CENTRAL", idx, axle_config)
    client_rule = _get_applicable_rule(axle_rules, "CLIENT", idx, axle_config)
    limits = [r.threshold for r in (central_rule, client_rule) if r]
    return min(limits) if limits else None

def _join_parts(parts: List[str]) -> str:
    if len(parts) == 1:
        return parts[0]
    return ", ".join(parts[:-1]) + " dan " + parts[-1]

def _apply_smart_recommendations(violations: List[Dict[str, Any]], axle_loads: List[int], active_rules: List[Any], axle_config: Optional[str]) -> None:
    gross_violation = next((v for v in violations if v["dimension"] == "GROSS_WEIGHT"), None)
    axle_violations = [v for v in violations if v["dimension"] == "AXLE_LOAD"]
    
    if not axle_violations and not gross_violation:
        return
    if not axle_loads:
        return

    total = len(axle_loads)
    axle_stats = []
    for idx, actual in enumerate(axle_loads):
        limit = _axle_limit(active_rules, idx, axle_config)
        if limit is None:
            # An axle no rule covers has no known headroom. Guessing one (this
            # used to assume 10,000 kg) would put an invented figure into a
            # directive, so no suggestion is made at all.
            return
        axle_stats.append({
            "index": idx,
            "limit": limit,
            "headroom": max(0, limit - actual),
            "excess": max(0, actual - limit),
        })

    # Case 1: Overloaded gross weight (cargo has to come off).
    # Overloaded axles shed their own excess first: that is load that must go
    # anyway. Only what remains is spread across the axles in proportion to
    # their limits. The old split was purely proportional, so it told the
    # operator to unload axles that were within their limit while the one
    # actually over it kept part of its excess.
    if gross_violation:
        reductions = [s["excess"] for s in axle_stats]
        remaining = gross_violation["excess_value"] - sum(reductions)
        total_limit = sum(s["limit"] for s in axle_stats)
        if remaining > 0 and total_limit > 0:
            shares = [remaining * s["limit"] // total_limit for s in axle_stats]
            # Integer division leaves a few kilograms over; they go to the axle
            # with the largest limit so the suggestion adds up to the excess.
            largest = max(range(total), key=lambda i: axle_stats[i]["limit"])
            shares[largest] += remaining - sum(shares)
            reductions = [r + s for r, s in zip(reductions, shares)]

        parts = [
            f"{_format_number(amount)} kg dari {_axle_subject(i, total).replace('beban ', '')}"
            for i, amount in enumerate(reductions)
            if amount > 0
        ]
        if parts:
            gross_violation["directive"] += f". Saran: turunkan {_join_parts(parts)}"
                
    # Case 2: Gross is within its limit but an axle is over (cargo can move).
    # Each overloaded axle is matched to the axles with the most headroom, and
    # a suggestion is only made when the receiving axles can take all of it.
    # Shifting to whichever axle came first used to push the front axle over
    # its own limit in the same breath as fixing the rear one.
    elif axle_violations:
        headroom = {s["index"]: s["headroom"] for s in axle_stats}
        for v in sorted(axle_violations, key=lambda v: v["excess_value"], reverse=True):
            idx = v.get("axle_index")
            if idx is None:
                continue
            needed = v["excess_value"]
            plan = []
            for recipient in sorted(headroom, key=headroom.get, reverse=True):
                if needed <= 0:
                    break
                if recipient == idx or headroom[recipient] <= 0:
                    continue
                moved = min(needed, headroom[recipient])
                plan.append((recipient, moved))
                needed -= moved
            if needed > 0:
                continue
            for recipient, moved in plan:
                headroom[recipient] -= moved
            parts = [
                f"{_format_number(moved)} kg ke {_axle_subject(recipient, total).replace('beban ', '')}"
                for recipient, moved in plan
            ]
            v["directive"] += f". Saran: geser {_join_parts(parts)}, tanpa mengurangi muatan"
