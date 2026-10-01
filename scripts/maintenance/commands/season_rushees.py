"""Preserve the season reset's delete, update, and reporting sequence.

The entrypoint retains the keep list and credential gate, so importing this
module cannot connect to a database or begin a reset.
"""


def prepare_rushees_for_rush(client, keep_gtids):
    client.admin.command('ping')
    print("Connected!")

    db = client["rush-app"]
    collection = db["rushees"]

    total = collection.count_documents({})
    print(f"\nTotal rushees in DB: {total}")

    # INVARIANT: the same keep list controls deletion and the later reset.
    delete_result = collection.delete_many({"gtid": {"$nin": list(keep_gtids)}})
    print(f"Deleted {delete_result.deleted_count} rushees not in keep list")

    remaining = collection.count_documents({})
    print(f"Remaining: {remaining} rushees")

    found_gtids = set(doc["gtid"] for doc in collection.find({}, {"gtid": 1}))
    missing = keep_gtids - found_gtids
    if missing:
        print(f"\nWARNING: These GTIDs were not found in the DB:")
        for gtid in missing:
            print(f"  {gtid}")
    else:
        print("All 29 expected rushees are present ✓")

    print(f"\nResetting {remaining} rushees to post-registration state...")

    reset_fields = {
        "pis": [],
        "comments": [],
        "attendance": [],
        "ratings": [],
        "sorting_status": "UNSORTED",
        "sorting_notes": "",
        "sorting_tags": [],
        "sorting_order": 0,
        "notes_updated_at": None,
        "notes_updated_by": None,
        "status_updated_at": None,
        "status_updated_by": None,
        "rush_number": None,
        "cloud": "none",
    }

    update_result = collection.update_many(
        {"gtid": {"$in": list(keep_gtids)}},
        {"$set": reset_fields}
    )

    print(f"Reset {update_result.modified_count} rushees")

    print("\n── Summary ──────────────────────────────────────────")
    sample = collection.find_one({"gtid": "904093762"})
    if sample:
        print(f"Sample ({sample.get('first_name')} {sample.get('last_name')}):")
        print(f"  comments:    {len(sample.get('comments', []))}")
        print(f"  pis answers: {len(sample.get('pis', []))}")
        print(f"  attendance:  {len(sample.get('attendance', []))}")
        print(f"  ratings:     {len(sample.get('ratings', []))}")
        print(f"  sorting:     {sample.get('sorting_status')}")

    print("\nDone! Database is ready for the new rush cycle.")
    client.close()
