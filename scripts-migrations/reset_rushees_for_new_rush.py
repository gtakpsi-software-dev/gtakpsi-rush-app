"""
Prepare the database for a new rush cycle:
1. Delete all rushees NOT in the keep list
2. Reset kept rushees to post-registration state (clear comments, PIS answers,
   attendance, ratings, sorting data, etc.)
"""

import os
import sys
from pymongo import MongoClient
from dotenv import load_dotenv

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

# GTIDs of rushees to keep
KEEP_GTIDS = {
    "904093762",  # Aarav Sardana
    "904093480",  # Abhinav Pinisetti
    "904105404",  # Addison Marie Lewis
    "904127962",  # Adithiya Balaguru
    "904089682",  # Aditi Deshmukh
    "903980383",  # Aditya Belde
    "904095608",  # Anushka Agarwal
    "904125061",  # Anushka Ashwin Prabhu
    "903952769",  # Arka Bhattacharjee
    "904121424",  # Arnav Munjal
    "903977281",  # Chameli Tissera
    "904003896",  # Daniel Ruixuan Yang
    "904005511",  # Garv Jain
    "904121280",  # Gautam Reddy Khaji
    "904167024",  # Indira Dwivedi
    "904125538",  # Joanna George
    "904127022",  # Krishnasai Akula
    "903993361",  # Laya Andripalli
    "903991110",  # Nikunj Gupta
    "904122922",  # Om Tasgaonkar
    "903981832",  # Prisha Umashankar
    "904121543",  # Riya Ashwin Makan
    "904073218",  # Sanjana Jarugumilli
    "904116694",  # Siddhani Lahori
    "903960723",  # Srikar Gandikota
    "903960076",  # Stuti Thummala
    "904122885",  # Sunayna Singh
    "904099472",  # Vanee Pattani
    "904100267",  # Vivaan Sahni
}

# ── Step 1: Delete rushees NOT in keep list ──────────────────────────────────
total = collection.count_documents({})
print(f"\nTotal rushees in DB: {total}")

delete_result = collection.delete_many({"gtid": {"$nin": list(KEEP_GTIDS)}})
print(f"Deleted {delete_result.deleted_count} rushees not in keep list")

remaining = collection.count_documents({})
print(f"Remaining: {remaining} rushees")

# Verify all expected rushees are present
found_gtids = set(doc["gtid"] for doc in collection.find({}, {"gtid": 1}))
missing = KEEP_GTIDS - found_gtids
if missing:
    print(f"\nWARNING: These GTIDs were not found in the DB:")
    for gtid in missing:
        print(f"  {gtid}")
else:
    print("All 29 expected rushees are present ✓")

# ── Step 2: Reset kept rushees to post-registration state ────────────────────
print(f"\nResetting {remaining} rushees to post-registration state...")

reset_fields = {
    "pis": [],             # PIS interview answers
    "comments": [],        # Brother comments
    "attendance": [],      # Rush night attendance
    "ratings": [],         # Aggregate ratings
    "sorting_status": "UNSORTED",
    "sorting_notes": "",
    "sorting_tags": [],
    "sorting_order": 0,
    "notes_updated_at": None,
    "notes_updated_by": None,
    "status_updated_at": None,
    "status_updated_by": None,
    "rush_number": None,
    "cloud": "none",
}

update_result = collection.update_many(
    {"gtid": {"$in": list(KEEP_GTIDS)}},
    {"$set": reset_fields}
)

print(f"Reset {update_result.modified_count} rushees")

# ── Final summary ─────────────────────────────────────────────────────────────
print("\n── Summary ──────────────────────────────────────────")
sample = collection.find_one({"gtid": "904093762"})
if sample:
    print(f"Sample ({sample.get('first_name')} {sample.get('last_name')}):")
    print(f"  comments:    {len(sample.get('comments', []))}")
    print(f"  pis answers: {len(sample.get('pis', []))}")
    print(f"  attendance:  {len(sample.get('attendance', []))}")
    print(f"  ratings:     {len(sample.get('ratings', []))}")
    print(f"  sorting:     {sample.get('sorting_status')}")

print("\nDone! Database is ready for the new rush cycle.")
client.close()
