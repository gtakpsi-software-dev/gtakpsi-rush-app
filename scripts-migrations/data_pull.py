from pymongo import MongoClient
from lib.mongo_config import resolve_mongo_uri
import pandas as pd


def main():
    # Keep the database read and local export inside direct command execution.
    mongo_uri = resolve_mongo_uri(__file__)
    client = MongoClient(mongo_uri)

    db = client["rush-app"]
    rushee_collection = db["rushees"]

    rushees = rushee_collection.find()

    data = []
    for rushee in rushees:
        data.append({
            'first_name': rushee.get('first_name', ''),
            'last_name': rushee.get('last_name', ''),
            'housing': rushee.get('housing', ''),
            'phone_number': rushee.get('phone_number', ''),
            'email': rushee.get('email', ''),
            'gtid': rushee.get('gtid', ''),
            'major': rushee.get('major', ''),
            'class': rushee.get('class', ''),
            'flex_window': 'Yes' if rushee.get('flex_window', False) else 'No'
        })

    df = pd.DataFrame(data, columns=[
        'first_name',
        'last_name',
        'housing',
        'phone_number',
        'email',
        'gtid',
        'major',
        'class',
        'flex_window'
    ])

    df.to_excel("rushees.xlsx", index=False)
    print("Data successfully written to rushees.xlsx")


if __name__ == "__main__":
    main()
