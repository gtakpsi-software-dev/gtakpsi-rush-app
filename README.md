# GT AKPsi Rush App

Rush management for Georgia Tech AKPsi, including registration, attendance,
Personal Information Sheets (PIS), collaborative reviews, sorting, and live voting.

## Stack

- React, TypeScript, and Vite for the frontend
- Rust and Axum for the HTTP API and voting/sorting WebSocket services
- Node.js and Socket.IO for collaborative PIS editing
- MongoDB for application data and Redis for voting state and broadcasts
- Firebase Authentication for sign-in and Firebase Storage for profile pictures
- Vercel for frontend hosting and Railway for backend services

## Repository layout

| Directory | Purpose |
| --- | --- |
| `client/` | Frontend and client tests |
| `server/api/` | HTTP API, authentication, and database access |
| `server/websockets/voting/` | Live voting updates |
| `server/websockets/sorting/` | Shared sorting board |
| `server/websockets/pis/` | Collaborative PIS editing |
| `scripts/season_setup/` | Season reset and seed uploads |
| `scripts/maintenance/` | Manual reports, exports, and maintenance commands |
| `scripts/testing/` | Database and WebSocket integration test runners |
| `data/season_seed/` | Rush nights, PIS timeslots, and questions |

## Configuration

Keep credentials in local `.env` files or your hosting provider's environment
settings. Do not commit them.

### Frontend

Create `client/.env` for local development. Set the same variables in the
frontend hosting environment for deployment.

```dotenv
VITE_API_PREFIX=http://localhost:3000
VITE_API_KEY=your-api-key
VITE_BROADCASTER_API_PREFIX=ws://localhost:4000
VITE_SORTING_BROADCASTER_URL=ws://localhost:4001
VITE_WEBSOCKET_URL=http://localhost:3001

VITE_FIREBASE_API_KEY=your-firebase-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_ADMIN_ALLOWLIST=admin@example.com
```

For deployment, use each service's public domain with no trailing slash:

| Variable | Service | Production protocol |
| --- | --- | --- |
| `VITE_API_PREFIX` | Main API | `https://` |
| `VITE_BROADCASTER_API_PREFIX` | Voting WebSocket | `wss://` |
| `VITE_SORTING_BROADCASTER_URL` | Sorting WebSocket | `wss://` |
| `VITE_WEBSOCKET_URL` | PIS Socket.IO | `https://` |

Rebuild the frontend after changing its environment variables. Every `VITE_*`
value is included in browser code; never use these variables for Firebase service
accounts or other server-only secrets. The admin allowlist accepts comma-separated
email addresses.

### API

Create `server/api/.env` locally, or set these variables on the Railway API service:

```dotenv
MONGO_URL=mongodb://localhost:27017
REDIS_URL=redis://localhost:6379
API_KEY=your-api-key
FIREBASE_PROJECT_ID=your-project-id
ADMIN_ALLOWLIST_EMAILS=admin@example.com
FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/firebase-service-account.json
RUSH_TIMEZONE=America/New_York
```

The API uses the MongoDB database `rush-app`. `FIREBASE_PROJECT_ID` is required;
`ADMIN_ALLOWLIST_EMAILS` is optional, and `RUSH_TIMEZONE` defaults to
`America/New_York`.

Firebase role-management operations require a backend service account. Supply
`FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_JSON`; valid inline
JSON takes precedence over the file path.

### WebSocket services

Set `REDIS_URL` on the voting service, using the same Redis instance as the API.
For local development, place it in `server/websockets/voting/.env`.

All four backend services accept `PORT`. Their local defaults are:

| Service | Port |
| --- | --- |
| API | `3000` |
| Voting | `4000` |
| Sorting | `4001` |
| PIS | `3001` |

## Local development

Install Node.js, npm, Rust, MongoDB, and Redis. Python is needed for season setup
and maintenance commands.

From the repository root, install the JavaScript dependencies:

```bash
npm --prefix client ci
npm --prefix server/websockets/pis ci
```

Start MongoDB and Redis, then run each service in a separate terminal:

```bash
# Frontend
npm --prefix client run dev

# API
(cd server/api && cargo run --locked)

# Voting WebSocket
(cd server/websockets/voting && cargo run --locked)

# Sorting WebSocket
(cd server/websockets/sorting && cargo run --locked)

# PIS collaboration
npm --prefix server/websockets/pis start
```

