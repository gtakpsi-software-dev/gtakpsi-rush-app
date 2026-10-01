import os
import runpy
import sys
import types
import unittest
from contextlib import redirect_stdout
from datetime import datetime
from io import StringIO
from pathlib import Path
from unittest.mock import MagicMock, patch


SCRIPTS = Path(__file__).resolve().parents[1]


class RemainingMongoScriptTests(unittest.TestCase):
    def setUp(self):
        path_patch = patch.object(sys, "path", [str(SCRIPTS), *sys.path])
        path_patch.start()
        self.addCleanup(path_patch.stop)

    def test_pis_export_imports_without_connecting_and_keeps_projection_and_columns(self):
        events = []
        pymongo = types.ModuleType("pymongo")
        pymongo.MongoClient = lambda uri: events.append(("connect", uri))
        pandas = types.ModuleType("pandas")

        class FakeFrame:
            def to_excel(self, path, index):
                events.append(("excel", path, index))

        def fake_frame(rows):
            events.append(("frame", rows))
            return FakeFrame()

        pandas.DataFrame = fake_frame
        with patch.dict(sys.modules, {"pymongo": pymongo, "pandas": pandas}):
            namespace = runpy.run_path(str(SCRIPTS / "pis_excel_sheet.py"))
        self.assertEqual(events, [])

        collection = MagicMock()
        collection.aggregate.return_value = [
            {"pis_signup": {
                "rushee_first_name": "Ada", "rushee_last_name": "Example",
                "rushee_gtid": "1", "time": datetime(2026, 9, 30, 12, 30),
                "first_brother_first_name": "Grace",
            }},
            {"pis_signup": None},
        ]
        data = namespace["fetch_pis_signups"](collection)
        collection.aggregate.assert_called_once()
        self.assertEqual(collection.aggregate.call_args.args[0][0]["$project"]["pis_signup"]["time"], 1)
        with redirect_stdout(StringIO()):
            namespace["create_excel"](data)

        self.assertEqual(events[0][0], "frame")
        self.assertEqual(events[0][1], [{
            "Rushee First Name": "Ada", "Rushee Last Name": "Example", "Rushee GTID": "1",
            "PIS Time": "2026-09-30 12:30:00", "First Brother First Name": "Grace",
            "First Brother Last Name": "", "Second Brother First Name": "",
            "Second Brother Last Name": "",
        }])
        self.assertEqual(events[1], ("excel", "PIS_Signups.xlsx", False))

    def test_night_one_migration_keeps_lookup_update_and_count_output(self):
        events = []
        nights = MagicMock()
        nights.find_one.return_value = {"name": "Night 1", "time": "tomorrow"}
        rushees = MagicMock()
        rushees.update_many.return_value = types.SimpleNamespace(matched_count=3, modified_count=2)
        database = {"rush-nights": nights, "rushees": rushees}

        class FakeClient:
            def __getitem__(self, name):
                events.append(("database", name))
                return database

        pymongo = types.ModuleType("pymongo")
        pymongo.MongoClient = lambda uri: events.append(("connect", uri)) or FakeClient()
        with patch.dict(sys.modules, {"pymongo": pymongo}), \
             patch.dict(os.environ, {"MIGRATE_ATTENDANCE_NIGHT1_MONGO_URI": "mongodb://offline-test"}, clear=True):
            namespace = runpy.run_path(str(SCRIPTS / "migrate_attendance_night1.py"))
            self.assertEqual(events, [])
            output = StringIO()
            with redirect_stdout(output):
                namespace["main"]()

        self.assertEqual(events, [("connect", "mongodb://offline-test"), ("database", "rush-app")])
        nights.find_one.assert_called_once_with({"name": "Night 1"})
        rushees.update_many.assert_called_once_with(
            {"attendance.0": {"$exists": True}},
            {"$set": {"attendance": [{"name": "Night 1", "time": "tomorrow"}]}},
        )
        self.assertIn("Matched rushees: 3", output.getvalue())
        self.assertIn("Modified rushees: 2", output.getvalue())


if __name__ == "__main__":
    unittest.main()
