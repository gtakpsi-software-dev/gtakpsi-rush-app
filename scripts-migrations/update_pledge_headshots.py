"""
Upload pledge headshots to Firebase Storage and update image_url in MongoDB.
"""

import os
import sys
import time
import io
from pymongo import MongoClient
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, storage
from PIL import Image, ImageOps

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

mongo_uri = os.getenv("MONGO_URI")
firebase_credentials_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-service-account.json")
firebase_storage_bucket = os.getenv("FIREBASE_STORAGE_BUCKET")

if not firebase_admin._apps:
    cred = credentials.Certificate(firebase_credentials_path)
    firebase_admin.initialize_app(cred, {'storageBucket': firebase_storage_bucket})

print("Connecting to MongoDB...")
client = MongoClient(mongo_uri, serverSelectionTimeoutMS=10000)
client.admin.command('ping')
db = client["rush-app"]
collection = db["rushees"]
print("Connected!")

# Map filename (without extension) → GTID
FILENAME_TO_GTID = {
    "aarav-sardana":       "904093762",
    "abhinav-pinisetti":   "904093480",
    "addison-lewis":       "904105404",
    "adi-belde":           "903980383",
    "adithiya-balaguru":   "904127962",
    "aditi-deshmukh":      "904089682",
    "anushka-agarwal":     "904095608",
    "anushka-prabhu":      "904125061",
    "arka-battacharjee":   "903952769",
    "arnav-munjal":        "904121424",
    "chameli-tissera":     "903977281",
    "daniel-yang":         "904003896",
    "garv-jain":           "904005511",
    "gautam-khaji":        "904121280",
    "indira-dwivedi":      "904167024",
    "joanna-george":       "904125538",
    "krishnasai-akula":    "904127022",
    "laya-andripalli":     "903993361",
    "nikunj-gupta":        "903991110",
    "om-tasgoankar":       "904122922",
    "prisha-umashankar":   "903981932",
    "riya-makan":          "904121543",
    "sanjana-jarugumilli": "904073218",
    "siddhani-lahori":     "904116694",
    "srikar-gandikota":    "903960723",
    "stuti-thummala":      "903960076",
    "sunayna-singh":       "904122885",
    "vanee-pattani":       "904099472",
    "vivaan-sahni":        "904100267",
}

headshots_dir = os.path.join(os.path.dirname(__file__), '..', 'Pledge Headshots')
bucket = storage.bucket()

success = 0
errors = []

for filename in sorted(os.listdir(headshots_dir)):
    if not filename.lower().endswith(('.jpeg', '.jpg', '.png')):
        continue

    stem = os.path.splitext(filename)[0]
    gtid = FILENAME_TO_GTID.get(stem)

    if not gtid:
        errors.append(f"  No GTID mapping for: {filename}")
        continue

    rushee = collection.find_one({"gtid": gtid})
    if not rushee:
        errors.append(f"  Rushee not found in DB for GTID {gtid} ({stem})")
        continue

    file_path = os.path.join(headshots_dir, filename)
    timestamp = int(time.time() * 1000)
    blob_name = f"profile-pictures/{gtid}_{timestamp}.jpg"

    try:
        # Compress: fix EXIF rotation first, then resize to max 600px, quality 82
        img = Image.open(file_path)
        img = ImageOps.exif_transpose(img)  # Apply EXIF orientation before stripping metadata
        img = img.convert("RGB")
        img.thumbnail((600, 600), Image.LANCZOS)
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=82, optimize=True)
        compressed_size = buffer.tell()
        buffer.seek(0)

        original_size = os.path.getsize(file_path)
        print(f"  {stem}: {original_size//1024}KB → {compressed_size//1024}KB", end=" | ")

        blob = bucket.blob(blob_name)
        blob.upload_from_file(buffer, content_type="image/jpeg")
        blob.make_public()
        url = blob.public_url

        collection.update_one({"gtid": gtid}, {"$set": {"image_url": url}})

        name = f"{rushee.get('first_name')} {rushee.get('last_name')}"
        print(f"✓ {name}")
        success += 1

    except Exception as e:
        errors.append(f"  ✗ {stem} ({gtid}): {e}")

print(f"\n── Results ──────────────────────────────")
print(f"Updated: {success} rushees")
if errors:
    print(f"Errors ({len(errors)}):")
    for e in errors:
        print(e)
else:
    print("No errors!")

client.close()
