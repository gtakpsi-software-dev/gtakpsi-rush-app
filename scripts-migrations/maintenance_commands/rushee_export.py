RUSHEE_EXPORT_COLUMNS = [
    "first_name",
    "last_name",
    "housing",
    "phone_number",
    "email",
    "gtid",
    "major",
    "class",
    "flex_window",
]


def rushee_export_rows(rushees):
    data = []
    for rushee in rushees:
        data.append({
            "first_name": rushee.get("first_name", ""),
            "last_name": rushee.get("last_name", ""),
            "housing": rushee.get("housing", ""),
            "phone_number": rushee.get("phone_number", ""),
            "email": rushee.get("email", ""),
            "gtid": rushee.get("gtid", ""),
            "major": rushee.get("major", ""),
            "class": rushee.get("class", ""),
            "flex_window": "Yes" if rushee.get("flex_window", False) else "No",
        })
    return data
