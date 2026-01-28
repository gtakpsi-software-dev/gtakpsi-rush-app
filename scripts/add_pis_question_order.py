#!/usr/bin/env python3
"""
Migration script to add 'order' field to existing PIS questions in MongoDB.
This script will NOT delete or reset any data - it only adds the order field.

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
    
    # Load the questions with order from the JSON file
    json_path = os.path.join(os.path.dirname(__file__), '..', 'pis_questions.json')
    with open(json_path, 'r') as f:
        questions_from_json = json.load(f)
    
    # Create a mapping of question text to order
    order_mapping = {q['question']: q['order'] for q in questions_from_json}
    
    print(f"\nLoaded {len(order_mapping)} questions from pis_questions.json")
    
    # Fetch all existing questions from the database
    existing_questions = list(collection.find({}))
    print(f"Found {len(existing_questions)} questions in database")
    
    updated_count = 0
    not_found_in_json = []
    
    for question_doc in existing_questions:
        question_text = question_doc.get('question')
        current_order = question_doc.get('order')
        
        if question_text in order_mapping:
            new_order = order_mapping[question_text]
            
            # Only update if order is missing or different
            if current_order != new_order:
                result = collection.update_one(
                    {'_id': question_doc['_id']},
                    {'$set': {'order': new_order}}
                )
                if result.modified_count > 0:
                    print(f"  ✓ Updated order for: \"{question_text[:50]}...\" -> order {new_order}")
                    updated_count += 1
            else:
                print(f"  - Already has order {current_order}: \"{question_text[:50]}...\"")
        else:
            not_found_in_json.append(question_text)
            # Assign a high order number for questions not in the JSON
            if current_order is None:
                # Find the max order and add to it
                max_order = max(order_mapping.values()) if order_mapping else 0
                new_order = max_order + len(not_found_in_json)
                collection.update_one(
                    {'_id': question_doc['_id']},
                    {'$set': {'order': new_order}}
                )
                print(f"  ⚠ Question not in JSON, assigned order {new_order}: \"{question_text[:50]}...\"")
                updated_count += 1
    
    print(f"\n{'='*50}")
    print(f"Migration complete!")
    print(f"  - Updated: {updated_count} questions")
    print(f"  - Questions not in JSON: {len(not_found_in_json)}")
    
    if not_found_in_json:
        print(f"\nQuestions in DB but not in pis_questions.json:")
        for q in not_found_in_json:
            print(f"  - {q[:70]}...")
    
    # Verify the update
    print(f"\nVerifying - Questions ordered by 'order' field:")
    updated_questions = list(collection.find({}).sort('order', 1))
    for q in updated_questions:
        order = q.get('order', 'N/A')
        print(f"  {order}: {q['question'][:60]}...")
    
    client.close()
    print("\nDone!")

if __name__ == '__main__':
    main()
