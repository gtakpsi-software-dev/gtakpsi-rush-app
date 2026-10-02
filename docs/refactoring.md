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
Inside the API, `controllers/` owns HTTP handlers, `services/` owns rush-domain
operations, `storage/` owns MongoDB and Redis connection factories, and
`middlewares/` owns request gates. These are internal module paths; HTTP and
socket contracts remain unchanged.
PIS auto-assignment planning, loading, execution, and persistence live in
`services/`; its controller retains the existing HTTP response mapping.

The remaining admin, rushee-profile, and sorting page files were reviewed.
They now assemble bounded feature hooks, actions, and views; moving their
remaining state or props into another wrapper would obscure ownership without
removing a distinct responsibility.
The unrouted brother PIS slot-selection page and its private helpers were
removed after confirming that no active route or runtime module imports them.
The separately unrouted PIS dashboard and its private view and loader were
removed under the same route/import check; `/my-pis` remains active.
The unrouted face-attendance page and its private camera and submission modules
were also removed. The active registration and rushee photo flows still use
`lib/imageProcessing.js` and `react-webcam`.
The unrendered shared Button component and its private tests were removed.
The PIS voice recorder and transcription modules were also removed after
confirming their only baseline UI was commented out. The PIS answer handler's
voice-tagged update branch remains unchanged.
The remaining 269 client JS/TS modules, including two type declarations, all
have a static import path from `main.jsx`. This does not establish that every
export or conditional branch is used.
The collaboration hook's unused legacy operation exports and private helper
were removed. No runtime source imported them, and the production JS and CSS
asset hashes stayed identical after removal.
The test-only alternate API-client factory was removed; the default client's
prefix, API-key interceptor, and error forwarding still have direct tests.
Production asset hashes remained identical.
The PIS Socket.IO entrypoint reaches all 14 source modules through static
imports. Current Rust build/test dependency lists cover all 151 API source
files, 16 sorting socket files, and 22 voting socket files; the API's Redis
integration module is compiled only with its test feature. This source-level
check does not establish that every handler or branch executes.
The admin Add PIS page similarly keeps authentication and request construction
in the page while its question form lives with the other admin PIS views.
All 741 tracked Python, Rust, JavaScript, JSX, TypeScript, and TSX files,
including tests, are under 200 lines; the largest is a 199-line maintenance
test. This is a size check, not a judgment that every module boundary is ideal.

## Slice ledger

The verified atomic slices are archived by range:

- [Slices 1–100](refactoring-history/001-100.md)
- [Slices 101–200](refactoring-history/101-200.md)
- [Slices 201–300](refactoring-history/201-300.md)
- [Slices 301–400](refactoring-history/301-400.md)
- [Slices 401–500](refactoring-history/401-500.md)
- [Slices 501–600](refactoring-history/501-600.md)
- [Slices 601–700](refactoring-history/601-700.md)

## Remaining work

- Update the four deployed service roots to the paths in the table, then verify
  their health endpoints and the socket URL wiring without changing event
  payloads.
- Cover remaining API failure and partial-write branches with isolated data
  before simplifying their controller logic. Firebase role-claim success and
  failure paths now have offline HTTP coverage; real Google integration remains
  unverified.
- Expand real-time failure coverage for protocol branches that are not yet
  characterized. The sorting socket already has a live role-change test as
  well as reconnect, malformed-message, and cleanup coverage.
- Confirm which remaining manual maintenance commands are truly obsolete before
  removing them. The one-time Night 1 attendance migration and temporary
  historical rating repair were removed. Remaining entrypoints and side effects
  are listed in
  `scripts/maintenance/README.md`; absence of app imports does not prove they
  are unused. Never validate a reset against real data.
