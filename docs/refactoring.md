# Behavior-preserving refactoring

## Contract

Preserve rendered markup, styling, routes, request and response shapes, WebSocket
events, authentication rules, database fields, timing, and deployment entrypoints.
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
| `server` | API, authentication, persistence | Axum / MongoDB / Redis |
| `broadcaster` | Voting updates | Axum WebSocket / Redis |
| `sorting-broadcaster` | Shared sorting sessions | Axum WebSocket |
| `websocket-server` | Collaborative PIS editing | Socket.IO |

External deployment roots and executable names remain compatible during internal
reorganization. Runtime event and JSON names are public contracts, even when
internal names are standardized.

The real-time package names follow `rush-<domain>-websocket`: voting is
`rush-voting-websocket`, sorting is `rush-sorting-websocket`, and collaborative
PIS editing is `rush-pis-websocket`. Their existing service directories remain
the deployment roots. The Rust binaries remain `broadcaster` and
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

## Next slices

- Expand database scenarios for remaining branches and simplify long handler functions
  under those tests.
- Separate client domain helpers from hooks and external services; standardize
  their locations with import updates and regression checks.
- Extend real-time tests to failure/reconnect paths and cover any remaining
  protocol branches while preserving deployment roots and protocols.
- Decompose large client pages into feature components and hooks while preserving
  JSX, classes, effect dependencies, request order, and state ownership.
- Organize maintenance scripts and seed data without running destructive scripts.
- Rotate the formerly embedded MongoDB credential outside this repository and
  verify the new URI in local/deployment configuration.
- Resolve JS/JSX and TSX lint findings in verified slices, then add a complete
  lint gate; document setup,
  service naming, and remaining integration limits.
- Decide separately whether Attendance's undefined fetch-effect setters may
  be repaired; that would be a functional change outside this parity contract.

## Verification

Run `npm --prefix client test` for dependency-free client domain tests,
`npm --prefix client run typecheck` for typed components, and
`npm --prefix client run build` for the production bundle. Use Node 20 or newer
for the test runner. Run `npm --prefix client run lint` for configured JS/JSX
and TS/TSX lint; the current state has 8 errors and 7 warnings, so it is
tracked debt, not a passing check.
`npm --prefix client run lint:ci` gates the rest of the client at no more than
6 warnings. The regression workflow runs this scoped gate, the passing suites,
and the client build on pushes and pull requests; its first GitHub run remains
unverified.

Rust checks use `cargo test --locked --manifest-path <service>/Cargo.toml`.
On this Mac, auth and route tests need normal system access: inside the
filesystem sandbox, macOS Dynamic Store initialization panics before those
tests run. The full suite passes with normal system access.
Collaboration tests use `npm --prefix websocket-server test` and require permission
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

Current verified totals: 577 client tests, 79 server unit tests, 30 collaboration
tests, 13 sorting WebSocket tests, 6 voting WebSocket tests with the Redis
feature, and 80 server tests from the latest integration-feature run, plus 69
maintenance-script tests. The last client build differs from baseline CSS only
by the unused `hover:bg-blue-600`
rule from removed commented-out JSX. Authenticated browser flows, later
registration steps, and end-to-end database flows are still pending; the
public-entry comparison does not establish full application parity.
