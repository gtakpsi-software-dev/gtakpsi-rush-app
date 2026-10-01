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
sys.path.insert(0, str(SCRIPTS))


def load_script(name, execute=False, argv=None, collections=None):
    events = []
    client = MagicMock()
    database = client.__getitem__.return_value
    database.__getitem__.side_effect = lambda key: collections[key]
    pymongo = types.ModuleType("pymongo")
    pymongo.MongoClient = lambda uri: events.append(("connect", uri)) or client

    with patch.dict(sys.modules, {"pymongo": pymongo}):
        key = f"{Path(name).stem.upper()}_MONGO_URI"
        with patch.dict(os.environ, {key: "mongodb://offline-test"}, clear=True):
            with patch.object(sys, "argv", argv or [name]):
                output = StringIO()
                with redirect_stdout(output):
                    namespace = runpy.run_path(
                        str(SCRIPTS / name), run_name="__main__" if execute else "<run_path>"
                    )
    return namespace, events, output.getvalue()


class BasicMaintenanceTests(unittest.TestCase):
    def test_imports_do_not_connect_to_mongodb(self):
        for name in ("add_attendance.py", "add_sorting_tag.py", "closed_night_attendance.py"):
            with self.subTest(name=name):
                _, events, output = load_script(name, collections={})
                self.assertEqual(events, [])
                self.assertEqual(output, "")

    def test_add_attendance_keeps_lookup_update_and_duplicate_behavior(self):
        namespace, _, _ = load_script("add_attendance.py", collections={})
        rushees = MagicMock()
        nights = MagicMock()
        nights.find_one.return_value = {"name": "Night 1", "time": "tomorrow"}
        rushees.find_one.return_value = {
            "first_name": "Ada", "last_name": "Example", "attendance": [],
        }
        rushees.update_one.return_value.modified_count = 1

        with redirect_stdout(StringIO()):
            namespace["add_attendance"]("1", "Night 1", rushees, nights)
        nights.find_one.assert_called_once_with({"name": "Night 1"})
        rushees.update_one.assert_called_once_with(
            {"gtid": "1"}, {"$set": {"attendance": [{"name": "Night 1", "time": "tomorrow"}]}}
        )

        rushees.reset_mock()
        rushees.find_one.return_value["attendance"] = [{"name": "Night 1"}]
        with redirect_stdout(StringIO()):
            namespace["add_attendance"]("1", "Night 1", rushees, nights)
        rushees.update_one.assert_not_called()

    def test_add_tag_keeps_valid_tags_and_idempotent_updates(self):
        namespace, _, _ = load_script("add_sorting_tag.py", collections={})
        rushees = MagicMock()
        rushees.find_one.return_value = {
            "first_name": "Ada", "last_name": "Example", "sorting_tags": [],
        }
        rushees.update_one.return_value.modified_count = 1

        with redirect_stdout(StringIO()):
            namespace["add_tag"]("1", "closed_night_invite", rushees)
        rushees.update_one.assert_called_once_with(
            {"gtid": "1"}, {"$set": {"sorting_tags": ["closed_night_invite"]}}
        )

        rushees.reset_mock()
        rushees.find_one.return_value["sorting_tags"] = ["closed_night_invite"]
        with redirect_stdout(StringIO()):
            namespace["add_tag"]("1", "closed_night_invite", rushees)
        rushees.update_one.assert_not_called()
        with redirect_stdout(StringIO()), self.assertRaises(SystemExit) as exit_context:
            namespace["add_tag"]("1", "unknown", rushees)
        self.assertEqual(exit_context.exception.code, 1)

    def test_closed_night_report_keeps_first_matching_night_and_status_grouping(self):
        namespace, _, _ = load_script("closed_night_attendance.py", collections={})
        rushees = MagicMock()
        rushees.find.return_value = [
            {"first_name": "Ada", "last_name": "Example", "sorting_status": "IN_CLOUD",
             "attendance": [{"name": "Closed Night"}, {"name": "Closed Night Again"}]},
            {"first_name": "Bea", "last_name": "Example", "attendance": [{"name": "Night 1"}]},
        ]
        output = StringIO()
        with redirect_stdout(output):
            namespace["check_closed_night"](rushees)
        self.assertIn("Rushees at Closed Night: 1", output.getvalue())
        self.assertIn("IN_CLOUD (1)", output.getvalue())
        self.assertIn("Ada Example", output.getvalue())

    def test_direct_command_uses_local_configuration_and_same_collections(self):
        rushees = MagicMock()
        nights = MagicMock()
        nights.find_one.return_value = {"name": "Night 1", "time": "tomorrow"}
        rushees.find_one.return_value = {
            "first_name": "Ada", "last_name": "Example", "attendance": [],
        }
        rushees.update_one.return_value.modified_count = 1
        _, events, output = load_script(
            "add_attendance.py", execute=True,
            argv=["add_attendance.py", "1", "Night 1"],
            collections={"rushees": rushees, "rush-nights": nights},
        )
        self.assertEqual(events, [("connect", "mongodb://offline-test")])
        self.assertIn("Successfully added 'Night 1' attendance", output)
        rushees.update_one.assert_called_once()


if __name__ == "__main__":
    unittest.main()
