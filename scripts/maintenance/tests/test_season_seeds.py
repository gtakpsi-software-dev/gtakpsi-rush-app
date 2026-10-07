import io
import json
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.season_setup.seeds import seed_data


SEED_DIRECTORY = Path(__file__).resolve().parents[3] / "data" / "season_seed"


class SeedReplayTests(unittest.TestCase):
    def test_replay_keeps_file_order_all_records_and_distinct_errors(self):
        seed_files = {
            "pis_timeslots.json": [{"time": "slot-one"}, {"time": "slot-two"}],
            "rush_nights.json": [{"name": "Night One"}, {"name": "Night Two"}],
            "pis_questions.json": [{"question": "One?"}, {"question": "Two?"}],
        }
        opened = []
        progress_labels = []
        requests = []

        class NetworkError(Exception):
            pass

        class Response:
            def __init__(self, status_code, body):
                self.status_code = status_code
                self.body = body
                self.json_calls = 0

            def json(self):
                self.json_calls += 1
                return self.body

        responses = [
            Response(200, {"status": "success"}),
            Response(503, {}),
            Response(200, {"status": "error", "message": "invalid night"}),
            Response(200, {"status": "success"}),
            NetworkError("offline"),
            Response(200, {"status": "success"}),
        ]

        def fake_open(name, mode):
            self.assertEqual(mode, "r")
            self.assertEqual(name.parent, SEED_DIRECTORY)
            opened.append(name)
            return io.StringIO(json.dumps(seed_files[name.name]))

        def post(url, *, json, headers):
            requests.append((url, json, headers))
            result = responses[len(requests) - 1]
            if isinstance(result, Exception):
                raise result
            return result

        def progress(values, *, desc):
            progress_labels.append(desc)
            return values

        headers = {"X-API-Key": "offline-key"}
        with patch("builtins.open", fake_open):
            errors = seed_data("https://api.example.test", headers, post, NetworkError, progress)

        self.assertEqual(opened, [SEED_DIRECTORY / name for name in seed_files])
        self.assertEqual(progress_labels, [
            "Adding PIS Timeslots", "Adding Rush Nights", "Adding PIS Questions",
        ])
        self.assertEqual(requests, [
            ("https://api.example.test/admin/add_pis_timeslot", item, headers)
            for item in seed_files["pis_timeslots.json"]
        ] + [
            ("https://api.example.test/admin/add-rush-night", item, headers)
            for item in seed_files["rush_nights.json"]
        ] + [
            ("https://api.example.test/admin/add_pis_question", item, headers)
            for item in seed_files["pis_questions.json"]
        ])
        self.assertEqual(errors, [
            "Error adding PIS Timeslot at slot-two: HTTP 503",
            "invalid night",
            "Network error adding PIS Question One?: offline",
        ])
        self.assertEqual(responses[2].json_calls, 2)


if __name__ == "__main__":
    unittest.main()
