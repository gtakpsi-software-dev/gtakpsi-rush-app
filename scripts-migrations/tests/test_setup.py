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


SCRIPT = Path(__file__).resolve().parents[2] / "setup.py"
SEED_DATA = {
    "pis_timeslots.json": [{"time": "slot-one"}],
    "rush_nights.json": [{"name": "Night One"}],
    "pis_questions.json": [{"question": "Question One"}],
}
REAL_DATETIME = datetime_module.datetime


def run_setup(*, execute=True, month=9, day=30):
    events = []

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
            return [FakeBlob()]

    class FakeResponse:
        status_code = 200

        def __init__(self, body):
            self.body = body

        def json(self):
            return self.body

    def fake_post(url, *, json, headers=None):
        events.append(("post", url, json, headers))
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
    requests.exceptions = types.SimpleNamespace(RequestException=Exception)

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
    real_open = open

    def fake_open(path, *args, **kwargs):
        if path in SEED_DATA:
            events.append(("open", path))
            return io.StringIO(json.dumps(SEED_DATA[path]))
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
        self.assertEqual([event[1] for event in events if event[0] == "open"],
                         ["pis_timeslots.json", "rush_nights.json", "pis_questions.json"])
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

    def test_import_does_not_contact_services_or_reset_a_season(self):
        namespace, events, output = run_setup(execute=False)
        self.assertIn("main", namespace)
        self.assertEqual(events, [])
        self.assertEqual(output, "")


if __name__ == "__main__":
    unittest.main()
