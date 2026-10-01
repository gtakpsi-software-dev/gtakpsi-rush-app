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


def resolve_mongo_uri(environ=None, repo_root=None):
    environment = os.environ if environ is None else environ
    for key in ("MONGO_URI", "MONGO_URL"):
        if environment.get(key):
            return environment[key]

    root = Path(__file__).resolve().parents[2] if repo_root is None else Path(repo_root)
    for path, key in (
        (root / ".env", "MONGO_URI"),
        (root / ".env", "MONGO_URL"),
        (root / "server" / ".env", "MONGO_URL"),
    ):
        value = _read_env_value(path, key)
        if value:
            return value

    # INVARIANT: never fall back to a source-controlled URI for maintenance commands.
    raise SystemExit("ERROR: Set MONGO_URI or MONGO_URL, or provide it in .env")
