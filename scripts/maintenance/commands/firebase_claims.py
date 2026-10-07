"""Apply admin and bid-committee claims through an injected Firebase Auth client."""

import sys


def apply_role_claims(auth, email, is_admin, is_bidcom):
    try:
        user = auth.get_user_by_email(email)
        print(f"Found user: {user.uid} ({user.email})")

        existing_claims = user.custom_claims or {}
        print(f"Existing claims: {existing_claims}")

        new_claims = {**existing_claims}
        if is_admin:
            new_claims['admin'] = True
        if is_bidcom:
            new_claims['bidcom'] = True

        # Preserve unrelated claims when adding one role to a Firebase user.
        auth.set_custom_user_claims(user.uid, new_claims)

        print(f"Successfully set claims for {email}:")
        print(f"  admin: {new_claims.get('admin', False)}")
        print(f"  bidcom: {new_claims.get('bidcom', False)}")
        print("\n⚠️  IMPORTANT: The user must log out and log back in for the new claims to take effect!")

    except auth.UserNotFoundError:
        print(f"Error: No user found with email {email}")
        sys.exit(1)
    except Exception as error:
        print(f"Error: {error}")
        sys.exit(1)
