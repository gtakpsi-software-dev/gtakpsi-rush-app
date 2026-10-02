# GT AKPsi Rush App

A React + Rust full stack application using Railway (backend), Vercel (frontend), Firebase Storage (images), and MongoDB.

## Tech Stack

Refactoring progress, compatibility rules, and test commands are tracked in
[docs/refactoring.md](docs/refactoring.md).

- **Frontend**: React + Vite, hosted on Vercel
- **API**: Rust + Axum, hosted on Railway
- **Database**: MongoDB Atlas
- **Image Storage**: Firebase Storage
- **Real-time**: Rust WebSocket services for voting and sorting, a Node.js
  Socket.IO service for PIS editing, and Redis for voting updates

## Repository layout

| Path | Purpose |
| --- | --- |
| `client/` | React app, feature modules, and client tests |
| `server/api/` | Main HTTP API, authentication, and database access |
| `server/websockets/voting/` | Voting updates over WebSocket |
| `server/websockets/sorting/` | Shared sorting board over WebSocket |
| `server/websockets/pis/` | Collaborative PIS editing over Socket.IO |
| `scripts/season_setup/` | Explicit start-of-season reset command |
| `scripts/maintenance/` | Manual maintenance commands and offline tests |
| `scripts/testing/` | Isolated API and voting integration runners |
| `data/season_seed/` | Input records for the season setup command |
| `docs/` | Refactoring contract and verified slice history |

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
VITE_ADMIN_ALLOWLIST=admin@example.com,bidcom@example.com
```

The three real-time services retain their deployment variable names:

| Client variable | Service | Local fallback |
| --- | --- | --- |
| `VITE_WEBSOCKET_URL` | PIS collaborative editing (Socket.IO) | `http://localhost:3001` |
| `VITE_SORTING_BROADCASTER_URL` | Sorting board (WebSocket) | `ws://localhost:4001` |
| `VITE_BROADCASTER_API_PREFIX` | Voting updates (WebSocket) | None |

Client code reads them through `client/src/config/realtimeBaseUrls.js`. Existing
deployment variable names stay unchanged.
Set `VITE_BROADCASTER_API_PREFIX` to the deployed voting WebSocket URL when
using voting updates; that variable has no local fallback. The admin allowlist
is comma-separated. Vite embeds every `VITE_*` value in browser code, so these
values must not contain service-account keys or other server-only secrets.

### API (.env in /server/api)

```env
MONGO_URL=mongodb+srv://...
REDIS_URL=rediss://...
API_KEY=your-client-api-key
FIREBASE_PROJECT_ID=your-project-id
ADMIN_ALLOWLIST_EMAILS=admin@example.com,bidcom@example.com
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json
RUSH_TIMEZONE=America/New_York
```

`FIREBASE_PROJECT_ID` is required at startup. `ADMIN_ALLOWLIST_EMAILS` and
`RUSH_TIMEZONE` are optional; the latter defaults to `America/New_York`.
Admin role-claim operations need a backend-only Firebase service account. Set
either `FIREBASE_SERVICE_ACCOUNT_PATH` as shown or
`FIREBASE_SERVICE_ACCOUNT_JSON` to the credential JSON; valid inline JSON takes
precedence. Railway supplies `PORT` automatically, while local defaults are
3000 for the API, 4000 for voting, 4001 for sorting, and 3001 for PIS editing.
The voting socket reads `REDIS_URL` and otherwise uses `redis://localhost:6379`.

### Setup Script (.env in root)

```env
MONGO_URI=mongodb+srv://...
API=https://your-railway-backend-url.railway.app
FIREBASE_API_KEY=your-api-key
ADMIN_UID=your-admin-user-id
API_KEY=your-client-api-key
FIREBASE_CREDENTIALS_PATH=firebase-service-account.json
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
```

The root `.env.example` belongs to season setup and some manual commands. The
client and API read configuration from their own service directories or
deployment environment.

The [maintenance command guide](scripts/maintenance/README.md) lists each
manual command, its side effects, and its configuration requirements.

## Tests

