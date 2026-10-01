import sys
import tempfile
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.mongo_config import resolve_mongo_uri


class MongoConfigTests(unittest.TestCase):
    def test_environment_precedes_local_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / ".env").write_text('MONGO_URI="mongodb://file"\n')
            self.assertEqual(resolve_mongo_uri({"MONGO_URI": "mongodb://environment"}, root),
                             "mongodb://environment")
            self.assertEqual(resolve_mongo_uri({"MONGO_URL": "mongodb://alternate"}, root),
                             "mongodb://alternate")

    def test_root_and_server_env_fallbacks_keep_local_commands_usable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "server").mkdir()
            (root / ".env").write_text("# comment\nMONGO_URI='mongodb://root'\n")
            (root / "server" / ".env").write_text("MONGO_URL=mongodb://server\n")
            self.assertEqual(resolve_mongo_uri({}, root), "mongodb://root")
            (root / ".env").unlink()
            self.assertEqual(resolve_mongo_uri({}, root), "mongodb://server")

    def test_missing_configuration_stops_before_a_database_client_is_created(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(SystemExit, "Set MONGO_URI or MONGO_URL"):
                resolve_mongo_uri({}, directory)


if __name__ == "__main__":
    unittest.main()
