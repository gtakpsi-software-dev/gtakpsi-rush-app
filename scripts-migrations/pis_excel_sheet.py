from datetime import datetime

import pandas as pd
from pymongo import MongoClient

from lib.mongo_config import resolve_mongo_uri


def format_datetime(dt):
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    return dt


def fetch_pis_signups(rushee_collection=None):
    if rushee_collection is None:
        client = MongoClient(resolve_mongo_uri(__file__))
        rushee_collection = client["rush-app"]["rushees"]

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


def create_excel(data):
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

    df = pd.DataFrame(flattened_data)

    output_file = "PIS_Signups.xlsx"
    df.to_excel(output_file, index=False)
    print(f"Excel sheet created: {output_file}")


if __name__ == "__main__":
    pis_signups = fetch_pis_signups()
    create_excel(pis_signups)
