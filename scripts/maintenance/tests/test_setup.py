import datetime as datetime_module
import io
import json
import os
import runpy
import sys
import types
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[3] / "scripts/season_setup/__main__.py"
SEED_DIRECTORY = Path(__file__).resolve().parents[3] / "data" / "season_seed"
SEED_DATA = {
    "pis_timeslots.json": [{"time": "slot-one"}],
    "rush_nights.json": [{"name": "Night One"}],
    "pis_questions.json": [{"question": "Question One"}],
}
REAL_DATETIME = datetime_module.datetime


def run_setup(*, execute=True, month=9, day=30, post_outcomes=None, env_overrides=None,
              storage_error=False):
    events = []
    post_outcomes = {} if post_outcomes is None else post_outcomes

    class FixedDatetime(REAL_DATETIME):
        @classmethod
        def now(cls):
            return cls(2026, month, day)

    class FakeCollection:
        def __init__(self, name):
            self.name = name

        def delete_many(self, query):
            events.append(("delete", self.name, query))

    class FakeDatabase:
        def __getitem__(self, name):
            return FakeCollection(name)

    class FakeClient:
        def __getitem__(self, name):
            events.append(("database", name))
            return FakeDatabase()

    class FakeBlob:
        def delete(self):
            events.append(("delete_blob",))

    class FakeBucket:
        def list_blobs(self, *, prefix):
            events.append(("list_blobs", prefix))
            if storage_error:
                raise RuntimeError("offline storage")
            return [FakeBlob()]

    class FakeResponse:
        def __init__(self, body, status_code=200):
            self.body = body
            self.status_code = status_code

        def json(self):
            return self.body

    class FakeRequestException(Exception):
        pass

    def fake_post(url, *, json, headers=None):
        events.append(("post", url, json, headers))
        outcome = post_outcomes.get(url)
        if outcome:
            kind, value = outcome
            if kind == "network":
                raise FakeRequestException(value)
            if kind == "http":
                return FakeResponse({}, status_code=value)
            if kind == "api":
                return FakeResponse({"status": "error", "message": value})
        if "signInWithCustomToken" in url:
            return FakeResponse({"idToken": "offline-id-token"})
        return FakeResponse({"status": "success"})

    pymongo = types.ModuleType("pymongo")
    pymongo.MongoClient = lambda uri: events.append(("connect", uri)) or FakeClient()
    dotenv = types.ModuleType("dotenv")
    dotenv.load_dotenv = lambda: events.append(("dotenv",))
    tqdm = types.ModuleType("tqdm")
    tqdm.tqdm = lambda values, *, desc: events.append(("progress", desc)) or values
    requests = types.ModuleType("requests")
    requests.post = fake_post
    requests.exceptions = types.SimpleNamespace(RequestException=FakeRequestException)

    firebase_admin = types.ModuleType("firebase_admin")
    firebase_admin._apps = []
    firebase_admin.initialize_app = lambda credential, options: events.append(("firebase", credential, options))
    credentials = types.ModuleType("firebase_admin.credentials")
    credentials.Certificate = lambda path: events.append(("certificate", path)) or "offline-credential"
    storage = types.ModuleType("firebase_admin.storage")
    storage.bucket = lambda: events.append(("bucket",)) or FakeBucket()
    firebase_auth = types.ModuleType("firebase_admin.auth")
    firebase_auth.create_custom_token = lambda uid: events.append(("token", uid)) or b"custom-token"
    firebase_admin.credentials = credentials
    firebase_admin.storage = storage
    firebase_admin.auth = firebase_auth

    modules = {
        "pymongo": pymongo,
        "dotenv": dotenv,
        "tqdm": tqdm,
        "requests": requests,
        "firebase_admin": firebase_admin,
        "firebase_admin.credentials": credentials,
        "firebase_admin.storage": storage,
        "firebase_admin.auth": firebase_auth,
    }
    environment = {
        "MONGO_URI": "mongodb://offline-test",
        "API": "https://api.example.test",
        "FIREBASE_CREDENTIALS_PATH": "/tmp/offline-credential.json",
        "FIREBASE_STORAGE_BUCKET": "offline-bucket",
        "FIREBASE_API_KEY": "offline-api-key",
        "ADMIN_UID": "offline-admin",
        "API_KEY": "offline-server-key",
    }
    environment.update({} if env_overrides is None else env_overrides)
    real_open = open

    def fake_open(path, *args, **kwargs):
        if isinstance(path, Path) and path.parent == SEED_DIRECTORY and path.name in SEED_DATA:
            events.append(("open", str(path)))
            return io.StringIO(json.dumps(SEED_DATA[path.name]))
        return real_open(path, *args, **kwargs)

    output = io.StringIO()
    with patch.dict(sys.modules, modules), patch.dict(os.environ, environment, clear=True):
        with patch.object(datetime_module, "datetime", FixedDatetime), patch("builtins.open", fake_open):
            with redirect_stdout(output):
                try:
                    namespace = runpy.run_path(str(SCRIPT), run_name="__main__" if execute else "<run_path>")
                except SystemExit:
                    namespace = None

    return namespace, events, output.getvalue()


