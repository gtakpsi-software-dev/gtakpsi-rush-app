def average_ratings(comments):
    # Each comment contributes equally to the historical arithmetic mean; no outliers are filtered.
    curr_ratings_numerator = {}
    curr_ratings_n = {}

    for comment in comments:
        for rating in comment.get("ratings", []):
            if rating.get("name") in curr_ratings_n:
                curr_ratings_n[rating.get("name")] += 1
                curr_ratings_numerator[rating.get("name")] += rating.get("value")
            else:
                curr_ratings_n[rating.get("name")] = 1
                curr_ratings_numerator[rating.get("name")] = rating.get("value")

    new_ratings = []
    for key in curr_ratings_n.keys():
        new_ratings.append({
            "name": key,
            "value": curr_ratings_numerator[key] / curr_ratings_n[key],
        })

    return new_ratings
