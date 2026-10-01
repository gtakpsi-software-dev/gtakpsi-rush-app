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

with patch.object(sys, "path", [str(SCRIPTS), *sys.path]):
    from lib.comment_validation import check_comment_structure


class CommentValidationTests(unittest.TestCase):
    def test_valid_comment_has_no_issues(self):
        comment = {
            "brother_id": "1",
            "brother_name": "Ada",
            "comment": "Good",
            "ratings": [{"name": "fit", "value": 4}],
            "night": {"name": "Night 1", "time": "now"},
        }
        self.assertEqual(check_comment_structure(comment, "unused"), [])

    def test_single_rushee_inspection_keeps_issue_counts_and_diagnostic_lines(self):
        pymongo = types.ModuleType("pymongo")
        pymongo.MongoClient = lambda _uri: None
        script_path = Path(__file__).resolve().parents[1] / "find_malformed_comments.py"
        with patch.object(sys, "path", [str(SCRIPTS), *sys.path]), \
             patch.dict(sys.modules, {"pymongo": pymongo}):
            script = runpy.run_path(str(script_path))

        output = StringIO()
        with redirect_stdout(output):
            result = script["inspect_rushee_comments"]({
                "first_name": "Ada", "last_name": "Example", "gtid": "1",
                "comments": [7, {"comment": "hello"}],
            })

        self.assertEqual(result, (5, True))
        self.assertEqual(output.getvalue(), (
            "❌ Ada Example (GTID: 1)\n"
            "   Comment 0: Should be object, got <class 'int'>\n"
            "   Comment 1 issues:\n"
            "     - Missing field: brother_id\n"
            "     - Missing field: brother_name\n"
            "     - Missing field: ratings\n"
            "     - Missing field: night\n"
            "\n"
        ))

    def test_report_uses_validator_without_contacting_mongodb(self):
        valid = {
            "brother_id": "1",
            "brother_name": "Ada",
            "comment": "Good",
            "ratings": [{"name": "fit", "value": 4}],
            "night": {"name": "Night 1", "time": "now"},
        }
        malformed = {**valid, "ratings": [{"name": "fit", "value": "bad"}]}
        client = MagicMock()
        client.__getitem__.return_value.__getitem__.return_value.find.return_value = [
            {"first_name": "Ada", "last_name": "Example", "gtid": "1", "comments": [valid]},
            {"first_name": "Bea", "last_name": "Example", "gtid": "2", "comments": [malformed]},
        ]
        pymongo = types.ModuleType("pymongo")
        pymongo.MongoClient = lambda _uri: client
        script_path = Path(__file__).resolve().parents[1] / "find_malformed_comments.py"

        with patch.object(sys, "path", [str(SCRIPTS), *sys.path]), \
             patch.dict(sys.modules, {"pymongo": pymongo}), \
             patch.dict(os.environ, {"FIND_MALFORMED_COMMENTS_MONGO_URI": "mongodb://offline-test"}, clear=True):
            script = runpy.run_path(str(script_path))
            output = StringIO()
            with redirect_stdout(output):
                script["find_malformed_comments"]()

        report = output.getvalue()
        self.assertIn("ratings[0].value should be number, got <class 'str'>", report)
        self.assertIn("Total rushees scanned: 2", report)
        self.assertIn("Rushees with issues: 1", report)
        self.assertIn("Total issues found: 1", report)
        client.admin.command.assert_called_once_with("ping")

    def test_report_keeps_missing_wrong_type_and_non_object_diagnostics(self):
        rushees = [
            {"first_name": "Ada", "last_name": "Example", "gtid": "1"},
            {"first_name": "Bea", "last_name": "Example", "gtid": "2", "comments": None},
            {"first_name": "Cam", "last_name": "Example", "gtid": "3", "comments": [7, "bad"]},
            {"first_name": "Dee", "last_name": "Example", "gtid": "4", "comments": []},
        ]
        client = MagicMock()
        client.__getitem__.return_value.__getitem__.return_value.find.return_value = rushees
        pymongo = types.ModuleType("pymongo")
        pymongo.MongoClient = lambda _uri: client
        script_path = Path(__file__).resolve().parents[1] / "find_malformed_comments.py"

        with patch.object(sys, "path", [str(SCRIPTS), *sys.path]), \
             patch.dict(sys.modules, {"pymongo": pymongo}), \
             patch.dict(os.environ, {"FIND_MALFORMED_COMMENTS_MONGO_URI": "mongodb://offline-test"}, clear=True):
            script = runpy.run_path(str(script_path))
            output = StringIO()
            with redirect_stdout(output):
                script["find_malformed_comments"]()

        report = output.getvalue()
        self.assertIn("Missing 'comments' field entirely", report)
        self.assertIn("'comments' should be array, got <class 'NoneType'>", report)
        self.assertIn("Comment 0: Should be object, got <class 'int'>", report)
        self.assertIn("Comment 1: Should be object, got <class 'str'>", report)
        self.assertIn("Total rushees scanned: 4", report)
        self.assertIn("Rushees with issues: 3", report)
        self.assertIn("Total issues found: 4", report)

    def test_scan_error_stops_before_printing_a_partial_summary(self):
        def interrupted_cursor():
            yield {"first_name": "Ada", "last_name": "Example", "gtid": "1", "comments": []}
            raise RuntimeError("cursor interrupted")

        client = MagicMock()
        client.__getitem__.return_value.__getitem__.return_value.find.return_value = interrupted_cursor()
        pymongo = types.ModuleType("pymongo")
        pymongo.MongoClient = lambda _uri: client
        script_path = SCRIPTS / "find_malformed_comments.py"

        with patch.object(sys, "path", [str(SCRIPTS), *sys.path]), \
             patch.dict(sys.modules, {"pymongo": pymongo}), \
             patch.dict(os.environ, {"FIND_MALFORMED_COMMENTS_MONGO_URI": "mongodb://offline-test"}, clear=True):
            script = runpy.run_path(str(script_path))
            output = StringIO()
            with redirect_stdout(output):
                script["find_malformed_comments"]()

        report = output.getvalue()
        self.assertIn("❌ Error scanning database: cursor interrupted", report)
        self.assertNotIn("SCAN SUMMARY", report)
        client.admin.command.assert_called_once_with("ping")

    def test_missing_fields_keep_original_order_and_wording(self):
        self.assertEqual(check_comment_structure({}, "unused"), [
            "Missing field: brother_id",
            "Missing field: brother_name",
            "Missing field: comment",
            "Missing field: ratings",
            "Missing field: night",
        ])

    def test_nested_type_and_missing_field_diagnostics(self):
        comment = {
            "brother_id": 7,
            "brother_name": None,
            "comment": 9,
            "ratings": [7, {"name": 0, "value": "bad"}, {"name": "fit"}],
            "night": {"name": 3},
        }
        self.assertEqual(check_comment_structure(comment, "unused"), [
            "brother_id should be string, got <class 'int'>",
            "brother_name should be string, got <class 'NoneType'>",
            "comment should be string, got <class 'int'>",
            "ratings[0] should be object, got <class 'int'>",
            "ratings[1].name should be string, got <class 'int'>",
            "ratings[1].value should be number, got <class 'str'>",
            "ratings[2] missing 'value' field",
            "night.name should be string, got <class 'int'>",
            "night missing 'time' field",
        ])

    def test_boolean_rating_keeps_legacy_numeric_acceptance(self):
        comment = {
            "brother_id": "1",
            "brother_name": "Ada",
            "comment": "Good",
            "ratings": [{"name": "fit", "value": True}],
            "night": {"name": "Night 1", "time": "now"},
        }
        self.assertEqual(check_comment_structure(comment, "unused"), [])


if __name__ == "__main__":
    unittest.main()
