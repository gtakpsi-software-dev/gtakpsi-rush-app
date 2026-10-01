#!/usr/bin/env python3
"""
Script to see how many rushees attended Closed Night.
"""

from pymongo import MongoClient
from lib.mongo_config import resolve_mongo_uri

def check_closed_night(rushee_collection=None):
    if rushee_collection is None:
        client = MongoClient(resolve_mongo_uri())
        rushee_collection = client["rush-app"]["rushees"]

    print("=" * 60)
    print("Closed Night Attendance")
    print("=" * 60)
    
    # Fetch all rushees with just attendance and name fields
    rushees = list(rushee_collection.find({}, {
        "first_name": 1, 
        "last_name": 1, 
        "attendance": 1,
        "sorting_status": 1
    }))
    
    print(f"\nTotal rushees in database: {len(rushees)}")
    
    # Find rushees with Closed Night attendance
    closed_night_attendees = []
    
    for rushee in rushees:
        name = f"{rushee.get('first_name', '?')} {rushee.get('last_name', '?')}"
        attendance = rushee.get('attendance', [])
        status = rushee.get('sorting_status', 'UNSORTED')
        
        for night in attendance:
            night_name = night.get('name', '')
            if 'closed' in night_name.lower():
                closed_night_attendees.append({
                    'name': name,
                    'night': night_name,
                    'status': status
                })
                break
    
    print(f"\n✅ Rushees at Closed Night: {len(closed_night_attendees)}")
    print()
    
    if closed_night_attendees:
        # Group by sorting status
        by_status = {}
        for attendee in closed_night_attendees:
            status = attendee['status']
            if status not in by_status:
                by_status[status] = []
            by_status[status].append(attendee['name'])
        
        print("By Sorting Status:")
        for status, names in sorted(by_status.items()):
            print(f"\n  {status} ({len(names)}):")
            for name in sorted(names):
                print(f"    - {name}")
    
    print()
    print("=" * 60)

if __name__ == "__main__":
    check_closed_night()
