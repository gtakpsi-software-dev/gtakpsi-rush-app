"""Keep the cleanup preview and write gate together after command relocation.

The entrypoint still selects the URI and --apply mode; importing this module
never connects to MongoDB or deletes data.
"""

import sys


def run_cleanup(client, apply, test_rushee_gtids):
    client.admin.command("ping")
    print("Connected!\n")

    db = client["rush-app"]
    rushees = db["rushees"]
    rush_nights = db["rush-nights"]

    mode = "APPLY" if apply else "DRY RUN (no changes will be made)"
    print(f"=== Mode: {mode} ===\n")

    gtids = list(test_rushee_gtids)
    matched = list(
        rushees.find({"gtid": {"$in": gtids}}, {"gtid": 1, "first_name": 1, "last_name": 1})
    )

    print(f"Rushees matched for deletion ({len(matched)} of {len(gtids)} GTIDs):")
    for doc in matched:
        print(f"  {doc.get('gtid')}  {doc.get('first_name', '')} {doc.get('last_name', '')}")
    missing = set(gtids) - {d.get("gtid") for d in matched}
    for gtid in sorted(missing):
        print(f"  {gtid}  -- NOT FOUND (already gone?)  [{test_rushee_gtids[gtid]}]")
    print()

    all_nights = list(rush_nights.find({}))
    print(f"Rush-nights documents to delete ({len(all_nights)} total):")
    for doc in all_nights:
        print(f"  {doc.get('name', '(no name)')}  @  {doc.get('time')}")
    print()

    # INVARIANT: both collections are previewed before --apply can permit a delete.
    if not apply:
        print("Dry run only. Re-run with --apply to delete the above.")
        client.close()
        sys.exit(0)

    r1 = rushees.delete_many({"gtid": {"$in": gtids}})
    print(f"Deleted {r1.deleted_count} rushees")

    r2 = rush_nights.delete_many({})
    print(f"Deleted {r2.deleted_count} rush-nights documents")

    print(
        f"\nRemaining: {rushees.count_documents({})} rushees, "
        f"{rush_nights.count_documents({})} rush nights"
    )
    print("\nDone.")
    client.close()
