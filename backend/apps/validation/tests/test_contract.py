"""Asserts the live API matches /contract fixtures.

These fixtures are also the frontend's mocks. If a key set drifts here, the
frontend's mocks have silently drifted too — which is the failure this suite
exists to catch on day 1 rather than on demo morning.
"""

import json

from django.conf import settings
from django.test import Client, TestCase


def fixture(name):
    with open(settings.CONTRACT_DIR / name) as handle:
        return json.load(handle)


def keys_of(obj):
    return set(obj.keys())


class ValidateContractTests(TestCase):
    def setUp(self):
        self.client = Client()

    def post(self, payload):
        return self.client.post("/api/v1/validate", data=payload, content_type="application/json")

    def test_pass_matches_fixture_shape(self):
        response = self.post(fixture("validate.request.pass.json"))
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["outcome"], "PASS")
        self.assertEqual(body["violations"], [])
        self.assertEqual(keys_of(body), keys_of(fixture("validate.response.pass.json")))

    def test_hold_matches_fixture_shape(self):
        response = self.post(fixture("validate.request.hold.json"))
        self.assertEqual(response.status_code, 403)
        body = response.json()
        self.assertEqual(body["outcome"], "HOLD")
        self.assertEqual(keys_of(body), keys_of(fixture("validate.response.hold.json")))

    def test_hold_violations_match_fixture_shape(self):
        response = self.post(fixture("validate.request.hold.json"))
        body = response.json()
        self.assertTrue(body["violations"], "the HOLD fixture request must produce violations")

        expected_axle = next(
            v for v in fixture("validate.response.hold.json")["violations"] if v["dimension"] == "AXLE_LOAD"
        )
        actual_axle = next(v for v in body["violations"] if v["dimension"] == "AXLE_LOAD")
        self.assertEqual(keys_of(actual_axle), keys_of(expected_axle))

        expected_gross = next(
            v for v in fixture("validate.response.hold.json")["violations"] if v["dimension"] == "GROSS_WEIGHT"
        )
        actual_gross = next(v for v in body["violations"] if v["dimension"] == "GROSS_WEIGHT")
        self.assertEqual(keys_of(actual_gross), keys_of(expected_gross))

    def test_hold_produces_exactly_the_violations_the_fixture_documents(self):
        """Guards against the live API and the frontend mocks disagreeing.

        The mocks return the fixture verbatim. If the engine starts emitting an
        extra violation for the same payload, the two sides have drifted even
        though every individual key still matches.
        """
        response = self.post(fixture("validate.request.hold.json"))
        actual = sorted(v["dimension"] for v in response.json()["violations"])
        expected = sorted(v["dimension"] for v in fixture("validate.response.hold.json")["violations"])
        self.assertEqual(actual, expected)

    def test_directives_match_the_fixture_wording(self):
        response = self.post(fixture("validate.request.hold.json"))
        actual = {v["dimension"]: v["directive"] for v in response.json()["violations"]}
        expected = {
            v["dimension"]: v["directive"] for v in fixture("validate.response.hold.json")["violations"]
        }
        self.assertEqual(actual, expected)

    def test_hold_is_not_wrapped_in_an_error_envelope(self):
        response = self.post(fixture("validate.request.hold.json"))
        self.assertNotIn("error", response.json())

    def test_enums_are_uppercase_and_known(self):
        body = self.post(fixture("validate.request.hold.json")).json()
        allowed_dimensions = {
            "GROSS_WEIGHT",
            "AXLE_LOAD",
            "DIMENSION_LENGTH",
            "DIMENSION_WIDTH",
            "DIMENSION_HEIGHT",
            "AXLE_CONFIG",
        }
        for violation in body["violations"]:
            self.assertIn(violation["dimension"], allowed_dimensions)
            self.assertIn(violation["severity"], {"BLOCKING", "WARNING"})
            self.assertIn(violation["rule_origin"], {"CENTRAL", "CLIENT"})

    def test_axle_index_present_only_for_axle_load(self):
        body = self.post(fixture("validate.request.hold.json")).json()
        for violation in body["violations"]:
            if violation["dimension"] == "AXLE_LOAD":
                self.assertIn("axle_index", violation)
            else:
                self.assertNotIn("axle_index", violation)

    def test_correcting_the_load_flips_hold_to_pass(self):
        """The hero demo loop: HOLD, fix the number, PASS."""
        payload = fixture("validate.request.hold.json")
        self.assertEqual(self.post(payload).status_code, 403)
        payload["load"] = fixture("validate.request.pass.json")["load"]
        self.assertEqual(self.post(payload).status_code, 200)

    def test_invalid_payload_uses_the_error_envelope(self):
        payload = fixture("validate.request.hold.json")
        payload["load"]["axle_loads_kg"] = []
        response = self.post(payload)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(keys_of(response.json()), {"error"})
        self.assertEqual(response.json()["error"]["code"], "VALIDATION_ERROR")
        self.assertEqual(response.json()["error"]["field"], "axle_loads_kg")
