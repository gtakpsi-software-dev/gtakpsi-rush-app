"""
One-off cleanup: remove test rushees and wipe the rush-nights collection.

  1. Deletes the 5 test rushees below (matched by GTID).
  2. Deletes every document in the `rush-nights` collection so the real
     Fall-2026 nights can be added fresh from the Admin page.

NOTE: "Night 1", "Night 2", and "Closed Night" remain default interaction
nights in server/src/middlewares/rush_nights.rs and
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
    3. MONGO_URL from server/.env  (the Railway proxy string the app uses)
"""

import os
import sys

from pymongo import MongoClient
from maintenance_commands.test_data_cleanup import run_cleanup

APPLY = "--apply" in sys.argv

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _uri_from_server_env():
    path = os.path.join(REPO_ROOT, "server", ".env")
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("MONGO_URL="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError:
        pass
    return None


def resolve_uri():
    if "--uri" in sys.argv:
        i = sys.argv.index("--uri")
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
        print("ERROR: --uri given with no value")
        sys.exit(1)
    uri = os.getenv("MONGO_URI") or os.getenv("MONGO_URL") or _uri_from_server_env()
    if not uri:
        print("ERROR: no connection string. Pass --uri, set MONGO_URL, or "
              "put MONGO_URL in server/.env")
        sys.exit(1)
    return uri


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
