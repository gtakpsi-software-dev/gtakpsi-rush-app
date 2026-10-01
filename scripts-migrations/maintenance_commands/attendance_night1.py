import sys


def get_night_one(rush_nights):
    night_one = rush_nights.find_one({"name": "Night 1"})
    if not night_one:
        print("❌ Night 1 not found in rush-nights collection.")
        sys.exit(1)
    if "time" not in night_one:
        print("❌ Night 1 entry missing time field.")
        sys.exit(1)
    return {
        "name": night_one.get("name", "Night 1"),
        "time": night_one["time"],
    }
