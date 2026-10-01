#!/usr/bin/env python3
"""
Script to add attendance for a rush night to a rushee.
Usage: python3 add_attendance.py <gtid> <night_name>

Examples:
  python3 add_attendance.py 903992288 "Night 1"
  python3 add_attendance.py 903992288 "Night 2"
  python3 add_attendance.py 903992288 "Closed Night"
"""

import sys

from pymongo import MongoClient

from lib.mongo_config import resolve_mongo_uri
from maintenance_commands.attendance import apply_attendance


def add_attendance(gtid: str, night_name: str, rushee_collection=None, rush_nights_collection=None):
    """Add attendance for a rush night to a rushee by GTID."""
    if rushee_collection is None or rush_nights_collection is None:
        client = MongoClient(resolve_mongo_uri(__file__))
        db = client["rush-app"]
        rushee_collection = db["rushees"]
        rush_nights_collection = db["rush-nights"]
    return apply_attendance(gtid, night_name, rushee_collection, rush_nights_collection)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    gtid = sys.argv[1]
    night_name = sys.argv[2]

    add_attendance(gtid, night_name)


if __name__ == "__main__":
    main()
