from django.test import TestCase
from apps.validation.engine import _evaluate_dimension, _matches_axle_config
from apps.validation.fleet_registry import lookup_or_match_fleet

class MockRule:
    def __init__(self, dimension, threshold, operator, origin="CENTRAL", axle_config=None, axle_index=None):
        self.dimension = dimension
        self.threshold = threshold
        self.operator = operator
        self.axle_index = axle_index
        self.axle_config = axle_config
        self.legal_citation = "Mock Rule"
        
        class MockPack:
            def __init__(self, o):
                self.origin = o
        
        self.rule_pack = MockPack(origin)

class EngineOperatorTests(TestCase):
    def test_evaluate_dimension_gte(self):
        # Create a mock rule for minimum weight (GTE)
        rule = MockRule("GROSS_WEIGHT", 10000, "GTE")
        
        # 11,000 is >= 10,000, so it should PASS
        result = _evaluate_dimension("GROSS_WEIGHT", 11000, [rule], "kg")
        self.assertIsNone(result)
        
        # 8,000 is < 10,000, so it should HOLD (violate)
        result = _evaluate_dimension("GROSS_WEIGHT", 8000, [rule], "kg")
        self.assertIsNotNone(result)
        self.assertEqual(result["excess_value"], 2000)

    def test_evaluate_dimension_lte(self):
        rule = MockRule("GROSS_WEIGHT", 25000, "LTE")
        
        result = _evaluate_dimension("GROSS_WEIGHT", 24000, [rule], "kg")
        self.assertIsNone(result)
        
        result = _evaluate_dimension("GROSS_WEIGHT", 26000, [rule], "kg")
        self.assertIsNotNone(result)
        self.assertEqual(result["excess_value"], 1000)
        
    def test_evaluate_dimension_eq(self):
        rule = MockRule("GROSS_WEIGHT", 20000, "EQ")
        
        result = _evaluate_dimension("GROSS_WEIGHT", 20000, [rule], "kg")
        self.assertIsNone(result)
        
        result = _evaluate_dimension("GROSS_WEIGHT", 21000, [rule], "kg")
        self.assertIsNotNone(result)
        self.assertEqual(result["excess_value"], 1000)

    def test_matches_axle_config_helper(self):
        self.assertTrue(_matches_axle_config("1.2", "1.2"))
        self.assertTrue(_matches_axle_config(["1.2", "1.2.2"], "1.2.2"))
        self.assertFalse(_matches_axle_config(["1.2", "1.2.2"], "1.1"))
        self.assertFalse(_matches_axle_config(None, "1.2"))
        self.assertFalse(_matches_axle_config("1.2", None))

    def test_axle_config_list_matching_in_evaluation(self):
        client_rule = MockRule(
            dimension="GROSS_WEIGHT",
            threshold=20000,
            operator="LTE",
            origin="CLIENT",
            axle_config=["1.2", "1.2.2"]
        )
        central_rule = MockRule(
            dimension="GROSS_WEIGHT",
            threshold=24000,
            operator="LTE",
            origin="CENTRAL",
            axle_config=None
        )
        rules = [central_rule, client_rule]

        # Evaluating with axle_config="1.2.2" and 22,000kg:
        # Central allows 24,000kg, but client rule (20,000 max) applies and triggers HOLD
        result = _evaluate_dimension("GROSS_WEIGHT", 22000, rules, "kg", axle_config="1.2.2")
        self.assertIsNotNone(result)
        self.assertEqual(result["rule_origin"], "CLIENT")
        self.assertEqual(result["excess_value"], 2000)

        # Evaluating with axle_config="1.1": client rule does not match, central rule applies (PASS)
        result_pass = _evaluate_dimension("GROSS_WEIGHT", 22000, rules, "kg", axle_config="1.1")
        self.assertIsNone(result_pass)

class FleetRegistryTests(TestCase):
    def test_lookup_no_plate_detected_returns_none_body_type(self):
        res = lookup_or_match_fleet(detected_plate=None, detected_body_type=None)
        self.assertEqual(res["identity_status"], "NO_PLATE_DETECTED")
        self.assertIsNone(res["detected_body_type"])
        self.assertFalse(res["identity_verified"])

    def test_lookup_registered_plate_verifies(self):
        res = lookup_or_match_fleet(detected_plate="B 505 WLG", detected_body_type="BAK_TERPAL")
        self.assertEqual(res["identity_status"], "VERIFIED")
        self.assertTrue(res["identity_verified"])
        self.assertEqual(res["axle_config"], "1.2.2")
