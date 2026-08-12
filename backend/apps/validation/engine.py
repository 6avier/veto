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

def evaluate_payload(payload: Dict[str, Any], active_rules: List[Any]) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Evaluates the vehicle payload against active rules.
    Returns (outcome, violations).
    """
    violations = []
    
    vehicle = payload.get("vehicle", {})
    axle_config = vehicle.get("axle_config")
    
    load = payload.get("load", {})
    
    # 1. Gross Weight vs Axle Sum Integrity Check
    axle_loads = load.get("axle_loads_kg", [])
    gross = load.get("gross_weight_kg")
    
    if gross is not None and axle_loads:
        axle_sum = sum(axle_loads)
        if abs(axle_sum - gross) > 500:
            violations.append({
                "dimension": "GROSS_WEIGHT",
                "actual_value": gross,
                "limit_value": axle_sum,
                "excess_value": abs(axle_sum - gross),
                "unit": "kg",
                "severity": "BLOCKING",
                "rule_origin": "CENTRAL",
                "legal_citation": "Integritas Data Sumbu vs Total",
                "directive": f"Total sumbu ({_format_number(axle_sum)} kg) tidak sesuai dengan berat kotor ({_format_number(gross)} kg). Selisih {_format_number(abs(axle_sum - gross))} kg. Perbaiki data masukan."
            })

    # 1b. Gross Weight Rule Evaluation
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
    dims = load.get("dimensions_mm", {})
    for dim_key, dim_enum in DIMENSION_NAMES.items():
        val = dims.get(dim_enum)
        if val is not None:
            v = _evaluate_dimension(dim_key, val, active_rules, "mm", axle_config=axle_config)
            if v: violations.append(v)
            
    # 4. Smart Directives (Konsultan Muatan Cerdas)
    _apply_smart_recommendations(violations, load, active_rules, axle_config)
            
    outcome = "HOLD" if violations else "PASS"
    return outcome, violations

def _apply_smart_recommendations(violations: List[Dict[str, Any]], load: Dict[str, Any], active_rules: List[Any], axle_config: Optional[str]) -> None:
    gross_violation = next((v for v in violations if v["dimension"] == "GROSS_WEIGHT" and v.get("legal_citation") != "Integritas Data Sumbu vs Total"), None)
    axle_violations = [v for v in violations if v["dimension"] == "AXLE_LOAD"]
    
    if not axle_violations and not gross_violation:
        return
        
    axle_loads = load.get("axle_loads_kg", [])
    if not axle_loads:
        return
        
    # Pre-calculate limits and headroom for all axles
    axle_stats = []
    total_axle_limit = 0
    for idx, actual in enumerate(axle_loads):
        dim_rules = [r for r in active_rules if r.dimension == "AXLE_LOAD"]
        central_rule = _get_applicable_rule(dim_rules, "CENTRAL", idx, axle_config)
        client_rule = _get_applicable_rule(dim_rules, "CLIENT", idx, axle_config)
        
        # operator logic is simplified since AXLE_LOAD is always LTE
        limit = 10000 # fallback
        if client_rule and central_rule:
            limit = min(client_rule.threshold, central_rule.threshold)
        elif client_rule: limit = client_rule.threshold
        elif central_rule: limit = central_rule.threshold
            
        headroom = max(0, limit - actual)
        excess = max(0, actual - limit)
        axle_stats.append({
            "index": idx,
            "actual": actual,
            "limit": limit,
            "headroom": headroom,
            "excess": excess
        })
        total_axle_limit += limit

    # Case 1: Overloaded Gross Weight (Must reduce cargo)
    if gross_violation:
        excess_gross = gross_violation["excess_value"]
        if total_axle_limit > 0:
            recommendation_parts = []
            for stat in axle_stats:
                ratio = stat["limit"] / total_axle_limit
                suggested_reduction = int(round(excess_gross * ratio))
                subject = _axle_subject(stat["index"], len(axle_loads)).replace("beban ", "")
                recommendation_parts.append(f"{_format_number(suggested_reduction)} kg dari {subject}")
            
            if recommendation_parts:
                suggestion = " Saran proporsional: Turunkan " + ", dan ".join(recommendation_parts) + " agar keseimbangan terjaga."
                gross_violation["directive"] += suggestion
                
    # Case 2: No Gross Violation, but Axle Violation (Can shift cargo)
    elif axle_violations:
        total_headroom = sum(s["headroom"] for s in axle_stats)
        total_excess = sum(s["excess"] for s in axle_stats)
        
        if total_headroom >= total_excess and total_excess > 0:
            # We can shift!
            overloaded = [s for s in axle_stats if s["excess"] > 0]
            underloaded = [s for s in axle_stats if s["headroom"] > 0]
            
            for v in axle_violations:
                idx = v.get("axle_index")
                if idx is not None:
                    # Find a recipient
                    recipient = underloaded[0] if underloaded else None
                    if recipient:
                        v["directive"] += f" Saran: Geser muatan {_format_number(v['excess_value'])} kg ke {_axle_subject(recipient['index'], len(axle_loads))}. Tidak perlu bongkar muat."

