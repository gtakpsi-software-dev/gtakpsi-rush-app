"""Replace the rushee collection from an already loaded export."""


def replace_rushees(collection, rushees, convert_dates):
    # INVARIANT: this command clears the old collection before converting and inserting.
    # A failed conversion or insert leaves the collection empty; preserve that order here.
    print("Clearing existing rushees...")
    result = collection.delete_many({})
    print(f"Deleted {result.deleted_count} existing rushees")

    print("Converting and inserting rushees...")
    converted = [convert_dates(rushee) for rushee in rushees]

    result = collection.insert_many(converted)
    print(f"Successfully inserted {len(result.inserted_ids)} rushees!")

    count = collection.count_documents({})
    print(f"Verified: {count} rushees now in database")
