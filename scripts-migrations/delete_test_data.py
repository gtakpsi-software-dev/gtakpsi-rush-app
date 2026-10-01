"""
One-off cleanup: remove test rushees and wipe the rush-nights collection.

  1. Deletes the 5 test rushees below (matched by GTID).
  2. Deletes every document in the `rush-nights` collection so the real
     Fall-2026 nights can be added fresh from the Admin page.

NOTE: "Night 1", "Night 2", and "Closed Night" remain default interaction
nights in server/api/src/middlewares/rush_nights.rs and
client/src/features/rushee/interactions.js. Deleting database nights does not
remove those display defaults; this script only changes the database.

Runs a DRY RUN by default. Pass --apply to actually delete.

Setup (once):
    python3 -m pip install pymongo dnspython

Usage (from anywhere):
    python3 scripts-migrations/delete_test_data.py            # dry run
    python3 scripts-migrations/delete_test_data.py --apply    # perform deletes

Connection string resolution order:
    1. --uri "<mongodb://...>"  CLI arg
    2. MONGO_URI / MONGO_URL environment variable
    3. MONGO_URL from server/api/.env  (the Railway proxy string the app uses)
"""

import os
import sys

from pymongo import MongoClient

from lib.cleanup_uri import resolve_cleanup_uri
from maintenance_commands.test_data_cleanup import run_cleanup

APPLY = "--apply" in sys.argv

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def resolve_uri():
    return resolve_cleanup_uri(sys.argv, os.environ, REPO_ROOT)


# Test rushees to delete (GTID -> label, label is just for the printout)
TEST_RUSHEE_GTIDS = {
    "904093480": "Abhinav Pinisetti (Software Dev Testing)",
    "903333333": "Hasini Lol",
    "903739373": "Rohith Ranga",
    "904059716": "Hasini Sandra",
    "098761235": "Hasini Sandra (dup)",
}


def main():
    print("Connecting to MongoDB...")
    client = MongoClient(resolve_uri(), serverSelectionTimeoutMS=10000)
    run_cleanup(client, APPLY, TEST_RUSHEE_GTIDS)


if __name__ == "__main__":
    main()
