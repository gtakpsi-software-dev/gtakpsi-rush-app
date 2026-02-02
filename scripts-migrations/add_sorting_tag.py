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

# MongoDB connection
mongo_uri = "mongodb+srv://gtakpsisoftware:brznOWH0oPA9fT5N@gtakpsi.bf6r1.mongodb.net/"
client = MongoClient(mongo_uri)

# Access database and collection
db = client["rush-app"]
rushee_collection = db["rushees"]

VALID_TAGS = ["night_1", "night_2", "closed_night", "closed_night_invite", "pis", "hard_no"]

def add_tag(gtid: str, tag: str):
    """Add a sorting tag to a rushee by GTID."""
    
    if tag not in VALID_TAGS:
        print(f"Error: Invalid tag '{tag}'")
        print(f"Valid tags: {', '.join(VALID_TAGS)}")
        sys.exit(1)
    
    # Find the rushee
    rushee = rushee_collection.find_one({"gtid": gtid})
    
    if not rushee:
        print(f"Error: No rushee found with GTID {gtid}")
        sys.exit(1)
    
    print(f"Found rushee: {rushee.get('first_name')} {rushee.get('last_name')} (GTID: {gtid})")
    
    # Get existing tags
    existing_tags = rushee.get('sorting_tags', [])
    print(f"Existing tags: {existing_tags}")
    
    # Add new tag if not already present
    if tag in existing_tags:
        print(f"Tag '{tag}' already exists for this rushee.")
        return
    
    new_tags = existing_tags + [tag]
    
    # Update the rushee
    result = rushee_collection.update_one(
        {"gtid": gtid},
        {"$set": {"sorting_tags": new_tags}}
    )
    
    if result.modified_count > 0:
        print(f"Successfully added tag '{tag}' to {rushee.get('first_name')} {rushee.get('last_name')}")
        print(f"New tags: {new_tags}")
    else:
        print("Error: Failed to update rushee")
        sys.exit(1)

def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    
    gtid = sys.argv[1]
    tag = sys.argv[2]
    
    add_tag(gtid, tag)

if __name__ == "__main__":
    main()
