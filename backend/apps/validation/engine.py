from typing import Dict, List, Any, Optional, Tuple, Union

# Dimension mapping for easy lookup
DIMENSION_NAMES = {
    "DIMENSION_LENGTH": "length",
    "DIMENSION_WIDTH": "width",
    "DIMENSION_HEIGHT": "height"
}

def _format_number(num: int) -> str:
    return f"{num:,}"

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

def _get_applicable_rule(rules: List[Any], origin: str, axle_index: Optional[int], axle_config: Optional[str]) -> Any:
    origin_rules = [r for r in rules if r.rule_pack.origin == origin]
    
    # 1. Try exact match for both axle_config and axle_index
    exact_rule = next((r for r in origin_rules if r.axle_index == axle_index and r.axle_config == axle_config and r.axle_config is not None), None)
    if exact_rule: return exact_rule
    
    # 2. Match axle_index exactly, but generic axle_config (None)
    index_only = next((r for r in origin_rules if r.axle_index == axle_index and r.axle_config is None and r.axle_index is not None), None)
    if index_only: return index_only
    
    # 3. Match axle_config exactly, but generic axle_index (None)
    config_only = next((r for r in origin_rules if r.axle_config == axle_config and r.axle_index is None and r.axle_config is not None), None)
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
    
    # Assume LTE for all MVP ODOL rules right now
    strictest_rule, other_rule = _find_stricter_rule(central_rule, client_rule, "LTE")
    
    if strictest_rule and actual_value > strictest_rule.threshold:
        excess = actual_value - strictest_rule.threshold
        
        # Build directive
        subject = ""
        if dimension == "GROSS_WEIGHT":
            subject = "total load"
        elif dimension == "AXLE_LOAD":
            if axle_index is not None:
                if axle_index > 0 and axle_index == total_axles - 1:
                    subject = "rear axle load"
                else:
                    subject = f"axle {axle_index + 1} load"
            else:
                subject = "axle load"
        elif dimension in DIMENSION_NAMES:
            subject = f"load {DIMENSION_NAMES[dimension]}"
            
        directive = f"Reduce {subject} by {_format_number(excess)} {unit}"
        
        # Contract: If client is stricter, contrast with legal limit
        if strictest_rule.rule_pack.origin == "CLIENT" and other_rule and other_rule.rule_pack.origin == "CENTRAL":
            directive += f" \u2014 client policy is stricter than the legal limit of {_format_number(other_rule.threshold)} {unit}"

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

def evaluate_payload(payload: Dict[str, Any], active_rules: List[Any]) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Evaluates the vehicle payload against active rules.
    Returns (outcome, violations).
    """
    violations = []
    
    vehicle = payload.get("vehicle", {})
    axle_config = vehicle.get("axle_config")
    
    load = payload.get("load", {})
    
    # 1. Gross Weight
    gross = load.get("gross_weight_kg")
    if gross is not None:
        v = _evaluate_dimension("GROSS_WEIGHT", gross, active_rules, "kg", axle_config=axle_config)
        if v: violations.append(v)
        
    # 2. Axle Loads
    axle_loads = load.get("axle_loads_kg", [])
    total_axles = len(axle_loads)
    for idx, load_val in enumerate(axle_loads):
        v = _evaluate_dimension("AXLE_LOAD", load_val, active_rules, "kg", axle_index=idx, total_axles=total_axles, axle_config=axle_config)
        if v: 
            violations.append(v)
            
    # 3. Dimensions
    dims = load.get("dimensions_mm", {})
    for dim_key, dim_enum in DIMENSION_NAMES.items():
        val = dims.get(dim_enum)
        if val is not None:
            v = _evaluate_dimension(dim_key, val, active_rules, "mm", axle_config=axle_config)
            if v: violations.append(v)
            
    outcome = "HOLD" if violations else "PASS"
    return outcome, violations
