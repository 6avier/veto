import json
from django.test import TestCase, Client
from apps.rules.models import Rule, RulePack, RuleOrigin, RuleDimension, RuleOperator, RuleStatus

class RuleListTests(TestCase):
    def setUp(self):
        self.client = Client()
        Rule.objects.all().delete()
        RulePack.objects.all().delete()
        self.central_pack = RulePack.objects.create(
            domain="ODOL",
            version=1,
            origin=RuleOrigin.CENTRAL
        )
        self.client_pack = RulePack.objects.create(
            domain="ODOL",
            version=1,
            origin=RuleOrigin.CLIENT
        )
        
        self.r1 = Rule.objects.create(
            rule_pack=self.central_pack,
            dimension=RuleDimension.AXLE_LOAD,
            operator=RuleOperator.LTE,
            threshold=16100,
            unit="kg",
            axle_config=["1.2"],
            axle_index=1,
            legal_citation="PM 111/2015",
            status=RuleStatus.ACTIVE
        )
        self.r2 = Rule.objects.create(
            rule_pack=self.client_pack,
            dimension=RuleDimension.GROSS_WEIGHT,
            operator=RuleOperator.LTE,
            threshold=24000,
            unit="kg",
            axle_config=None,
            axle_index=None,
            legal_citation="SOP 1",
            status=RuleStatus.ACTIVE
        )
        self.r3 = Rule.objects.create(
            rule_pack=self.central_pack,
            dimension=RuleDimension.DIMENSION_LENGTH,
            operator=RuleOperator.LTE,
            threshold=12000,
            unit="mm",
            legal_citation="PP 55",
            status=RuleStatus.INACTIVE
        )
        
    def test_list_all_active_by_default(self):
        res = self.client.get("/api/v1/rules")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total"], 2)
        
    def test_list_filter_origin(self):
        res = self.client.get("/api/v1/rules?origin=CENTRAL")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["results"][0]["dimension"], "AXLE_LOAD")
        self.assertEqual(data["results"][0]["applies_to"]["axle_config"], ["1.2"])
        self.assertEqual(data["results"][0]["applies_to"]["axle_index"], 1)
        
    def test_list_filter_dimension(self):
        res = self.client.get("/api/v1/rules?dimension=GROSS_WEIGHT")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total"], 1)
        self.assertIsNone(data["results"][0]["applies_to"])
        
    def test_list_filter_status(self):
        res = self.client.get("/api/v1/rules?status=INACTIVE")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["results"][0]["dimension"], "DIMENSION_LENGTH")
