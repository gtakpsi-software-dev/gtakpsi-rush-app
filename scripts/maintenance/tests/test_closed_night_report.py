import os
import runpy
import sys
import types
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import MagicMock, patch


SCRIPTS = Path(__file__).resolve().parents[1]
SCRIPT = SCRIPTS / "closed_night_attendance.py"


class ClosedNightReportTests(unittest.TestCase):
    def run_script(self, rows, execute=False):
        events = []
        collection = MagicMock()
        collection.find.return_value = rows

        class FakeClient:
            def __getitem__(self, name):
                events.append(("lookup", name))
                return self if name == "rush-app" else collection

        pymongo = types.ModuleType("pymongo")
        pymongo.MongoClient = lambda uri: events.append(("connect", uri)) or FakeClient()
        with patch.dict(sys.modules, {"pymongo": pymongo}), \
             patch.dict(os.environ, {"CLOSED_NIGHT_ATTENDANCE_MONGO_URI": "mongodb://offline-test"}, clear=True), \
             patch.object(sys, "path", [str(SCRIPTS), *sys.path]):
            output = StringIO()
            with redirect_stdout(output):
                namespace = runpy.run_path(str(SCRIPT), run_name="__main__" if execute else "<run_path>")
        return namespace, collection, events, output.getvalue()

    def test_import_is_read_only(self):
        namespace, collection, events, output = self.run_script([], execute=False)
        self.assertIn("check_closed_night", namespace)
        collection.find.assert_not_called()
        self.assertEqual(events, [])
        self.assertEqual(output, "")

    def test_command_keeps_projection_first_match_and_status_grouping(self):
        rows = [
            {"first_name": "Zoë", "last_name": "Example", "sorting_status": "SORTED",
             "attendance": [{"name": "Closed Night"}, {"name": "Closed Night Again"}]},
            {"first_name": "Ada", "last_name": "Example", "sorting_status": "SORTED",
             "attendance": [{"name": "closed night"}]},
            {"first_name": "Bea", "last_name": "Example", "attendance": [{"name": "Night 1"}]},
        ]
        _, collection, events, output = self.run_script(rows, execute=True)
        self.assertEqual(events, [
            ("connect", "mongodb://offline-test"), ("lookup", "rush-app"),
            ("lookup", "rushees"),
        ])
        collection.find.assert_called_once_with({}, {
            "first_name": 1, "last_name": 1, "attendance": 1, "sorting_status": 1,
        })
        self.assertIn("Total rushees in database: 3", output)
        self.assertIn("Rushees at Closed Night: 2", output)
        self.assertIn("SORTED (2)", output)
        self.assertLess(output.index("Ada Example"), output.index("Zoë Example"))

    def test_empty_report_keeps_headings_without_status_groups(self):
        _, collection, _, output = self.run_script([], execute=True)
        collection.find.assert_called_once()
        self.assertIn("Rushees at Closed Night: 0", output)
        self.assertNotIn("By Sorting Status:", output)


if __name__ == "__main__":
    unittest.main()