## Deployment

### Frontend on Vercel

Use `client` as the project root, `npm run build` as the build command, and `dist`
as the output directory. Configure the frontend variables with the public backend
URLs and select the branch to deploy.

### Backend on Railway

Create a separate service for each backend component:

| Service | Root directory | Build/start | Health check |
| --- | --- | --- | --- |
| API | `/server/api` | Dockerfile | `/health` |
| Voting | `/server/websockets/voting` | Dockerfile | `/` |
| Sorting | `/server/websockets/sorting` | Dockerfile | `/health` |
| PIS | `/server/websockets/pis` | Node.js / `npm start` | `/health` |

Configure each service's environment variables, public domain, and health check.
The Rust Dockerfiles include their start commands. Railway supplies `PORT`; the
public domain must target that listening port.

MongoDB and Redis can use private Railway URLs when the dependent services are in
the same project environment. The frontend must use public backend URLs. The
voting health check confirms the HTTP service is running; check its logs to verify
that both Redis subscriptions are connected.

## Season setup

Edit the dates, timeslots, and questions in `data/season_seed/` before starting a
season. Create a root `.env` using `.env.example`:

```dotenv
API=https://your-api-domain
API_KEY=your-api-key
FIREBASE_API_KEY=your-firebase-web-api-key
ADMIN_UID=your-firebase-user-uid
FIREBASE_CREDENTIALS_PATH=/absolute/path/to/firebase-service-account.json
FIREBASE_STORAGE_BUCKET=your-storage-bucket
```

`ADMIN_UID` is the user's UID in Firebase Authentication. That account needs an
admin custom claim or an email in the API's `ADMIN_ALLOWLIST_EMAILS`.

From the repository root, run:

```bash
python3 -m pip install python-dotenv tqdm firebase-admin requests
python3 -m scripts.season_setup
```

**This command deletes existing season data and profile pictures.** It clears
rushees, rush nights, PIS timeslots, and PIS questions; removes Firebase Storage
objects under `profile-pictures/`; then uploads the seed records.

Database operations use authenticated requests to the public API, including
`POST /admin/season/reset`. Local MongoDB access is not required. Profile-picture
cleanup uses the configured Firebase service account and Storage bucket.

Authentication or reset failures stop setup before picture cleanup and seed
uploads. Collection resets are sequential, so a failed reset can leave earlier
collections cleared. The script also enforces a September rush-period date guard.

## Testing

Rust unit tests live beside the modules they test. Multi-file test modules keep
their entrypoint inside the directory as `mod.rs`.

| Location | Coverage |
| --- | --- |
| `server/api/src/tests/integration/mongodb/` | API operations backed by MongoDB |
| `server/api/src/tests/integration/redis/` | API voting state and Redis broadcasts |
| `server/websockets/voting/src/tests/` | Voting protocol and Redis-backed socket integration |
| `server/websockets/sorting/src/tests/` | Sorting protocol and socket integration |
| `server/websockets/pis/tests/` | Socket.IO collaboration and text operations |

The database suites have separate feature gates because they require different
services. Use the integration runners below to provision isolated test instances.

Run from the repository root:

```bash
npm --prefix client run lint:ci
npm --prefix client test
npm --prefix client run typecheck
npm --prefix client run build
npm --prefix server/websockets/pis test

cargo test --locked --manifest-path server/api/Cargo.toml
cargo test --locked --manifest-path server/websockets/sorting/Cargo.toml
cargo test --locked --manifest-path server/websockets/voting/Cargo.toml

python3 -m unittest discover -s scripts/maintenance/tests -p 'test_*.py'
```

Database integration tests use disposable local instances:

```bash
# Requires Docker; creates and removes a MongoDB container.
scripts/testing/api-integration.sh

# Requires redis-server and redis-cli; starts and stops a temporary Redis instance.
python3 scripts/testing/voting-integration.py

# Tests API operations across both MongoDB and Redis; requires both sets of tools.
RUSH_TEST_CROSS_STORE=1 python3 scripts/testing/voting-integration.py
```

CI runs regression tests, Rust formatting and strict Clippy checks, frontend
lint, type checking, and the production build on pushes and pull requests.
`lint:ci` excludes `Attendance.jsx`; `npm --prefix client run lint` checks the
entire frontend.
