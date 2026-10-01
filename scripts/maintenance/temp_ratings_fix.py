from pymongo import MongoClient
from lib.mongo_config import resolve_mongo_uri
from tqdm import tqdm

from maintenance_commands.rating_repair import average_ratings


def main():
    mongo_uri = resolve_mongo_uri(__file__)
    client = MongoClient(mongo_uri)

    db = client["rush-app"]
    rushee_collection = db["rushees"]

    rushees = list(rushee_collection.find())

    print("Loading...")

    for rushee in tqdm(rushees, desc="Fixing Ratings", total=len(rushees)):
        new_ratings = average_ratings(rushee.get("comments", []))

        rushee_collection.update_one(
            {"gtid": rushee["gtid"]},
            {"$set": {"ratings": new_ratings}},
        )


if __name__ == "__main__":
    main()
