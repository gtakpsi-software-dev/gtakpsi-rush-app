import pandas as pd
from pymongo import MongoClient

from lib.mongo_config import resolve_mongo_uri
from maintenance_commands.pis_export import flatten_pis_signups, format_datetime


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
    df = pd.DataFrame(flatten_pis_signups(data))

    output_file = "PIS_Signups.xlsx"
    df.to_excel(output_file, index=False)
    print(f"Excel sheet created: {output_file}")


if __name__ == "__main__":
    pis_signups = fetch_pis_signups()
    create_excel(pis_signups)
