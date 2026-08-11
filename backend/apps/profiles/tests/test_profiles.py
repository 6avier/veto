import json
from django.test import TestCase, Client
from apps.profiles.models import VehicleProfile

class VehicleProfileTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.p1 = VehicleProfile.objects.create(
            name="Tronton 6x2",
            axle_config="1.22",
            tare_weight_kg=8500,
            max_length_mm=12000,
            max_width_mm=2500,
            max_height_mm=4200
        )
        
    def test_list_profiles(self):
        res = self.client.get("/api/v1/vehicle-profiles")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["results"][0]["name"], "Tronton 6x2")
        self.assertEqual(data["results"][0]["axle_count"], 3)
        self.assertEqual(data["results"][0]["max_dimensions_mm"]["length"], 12000)
        
    def test_create_profile(self):
        payload = {
            "name": "Engkel 4 Roda",
            "axle_config": "1.1",
            "tare_weight_kg": 3000,
            "max_dimensions_mm": {
                "length": 6000,
                "width": 2100,
                "height": 3000
            }
        }
        res = self.client.post("/api/v1/vehicle-profiles", json.dumps(payload), content_type="application/json")
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["name"], "Engkel 4 Roda")
        self.assertEqual(data["axle_count"], 2)
        self.assertEqual(VehicleProfile.objects.count(), 2)
        
    def test_create_profile_validation(self):
        payload = {
            "name": "Invalid Profile",
            # missing axle_config
            "tare_weight_kg": 3000,
            "max_dimensions_mm": {"length": 6000}
        }
        res = self.client.post("/api/v1/vehicle-profiles", json.dumps(payload), content_type="application/json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["error"]["field"], "axle_config")
        
    def test_update_profile(self):
        payload = {
            "tare_weight_kg": 9000,
            "max_dimensions_mm": {
                "height": 4500
            }
        }
        res = self.client.patch(f"/api/v1/vehicle-profiles/{self.p1.profile_id}", json.dumps(payload), content_type="application/json")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["tare_weight_kg"], 9000)
        self.assertEqual(data["max_dimensions_mm"]["height"], 4500)
        self.assertEqual(data["max_dimensions_mm"]["length"], 12000) # unchanged
        
    def test_delete_profile(self):
        res = self.client.delete(f"/api/v1/vehicle-profiles/{self.p1.profile_id}")
        self.assertEqual(res.status_code, 204)
        self.assertEqual(VehicleProfile.objects.count(), 0)
