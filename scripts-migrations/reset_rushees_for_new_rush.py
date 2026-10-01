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
from maintenance_commands.season_rushees import prepare_rushees_for_rush

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



def main():
    # INVARIANT: importing this module must never reach the season reset.
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        print("ERROR: MONGO_URI not set in .env")
        sys.exit(1)

    print("Connecting to MongoDB...")
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=10000)
    prepare_rushees_for_rush(client, KEEP_GTIDS)


if __name__ == "__main__":
    main()
