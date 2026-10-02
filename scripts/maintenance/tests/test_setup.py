import unittest

from helpers.season_setup import SEED_DATA, SEED_DIRECTORY, run_setup


class SetupTests(unittest.TestCase):
    def test_direct_command_keeps_reset_then_seed_order_and_requests(self):
        _, events, output = run_setup()
        operations = [event[0] for event in events]

        self.assertEqual(operations[:5], ["dotenv", "certificate", "firebase", "token", "post"])
        self.assertEqual([event[1] for event in events if event[0] == "delete"],
                         ["rushees", "rush-nights", "pis-timeslots", "pis-questions"])
        self.assertLess(operations.index("delete"), operations.index("list_blobs"))
        self.assertLess(operations.index("delete_blob"), operations.index("open"))
        self.assertIn(("list_blobs", "profile-pictures/"), events)
        self.assertEqual([event[1] for event in events if event[0] == "open"],
                         [str(SEED_DIRECTORY / name) for name in SEED_DATA])
        self.assertEqual([event[1] for event in events if event[0] == "progress"],
                         ["Adding PIS Timeslots", "Adding Rush Nights", "Adding PIS Questions"])
        seed_posts = [event for event in events if event[0] == "post"][1:]
        self.assertEqual([event[1] for event in seed_posts], [
            "https://api.example.test/admin/add_pis_timeslot",
            "https://api.example.test/admin/add-rush-night",
            "https://api.example.test/admin/add_pis_question",
        ])
        self.assertEqual([event[2] for event in seed_posts], [
            SEED_DATA["pis_timeslots.json"][0],
            SEED_DATA["rush_nights.json"][0],
            SEED_DATA["pis_questions.json"][0],
        ])
        self.assertTrue(all(event[3] == {
            "Authorization": "Bearer offline-id-token",
            "X-API-Key": "offline-server-key",
        } for event in seed_posts))
        self.assertIn("Rush App Set Up Complete!", output)

    def test_restricted_date_exits_before_loading_credentials_or_deleting_data(self):
        _, events, output = run_setup(day=5)
        self.assertEqual(events, [])
        self.assertIn("This script cannot be run between September 1st and September 12th.", output)

    def test_seed_failures_keep_distinct_messages_and_continue_to_later_files(self):
        _, events, output = run_setup(post_outcomes={
            "https://api.example.test/admin/add_pis_timeslot": ("http", 503),
            "https://api.example.test/admin/add-rush-night": ("api", "invalid night"),
            "https://api.example.test/admin/add_pis_question": ("network", "offline"),
        })

        self.assertEqual(len([event for event in events if event[0] == "post"]), 4)
        self.assertIn("Error adding PIS Timeslot at slot-one: HTTP 503", output)
        self.assertIn("invalid night", output)
        self.assertIn("Network error adding PIS Question Question One: offline", output)
        self.assertNotIn("Rush App Set Up Complete!", output)

    def test_missing_firebase_api_key_keeps_seed_requests_without_bearer_header(self):
        _, events, output = run_setup(env_overrides={"FIREBASE_API_KEY": ""})
        self.assertIn("Warning: FIREBASE_API_KEY not set in .env - API requests may fail", output)
        self.assertNotIn("token", [event[0] for event in events])
        seed_posts = [event for event in events if event[0] == "post"]
        self.assertEqual(len(seed_posts), 3)
        self.assertTrue(all(event[3] == {"X-API-Key": "offline-server-key"} for event in seed_posts))

    def test_failed_token_exchange_keeps_seed_requests_without_bearer_header(self):
        token_url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=offline-api-key"
        _, events, output = run_setup(post_outcomes={token_url: ("http", 403)})
        self.assertIn("Failed to get ID token: {}", output)
        seed_posts = [event for event in events if event[0] == "post"][1:]
        self.assertEqual(len(seed_posts), 3)
        self.assertTrue(all(event[3] == {"X-API-Key": "offline-server-key"} for event in seed_posts))

    def test_storage_failure_is_reported_and_seed_requests_continue(self):
        _, events, output = run_setup(storage_error=True)
        self.assertIn("Error while deleting rush app pictures: offline storage", output)
        self.assertNotIn("delete_blob", [event[0] for event in events])
        self.assertEqual(len([event for event in events if event[0] == "post"]), 4)

    def test_import_does_not_contact_services_or_reset_a_season(self):
        namespace, events, output = run_setup(execute=False)
        self.assertIn("main", namespace)
        self.assertEqual(events, [])
        self.assertEqual(output, "")


if __name__ == "__main__":
    unittest.main()
