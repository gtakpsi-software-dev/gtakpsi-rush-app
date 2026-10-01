from pymongo import MongoClient
from lib.mongo_config import resolve_mongo_uri
import pandas as pd
from tqdm import tqdm

import requests

def main():
    mongo_uri = resolve_mongo_uri(__file__)
    client = MongoClient(mongo_uri)

    db = client["rush-app"]
    rushee_collection = db["rushees"]

    rushees = list(rushee_collection.find())

    print("Loading...")

    for rushee in tqdm(rushees, desc="Fixing Ratings", total=len(rushees)):

        # Each comment contributes equally to the historical arithmetic mean; no outliers are filtered.
        comments = rushee.get("comments", [])

        curr_ratings_numerator = {}
        curr_ratings_n = {}

        for comment in comments:
            for rating in comment.get("ratings", []):
            
                if rating.get("name") in curr_ratings_n:
                    curr_ratings_n[rating.get("name")] += 1
                    curr_ratings_numerator[rating.get("name")] += rating.get("value")
                else:
                    curr_ratings_n[rating.get("name")] = 1
                    curr_ratings_numerator[rating.get("name")] = rating.get("value")

        new_ratings = []
        for key in curr_ratings_n.keys():
            new_ratings.append({
                "name": key,
                "value": curr_ratings_numerator[key] / curr_ratings_n[key]
            })

        rushee_collection.update_one(
            {"gtid": rushee["gtid"]},
            {"$set": {"ratings": new_ratings}}
        )


if __name__ == "__main__":
    main()