class SetupTests(unittest.TestCase):
    def test_direct_command_keeps_reset_then_seed_order_and_requests(self):
        _, events, output = run_setup()
        operations = [event[0] for event in events]

        self.assertEqual(operations[:5], ["dotenv", "certificate", "firebase", "token", "post"])
        self.assertEqual([event[1] for event in events if event[0] == "delete"],
                         ["rushees", "rush-nights", "pis-timeslots", "pis-questions"])
        self.assertLess(operations.index("delete"), operations.index("list_blobs"))
        self.assertLess(operations.index("delete_blob"), operations.index("open"))
        self.assertIn(("list_blobs", "profile-pictures/"), events)
        self.assertEqual([event[1] for event in events if event[0] == "open"],
                         [str(SEED_DIRECTORY / name) for name in SEED_DATA])
        self.assertEqual([event[1] for event in events if event[0] == "progress"],
                         ["Adding PIS Timeslots", "Adding Rush Nights", "Adding PIS Questions"])
        seed_posts = [event for event in events if event[0] == "post"][1:]
        self.assertEqual([event[1] for event in seed_posts], [
            "https://api.example.test/admin/add_pis_timeslot",
            "https://api.example.test/admin/add-rush-night",
            "https://api.example.test/admin/add_pis_question",
        ])
        self.assertEqual([event[2] for event in seed_posts], [
            SEED_DATA["pis_timeslots.json"][0],
            SEED_DATA["rush_nights.json"][0],
            SEED_DATA["pis_questions.json"][0],
        ])
        self.assertTrue(all(event[3] == {
            "Authorization": "Bearer offline-id-token",
            "X-API-Key": "offline-server-key",
        } for event in seed_posts))
        self.assertIn("Rush App Set Up Complete!", output)

    def test_restricted_date_exits_before_loading_credentials_or_deleting_data(self):
        _, events, output = run_setup(day=5)
        self.assertEqual(events, [])
        self.assertIn("This script cannot be run between September 1st and September 12th.", output)

    def test_seed_failures_keep_distinct_messages_and_continue_to_later_files(self):
        _, events, output = run_setup(post_outcomes={
            "https://api.example.test/admin/add_pis_timeslot": ("http", 503),
            "https://api.example.test/admin/add-rush-night": ("api", "invalid night"),
            "https://api.example.test/admin/add_pis_question": ("network", "offline"),
        })

        self.assertEqual(len([event for event in events if event[0] == "post"]), 4)
        self.assertIn("Error adding PIS Timeslot at slot-one: HTTP 503", output)
        self.assertIn("invalid night", output)
        self.assertIn("Network error adding PIS Question Question One: offline", output)
        self.assertNotIn("Rush App Set Up Complete!", output)

    def test_missing_firebase_api_key_keeps_seed_requests_without_bearer_header(self):
        _, events, output = run_setup(env_overrides={"FIREBASE_API_KEY": ""})
        self.assertIn("Warning: FIREBASE_API_KEY not set in .env - API requests may fail", output)
        self.assertNotIn("token", [event[0] for event in events])
        seed_posts = [event for event in events if event[0] == "post"]
        self.assertEqual(len(seed_posts), 3)
        self.assertTrue(all(event[3] == {"X-API-Key": "offline-server-key"} for event in seed_posts))

    def test_failed_token_exchange_keeps_seed_requests_without_bearer_header(self):
        token_url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=offline-api-key"
        _, events, output = run_setup(post_outcomes={token_url: ("http", 403)})
        self.assertIn("Failed to get ID token: {}", output)
        seed_posts = [event for event in events if event[0] == "post"][1:]
        self.assertEqual(len(seed_posts), 3)
        self.assertTrue(all(event[3] == {"X-API-Key": "offline-server-key"} for event in seed_posts))

    def test_storage_failure_is_reported_and_seed_requests_continue(self):
        _, events, output = run_setup(storage_error=True)
        self.assertIn("Error while deleting rush app pictures: offline storage", output)
        self.assertNotIn("delete_blob", [event[0] for event in events])
        self.assertEqual(len([event for event in events if event[0] == "post"]), 4)

    def test_import_does_not_contact_services_or_reset_a_season(self):
        namespace, events, output = run_setup(execute=False)
        self.assertIn("main", namespace)
        self.assertEqual(events, [])
        self.assertEqual(output, "")


if __name__ == "__main__":
    unittest.main()
