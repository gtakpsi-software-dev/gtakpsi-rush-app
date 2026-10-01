"""Upload one mapped pledge headshot and store its public profile URL."""

import os
import time

from PIL import Image, ImageOps

from lib.headshot_image import prepare_headshot
from lib.headshot_mapping import FILENAME_TO_GTID


def process_headshot(filename, headshots_dir, collection, bucket):
    stem = os.path.splitext(filename)[0]
    gtid = FILENAME_TO_GTID.get(stem)

    if not gtid:
        return f"  No GTID mapping for: {filename}"

    rushee = collection.find_one({"gtid": gtid})
    if not rushee:
        return f"  Rushee not found in DB for GTID {gtid} ({stem})"

    file_path = os.path.join(headshots_dir, filename)
    timestamp = int(time.time() * 1000)
    # INVARIANT: GTID-scoped paths hold public headshots, never private artifacts.
    # Profiles persist this URL, so signed URLs would expire and break images.
    blob_name = f"profile-pictures/{gtid}_{timestamp}.jpg"

    try:
        buffer, compressed_size = prepare_headshot(file_path, Image, ImageOps)

        original_size = os.path.getsize(file_path)
        print(f"  {stem}: {original_size//1024}KB → {compressed_size//1024}KB", end=" | ")

        blob = bucket.blob(blob_name)
        blob.upload_from_file(buffer, content_type="image/jpeg")
        blob.make_public()
        url = blob.public_url

        collection.update_one({"gtid": gtid}, {"$set": {"image_url": url}})

        name = f"{rushee.get('first_name')} {rushee.get('last_name')}"
        print(f"✓ {name}")
        return None
    except Exception as e:
        return f"  ✗ {stem} ({gtid}): {e}"
