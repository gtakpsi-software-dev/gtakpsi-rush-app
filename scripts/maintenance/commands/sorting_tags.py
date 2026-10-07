import sys


def apply_sorting_tag(gtid, tag, rushee_collection):
    rushee = rushee_collection.find_one({"gtid": gtid})

    if not rushee:
        print(f"Error: No rushee found with GTID {gtid}")
        sys.exit(1)

    print(f"Found rushee: {rushee.get('first_name')} {rushee.get('last_name')} (GTID: {gtid})")

    existing_tags = rushee.get('sorting_tags', [])
    print(f"Existing tags: {existing_tags}")

    # INVARIANT: repeated commands must not append duplicate tag values.
    if tag in existing_tags:
        print(f"Tag '{tag}' already exists for this rushee.")
        return

    new_tags = existing_tags + [tag]

    # Keep the original full-array write so tag order and update-result handling remain intact.
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
