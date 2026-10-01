# GT AKPsi Rush App

A React + Rust full stack application using Railway (backend), Vercel (frontend), Firebase Storage (images), and MongoDB.

## Tech Stack

Refactoring progress, compatibility rules, and test commands are tracked in
[docs/refactoring.md](docs/refactoring.md).

- **Frontend**: React + Vite, hosted on Vercel
- **Backend**: Rust + Axum, hosted on Railway
- **Database**: MongoDB Atlas
- **Image Storage**: Firebase Storage
- **Real-time**: Redis (for voting)

## Environment Variables

### Client (.env in /client)

```env
VITE_API_PREFIX=https://your-railway-backend-url.railway.app
VITE_API_KEY=your-client-api-key
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

The three real-time services retain their deployment variable names:

| Client variable | Service | Local fallback |
| --- | --- | --- |
| `VITE_WEBSOCKET_URL` | PIS collaborative editing (Socket.IO) | `http://localhost:3001` |
| `VITE_SORTING_BROADCASTER_URL` | Sorting board (WebSocket) | `ws://localhost:4001` |
| `VITE_BROADCASTER_API_PREFIX` | Voting updates (WebSocket) | None |

Client code reads them through `client/src/config/realtimeBaseUrls.js`. Existing
deployment variable names and service roots stay unchanged.

### Server (.env in /server)

```env
MONGO_URL=mongodb+srv://...
REDIS_URL=rediss://...
```

### Setup Script (.env in root)

```env
MONGO_URI=mongodb+srv://...
API=https://your-railway-backend-url.railway.app
FIREBASE_CREDENTIALS_PATH=firebase-service-account.json
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
```

The eight maintenance scripts that previously embedded a MongoDB URI now require
a script-specific setting, such as `DATA_PULL_MONGO_URI` for `data_pull.py`.
Set it in the environment or in a root `.env.migrations` file. That file is
ignored by Git. These scripts do not fall back to the app's `MONGO_URI` or
`MONGO_URL` because their original database targets can differ.

`scripts-migrations/add_pis_question_order.py` remains the command for replacing
PIS questions. Its implementation lives in `scripts-migrations/maintenance_commands/`;
the command still reads the root `.env` and `pis_questions.json` and performs
the same delete, insert, and verification sequence.
`scripts-migrations/delete_test_data.py` also retains its path, dry-run default,
and `--apply` gate; its preview and deletion sequence lives in that same package.
`scripts-migrations/reset_rushees_for_new_rush.py` keeps its season-specific GTID
list and command path; the delete, reset, and report sequence lives in the same
package.
`scripts-migrations/data_pull.py` keeps its command path and `rushees.xlsx`
output; the export columns and row mapping live in
`scripts-migrations/maintenance_commands/rushee_export.py`.
`scripts-migrations/set_admin_claim.py` keeps its CLI flags and Firebase
initialization; its role-claim lookup, update, and reporting live in
`scripts-migrations/maintenance_commands/firebase_claims.py`.

## Tests

```bash
npm --prefix client run lint:ci
npm --prefix client test
npm --prefix client run typecheck
npm --prefix websocket-server test
cargo test --locked --manifest-path server/Cargo.toml
cargo test --locked --manifest-path sorting-broadcaster/Cargo.toml
scripts/testing/api-integration.sh
python3 scripts/testing/voting-integration.py
python3 -m unittest discover -s scripts-migrations/tests -p 'test_*.py'
```

The API integration command requires Docker. It creates a fresh MongoDB container,
runs database-backed behavior checks, and removes the container on exit. It does
not use the app's `.env` or an existing database. See
[the verification notes](docs/refactoring.md#verification) for local toolchain
requirements and remaining coverage.

The voting integration command requires `redis-server` and `redis-cli`. It starts
a separate local Redis instance, checks its run marker, and stops that instance
after the WebSocket tests.

[Regression checks](.github/workflows/regression.yml) run these suites, scoped
client lint, typecheck, and build on pushes and pull requests. Scoped lint checks
all client files except `Attendance.jsx` and rejects new warnings above the
current baseline of 6. Repository-wide lint remains tracked separately in
[the refactoring ledger](docs/refactoring.md#slice-ledger) because Attendance has eight
existing undefined-setter errors. The workflow has not run on GitHub yet.

## Deploy

### Frontend (Vercel)

The frontend is deployed automatically via Vercel when you push to the main branch.

Manual deploy:
```bash
cd client
npm run build
# Deploy to Vercel via CLI or dashboard
```

### Backend (Railway)

The backend is deployed automatically via Railway when you push to the main branch.

Railway will use the Dockerfile in the `/server` folder.

## Setup Script

Before each rush season, run the setup script to clear old data:

```bash
pip install pymongo python-dotenv tqdm firebase-admin
python setup.py
```

The reset runs only when this command is invoked directly. Importing `setup.py`
does not connect to services or delete data. Its offline regression tests use
fake MongoDB, Firebase, and HTTP clients. Authentication, reset, Storage cleanup,
and seed uploads live under `scripts/season_setup/`; the command and input JSON
paths are unchanged.

Season seed files live in `data/season_seed/`. The three original JSON paths at
the repository root are links to those files, so existing setup and migration
commands read the same data.

This will:
- Clear all rushees from MongoDB
- Clear all rush nights and PIS timeslots
- Delete all profile pictures from Firebase Storage
- Re-add rush nights, PIS timeslots, and questions from JSON files
