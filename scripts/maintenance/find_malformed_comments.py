#!/usr/bin/env python3
"""
Script to find malformed comment data in the MongoDB database
that could be causing dashboard loading errors.
"""

import sys

from pymongo import MongoClient

# Keep the inspection helper import available to callers of this command module.
from lib.comment_inspection import inspect_rushee_comments
from lib.mongo_config import resolve_mongo_uri
from commands.comment_report import print_comment_report


def connect_to_database():
    try:
        client = MongoClient(resolve_mongo_uri(__file__))
        db = client["rush-app"]
        collection = db["rushees"]

        client.admin.command('ping')
        print("✅ Successfully connected to MongoDB")
        return collection
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        sys.exit(1)


def find_malformed_comments():
    print_comment_report(connect_to_database())


def main():
    print("🔍 MongoDB Comment Structure Validator")
    print("=" * 60)
    print("This script will scan your MongoDB database for malformed comment data")
    print("that could be causing dashboard loading errors.\n")

    find_malformed_comments()


if __name__ == "__main__":
    main()
