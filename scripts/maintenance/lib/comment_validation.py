# Keep diagnostics aligned with the stored comment shape so scans identify deserialization failures.

def check_comment_structure(comment, rushee_info):
    """Check if a comment has all required fields with correct types"""
    issues = []

    required_fields = [
        'brother_id',
        'brother_name',
        'comment',
        'ratings',
        'night'
    ]

    for field in required_fields:
        if field not in comment:
            issues.append(f"Missing field: {field}")

    if 'brother_id' in comment and not isinstance(comment['brother_id'], str):
        issues.append(f"brother_id should be string, got {type(comment['brother_id'])}")

    if 'brother_name' in comment and not isinstance(comment['brother_name'], str):
        issues.append(f"brother_name should be string, got {type(comment['brother_name'])}")

    if 'comment' in comment and not isinstance(comment['comment'], str):
        issues.append(f"comment should be string, got {type(comment['comment'])}")

    if 'ratings' in comment:
        if not isinstance(comment['ratings'], list):
            issues.append(f"ratings should be array, got {type(comment['ratings'])}")
        else:
            for i, rating in enumerate(comment['ratings']):
                if not isinstance(rating, dict):
                    issues.append(f"ratings[{i}] should be object, got {type(rating)}")
                    continue

                if 'name' not in rating:
                    issues.append(f"ratings[{i}] missing 'name' field")
                elif not isinstance(rating['name'], str):
                    issues.append(f"ratings[{i}].name should be string, got {type(rating['name'])}")

                if 'value' not in rating:
                    issues.append(f"ratings[{i}] missing 'value' field")
                elif not isinstance(rating['value'], (int, float)):
                    issues.append(f"ratings[{i}].value should be number, got {type(rating['value'])}")

    if 'night' in comment:
        if not isinstance(comment['night'], dict):
            issues.append(f"night should be object, got {type(comment['night'])}")
        else:
            if 'name' not in comment['night']:
                issues.append("night missing 'name' field")
            elif not isinstance(comment['night']['name'], str):
                issues.append(f"night.name should be string, got {type(comment['night']['name'])}")

            if 'time' not in comment['night']:
                issues.append("night missing 'time' field")
            # Stored night times vary in format; this diagnostic only requires their presence.

    return issues
