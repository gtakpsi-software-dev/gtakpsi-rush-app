import builtins
import json
import os
import runpy
import sys
import types
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "import_rushees.py"


class FakeObjectId:
    def __init__(self, value):
        self.value = value

    def __eq__(self, other):
        return isinstance(other, FakeObjectId) and self.value == other.value


class FakeCollection:
    def __init__(self, events):
        self.events = events
        self.inserted = []

    def delete_many(self, query):
        self.events.append(("delete", query))
        return types.SimpleNamespace(deleted_count=1)

    def insert_many(self, documents):
        self.events.append(("insert", documents))
        self.inserted = documents
        return types.SimpleNamespace(inserted_ids=list(range(len(documents))))

    def count_documents(self, query):
        self.events.append(("count", query))
        return len(self.inserted)


class FakeClient:
    def __init__(self, events, collection):
        self.events = events
        self.collection = collection
        self.admin = types.SimpleNamespace(command=self.command)

    def command(self, name):
        self.events.append(("command", name))

    def __getitem__(self, name):
        self.events.append(("database", name))
        return {"rushees": self.collection}

    def close(self):
        self.events.append(("close",))


def run_import_script(execute=True):
    events = []
    collection = FakeCollection(events)
    client = FakeClient(events, collection)
    pymongo = types.ModuleType("pymongo")
    pymongo.MongoClient = lambda uri, serverSelectionTimeoutMS: client
    bson = types.ModuleType("bson")
    bson.ObjectId = FakeObjectId
    dotenv = types.ModuleType("dotenv")
    dotenv.load_dotenv = lambda **kwargs: events.append(("dotenv", kwargs["dotenv_path"]))
    dataset = [
        {"_id": {"$oid": "alpha"}, "first_name": "Ada", "nested": [{"$date": "2026-09-30T12:00:00Z"}]},
        {"first_name": "Bea", "created_at": {"$date": {"$numberLong": "1790773200000"}}},
    ]
    actual_open = builtins.open

    def fake_open(path, *args, **kwargs):
        if str(path).endswith("rush-app.rushees.json"):
            events.append(("open", Path(path).name))
            return StringIO(json.dumps(dataset))
        return actual_open(path, *args, **kwargs)

    with patch.dict(sys.modules, {"pymongo": pymongo, "bson": bson, "dotenv": dotenv}):
        with patch.dict(os.environ, {"MONGO_URI": "mongodb://offline-test"}):
            with patch.object(sys, "path", [str(SCRIPT.parent), *sys.path]):
                with patch("builtins.open", fake_open):
                    output = StringIO()
                    with redirect_stdout(output):
                        namespace = runpy.run_path(str(SCRIPT), run_name="__main__" if execute else "<run_path>")
    return namespace, events, collection, output.getvalue()


class ImportRusheesTests(unittest.TestCase):
    def test_loading_script_does_not_connect_or_delete(self):
        namespace, events, collection, output = run_import_script(execute=False)

        self.assertIn("main", namespace)
        self.assertEqual(events, [])
        self.assertEqual(collection.inserted, [])
        self.assertEqual(output, "")

    def test_direct_command_keeps_operation_order_and_conversions(self):
        _, events, collection, output = run_import_script()

        self.assertEqual([event[0] for event in events], [
            "dotenv", "command", "database", "open", "delete", "insert", "count", "close",
        ])
        self.assertEqual(events[4], ("delete", {}))
        self.assertEqual(events[6], ("count", {}))
        self.assertEqual(collection.inserted[0]["_id"], FakeObjectId("alpha"))
        self.assertEqual(collection.inserted[0]["nested"], [datetime(2026, 9, 30, 12, tzinfo=timezone.utc)])
        self.assertEqual(collection.inserted[1]["created_at"], datetime.fromtimestamp(1790773200, tz=timezone.utc))
        self.assertIn("Found 2 rushees in JSON file", output)
        self.assertIn("Successfully inserted 2 rushees!", output)

    def test_extended_json_conversion_preserves_scalar_and_marker_precedence(self):
        namespace, _, _, _ = run_import_script()
        convert_dates = namespace["convert_dates"]

        self.assertEqual(convert_dates(7), 7)
        self.assertEqual(convert_dates({"$oid": "first", "$date": "2026-09-30T12:00:00Z"}), FakeObjectId("first"))
        self.assertEqual(convert_dates({"nested": [1, {"$date": "2026-09-30T12:00:00Z"}]}), {
            "nested": [1, datetime(2026, 9, 30, 12, tzinfo=timezone.utc)],
        })


if __name__ == "__main__":
    unittest.main()
