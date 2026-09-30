import os
import runpy
import sys
import types
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "delete_test_data.py"


class FakeCollection:
    def __init__(self, events, name, documents):
        self.events = events
        self.name = name
        self.documents = documents

    def find(self, query, projection=None):
        self.events.append(("find", self.name, query, projection))
        return self.documents

    def delete_many(self, query):
        self.events.append(("delete", self.name, query))
        return types.SimpleNamespace(deleted_count=len(self.documents))

    def count_documents(self, query):
        self.events.append(("count", self.name, query))
        return len(self.documents)


class FakeClient:
    def __init__(self, events, rushees, nights):
        self.events = events
        self.collections = {"rushees": rushees, "rush-nights": nights}
        self.admin = types.SimpleNamespace(command=self.command)

    def command(self, name):
        self.events.append(("command", name))

    def __getitem__(self, name):
        self.events.append(("database", name))
        return self.collections

    def close(self):
        self.events.append(("close",))


def run_cleanup(apply, execute=True):
    events = []
    rushees = FakeCollection(events, "rushees", [{"gtid": "904093480", "first_name": "Test", "last_name": "Rushee"}])
    nights = FakeCollection(events, "rush-nights", [{"name": "Night 1", "time": "today"}])
    client = FakeClient(events, rushees, nights)
    pymongo = types.ModuleType("pymongo")

    def mongo_client(uri, serverSelectionTimeoutMS):
        events.append(("connect", uri, serverSelectionTimeoutMS))
        return client

    pymongo.MongoClient = mongo_client
    args = [str(SCRIPT)] + (["--apply"] if apply else [])
    output = StringIO()
    with patch.dict(sys.modules, {"pymongo": pymongo}):
        with patch.dict(os.environ, {"MONGO_URI": "mongodb://offline-test"}):
            with patch.object(sys, "argv", args):
                with redirect_stdout(output):
                    try:
                        namespace = runpy.run_path(str(SCRIPT), run_name="__main__" if execute else "<run_path>")
                        exit_code = None
                    except SystemExit as error:
                        namespace = None
                        exit_code = error.code
    return namespace, events, output.getvalue(), exit_code


class DeleteTestDataTests(unittest.TestCase):
    def test_loading_script_does_not_connect_or_delete(self):
        namespace, events, output, exit_code = run_cleanup(apply=True, execute=False)

        self.assertIn("main", namespace)
        self.assertEqual(events, [])
        self.assertEqual(output, "")
        self.assertIsNone(exit_code)

    def test_default_mode_lists_targets_without_deleting(self):
        _, events, output, exit_code = run_cleanup(apply=False)

        self.assertEqual(exit_code, 0)
        self.assertIn("Mode: DRY RUN (no changes will be made)", output)
        self.assertIn("Rushees matched for deletion (1 of 5 GTIDs)", output)
        self.assertIn("Rush-nights documents to delete (1 total)", output)
        self.assertEqual([event[0] for event in events], ["connect", "command", "database", "find", "find", "close"])
        self.assertEqual(events[0], ("connect", "mongodb://offline-test", 10000))

    def test_apply_mode_preserves_deletion_queries_and_order(self):
        _, events, output, exit_code = run_cleanup(apply=True)

        self.assertIsNone(exit_code)
        self.assertIn("Mode: APPLY", output)
        self.assertIn("Deleted 1 rushees", output)
        self.assertIn("Deleted 1 rush-nights documents", output)
        self.assertEqual([event[0] for event in events], [
            "connect", "command", "database", "find", "find", "delete", "delete", "count", "count", "close",
        ])
        self.assertEqual(events[5][1], "rushees")
        self.assertEqual(events[5][2]["gtid"].keys(), {"$in"})
        self.assertEqual(len(events[5][2]["gtid"]["$in"]), 5)
        self.assertEqual(events[6], ("delete", "rush-nights", {}))


if __name__ == "__main__":
    unittest.main()
