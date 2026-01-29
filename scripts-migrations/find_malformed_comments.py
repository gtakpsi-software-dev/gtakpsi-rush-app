#!/usr/bin/env python3
"""
Script to find malformed comment data in the MongoDB database
that could be causing dashboard loading errors.
"""

import pymongo
from pymongo import MongoClient
import json
from datetime import datetime
import sys

# MongoDB connection string from your codebase
MONGO_URL = "mongodb+srv://gtakpsisoftware:brznOWH0oPA9fT5N@gtakpsi.bf6r1.mongodb.net/?connectTimeoutMS=3000&socketTimeoutMS=300000"

def connect_to_database():
    """Connect to MongoDB database"""
    try:
        client = MongoClient(MONGO_URL)
        db = client["rush-app"]
        collection = db["rushees"]
        
        # Test connection
        client.admin.command('ping')
        print("✅ Successfully connected to MongoDB")
        return collection
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        sys.exit(1)

def check_comment_structure(comment, rushee_info):
    """Check if a comment has all required fields with correct types"""
    issues = []
    
    # Required fields for Comment struct
    required_fields = [
        'brother_id',
        'brother_name', 
        'comment',
        'ratings',
        'night'
    ]
    
    # Check for missing fields
    for field in required_fields:
        if field not in comment:
            issues.append(f"Missing field: {field}")
    
    # Check field types and nested structures
    if 'brother_id' in comment and not isinstance(comment['brother_id'], str):
        issues.append(f"brother_id should be string, got {type(comment['brother_id'])}")
    
    if 'brother_name' in comment and not isinstance(comment['brother_name'], str):
        issues.append(f"brother_name should be string, got {type(comment['brother_name'])}")
    
    if 'comment' in comment and not isinstance(comment['comment'], str):
        issues.append(f"comment should be string, got {type(comment['comment'])}")
    
    if 'ratings' in comment:
        if not isinstance(comment['ratings'], list):
            issues.append(f"ratings should be array, got {type(comment['ratings'])}")
        else:
            # Check each rating structure
            for i, rating in enumerate(comment['ratings']):
                if not isinstance(rating, dict):
                    issues.append(f"ratings[{i}] should be object, got {type(rating)}")
                    continue
                
                if 'name' not in rating:
                    issues.append(f"ratings[{i}] missing 'name' field")
                elif not isinstance(rating['name'], str):
                    issues.append(f"ratings[{i}].name should be string, got {type(rating['name'])}")
                
                if 'value' not in rating:
                    issues.append(f"ratings[{i}] missing 'value' field")
                elif not isinstance(rating['value'], (int, float)):
                    issues.append(f"ratings[{i}].value should be number, got {type(rating['value'])}")
    
    if 'night' in comment:
        if not isinstance(comment['night'], dict):
            issues.append(f"night should be object, got {type(comment['night'])}")
        else:
            # Check RushNight structure
            if 'name' not in comment['night']:
                issues.append("night missing 'name' field")
            elif not isinstance(comment['night']['name'], str):
                issues.append(f"night.name should be string, got {type(comment['night']['name'])}")
            
            if 'time' not in comment['night']:
                issues.append("night missing 'time' field")
            # Note: time could be various formats (DateTime, string, etc.)
    
    return issues

def find_malformed_comments():
    """Find all rushees with malformed comment data"""
    collection = connect_to_database()
    
    print("\n🔍 Scanning for malformed comment data...")
    print("=" * 60)
    
    total_rushees = 0
    problematic_rushees = 0
    total_issues = 0
    
    try:
        # Get all rushees
        cursor = collection.find({})
        
        for rushee in cursor:
            total_rushees += 1
            rushee_info = f"{rushee.get('first_name', 'Unknown')} {rushee.get('last_name', 'Unknown')} (GTID: {rushee.get('gtid', 'Unknown')})"
            
            # Check if comments field exists and is an array
            if 'comments' not in rushee:
                print(f"⚠️  {rushee_info}")
                print(f"   Missing 'comments' field entirely")
                problematic_rushees += 1
                total_issues += 1
                continue
            
            if not isinstance(rushee['comments'], list):
                print(f"⚠️  {rushee_info}")
                print(f"   'comments' should be array, got {type(rushee['comments'])}")
                problematic_rushees += 1
                total_issues += 1
                continue
            
            # Check each comment in the comments array
            rushee_has_issues = False
            for i, comment in enumerate(rushee['comments']):
                if not isinstance(comment, dict):
                    if not rushee_has_issues:
                        print(f"❌ {rushee_info}")
                        rushee_has_issues = True
                    print(f"   Comment {i}: Should be object, got {type(comment)}")
                    total_issues += 1
                    continue
                
                issues = check_comment_structure(comment, rushee_info)
                if issues:
                    if not rushee_has_issues:
                        print(f"❌ {rushee_info}")
                        rushee_has_issues = True
                    print(f"   Comment {i} issues:")
                    for issue in issues:
                        print(f"     - {issue}")
                        total_issues += 1
            
            if rushee_has_issues:
                problematic_rushees += 1
                print()  # Empty line for readability
    
    except Exception as e:
        print(f"❌ Error scanning database: {e}")
        return
    
    # Summary
    print("=" * 60)
    print("📊 SCAN SUMMARY")
    print("=" * 60)
    print(f"Total rushees scanned: {total_rushees}")
    print(f"Rushees with issues: {problematic_rushees}")
    print(f"Total issues found: {total_issues}")
    
    if problematic_rushees == 0:
        print("\n✅ No malformed comment data found!")
        print("The dashboard issue might be caused by something else.")
    else:
        print(f"\n⚠️  Found {problematic_rushees} rushees with malformed comment data.")
        print("This is likely causing your dashboard loading errors.")
        
        # Provide fix suggestions
        print("\n🔧 SUGGESTED FIXES:")
        print("1. Use the cleanup script to fix malformed data")
        print("2. Or manually review and fix the problematic rushees listed above")
        print("3. Restart your Rust server after fixing the data")

def main():
    print("🔍 MongoDB Comment Structure Validator")
    print("=" * 60)
    print("This script will scan your MongoDB database for malformed comment data")
    print("that could be causing dashboard loading errors.\n")
    
    find_malformed_comments()

if __name__ == "__main__":
    main()



