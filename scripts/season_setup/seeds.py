"""Replay the three seed files through their existing admin API endpoints."""

import json


def add_pis_timeslots(api_url, auth_headers, errors, post, request_exception, progress):
    with open("pis_timeslots.json", "r") as file:
        data = json.load(file)

        for i in progress(range(len(data)), desc="Adding PIS Timeslots"):
            try:
                response = post(
                    api_url + "/admin/add_pis_timeslot",
                    json=data[i],
                    headers=auth_headers
                )

                if response.status_code == 200:
                    if response.json().get("status") == "error":
                        errors.append(response.json().get("message"))
                else:
                    errors.append(f"Error adding PIS Timeslot at {data[i]['time']}: HTTP {response.status_code}")
            except request_exception as e:
                errors.append(f"Network error adding PIS Timeslot at {data[i]['time']}: {e}")


def add_rush_nights(api_url, auth_headers, errors, post, request_exception, progress):
    with open("rush_nights.json", "r") as file:
        data = json.load(file)

        for i in progress(range(len(data)), desc="Adding Rush Nights"):
            try:
                response = post(
                    api_url + "/admin/add-rush-night",
                    json=data[i],
                    headers=auth_headers
                )

                if response.status_code == 200:
                    if response.json().get("status") == "error":
                        errors.append(response.json().get("message"))
                else:
                    errors.append(f"Error adding Rush Night {data[i]['name']}: HTTP {response.status_code}")
            except request_exception as e:
                errors.append(f"Network error adding Rush Night {data[i]['name']}: {e}")


def add_pis_questions(api_url, auth_headers, errors, post, request_exception, progress):
    with open("pis_questions.json", "r") as file:
        data = json.load(file)

        for i in progress(range(len(data)), desc="Adding PIS Questions"):
            try:
                response = post(
                    api_url + "/admin/add_pis_question",
                    json=data[i],
                    headers=auth_headers
                )

                if response.status_code == 200:
                    if response.json().get("status") == "error":
                        errors.append(response.json().get("message"))
                else:
                    errors.append(f"Error adding PIS Question: HTTP {response.status_code}")
            except request_exception as e:
                errors.append(f"Network error adding PIS Question {data[i]['question']}: {e}")


def seed_data(api_url, auth_headers, post, request_exception, progress):
    errors = []

    # Preserve the original request order so a direct setup run replays the same seed sequence.
    add_pis_timeslots(api_url, auth_headers, errors, post, request_exception, progress)
    add_rush_nights(api_url, auth_headers, errors, post, request_exception, progress)
    add_pis_questions(api_url, auth_headers, errors, post, request_exception, progress)

    return errors
