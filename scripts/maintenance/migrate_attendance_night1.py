#!/usr/bin/env python3
"""
Normalize rushee attendance tags to a single Night 1 entry.

Behavior:
- Find any rushee with at least one attendance entry.
- Replace attendance with exactly one entry for "Night 1".
"""

import sys

from pymongo import MongoClient

from lib.mongo_config import resolve_mongo_uri
from commands.attendance_night1 import get_night_one

DB_NAME = "rush-app"
RUSHEE_COLLECTION = "rushees"
RUSH_NIGHTS_COLLECTION = "rush-nights"


def main():
    try:
        client = MongoClient(resolve_mongo_uri(__file__))
        db = client[DB_NAME]
        rush_nights = db[RUSH_NIGHTS_COLLECTION]
        rushees = db[RUSHEE_COLLECTION]

        night_one_entry = get_night_one(rush_nights)

        result = rushees.update_many(
            {"attendance.0": {"$exists": True}},
            {"$set": {"attendance": [night_one_entry]}},
        )

        print("✅ Attendance migration complete.")
        print(f"Matched rushees: {result.matched_count}")
        print(f"Modified rushees: {result.modified_count}")
    except Exception as exc:
        print(f"❌ Migration failed: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
