from django.test import TestCase
from apps.rules.models import Rule, RulePack
from apps.validation.engine import _evaluate_dimension

class MockRule:
    def __init__(self, dimension, threshold, operator, origin="CENTRAL"):
        self.dimension = dimension
        self.threshold = threshold
        self.operator = operator
        self.axle_index = None
        self.axle_config = None
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
