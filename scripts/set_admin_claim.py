#!/usr/bin/env python3
"""
Script to set admin and/or bidcom custom claims on Firebase users.
Usage: python3 set_admin_claim.py <email> [--admin] [--bidcom]

Examples:
  python3 set_admin_claim.py ayangoel91@gmail.com --admin
  python3 set_admin_claim.py someone@gatech.edu --admin --bidcom
  python3 set_admin_claim.py someone@gatech.edu --bidcom
"""

import sys
import firebase_admin
from firebase_admin import credentials, auth

# Initialize Firebase Admin SDK
cred = credentials.Certificate("../firebase-service-account.json")
firebase_admin.initialize_app(cred)

def set_custom_claims(email: str, is_admin: bool = False, is_bidcom: bool = False):
    """Set custom claims for a user by email."""
    try:
        # Get user by email
        user = auth.get_user_by_email(email)
        print(f"Found user: {user.uid} ({user.email})")
        
        # Get existing claims
        existing_claims = user.custom_claims or {}
        print(f"Existing claims: {existing_claims}")
        
        # Update claims
        new_claims = {**existing_claims}
        if is_admin:
            new_claims['admin'] = True
        if is_bidcom:
            new_claims['bidcom'] = True
            
        # Set the custom claims
        auth.set_custom_user_claims(user.uid, new_claims)
        
        print(f"Successfully set claims for {email}:")
        print(f"  admin: {new_claims.get('admin', False)}")
        print(f"  bidcom: {new_claims.get('bidcom', False)}")
        print("\n⚠️  IMPORTANT: The user must log out and log back in for the new claims to take effect!")
        
    except auth.UserNotFoundError:
        print(f"Error: No user found with email {email}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    
    email = sys.argv[1]
    is_admin = '--admin' in sys.argv
    is_bidcom = '--bidcom' in sys.argv
    
    if not is_admin and not is_bidcom:
        print("Error: You must specify at least one of --admin or --bidcom")
        print(__doc__)
        sys.exit(1)
    
    set_custom_claims(email, is_admin, is_bidcom)

if __name__ == "__main__":
    main()
