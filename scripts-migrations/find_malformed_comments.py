#!/usr/bin/env python3
"""
Script to find malformed comment data in the MongoDB database
that could be causing dashboard loading errors.
"""

import sys

from pymongo import MongoClient

from lib.comment_inspection import inspect_rushee_comments
from lib.mongo_config import resolve_mongo_uri


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
    collection = connect_to_database()

    print("\n🔍 Scanning for malformed comment data...")
    print("=" * 60)

    total_rushees = 0
    problematic_rushees = 0
    total_issues = 0

    try:
        cursor = collection.find({})

        for rushee in cursor:
            total_rushees += 1
            issue_count, rushee_has_issues = inspect_rushee_comments(rushee)
            total_issues += issue_count
            if rushee_has_issues:
                problematic_rushees += 1

    except Exception as e:
        print(f"❌ Error scanning database: {e}")
        return

    print("=" * 60)
    print("📊 SCAN SUMMARY")
    print("=" * 60)
    print(f"Total rushees scanned: {total_rushees}")
    print(f"Rushees with issues: {problematic_rushees}")
    print(f"Total issues found: {total_issues}")

    if problematic_rushees == 0:
        print("\n✅ No malformed comment data found!")
        print("The dashboard issue might be caused by something else.")
    else:
        print(f"\n⚠️  Found {problematic_rushees} rushees with malformed comment data.")
        print("This is likely causing your dashboard loading errors.")

        print("\n🔧 SUGGESTED FIXES:")
        print("1. Use the cleanup script to fix malformed data")
        print("2. Or manually review and fix the problematic rushees listed above")
        print("3. Restart your Rust server after fixing the data")

def main():
    print("🔍 MongoDB Comment Structure Validator")
    print("=" * 60)
    print("This script will scan your MongoDB database for malformed comment data")
    print("that could be causing dashboard loading errors.\n")

    find_malformed_comments()


if __name__ == "__main__":
    main()
