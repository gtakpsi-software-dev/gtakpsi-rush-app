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
from firebase_admin import credentials, storage

# Restrict script from running between September 1st and September 12th
current_date = datetime.now()
if datetime(current_date.year, 9, 1) <= current_date <= datetime(current_date.year, 9, 12):
    print("This script cannot be run between September 1st and September 12th. [Spring 2025 Rush]")
    exit()

# Load environment variables from .env file
load_dotenv()

# setup .env variables
mongo_uri = os.getenv("MONGO_URI", "mongodb+srv://gtakpsisoftware:brznOWH0oPA9fT5N@gtakpsi.bf6r1.mongodb.net/")
api_url = os.getenv("API")
firebase_credentials_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-service-account.json")
firebase_storage_bucket = os.getenv("FIREBASE_STORAGE_BUCKET")

# Initialize Firebase Admin SDK
if not firebase_admin._apps:
    cred = credentials.Certificate(firebase_credentials_path)
    firebase_admin.initialize_app(cred, {
        'storageBucket': firebase_storage_bucket
    })

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
        response = requests.post(api_url + "/admin/add_pis_timeslot", json=data[i])
        
        if response.status_code == 200:
            if response.json().get("status") == "error":
                errors.append(response.json().get("message"))
        else:
            errors.append(f"Some network error occurred while adding PIS Timeslot at {data[i]['time']}")


# add rush nights
with open("rush_nights.json", "r") as file:

    data = json.load(file)

    for i in tqdm(range(len(data)), desc="Adding Rush Nights"):
        response = requests.post(api_url + "/admin/add-rush-night", json=data[i])
        
        if response.status_code == 200:
            if response.json().get("status") == "error":
                errors.append(response.json().get("message"))
        else:
            errors.append(f"Some network error occurred while adding Rush Night {data[i]['name']}")

with open("pis_questions.json", "r") as file:

    data = json.load(file)

    for i in tqdm(range(len(data)), desc="Adding PIS Questions"):
        response = requests.post(api_url + "/admin/add_pis_question", json=data[i])
        
        if response.status_code == 200:
            if response.json().get("status") == "error":
                errors.append(response.json().get("message"))
        else:
            errors.append(f"Some network error occurred while adding PIS Question {data[i]['question']}")


if len(errors) > 0:

    print("There were some errors during the setup process:")

    for error in errors:
        print(error)

else:
    print("Rush App Set Up Complete!")