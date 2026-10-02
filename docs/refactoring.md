# Behavior-preserving refactoring

## Contract

Preserve rendered markup, styling, routes, request and response shapes, WebSocket
events, authentication rules, database fields, and timing. When moving a service,
update its deployment root and local entrypoints in the same verified slice.
Existing quirks are characterization targets, not permission to change behavior.
Refactor one area at a time, run its checks, and commit the verified slice.

## Starting point

Baseline: `5250f4b`. The client production build passes. Client ESLint reports
347 errors and 15 warnings. The existing speculative-language script prints
results but contains no assertions. The largest files are `Admin.jsx` (2,096
lines), `controllers/admin.rs` (2,044), and `controllers/rushee.rs` (1,491).

The API baseline builds with 78 existing warnings and zero tests. On this Mac,
select the installed command-line tools for Cargo with
`DEVELOPER_DIR=/Library/Developer/CommandLineTools`; the selected Xcode app has an
unaccepted license. No machine-wide toolchain settings were changed.

Services currently deployed independently:

| Directory | Responsibility | Protocol |
| --- | --- | --- |
| `client` | Rush application UI | React / HTTP / real-time clients |
| `server/api` | API, authentication, persistence | Axum / MongoDB / Redis |
| `server/websockets/voting` | Voting updates | Axum WebSocket / Redis |
| `server/websockets/sorting` | Shared sorting sessions | Axum WebSocket |
| `server/websockets/pis` | Collaborative PIS editing | Socket.IO |

The API and all three socket sources now live under `server/`; their deployment
roots must point to the listed directories before this branch is deployed.
Routes, runtime events, and JSON names remain unchanged.

The real-time package names follow `rush-<domain>-websocket`: voting is
`rush-voting-websocket`, sorting is `rush-sorting-websocket`, and collaborative
PIS editing is `rush-pis-websocket`. The API executable is `rush-api`; the two
Rust socket executables use their package names,
`rush-voting-websocket` and `rush-sorting-websocket`.
Inbound socket handlers now use `src/handlers.rs` in both Rust services and
`src/handlers/` in the PIS Socket.IO service.

## Slice ledger

The verified atomic slices are archived by range:

- [Slices 1–100](refactoring-history/001-100.md)
- [Slices 101–200](refactoring-history/101-200.md)
- [Slices 201–300](refactoring-history/201-300.md)
- [Slices 301–400](refactoring-history/301-400.md)
- [Slices 401–500](refactoring-history/401-500.md)

## Remaining work

- Update the four deployed service roots to the paths in the table, then verify
  their health endpoints and the socket URL wiring without changing event
  payloads.
- Finish dense client page and feature boundaries, including Admin, Rushee Zoom,
  sorting, Attendance presentation, and collaboration code. Pin JSX, effect
  timing, request order, and state ownership before each move.
- Cover remaining API branches with isolated database tests, then simplify
  controller and assignment logic under those tests.
- Expand real-time failure, reconnect, and role-change coverage for all three
  protocols, then standardize internal handler and lifecycle names.
- Review the remaining one-off maintenance commands for actual use before
  removing any. The commands now live under `scripts/maintenance/`; old
  generated exports are untracked. Never validate a reset against real data.
- Verify authenticated browser flows, later registration steps, database
  workflows, CI runs, and deployed service roots before claiming parity.
- Rotate the formerly embedded MongoDB credential outside this repository and
  verify the new URI in local/deployment configuration.
- Resolve the remaining Attendance lint findings only where behavior can remain
  identical, then add a complete client lint gate.
- Decide separately whether Attendance's undefined fetch-effect setters may
  be repaired; that would be a functional change outside this parity contract.

## Verification

Run `npm --prefix client test` for dependency-free client domain tests,
`npm --prefix client run typecheck` for typed components, and
`npm --prefix client run build` for the production bundle. Use Node 20 or newer
for the test runner. Run `npm --prefix client run lint` for configured JS/JSX
and TS/TSX lint; the current state has 8 errors and 1 warning, so it is
tracked debt, not a passing check.
`npm --prefix client run lint:ci` gates the rest of the client with zero
warnings. The regression workflow runs this scoped gate, the passing suites,
and the client build on pushes and pull requests; its first GitHub run remains
unverified.

Rust checks use `cargo test --locked --manifest-path <service>/Cargo.toml`.
`cargo fmt --manifest-path <service>/Cargo.toml -- --check` passes for the API,
sorting, and voting crates and is enforced in regression CI.
On this Mac, auth and route tests need normal system access: inside the
filesystem sandbox, macOS Dynamic Store initialization panics before those
tests run. The full suite passes with normal system access.
Collaboration tests use `npm --prefix server/websockets/pis test` and require permission
to bind local ports; their pinned Socket.IO client is a development dependency.
The two sorting WebSocket loopback tests also require local port access; the
remaining eight sorting tests pass inside the filesystem sandbox.
The API, sorting, and voting Docker images build from their new service roots.
Disposable containers returned HTTP 200 from `/health`, `/health`, and `/`,
respectively, using the renamed release executables. Their local images and
containers were removed after verification; deployed Railway roots remain
unverified.
The PIS Socket.IO entrypoint also returned HTTP 200 from `/health` on a
disposable local port and exited cleanly on `SIGTERM`.
Tests must use isolated data and local services. Do not run season reset or
migration commands as validation, or contact production services during tests.

Run `scripts/testing/api-integration.sh` for the isolated database scenarios.
This requires Docker and enables the test-only `integration-tests` Cargo feature.
On this Mac, prefix the command with
`DEVELOPER_DIR=/Library/Developer/CommandLineTools`. The test client refuses
fixture resets unless the newly created container's marker is present.

Run `python3 scripts/testing/voting-integration.py` for voting WebSocket and
API Redis contracts. It launches a disposable loopback Redis server; the API
test checks that server's run marker before clearing any voting keys.

Run `python3 -m unittest discover -s scripts/maintenance/tests -p 'test_*.py'`
for offline maintenance-script tests. These use fake collections and do not
require PyMongo or a database connection.

Current verified totals: 582 client tests, 79 server unit tests, 30 collaboration
tests, 13 sorting WebSocket tests, 6 voting WebSocket tests with the Redis
feature, 1 API Redis integration test, and 80 server tests from the latest
MongoDB integration-feature run, plus 69
maintenance-script tests. The last client build differs from baseline CSS only
by the unused `hover:bg-blue-600`
rule from removed commented-out JSX. Authenticated browser flows, later
registration steps, and end-to-end database flows are still pending; the
public-entry comparison does not establish full application parity.
