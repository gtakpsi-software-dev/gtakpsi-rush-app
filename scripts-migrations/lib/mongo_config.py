"""Resolve maintenance-script MongoDB configuration without storing credentials in source."""

import os
from pathlib import Path


def _read_env_value(path, key):
    try:
        lines = path.read_text().splitlines()
    except OSError:
        return None

    for line in lines:
        name, separator, value = line.partition("=")
        if separator and name.strip() == key:
            resolved = value.strip().strip('"').strip("'")
            if resolved:
                return resolved
    return None


def resolve_mongo_uri(script_path, environ=None, repo_root=None):
    key = f"{Path(script_path).stem.upper()}_MONGO_URI"
    environment = os.environ if environ is None else environ
    if environment.get(key):
        return environment[key]

    root = Path(__file__).resolve().parents[2] if repo_root is None else Path(repo_root)
    value = _read_env_value(root / ".env.migrations", key)
    if value:
        return value

    # INVARIANT: each script needs its own target; generic app URIs can point elsewhere.
    raise SystemExit(f"ERROR: Set {key} or provide it in .env.migrations")
