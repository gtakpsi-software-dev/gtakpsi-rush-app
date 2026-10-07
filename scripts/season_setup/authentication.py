"""Get the admin bearer token used by the season setup API requests."""


def get_admin_id_token(firebase_api_key, admin_uid, firebase_auth, post):
    if not firebase_api_key:
        print("Warning: FIREBASE_API_KEY not set in .env - API requests may fail")
        return None
    if not admin_uid:
        print("Warning: ADMIN_UID not set in .env - API requests may fail")
        return None

    try:
        # Custom tokens require the server-side Admin SDK; never expose its credentials to the client.
        custom_token = firebase_auth.create_custom_token(admin_uid)

        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={firebase_api_key}"
        response = post(url, json={
            "token": custom_token.decode('utf-8') if isinstance(custom_token, bytes) else custom_token,
            "returnSecureToken": True
        })

        if response.status_code == 200:
            id_token = response.json().get("idToken")
            print("Successfully obtained admin authentication token")
            return id_token
        else:
            print(f"Failed to get ID token: {response.json()}")
            return None
    except Exception as e:
        print(f"Error getting admin token: {e}")
        return None
