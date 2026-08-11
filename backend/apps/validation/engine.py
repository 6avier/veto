from typing import Dict, List, Any

# Dimension mapping for easy lookup
DIMENSION_NAMES = {
    "DIMENSION_LENGTH": "length",
    "DIMENSION_WIDTH": "width",
    "DIMENSION_HEIGHT": "height"
}

def _format_number(num: int) -> str:
    return f"{num:,}"

def _find_stricter_rule(central_rule, client_rule, operator):
    """
    Returns (strictest_rule, other_rule).
    For LTE (Less Than or Equal), lower threshold is stricter.
    For GTE, higher threshold is stricter.
    """
    if not central_rule: return client_rule, None
    if not client_rule: return central_rule, None
    
    if operator == "LTE":
        if client_rule.threshold < central_rule.threshold:
            return client_rule, central_rule
        return central_rule, client_rule
    elif operator == "GTE":
        if client_rule.threshold > central_rule.threshold:
            return client_rule, central_rule
        return central_rule, client_rule
    return central_rule, client_rule

def _evaluate_dimension(dimension: str, actual_value: int, rules: List[Any], unit: str, axle_index: int = None) -> dict | None:
    if actual_value is None:
        return None
        
    # Filter rules for this dimension and axle_index
    applicable_rules = [
        r for r in rules 
        if r.dimension == dimension and (r.axle_index == axle_index or r.axle_index is None)
    ]
    
    if not applicable_rules:
        return None

    central_rule = next((r for r in applicable_rules if r.rule_pack.origin == "CENTRAL"), None)
    client_rule = next((r for r in applicable_rules if r.rule_pack.origin == "CLIENT"), None)
    
    # Assume LTE for all MVP ODOL rules right now
    strictest_rule, other_rule = _find_stricter_rule(central_rule, client_rule, "LTE")
    
    if strictest_rule and actual_value > strictest_rule.threshold:
        excess = actual_value - strictest_rule.threshold
        
        # Build directive
        subject = ""
        if dimension == "GROSS_WEIGHT":
            subject = "total load"
        elif dimension == "AXLE_LOAD":
            subject = "rear axle load" if axle_index is not None and axle_index > 0 else "axle 1 load"
            if axle_index is not None:
                subject = f"axle {axle_index + 1} load"
        elif dimension in DIMENSION_NAMES:
            subject = f"load {DIMENSION_NAMES[dimension]}"
            
        directive = f"Reduce {subject} by {_format_number(excess)} {unit}"
        
        # Contract: If client is stricter, contrast with legal limit
        if strictest_rule.rule_pack.origin == "CLIENT" and other_rule and other_rule.rule_pack.origin == "CENTRAL":
            directive += f" — client policy is stricter than the legal limit of {_format_number(other_rule.threshold)} {unit}"

        # Build violation dict
        violation = {
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

def evaluate_payload(payload: Dict[str, Any], active_rules: List[Any]) -> tuple[str, List[dict]]:
    """
    Evaluates the vehicle payload against active rules.
    Returns (outcome, violations).
    """
    violations = []
    
    load = payload.get("load", {})
    
    # 1. Gross Weight
    gross = load.get("gross_weight_kg")
    if gross is not None:
        v = _evaluate_dimension("GROSS_WEIGHT", gross, active_rules, "kg")
        if v: violations.append(v)
        
    # 2. Axle Loads
    axle_loads = load.get("axle_loads_kg", [])
    for idx, load_val in enumerate(axle_loads):
        v = _evaluate_dimension("AXLE_LOAD", load_val, active_rules, "kg", axle_index=idx)
        if v: 
            # Contract: formatting the directive for the rear axle
            if v["directive"].startswith(f"Reduce axle {idx + 1} load") and idx == len(axle_loads) - 1 and idx > 0:
                v["directive"] = v["directive"].replace(f"axle {idx + 1} load", "rear axle load")
            violations.append(v)
            
    # 3. Dimensions
    dims = load.get("dimensions_mm", {})
    for dim_key, dim_enum in DIMENSION_NAMES.items():
        val = dims.get(dim_enum)
        if val is not None:
            v = _evaluate_dimension(dim_key, val, active_rules, "mm")
            if v: violations.append(v)
            
    outcome = "HOLD" if violations else "PASS"
    return outcome, violations
