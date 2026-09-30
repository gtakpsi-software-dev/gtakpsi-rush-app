import ast
import os
import runpy
import sys
import types
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "reset_rushees_for_new_rush.py"


def keep_gtids():
    source = ast.parse(SCRIPT.read_text())
    for node in ast.walk(source):
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "KEEP_GTIDS" for target in node.targets
        ):
            return ast.literal_eval(node.value)
    raise AssertionError("KEEP_GTIDS was not found")


class FakeCollection:
    def __init__(self, events, kept):
        self.events = events
        self.kept = kept
        self.counts = iter((31, len(kept)))

    def count_documents(self, query):
        self.events.append(("count", query))
        return next(self.counts)

    def delete_many(self, query):
        self.events.append(("delete", query))
        return types.SimpleNamespace(deleted_count=2)

    def find(self, query, projection):
        self.events.append(("find", query, projection))
        return [{"gtid": gtid} for gtid in self.kept]

    def update_many(self, query, change):
        self.events.append(("update", query, change))
        return types.SimpleNamespace(modified_count=len(self.kept))

    def find_one(self, query):
        self.events.append(("find_one", query))
        return {
            "first_name": "Sample", "last_name": "Rushee",
            "comments": [], "pis": [], "attendance": [], "ratings": [],
            "sorting_status": "UNSORTED",
        }


def run_script(execute=True, mongo_uri="mongodb://offline-test"):
    events = []
    kept = keep_gtids()
    collection = FakeCollection(events, kept)

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
    environment = {"MONGO_URI": mongo_uri} if mongo_uri else {}

    with patch.dict(sys.modules, {"pymongo": pymongo, "dotenv": dotenv}):
        with patch.dict(os.environ, environment, clear=True):
            output = StringIO()
            with redirect_stdout(output):
                try:
                    namespace = runpy.run_path(str(SCRIPT), run_name="__main__" if execute else "<run_path>")
                    exit_code = None
                except SystemExit as error:
                    namespace = None
                    exit_code = error.code
    return namespace, events, kept, output.getvalue(), exit_code


class ResetRusheesForNewRushTests(unittest.TestCase):
    def test_import_does_not_connect_or_change_data(self):
        namespace, events, _, output, exit_code = run_script(execute=False)
        self.assertTrue("main" in namespace)
        self.assertEqual(events, [])
        self.assertEqual(output, "")
        self.assertIsNone(exit_code)

    def test_direct_command_keeps_delete_reset_and_summary_order(self):
        _, events, kept, output, exit_code = run_script()
        self.assertIsNone(exit_code)
        self.assertEqual([event[0] for event in events], [
            "dotenv", "connect", "ping", "database", "collection", "count",
            "delete", "count", "find", "update", "find_one", "close",
        ])
        self.assertEqual(events[1], ("connect", "mongodb://offline-test", 10000))
        self.assertEqual(events[6][1]["gtid"].keys(), {"$nin"})
        self.assertEqual(set(events[6][1]["gtid"]["$nin"]), kept)
        self.assertEqual(set(events[9][1]["gtid"]["$in"]), kept)
        reset = events[9][2]["$set"]
        self.assertEqual(reset["sorting_status"], "UNSORTED")
        self.assertEqual(reset["cloud"], "none")
        self.assertEqual(reset["comments"], [])
        self.assertIn("Deleted 2 rushees not in keep list", output)
        self.assertIn("Database is ready for the new rush cycle", output)

    def test_missing_uri_exits_before_connecting(self):
        _, events, _, output, exit_code = run_script(mongo_uri=None)
        self.assertEqual(exit_code, 1)
        self.assertEqual([event[0] for event in events], ["dotenv"])
        self.assertIn("MONGO_URI not set", output)


if __name__ == "__main__":
    unittest.main()
