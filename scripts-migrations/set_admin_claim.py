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
from maintenance_commands.firebase_claims import apply_role_claims


def initialize_firebase():
    # Service-account credentials must be loaded only on the server-side command path.
    cred = credentials.Certificate("../firebase-service-account.json")
    firebase_admin.initialize_app(cred)


def set_custom_claims(email: str, is_admin: bool = False, is_bidcom: bool = False):
    """Set custom claims for a user by email."""
    if not firebase_admin._apps:
        initialize_firebase()

    return apply_role_claims(auth, email, is_admin, is_bidcom)


def main():
    initialize_firebase()

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
