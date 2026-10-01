"""
Upload pledge headshots to Firebase Storage and update image_url in MongoDB.
"""

import os

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, storage
from pymongo import MongoClient

from lib.headshot_mapping import FILENAME_TO_GTID
from maintenance_commands.headshot_upload import process_headshot


def main():
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

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

    headshots_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'Pledge Headshots')
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
