'''

A simple python script to safely and quickly setup the rush app.

Add info as needed into rush_nights.json and pis_timeslots.json

'''

from pymongo import MongoClient
from dotenv import load_dotenv
from tqdm import tqdm
from datetime import datetime

import os
import requests
import firebase_admin
from firebase_admin import credentials, storage, auth as firebase_auth
from scripts.season_setup.authentication import get_admin_id_token
from scripts.season_setup.reset import clear_profile_pictures, reset_database
from scripts.season_setup.seeds import seed_data


def main():
    # INVARIANT: importing this module must not reach the season reset.
    # Restrict script from running between September 1st and September 12th
    current_date = datetime.now()
    if datetime(current_date.year, 9, 1) <= current_date <= datetime(current_date.year, 9, 12):
        print("This script cannot be run between September 1st and September 12th. [Spring 2025 Rush]")
        exit()

    # Load environment variables from .env file
    load_dotenv()

    # setup .env variables
    mongo_uri = os.getenv("MONGO_URI")
    api_url = os.getenv("API")
    firebase_credentials_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-service-account.json")
    firebase_storage_bucket = os.getenv("FIREBASE_STORAGE_BUCKET")
    firebase_api_key = os.getenv("FIREBASE_API_KEY")  # Web API key from Firebase console
    admin_uid = os.getenv("ADMIN_UID")  # UID of an admin user
    api_key = os.getenv("API_KEY")  # Server API key for X-API-Key header

    # Service-account credentials must stay in direct server-side execution.
    # Never move this initialization to import time or client code.
    if not firebase_admin._apps:
        cred = credentials.Certificate(firebase_credentials_path)
        firebase_admin.initialize_app(cred, {
            'storageBucket': firebase_storage_bucket
        })

    # Get auth headers for API requests
    id_token = get_admin_id_token(firebase_api_key, admin_uid, firebase_auth, requests.post)
    auth_headers = {}
    if id_token:
        auth_headers["Authorization"] = f"Bearer {id_token}"
    if api_key:
        auth_headers["X-API-Key"] = api_key

    # Connect to MongoDB
    client = MongoClient(mongo_uri)

    # Access a database
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


if __name__ == "__main__":
    main()
