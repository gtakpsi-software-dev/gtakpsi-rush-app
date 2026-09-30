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
2. Collaboration protocol baseline: 7 integration tests pass against the original
   server using real local HTTP and Socket.IO connections. They cover membership,
   health/stats, full-text acknowledgments, stale-version rejection, hydration,
   presence, room isolation, legacy transforms, and bounded history.
3. Collaboration server extraction: the 365-line entrypoint is now 26 lines;
   `src/app.js` composes HTTP routes, room cleanup, and focused membership,
   operation, update, and presence handlers. All 10 tests pass, including cleanup
   boundaries and reconnect retention. Executable AST comparison confirms all
   9 original HTTP/socket callbacks are unchanged except injected timer access.
   The deployment command, port, signals, event names, and payloads are retained.
4. API characterization: 8 tests pass for rush-night attribution/lead-in,
   timezone matching, canonical merging, interaction counts, legacy model
   defaults, self-service field privacy, and vote serialization.
5. Client visibility separation: 14 client tests pass, including every boolean
   role/restriction combination. Pure policy stays independent of Firebase and
   React; `hooks/useCommentVisibility.js` owns the existing effect. The hook body
   is unchanged, the build passes, generated CSS matches the baseline byte for
   byte, and the policy/hook/test files pass ESLint.
6. Rust naming: renamed `models/Rushee.rs` to `models/rushee.rs` and
   `middlewares/timeHelpers.rs` to `middlewares/time_helpers.rs`, updating every
   reference. All 8 API tests pass; compiler warnings decrease from 78 to 76.
7. Admin scheduling extraction: 9 handlers now live in focused questions,
   timeslots, and rush-night modules. Each moved handler matches the original
   after rustfmt normalization. All 10 API tests pass, including question payload
   defaults and category-clearing contracts. Database-backed endpoint execution
   still needs an isolated MongoDB integration environment.
8. Admin sorting extraction: payloads, board queries, notes, and reorder/move
   handlers are separate modules, with shared locks still scoped to the sorting
   feature. Seven handler bodies match the original after formatting/comment
   normalization. All 14 API tests pass, including status validation and exact
   sorting JSON field names. `controllers/admin.rs` is down to 1,197 lines;
   remaining extraction is tracked below.
9. Sorting naming: internal fields use snake_case with explicit Serde camelCase
   mapping. Existing request/response names and signed indices are covered by
   15 passing API tests. Compiler warnings decrease from 76 to 62.
10. Admin access extraction: role management, app-access settings, and comment
    visibility now have separate modules. All 10 moved handlers match the
    originals after formatting; the 15 API tests still pass.
11. Admin controller extraction complete: the former 2,044-line file is now a
    46-line module index plus resource modules. PIS signup, availability,
    assignment, and exports are separated; all 14 remaining handler bodies
    match the originals after formatting. The largest admin implementation
    module is 304 lines. All 15 API tests pass.
12. Rushee PIS extraction: added characterization tests for rating boundaries,
    stable question order, autosave fields, and self-service query codes. Six
    interview handlers now live in question, response, and scheduling modules;
    each body matches its original after formatting. All 19 API tests pass.
13. Isolated MongoDB integration: added a Docker harness with a pinned MongoDB
    image, ephemeral storage, loopback-only port, per-run database marker, and
    cleanup trap. Four scenario groups cover registration/capacity/rescheduling,
    self-service privacy, PIS reveal/persistence/autosave, comments/ratings, and
    sorting notes. The same assertions pass on the original `5250f4b` and current
    code. The integration command runs 20 passing Rust tests (19 unit tests plus
    one database scenario suite); it tests real handlers and persistence, with
    HTTP routing/auth integration still to follow.
14. Rushee comments extraction: creation, deletion, editing, and brother comment
    lookup live in separate files with the existing rating predicate. All four
    handler bodies match their originals after formatting. All 20 API tests,
    including real MongoDB comment/rating scenarios, pass after extraction.
15. Rushee controller extraction complete: the former 1,491-line file is now a
    20-line module index. Registration, lookup, profile edits, and attendance
    have separate modules; all nine remaining handler bodies match the originals.
    Added database assertions for duplicate check-in prevention, profile/PIS
    name synchronization, sequential partial writes, and lookup responses before
    moving those handlers. All 20 API tests pass after extraction. Removed the
    unused private `Params` struct while removing the old controller file.
16. HTTP routing baseline: isolated router construction from process startup
    without changing route declarations or middleware order. Five tests cover
    health/404 responses, protected-route rejection, malformed authorization,
    public JSON validation, API-key gating, and CORS preflight. The database
    harness enables a test API key; all 25 Rust tests pass in that configuration.
    The initial no-key run also passes. On macOS, the existing Reqwest client
    reads system proxy settings and needs normal host permissions for these tests.
