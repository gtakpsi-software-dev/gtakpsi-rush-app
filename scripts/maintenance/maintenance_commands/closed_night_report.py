"""Closed Night Report Summary:

Keep the projection, first-match attendance rule, and status grouping together.
The original entrypoint still resolves its own read-only MongoDB collection.
"""


def print_closed_night_report(rushee_collection):
    print("=" * 60)
    print("Closed Night Attendance")
    print("=" * 60)

    # Limit the read to report fields so other stored personal data stays out of memory.
    rushees = list(rushee_collection.find({}, {
        "first_name": 1,
        "last_name": 1,
        "attendance": 1,
        "sorting_status": 1
    }))

    print(f"\nTotal rushees in database: {len(rushees)}")

    closed_night_attendees = []

    for rushee in rushees:
        name = f"{rushee.get('first_name', '?')} {rushee.get('last_name', '?')}"
        attendance = rushee.get('attendance', [])
        status = rushee.get('sorting_status', 'UNSORTED')

        # Count each rushee once even if several attendance entries match.
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
