#!/usr/bin/env python3
"""
Script to diagnose database slowness issues.
Checks for:
- Total number of rushees
- Total number of comments
- Large data fields
- Data malformation
"""

from pymongo import MongoClient
import time
import sys

# MongoDB connection
mongo_uri = "mongodb+srv://gtakpsisoftware:brznOWH0oPA9fT5N@gtakpsi.bf6r1.mongodb.net/"
client = MongoClient(mongo_uri)

db = client["rush-app"]
rushee_collection = db["rushees"]

def diagnose():
    print("=" * 60)
    print("Database Diagnostic Report")
    print("=" * 60)
    
    # Test 1: Count rushees
    print("\n1. Counting rushees...")
    start = time.time()
    count = rushee_collection.count_documents({})
    elapsed = time.time() - start
    print(f"   Total rushees: {count}")
    print(f"   Query time: {elapsed:.3f}s")
    
    # Test 2: Fetch all rushees and measure time
    print("\n2. Fetching all rushees...")
    start = time.time()
    rushees = list(rushee_collection.find({}))
    elapsed = time.time() - start
    print(f"   Fetch time: {elapsed:.3f}s")
    
    # Test 3: Analyze data sizes
    print("\n3. Analyzing data sizes...")
    total_comments = 0
    max_comments = 0
    max_comments_rushee = None
    total_pis_responses = 0
    max_pis = 0
    max_pis_rushee = None
    large_image_urls = []
    
    for rushee in rushees:
        name = f"{rushee.get('first_name', '?')} {rushee.get('last_name', '?')}"
        
        # Count comments
        comments = rushee.get('comments', [])
        num_comments = len(comments)
        total_comments += num_comments
        if num_comments > max_comments:
            max_comments = num_comments
            max_comments_rushee = name
        
        # Count PIS responses
        pis = rushee.get('pis', [])
        num_pis = len(pis)
        total_pis_responses += num_pis
        if num_pis > max_pis:
            max_pis = num_pis
            max_pis_rushee = name
        
        # Check image URL size (base64 images can be huge)
        image_url = rushee.get('image_url', '')
        if len(image_url) > 100000:  # > 100KB
            large_image_urls.append((name, len(image_url)))
    
    print(f"   Total comments across all rushees: {total_comments}")
    print(f"   Average comments per rushee: {total_comments / count if count > 0 else 0:.1f}")
    print(f"   Max comments on single rushee: {max_comments} ({max_comments_rushee})")
    print(f"   Total PIS responses: {total_pis_responses}")
    print(f"   Max PIS responses on single rushee: {max_pis} ({max_pis_rushee})")
    
    if large_image_urls:
        print(f"\n   ⚠️  Found {len(large_image_urls)} rushees with large image URLs (>100KB):")
        for name, size in large_image_urls[:5]:
            print(f"      - {name}: {size / 1024:.1f} KB")
    
    # Test 4: Check for malformed data
    print("\n4. Checking for malformed data...")
    issues_found = 0
    
    for rushee in rushees:
        name = f"{rushee.get('first_name', '?')} {rushee.get('last_name', '?')}"
        gtid = rushee.get('gtid', 'unknown')
        
        # Check comments structure
        comments = rushee.get('comments', [])
        if not isinstance(comments, list):
            print(f"   ❌ {name}: comments is not a list")
            issues_found += 1
            continue
            
        for i, comment in enumerate(comments):
            if not isinstance(comment, dict):
                print(f"   ❌ {name}: comment[{i}] is not a dict")
                issues_found += 1
                continue
            
            # Check required fields
            if 'brother_name' not in comment:
                print(f"   ❌ {name}: comment[{i}] missing brother_name")
                issues_found += 1
            if 'comment' not in comment:
                print(f"   ❌ {name}: comment[{i}] missing comment field")
                issues_found += 1
            if 'ratings' not in comment:
                print(f"   ❌ {name}: comment[{i}] missing ratings")
                issues_found += 1
            elif not isinstance(comment.get('ratings'), list):
                print(f"   ❌ {name}: comment[{i}] ratings is not a list")
                issues_found += 1
            if 'night' not in comment:
                print(f"   ❌ {name}: comment[{i}] missing night")
                issues_found += 1
            elif not isinstance(comment.get('night'), dict):
                print(f"   ❌ {name}: comment[{i}] night is not a dict")
                issues_found += 1
        
        # Check ratings structure
        ratings = rushee.get('ratings', [])
        if not isinstance(ratings, list):
            print(f"   ❌ {name}: ratings is not a list")
            issues_found += 1
    
    if issues_found == 0:
        print("   ✅ No malformed data found")
    else:
        print(f"   ❌ Found {issues_found} data issues")
    
    # Test 5: Test single rushee fetch time
    print("\n5. Testing single rushee fetch time...")
    if rushees:
        test_gtid = rushees[0].get('gtid')
        start = time.time()
        single = rushee_collection.find_one({"gtid": test_gtid})
        elapsed = time.time() - start
        print(f"   Single rushee fetch time: {elapsed:.3f}s")
    
    # Test 6: Check indexes
    print("\n6. Checking indexes...")
    indexes = rushee_collection.index_information()
    print(f"   Current indexes: {list(indexes.keys())}")
    
    if 'gtid_1' not in indexes:
        print("   ⚠️  Missing index on 'gtid' field - this will slow down lookups!")
    if 'sorting_status_1' not in indexes:
        print("   ⚠️  Missing index on 'sorting_status' field")
    
    # Test 7: Calculate document sizes
    print("\n7. Estimating document sizes...")
    import bson
    total_size = 0
    max_size = 0
    max_size_rushee = None
    
    for rushee in rushees:
        name = f"{rushee.get('first_name', '?')} {rushee.get('last_name', '?')}"
        size = len(bson.encode(rushee))
        total_size += size
        if size > max_size:
            max_size = size
            max_size_rushee = name
    
    print(f"   Total data size: {total_size / 1024 / 1024:.2f} MB")
    print(f"   Average document size: {total_size / count / 1024:.1f} KB" if count > 0 else "   No rushees")
    print(f"   Largest document: {max_size / 1024:.1f} KB ({max_size_rushee})")
    
    if max_size > 1024 * 1024:  # > 1MB
        print(f"   ⚠️  WARNING: Largest document is over 1MB - this is likely causing slowness!")
    
    print("\n" + "=" * 60)
    print("Diagnostic complete")
    print("=" * 60)

if __name__ == "__main__":
    diagnose()
