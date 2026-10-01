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
deployment variable names stay unchanged.

### API (.env in /server/api)

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

`scripts/maintenance/add_pis_question_order.py` is the command for replacing
PIS questions. Its implementation lives in `scripts/maintenance/commands/`;
the command still reads the root `.env` and
`data/season_seed/pis_questions.json`, then performs the same delete, insert,
and verification sequence.
`scripts/maintenance/delete_test_data.py` retains its dry-run default,
and `--apply` gate; its preview and deletion sequence lives in that same package.
`scripts/maintenance/reset_rushees_for_new_rush.py` keeps its season-specific GTID
list; the delete, reset, and report sequence lives in the same
package.
`scripts/maintenance/data_pull.py` keeps its `rushees.xlsx`
output; the export columns and row mapping live in
`scripts/maintenance/commands/rushee_export.py`.
`scripts/maintenance/set_admin_claim.py` keeps its CLI flags and Firebase
initialization; its role-claim lookup, update, and reporting live in
`scripts/maintenance/commands/firebase_claims.py`.
Spreadsheet exports are generated in the current working directory when their
commands run. Historical exports are not tracked; keep any needed copies locally.

## Tests

```bash
npm --prefix client run lint:ci
npm --prefix client test
npm --prefix client run typecheck
npm --prefix server/websockets/pis test
cargo test --locked --manifest-path server/api/Cargo.toml
cargo test --locked --manifest-path server/websockets/sorting/Cargo.toml
scripts/testing/api-integration.sh
python3 scripts/testing/voting-integration.py
python3 -m unittest discover -s scripts/maintenance/tests -p 'test_*.py'
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
all client files except `Attendance.jsx` and rejects any warnings.
Repository-wide lint remains tracked separately in
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

Set the API service's Railway root directory to `server/api`. Its Dockerfile and
`railway.toml` live there; the Rust executable is `rush-api` and HTTP routes
are unchanged.

### PIS collaboration service

Set this Socket.IO service's deployment root to `server/websockets/pis`. Run it
there with `npm start`; its package name, port default, and event protocol are
unchanged.

### Sorting WebSocket service

Set this service's Railway root directory to `server/websockets/sorting`. Its
Dockerfile and `railway.toml` live there; the executable name, port default,
and WebSocket messages are unchanged.

### Voting WebSocket service

Set this service's Railway root directory to `server/websockets/voting`. Its
Dockerfile and `railway.toml` live there; the executable name, port default,
and WebSocket messages are unchanged.

## Setup Script

Before each rush season, run the setup script to clear old data:

```bash
pip install pymongo python-dotenv tqdm firebase-admin
python3 -m scripts.season_setup
```

Run this from the repository root. The reset runs only when this command is
invoked directly. Importing `scripts.season_setup.__main__`
does not connect to services or delete data. Its offline regression tests use
fake MongoDB, Firebase, and HTTP clients. Authentication, reset, Storage cleanup,
and seed uploads live under `scripts/season_setup/`; the input JSON paths are
unchanged.

Season seed files live in `data/season_seed/`. Setup and migration commands read
them there directly.

This will:
- Clear all rushees from MongoDB
- Clear all rush nights and PIS timeslots
- Delete all profile pictures from Firebase Storage
- Re-add rush nights, PIS timeslots, and questions from JSON files
