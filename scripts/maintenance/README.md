# Maintenance commands

These entrypoints are manual tools, not part of the running app. Run their
offline tests from the repository root with:

```bash
python3 -m unittest discover -s scripts/maintenance/tests -p 'test_*.py'
```

| Command | Purpose | Effect |
| --- | --- | --- |
| `closed_night_attendance.py` | Count Closed Night attendance | Reads MongoDB and prints a report |
| `data_pull.py` | Export rushee records | Reads MongoDB and writes `rushees.xlsx` in the working directory |
| `find_malformed_comments.py` | Inspect malformed comments | Reads MongoDB and prints findings |
| `pis_excel_sheet.py` | Export PIS signups | Reads MongoDB and writes `PIS_Signups.xlsx` in the working directory |
| `add_attendance.py` | Add one rushee attendance entry | Updates MongoDB |
| `add_sorting_tag.py` | Add one rushee sorting tag | Updates MongoDB |
| `set_admin_claim.py` | Set Firebase role claims | Updates Firebase Authentication |
| `update_pledge_headshots.py` | Upload mapped headshots | Updates Firebase Storage and MongoDB |
| `add_pis_question_order.py` | Replace PIS questions from `data/season_seed/` | Deletes and reinserts MongoDB questions |
| `delete_test_data.py` | Remove listed test rushees and all database rush nights | Dry run by default; `--apply` deletes |
| `import_rushees.py` | Replace rushees from a root JSON export | Deletes and reinserts MongoDB rushees |
| `reset_rushees_for_new_rush.py` | Keep listed rushees and reset their season data | Deletes and updates MongoDB rushees |

Six commands use their own `<SCRIPT_NAME>_MONGO_URI` setting, either in the
environment or the ignored root `.env.migrations` file. The other commands
retain their existing root `.env`, API `.env`, or Firebase credential rules;
see each entrypoint before running it. `set_admin_claim.py` expects its working
directory to be `scripts/maintenance/` because its service-account path is
relative to that directory. The export commands write into whichever working
directory invokes them.

The `commands/` package holds operation logic, and `lib/` holds shared parsing,
configuration, and image helpers. The entrypoints remain separate because their
inputs and side effects differ. Do not delete a one-off command solely because
the application does not import it; these commands are invoked manually.
