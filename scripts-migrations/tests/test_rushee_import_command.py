import sys
import types
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch


SCRIPTS = Path(__file__).resolve().parents[1]
with patch.object(sys, "path", [str(SCRIPTS), *sys.path]):
    from maintenance_commands.rushee_import import replace_rushees


class RusheeImportCommandTests(unittest.TestCase):
    def test_replacement_keeps_delete_conversion_insert_and_count_order(self):
        events = []

        class Collection:
            def delete_many(self, query):
                events.append(("delete", query))
                return types.SimpleNamespace(deleted_count=2)

            def insert_many(self, documents):
                events.append(("insert", documents))
                return types.SimpleNamespace(inserted_ids=[1])

            def count_documents(self, query):
                events.append(("count", query))
                return 1

        def convert_dates(document):
            events.append(("convert", document))
            return {**document, "converted": True}

        output = StringIO()
        with redirect_stdout(output):
            replace_rushees(Collection(), [{"gtid": "123"}], convert_dates)

        self.assertEqual(events, [
            ("delete", {}),
            ("convert", {"gtid": "123"}),
            ("insert", [{"gtid": "123", "converted": True}]),
            ("count", {}),
        ])
        self.assertEqual(output.getvalue(), (
            "Clearing existing rushees...\n"
            "Deleted 2 existing rushees\n"
            "Converting and inserting rushees...\n"
            "Successfully inserted 1 rushees!\n"
            "Verified: 1 rushees now in database\n"
        ))


if __name__ == "__main__":
    unittest.main()
