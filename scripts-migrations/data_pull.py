import pandas as pd
from pymongo import MongoClient

from lib.mongo_config import resolve_mongo_uri
from maintenance_commands.rushee_export import RUSHEE_EXPORT_COLUMNS, rushee_export_rows


def main():
    # Keep the database read and local export inside direct command execution.
    mongo_uri = resolve_mongo_uri(__file__)
    client = MongoClient(mongo_uri)

    db = client["rush-app"]
    rushee_collection = db["rushees"]

    rushees = rushee_collection.find()

    df = pd.DataFrame(rushee_export_rows(rushees), columns=RUSHEE_EXPORT_COLUMNS)

    df.to_excel("rushees.xlsx", index=False)
    print("Data successfully written to rushees.xlsx")


if __name__ == "__main__":
    main()
