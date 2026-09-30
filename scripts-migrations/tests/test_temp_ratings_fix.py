import runpy
import sys
import types
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "temp_ratings_fix.py"
RUSHEES = [
    {
        "gtid": "1",
        "comments": [
            {"ratings": [{"name": "fit", "value": 4}, {"name": "energy", "value": 1}]},
            {"ratings": [{"name": "fit", "value": 2}]},
        ],
    },
    {"gtid": "2", "comments": []},
]


def run_script(execute=True):
    events = []

    class FakeCollection:
        def find(self):
            events.append(("find",))
            return RUSHEES

        def update_one(self, query, change):
            events.append(("update", query, change))

    collection = FakeCollection()

    class FakeClient:
        def __getitem__(self, name):
            events.append(("database" if name == "rush-app" else "collection", name))
            return self if name == "rush-app" else collection

    pymongo = types.ModuleType("pymongo")
    pymongo.MongoClient = lambda uri: events.append(("connect",)) or FakeClient()
    pandas = types.ModuleType("pandas")
    requests = types.ModuleType("requests")
    tqdm = types.ModuleType("tqdm")

    def fake_tqdm(items, desc, total):
        events.append(("progress", desc, total))
        return items

    tqdm.tqdm = fake_tqdm
    modules = {"pymongo": pymongo, "pandas": pandas, "requests": requests, "tqdm": tqdm}

    with patch.dict(sys.modules, modules):
        output = StringIO()
        with redirect_stdout(output):
            namespace = runpy.run_path(str(SCRIPT), run_name="__main__" if execute else "<run_path>")
    return namespace, events, output.getvalue()


class TempRatingsFixTests(unittest.TestCase):
    def test_import_does_not_connect_or_rewrite_ratings(self):
        namespace, events, output = run_script(execute=False)
        self.assertTrue("main" in namespace)
        self.assertEqual(events, [])
        self.assertEqual(output, "")

    def test_direct_command_keeps_mean_ratings_and_update_order(self):
        _, events, output = run_script()
        self.assertEqual([event[0] for event in events], [
            "connect", "database", "collection", "find", "progress", "update", "update",
        ])
        self.assertEqual(events[4], ("progress", "Fixing Ratings", 2))
        self.assertEqual(events[5], ("update", {"gtid": "1"}, {"$set": {
            "ratings": [{"name": "fit", "value": 3}, {"name": "energy", "value": 1}],
        }}))
        self.assertEqual(events[6], ("update", {"gtid": "2"}, {"$set": {"ratings": []}}))
        self.assertIn("Loading...", output)


if __name__ == "__main__":
    unittest.main()
