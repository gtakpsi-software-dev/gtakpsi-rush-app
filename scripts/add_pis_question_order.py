#!/usr/bin/env python3
"""
Script to replace all PIS questions in MongoDB with those from pis_questions.json.
This will DELETE all existing questions and INSERT the new ones.

Usage:
    cd /path/to/gtakpsi-rush-app/scripts
    source ../server/bin/activate
    python3 add_pis_question_order.py
"""

import os
import json
from dotenv import load_dotenv
from pymongo import MongoClient

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
print(f"Loading .env from: {os.path.abspath(env_path)}")
load_dotenv(dotenv_path=env_path)

MONGO_URI = os.getenv('MONGO_URI')

if not MONGO_URI:
    print("Error: MONGO_URI environment variable not set")
    print("Make sure you have a .env file with MONGO_URI in the project root")
    exit(1)

def main():
    print("Connecting to MongoDB...")
    client = MongoClient(MONGO_URI)
    db = client['rush-app']
    collection = db['pis-questions']
    
    # Load the questions from the JSON file
    json_path = os.path.join(os.path.dirname(__file__), '..', 'pis_questions.json')
    with open(json_path, 'r') as f:
        questions_from_json = json.load(f)
    
    print(f"\nLoaded {len(questions_from_json)} questions from pis_questions.json")
    
    # Show what's currently in the database
    existing_count = collection.count_documents({})
    print(f"Found {existing_count} questions currently in database")
    
    # Delete all existing questions
    print("\nDeleting all existing PIS questions...")
    delete_result = collection.delete_many({})
    print(f"  Deleted {delete_result.deleted_count} questions")
    
    # Insert all questions from JSON
    print("\nInserting new questions from pis_questions.json...")
    for q in questions_from_json:
        collection.insert_one(q)
        print(f"  ✓ Inserted (order {q.get('order', 'N/A')}): {q['question'][:60]}...")
    
    print(f"\n{'='*50}")
    print(f"Replacement complete!")
    print(f"  - Deleted: {delete_result.deleted_count} old questions")
    print(f"  - Inserted: {len(questions_from_json)} new questions")
    
    # Verify the update
    print(f"\nVerifying - Questions ordered by 'order' field:")
    final_questions = list(collection.find({}).sort('order', 1))
    for q in final_questions:
        order = q.get('order', 'N/A')
        qtype = q.get('question_type', 'N/A')
        print(f"  {order} [{qtype}]: {q['question'][:55]}...")
    
    client.close()
    print("\nDone!")

if __name__ == '__main__':
    main()
