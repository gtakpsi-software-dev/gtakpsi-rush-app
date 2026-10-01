"""Destructive setup stages invoked after the entrypoint's date gate."""


def reset_database(db):
    # INVARIANT: reset only these four season collections before replaying seed data.
    print("Deleting all rushees...")
    rushee_collection = db["rushees"]
    rushee_collection.delete_many({})
    print("Deleted all rushees")

    print("Deleting all rush nights...")
    rush_night_collection = db["rush-nights"]
    rush_night_collection.delete_many({})
    print("Deleted all rush nights")

    print("Deleting all PIS timeslots...")
    pis_timeslot_collection = db["pis-timeslots"]
    pis_timeslot_collection.delete_many({})
    print("Deleted all PIS timeslots.")

    print("Deleting all PIS questions...")
    pis_question_collection = db["pis-questions"]
    pis_question_collection.delete_many({})
    print("Deleted all PIS questions.")


def clear_profile_pictures(storage):
    print("Deleting all Rush App pictures from Firebase Storage...")

    try:
        bucket = storage.bucket()
        # INVARIANT: a broader prefix would delete unrelated Firebase assets.
        blobs = bucket.list_blobs(prefix="profile-pictures/")

        deleted_count = 0
        for blob in blobs:
            blob.delete()
            deleted_count += 1

        print(f"Deleted {deleted_count} rush app pictures from Firebase Storage.")
    except Exception as e:
        print(f"Error while deleting rush app pictures: {e}")
