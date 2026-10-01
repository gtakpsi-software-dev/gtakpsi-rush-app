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
| `broadcaster` | Voting updates | Axum WebSocket / Redis |
| `server/websockets/sorting` | Shared sorting sessions | Axum WebSocket |
| `server/websockets/pis` | Collaborative PIS editing | Socket.IO |

The API, PIS, and sorting sources now live under `server/`; their deployment
roots must point to the listed directories before this branch is deployed.
Executable names, routes, runtime events, and JSON names remain unchanged.
Move the voting service under `server/websockets/` in the next verified slice.

The real-time package names follow `rush-<domain>-websocket`: voting is
`rush-voting-websocket`, sorting is `rush-sorting-websocket`, and collaborative
PIS editing is `rush-pis-websocket`. The voting service retains its original
deployment root until moved. The Rust binaries remain `broadcaster` and
`sorting-broadcaster`, matching the current Dockerfiles.
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

- Move and rename the remaining voting service under
  `server/websockets/{pis,sorting,voting}`. Update CI, test runners, local
  commands, and Railway roots without changing socket URLs or event payloads.
- Finish dense client page and feature boundaries, including Admin, Rushee Zoom,
  sorting, Attendance presentation, and collaboration code. Pin JSX, effect
  timing, request order, and state ownership before each move.
- Cover remaining API branches with isolated database tests, then simplify
  controller and assignment logic under those tests.
- Expand real-time failure, reconnect, and role-change coverage for all three
  protocols, then standardize internal handler and lifecycle names.
- Inventory maintenance commands and seed inputs, move supported tools into
  clear groups, and remove only scripts shown unused. Never validate a reset
  by running it against a real database.
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
On this Mac, auth and route tests need normal system access: inside the
filesystem sandbox, macOS Dynamic Store initialization panics before those
tests run. The full suite passes with normal system access.
Collaboration tests use `npm --prefix server/websockets/pis test` and require permission
to bind local ports; their pinned Socket.IO client is a development dependency.
The two sorting WebSocket loopback tests also require local port access; the
remaining eight sorting tests pass inside the filesystem sandbox.
Tests must use isolated data and local services. Do not run season reset or
migration commands as validation, or contact production services during tests.

Run `scripts/testing/api-integration.sh` for the isolated database scenarios.
This requires Docker and enables the test-only `integration-tests` Cargo feature.
On this Mac, prefix the command with
`DEVELOPER_DIR=/Library/Developer/CommandLineTools`. The test client refuses
fixture resets unless the newly created container's marker is present.

Run `python3 -m unittest discover -s scripts-migrations/tests -p 'test_*.py'`
for offline maintenance-script tests. These use fake collections and do not
require PyMongo or a database connection.

Current verified totals: 581 client tests, 79 server unit tests, 30 collaboration
tests, 13 sorting WebSocket tests, 6 voting WebSocket tests with the Redis
feature, and 80 server tests from the latest integration-feature run, plus 69
maintenance-script tests. The last client build differs from baseline CSS only
by the unused `hover:bg-blue-600`
rule from removed commented-out JSX. Authenticated browser flows, later
registration steps, and end-to-end database flows are still pending; the
public-entry comparison does not establish full application parity.