```bash
npm --prefix client run lint:ci
npm --prefix client test
npm --prefix client run typecheck
npm --prefix client run build
npm --prefix server/websockets/pis test
cargo fmt --manifest-path server/api/Cargo.toml -- --check
cargo fmt --manifest-path server/websockets/sorting/Cargo.toml -- --check
cargo fmt --manifest-path server/websockets/voting/Cargo.toml -- --check
cargo +1.88.0 clippy --locked --manifest-path server/api/Cargo.toml --all-targets -- -D warnings
cargo +1.88.0 clippy --locked --manifest-path server/websockets/sorting/Cargo.toml --all-targets -- -D warnings
cargo +1.88.0 clippy --locked --manifest-path server/websockets/voting/Cargo.toml --all-targets -- -D warnings
cargo test --locked --manifest-path server/api/Cargo.toml
cargo test --locked --manifest-path server/websockets/sorting/Cargo.toml
scripts/testing/api-integration.sh
python3 scripts/testing/voting-integration.py
RUSH_TEST_CROSS_STORE=1 python3 scripts/testing/voting-integration.py
python3 -m unittest discover -s scripts/maintenance/tests -p 'test_*.py'
```

The API integration command requires Docker. It creates a fresh MongoDB container,
runs database-backed behavior checks, and removes the container on exit. It does
not use the app's `.env` or an existing database. See
[the verification notes](docs/refactoring.md#verification) for local toolchain
requirements and remaining coverage.

The voting integration command requires `redis-server` and `redis-cli`. It starts
a separate local Redis instance, checks its run marker, and stops that instance
after the voting WebSocket and API voting tests.
The optional cross-store mode also requires Docker. It runs the selected-rushee
MongoDB and Redis contract against fresh, marked instances; CI enables this mode.

[Regression checks](.github/workflows/regression.yml) run these suites, Rust
format and strict Clippy checks, scoped client lint, typecheck, and build on
pushes and pull requests. Scoped lint checks all client files except
`Attendance.jsx` and rejects any warnings.
Repository-wide lint remains tracked separately in
[the refactoring ledger](docs/refactoring.md#slice-ledger) because Attendance has eight
existing undefined-setter errors. All six jobs passed on remote commit
`77e45bd` in [this GitHub Actions run](https://github.com/gtakpsi-software-dev/gtakpsi-rush-app/actions/runs/36956853486);
later local commits have not run in GitHub CI.

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
there with `npm start`. Its package name is `rush-pis-websocket`; its port
default and event protocol are unchanged.

### Sorting WebSocket service

Set this service's Railway root directory to `server/websockets/sorting`. Its
Dockerfile and `railway.toml` live there. The executable is
`rush-sorting-websocket`; its port default and WebSocket messages are unchanged.

### Voting WebSocket service

Set this service's Railway root directory to `server/websockets/voting`. Its
Dockerfile and `railway.toml` live there. The executable is
`rush-voting-websocket`; its port default and WebSocket messages are unchanged.

Railway treats the Root Directory and the Config as Code file path separately.
For an existing Rust service that already uses its `railway.toml`, update the
config file path as well as the root directory:

| Service | Root Directory | Config file path |
| --- | --- | --- |
| API | `/server/api` | `/server/api/railway.toml` |
| Sorting WebSocket | `/server/websockets/sorting` | `/server/websockets/sorting/railway.toml` |
| Voting WebSocket | `/server/websockets/voting` | `/server/websockets/voting/railway.toml` |

Check each deployment's settings to confirm whether it used the file. The PIS
service has no `railway.toml` and starts with `npm start` from its own root.
[Railway's current guidance](https://docs.railway.com/config-as-code) deprecates
Config as Code: existing files work only until December 1, 2026, and new
services cannot opt in. Migrate the live Rust service settings to Railway
Infrastructure as Code or equivalent dashboard settings before that cutoff.

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
and seed uploads live under `scripts/season_setup/`; seed files are read from
`data/season_seed/`.

Season seed files live in `data/season_seed/`. Setup and migration commands read
them there directly.

This will:
- Clear all rushees from MongoDB
- Clear all rush nights and PIS timeslots
- Delete all profile pictures from Firebase Storage
- Re-add rush nights, PIS timeslots, and questions from JSON files
