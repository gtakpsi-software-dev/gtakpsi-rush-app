#!/usr/bin/env python3
"""
Normalize rushee attendance tags to a single Night 1 entry.

Behavior:
- Find any rushee with at least one attendance entry.
- Replace attendance with exactly one entry for "Night 1".
"""

from pymongo import MongoClient
import sys

MONGO_URL = "mongodb+srv://gtakpsisoftware:brznOWH0oPA9fT5N@gtakpsi.bf6r1.mongodb.net/?connectTimeoutMS=3000&socketTimeoutMS=300000"
DB_NAME = "rush-app"
RUSHEE_COLLECTION = "rushees"
RUSH_NIGHTS_COLLECTION = "rush-nights"


def get_night_one(rush_nights):
    night_one = rush_nights.find_one({"name": "Night 1"})
    if not night_one:
        print("❌ Night 1 not found in rush-nights collection.")
        sys.exit(1)
    if "time" not in night_one:
        print("❌ Night 1 entry missing time field.")
        sys.exit(1)
    return {
        "name": night_one.get("name", "Night 1"),
        "time": night_one["time"],
    }


def main():
    try:
        client = MongoClient(MONGO_URL)
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
