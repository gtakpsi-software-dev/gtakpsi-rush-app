"""
Upload pledge headshots to Firebase Storage and update image_url in MongoDB.
"""

import os
import time

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, storage
from PIL import Image, ImageOps
from pymongo import MongoClient

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
    # Keep each public profile image under its GTID and upload timestamp.
    blob_name = f"profile-pictures/{gtid}_{timestamp}.jpg"

    try:
        buffer, compressed_size = prepare_headshot(file_path, Image, ImageOps)

        original_size = os.path.getsize(file_path)
        print(f"  {stem}: {original_size//1024}KB → {compressed_size//1024}KB", end=" | ")

        blob = bucket.blob(blob_name)
        blob.upload_from_file(buffer, content_type="image/jpeg")
        # Existing image_url values use public links; access must remain public for profiles to load.
        blob.make_public()
        url = blob.public_url

        collection.update_one({"gtid": gtid}, {"$set": {"image_url": url}})

        name = f"{rushee.get('first_name')} {rushee.get('last_name')}"
        print(f"✓ {name}")
        return None
    except Exception as e:
        return f"  ✗ {stem} ({gtid}): {e}"


def main():
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

    mongo_uri = os.getenv("MONGO_URI")
    firebase_credentials_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-service-account.json")
    firebase_storage_bucket = os.getenv("FIREBASE_STORAGE_BUCKET")

    # Service credentials are loaded only during direct execution and must stay server-side.
    if not firebase_admin._apps:
        cred = credentials.Certificate(firebase_credentials_path)
        firebase_admin.initialize_app(cred, {'storageBucket': firebase_storage_bucket})

    print("Connecting to MongoDB...")
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=10000)
    client.admin.command('ping')
    db = client["rush-app"]
    collection = db["rushees"]
    print("Connected!")

    headshots_dir = os.path.join(os.path.dirname(__file__), '..', 'Pledge Headshots')
    bucket = storage.bucket()

    success = 0
    errors = []

    for filename in sorted(os.listdir(headshots_dir)):
        if not filename.lower().endswith(('.jpeg', '.jpg', '.png')):
            continue

        error = process_headshot(filename, headshots_dir, collection, bucket)
        if error:
            errors.append(error)
        else:
            success += 1

    print(f"\n── Results ──────────────────────────────")
    print(f"Updated: {success} rushees")
    if errors:
        print(f"Errors ({len(errors)}):")
        for e in errors:
            print(e)
    else:
        print("No errors!")

    client.close()


if __name__ == "__main__":
    main()
