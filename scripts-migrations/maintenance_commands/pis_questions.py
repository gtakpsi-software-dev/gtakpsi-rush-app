"""Keep the PIS question replacement order and entrypoint-relative paths together.

The command supplies its entrypoint path so moving this implementation does
not change which root .env and canonical season seed file it reads.
"""

import json
import os


def replace_questions(script_path, load_dotenv, mongo_client):
    env_path = os.path.join(os.path.dirname(script_path), '..', '.env')
    print(f"Loading .env from: {os.path.abspath(env_path)}")
    load_dotenv(dotenv_path=env_path)

    mongo_uri = os.getenv('MONGO_URI')

    if not mongo_uri:
        print("Error: MONGO_URI environment variable not set")
        print("Make sure you have a .env file with MONGO_URI in the project root")
        exit(1)

    print("Connecting to MongoDB...")
    client = mongo_client(mongo_uri)
    db = client['rush-app']
    collection = db['pis-questions']

    json_path = os.path.join(
        os.path.dirname(script_path), '..', 'data', 'season_seed', 'pis_questions.json'
    )
    with open(json_path, 'r') as f:
        questions_from_json = json.load(f)

    print(f"\nLoaded {len(questions_from_json)} questions from pis_questions.json")

    existing_count = collection.count_documents({})
    print(f"Found {existing_count} questions currently in database")

    # Preserve delete-before-insert order; changing it alters partial-failure behavior.
    print("\nDeleting all existing PIS questions...")
    delete_result = collection.delete_many({})
    print(f"  Deleted {delete_result.deleted_count} questions")

    print("\nInserting new questions from pis_questions.json...")
    for q in questions_from_json:
        collection.insert_one(q)
        print(f"  ✓ Inserted (order {q.get('order', 'N/A')}): {q['question'][:60]}...")

    print(f"\n{'='*50}")
    print(f"Replacement complete!")
    print(f"  - Deleted: {delete_result.deleted_count} old questions")
    print(f"  - Inserted: {len(questions_from_json)} new questions")

    print(f"\nVerifying - Questions ordered by 'order' field:")
    final_questions = list(collection.find({}).sort('order', 1))
    for q in final_questions:
        order = q.get('order', 'N/A')
        qtype = q.get('question_type', 'N/A')
        print(f"  {order} [{qtype}]: {q['question'][:55]}...")

    client.close()
    print("\nDone!")
