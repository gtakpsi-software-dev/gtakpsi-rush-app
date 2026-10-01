"""Replay the three seed files through their existing admin API endpoints."""

import json


def _replay_seed_file(filename, description, endpoint, http_error, network_error, *,
                      api_url, auth_headers, errors, post, request_exception, progress):
    with open(filename, "r") as file:
        data = json.load(file)

        for i in progress(range(len(data)), desc=description):
            try:
                response = post(api_url + endpoint, json=data[i], headers=auth_headers)

                if response.status_code == 200:
                    if response.json().get("status") == "error":
                        errors.append(response.json().get("message"))
                else:
                    errors.append(http_error(data[i], response.status_code))
            except request_exception as e:
                errors.append(network_error(data[i], e))


def add_pis_timeslots(api_url, auth_headers, errors, post, request_exception, progress):
    _replay_seed_file(
        "pis_timeslots.json", "Adding PIS Timeslots", "/admin/add_pis_timeslot",
        lambda item, status: f"Error adding PIS Timeslot at {item['time']}: HTTP {status}",
        lambda item, error: (
            f"Network error adding PIS Timeslot at {item['time']}: {error}"
        ),
        api_url=api_url, auth_headers=auth_headers, errors=errors,
        post=post, request_exception=request_exception, progress=progress,
    )


def add_rush_nights(api_url, auth_headers, errors, post, request_exception, progress):
    _replay_seed_file(
        "rush_nights.json", "Adding Rush Nights", "/admin/add-rush-night",
        lambda item, status: f"Error adding Rush Night {item['name']}: HTTP {status}",
        lambda item, error: f"Network error adding Rush Night {item['name']}: {error}",
        api_url=api_url, auth_headers=auth_headers, errors=errors,
        post=post, request_exception=request_exception, progress=progress,
    )


def add_pis_questions(api_url, auth_headers, errors, post, request_exception, progress):
    _replay_seed_file(
        "pis_questions.json", "Adding PIS Questions", "/admin/add_pis_question",
        lambda _item, status: f"Error adding PIS Question: HTTP {status}",
        lambda item, error: (
            f"Network error adding PIS Question {item['question']}: {error}"
        ),
        api_url=api_url, auth_headers=auth_headers, errors=errors,
        post=post, request_exception=request_exception, progress=progress,
    )


def seed_data(api_url, auth_headers, post, request_exception, progress):
    errors = []

    # Preserve the original request order so a direct setup run replays the same seed sequence.
    add_pis_timeslots(api_url, auth_headers, errors, post, request_exception, progress)
    add_rush_nights(api_url, auth_headers, errors, post, request_exception, progress)
    add_pis_questions(api_url, auth_headers, errors, post, request_exception, progress)

    return errors
