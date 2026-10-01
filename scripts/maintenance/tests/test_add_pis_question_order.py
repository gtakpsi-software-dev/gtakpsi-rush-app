import builtins
import json
import os
import runpy
import sys
import types
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "add_pis_question_order.py"
QUESTIONS = [
    {"question": "First question", "question_type": "text", "order": 2},
    {"question": "Second question", "question_type": "scale", "order": 1},
]


class FakeCursor:
    def __init__(self, events, questions):
        self.events = events
        self.questions = questions

    def sort(self, field, direction):
        self.events.append(("sort", field, direction))
        return sorted(self.questions, key=lambda question: question[field])


class FakeCollection:
    def __init__(self, events):
        self.events = events
        self.inserted = []

    def count_documents(self, query):
        self.events.append(("count", query))
        return 2

    def delete_many(self, query):
        self.events.append(("delete", query))
        return types.SimpleNamespace(deleted_count=2)

    def insert_one(self, question):
        self.events.append(("insert", question))
        self.inserted.append(question)

    def find(self, query):
        self.events.append(("find", query))
        return FakeCursor(self.events, self.inserted)


class FakeClient:
    def __init__(self, events, collection):
        self.events = events
        self.collection = collection

    def __getitem__(self, name):
        if name == "rush-app":
            self.events.append(("database", name))
            return self
        self.events.append(("collection", name))
        return self.collection

    def close(self):
        self.events.append(("close",))


def run_script(execute=True, mongo_uri="mongodb://offline-test"):
    events = []
    collection = FakeCollection(events)
    client = FakeClient(events, collection)
    pymongo = types.ModuleType("pymongo")
    pymongo.MongoClient = lambda uri: events.append(("connect", uri)) or client
    dotenv = types.ModuleType("dotenv")
    dotenv.load_dotenv = lambda **kwargs: events.append(("dotenv", kwargs["dotenv_path"]))
    actual_open = builtins.open

    def fake_open(path, *args, **kwargs):
        if str(path).endswith("pis_questions.json"):
            events.append(("open", str(path)))
            return StringIO(json.dumps(QUESTIONS))
        return actual_open(path, *args, **kwargs)

    environment = {"MONGO_URI": mongo_uri} if mongo_uri else {}
    with patch.dict(sys.modules, {"pymongo": pymongo, "dotenv": dotenv}):
        with patch.dict(os.environ, environment, clear=True):
            with patch.object(sys, "path", [str(SCRIPT.parent), *sys.path]), \
                 patch("builtins.open", fake_open):
                output = StringIO()
                with redirect_stdout(output):
                    if execute:
                        namespace = runpy.run_path(str(SCRIPT), run_name="__main__")
                    else:
                        namespace = runpy.run_path(str(SCRIPT), run_name="<run_path>")
    return namespace, events, collection, output.getvalue()


class AddPisQuestionOrderTests(unittest.TestCase):
    def test_import_does_not_load_configuration_or_connect(self):
        namespace, events, collection, output = run_script(execute=False, mongo_uri=None)
        self.assertIn("main", namespace)
        self.assertEqual(events, [])
        self.assertEqual(collection.inserted, [])
        self.assertEqual(output, "")

    def test_direct_command_keeps_replacement_and_verification_order(self):
        _, events, collection, output = run_script()
        self.assertEqual([event[0] for event in events], [
            "dotenv", "connect", "database", "collection", "open",
            "count", "delete", "insert", "insert", "find", "sort", "close",
        ])
        self.assertEqual(events[1], ("connect", "mongodb://offline-test"))
        self.assertEqual(events[2], ("database", "rush-app"))
        self.assertEqual(events[3], ("collection", "pis-questions"))
        self.assertEqual(events[0], ("dotenv", os.path.join(str(SCRIPT.parent), "..", "..", ".env")))
        self.assertEqual(events[4], ("open", os.path.join(
            str(SCRIPT.parent), "..", "..", "data", "season_seed", "pis_questions.json"
        )))
        self.assertEqual(events[6], ("delete", {}))
        self.assertEqual(collection.inserted, QUESTIONS)
        self.assertIn("Loaded 2 questions from pis_questions.json", output)
        self.assertIn("Deleted: 2 old questions", output)
        self.assertIn("Inserted: 2 new questions", output)
        self.assertLess(output.index("1 [scale]: Second question"), output.index("2 [text]: First question"))

    def test_missing_uri_exits_before_connecting(self):
        with self.assertRaises(SystemExit) as failure:
            run_script(mongo_uri=None)
        self.assertEqual(failure.exception.code, 1)


if __name__ == "__main__":
    unittest.main()
