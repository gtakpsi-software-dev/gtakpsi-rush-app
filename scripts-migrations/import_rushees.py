"""
Import rushees from rush-app.rushees.json into MongoDB.
Preserves all fields including comments, PIS, sorting data, etc.
"""

import json
import os
import sys
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

mongo_uri = os.getenv("MONGO_URI")
if not mongo_uri:
    print("ERROR: MONGO_URI not set in .env")
    sys.exit(1)

print("Connecting to MongoDB...")
client = MongoClient(mongo_uri, serverSelectionTimeoutMS=10000)
client.admin.command('ping')
print("Connected!")

db = client["rush-app"]
collection = db["rushees"]

# Load the JSON file
json_path = os.path.join(os.path.dirname(__file__), '..', 'rush-app.rushees.json')
print(f"Loading {json_path}...")
with open(json_path, 'r') as f:
    rushees = json.load(f)

print(f"Found {len(rushees)} rushees in JSON file")

def convert_dates(obj):
    """Recursively convert $date strings to Python datetime objects for BSON."""
    if isinstance(obj, dict):
        # Handle MongoDB extended JSON $oid
        if '$oid' in obj:
            return ObjectId(obj['$oid'])
        # Handle MongoDB extended JSON $date
        if '$date' in obj:
            date_val = obj['$date']
            if isinstance(date_val, str):
                # Parse ISO format date string
                date_val = date_val.replace('Z', '+00:00')
                return datetime.fromisoformat(date_val)
            elif isinstance(date_val, dict) and '$numberLong' in date_val:
                # Handle $numberLong milliseconds
                ms = int(date_val['$numberLong'])
                return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
        return {k: convert_dates(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_dates(item) for item in obj]
    return obj

# Clear existing rushees
print("Clearing existing rushees...")
result = collection.delete_many({})
print(f"Deleted {result.deleted_count} existing rushees")

# Convert and insert
print("Converting and inserting rushees...")
converted = [convert_dates(r) for r in rushees]

result = collection.insert_many(converted)
print(f"Successfully inserted {len(result.inserted_ids)} rushees!")

# Verify
count = collection.count_documents({})
print(f"Verified: {count} rushees now in database")

client.close()
print("Done!")
