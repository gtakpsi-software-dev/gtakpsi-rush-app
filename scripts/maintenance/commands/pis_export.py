from datetime import datetime


def format_datetime(dt):
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    return dt


def flatten_pis_signups(data):
    flattened_data = []
    for item in data:
        if "pis_signup" in item and item["pis_signup"]:
            flattened_data.append({
                "Rushee First Name": item["pis_signup"].get("rushee_first_name", ""),
                "Rushee Last Name": item["pis_signup"].get("rushee_last_name", ""),
                "Rushee GTID": item["pis_signup"].get("rushee_gtid", ""),
                "PIS Time": format_datetime(item["pis_signup"].get("time", "")),
                "First Brother First Name": item["pis_signup"].get("first_brother_first_name", ""),
                "First Brother Last Name": item["pis_signup"].get("first_brother_last_name", ""),
                "Second Brother First Name": item["pis_signup"].get("second_brother_first_name", ""),
                "Second Brother Last Name": item["pis_signup"].get("second_brother_last_name", ""),
            })
    return flattened_data
