import runpy
import sys
import types
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "set_admin_claim.py"


def run_script(arguments=(), execute=True, user_exists=True):
    events = []
    firebase_admin = types.ModuleType("firebase_admin")
    firebase_admin._apps = []
    firebase_admin.initialize_app = lambda credential: events.append(("initialize", credential)) or firebase_admin._apps.append(object())
    credentials = types.ModuleType("firebase_admin.credentials")
    credentials.Certificate = lambda path: events.append(("certificate", path)) or "credential"
    auth = types.ModuleType("firebase_admin.auth")

    class UserNotFoundError(Exception):
        pass

    def get_user_by_email(email):
        events.append(("lookup", email))
        if not user_exists:
            raise UserNotFoundError()
        return types.SimpleNamespace(uid="user-1", email=email, custom_claims={"existing": True})

    auth.UserNotFoundError = UserNotFoundError
    auth.get_user_by_email = get_user_by_email
    auth.set_custom_user_claims = lambda uid, claims: events.append(("set", uid, claims))
    firebase_admin.credentials = credentials
    firebase_admin.auth = auth
    modules = {
        "firebase_admin": firebase_admin,
        "firebase_admin.credentials": credentials,
        "firebase_admin.auth": auth,
    }

    with patch.dict(sys.modules, modules):
        with patch.object(sys, "argv", [str(SCRIPT), *arguments]):
            output = StringIO()
            with redirect_stdout(output):
                try:
                    namespace = runpy.run_path(str(SCRIPT), run_name="__main__" if execute else "<run_path>")
                    exit_code = None
                except SystemExit as error:
                    namespace = None
                    exit_code = error.code
    return namespace, events, output.getvalue(), exit_code


class SetAdminClaimTests(unittest.TestCase):
    def test_import_does_not_load_service_credentials(self):
        namespace, events, output, exit_code = run_script(execute=False)
        self.assertIn("main", namespace)
        self.assertEqual(events, [])
        self.assertEqual(output, "")
        self.assertIsNone(exit_code)

    def test_direct_command_keeps_initialization_and_claim_update_order(self):
        _, events, output, exit_code = run_script(("person@example.com", "--admin", "--bidcom"))
        self.assertIsNone(exit_code)
        self.assertEqual([event[0] for event in events], ["certificate", "initialize", "lookup", "set"])
        self.assertEqual(events[2], ("lookup", "person@example.com"))
        self.assertEqual(events[3], ("set", "user-1", {
            "existing": True, "admin": True, "bidcom": True,
        }))
        self.assertIn("The user must log out and log back in", output)

    def test_usage_error_still_initializes_before_exiting(self):
        _, events, output, exit_code = run_script(())
        self.assertEqual(exit_code, 1)
        self.assertEqual([event[0] for event in events], ["certificate", "initialize"])
        self.assertIn("Usage: python3 set_admin_claim.py", output)

    def test_missing_user_keeps_error_and_does_not_write_claims(self):
        _, events, output, exit_code = run_script(("missing@example.com", "--admin"), user_exists=False)
        self.assertEqual(exit_code, 1)
        self.assertEqual([event[0] for event in events], ["certificate", "initialize", "lookup"])
        self.assertIn("No user found with email missing@example.com", output)


if __name__ == "__main__":
    unittest.main()
