import runpy
import sys
import types
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "data_pull.py"
RUSHEES = [
    {"first_name": "Ada", "last_name": "A", "gtid": "1", "flex_window": True},
    {"first_name": "Bob", "email": "bob@example.com", "flex_window": False},
]


def run_script(execute=True):
    events = []

    class FakeCollection:
        def find(self):
            events.append(("find",))
            return RUSHEES

    collection = FakeCollection()

    class FakeClient:
        def __getitem__(self, name):
            events.append(("database" if name == "rush-app" else "collection", name))
            return self if name == "rush-app" else collection

    pymongo = types.ModuleType("pymongo")
    pymongo.MongoClient = lambda uri: events.append(("connect",)) or FakeClient()
    pandas = types.ModuleType("pandas")

    class FakeDataFrame:
        def __init__(self, data, columns):
            events.append(("frame", data, columns))

        def to_excel(self, path, index):
            events.append(("excel", path, index))

    pandas.DataFrame = FakeDataFrame

    with patch.dict(sys.modules, {"pymongo": pymongo, "pandas": pandas}):
        output = StringIO()
        with redirect_stdout(output):
            namespace = runpy.run_path(str(SCRIPT), run_name="__main__" if execute else "<run_path>")
    return namespace, events, output.getvalue()


class DataPullTests(unittest.TestCase):
    def test_import_does_not_connect_or_write_excel(self):
        namespace, events, output = run_script(execute=False)
        self.assertTrue("main" in namespace)
        self.assertEqual(events, [])
        self.assertEqual(output, "")

    def test_direct_command_retains_query_columns_and_output(self):
        _, events, output = run_script()
        self.assertEqual([event[0] for event in events], [
            "connect", "database", "collection", "find", "frame", "excel",
        ])
        self.assertEqual(events[4][1][0]["flex_window"], "Yes")
        self.assertEqual(events[4][1][1]["flex_window"], "No")
        self.assertEqual(events[4][1][1]["last_name"], "")
        self.assertEqual(events[4][2], [
            "first_name", "last_name", "housing", "phone_number", "email",
            "gtid", "major", "class", "flex_window",
        ])
        self.assertEqual(events[5], ("excel", "rushees.xlsx", False))
        self.assertIn("Data successfully written to rushees.xlsx", output)


if __name__ == "__main__":
    unittest.main()
