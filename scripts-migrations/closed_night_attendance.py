#!/usr/bin/env python3
"""
Script to see how many rushees attended Closed Night.
"""

from pymongo import MongoClient

from lib.mongo_config import resolve_mongo_uri
from maintenance_commands.closed_night_report import print_closed_night_report


def check_closed_night(rushee_collection=None):
    if rushee_collection is None:
        client = MongoClient(resolve_mongo_uri(__file__))
        rushee_collection = client["rush-app"]["rushees"]

    return print_closed_night_report(rushee_collection)


if __name__ == "__main__":
    check_closed_night()