17. Route extraction: startup is 68 lines; route declarations live in public,
    brother, bid-committee, and admin modules. All four builder expressions match
    the original tokens after formatting normalization. The outer CORS layer
    and API-key/role middleware ordering are preserved. Removed the unreachable
    health-check branch; the exact healthy response remains covered. All 25
    tests pass with MongoDB/API-key validation enabled, and all five HTTP tests
    pass again without a configured key after the final cleanup.

18. Authentication baseline: seven offline tests exercise the full admin/bidcom/
    allowlist matrix with locally signed RSA tokens, claim/signature rejection,
    missing service accounts, HTTP role gates, and bearer parsing. They preserve
    the existing distinction between extractor rejection (403 for invalid tokens)
    and middleware rejection (401). The fixture keys are disposable public test
    data, and the populated certificate cache prevents Firebase requests. All
    seven tests pass against the original authentication implementation.
19. Authentication extraction: split the 620-line module into token verification,
    certificate caching, role administration, OAuth assertions, and HTTP middleware.
    All 20 function bodies match the originals after formatting normalization
    before the comment cleanup. Existing re-exports preserve handler imports.
    The complete 31-test API unit suite passes; no Firebase calls are required.
20. Authentication simplification: admin and bid-committee verification now reuse
    the existing brother token validation, and all request gates reuse the same
    bearer parser. Removed 131 lines of duplicated validation/parsing without
    changing role rules or rejection codes. All 32 API tests pass with the
    disposable MongoDB harness and API key enabled.
21. Sorting WebSocket baseline: seven tests cover join/viewer counts, malformed
    messages, admin-only actions, drag ownership, conflicts, and save notifications.
    A real loopback WebSocket test covers connection snapshots, direct denial,
    broadcast delivery, and drag release/viewer counts on disconnect. All pass
    against the original implementation. The test client uses the already locked
    Tungstenite version; no existing dependency versions changed.
22. Sorting service extraction: startup is 33 lines, with separate state,
    protocol, router, session, message-handler, and stale-drag cleanup modules.
    The four protocol/session functions and cleanup loop match their originals
    after formatting. All seven tests pass, and the real WebSocket test now uses
    the production router. Port defaults, health text, CORS, queue capacities,
    cleanup timing, message names, and deployment paths are unchanged.
23. Sorting cleanup coverage: a paused Tokio clock verifies the initial 10-second
    delay, release events for multiple stale drags, preservation of fresh drags,
    and no repeated release events on the next tick. Backdated monotonic timestamps
    avoid minute-long test waits. All eight sorting tests pass.
24. Sorting cleanup: removed the unused duplicate client ID (the map key remains
    authoritative), simplified state/router construction, and replaced redundant
    comments with ownership and lifecycle rationale. Test fixtures now use the
    production state constructor. All eight tests pass with no compiler warnings.
25. API import cleanup: removed compiler-confirmed unused imports in registration,
    voting, attendance, and rushee models. `cargo check --locked` passes; this
    slice changes imports only. Other existing API warnings remain tracked debt.

The API baseline builds with 78 existing warnings and zero tests. On this Mac,
select the installed command-line tools for Cargo with
`DEVELOPER_DIR=/Library/Developer/CommandLineTools`; the selected Xcode app has an
unaccepted license. No machine-wide toolchain settings were changed.

## Next slices

- Expand database scenarios for remaining branches and simplify long handler functions
  under those tests.
- Separate client domain helpers from hooks and external services; standardize
  their locations with import updates and regression checks.
- Characterize and split the Rust voting real-time service using the same clear
  state/protocol/session boundaries; preserve deployment roots and protocols.
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
Collaboration tests use `npm --prefix websocket-server test` and require permission
to bind local ports; their pinned Socket.IO client is a development dependency.
Tests must use isolated data and local services. Do not run season reset or
migration commands as validation, or contact production services during tests.

Run `scripts/testing/api-integration.sh` for the isolated database scenarios.
This requires Docker and enables the test-only `integration-tests` Cargo feature.
On this Mac, prefix the command with
`DEVELOPER_DIR=/Library/Developer/CommandLineTools`. The test client refuses
fixture resets unless the newly created container's marker is present.

Current verified totals: 14 client tests, 10 collaboration tests, 8 sorting
WebSocket tests, and 32 API tests with the integration feature. The last client build passes with baseline
CSS unchanged. Full browser flow/visual testing and end-to-end authenticated
database flows are still pending; these checks do not yet establish full
application parity.
