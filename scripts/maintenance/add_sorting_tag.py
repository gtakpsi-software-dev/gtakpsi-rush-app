#!/usr/bin/env python3
"""
Script to add a sorting tag to a rushee.
Usage: python3 add_sorting_tag.py <gtid> <tag>

Valid tags: night_1, night_2, closed_night, pis, hard_no

Examples:
  python3 add_sorting_tag.py 903992288 night_1
  python3 add_sorting_tag.py 903992288 pis
"""

import sys

from pymongo import MongoClient

from lib.mongo_config import resolve_mongo_uri
from maintenance_commands.sorting_tags import apply_sorting_tag

VALID_TAGS = ["night_1", "night_2", "closed_night", "closed_night_invite", "pis", "hard_no"]


def add_tag(gtid: str, tag: str, rushee_collection=None):
    """Add a sorting tag to a rushee by GTID."""

    # INVARIANT: unknown tags must not enter the stored sorting-tag set.
    if tag not in VALID_TAGS:
        print(f"Error: Invalid tag '{tag}'")
        print(f"Valid tags: {', '.join(VALID_TAGS)}")
        sys.exit(1)

    if rushee_collection is None:
        client = MongoClient(resolve_mongo_uri(__file__))
        rushee_collection = client["rush-app"]["rushees"]

    return apply_sorting_tag(gtid, tag, rushee_collection)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    gtid = sys.argv[1]
    tag = sys.argv[2]

    add_tag(gtid, tag)


if __name__ == "__main__":
    main()
