import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPTS = Path(__file__).resolve().parents[1]
with patch.object(sys, "path", [str(SCRIPTS), *sys.path]):
    from lib.mongo_config import resolve_mongo_uri


class MongoConfigTests(unittest.TestCase):
    def test_environment_precedes_local_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / ".env.migrations").write_text('DATA_PULL_MONGO_URI="mongodb://file"\n')
            self.assertEqual(resolve_mongo_uri("data_pull.py", {"DATA_PULL_MONGO_URI": "mongodb://environment"}, root),
                             "mongodb://environment")
            self.assertEqual(resolve_mongo_uri("data_pull.py", {}, root), "mongodb://file")

    def test_each_script_uses_its_own_uri_even_when_app_config_is_present(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / ".env").write_text("MONGO_URI=mongodb://app\n")
            (root / ".env.migrations").write_text(
                "DATA_PULL_MONGO_URI='mongodb://export'\n"
                "MIGRATE_ATTENDANCE_NIGHT1_MONGO_URI=mongodb://migration\n"
            )
            self.assertEqual(resolve_mongo_uri("data_pull.py", {"MONGO_URI": "mongodb://app"}, root),
                             "mongodb://export")
            self.assertEqual(resolve_mongo_uri("migrate_attendance_night1.py", {}, root),
                             "mongodb://migration")

    def test_missing_configuration_stops_before_a_database_client_is_created(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(SystemExit, "Set DATA_PULL_MONGO_URI"):
                resolve_mongo_uri("data_pull.py", {"MONGO_URI": "mongodb://wrong"}, directory)


if __name__ == "__main__":
    unittest.main()
