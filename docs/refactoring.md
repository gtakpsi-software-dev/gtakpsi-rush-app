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

## Slice ledger

1. Client characterization tests: real assertions for rating labels/classes,
   speculative warnings, name matching, rush-night merging, and interaction counts.
   `npm --prefix client test`: 11 passing. Test files pass ESLint.

## Next slices

- Characterize collaboration room lifecycle, text updates, version rejection,
  presence, and operation history; separate startup, HTTP routes, room state,
  and event handlers.
- Separate client domain helpers from hooks and external services; standardize
  their locations with import updates and regression checks.
- Characterize Rust models, validation, routing, and real-time message contracts;
  split controllers and socket services by responsibility.
- Decompose large client pages into feature components and hooks while preserving
  JSX, classes, effect dependencies, request order, and state ownership.
- Organize maintenance scripts and seed data without running destructive scripts.
- Consolidate verification commands and CI; resolve lint findings in verified
  slices; document setup, service naming, and remaining integration limits.

## Verification

Run `npm --prefix client test` for dependency-free client domain tests and
`npm --prefix client run build` for the production bundle. Use Node 20 or newer
for the test runner. Run `npm --prefix client run lint` for repository-wide lint;
the starting failures above are tracked debt, not a passing check.

Rust checks use `cargo test --locked --manifest-path <service>/Cargo.toml`.
Tests must use isolated data and local services. Do not run season reset or
migration commands as validation, or contact production services during tests.
