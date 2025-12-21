from pymongo import MongoClient
from datetime import datetime
import pandas as pd

# MongoDB connection
mongo_uri = "mongodb+srv://gtakpsisoftware:brznOWH0oPA9fT5N@gtakpsi.bf6r1.mongodb.net/"
client = MongoClient(mongo_uri)

# Access database and collection
db = client["rush-app"]
rushee_collection = db["rushees"]

def format_datetime(dt):
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d %H:%M:%S")  # Adjust the format as needed
    return dt

# Fetch PIS signup information
def fetch_pis_signups():
    pipeline = [
        {"$project": {
            "_id": 0,
            "first_name": 1,
            "last_name": 1,
            "pis_signup": {
                "time": 1,
                "rushee_first_name": 1,
                "rushee_last_name": 1,
                "rushee_gtid": 1,
                "first_brother_first_name": 1,
                "first_brother_last_name": 1,
                "second_brother_first_name": 1,
                "second_brother_last_name": 1,
            }
        }}
    ]
    return list(rushee_collection.aggregate(pipeline))

# Create Excel sheet
def create_excel(data):
    # Normalize the nested PISSignup data into a flat structure
    flattened_data = []
    for item in data:
        if "pis_signup" in item and item["pis_signup"]:
            flattened_data.append({
                "Rushee First Name": item["pis_signup"].get("rushee_first_name", ""),
                "Rushee Last Name": item["pis_signup"].get("rushee_last_name", ""),
                "Rushee GTID": item["pis_signup"].get("rushee_gtid", ""),
                "PIS Time": format_datetime(item["pis_signup"].get("time", "")),
                "First Brother First Name": item["pis_signup"].get("first_brother_first_name", ""),
                "First Brother Last Name": item["pis_signup"].get("first_brother_last_name", ""),
                "Second Brother First Name": item["pis_signup"].get("second_brother_first_name", ""),
                "Second Brother Last Name": item["pis_signup"].get("second_brother_last_name", ""),
            })

    # Create a DataFrame
    df = pd.DataFrame(flattened_data)

    # Save to Excel
    output_file = "PIS_Signups.xlsx"
    df.to_excel(output_file, index=False)
    print(f"Excel sheet created: {output_file}")

# Main function
if __name__ == "__main__":
    pis_signups = fetch_pis_signups()
    create_excel(pis_signups)
