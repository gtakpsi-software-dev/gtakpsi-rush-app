#!/usr/bin/env python3
"""
Script to replace all PIS questions in MongoDB with those from pis_questions.json.
This will DELETE all existing questions and INSERT the new ones.

Usage from the repository root:
    python3 scripts/maintenance/add_pis_question_order.py
"""

from dotenv import load_dotenv
from pymongo import MongoClient

from commands.pis_questions import replace_questions


def main():
    # INVARIANT: importing this entrypoint must never replace database questions.
    replace_questions(__file__, load_dotenv, MongoClient)


if __name__ == '__main__':
    main()
