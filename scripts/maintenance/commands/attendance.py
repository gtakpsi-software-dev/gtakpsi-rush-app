import sys


def apply_attendance(gtid, night_name, rushee_collection, rush_nights_collection):
    rush_night = rush_nights_collection.find_one({"name": night_name})

    if not rush_night:
        print(f"Error: No rush night found with name '{night_name}'")
        print("Available rush nights:")
        for night in rush_nights_collection.find():
            print(f"  - {night.get('name')}")
        sys.exit(1)

    print(f"Found rush night: {rush_night.get('name')} at {rush_night.get('time')}")

    rushee = rushee_collection.find_one({"gtid": gtid})

    if not rushee:
        print(f"Error: No rushee found with GTID {gtid}")
        sys.exit(1)

    print(f"Found rushee: {rushee.get('first_name')} {rushee.get('last_name')} (GTID: {gtid})")

    existing_attendance = rushee.get('attendance', [])
    existing_names = [a.get('name') for a in existing_attendance]
    print(f"Existing attendance: {existing_names}")

    # INVARIANT: repeated commands must not append duplicate attendance for a night.
    if night_name in existing_names:
        print(f"Rushee already has attendance for '{night_name}'")
        return

    new_attendance_entry = {
        "name": rush_night.get('name'),
        "time": rush_night.get('time')
    }

    new_attendance = existing_attendance + [new_attendance_entry]

    # Keep the original full-array write so existing attendance order is preserved.
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
