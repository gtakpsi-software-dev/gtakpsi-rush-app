from datetime import datetime, timezone

from bson import ObjectId


def convert_dates(obj):
    """Recursively convert $date strings to Python datetime objects for BSON."""
    if isinstance(obj, dict):
        if '$oid' in obj:
            return ObjectId(obj['$oid'])
        if '$date' in obj:
            date_val = obj['$date']
            if isinstance(date_val, str):
                date_val = date_val.replace('Z', '+00:00')
                return datetime.fromisoformat(date_val)
            elif isinstance(date_val, dict) and '$numberLong' in date_val:
                # Numeric extended JSON dates use epoch milliseconds; keep them in UTC.
                ms = int(date_val['$numberLong'])
                return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
        return {k: convert_dates(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_dates(item) for item in obj]
    return obj
