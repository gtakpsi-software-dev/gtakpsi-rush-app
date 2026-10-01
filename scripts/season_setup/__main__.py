"""Reset season data, profile pictures, and replay the configured seed files."""

import os
from datetime import datetime

import firebase_admin
import requests
from dotenv import load_dotenv
from firebase_admin import credentials, storage, auth as firebase_auth
from pymongo import MongoClient
from tqdm import tqdm

from scripts.season_setup.authentication import get_admin_id_token
from scripts.season_setup.reset import clear_profile_pictures, reset_database
from scripts.season_setup.seeds import seed_data


def main():
    # INVARIANT: the protected rush dates must exit before credentials or writes.
    current_date = datetime.now()
    if datetime(current_date.year, 9, 1) <= current_date <= datetime(
        current_date.year, 9, 12
    ):
        print(
            "This script cannot be run between September 1st and September 12th. [Spring 2025 Rush]"
        )
        exit()

    load_dotenv()

    mongo_uri = os.getenv("MONGO_URI")
    api_url = os.getenv("API")
    firebase_credentials_path = os.getenv(
        "FIREBASE_CREDENTIALS_PATH", "firebase-service-account.json"
    )
    firebase_storage_bucket = os.getenv("FIREBASE_STORAGE_BUCKET")
    firebase_api_key = os.getenv("FIREBASE_API_KEY")
    admin_uid = os.getenv("ADMIN_UID")
    api_key = os.getenv("API_KEY")

    # Service-account credentials must stay in direct server-side execution.
    # Never move this initialization to import time or client code.
    if not firebase_admin._apps:
        cred = credentials.Certificate(firebase_credentials_path)
        firebase_admin.initialize_app(cred, {'storageBucket': firebase_storage_bucket})

    id_token = get_admin_id_token(
        firebase_api_key, admin_uid, firebase_auth, requests.post
    )
    auth_headers = {}
    if id_token:
        auth_headers["Authorization"] = f"Bearer {id_token}"
    if api_key:
        auth_headers["X-API-Key"] = api_key

    client = MongoClient(mongo_uri)
    db = client["rush-app"]

    # INVARIANT: the date gate and credential setup above must run before destructive reset calls.
    reset_database(db)
    clear_profile_pictures(storage)

    errors = seed_data(
        api_url, auth_headers, requests.post, requests.exceptions.RequestException, tqdm
    )

    if len(errors) > 0:
        print("There were some errors during the setup process:")
        for error in errors:
            print(error)
    else:
        print("Rush App Set Up Complete!")


# Keep all season resets behind direct execution; importing this module is read-only.
if __name__ == "__main__":
    main()
