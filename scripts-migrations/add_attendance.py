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
from datetime import datetime
from pymongo import MongoClient

# MongoDB connection
mongo_uri = "mongodb+srv://gtakpsisoftware:brznOWH0oPA9fT5N@gtakpsi.bf6r1.mongodb.net/"
client = MongoClient(mongo_uri)

# Access database and collection
db = client["rush-app"]
rushee_collection = db["rushees"]
rush_nights_collection = db["rush-nights"]

def add_attendance(gtid: str, night_name: str):
    """Add attendance for a rush night to a rushee by GTID."""
    
    # Find the rush night
    rush_night = rush_nights_collection.find_one({"name": night_name})
    
    if not rush_night:
        print(f"Error: No rush night found with name '{night_name}'")
        print("Available rush nights:")
        for night in rush_nights_collection.find():
            print(f"  - {night.get('name')}")
        sys.exit(1)
    
    print(f"Found rush night: {rush_night.get('name')} at {rush_night.get('time')}")
    
    # Find the rushee
    rushee = rushee_collection.find_one({"gtid": gtid})
    
    if not rushee:
        print(f"Error: No rushee found with GTID {gtid}")
        sys.exit(1)
    
    print(f"Found rushee: {rushee.get('first_name')} {rushee.get('last_name')} (GTID: {gtid})")
    
    # Get existing attendance
    existing_attendance = rushee.get('attendance', [])
    existing_names = [a.get('name') for a in existing_attendance]
    print(f"Existing attendance: {existing_names}")
    
    # Check if already attended this night
    if night_name in existing_names:
        print(f"Rushee already has attendance for '{night_name}'")
        return
    
    # Add new attendance
    new_attendance_entry = {
        "name": rush_night.get('name'),
        "time": rush_night.get('time')
    }
    
    new_attendance = existing_attendance + [new_attendance_entry]
    
    # Update the rushee
    result = rushee_collection.update_one(
        {"gtid": gtid},
        {"$set": {"attendance": new_attendance}}
    )
    
    if result.modified_count > 0:
        print(f"Successfully added '{night_name}' attendance to {rushee.get('first_name')} {rushee.get('last_name')}")
        print(f"New attendance: {[a.get('name') for a in new_attendance]}")
    else:
        print("Error: Failed to update rushee")
        sys.exit(1)

def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    
    gtid = sys.argv[1]
    night_name = sys.argv[2]
    
    add_attendance(gtid, night_name)

if __name__ == "__main__":
    main()
