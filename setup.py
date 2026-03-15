'''

A simple python script to safely and quickly setup the rush app.

Add info as needed into rush_nights.json and pis_timeslots.json

'''

from pymongo import MongoClient
from dotenv import load_dotenv
from tqdm import tqdm
from datetime import datetime

import json
import os
import requests
import firebase_admin
from firebase_admin import credentials, storage, auth as firebase_auth

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

# Initialize Firebase Admin SDK
if not firebase_admin._apps:
    cred = credentials.Certificate(firebase_credentials_path)
    firebase_admin.initialize_app(cred, {
        'storageBucket': firebase_storage_bucket
    })

# Get an ID token for API authentication
def get_admin_id_token():
    """Generate an ID token for an admin user to authenticate API requests."""
    if not firebase_api_key:
        print("Warning: FIREBASE_API_KEY not set in .env - API requests may fail")
        return None
    if not admin_uid:
        print("Warning: ADMIN_UID not set in .env - API requests may fail")
        return None
    
    try:
        # Create a custom token for the admin user
        custom_token = firebase_auth.create_custom_token(admin_uid)
        
        # Exchange custom token for an ID token using Firebase Auth REST API
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={firebase_api_key}"
        response = requests.post(url, json={
            "token": custom_token.decode('utf-8') if isinstance(custom_token, bytes) else custom_token,
            "returnSecureToken": True
        })
        
        if response.status_code == 200:
            id_token = response.json().get("idToken")
            print("Successfully obtained admin authentication token")
            return id_token
        else:
            print(f"Failed to get ID token: {response.json()}")
            return None
    except Exception as e:
        print(f"Error getting admin token: {e}")
        return None

# Get auth headers for API requests
id_token = get_admin_id_token()
auth_headers = {}
if id_token:
    auth_headers["Authorization"] = f"Bearer {id_token}"
if api_key:
    auth_headers["X-API-Key"] = api_key

# Connect to MongoDB
client = MongoClient(mongo_uri)

# Access a database
db = client["rush-app"]

# delete all rushees
print("Deleting all rushees...")
rushee_collection = db["rushees"]
rushee_collection.delete_many({})
print("Deleted all rushees")

# delete all rush nights
print("Deleting all rush nights...")
rush_night_collection = db["rush-nights"]
rush_night_collection.delete_many({})
print("Deleted all rush nights")

# delete all pis timeslots
print("Deleting all PIS timeslots...")
pis_timeslot_collection = db["pis-timeslots"]
pis_timeslot_collection.delete_many({})
print("Deleted all PIS timeslots.")

# delete all PIS questions
print("Deleting all PIS questions...")
pis_question_collection = db["pis-questions"]
pis_question_collection .delete_many({})
print("Deleted all PIS questions.")

print("Deleting all Rush App pictures from Firebase Storage...")

# delete all rushee pics from Firebase Storage
try:
    bucket = storage.bucket()
    
    # List all blobs in the profile-pictures folder
    blobs = bucket.list_blobs(prefix="profile-pictures/")
    
    deleted_count = 0
    for blob in blobs:
        blob.delete()
        deleted_count += 1
    
    print(f"Deleted {deleted_count} rush app pictures from Firebase Storage.")

except Exception as e:
    print(f"Error while deleting rush app pictures: {e}")

errors = []

# add pis timeslots
with open("pis_timeslots.json", "r") as file:
    data = json.load(file)

    for i in tqdm(range(len(data)), desc="Adding PIS Timeslots"):
        try:
            response = requests.post(
                api_url + "/admin/add_pis_timeslot", 
                json=data[i],
                headers=auth_headers
            )
            
            if response.status_code == 200:
                if response.json().get("status") == "error":
                    errors.append(response.json().get("message"))
            else:
                errors.append(f"Error adding PIS Timeslot at {data[i]['time']}: HTTP {response.status_code}")
        except requests.exceptions.RequestException as e:
            errors.append(f"Network error adding PIS Timeslot at {data[i]['time']}: {e}")


# add rush nights
with open("rush_nights.json", "r") as file:

    data = json.load(file)

    for i in tqdm(range(len(data)), desc="Adding Rush Nights"):
        try:
            response = requests.post(
                api_url + "/admin/add-rush-night", 
                json=data[i],
                headers=auth_headers
            )
            
            if response.status_code == 200:
                if response.json().get("status") == "error":
                    errors.append(response.json().get("message"))
            else:
                errors.append(f"Error adding Rush Night {data[i]['name']}: HTTP {response.status_code}")
        except requests.exceptions.RequestException as e:
            errors.append(f"Network error adding Rush Night {data[i]['name']}: {e}")

with open("pis_questions.json", "r") as file:

    data = json.load(file)

    for i in tqdm(range(len(data)), desc="Adding PIS Questions"):
        try:
            response = requests.post(
                api_url + "/admin/add_pis_question", 
                json=data[i],
                headers=auth_headers
            )
            
            if response.status_code == 200:
                if response.json().get("status") == "error":
                    errors.append(response.json().get("message"))
            else:
                errors.append(f"Error adding PIS Question: HTTP {response.status_code}")
        except requests.exceptions.RequestException as e:
            errors.append(f"Network error adding PIS Question {data[i]['question']}: {e}")


if len(errors) > 0:

    print("There were some errors during the setup process:")

    for error in errors:
        print(error)

else:
    print("Rush App Set Up Complete!")