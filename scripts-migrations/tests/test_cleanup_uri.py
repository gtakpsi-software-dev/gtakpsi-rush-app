import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch


SCRIPTS = Path(__file__).resolve().parents[1]
with patch.object(sys, "path", [str(SCRIPTS), *sys.path]):
    from lib.cleanup_uri import resolve_cleanup_uri


class CleanupUriTests(unittest.TestCase):
    def test_first_cli_uri_precedes_environment_and_server_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "server").mkdir()
            (root / "server" / ".env").write_text("MONGO_URL=mongodb://server\n")

            self.assertEqual(
                resolve_cleanup_uri(
                    [
                        "delete_test_data.py", "--uri", "mongodb://first",
                        "--uri", "mongodb://second",
                    ],
                    {"MONGO_URI": "mongodb://environment"},
                    root,
                ),
                "mongodb://first",
            )

    def test_environment_order_and_quoted_server_fallback_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "server").mkdir()
            (root / "server" / ".env").write_text(
                "OTHER=mongodb://ignored\nMONGO_URL='mongodb://server'\n"
            )
            args = ["delete_test_data.py"]

            self.assertEqual(
                resolve_cleanup_uri(
                    args,
                    {"MONGO_URI": "mongodb://first", "MONGO_URL": "mongodb://second"},
                    root,
                ),
                "mongodb://first",
            )
            self.assertEqual(
                resolve_cleanup_uri(args, {"MONGO_URL": "mongodb://second"}, root),
                "mongodb://second",
            )
            self.assertEqual(resolve_cleanup_uri(args, {}, root), "mongodb://server")

    def test_missing_cli_value_keeps_its_error_even_when_environment_is_set(self):
        output = StringIO()
        with redirect_stdout(output), self.assertRaises(SystemExit) as exit_status:
            resolve_cleanup_uri(
                ["delete_test_data.py", "--uri"],
                {"MONGO_URI": "mongodb://environment"},
                ".",
            )

        self.assertEqual(exit_status.exception.code, 1)
        self.assertEqual(output.getvalue(), "ERROR: --uri given with no value\n")

    def test_missing_uri_exits_before_a_database_connection(self):
        with tempfile.TemporaryDirectory() as directory:
            output = StringIO()
            with redirect_stdout(output), self.assertRaises(SystemExit) as exit_status:
                resolve_cleanup_uri(["delete_test_data.py"], {}, directory)

        self.assertEqual(exit_status.exception.code, 1)
        self.assertIn("ERROR: no connection string", output.getvalue())


if __name__ == "__main__":
    unittest.main()
