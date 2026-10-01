"""Resolve the test-data cleanup command's existing MongoDB URI precedence."""

import os
import sys


def _uri_from_api_env(repo_root):
    path = os.path.join(repo_root, "server", "api", ".env")
    try:
        with open(path) as config:
            for line in config:
                line = line.strip()
                if line.startswith("MONGO_URL="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError:
        pass
    return None


def resolve_cleanup_uri(argv, environ, repo_root):
    # INVARIANT: an incomplete explicit URI fails before any fallback can target another DB.
    if "--uri" in argv:
        index = argv.index("--uri")
        if index + 1 < len(argv):
            return argv[index + 1]
        print("ERROR: --uri given with no value")
        sys.exit(1)

    uri = environ.get("MONGO_URI") or environ.get("MONGO_URL") or _uri_from_api_env(repo_root)
    if not uri:
        print("ERROR: no connection string. Pass --uri, set MONGO_URL, or "
              "put MONGO_URL in server/api/.env")
        sys.exit(1)
    return uri
