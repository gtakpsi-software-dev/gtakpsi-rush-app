import hashlib
import json
import os
import runpy
import sys
import types
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "update_pledge_headshots.py"


def run_script(execute=True, firebase_initialized=False, rushee_exists=True, image_error=False):
    events = []
    collection = types.SimpleNamespace(
        find_one=lambda query: events.append(("find", query)) or (
            {"first_name": "A", "last_name": "B"} if rushee_exists else None
        ),
        update_one=lambda query, change: events.append(("update", query, change)),
    )

    class FakeClient:
        admin = types.SimpleNamespace(command=lambda name: events.append(("ping", name)))

        def __getitem__(self, name):
            events.append(("database" if name == "rush-app" else "collection", name))
            return self if name == "rush-app" else collection

        def close(self):
            events.append(("close",))

    client = FakeClient()
    pymongo = types.ModuleType("pymongo")
    pymongo.MongoClient = lambda uri, serverSelectionTimeoutMS: events.append(("connect", uri, serverSelectionTimeoutMS)) or client
    dotenv = types.ModuleType("dotenv")
    dotenv.load_dotenv = lambda **kwargs: events.append(("dotenv", kwargs["dotenv_path"]))

    class FakeImage:
        def convert(self, mode):
            events.append(("convert", mode))
            return self

        def thumbnail(self, size, method):
            events.append(("thumbnail", size, method))

        def save(self, buffer, format, quality, optimize):
            events.append(("save", format, quality, optimize))
            if image_error:
                raise OSError("invalid image")
            buffer.write(b"jpeg-data")

    image = FakeImage()
    pil = types.ModuleType("PIL")
    pil.Image = types.SimpleNamespace(open=lambda path: events.append(("open", Path(path).name)) or image, LANCZOS=1)
    pil.ImageOps = types.SimpleNamespace(exif_transpose=lambda value: events.append(("transpose",)) or value)

    class FakeBlob:
        public_url = "https://example.test/headshot.jpg"

        def upload_from_file(self, buffer, content_type):
            events.append(("upload", buffer.read(), content_type))

        def make_public(self):
            events.append(("public",))

    class FakeBucket:
        def blob(self, name):
            events.append(("blob", name))
            return FakeBlob()

    credentials = types.ModuleType("firebase_admin.credentials")
    credentials.Certificate = lambda path: events.append(("certificate", path)) or "credential"
    storage = types.ModuleType("firebase_admin.storage")
    storage.bucket = lambda: events.append(("bucket",)) or FakeBucket()
    firebase_admin = types.ModuleType("firebase_admin")
    firebase_admin._apps = [object()] if firebase_initialized else []
    firebase_admin.credentials = credentials
    firebase_admin.storage = storage
    firebase_admin.initialize_app = lambda cred, options: events.append(("firebase", cred, options))

    modules = {
        "pymongo": pymongo,
        "dotenv": dotenv,
        "firebase_admin": firebase_admin,
        "firebase_admin.credentials": credentials,
        "firebase_admin.storage": storage,
        "PIL": pil,
    }
    environment = {
        "MONGO_URI": "mongodb://offline-test",
        "FIREBASE_CREDENTIALS_PATH": "/tmp/offline-service-account.json",
        "FIREBASE_STORAGE_BUCKET": "offline-bucket",
    }
    actual_listdir = os.listdir
    actual_getsize = os.path.getsize

    def fake_listdir(path):
        if str(path).endswith("Pledge Headshots"):
            events.append(("listdir", Path(path).name))
            return ["unknown.jpeg", "aarav-sardana.jpeg", "notes.txt"]
        return actual_listdir(path)

    def fake_getsize(path):
        if str(path).endswith("aarav-sardana.jpeg"):
            events.append(("getsize", Path(path).name))
            return 1024
        return actual_getsize(path)

    with patch.dict(sys.modules, modules), patch.object(sys, "path", [str(SCRIPT.parent), *sys.path]):
        with patch.dict(os.environ, environment, clear=True):
            with patch("os.listdir", fake_listdir), patch("os.path.getsize", fake_getsize):
                with patch("time.time", return_value=1000):
                    output = StringIO()
                    with redirect_stdout(output):
                        namespace = runpy.run_path(str(SCRIPT), run_name="__main__" if execute else "<run_path>")
    return namespace, events, output.getvalue()


class UpdatePledgeHeadshotsTests(unittest.TestCase):
    def test_filename_identity_map_keeps_all_existing_gtids(self):
        namespace, events, _ = run_script(execute=False)
        mapping = namespace["FILENAME_TO_GTID"]
        encoded = json.dumps(mapping, sort_keys=True, separators=(",", ":")).encode()

        self.assertEqual(len(mapping), 29)
        self.assertEqual(
            hashlib.sha256(encoded).hexdigest(),
            "ae4e128e3b79979e038af3f0aba07fb1b9b50c2e4a86021847ebb57aa23f2019",
        )
        self.assertEqual(events, [])

    def test_import_does_not_initialize_services_or_upload(self):
        namespace, events, output = run_script(execute=False)
        self.assertIn("main", namespace)
        self.assertEqual(events, [])
        self.assertEqual(output, "")

    def test_direct_command_preserves_upload_and_database_update_order(self):
        _, events, output = run_script()
        names = [event[0] for event in events]
        self.assertLess(names.index("dotenv"), names.index("certificate"))
        self.assertLess(names.index("firebase"), names.index("connect"))
        self.assertLess(names.index("ping"), names.index("listdir"))
        self.assertLess(names.index("transpose"), names.index("convert"))
        self.assertLess(names.index("save"), names.index("upload"))
        self.assertLess(names.index("upload"), names.index("public"))
        self.assertLess(names.index("public"), names.index("update"))
        self.assertEqual(names[-1], "close")
        self.assertEqual(next(event for event in events if event[0] == "upload"),
                         ("upload", b"jpeg-data", "image/jpeg"))
        self.assertEqual(next(event for event in events if event[0] == "update")[2],
                         {"$set": {"image_url": "https://example.test/headshot.jpg"}})
        self.assertIn("Updated: 1 rushees", output)
        self.assertIn("No GTID mapping for: unknown.jpeg", output)

    def test_upload_path_uses_mapped_gtid_and_millisecond_timestamp(self):
        _, events, _ = run_script()
        self.assertIn(
            ("blob", "profile-pictures/904093762_1000000.jpg"), events,
        )

    def test_existing_firebase_app_is_reused(self):
        _, events, _ = run_script(firebase_initialized=True)
        names = [event[0] for event in events]
        self.assertNotIn("certificate", names)
        self.assertNotIn("firebase", names)
        self.assertIn("bucket", names)

    def test_missing_rushee_skips_upload_and_reports_error(self):
        _, events, output = run_script(rushee_exists=False)
        names = [event[0] for event in events]
        self.assertNotIn("open", names)
        self.assertNotIn("upload", names)
        self.assertNotIn("update", names)
        self.assertEqual(names[-1], "close")
        self.assertIn("Rushee not found in DB for GTID 904093762", output)
        self.assertIn("Updated: 0 rushees", output)

    def test_failed_image_processing_skips_upload_and_reports_error(self):
        _, events, output = run_script(image_error=True)
        names = [event[0] for event in events]
        self.assertIn("save", names)
        self.assertNotIn("upload", names)
        self.assertNotIn("update", names)
        self.assertEqual(names[-1], "close")
        self.assertIn("aarav-sardana (904093762): invalid image", output)
        self.assertIn("Updated: 0 rushees", output)


if __name__ == "__main__":
    unittest.main()
