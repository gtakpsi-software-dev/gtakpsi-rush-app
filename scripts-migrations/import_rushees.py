"""
Import rushees from rush-app.rushees.json into MongoDB.
Preserves all fields including comments, PIS, sorting data, etc.
"""

import json
import os
import sys

from dotenv import load_dotenv
from pymongo import MongoClient

from lib.extended_json import convert_dates


def main():
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

    json_path = os.path.join(os.path.dirname(__file__), '..', 'rush-app.rushees.json')
    print(f"Loading {json_path}...")
    with open(json_path, 'r') as file:
        rushees = json.load(file)

    print(f"Found {len(rushees)} rushees in JSON file")

    # INVARIANT: finish loading the input before deleting any existing rushees.
    print("Clearing existing rushees...")
    result = collection.delete_many({})
    print(f"Deleted {result.deleted_count} existing rushees")

    print("Converting and inserting rushees...")
    converted = [convert_dates(rushee) for rushee in rushees]

    result = collection.insert_many(converted)
    print(f"Successfully inserted {len(result.inserted_ids)} rushees!")

    count = collection.count_documents({})
    print(f"Verified: {count} rushees now in database")

    client.close()
    print("Done!")


if __name__ == "__main__":
    main()