- Verify authenticated browser flows, later registration steps, database
  workflows, GitHub CI for current HEAD, and deployed service roots before
  claiming parity.
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
and TS/TSX lint; the current state has 8 errors, so it is
tracked debt, not a passing check.
`npm --prefix client run lint:ci` gates the rest of the client with zero
warnings. The regression workflow runs this scoped gate, the passing suites,
and the client build on pushes and pull requests. All six jobs passed for
remote commit `77e45bd` in [GitHub Actions run 36956853486](https://github.com/gtakpsi-software-dev/gtakpsi-rush-app/actions/runs/36956853486).
Later local commits still need their own GitHub CI run.

Rust checks use `cargo test --locked --manifest-path <service>/Cargo.toml`.
`cargo fmt --manifest-path <service>/Cargo.toml -- --check` passes for the API,
sorting, and voting crates and is enforced in regression CI.
On this Mac, auth and route tests need normal system access: inside the
filesystem sandbox, macOS Dynamic Store initialization panics before those
tests run. The full suite passes with normal system access.
Collaboration tests use `npm --prefix server/websockets/pis test` and require permission
to bind local ports; their pinned Socket.IO client is a development dependency.
Sorting WebSocket loopback tests also require local port access. The complete
15-test suite passes with that access.
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

Current verified totals: 549 client tests, 87 server unit tests, 31 collaboration
tests, 15 sorting WebSocket tests, 6 voting WebSocket tests with the Redis
feature, 1 API Redis integration test, and 88 server tests from the latest
MongoDB integration-feature run, plus 64 maintenance-script tests. Current CSS
omits the unused `hover:bg-blue-600` rule from removed commented-out JSX and
36 utility selectors that appeared only in three unrouted pages, an unused
Button component, and a dormant recorder. No remaining client source uses those
exact class names. The JavaScript bundle
changes when logic is refactored, so its hash alone cannot establish parity;
the targeted behavior tests cover those paths. Authenticated browser flows, later
registration steps, and end-to-end database flows are still pending; the
public-entry comparison does not establish full application parity.
Local browser smoke checks with placeholder service URLs rendered the landing,
registration entry, login, password-reset, and account-creation routes without
console errors. The public navigation buttons and links reached their expected
routes. Form submissions were not verified.
Against baseline `5250f4b`, those five public routes produced identical rendered
root markup at desktop (1280 x 720) and mobile (390 x 844) widths. The landing
and registration controls also had identical settled positions and dimensions;
the other mobile public routes had matching control widths and dimensions.
Screenshots of the settled landing page were visually checked at both widths.
These checks used placeholder local service URLs and did not exercise signed-in
screens, form submissions, or backend workflows.
The API route declarations were also compared with baseline `5250f4b`: all 73
method/path bindings remain in the same public, brother, bid committee, or
admin route group, and all 71 paths retain their explicit `OPTIONS` setting.
The sole handler-name difference is the internal spelling correction from
`get_elibibility` to `get_eligibility`. This static audit does not replace
deployed endpoint or authenticated browser checks.
Static event-name comparison with the same baseline found the same seven PIS
Socket.IO incoming and eight outgoing names, the same ordered sorting message
type names, and the same three voting update types. Runtime socket tests cover
selected payloads and lifecycle cases; the name comparison alone does not
prove deployed event delivery.
The client still declares the same 23 active routes; the bid committee sorting
component was renamed internally without changing `/bidcom/sorting`. Voting,
sorting, and PIS also retain their original socket/health paths and local port
defaults (4000, 4001, and 3001 respectively). These are source-level checks,
not deployed URL verification.
After slice 620, the full local regression set passed again: client tests,
scoped lint, typecheck, and production build; guarded API integration; sorting
and voting WebSocket tests; PIS Socket.IO tests; maintenance tests; and Rust
formatting for all three crates. This verified that checkout locally,
not GitHub CI or deployed services at that point.
After slice 648, the same local regression set passed on the current branch:
549 client tests, 88 guarded API tests, 15 sorting socket tests, 6 voting
socket tests plus the API Redis contract, 31 PIS socket tests, and 64 offline
maintenance tests. Client scoped lint, typecheck, build, and all three Rust
format checks pass. Full client lint still reports only the eight pre-existing
undefined Attendance setters; fixing them would change runtime behavior.
GitHub CI passed for earlier remote commit `77e45bd`, but has not run against
the later local changes.
The PIS socket tests pin one existing reconnect quirk: when two sockets join
with the same user ID, the older socket's disconnect removes that user's
presence even while the replacement stays connected. Changing this needs a
separate behavior decision.
The sorting WebSocket suite also checks a live admin-to-viewer-to-admin role
change: an existing drag can finish after demotion, while new save broadcasts
resume only after the later admin join.
The voting socket integration also pins a duplicate-ID quirk: when a second
admin socket registers under the same route ID, the older socket's disconnect
removes the newer socket from the broadcast map even though it remains connected.
