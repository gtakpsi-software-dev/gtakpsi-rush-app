"""Destructive setup stages invoked after the entrypoint's date gate."""


def reset_database(api_url, auth_headers, post):
    print("Resetting season data through the API...")
    # Do not follow redirects or retry a destructive request automatically.
    response = post(
        api_url + "/admin/season/reset", json={}, headers=auth_headers,
        timeout=60, allow_redirects=False,
    )
    if response.status_code != 200:
        hint = " Deploy the updated API first." if response.status_code == 404 else ""
        raise RuntimeError(f"HTTP {response.status_code}.{hint}")
    body = response.json()
    if not isinstance(body, dict) or body.get("status") != "success":
        raise RuntimeError("The API did not confirm a successful reset.")
    print("Season database reset complete.")


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
