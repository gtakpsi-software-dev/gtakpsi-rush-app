#!/usr/bin/env python3
"""
Script to find malformed comment data in the MongoDB database
that could be causing dashboard loading errors.
"""

from pymongo import MongoClient
from lib.mongo_config import resolve_mongo_uri
import sys

from lib.comment_validation import check_comment_structure

def connect_to_database():
    """Connect to MongoDB database"""
    try:
        client = MongoClient(resolve_mongo_uri(__file__))
        db = client["rush-app"]
        collection = db["rushees"]
        
        # Test connection
        client.admin.command('ping')
        print("✅ Successfully connected to MongoDB")
        return collection
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        sys.exit(1)


def find_malformed_comments():
    """Find all rushees with malformed comment data"""
    collection = connect_to_database()
    
    print("\n🔍 Scanning for malformed comment data...")
    print("=" * 60)
    
    total_rushees = 0
    problematic_rushees = 0
    total_issues = 0
    
    try:
        # Get all rushees
        cursor = collection.find({})
        
        for rushee in cursor:
            total_rushees += 1
            rushee_info = f"{rushee.get('first_name', 'Unknown')} {rushee.get('last_name', 'Unknown')} (GTID: {rushee.get('gtid', 'Unknown')})"
            
            # Check if comments field exists and is an array
            if 'comments' not in rushee:
                print(f"⚠️  {rushee_info}")
                print(f"   Missing 'comments' field entirely")
                problematic_rushees += 1
                total_issues += 1
                continue
            
            if not isinstance(rushee['comments'], list):
                print(f"⚠️  {rushee_info}")
                print(f"   'comments' should be array, got {type(rushee['comments'])}")
                problematic_rushees += 1
                total_issues += 1
                continue
            
            # Check each comment in the comments array
            rushee_has_issues = False
            for i, comment in enumerate(rushee['comments']):
                if not isinstance(comment, dict):
                    if not rushee_has_issues:
                        print(f"❌ {rushee_info}")
                        rushee_has_issues = True
                    print(f"   Comment {i}: Should be object, got {type(comment)}")
                    total_issues += 1
                    continue
                
                issues = check_comment_structure(comment, rushee_info)
                if issues:
                    if not rushee_has_issues:
                        print(f"❌ {rushee_info}")
                        rushee_has_issues = True
                    print(f"   Comment {i} issues:")
                    for issue in issues:
                        print(f"     - {issue}")
                        total_issues += 1
            
            if rushee_has_issues:
                problematic_rushees += 1
                print()  # Empty line for readability
    
    except Exception as e:
        print(f"❌ Error scanning database: {e}")
        return
    
    # Summary
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
        
        # Provide fix suggestions
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


