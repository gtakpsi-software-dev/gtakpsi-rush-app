"""
One-off cleanup: remove test rushees and wipe the rush-nights collection.

  1. Deletes the 5 test rushees below (matched by GTID).
  2. Deletes every document in the `rush-nights` collection so the real
     Fall-2026 nights can be added fresh from the Admin page.

NOTE: "Night 1", "Night 2", "Closed Night", and "Dev Night" are also
hard-coded in the backend (server/src/middlewares/rush_nights.rs ->
canonical_rush_nights) and in client/src/js/rusheeInteractions.js. Those
four labels will keep showing up in interaction displays until that code
is changed too -- this script only touches the database.

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

print("Connecting to MongoDB...")
client = MongoClient(resolve_uri(), serverSelectionTimeoutMS=10000)
client.admin.command("ping")
print("Connected!\n")

db = client["rush-app"]
rushees = db["rushees"]
rush_nights = db["rush-nights"]

mode = "APPLY" if APPLY else "DRY RUN (no changes will be made)"
print(f"=== Mode: {mode} ===\n")

# -- Rushees -----------------------------------------------------------------
gtids = list(TEST_RUSHEE_GTIDS)
matched = list(
    rushees.find({"gtid": {"$in": gtids}}, {"gtid": 1, "first_name": 1, "last_name": 1})
)

print(f"Rushees matched for deletion ({len(matched)} of {len(gtids)} GTIDs):")
for doc in matched:
    print(f"  {doc.get('gtid')}  {doc.get('first_name', '')} {doc.get('last_name', '')}")
missing = set(gtids) - {d.get("gtid") for d in matched}
for gtid in sorted(missing):
    print(f"  {gtid}  -- NOT FOUND (already gone?)  [{TEST_RUSHEE_GTIDS[gtid]}]")
print()

# -- Rush nights -----------------------------------------------------------------
all_nights = list(rush_nights.find({}))
print(f"Rush-nights documents to delete ({len(all_nights)} total):")
for doc in all_nights:
    print(f"  {doc.get('name', '(no name)')}  @  {doc.get('time')}")
print()

if not APPLY:
    print("Dry run only. Re-run with --apply to delete the above.")
    client.close()
    sys.exit(0)

# -- Perform deletes -----------------------------------------------------------------
r1 = rushees.delete_many({"gtid": {"$in": gtids}})
print(f"Deleted {r1.deleted_count} rushees")

r2 = rush_nights.delete_many({})
print(f"Deleted {r2.deleted_count} rush-nights documents")

print(
    f"\nRemaining: {rushees.count_documents({})} rushees, "
    f"{rush_nights.count_documents({})} rush nights"
)
print("\nDone.")
client.close()
