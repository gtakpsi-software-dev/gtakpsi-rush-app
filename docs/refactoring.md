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

The real-time package names follow `rush-<domain>-websocket`: voting is
`rush-voting-websocket`, sorting is `rush-sorting-websocket`, and collaborative
PIS editing is `rush-pis-websocket`. Their existing service directories remain
the deployment roots. The Rust binaries remain `broadcaster` and
`sorting-broadcaster`, matching the current Dockerfiles.

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
26. Voting WebSocket baseline: a direct fanout test checks delivery and dead-client
    pruning for both admin and voter channels. A real WebSocket test uses a fresh
    loopback Redis instance to cover snapshot order, JSON string payloads, null
    question snapshots, invalid vote filtering, admin-only vote updates, pub/sub
    delivery, and disconnect cleanup. The harness guards the exact Redis instance
    before writing fixtures, and tests pass against the original socket handlers.
27. Voting fanout cleanup: admin and voter sockets now share one client map type
    and broadcast routine. Both original broadcast bodies match the shared one
    after formatting normalization. The real Redis/WebSocket suite still passes.
28. Admin voting socket extraction: moved pub/sub subscriptions and retries away
    from connection, snapshot, and ping/pong handling. All four function bodies
    match the original after formatting; the Redis/WebSocket tests still pass.
29. Voter socket extraction: the second socket now has the same session/pubsub
    module boundaries. Its four function bodies match the original after
    formatting, and the Redis/WebSocket tests pass.
30. Voting naming: both admin and voter modules now export `ws_handler` and
    `spawn_pubsub_listener`. Only internal Rust call sites changed; the real
    Redis/WebSocket suite confirms the same routes and messages.
31. Voting router extraction: startup now delegates the unchanged `/`,
    `/voter/:id`, and `/admin/:id` route patterns to `app.rs`. The integration
    harness uses that production router and verifies the health response plus
    both WebSocket paths against disposable Redis. Startup still binds the same
    default port and starts both subscription loops before serving.
32. Voting snapshot extraction: admin and voter initial Redis reads now live in
    role-specific snapshot modules, leaving both session files at 112 lines.
    Each query and serialization block matches the original after formatting;
    the live Redis/WebSocket suite confirms snapshot order and payloads.
33. Voting cleanup: both role modules use `NEXT_CLIENT_ID`, explain the
    snapshot-before-registration ordering, and remove redundant comments.
    Compiler-confirmed unused Redis imports are gone. The voting crate's normal
    test command passes with no compiler warnings; runtime behavior is unchanged.
34. Shared sorting board data: admin, bid-committee, and brother pages now use
    one set of column labels, tag styles, zoom limits, empty columns, and stable
    grouping logic. Three new tests cover visible labels/classes, unknown-status
    fallback, ordering, fresh state arrays, and input identity. All 17 client
    tests pass; the production build succeeds, generated CSS is byte-identical
    to the starting baseline, and the affected JSX remains unchanged.
35. Shared editable notes panel: admin and bid-committee sorting pages now use
    one panel component while keeping their exact role-specific headings,
    navigation URLs, callbacks, and existing page-owned autosave logic. Markup
    snapshots from the original panels match in idle and loading states for both
    roles, including the bid committee's number-only heading. Handler tests
    cover closing, tag toggles, text changes, and navigation attachment. All 19
    client tests pass, the production build succeeds, and generated CSS remains
    byte-identical to the starting baseline.
36. Brother sorting details panel: extracted the view-only panel while keeping
    fetch state, its navigation URL, and its close handler on the page. Original
    markup matches in loading, populated, and empty states, including unknown-tag
    filtering. Handler checks cover the backdrop, close buttons, and navigation.
    All 21 client tests pass, the production build succeeds, and generated CSS
    remains byte-identical to the starting baseline.
37. Sorting zoom controls: all three boards now use the same component for their
    existing zoom buttons and percentage display. Original markup matches at
    100% and 125% for every board; a handler test covers all three buttons. The
    pages retain their own scale limits, pan state, and callbacks. All 23 client
    tests pass, the production build succeeds, and CSS remains byte-identical.
38. Sorting presence badge: the three boards share one live viewer indicator.
    The admin-only rule that hides its own idle connection remains explicit.
    Original markup matches across disconnected, alone, multiple-viewer, and
    one/two-active-editor states for all three boards. All 24 client tests pass,
    the production build succeeds, and CSS remains byte-identical.
39. Sorting ghost cards: moved the shared overlay markup out of all three boards,
    retaining card order, keys, positions, editor names, and the admin-only wider
    card class. Original markup matches in empty, single-card, and two-card
    states for every board. All 25 client tests pass, the production build
    succeeds, and CSS remains byte-identical.
40. Client test harness cleanup: five TSX regression files now use one local
    loader for transpilation, isolated execution, and explicit module stubs.
    This removes duplicate harness code without changing fixtures or production
    modules. All 25 client tests pass and the affected test files pass ESLint.
41. Admin availability editor modal: moved the 120-line modal markup out of
    `Admin.jsx` while retaining its state, date grouping, requests, and callbacks
    on the page. Original rendered HTML matches for empty, selected, and saving
    states; tests also exercise backdrop, bulk selection, slot toggle, cancel,
    and save callbacks. All 27 client tests pass, the production build succeeds,
    and CSS remains byte-identical to the starting baseline. `Admin.jsx` is now
    1,991 lines; its other sections and handlers still need decomposition.
42. Admin PIS question card: moved form and question-bank markup into a focused
    component while leaving fetch state and request helpers on the page. Original
    HTML matches empty, populated, and loading states. Tests verify input number
    conversion, add/delete request order, category draft updates, save, and
    refresh handlers. All 30 client tests pass, the build succeeds, and CSS
    remains byte-identical. `Admin.jsx` is now 1,909 lines.
43. Admin access card: moved brother search and admin/bid-committee controls
    into one component without moving claim requests or search state. Original
    HTML matches idle, search-result, selected, and in-progress states. Tests
    cover search clearing, brother selection, role callbacks, and disabled
    actions. All 33 client tests pass, the build succeeds, and CSS remains
    byte-identical. `Admin.jsx` is now 1,815 lines.
44. Migration diagnostics: moved the pure comment-shape validator out of the
    MongoDB scan script into `scripts-migrations/lib`, retaining its parsed
    function body exactly. Five standard-library-only tests cover valid and
    malformed comments, diagnostic ordering, legacy boolean ratings, and the
    script's summary against a fake collection. No migration or live database
    operation was run. Removed unused imports and redundant validator comments.
45. Rushee import script: put its direct-command workflow behind `main()` so
    importing the module cannot connect to MongoDB or delete data. Moved the
    extended-JSON conversion into `scripts-migrations/lib` with its parsed
    function body unchanged. Offline fake-service tests verify the original
    connect/read/delete/insert/count/close order, output counts, recursive date
    and ObjectId conversions, and import safety. All 8 maintenance-script tests
    and Python compilation pass. The actual import remains unrun because it
    deletes real data and its source JSON file is absent from this checkout.
46. Test-data cleanup script: moved the existing direct-command workflow behind
    `main()` so imports cannot connect or delete. The direct-command statement
    AST matches the original, and offline fake-service tests verify dry-run
    output, the `--apply` deletion queries and order, and import safety. All 11
    maintenance-script tests and Python compilation pass; no live cleanup ran.
47. Admin access settings: moved the three Rush App, comment-visibility, and
    midterm cards into one component while retaining state and update requests
    on `Admin.jsx`. Original HTML matches normal, restricted, busy, and partial
    disable states. Tests verify all four toggle fields and values. All 35 client
    tests pass, the build succeeds, and CSS remains byte-identical. `Admin.jsx`
    is now 1,692 lines.
48. PIS rescheduling card: extracted the search, selected-rushee, timeslot,
    and submit UI while keeping state and requests in `Admin.jsx`. Original HTML
    matches empty, search, and selected states; tests also cover search clearing,
    rushee selection, timeslot changes, and submission callbacks. All 37 client
    tests pass, the build succeeds, and CSS remains byte-identical. `Admin.jsx`
    is now 1,594 lines. Existing `Admin.jsx` lint errors remain tracked debt;
    the new test file passes lint.
49. Admin scheduling cards: moved the PIS timeslot and rush-night add/delete
    controls into one component while retaining state and request handling in
    `Admin.jsx`. Original HTML matches empty and populated values. Tests cover
    all four input conversions and the exact endpoint, payload, method, and
    message for each button. All 39 client tests pass, the build succeeds, and
    CSS remains byte-identical. `Admin.jsx` is now 1,540 lines.
50. Admin data actions: moved five export/fetch cards into one component,
    retaining their original handlers in `Admin.jsx`. The original card markup
    and order match, and tests verify every export callback and fetch request
    argument. All 41 client tests pass, the build succeeds, and CSS remains
    byte-identical. `Admin.jsx` is now 1,479 lines.
51. Admin CSV builders: moved the four pure CSV-formatting bodies into the admin
    data feature. Their parsed JavaScript bodies match the originals; requests,
    downloads, filenames, and toast handling remain in `Admin.jsx`. Four tests
    cover field order and quoting, row ordering, date forms, flexible labels,
    and blank brother sentinels. All 45 client tests pass, new files pass lint,
    the build succeeds, and CSS remains byte-identical. `Admin.jsx` is now
    1,409 lines.
52. PIS availability section: moved its form status, submissions,
    auto-assignment, and export cards into one component with state and request
    handlers still owned by `Admin.jsx`. Original HTML matches inactive, active,
    busy, and populated states. Tests cover ISO and extended-JSON timestamps,
    action callbacks, and disabled states. All 48 client tests pass, the build
    succeeds, and CSS remains byte-identical. `Admin.jsx` is now 1,277 lines.
53. Admin CSV downloads: consolidated four identical browser download blocks
    into one helper while retaining the original filename prefixes, date
    generation inside the supported-download branch, DOM call order, and toast
    handling. Two fake-browser tests cover supported and unsupported links.
    All 50 client tests pass, new files pass lint, the build succeeds, and CSS
    remains byte-identical. `Admin.jsx` is now 1,234 lines.
54. Admin access settings actions: moved the Rush App, midterm, and comment
    visibility request handlers into one access module. State stays on the page;
    the module receives the current render's settings and preserves each full
    update payload, actor, toast, and loading transition. Four tests cover
    success, rejected responses, and transport failures. All 54 client tests
    pass, the new files pass lint, the build succeeds, and CSS remains
    byte-identical. `Admin.jsx` is now 1,129 lines.
55. Admin lint cleanup: removed an unused React binding and unused catch
    bindings. `Admin.jsx` now has zero ESLint errors; its two existing effect
    dependency warnings remain for a separate behavior-verified slice. All 54
    client tests pass, the build succeeds, and CSS remains byte-identical.
56. PIS question replacement script: moved environment loading and URI
    validation inside `main()`, so importing the script cannot connect or
    trigger its destructive replacement. The direct-command database and output
    body matches the original parsed Python AST after the URI variable rename.
    Three offline tests cover import safety, missing configuration, and the
    original connect/read/count/delete/insert/verify/close order. All 14
    maintenance-script tests and Python compilation pass; no live database
    operation ran.
57. Pledge headshot uploader: moved Firebase initialization, MongoDB access,
    image processing, upload, public-URL creation, and database writes behind
    `main()`. The direct-command workflow matches the original parsed Python
    AST after excluding the unchanged static filename map. Three fake-service
    tests cover import safety, operation order, and reuse of an existing
    Firebase app. All 17 maintenance-script tests and Python compilation pass;
    no live storage or database operation ran.
58. Firebase admin-claim script: delayed service-account initialization until
    direct command execution or an explicit imported function call. The CLI
    still initializes before validating arguments. Existing claim-update and
    argument-handling bodies match the original parsed Python AST. Four
    fake-SDK tests cover import safety, claim preservation, usage errors, and
    missing users. All 21 maintenance-script tests and Python compilation pass;
    no live Firebase claim was changed.
59. New-rush season reset: moved configuration, connection, deletion, and bulk
    update into a direct-command `main()` while leaving the static keep list
    available for inspection. The direct-command body matches the original
    parsed Python AST. Three fake-collection tests cover import safety, missing
    configuration, operation order, keep-list filtering, and reset fields. All
    24 maintenance-script tests and Python compilation pass; no live reset ran.
60. Rushee data pull: wrapped the MongoDB read and Excel write in a
    direct-command `main()` without changing its embedded connection target.
    The direct-command body matches the original parsed Python AST. Two
    fake-service tests cover import safety, query order, column mapping,
    flexible-window labels, and output filename. All 26 maintenance-script
    tests and Python compilation pass; no live database or file export ran.
61. Historical ratings repair: wrapped the MongoDB scan and updates in
    direct-command `main()` without changing its embedded connection target.
    The direct-command body matches the original parsed Python AST. Two
    fake-service tests cover import safety, per-name arithmetic means, empty
    ratings, and update order. All 28 maintenance-script tests and Python
    compilation pass; no live database write ran.
62. Collaboration test synchronization: the connection helper now waits for
    both `document-state` and `users-updated` before returning a joined client.
    This removes a race where a later membership assertion could consume the
    first client's delayed self-join event. Production server code and protocol
    are unchanged. All 10 collaboration tests pass in four consecutive
    loopback runs.
63. Collaboration presence handlers: combined the cursor and typing listeners
    around their shared joined-socket identity and room-activity behavior while
    retaining both event names and payloads. Two unit tests cover unjoined and
    missing-room drops, identity override, and activity updates. All 12
    collaboration tests pass against the real loopback Socket.IO server.
64. Collaboration document snapshots: join hydration and explicit state
    requests now use one room serializer. It retains per-field versions and
    version zero for text written by legacy operations. Two tests cover both
    entry paths, unjoined/missing-room requests, and fresh snapshot objects.
    All 14 collaboration tests pass against the real loopback Socket.IO server.
65. Sorting WebSocket ownership checks: shared the joined-admin and active-drag
    owner checks across start/save and move/end messages. The checks retain
    viewer defaults and allow an existing owner to finish after a role change.
    A new test covers missing clients and unknown cards. All 9 sorting service
    tests, including a real loopback WebSocket test, pass; rustfmt is clean.
66. Voting WebSocket snapshot reads: both roles now use one Redis reader for
    rushee and question fields. Admins still receive votes first; voters do
    not receive votes. The reader retains stored JSON as a string, nulls for
    absent values, per-field timeouts, and the existing error logs. Expanded
    disposable-Redis coverage checks both roles with a missing rushee and a
    saved question. Both voting service tests pass; rustfmt is clean.
67. Real-time package names: standardized the three package manifests and lock
    files to `rush-<domain>-websocket`. Explicit Rust binary names preserve the
    Dockerfile executable paths; directories, ports, protocols, and startup
    commands remain unchanged. All 2 voting, 9 sorting, and 14 collaboration
    tests pass. Both Rust binaries build at their original paths.
68. Admin PIS time helpers: moved the reschedule labels, current appointment
    fallback, availability slot labels, and date grouping out of `Admin.jsx`
    into the PIS feature directory. Tests cover exact labels, missing times,
    grouping order, and retained slot objects. All 56 client tests pass, the
    production build succeeds, and generated CSS matches the baseline. The
    new files pass lint; `Admin.jsx` retains its two existing hook warnings and
    is now 1,075 lines.
69. Admin availability form actions: moved send, resend, deactivate, assign,
    and clear handlers into the availability feature. Tests cover confirmation
    cancellation, request order, success state, messages, failure fallbacks,
    and loading cleanup. All 60 client tests pass, the build succeeds, and CSS
    matches the baseline. `Admin.jsx` is now 944 lines with its two existing
    hook warnings; the new files pass lint.
70. Admin availability editor actions: moved slot normalization, selection,
    bulk actions, and save/refresh logic into the availability feature. Tests
    cover both date formats, Set behavior, exact save payload and request order,
    rejected saves, and failed refresh behavior. All 64 client tests pass, the
    build succeeds, and CSS matches the baseline. `Admin.jsx` is now 874 lines;
    the new files pass lint and the two existing hook warnings remain.
71. Admin data actions: moved the generic request handler and four CSV export
    actions into the data feature. Tests cover time conversion, request methods,
    endpoints, CSV headers and filename prefixes, success messages, and failure
    paths. The handler filename is distinct from `AdminDataActions.tsx` so Vite
    resolves both on case-insensitive filesystems. All 67 client tests pass, the
    build succeeds, and CSS matches the baseline. `Admin.jsx` is now 726 lines;
    the new files pass lint and the two existing hook warnings remain.
72. Admin role actions: moved brother selection, status lookup, and admin/bid
    committee changes into the access feature. Tests cover identifier priority,
    strict status values, privileged request gates and payloads, messages, and
    failure cleanup. All 71 client tests pass, the build succeeds, and CSS
    matches the baseline. `Admin.jsx` is now 628 lines; the new files pass lint
    and the two existing hook warnings remain.
73. Admin PIS rescheduling: moved rushee selection and reschedule requests into
    the PIS feature. Tests cover the JSON-encoded timeslot request, selection
    reset only after success, capacity refresh, errors, and a failed refresh
    after a successful mutation. All 75 client tests pass, the build succeeds,
    and CSS matches the baseline. `Admin.jsx` is now 580 lines; the new files
    pass lint and the two existing hook warnings remain.
74. Admin PIS questions: moved question loading, stable order fallback, category
    normalization, and save/refetch behavior into the PIS feature. Tests cover
    copying before sorting, unnumbered questions, null categories, write
    failures, and loading cleanup. All 79 client tests pass, the build succeeds,
    and CSS matches the baseline. `Admin.jsx` is now 536 lines; the new files
    pass lint and the two existing hook warnings remain.
75. Admin initial load: moved authentication and sequential page hydration into
    the admin bootstrap feature without changing the effect gate, navigation
    behavior, request order, or state shapes. Tests cover claim/allowlist access,
    missing users, continued loading after a verification redirect, a failed
    individual fetch, and authorization headers. All 83 client tests pass, the
    build succeeds, and CSS matches the baseline. `Admin.jsx` is now 431 lines;
    the new files pass lint and the two existing hook warnings remain.
76. Rushee Zoom loading: moved verification, role-claim checks, profile loading,
    and comment visibility settings into a zoom feature module. Tests cover
    request order, redirects that still continue loading, missing rushees,
    failed role/visibility reads, and profile request errors. All 87 client
    tests pass, the build succeeds, and CSS matches the baseline. The new files
    pass lint; the page retains its inherited lint errors and no new warnings.
77. Rushee Zoom comment creation: moved rating and warning state handlers plus
    submission into the zoom feature. Tests cover default ratings, live
    validation, warning-but-submit behavior, seen-only rating payloads,
    reload, errors, and form reset. All 91 client tests pass, the build succeeds,
    and CSS matches the baseline. The new files pass lint; inherited page lint
    errors are down to six.
78. Rushee Zoom overlays: extracted the comment and PIS modal markup into one
    focused component. Rendered HTML hashes captured from the original page
    match comment-only, PIS-only, and combined states. Handler tests cover both
    backdrops, close buttons, and inner click propagation. All 93 client tests
    pass, the build succeeds, and CSS matches the baseline. `RusheeZoom.jsx` is
    now 687 lines; ESLint currently ignores TSX components.
79. Rushee Zoom existing comments: moved live edit validation, edit submission,
    and delete submission into a focused module. Tests cover warning-but-submit
    behavior, exact edit/delete payloads, reload, server failures, and network
    cleanup. The edit network path intentionally still logs the page's `error`
    state, as the original closure did. All 97 client tests pass, the build
    succeeds, and CSS matches the baseline. `RusheeZoom.jsx` is now 572 lines;
    the new files pass lint and inherited page errors are down to five.
80. Rushee Zoom profile header: extracted normal and bid-committee identity,
    attendance badges, and private-field display into a focused component.
    Rendered HTML hashes captured from the original page match both modes;
    branch checks also retain their original call counts. All 99 client tests
    pass, the build succeeds, and CSS matches the baseline. `RusheeZoom.jsx`
    is now 510 lines; the new test passes lint.
81. Rushee Zoom ratings: extracted the ratings and interactions card without
    changing the visibility gate, rating formatting, or interaction props.
    Original rendered HTML hashes match both visible and hidden states, and
    the interaction data is forwarded in both. All 101 client tests pass, the
    build succeeds, and CSS matches the baseline. `RusheeZoom.jsx` is now
    475 lines; the new test passes lint.
82. Rushee Zoom PIS details: extracted the timeslot, interviewer names, and
    response cards into a focused component. Original rendered HTML hashes
    match populated and empty responses. Tests also cover date parsing and
    format arguments and the exact selected PIS object for each card. All 103
    client tests pass, the build succeeds, and CSS matches the baseline.
    `RusheeZoom.jsx` is now 435 lines; the new test passes lint.
83. Rushee Zoom existing-comment list: extracted the access-filtered list,
    edit field, warnings, and per-comment controls into a focused component.
    Original rendered HTML hashes match viewing, editing, and empty states;
    handler tests cover selection, edit/delete click propagation, validation
    order, warning dismissal, and edit submission. All 106 client tests pass,
    the build succeeds, and CSS matches the baseline. `RusheeZoom.jsx` is now
    353 lines; the new test passes lint.
84. Rushee Zoom new-comment form: extracted the add control, draft editor,
    warnings, rating sliders, and submit button. Original rendered HTML hashes
    match collapsed and expanded states; tests cover input validation order,
    warning dismissal, field-to-rating bindings, and submit callbacks. All 109
    client tests pass, the build succeeds, and CSS matches the baseline.
    `RusheeZoom.jsx` is now 319 lines; the new test passes lint.
85. Rushee Zoom comment cleanup: removed an unused, commented-out attendance
    card and redundant comments, while clarifying why comment visibility starts
    restricted. All 109 client tests pass, the build succeeds, and CSS matches
    the baseline. The generated JavaScript bundle is unchanged from slice 84;
    `RusheeZoom.jsx` is now 306 lines.
86. PIS autosave status: moved the status values and repeated status display
    into the PIS feature. Rendered HTML hashes captured from the original page
    match saving, saved, error, idle, and last-saved states. All 110 client
    tests pass, the build succeeds, and CSS matches the baseline. `PIS.jsx` is
    now 671 lines; the new JavaScript module and test pass lint.
87. PIS pending screen: extracted the questions-not-ready view while retaining
    its unlock-time and fixed-question branches. Original rendered HTML hashes
    match no unlock time, fixed questions, and no fixed questions; the test
    also checks the locale-time arguments. All 111 client tests pass, the build
    succeeds, and CSS matches the baseline. `PIS.jsx` is now 647 lines; the
    new test passes lint.
88. PIS profile header: extracted the photo, identity, attendance badges, and
    contact fields in their original order. Rendered HTML hashes captured from
    the page match attended and no-attendance states. All 112 client tests
    pass, the build succeeds, and CSS matches the baseline. `PIS.jsx` is now
    606 lines; the new test passes lint.
89. PIS collaborator identity: moved the tab-stable ID helper into the PIS
    feature. Tests cover backend ID precedence without storage access, reuse
    of an existing tab ID, and deterministic generation and storage under the
    original key. All 115 client tests pass, the build succeeds, and CSS
    matches the baseline. `PIS.jsx` is now 593 lines; new files pass lint.
90. PIS server dates: moved BSON extended-JSON and plain-date parsing into the
    PIS feature. Tests preserve numeric parsing, invalid plain-date nulls,
    falsy inputs, and the existing invalid-Date result for malformed BSON.
    All 118 client tests pass, the build succeeds, and CSS matches the baseline.
    `PIS.jsx` is now 583 lines; new files pass lint.
91. PIS dead voice UI: removed a commented-out transcription control and its
    unused imports. All 118 client tests pass, the build succeeds, and both
    CSS and the generated JavaScript bundle match slice 90 exactly. `PIS.jsx`
    is now 569 lines.
92. PIS brother fields: extracted assigned-brother display and four
    collaborative inputs. Original rendered HTML hashes match fully assigned,
    partially assigned, unassigned, and missing-signup states; tests check
    field keys, required flags, collaboration props, and update routes. All
    120 client tests pass, the build succeeds, and CSS matches the baseline.
    `PIS.jsx` is now 505 lines; the new test passes lint.
93. PIS question responses: extracted multiple-choice radios and collaborative
    text inputs. Original rendered HTML hashes match Yes, No, populated text,
    empty text, and no-question states; tests check radio change payloads and
    text input collaboration props and callback identity. All 122 client tests
    pass, the build succeeds, and CSS matches the baseline. `PIS.jsx` is now
    461 lines; the new test passes lint.
94. PIS collaboration state: moved document-snapshot merging and latest live
    update application into a focused module without changing effect triggers
    or setter order. Tests cover empty snapshots, truthy-name protection,
    answer merging, no-op object identity, live name clearing, unknown fields,
    and latest-only updates. All 128 client tests pass, the build succeeds, and
    CSS matches the baseline. `PIS.jsx` is now 402 lines; new files pass lint.
95. PIS autosave request: extracted the request payload and status transitions
    while retaining the page's debounce effect and callback dependencies.
    Tests cover missing-data guards, exact API payload, success timestamp and
    two-second reset, and error logging with the three-second reset. All 131
    client tests pass, the build succeeds, and CSS matches the baseline.
    `PIS.jsx` is now 367 lines; new files pass lint.
96. PIS collaborator identity: extracted Firebase, stored-profile, email, and
    anonymous fallback rules while keeping the page's initialization guard.
    Tests cover UID precedence, stored naming variants, email prefix, single
    display names, defaults, and invalid stored JSON propagation. All 136
    client tests pass, the build succeeds, and CSS matches the baseline.
    `PIS.jsx` is now 337 lines; new files pass lint.
97. PIS rushee response: extracted answer hydration and assigned-brother name
    initialization while preserving call order, logging, database-over-live
    answer precedence, the `none` sentinel, and the existing error route.
    Tests cover successful, missing-signup, error, and malformed-name paths.
    All 140 client tests pass, the build succeeds, and CSS matches the baseline.
    `PIS.jsx` is now 305 lines; new files pass lint.
98. PIS question responses: consolidated initial-load and unlock-poll handling
    while preserving server order, availability, date parsing, initial-load
    error navigation, and silent poll failures. All 143 client tests pass, the
    build succeeds, and CSS matches the baseline. `PIS.jsx` is now 297 lines;
    new files pass lint.
99. Admin Sorting columns: extracted card rendering, tags, lock states, and
    drop indicators into a focused component. Original rendered HTML hashes
    match empty, hovered, tagged, locked, and trailing-drop states. Tests also
    cover drag and drop handler arguments, propagation, midpoint insertion,
    and draggability. All 146 client tests pass, the build succeeds, and CSS
    matches the baseline. `AdminSorting.jsx` is now 701 lines; the new test
    passes lint.
100. Admin Sorting WebSocket messages: moved the event switch into a focused
    protocol module while retaining socket parsing, lifecycle, and reconnect
    behavior in the page. Tests cover viewer count, remote/self drag events,
    timestamp refreshes, drag denial, ghost and lock cleanup, card refreshes,
    and unknown events. All 153 client tests pass, the build succeeds, and CSS
    matches the baseline. `AdminSorting.jsx` is now 599 lines; new files pass
    lint.
101. Admin Sorting stale ghosts: moved the five-second sweep body into a
    focused helper while retaining its interval and cleanup lifecycle. Tests
    cover the strict 30-second threshold, no-op state identity, and removal
    order across ghost and lock maps. All 156 client tests pass, the build
    succeeds, and CSS matches the baseline. `AdminSorting.jsx` is now 578
    lines; new files pass lint.
102. Admin Sorting drops: extracted the optimistic card placement and move
    payload from the page while retaining the same state-updater timing. Tests
    cover same-column and cross-column drops, missing cards, append indices,
    and negative splice indices. All 161 client tests pass, the build succeeds,
    and CSS matches the baseline. `AdminSorting.jsx` is now 538 lines; new
    files pass lint.
103. Admin Sorting saved tags: extracted the board update after a successful
    notes save. The request, status transitions, and timers stay in the page.
    Tests cover matching, missing, and duplicate IDs, array identity, and tag
    references. All 163 client tests pass, the build succeeds, and CSS matches
    the baseline. `AdminSorting.jsx` is now 530 lines; new files pass lint.
104. Admin Sorting move queue: extracted serialized persistence and rollback
    while keeping the same queue refs, API path, WebSocket payload, and error
    message. Tests cover empty and busy queues, sequential saves, broadcast
    guards, and failed-save rollback. All 167 client tests pass, the build
    succeeds, and CSS matches the baseline. `AdminSorting.jsx` is now 517
    lines; new files pass lint.
105. Admin Sorting drag interactions: grouped lock checks, drag state updates,
    cursor throttling, and start/move/end broadcasts in a sorting helper while
    keeping the page's refs and render lifecycle. Tests cover lock denial and
    local restart, coordinate fallback, the strict 33 ms throttle, movement
    without an active drag, and silent cancellation. All 173 client tests pass,
    the build succeeds, and CSS matches the baseline. `AdminSorting.jsx` is
    now 463 lines; new files pass lint.
106. Admin Sorting viewport: moved zoom, wheel, and right-click pan handlers
    into a sorting interaction module while retaining the page's state, wheel
    listener lifecycle, and passive setting. Tests cover nested scrolling,
    ctrl/meta zoom bounds, wheel and mouse panning, ignored card clicks, and
    context-menu suppression. All 180 client tests pass, the build succeeds,
    and CSS matches the baseline. `AdminSorting.jsx` is now 406 lines; new
    files pass lint.
107. Admin Sorting notes: moved open, close, save, and edit debounce handlers
    into a focused module while keeping state and timer refs in the page. Tests
    cover request paths and payloads, success and failure states, timer
    cancellation, the 500/300 ms edit delays, and the 800 ms saved status.
    All 187 client tests pass, the build succeeds, and CSS matches the
    baseline. `AdminSorting.jsx` is now 353 lines; new files pass lint.
108. Admin Sorting loader: moved the existing claim/allowlist check, board
    request, row grouping, and loading cleanup into a focused loader while
    retaining the page's auth subscription and refresh callback. Tests cover
    absent and denied users, forced token refresh, admin and allowlisted
    access, successful grouping, and request/token failures. All 193 client
    tests pass, the build succeeds, and CSS matches the baseline.
    `AdminSorting.jsx` is now 336 lines; new files pass lint.
109. Rushee self-profile submission: extracted required-field checks, changed
    field payload construction, verification, update request, toasts, and
    redirect while retaining early-return timing and the same form handler.
    Tests cover every required field, unchanged edits, GTID changes, server
    errors, and network failures. All 200 client tests pass, the build succeeds,
    and CSS matches the baseline. `RusheePage.jsx` is now 505 lines; new
    files pass lint.
110. Rushee self-photo submission: extracted Storage upload, download URL,
    image field update, reload, and the existing separate error paths. Tests
    cover the timestamped path, payload and request order, failed updates,
    network errors, reload errors, and upload failures. All 205 client tests
    pass, the build succeeds, and CSS matches the baseline. `RusheePage.jsx`
    is now 450 lines; new files pass lint.
111. Rushee photo modal: extracted camera and preview markup into a focused
    component, preserving both pre-change rendered HTML hashes and the close,
    capture, retake, and save callbacks. Removed a commented-out button; its
    unused `hover:bg-blue-600` utility is the only generated CSS difference.
    All 207 client tests pass and the build succeeds. `RusheePage.jsx` is now
    378 lines; the new test passes lint.
112. Rushee self-profile form: moved fields, select options, phone formatting,
    and submit button into a focused component. The rendered form card matches
    its pre-extraction hash, and tests cover submit/field handlers plus partial
    and full phone formatting. All 210 client tests pass and the build succeeds.
    CSS has no new difference from the prior slice. `RusheePage.jsx` is now
    210 lines; the new test passes lint.
113. Bid Committee Sorting viewport: reused the tested sorting zoom, wheel,
    and right-click pan handlers without changing the page's wheel listener
    lifecycle or rendered JSX. All 210 client tests pass, the build succeeds,
    and CSS has no new difference. `BidComSorting.jsx` is now 479 lines.
114. Shared sorting notes naming: renamed the admin-specific notes handler
    module and its test to reflect its endpoint-agnostic behavior. Admin
    Sorting still uses the same implementation. All 210 client tests pass,
    and the production JavaScript and CSS output hashes match the prior slice.
115. Bid Committee Sorting notes: reused the shared open, close, save, and
    debounce handlers while retaining its `/bidcom` endpoint and page-owned
    state and timer refs. A new test covers bidcom fetch and save paths with
    tag updates. All 211 client tests pass, the build succeeds, and CSS has
    no new difference. `BidComSorting.jsx` is now 418 lines.
116. Bid Committee Sorting WebSocket messages: moved the viewer event switch
    into a focused protocol module. Tests cover counts, drag ghosts and
    timestamps, card refreshes, unknown messages, and the redacted viewer
    label. All 216 client tests pass, the build succeeds, and CSS has no new
    difference. `BidComSorting.jsx` is now 348 lines; new files pass lint.
117. Bid Committee Sorting stale ghosts: reused the 30-second cleanup helper
    with optional lock-state cleanup for viewer boards. Renamed its tests for
    both consumers and added a viewer case. All 217 client tests pass, the
    build succeeds, and CSS has no new difference. `BidComSorting.jsx` is now
    332 lines; changed JavaScript files pass lint.
118. Brother Sorting viewport: reused the tested sorting zoom, wheel, and
    right-click pan handlers while retaining the page's wheel listener and JSX.
    All 217 client tests pass, the build succeeds, and CSS has no new
    difference. `BrotherSorting.jsx` is now 393 lines.
119. Sorting viewer messages: generalized the bid committee event module and
    its test name for both viewer roles. Bid committee explicitly keeps name
    redaction; a new test verifies brothers retain names on start and current
    drag events. All 218 client tests pass, the build succeeds, and CSS has no
    new difference. Changed JavaScript files pass lint.
120. Brother Sorting WebSocket messages: reused the viewer event handler with
    rushee names enabled while retaining the page's socket parsing, join,
    reconnect, and cleanup lifecycle. All 218 client tests pass, the build
    succeeds, and CSS has no new difference. `BrotherSorting.jsx` is now 325
    lines.
121. Brother Sorting stale ghosts: reused the shared viewer cleanup helper
    with the same 30-second threshold and five-second interval. All 218 client
    tests pass, the build succeeds, and CSS has no new difference.
    `BrotherSorting.jsx` is now 309 lines.
122. Admin PIS auto-assignment: separated availability indexing and the
    load-balancing/conflict rules from database I/O. Four unit tests cover
    trimmed availability names and order, existing reservations, first/second
    slot selection, and partial assignments. The handler retains its response
    text, per-rushee update order, and assignment reservations after a failed
    write. All 35 server unit tests pass with macOS system-configuration access.
123. Voting controller: separated Redis-backed meeting state, ballot writes,
    and eligibility operations into modules of at most 124 lines. Corrected
    misspelled internal eligibility names and the ballot variable while keeping
    HTTP paths, payload fields, Redis keys/channels, and write/publish order.
    Two unit tests cover vote parsing and invalid-vote rejection before Redis;
    all 37 server unit tests pass.
124. Admin search: moved the brother and rushee search effects into a feature
    hook and their matching rules into pure helpers. Two tests preserve the
    ten-result cap, legacy name fields, email matching, nonblank whitespace,
    and case-sensitive GTID behavior after lowercasing the query. All 220
    client tests pass, the build succeeds, and the CSS hash matches the prior
    build. `Admin.jsx` is now 408 lines. Changed files have no ESLint errors;
    the page retains its two existing effect-dependency warnings.
125. PIS collaboration operations: moved text-operation and diff helpers from
    the React hook into the PIS feature while re-exporting their old hook paths.
    Four tests cover the compatibility exports, all operation types, generated
    metadata, and diff reconstruction. Removed an unused socket error argument.
    All 224 client tests pass, changed files pass ESLint, the build succeeds,
    and the CSS hash is unchanged. `useCollaboration.js` is now 348 lines.
126. PIS collaboration protocol: moved incoming text updates, acknowledgements,
    rejected-write rebasing, and document snapshot normalization into a focused
    module. Five tests cover legacy and stale versions, resend precedence,
    matching update IDs, and snapshot shapes. Socket listener order, emitted
    payloads, and update-history limits are retained. All 229 client tests pass,
    changed files pass ESLint, the build succeeds, and CSS is unchanged.
    `useCollaboration.js` is now 303 lines.
127. PIS collaboration presence: moved cursor/typing transformations, expiry,
    and active-cursor filtering into a feature module. Three tests pin timestamp
    fallback, blur behavior, map replacement, and strict three- and ten-second
    boundaries. The one-second cleanup interval and socket event payloads remain
    in the hook. All 232 client tests and 14 collaboration-server tests pass;
    changed files pass ESLint, the build succeeds, and CSS is unchanged.
    `useCollaboration.js` is now 256 lines.
128. Dashboard list behavior: moved shuffling and filter/search/sort rules into
    a feature helper, removing dead commented-out search code. Three tests pin
    exact GTID lookup after major/class filters, full-list fuzzy search, name
    sorting, and one random draw per shuffled item. All 235 client tests pass,
    the build succeeds, and CSS is unchanged. `Dashboard.jsx` is now 327 lines.
    ESLint has the same 10 errors and two warnings on this page as at the start
    of the slice; the new helper and tests pass lint.
129. Dashboard loading: moved the existing verification, Firestore availability
    check, rushee fetch, and error transitions into an injected helper. Five
    tests preserve success ordering, the missing-profile fallback, navigation
    after failed verification, and distinct response/network errors. All 240
    client tests pass, the build succeeds, and CSS is unchanged. `Dashboard.jsx`
    is now 274 lines; its 10 ESLint errors and two warnings are unchanged.
130. Auth user data: moved the stored-user shapes and Firebase error-code text
    out of `js/user.js` into auth feature helpers. Three tests preserve legacy
    and camel-case storage keys, login display-name splitting, account-name
    fallbacks, exact messages, and generic errors. The authentication and
    access-check call order is unchanged. All 243 client tests pass, changed
    files pass ESLint, the build succeeds, and CSS is unchanged. `user.js` is
    now 284 lines; live login and registration flows remain unverified.
131. Login access check: moved the access request and explicit-denial handling
    into a focused injected helper. Three tests pin claim/body/header shape,
    sign-out and toast ordering, and the existing fail-open behavior on request
    or sign-out errors. The API-key lookup remains inside the error boundary.
    All 246 client tests pass, changed files pass ESLint, the build succeeds,
    and CSS is unchanged. `user.js` is now 254 lines; live login remains
    unverified.
132. Maintenance Mongo configuration: added an offline-tested resolver for
    `MONGO_URI`/`MONGO_URL` and ignored local `.env` files. Removed the embedded
    URI and import-time connection from attendance, sorting-tag, and Closed
    Night report scripts while retaining their direct-command queries and
    output. Eight new tests cover configuration precedence, missing settings,
    import safety, and fake-collection behavior. All 36 maintenance tests and
    Python compilation pass; no live database command ran. Five other scripts
    still contain the credential and remain in the next slice.
133. Remaining maintenance credentials: replaced the embedded URI in the
    malformed-comment scan, rushee export, ratings repair, PIS spreadsheet,
    and Night 1 migration scripts with the shared resolver. The spreadsheet
    script now waits until its direct command to connect. A compatibility check
    found two distinct old targets, both different from the app's local MongoDB
    settings. Each affected script now resolves only its own URI key from the
    environment or ignored root `.env.migrations`; the local file retains the
    script-to-target mapping for this checkout. Tests cover refusal to use a
    generic app URI, the spreadsheet projection/export, and Night 1 updates.
    All 38 maintenance tests and Python compilation pass; no live database
    command ran. No migration Python file retains the embedded URI. The exposed
    credentials in Git history still require rotation outside this repository.
134. Pledge headshot command: extracted the per-file lookup, image conversion,
    upload, and database update from `main()` while preserving filename order,
    printed output, public URL behavior, and error handling. Two new offline
    tests pin the missing-rushee and image-failure paths. The refactored command
    matched the previous version's event order and output in four offline
    scenarios. All 40 maintenance tests and Python compilation pass; no live
    database or Firebase call ran.
135. Malformed-comment report: extracted per-rushee diagnostics from the scan
    loop without changing output or issue counts. Added coverage for missing,
    wrong-type, and non-object comments; three offline scenarios produced the
    same report text as the previous version. All 41 maintenance tests and
    Python compilation pass; no live database command ran.
136. PIS collaboration reconnect: added a local Socket.IO test that disconnects
    the sole editor, confirms the empty room remains available, then rejoins and
    continues from the retained document version. The server code is unchanged;
    all 15 collaboration tests pass against an isolated loopback server.
137. Navbar authentication: moved verification, token refresh, and role state
    updates into an injected navigation helper. Five tests pin update order,
    allowlist handling, missing users, failures, and the existing falsy admin
    value when email is absent. All 251 client tests and the production build
    pass; the rendered JSX text is unchanged. The helper and tests pass ESLint;
    `Navbar.jsx` still has three pre-existing lint findings.
138. Navbar menu: moved role and midterm navigation markup into a typed
    component, reducing `Navbar.jsx` from 288 to 113 lines. Six rendered menu
    variants match hashes captured from the original JSX, and an interaction
    test pins dropdown toggle order and logout before reload. The surrounding
    Navbar JSX is unchanged and the production CSS hash is identical. All 253
    client tests and the build pass. The parent retains two pre-existing
    `stripped` prop-validation lint findings.
139. Comment rating averages: moved the shared 1–5 filtering and ordered mean
    calculation out of create/delete handlers. Creation still writes zero when
    no value qualifies; deletion still removes an empty category. Two new unit
    tests cover duplicate categories, legacy/invalid values, and a new rating.
    All 39 server unit tests pass, and all 40 tests with the integration feature
    pass against a disposable MongoDB container, including comment creation and
    deletion. No production database was contacted.
140. Comment rating writes: extracted the sequential MongoDB updates from the
    comment-create handler into a focused module. A new unit test pins the
    existing `$set` and new-category `$push` filters and documents. The helper
    retains the original rushee snapshot and stops after the first failed write,
    preserving partial-write order and the handler's error response. `create.rs`
    is now 182 lines. All 40 server unit tests and 41 tests with the integration
    feature pass against a disposable MongoDB container.
141. Added a push and pull-request regression workflow for the passing client,
    collaboration, API, sorting, voting, and offline maintenance checks. The API
    and voting jobs use the existing isolated MongoDB and Redis harnesses. This
    only adds verification; it does not change application code or deployment.
    Its YAML structure and triggers parse locally. The same commands pass here:
    253 client, 15 collaboration, 9 sorting, 2 voting, 41 API, and 41 offline
    maintenance tests, plus the client build. The workflow has not yet run on
    GitHub. Client lint remains outside the workflow while its 330-error
    baseline is resolved in verified slices.
142. Removed unused bindings, unused component imports, and commented-out routes
    from `App.jsx`. Its 23 active route definitions remain identical, and the
    production CSS hash is unchanged. All 253 client tests, the production build,
    and targeted ESLint pass. Full client lint now reports 319 errors and 19
    warnings; browser flow and visual parity still need direct verification.
143. Extracted the duplicate read-only column rendering from the brother and bid
    committee sorting pages into `ViewerSortingColumn.tsx`. Baseline markup hashes
    for empty and populated columns still match for both roles, and click tests
    retain the original row passed to each page's handler. The pages are now 265
    and 289 lines, down from 309 and 333. All 255 client tests and the production
    build pass; the CSS hash is unchanged. Full lint is down to 315 errors and
    19 warnings, with the two pages now free of lint errors.
144. Centralized client real-time base URLs in `config/realtimeBaseUrls.js` with
    domain names for PIS collaboration, sorting, and voting. The three existing
    deployment keys, per-service fallbacks, and caller URL suffixes remain the
    same. Tests cover configured and missing values, including voting's lack of
    a fallback. All 257 client tests and the build pass; generated CSS is
    unchanged. Full lint now reports 314 errors and 19 warnings.
145. Moved root `setup.py` season-reset execution into `main()`, so importing it
    no longer deletes collections or contacts Firebase and HTTP services. Offline
    fakes verify that direct execution retains the date gate, reset sequence,
    image cleanup, seed file order, API endpoints, payloads, and auth headers.
    The direct command produces the same 23 fake-service events and output as
    the prior committed script. All 44 maintenance tests and Python compilation
    pass; no live reset ran. Root Python bytecode caches are now ignored.
146. Removed the tracked root and `server/` macOS `.DS_Store` metadata from Git
    and ignored future copies. The local files remain in place; no runtime or
    deployment file changes.
147. Extracted the three setup seed uploads into `scripts/season_setup/seeds.py`,
    reducing the root `setup.py` from 215 to 154 lines. The entrypoint and JSON
    file paths stay the same. Offline tests now cover HTTP, API, and network
    failures; both the successful and mixed-failure runs produce the same 23
    fake-service events and stdout as the previous commit. All 45 maintenance
    tests and Python compilation pass; no live setup ran.
148. Extracted the Firebase custom-token exchange into
    `scripts/season_setup/authentication.py`, reducing root `setup.py` from 154
    to 122 lines. Tests pin the missing-key and rejected-token branches, including
    their warning text and seed request headers. Success, missing-key, and
    token-rejection runs match the previous command's service events and stdout.
    All 47 maintenance tests and Python compilation pass; no live setup ran.
149. Moved the four collection deletions and Firebase profile-picture cleanup to
    `scripts/season_setup/reset.py`, reducing root `setup.py` from 122 to 85
    lines. The date gate, deletion order, Storage prefix, error handling, and seed
    continuation are unchanged. Success and Storage-failure traces and stdout
    match the previous command. All 48 maintenance tests and Python compilation
    pass; no live setup ran.
150. Added isolated MongoDB contract cases for brother PIS sign-up: first and
    second brother writes, duplicate rejection, a full slot, and a missing
    rushee. Exact response messages and persisted fields pass against the
    existing handler in the disposable API integration container. All 41 server
    tests with the integration feature pass; no production database was used.
151. Added the partial-slot database case before refactoring brother PIS sign-up.
    If the first brother's first name is set while the last name remains `none`,
    the existing handler fills the second slot and retains the partial first.
    All 41 server tests with the integration feature pass in the isolated
    container.
152. Moved brother PIS sign-up into its own module and replaced the nested
    branches with a slot decision and one sequential-write helper. The read-only
    brother PIS query remains unchanged. Both name updates remain separate and
    ordered, and the duplicate, partial-slot, full-slot, missing-rushee, and
    success responses retain their exact messages. A new unit test pins the
    untrimmed BSON updates for both slots. All 42 server tests with the
    integration feature pass against disposable MongoDB.
153. Added database contracts for moving a rushee within one sorting column and
    into a different column. They pin persisted order, status, author attribution,
    and clamping of a negative target index before changing the mutation handler.
    All 42 server tests pass against disposable MongoDB.
154. Moved the sorting move handler into `sorting/move_rushee.rs`, leaving the
    single-update and bulk-reorder handlers in an 83-line `mutations.rs`. One
    helper now performs each column's ordered writes, retaining a separate
    timestamp and update for every rushee, source-before-target write order,
    and the existing partial-write error response. The isolated database move
    scenarios and all 42 server tests pass after extraction.
155. Extracted the Firestore brother-directory query from `client/src/js/user.js`
    into `features/brothers/loadBrotherDirectory.js`. The voting dashboard's
    `getAllBrothers()` entrypoint remains the same. Two tests pin query order,
    returned fields, snapshot order, and the logged empty-list fallback. All
    259 client tests, the client build, and ESLint on changed files pass.
156. Moved the login flow into `features/auth/loginWithServices.js` while keeping
    the exported `login(credentials)` entrypoint. Tests cover fresh-token claim
    checks, access gating before storage, success notification, explicit denial,
    and the original sign-in error message and toast options. All 262 client
    tests, the client build, and ESLint on changed files pass.
157. Moved account creation into `features/auth/createAccountWithServices.js`
    while retaining the exported `createAccount(credentials)` entrypoint.
    Tests pin allowlist rejection before Firebase writes, profile and Firestore
    write order before local storage, blank-name behavior, and the original
    error handling after a failed write. All 266 client tests, the client build,
    and ESLint on changed files pass.
158. Added a real sorting WebSocket reconnect contract before changing session
    code. It covers active-drag hydration, disconnect release and viewer counts,
    then proves a reconnected admin can reacquire the same card with the existing
    `drag_start` event. All 10 sorting WebSocket tests pass on the original
    session implementation.
159. Extracted sorting socket drag hydration and disconnect release into
    `session/drag_lifecycle.rs`, reducing `session.rs` from 126 to 93 lines.
    Hydration still precedes message handling; disconnect drag-end events still
    precede client removal and the updated viewer count. All 10 sorting
    WebSocket tests pass after extraction.
160. Moved registration basic-info validation and verification into
    `features/registration/createBasicInfoSubmit.js`, retaining the page's form
    markup and its field-update order. Four tests pin the GTID/email/phone
    verification call, success progression, server rejection, exception warning,
    and the existing empty-field early return that leaves loading set. Removed
    unused imports and a discarded catch binding. All 270 client tests, the
    client build, and changed-file ESLint pass.
161. Moved registration image upload and final PIS submission into
    `features/registration/createPisSubmit.js`, retaining the page's JSX and
    class names. Five tests pin the GTID Storage path, upload-before-API order,
    exact signup payload, response navigation, request failure handling, and
    the existing loading and missing-slot edge cases. All 275 client tests,
    the client build, and changed-file ESLint pass.
162. Moved the PIS page's initial identity and data load into
    `features/pis/loadPisPageData.js`. Four tests pin collaborator hydration,
    rushee-before-questions request order, failure navigation, and the existing
    false-verification path that continues its requests after navigating.
    Removed two unused imports. All 279 client tests and the build pass;
    changed-file ESLint has no errors and retains two hook-dependency warnings.
163. Moved the PIS question reveal timer into
    `features/pis/startPisRevealPolling.js`. Two tests pin the immediate check,
    rounded reveal threshold, one-second retry cadence, failed-response handling,
    and interval cleanup. The page retains the same effect guard and dependencies.
    All 281 client tests and the build pass; the two existing hook warnings remain.
164. Moved PIS answer-change handlers into
    `features/pis/createPisAnswerHandlers.js`. Two tests pin local answer merging,
    voice-only sends for text responses, immediate multiple-choice sends, and
    offline behavior. The page keeps the same child callbacks and rendered JSX.
    All 283 client tests and the build pass; the two hook warnings remain.
165. Added baseline render contracts for collaborative input and textarea in
    offline and locked states. Their current markup hashes are pinned before
    sharing cursor-selection logic; randomized cursor colors are normalized in
    the assertion. All 287 client tests pass on the original components.
166. Shared cursor selection in
    `features/collaboration/activeCursorsForField.js`. It preserves the active
    cursor API precedence, legacy fallback filter, unlimited input overlays,
    and three-cursor textarea cap. Two focused tests and all four baseline
    markup hashes pass; all 289 client tests and the build pass. The lint
    baseline falls from 309 to 301 errors with 19 warnings.
167. Pinned the registration basic-information form's full rendered markup,
    including labels, fields, and option order, before extracting its phone
    formatting and static option lists. All 290 client tests pass on the
    original form.
168. Moved registration phone formatting into
    `features/registration/formatPhoneInput.js`, retaining the input's on-change
    mutation and exact full, partial, and overlength behavior. Two tests cover
    edge cases and event wiring; the original full-form markup hash remains
    unchanged. All 292 client tests and the build pass. Removing three unused
    React imports reduces the lint baseline to 298 errors and 19 warnings.
169. Moved the 33 major choices and 20 exposure choices into
    `features/registration/basicInfoOptions.js`, reducing the basic-information
    form to 192 lines. The option order, implicit values, full rendered markup
    hash, and form callback remain unchanged. All 292 client tests and the build
    pass; lint on the new data module and updated tests passes.
170. Added an isolated database contract for PIS auto-assignment: missing
    availability, partial assignment, completing that slot on a second run,
    skipping a filled slot, and clearing both names. The fixture reset now
    clears availability submissions between scenarios. All 42 server tests with
    the integration feature pass in the disposable MongoDB harness.
171. Moved PIS assignment persistence into its own module, leaving the handler
    to coordinate availability, planning, and response counts. The same dotted
    MongoDB fields, trimmed names, GTID filter, and write-success condition are
    preserved. All 42 server tests with the integration feature pass.
172. Moved the assignment planner's four existing unit tests into its own test
    module without changing their assertions. The production planner is now
    151 lines. All 41 server unit tests pass.
173. Added an isolated database contract for PIS availability form activation,
    brother submission and replacement, clearing and resending, and
    deactivation. The fixture reset now also clears the form-status collection.
    All 42 server tests with the integration feature pass.
174. Split the availability controller into form lifecycle and submission
    modules while retaining the same public handlers, route wiring, database
    operations, and response payloads. The former 227-line controller is now
    an 8-line export module; the two implementation files are 158 and 69 lines.
    All 42 server tests with the integration feature pass.
175. Added an isolated PIS timeslot database contract for create, repeated add,
    delete, and list responses. It pins the existing string-versus-BSON-date
    filter behavior: a repeated add reports success without changing capacity,
    and delete reports a missing timeslot. All 42 server tests with the
    integration feature pass.
176. Flattened the PIS timeslot controller's nested matches into direct
    success and error branches, reducing it from 199 to 143 lines. The legacy
    filter types, count arithmetic, response text, and write-result behavior
    remain unchanged; all 42 server tests with the integration feature pass.
177. Added direct registration verification contracts for nine-digit GTIDs,
    validation order and messages, network bypass for existing registrations,
    duplicate lookup, unexpected server replies, and request failure. All 295
    client tests pass; the new test file passes ESLint.
178. Moved registration GTID and basic-info verification unchanged into
    `features/registration/registrationVerification.js`; the existing
    `js/verifications.js` imports still resolve through re-exports. A
    whitespace-normalized comparison confirms the moved function bodies are
    identical. All 295 client tests and the production build pass; changed files
    pass ESLint.
179. Cleaned the extracted registration verifier's spacing, identifier style,
    and redundant comments while preserving validation order, request path,
    console calls, and exact response text. All 295 client tests and changed-file
    ESLint pass; the production JS and CSS asset hashes match the preceding
    build.
180. Added direct Firebase session verification contracts for absent users,
    refreshed role claims and access request shape, stored voting-compatible
    names, denied-access sign-out and toast, and fail-open token/request errors.
    All 299 client tests pass; the new test file passes ESLint.
181. Moved Firebase session verification unchanged into `features/auth/verifyUser.js`.
    `js/verifications.js` now keeps the existing imports stable through two
    re-exports. A whitespace-normalized comparison confirms the moved function
    body is identical. All 299 client tests and the production build pass;
    changed files pass ESLint.
182. Cleaned the moved session verifier's spacing and comments while retaining
    the original Firebase callback order, access-check fail-open path, toast,
    and legacy storage keys. All 299 client tests and changed-file ESLint pass;
    the production JS and CSS asset hashes match the preceding build.
183. Pointed registration and attendance GTID/basic-info imports directly at
    the registration feature. All 299 client tests and the production build
    pass with unchanged JS and CSS asset hashes. The touched files' pre-existing
    ESLint counts remain 15 errors and one warning, with no new findings.
184. Pointed the 14 Firebase verification callers directly at the auth feature.
    All 299 client tests and the production build pass; the touched files'
    ESLint totals remain 59 errors and 13 warnings, with no new findings. No
    client source file imports the old verification facade now.
185. Removed the unused `js/verifications.js` facade after confirming no
    tracked references remain. All 299 client tests pass, and the production
    JS and CSS asset hashes match the preceding build.
186. Added a real Socket.IO contract for legacy text replacement, deletion,
    unknown operation types, retained operation history, and version-zero
    snapshots. All 16 collaborative WebSocket tests pass with loopback access.
187. Moved the collaborative server's legacy text-application switch into
    `src/operations.js`, leaving the event handler to manage room state and
    broadcasts. The original submitted operation still determines stored text;
    all 16 collaborative WebSocket tests pass.
188. Shared rushee/question Redis event encoding between the voting service's
    admin and voter listeners. A new unit test pins the string payload and wire
    event names; both unit tests and all three tests in the disposable Redis/
    real WebSocket harness pass.
189. Added a separately tested brother PIS slot loader before wiring it into
    the page. Four tests pin verification/fetch ordering, per-slot Map updates,
    chronological grouping, empty data, and error routing. All 303 client tests
    pass; the new helper and tests pass ESLint.
190. Wired the brother PIS page to the tested loader, reducing the page from
    239 to 178 lines without changing its JSX or effect dependencies. All 303
    client tests pass; the production JS and CSS asset hashes match the previous
    build. The page's existing ESLint count remains four errors and one warning.
191. Added a tested brother PIS submission helper before wiring it into the
    page. Four tests pin no-selection behavior, the GTID URL and lowercase-name
    payload, success alert/reload order, server-error toast options, and network
    failure logging. All 307 client tests pass; the new files pass ESLint.
192. Wired the brother PIS page to the tested submission helper, reducing it
    from 178 to 134 lines. All 307 client tests pass; the production JS and CSS
    asset hashes match the preceding build. The page's ESLint errors fall from
    four to two, with its existing effect-dependency warning unchanged.
193. Removed two unused brother PIS page bindings and made its build-time API
    prefix module-scoped. The page now passes ESLint without changing its effect
    dependencies or rendered JSX. All 307 client tests pass; production JS and
    CSS asset hashes match the preceding build. A fresh repository-wide ESLint
    scan reports 294 errors and 18 warnings.
194. Split the blocking brother availability modal into a 125-line stateful
    container, a 146-line view, and tested timeslot helpers. Tests pin payload
    sort mutation, ISO selection, local date grouping, five exact markup states,
    and the four view actions. All 312 client tests pass and the production
    build succeeds; CSS retains its preceding asset hash. The production JS
    bundle changes because the module boundary changed. Live browser parity is
    still unverified.
195. Moved brother availability name resolution and submission into a tested
    helper, retaining zero-slot submissions, fallback names, request shape,
    callback order, and failure messages. Added fetch-effect tests for success,
    non-success, and transport failure; the modal is now a 102-line typed
    container. All 320 client tests pass, its five markup fixtures still match,
    and the production JS and CSS asset hashes match the preceding build after
    the container rename. Repository-wide ESLint now reports 281 errors and 17
    warnings. Live authenticated flow testing remains pending.
196. Extracted the dashboard rushee card into an 84-line view, reducing the page
    from 274 to 221 lines. Six dashboard markup fixtures pin loading, error,
    empty, normal-card, midterm, and blocking-availability states; a callback
    test pins the profile URL and midterm click gate. All 322 client tests pass,
    the production build succeeds, and the CSS asset hash is unchanged. The
    JavaScript bundle changes because the card is now a separate module.
197. Moved dashboard search, major/class filters, sort selection, and shuffle
    control into a 96-line view, reducing `Dashboard.jsx` from 221 to 162 lines.
    The existing six page markup fixtures still match; a new interaction test
    pins option order, deduplication, all filter callbacks, and shuffle. All
    323 client tests pass, the production build succeeds, and the CSS asset
    hash remains unchanged.
198. Moved rushee vote payloads and vote choices from the 209-line rushee model
    into the previously empty voting model module, keeping the existing
    `models::rushee` exports for callers. A new JSON contract pins incoming and
    stored vote keys and values. All 42 API unit tests pass, and all 43 tests
    with the integration feature pass against disposable MongoDB. The new
    module passes rustfmt checks.
199. Moved the self-service, dashboard-list, and night-interaction view models
    into `models/rushee/views.rs`, reducing `rushee.rs` to 126 lines while
    preserving its public exports. A new serialization test pins the list
    response's null timeslot and interaction fields alongside the existing
    self-service privacy contract. All 43 API unit tests and all 44 tests with
    disposable MongoDB pass; the new module passes rustfmt checks.
200. Flattened `post_comment` from 182 to 89 lines with early returns and a
    shared response constructor. The night-serialization gate and rating-before-
    comment write order remain in place. New isolated database assertions pin
    the no-night and missing-rushee messages; existing duplicate, rating, edit,
    and deletion scenarios still pass. All 43 API unit tests and all 44 tests
    with disposable MongoDB pass. API test-build warnings fall from 42 to 35.
201. Renamed the voting service's shared event encoder module from `pubsub` to
    `protocol` and reused one vote-log encoder for initial admin snapshots and
    live vote updates. A unit test pins valid JSON values, malformed-entry
    filtering, empty tallies, and exact event text. All four voting tests pass
    with disposable Redis and real admin/voter WebSockets; rustfmt is clean.
202. Moved bid committee dashboard filtering into a tested feature helper,
    reducing the page from 334 to 299 lines without changing its effect or
    render markup. Three tests pin exact nine-digit GTID matching, major/class
    selection, input identity, and first/last/registration sorting. All 326
    client tests pass, the production build succeeds, and the CSS asset hash
    remains unchanged. Full browser parity remains unverified.
203. Extracted the bid committee's numbered rushee card into a 61-line view,
    reducing its dashboard page from 299 to 263 lines. Four page markup
    fixtures pin loading, error, empty, and populated states; a callback test
    pins the exact profile URL and missing-number fallback. All 328 client
    tests pass, the production build succeeds, and the CSS asset hash remains
    unchanged. The JavaScript bundle changes with the new module boundary.
204. Moved the bid committee GTID search and filter panel into a 100-line view,
    reducing its dashboard page from 263 to 200 lines. Existing page markup
    fixtures still match; a new test pins the nine-character input rule,
    deduplicated major/class options, sort choices, and all five callbacks. All
    329 client tests pass, the production build succeeds, and the CSS asset
    hash remains unchanged.
205. Removed the bid committee page's never-called canvas placeholder builder,
    unused imports, and unused error-title setter binding. The page is now 175
    lines; its four markup fixtures and all 329 client tests still pass, and
    the production build succeeds. CSS is unchanged; the JavaScript hash moves
    with the removed dead code. Repository-wide ESLint is now 276 errors and
    17 warnings.
206. Added admin-page loading, ready, and availability-editor markup fixtures
    and section-prop checks, then moved the exports/access grid into a 61-line
    view. `Admin.jsx` falls from 408 to 365 lines without moving state or
    changing effect dependencies. All 331 client tests pass, the production
    build succeeds, and the CSS asset hash remains unchanged. Live browser
    parity is still pending.
207. Moved the admin question, scheduling, and PIS rescheduling cards into a
    77-line management view while keeping their state and actions in the page.
    Added rescheduling prop assertions alongside the existing three-state page
    markup fixtures. `Admin.jsx` is now 324 lines; all 331 client tests and
    the production build pass, and the CSS asset hash remains unchanged.
208. Added admin sorting-page fixtures for loading, ready, dragging, and notes
    states before extracting its board into a 116-line view. The page retains
    its WebSocket, drag, notes, viewport, and data state, and falls from 335 to
    261 lines. Board ref, pointer-handler, and child-prop checks pass alongside
    all 333 client tests. The production build succeeds with unchanged CSS;
    authenticated browser parity remains pending.
209. Extracted the collaboration textarea's DOM and remote-cursor rendering
    into a 97-line view, reducing the stateful component from 259 to 194 lines.
    Its existing offline/locked markup fixtures still match, and a new test
    covers handler forwarding, caret positions, and stable cursor colors.
    All 334 client tests and the production build pass with unchanged CSS.
    Repository-wide lint debt is now 274 errors and 17 warnings.
210. Extracted the single-line collaboration input's markup into a 53-line
    view, reducing its stateful component from 198 to 176 lines. Existing
    offline/locked fixtures and new handler, ref, and lock-label assertions
    pass; its 300 ms send delay remains in the component. All 335 client tests
    and the production build pass with unchanged CSS. Lint debt is now 273
    errors and 17 warnings.
211. Consolidated the input and textarea remote-update effects into a tested
    44-line helper. Both components retain their effect dependencies and
    distinct 500/650 ms defer windows and `onChange` payloads. Five helper
    cases cover stale, matching, immediate, deferred, and cancelled updates;
    two wiring tests pin the per-field contracts. The components are now 157
    and 175 lines. All 342 client tests and the production build pass with
    unchanged CSS; lint debt remains 273 errors and 17 warnings.
212. Moved the PIS collaboration hook's text update, acknowledgement, and
    rejection listeners into a 43-line registration module. Fake-socket tests
    cover listener order, bounded remote history, rebased resend, matching
    acknowledgement, and server-value fallback; a hook-level test confirms
    registration and cleanup order. The hook falls from 257 to 236 lines.
    All 346 client tests and the production build pass with unchanged CSS;
    lint debt remains 273 errors and 17 warnings.
213. Extracted the collaboration hook's room join, disconnect retry, and
    connection-error listeners into a 35-line module without changing listener
    order. Fake-socket tests pin join identity and the 3-second retry gate;
    the hook-level registration check still passes. The hook is now 223 lines.
    All 349 client tests and the production build pass with unchanged CSS;
    lint debt remains 273 errors and 17 warnings.
214. Moved the collaboration hook's `text-operation` listener into its text
    event module before the existing update/ack/reject listeners. A fake-socket
    test pins self filtering, duplicate identity, and the 50-operation bound.
    The hook is now 205 lines; all 350 client tests and the production build
    pass with unchanged CSS. Lint debt remains 273 errors and 17 warnings.
215. Extracted cursor-position, typing-indicator, and document-state listeners
    into a 32-line field-event module. Fake-socket tests pin self-echo filtering,
    remote presence updates, and snapshot value/version assignment; the
    hook-level listener-order check still passes. The hook is now 194 lines.
    All 352 client tests and the production build pass with unchanged CSS;
    lint debt remains 273 errors and 17 warnings.
216. Moved available PIS timeslot sorting from the scheduling controller into
    a tested helper, reducing `scheduling.rs` from 193 to 181 lines. The two
    new tests pin the existing extended-JSON timestamp parsing, zero fallback,
    and stable ordering for equal times. All 45 API unit tests and all 46 tests
    with the integration feature pass against disposable MongoDB. The new
    module passes rustfmt; repository-wide `cargo fmt --check` still reports
    formatting debt in unrelated files.
217. Moved single-rushee comment inspection and diagnostic output from the
    maintenance scanner into a 45-line library module. The command falls from
    124 to 82 lines while retaining the same import-time behavior, issue
    counts, wording, and line breaks. A new exact-output test passed before
    and after extraction; all 49 offline maintenance tests pass. No live scan
    or migration was run.
218. Extracted drag ownership and start/move/end handling from the sorting
    WebSocket dispatcher into a dedicated module. The dispatcher falls from
    156 to 69 lines; message types, broadcasts, authorization, and deployment
    names remain unchanged. All 10 sorting WebSocket tests pass, including
    live loopback and reconnect coverage; the package passes rustfmt.
219. Shared the sorting viewer WebSocket connection lifecycle between brother
    and bid committee boards. Their join role, viewer-name fallbacks, message
    handling, error/close behavior, three-second reconnect, and existing effect
    cleanup remain unchanged; each board keeps its original name-visibility
    setting. Four focused tests cover opening, messages, reconnects, errors,
    and join-name fallbacks. All 356 client tests and the production build pass
    with unchanged CSS. Targeted lint has no errors and four existing warnings
    in the two page files.
220. Grouped all seven admin voting endpoints in a focused route module without
    changing their paths, methods, OPTIONS handlers, router state, or placement
    inside the admin auth layer. A route test pinned method/path and missing-token
    rejection before and after extraction. All 46 API unit tests and 47 tests
    with the integration feature pass against disposable MongoDB; the touched
    Rust files pass rustfmt.
221. Extracted the PIS questions card from the page into a typed feature view,
    reducing `PIS.jsx` from 256 to 212 lines while leaving collaboration and
    autosave effects in place. Pre-extraction markup hashes match in loading,
    pending, connected, and offline states; child-prop assertions cover answers,
    brother fields, collaboration, and save status. All 358 client tests and the
    production build pass with unchanged CSS. Touched-file ESLint reports no
    errors in its configured files and two existing hook warnings in `PIS.jsx`;
    the existing ESLint configuration does not cover TSX files.
222. Moved the brother PIS appointment page's in-place sorting, display-time
    formatting, and relative-time labels into a 37-line feature module, reducing
    `MyPISPage.jsx` from 226 to 195 lines. Three tests pin missing timestamps,
    stable ordering, and completed/soon/hour/day thresholds with a fixed clock.
    Removed three unrelated existing lint errors in the touched page without
    changing its state or rendered text. All 361 client tests and the production
    build pass with unchanged CSS; touched-file lint has no errors and one
    existing effect-dependency warning.
223. Extracted the brother PIS appointment card into a 93-line typed feature
    view, reducing `MyPISPage.jsx` from 195 to 124 lines. Pre-extraction markup
    hashes match in error, loading, empty, and populated states; a second test
    pins the card's row, time label, attendance badge, and profile navigation.
    All 363 client tests and the production build pass with unchanged CSS.
    Touched-file lint has no errors and the page's existing effect-dependency
    warning remains; the current lint configuration does not cover TSX files.
224. Moved create-account form validation and submit/key handling into a focused
    auth action module, reducing `CreateAccount.jsx` from 203 to 146 lines.
    Eight tests pin the original first-error order, exact toast messages and
    options, submitted payload, loading transitions, success navigation, and
    Enter-key behavior. The page retains its refs and unchanged JSX. All 371
    client tests and the production build pass with unchanged CSS; touched-file
    ESLint passes without errors or warnings.
225. Shared sorting WebSocket connection, parse/error, join, and reconnect
    handling behind fixed admin and viewer role adapters. The admin board falls
    from 261 to 233 lines; its drag-message dispatch, lock/ghost reset, and
    effect cleanup remain in the same order. Two new admin socket tests pin
    join identity, messages, reconnect, and failures; all four viewer socket
    tests and the admin markup tests still pass. All 373 client tests and the
    production build pass with unchanged CSS. Touched-file lint has no errors
    and three existing hook warnings in the admin page.
226. Extracted the rushee self-profile summary into a 62-line typed feature
    view, reducing `RusheePage.jsx` from 210 to 169 lines. Pre-extraction markup
    hashes match for loading, ready, and photo-modal states; a second test pins
    the fetched profile, attendance badge, and edit-button modal action. All 375
    client tests and the production build pass with unchanged CSS. Configured
    touched-file ESLint passes without warnings; TSX remains outside the
    existing ESLint configuration.
227. Separated admin CSV export actions from generic admin request handling,
    reducing `dataActionHandlers.js` from 174 to 42 lines and placing the four
    export flows in a 140-line feature module. The existing action API and
    request/export characterization tests retain endpoint, payload, CSV,
    success, and failure contracts. All 375 client tests and the production
    build pass with unchanged CSS; touched-file ESLint passes cleanly.
228. Separated PIS brother-assignment actions from availability form lifecycle
    handling, reducing `availabilityFormActions.js` from 166 to 109 lines and
    placing the two assignment flows in a 71-line module. An added test pins
    cancellation before any network or loading change; the existing tests still
    cover request order, messages, failures, and state updates. All 376 client
    tests and the production build pass with unchanged CSS; touched-file ESLint
    passes cleanly.
229. Extracted the rushee zoom page's comment summary and form/list layout into
    a 58-line typed feature view, reducing `RusheeZoom.jsx` from 306 to 264
    lines while retaining page-owned visibility policy and actions. Pre-change
    markup hashes match for loading, admin, copied-link, and restricted views;
    child-prop checks pin comment visibility and action wiring. Removed three
    unused-binding lint errors in the touched page without changing its state
    calls or rendered text. All 378 client tests and the production build pass
    with unchanged CSS; configured touched-file ESLint passes cleanly.
230. Moved sorting-column reads and per-rushee order writes into a focused
    module, reducing the move handler from 170 to 127 lines. Lock acquisition,
    read/write sequence, timestamps, partial-write behavior, and error responses
    are unchanged. Isolated rustfmt passes; all 46 API unit tests and 47
    disposable-Mongo integration-feature tests pass, including same-column and
    cross-column moves.
231. Separated the public rushee self-view endpoint and its query-param test
    from general rushee queries, reducing `queries.rs` from 185 to 133 lines.
    The route export, access-code check, response body, and privacy projection
    remain unchanged. Isolated rustfmt and all 47 disposable-Mongo
    integration-feature tests pass, including the self-service access-code and
    privacy contracts.
232. Added disposable-Mongo contracts for Rush App access settings: empty
    defaults, admin override, bid committee and regular-member gates, midterm
    status, update attribution, and replacement of the single settings document.
    The isolated fixture reset now clears this collection. All 47
    integration-feature tests pass; no application behavior changed.
233. Split the admin access controller into policy and settings modules while
    retaining its four public exports, status payloads, and database operation
    order. Replaced redundant branch comments with the admin-override invariant
    and the delete-before-insert tradeoff. The preceding access contracts and
    all 47 disposable-Mongo integration-feature tests pass; isolated rustfmt
    passes.
234. Extracted Add PIS Timeslot submission into a focused action module,
    reducing the page from 212 to 200 lines without changing its JSX or CSS.
    Four tests pin missing-time validation, ISO payload and update order,
    resolved error payload behavior, rejected requests, and the success timer.
    All 382 client tests and the production build pass; built CSS is byte-for-byte
    unchanged and touched-file ESLint passes. Removing an unused React import
    reduced repository-wide lint debt to 262 errors and 20 warnings.
235. Moved the Add PIS Timeslot form into a typed view, reducing the page from
    200 to 66 lines while preserving its loading branch, element structure,
    class tokens, and event wiring. Two tests compare empty, selected, and
    submitting markup against pre-extraction hashes (normalizing whitespace
    within class attributes) and check input conversion and submit state. All
    384 client tests and the production build pass; generated CSS remains
    byte-for-byte unchanged and configured touched-file ESLint passes.
236. Moved the Socket.IO legacy text-operation transform test out of room
    cleanup tests and added direct insert, delete, replace, missing-value, and
    unknown-type contracts. All 18 collaboration tests pass against the real
    loopback server; no production code changed.
237. Renamed the Socket.IO pure text-operation module, event handler, and
    direct test file to `legacyTextOperations` so they no longer share an
    ambiguous `operations` basename. The `text-operation` wire event, room
    state changes, service entrypoint, and deployment path are unchanged. All
    18 collaboration tests pass against the real loopback server.
238. Extended the voting WebSocket integration contract with admin and voter
    ping handling. Each connection currently emits two Pong frames per Ping;
    the test records that existing behavior before any session refactor. All
    four voting WebSocket tests pass against disposable Redis.
239. Shared the admin and voter WebSocket receive loop for close, ping/pong,
    ignored data frames, and errors while preserving each role's log messages.
    Snapshot-before-registration order and live broadcast tasks remain in the
    original session modules. All four voting WebSocket tests pass with
    disposable Redis, including both roles' existing two-Pong behavior;
    isolated rustfmt passes.
240. Moved the three season seed JSON files into `data/season_seed/` and kept
    their original root paths as links, preserving setup and migration inputs.
    SHA-256 hashes and parsed JSON match before and after the move; all 49
    offline maintenance tests pass. No reset or migration command was run.
241. Added a fixed-map contract for all 29 pledge headshot filename-to-GTID
    assignments before reorganizing that script. It checks the complete
    mapping without initializing Firebase or MongoDB. All 50 offline
    maintenance tests pass.
242. Moved the pledge headshot identity map and image preparation into
    `scripts-migrations/lib/`, reducing the command from 142 to 103 lines.
    The fixed map, EXIF/RGB/resize/JPEG order, upload path, public URL, MongoDB
    update, and printed results remain unchanged. All 50 offline maintenance
    tests pass, including import safety and failed-image paths; no live
    services or headshot files were accessed.
243. Shared input and textarea prop-to-local synchronization in one collaboration
    helper. The remote-operation guard, pending-local echo rule, empty-value
    normalization, last-sent reference, and each component's effect dependencies
    remain unchanged. Three new tests pin those rules; existing markup and
    remote-wiring contracts pass. All 387 client tests and the production build
    pass, and generated CSS remains byte-identical.
244. Removed unused default `React` imports from 27 JSX modules under the
    automatic JSX runtime, preserving every named hook import. The production
    JS and CSS are both byte-identical to the preceding build, all 387 client
    tests pass, and client lint errors fall from 262 to 235 with 20 warnings.
245. Renamed the badge component to match its file and removed its unused state
    hook. Seven baseline tests pin markup for all five special night colors,
    unknown text, and missing text; all 394 client tests pass after the change.
    The production build succeeds, generated CSS is unchanged, and client lint
    reports 231 errors and 20 warnings.
246. Moved PIS signup's selection markup into a typed feature view, reducing the
    stateful page from 255 to 75 lines. Its fetch effect, per-slot `setDays`
    updates, Monday reveal state, callback wiring, and five loading/error/slot
    markup states retain their baseline contracts. Eight new tests cover these
    paths. All 402 client tests and the production build pass, generated CSS is
    unchanged, and client lint reports 222 errors and 20 warnings.
247. Extracted the PIS day card and its slot styling into a 91-line component;
    the surrounding signup view is now 149 lines. Added selected-Sunday and
    unselected-Monday markup cases before simplifying the nested class choice.
    All 404 client tests and the production build pass, generated CSS is
    unchanged, and lint remains at 222 errors and 20 warnings.
248. Added a real sorting WebSocket contract for malformed incoming text:
    parsing failure leaves the socket open for a subsequent admin `card_saved`
    message. All 11 sorting tests pass against an isolated loopback server, and
    rustfmt passes. No production protocol code changed in this slice.
249. Moved rushee PIS rescheduling out of the timeslot-read module into
    `interview/reschedule.rs`, reducing `scheduling.rs` from 181 to 96 lines.
    Its executable statements are unchanged, while comments now explain the
    rollback and paired database fields; the public export and route remain the
    same. The isolated-database API suite passed all 47 tests both before and
    after the move, including failed-claim rollback and successful rescheduling.
    All touched Rust files pass isolated rustfmt checks.
250. Shared the Socket.IO joined-room guard across text updates, legacy text
    operations, presence, and explicit document-state requests. Missing joins
    and deleted rooms still stop each handler before emitting or mutating room
    state; disconnect keeps its separate cleanup path. A new test pins these
    guards, and all 19 Socket.IO tests pass against the real loopback server.
251. Compared the current client with baseline `5250f4b` in the in-app browser
    using separate local preview builds and placeholder environment settings.
    At 1280×720, settled initial views of `/`, `/login`, `/forgot-password`,
    `/register`, `/create-account`, and `/error/Test/Message` had matching
    accessibility content and byte-identical PNG captures. These checks did
    not submit forms, authenticate, or use a live backend.
252. Renamed the routed `404.jsx` module to `NotFound.jsx` and updated its three
    imports, including the admin and brother voting views. The controlled
    production JS and CSS are byte-identical before and after the rename; all
    404 client tests pass, and lint remains at 222 errors and 20 warnings.
253. Removed the unreferenced `OldHome.jsx` prototype. The controlled
    production JS is byte-identical after deletion. Tailwind drops 14 selectors
    whose class tokens have no remaining source references; no reachable page
    or route imports the component. All 404 client tests pass, and client lint
    falls to 215 errors with 20 warnings.
254. Scoped the React unknown-property lint rule for `NotFound.jsx` to ignore
    six React Three Fiber props forwarded to Three.js. Other unknown DOM props
    remain checked. Client lint falls to 209 errors and 20 warnings; runtime
    code and build output are unchanged.
255. Moved the PIS signup view and day card from `features/register/pis` into
    the established `features/registration/pis` area and updated their imports
    and test loader paths. All 404 client tests pass; controlled production JS
    and CSS are byte-identical, with lint unchanged at 209 errors and 20 warnings.
256. Extracted the identical board canvas, presence indicator, ghost cards,
    zoom controls, and columns from the brother and bid-committee sorting pages
    into `ViewerSortingBoardView`. Each page retains its own authorization,
    requests, notes panel, and WebSocket lifecycle. New tests compare loading,
    ready, and details markup against pre-extraction hashes for both pages and
    check board control props and pointer handlers. All 406 client tests pass,
    controlled production CSS is byte-identical, and lint remains at 209
    errors and 20 warnings. The pages shrink from 234/259 to 194/219 lines.
257. Moved the registration basic-information form into
    `features/registration/BasicInfoForm.tsx`, added its ref and callback types,
    renamed the vague `func` prop to `onContinue`, and removed row-label
    comments that repeated the fields. The markup hash, phone formatting, and
    continue callback test pass. All 406 client tests pass, controlled CSS is
    byte-identical, and production JS differs only in the two `func` to
    `onContinue` prop names. Lint falls to 197 errors and 20 warnings.
258. Moved the registration camera step to
    `features/registration/photo/PhotoCaptureStep.tsx`, removed redundant view
    comments, and renamed its `func` prop to `onContinue`. New tests pin camera
    and preview markup, the 1280-pixel mirrored JPEG capture sequence, and
    retake/continue callbacks. All 409 client tests pass. Controlled CSS is
    byte-identical; production JS differs only in the two renamed prop uses.
    Lint falls to 190 errors and 20 warnings.
259. Moved the registration completion screen to
    `features/registration/RegistrationSuccessView.tsx` and named its personal
    link prop `accessCode`. New tests pin ready/copied markup, clipboard URL,
    and the two-second copied-state reset. All 411 client tests pass.
    Controlled CSS is byte-identical; production JS differs only in the two
    `link` to `accessCode` prop names. Lint falls to 186 errors and 20 warnings.
260. Moved the PIS signup controller beside its view and day card as
    `features/registration/pis/PisSignUpStep.tsx`, typed its slot and callback
    contract, and named the final action `onContinue`. Removed the unreferenced,
    empty `InfoVerification` component, leaving the legacy `RegisterComponents`
    directory empty. Existing PIS tests still verify seven markup states,
    selection callbacks, the endpoint, day grouping, and state-update order.
    All 411 client tests pass; controlled CSS is byte-identical and production
    JS differs only in the two renamed prop uses. Lint falls to 181 errors and
    20 warnings.
261. Extracted registration step rendering from `Register.jsx` into
    `RegistrationStageView.tsx`. The view makes basic-info, photo, PIS, and
    waiting branches explicit while retaining the original per-step wrapper
    depth; the full-screen success branch remains in the page. New page tests
    pin all five markup states and photo/PIS prop wiring. All 413 client tests
    pass, controlled production CSS is byte-identical, and lint remains at 181
    errors and 20 warnings. `Register.jsx` shrinks from 185 to 174 lines.
262. Moved the single-line collaborative input controller beside its view and
    protocol helpers in `features/collaboration`, with a typed session contract
    for connection state and field messages. Its 300 ms local debounce, 500 ms
    remote deferral, cursor lock, and PIS field wiring remain under existing
    regression tests. All 413 client tests pass, controlled CSS is byte-identical,
    and the configured JS/JSX lint count falls to 159 errors and 20 warnings.
263. Moved the multiline collaborative controller beside the input, views, and
    protocol helpers in `features/collaboration`, using the shared session
    contract. Existing tests retain markup, 650 ms remote deferral, and PIS
    question wiring; new tests cover latest-value local debounce at 450 ms,
    composition-end send, and locked-field focus/mouse behavior. All 415 client
    tests pass and controlled CSS is byte-identical. The configured JS/JSX lint
    count falls to 131 errors and 19 warnings, but TSX is not yet linted or
    typechecked; this count does not prove the moved controller is lint-clean.
264. Moved interview-question category grouping and one-per-bucket random draw
    into `controllers/rushee/interview/selection.rs`. The handler still draws
    only inside the reveal window, persists the same assigned-question field,
    and sorts the same response. Injected-RNG tests cover bucket insertion
    order, fixed-question exclusion, empty buckets, and one selection per
    category. All 48 API unit tests and 49 guarded database integration tests
    pass. The changed Rust files pass rustfmt; repository-wide formatting still
    reports pre-existing differences in unrelated files.
265. Moved brother PIS signup slot eligibility and exact duplicate/full error
    messages into `controllers/admin/brother_pis/slot_selection.rs`. The handler
    keeps its lookup, two sequential field writes, response status, and success
    messages. Four new tests pin first-slot priority, partial first-slot
    behavior, duplicate rejection, and full-slot text. All 52 API unit tests
    and 53 guarded database integration tests pass; changed Rust files pass
    rustfmt.
266. Replaced `unknown` collaboration props in the PIS brother fields and
    question responses with their existing editor session contract. This is a
    type-only change: all 415 client tests pass and controlled production JS
    and CSS are byte-identical. A read-only TypeScript 5.8 audit with Vite
    client types now reports four TSX errors, down from nine; the project still
    lacks a checked-in typecheck command.
267. Resolved the four remaining TSX audit errors by typing PIS slot selection,
    sharing the night interaction result shape across its callers, and making
    the legacy string-valued GTID input limit an explicit typecheck exception.
    The existing component test confirms that the string prop is preserved.
    All 415 client tests pass, the TypeScript 5.8 audit passes, and controlled
    production JS and CSS are byte-identical to the preceding build.
268. Added pinned TypeScript 5.8.2, a client `typecheck` command, and a CI step
    using the same TSX settings as the passing audit. All 415 client tests and
    the checked-in typecheck pass after a clean `npm ci`. Against the prior
    commit built with the same clean dependencies, controlled production JS
    and CSS are byte-identical. The workflow's first GitHub run is still
    unverified.
269. Removed four unused state pairs from the routed Add PIS page while
    retaining its request-result setter. A new page test pins rendered markup
    against the prior commit and exercises the exact request URL, payload, and
    category trimming. All 416 client tests and typecheck pass; the edited page
    and test pass lint. Controlled CSS is byte-identical, and the configured
    JS/JSX lint baseline falls to 122 errors and 19 warnings.
270. Moved PIS's initial-load autosave delay and debounced timer cleanup into
    `features/pis/usePisAutosave.js`, retaining the existing refs, save helper,
    API payload, and save timing. The page falls from 212 to 176 lines. A new
    hook test covers initial-load suppression, the one-second activation,
    two-second debounce, and cleanup; existing page markup fixtures and all
    417 client tests pass. Typecheck passes, the new hook is lint-clean, and
    controlled CSS is byte-identical. The JS bundle changes with the module
    extraction; the workflow's first GitHub run remains unverified.
271. Added a pinned TypeScript-aware ESLint parser and scoped React/unused-name
    rules to all 69 TSX components. The previously invisible typed-code baseline
    is 31 errors and 7 warnings; JS/JSX remains at 122 errors and 19 warnings.
    Lint is still tracked debt and is not a CI gate until findings are resolved.
272. Escaped JSX quote and apostrophe text in six typed components. All 417
    client tests and typecheck pass, and controlled production JS and CSS are
    byte-identical to the preceding build, so rendered text is unchanged.
    TSX lint falls to 22 errors and 7 warnings; repository-wide client lint
    now reports 144 errors and 26 warnings.
273. Removed an unused collaboration textarea ref and an unused typing-user
    filter. Existing local-input, composition, cursor-lock, and remote-update
    tests pass with the full 417-test client suite. Typecheck passes, controlled
    CSS is byte-identical, and lint falls to 142 errors and 26 warnings.
274. Added direct admin vote-summary tests for rendered counts, abstain
    treatment, empty state, and the existing clear-votes API request. Removed
    its two unused bindings without changing the pie-chart prop contract.
    All 419 client tests and typecheck pass; the edited component and test are
    lint-clean, the summary markup hash matches the pre-edit output, and
    controlled CSS is byte-identical. Client lint falls to 140 errors and
    26 warnings.
275. Moved admin voting dashboard status indicators and panels into
    `AdminVotingDashboardView.tsx`; auth and WebSocket lifecycles stay in the
    page. The page falls from 228 to 182 lines. A new test pins loading,
    unauthorized, and all three connection-status markup hashes and checks
    the vote-summary props. All 420 client tests and typecheck pass, the view
    is lint-clean, and controlled CSS is byte-identical.
276. Moved admin voting socket connection, update dispatch, reconnect backoff,
    and cleanup into `useAdminVotingSocket.ts`, leaving the refs and auth flow
    in the page. The page falls to 106 lines. Three new tests cover the exact
    admin socket URL, authorization gate, vote/rushee/question payloads,
    malformed JSON, reconnect delays, the 30-second cap, and cleanup. All
    423 client tests and typecheck pass; controlled CSS is byte-identical.
277. Removed unused admin voting dashboard imports, context values, and logging
    closures after the view and socket extractions. The page is 96 lines and
    passes TSX lint. Its authorization/status markup hashes, all 423 client
    tests, and typecheck pass; controlled CSS is byte-identical. Client lint
    falls to 133 errors and 26 warnings.
278. Extended TypeScript-aware lint from TSX to the five plain TypeScript
    files. Added stable ref and state-setter dependencies to the admin voting
    socket hook so those files have zero lint findings without changing when
    React recreates the callback. All 423 client tests and typecheck pass;
    controlled CSS is byte-identical. The full client lint baseline remains
    133 errors and 26 warnings.
279. Extended the guarded voting WebSocket integration case: malformed text
    and binary frames must be ignored for both admin and voter sockets, and
    their subsequent Pong and Redis updates still arrive. A shared bounded
    frame reader removes duplicate test waits. All four voting tests pass
    against a disposable Redis instance; changed files pass rustfmt. A
    separate Tokio integration test would need fresh shared Redis connection
    state between test runtimes, so this coverage stays in the existing case.
280. Extracted comment-deletion rating recalculation into a pure helper while
    retaining the handler's MongoDB updates and response paths. Two unit tests
    cover same-day removal, category deduplication, valid averages, and removal
    when only legacy zero ratings remain. The isolated database suite passes
    with 55 tests; changed Rust files pass rustfmt.
281. Simplified the comment text-edit handler's serialization and database
    result handling. The database contract now also checks that an acknowledged
    update with no matching comment still reports success and changes nothing,
    preserving the existing response behavior. All 55 isolated API tests pass.
282. Extracted the admin voting preview's name search and display fallbacks
    into a typed helper, preserving untrimmed query matching and legacy name
    fields. Two tests cover filtering and labels; the card no longer has unused
    imports, context setters, or catch bindings. All 425 client tests,
    typecheck, and the production build pass. Changed files pass ESLint, and
    the full lint baseline falls to 129 errors and 26 warnings.
283. Extracted the voter page's WebSocket lifecycle into
    `useBrotherVotingSocket`, alongside the existing admin socket hook. Three
    tests pin voter URL, messages, malformed frames, reconnect timing, error
    handling, and cleanup; a pre-extraction markup hash test pins empty,
    midterm, and connection-status layouts. The page falls from 234 to 169
    lines. All 429 client tests, typecheck, and the production build pass;
    changed files pass ESLint. The generated CSS asset hash is unchanged, and
    full client lint falls to 127 errors and 26 warnings.
284. Consolidated admin and voter voting sockets behind one typed feature hook.
    Their page-facing hooks now supply only role and authorization; the shared
    lifecycle retains the original event parsing, backoff, error close, and
    cleanup. A shared test harness exercises both wrappers through the same
    implementation. All 429 client tests, typecheck, and the production build
    pass; changed files pass ESLint, the CSS asset hash remains unchanged, and
    full client lint stays at 127 errors and 26 warnings.
285. Removed an import-path leak from the maintenance test module and gave the
    data-export and rating-repair tests a scoped script path, matching direct
    Python command execution. The full 50-test maintenance suite passes, and
    all 13 test files now pass when run independently in fresh processes.
286. Moved the PIS-question replacement implementation into
    `scripts-migrations/maintenance_commands/` while retaining its original
    script entrypoint. The entrypoint passes its path and fresh dependencies,
    so import-only execution remains inert and relative `.env`/JSON paths stay
    unchanged. A before/after offline comparison matches all 12 database/file
    events and all 633 output characters. The focused tests and full 50-test
    maintenance suite pass without contacting MongoDB.
287. Moved test-data cleanup's preview and deletion sequence into the same
    maintenance command package. The original entrypoint still owns URI
    selection and the `--apply` flag, with dry run as its default. Fake-client
    comparisons match the original dry-run 6 events, apply 10 events, output,
    and exits. The focused tests and full 50-test maintenance suite pass.
288. Moved the season rushee delete/reset/report sequence into the maintenance
    command package. The original entrypoint retains its 29-GTID keep set and
    configuration gate. A new test covers missing kept rushees and absent
    sample data. Offline before/after comparisons match database events, output,
    and exits for normal, missing-URI, and missing-rushee cases. All 51
    maintenance tests pass without contacting MongoDB.
289. Simplified the comment-deletion handler from 134 to 66 lines. Its pure
    deletion plan now also builds the original positional `$set` and category
    `$pull` documents, each pinned by a unit test. The isolated database case
    checks missing-rushee and acknowledged no-match deletion responses before
    the normal delete. All 57 server tests with the integration feature pass;
    changed Rust files pass rustfmt. The comment pull still precedes every
    rating write, retaining the prior partial-write order.
290. Flattened rushee list, detail, and existence query handling while keeping
    the list's privacy projection, registration-order numbering, response text,
    and legacy error-field spelling. The isolated profile contract now checks
    private fields stay absent and both missing-ID responses. All 57 server
    tests with the integration feature pass; changed Rust files pass rustfmt.
291. Moved registration's stored rushee/PIS signup construction into a pure
    mapper, reducing the handler from 136 to 65 lines. GTID validation, slot
    reservation, code generation, insertion, and their response contracts keep
    their original order. A unit test pins the shared PIS fields and defaults;
    the isolated database contract checks the persisted code, signup, and
    initial values. All 58 server tests with the integration feature pass;
    changed Rust files pass rustfmt.
292. Split the 152-line admin export module into number, personal-info, and PIS
    schedule handlers under `exports/`. The original cursor error policies,
    response fields, and PIS timeslot sort remain unchanged. A new isolated
    database scenario checks two-record numbering, the personal-info field set,
    and sorted PIS assignment output before and after the split. All 58 server
    tests with the integration feature pass; changed Rust files pass rustfmt.
293. Split the 158-line PIS availability form module into lifecycle writes and
    read handlers. Kept submission clearing before status replacement, ignored
    status deletion errors, and every response unchanged. The existing isolated
    database scenario covers missing, active, resent, and inactive form states;
    all 58 server tests with the integration feature pass and changed Rust files
    pass rustfmt.
294. Moved the Rushee Zoom PIS navigation and copy-link card into a focused
    component, keeping its condition, labels, classes, and callbacks intact.
    Existing rendered-markup fixtures match for loading, admin, copied-link,
    and restricted states. All 429 client tests, typecheck, production build,
    and changed-file ESLint pass.
295. Typed the attendance confirmation profile and callbacks in a TSX component
    and removed its unused import and descriptive comments. A rendered-markup
    fixture matches the original JSX output, and the production bundle hash is
    unchanged. All 430 client tests, typecheck, build, and changed-file ESLint
    pass; full client lint drops from 127 to 113 errors with 26 warnings.
296. Typed the self-profile form's fields and event callbacks without changing
    its controls, submission handler, or phone formatting. Existing exact-markup
    and event tests pass; all 430 client tests, typecheck, and build pass. The
    production bundle hash stays unchanged and full client lint drops from 113
    to 101 errors with 26 warnings.
297. Typed the interaction-summary view's precomputed and fallback inputs while
    keeping its fetch gate and memo dependencies. A new test pins regular,
    compact, and empty rendered output against the original JSX. All 431 client
    tests, typecheck, and build pass, with the same production bundle hash;
    full client lint drops from 101 to 92 errors with 26 warnings.
298. Typed the badge's optional label and spaced out its color branches without
    changing any class strings or fallbacks. All seven existing markup cases,
    the 431-test client suite, typecheck, and production build pass. The bundle
    hash stays unchanged and full client lint drops from 92 to 86 errors with
    26 warnings.
299. Moved the More and Admin dropdown link trees into focused navigation
    components, reducing `NavbarMenu.tsx` from 213 to 149 lines. Role gates,
    destinations, target attributes, and button toggle order stay in the parent
    contract. Six exact-markup scenarios and the click-order test pass, along
    with all 431 client tests, typecheck, build, and changed-file ESLint.
300. Colocated admin availability-editor state and action wiring in a focused
    hook while preserving state-call order. `Admin.jsx` drops from 324 to 315
    lines; its JSX section is byte-identical. The original editor action tests,
    admin markup scenarios, all 431 client tests, typecheck, build, and
    changed-file ESLint pass with the two prior page warnings.
301. Colocated admin app-access, midterm, and comment-visibility state with
    their toggle actions. `Admin.jsx` drops from 315 to 300 lines and keeps its
    JSX section byte-identical. Existing toggle-action and markup tests, all
    431 client tests, typecheck, build, and changed-file ESLint pass with the
    same two page warnings.
302. Moved the admin bootstrap effect beside its existing loader service,
    preserving its loading gate, dependency list, authorization inputs, and
    setter order. `Admin.jsx` drops from 300 to 282 lines with byte-identical
    JSX. A focused effect-wiring test and existing page fixtures pass; all 432
    client tests, typecheck, build, and changed-file ESLint pass with the same
    two dependency warnings across the page and hook.
303. Moved the attendance CLI's lookup, duplicate gate, and full-array update
    into the maintenance command package while keeping its path, arguments,
    importable function, connection setup, messages, and exit codes. The core
    statement AST matches the original; new offline tests cover missing night,
    missing rushee, and failed update. All 52 maintenance tests pass without a
    database connection.
304. Moved the sorting-tag CLI's rushee lookup, duplicate gate, and full-array
    update into the maintenance package. The original command still validates
    its fixed tag set before connection, and retains its importable function,
    messages, and exit codes. The core statement AST matches the original;
    new offline tests cover missing rushee and failed update. All 53
    maintenance tests pass without a database connection.
305. Moved Closed Night report formatting into the maintenance package while
    keeping its read-only entrypoint and output intact. The report statement
    AST matches the original. New offline tests cover import safety, exact
    projection, first-match counting, sorted status output, and the empty case;
    all 56 maintenance tests pass without a database connection.
306. Scoped maintenance-test import paths instead of modifying `sys.path` for
    the whole test process. All 56 offline tests pass together, and all 14 test
    files also pass in independent Python processes, confirming they do not
    depend on collection order or another file's import-path changes.
307. Moved admin question and scheduling inputs into a management hook, keeping
    its one-time question fetch after bootstrap. `Admin.jsx` drops from 282 to
    255 lines. A hook test pins initial values and fetch registration; the
    existing admin markup and question-action tests pass. All 433 client tests,
    typecheck, build, and changed-file ESLint pass, with the preexisting fetch
    dependency warning now located in the hook.
308. Separated the admin page's rendered layout into a typed view receiving the
    same editor, export/access, management, and availability props. `Admin.jsx`
    drops from 255 to 216 lines. Existing loading, ready, and editor markup
    hashes match; all 433 client tests, typecheck, build, and changed-file
    ESLint pass.
309. Colocated brother-promotion selection and role status with its existing
    actions. A hook test pins all four state defaults and action dependencies;
    the original promotion actions and admin markup fixtures pass. `Admin.jsx`
    drops from 216 to 211 lines; all 434 client tests, typecheck, build, and
    changed-file ESLint pass.
310. Colocated PIS availability-form lifecycle state with its existing actions,
    keeping state-call order and exposing only display props to the admin view.
    `Admin.jsx` drops from 211 to 190 lines. A new hook test, the existing
    action tests, and exact admin markup fixtures pass; all 435 client tests,
    typecheck, build, and changed-file ESLint pass.
311. Separated the loaded Rushee Zoom layout from its fetch and comment actions
    in a typed feature view. `RusheeZoom.jsx` drops from 257 to 225 lines;
    loading, admin, copied-link, and restricted markup hashes match the prior
    page. All 435 client tests, typecheck, build, and changed-file ESLint pass.
312. Colocated Rushee Zoom access defaults, visibility derivation, and fetch
    effect in a focused hook without changing state-call order or the loader
    gate. `RusheeZoom.jsx` drops from 225 to 200 lines. A new hook test pins
    restricted defaults and fetch wiring; all 436 client tests, exact page
    markup fixtures, typecheck, build, and changed-file ESLint pass.
313. Typed the shared rating slider's props without changing its JSX or
    handlers. New tests pin enabled/restricted markup and callback values;
    the production bundle hash matches the prior build. All 438 client tests,
    typecheck, build, and changed-file ESLint pass. Full client lint drops
    from 86 errors to 81 errors, with 26 warnings unchanged.
314. Typed the shared comment-warning renderer and reused its warning shape in
    both comment forms. Empty, icon-type, and dismissible markup hashes match
    the prior component, and dismissal keeps original indices. All 440 client
    tests, typecheck, build, and changed-file ESLint pass; the production bundle
    hash is unchanged. Full client lint falls to 77 errors and 26 warnings.
315. Typed the shared Navbar's stripped-mode prop. New fixtures pin its loading,
    signed-out, ready, stripped, and midterm markup; existing auth and menu
    tests pass. All 441 client tests, typecheck, build, and changed-file ESLint
    pass; the production bundle hash is unchanged. Full client lint falls to
    75 errors and 26 warnings.
316. Typed the shared error page's accepted props while preserving its route
    parameter display rule, including the currently ignored title/description
    props. New tests pin fallback, route, 404, and navigation behavior. All 443
    client tests, typecheck, build, and changed-file ESLint pass; the production
    bundle hash is unchanged. Full client lint falls to 73 errors and 26 warnings.
317. Moved the voting banner's reset effect above its missing-user return so
    every render calls hooks in the same order. The effect still resets the same
    state on question changes; signed-out, regular, voted, and midterm markup
    hashes match the prior component, and the vote payload/path are pinned.
    All 446 client tests, typecheck, build, and changed-file ESLint pass. Full
    client lint falls to 70 errors and 26 warnings.
318. Separated the voting banner's regular and midterm layouts into a typed
    view, leaving the vote request and state in the 111-line controller. The
    five existing markup hashes and vote payload test pass against the real
    view; all 446 client tests, typecheck, build, and changed-file ESLint pass.
    Full client lint remains at 70 errors and 26 warnings.
319. Separated Dashboard's loading, error, availability, filters, and cards
    into a typed view. The page is 131 lines, with state and effect order
    preserved; existing markup, card navigation, and filter tests now load the
    real view. All 446 client tests, typecheck, and build pass. Changed-file
    ESLint has no errors and two pre-existing dependency warnings; full lint
    falls to 61 errors and 26 warnings.
320. Removed unused 404 page inputs and expressed its apostrophe as JSX text
    without changing rendered markup. New tests pin the overlay hash, canvas
    settings, and Go Back destination. All 448 client tests, typecheck, build,
    and changed-file ESLint pass; full lint falls to 57 errors and 26 warnings.
321. Added a real sorting WebSocket test for unjoined and non-admin drag/save
    messages. Neither role can emit those events or claim the card; an admin
    can then start a drag, notify a save, and release it on disconnect. No
    runtime code changed. All 12 sorting tests pass with local loopback access,
    and `cargo fmt --check` passes.
322. Separated the brother comments page's loading, error, empty, and entry
    layouts into a typed view; its fetch effect remains in the 54-line page.
    New tests pin all four prior markup hashes, the missing-identity gate,
    encoded brother request and API-key header, and profile navigation. All
    452 client tests, typecheck, build, and changed-file ESLint pass; full lint
    falls to 54 errors and 26 warnings.
323. Typed the rushee self-service photo modal's camera ref, preview image,
    and four action callbacks without changing its JSX. Existing camera,
    preview, action, and page markup tests pass; all 452 client tests,
    typecheck, build, and changed-file ESLint pass. The production bundle hash
    is unchanged, and full lint falls to 47 errors and 26 warnings.
324. Separated Bid Committee Dashboard's status, filters, and numbered-card
    layout into a typed view. The 143-line page retains fetch/filter state and
    hook order; existing markup, missing-number, URL, and filter tests load
    the real view. All 452 client tests, typecheck, and build pass. Changed-file
    ESLint has no errors and two pre-existing dependency warnings; full lint
    falls to 43 errors and 26 warnings.
325. Typed the attendance splash and success screens, removed redundant JSX
    comments, and preserved the splash button's legacy disabled value. New
    tests pin five prior markup states plus GTID, registration, submit, and
    Back actions. All 455 client tests, typecheck, build, and changed-file
    ESLint pass; full lint falls to 37 errors and 26 warnings.
326. Cleaned the Home page's JSX text and redundant presentation comments.
    New tests pin regular and midterm markup plus registration/login routes.
    All 457 client tests, typecheck, build, and changed-file ESLint pass; full
    lint falls to 34 errors and 26 warnings.
327. Typed the password-reset email ref and Enter handler, removed redundant
    presentation comments, and cleaned JSX text. New tests pin form, sending,
    and sent markup, request/state order, empty-email gate, Enter submission,
    Try Again, and sign-in route. All 461 client tests, typecheck, build, and
    changed-file ESLint pass; full lint falls to 31 errors and 26 warnings.
328. Typed the midterm-mode provider and exposed named exports through the
    existing TSX test loader. New tests pin its initial value, child content,
    status URL, manual and mount refresh, and false fallback for missing data
    or request failure. All 463 client tests, typecheck, build, and changed-file
    ESLint pass; full lint falls to 30 errors and 26 warnings.
329. Removed an unused admin-question context value and replaced misleading
    comments with the existing request-order rationale. New tests pin question
    posting before vote clearing, unchanged-question behavior, and Cancel state.
    All 465 client tests, typecheck, build, and changed-file ESLint pass; full
    lint falls to 29 errors and 26 warnings. Generated CSS is unchanged.
330. Extracted the bid-committee sorting board's claim/allowlist gate and data
    fetch into a 44-line loader, reducing the page from 219 to 198 lines. New
    tests cover missing users, denied access, admin/bidcom/allowlist access,
    grouped rows, request failures, and token failures. Existing viewer-page
    markup tests still pass. All 469 client tests, typecheck, build, and
    changed-file ESLint pass; full lint remains 29 errors and 26 warnings.
    Generated CSS is unchanged.
331. Extracted the brother sorting board's existing current-user gate and
    fetch into a 29-line loader, reducing the page from 194 to 184 lines. New
    tests pin login redirect, the brother endpoint, grouped rows, errors, and
    loading completion; existing viewer-page markup tests still pass. All 472
    client tests, typecheck, build, and changed-file ESLint pass; full lint
    remains 29 errors and 26 warnings. Generated CSS is unchanged.
332. Added an isolated MongoDB contract for admin PIS-question add, list,
    category update/clear, missing-match response, and deletion. It verifies
    the question type in the update selector and distinguishes a stored BSON
    null from a cleared field. The disposable-container integration run passes
    all 58 server tests; rustfmt passes for the changed files.
333. Simplified admin PIS-question insertion and flattened list cursor handling
    under that database contract, preserving response bodies and category-clear
    semantics. The isolated MongoDB suite passes all 58 server tests, and
    rustfmt and whitespace checks pass for the changed handler.
334. Extracted full-text update payload validation and value normalization from
    the collaboration Socket.IO handler into a pure parser. New tests pin valid
    payloads, ignored incomplete updates, the empty-string fallback, and types
    the legacy protocol still accepts. All 22 collaboration tests pass,
    including live room and reconnect protocol checks.
335. Separated the PIS interview dashboard's loading, error, and card layout
    into a typed view, reducing its fetch page from 162 to 83 lines. New tests
    pin four pre-extraction markup hashes and card navigation. All 474 client
    tests, typecheck, build, and changed-file ESLint pass; full lint falls to
    27 errors and 26 warnings. The production JS and CSS asset hashes match
    the preceding build exactly.
336. Extracted the PIS dashboard's verification, fetch, and error handling into
    a 46-line loader, reducing the page to 53 lines. New page-effect tests pin
    the request after a false verification result, success state order, and
    status, network, and verification errors. All 476 client tests, typecheck,
    build, and changed-file ESLint pass; full lint remains 27 errors and 26
    warnings. Production JS and CSS asset hashes remain unchanged.
337. Typed the routed login page's input refs and Enter handler, removed an
    unused verification result and redundant JSX comments. New tests pin the
    loading/form markup, credentials, navigation, Enter submission, and
    verification transitions. All 479 client tests, typecheck, build, and
    changed-file ESLint pass; full lint falls to 26 errors and 26 warnings.
    Generated CSS is unchanged.
338. Cleaned the currently unrouted Face Attendance page's unused bindings and
    commented-out preview, retaining the TensorFlow module load and legacy
    state slots. New tests pin camera, preview, loading, and completed markup;
    capture, retake, lookup, warnings, and model-failure navigation. All 483
    client tests, typecheck, build, and changed-file ESLint pass; full lint
    falls to 23 errors and 26 warnings. Production JS and CSS asset hashes
    match the preceding build exactly.
339. Typed the unused but retained Button component while preserving its
    default label, variant/size fallbacks, class strings, and later prop
    overrides. New tests pin those behaviors. All 486 client tests, typecheck,
    build, and changed-file ESLint pass; full lint falls to 19 errors and 26
    warnings. Production JS and CSS asset hashes remain unchanged.
340. Typed the retained voice transcription wrapper, removed its unused
    question-key binding and redundant comments, and preserved its legacy prop
    contract. New tests pin enabled/disabled markup, whitespace-aware answer
    appending, and disabled forwarding. All 489 client tests, typecheck, build,
    and changed-file ESLint pass; full lint falls to 14 errors and 26 warnings.
    Production JS and CSS asset hashes remain unchanged.
341. Typed the retained voice recorder's callback and disabled props and
    removed redundant comments without changing its recording flow. New tests
    pin five markup states, start/stop/transcribe order, disabled behavior, and
    error display. All 492 client tests, typecheck, build, and changed-file
    ESLint pass; full lint falls to 12 errors and 26 warnings. Production JS
    and CSS asset hashes remain unchanged.
342. Removed a pass-through catch from the retained voice recording hook and
    corrected its WebM upload comment. New isolated browser-API tests pin
    microphone options, track cleanup, transcription request fields, processing
    state, and microphone-failure error mapping. All 495 client tests,
    typecheck, build, and changed-file ESLint pass; full lint falls to 11
    errors and 26 warnings. Production JS and CSS hashes remain unchanged.
343. Cleaned the admin voting context's empty docblock and unused loading
    binding while retaining its five state slots and final loading update.
    New tests pin initial context fields, the brother fetch transition, and
    use outside the provider. All 497 client tests, typecheck, build, and
    changed-file ESLint pass; full lint falls to 10 errors and 26 warnings.
    The production CSS hash is unchanged; the JavaScript bundle changed.
344. Named the registration camera's existing test stub so React lint can
    identify it. All 497 client tests pass and full lint falls to 9 errors
    and 26 warnings; production source and assets are unchanged.
345. Characterized the routed Attendance page's four display branches,
    lookup and check-in state transitions, request paths, and error toasts.
    Consolidated four identical toast configurations and removed an unused
    registration-verification import. All 501 client tests, typecheck, and
    build pass; full lint falls to 8 errors and 26 warnings. CSS is unchanged.
    The remaining errors are calls to four undefined setters in Attendance's
    existing fetch effect. They remain intact because defining them would
    change that path's current failure behavior.
346. Moved the voice recording React hook from generic `js/` to
    `hooks/useVoiceRecording.js`, updating its component and test imports.
    All 501 client tests, typecheck, changed-file ESLint, and build pass.
    Production JavaScript and CSS asset hashes match slice 345 exactly.
347. Moved the shared comment-rating formatter from generic `js/` to
    `features/comments/ratingDisplay.js`, updating five production imports and
    their test loaders. All 501 client tests, typecheck, changed-file ESLint,
    and build pass. Production JavaScript and CSS hashes match slice 346;
    the two pre-existing comment-effect dependency warnings remain.
348. Moved the pure comment visibility policy into `features/comments/`,
    updating its hook, voting, zoom, and test imports. All 501 client tests,
    typecheck, changed-file ESLint, and build pass. Production JavaScript and
    CSS hashes match slice 347 exactly; the existing voting-comment effect
    dependency warning remains.
349. Moved the Firestore brother-directory adapter out of the mixed account
    module into `features/brothers/getAllBrothers.js`; the admin voting context
    now imports it directly. The existing directory-query and provider tests,
    all 501 client tests, typecheck, build, and changed-file ESLint pass. Full
    lint remains at 8 errors and 26 warnings. CSS is unchanged; JavaScript
    differs because the adapter is a separate module.
350. Gave Firebase role lookup and update payloads snake_case Rust fields with
    explicit Serde names for the existing `localId` and `customAttributes`
    JSON keys. A new test pins both request shapes and response decoding.
    Single-file rustfmt, all 58 API unit tests, and all 59 tests in the
    isolated MongoDB integration run pass. The Firebase wire format and role
    behavior remain unchanged.
351. Moved the PIS WebSocket service's pure legacy text transforms into
    `src/operations/legacyText.js`, distinct from its event handler with the
    similar name. The implementation is byte-for-byte unchanged; the handler
    and tests now import the new location. All 22 service tests, including
    loopback protocol coverage, pass.
352. Extracted the PIS signup spreadsheet's pure row transformation into
    `maintenance_commands/pis_export.py`, leaving MongoDB lookup, the
    `PIS_Signups.xlsx` filename, Pandas writer, and command entrypoint in
    place. A new test pins row order, date formatting, skipped signups, and
    blank defaults. All 57 offline maintenance tests and Python compilation
    pass; no database or spreadsheet output was touched during verification.
353. Extracted the historical rating-repair command's arithmetic mean into
    `maintenance_commands/rating_repair.py` and removed unused Pandas and
    Requests imports from the command. A new test pins first-seen rating
    category order and the existing missing-name behavior. All 58 offline
    maintenance tests and Python compilation pass; the MongoDB command was
    verified only with fake collections, without touching a real database.
354. Moved the Night 1 migration's lookup and validation into
    `maintenance_commands/attendance_night1.py`, preserving the entrypoint,
    query, exit codes, messages, and database write. New tests pin missing
    night and missing time behavior. All 59 offline maintenance tests and
    Python compilation pass without touching a real database.
355. Extracted Rushee Zoom's route and query rules into
    `features/rushee/zoom/routeContext.js`, retaining the query fallback and
    lazy referrer lookup used by bid-committee presentation. New tests pin
    decoding, empty values, route precedence, and referrer timing. All 503
    client tests, typecheck, build, and changed-file ESLint pass. Full lint
    remains at 8 errors and 26 warnings. CSS is unchanged; JavaScript differs
    because the route rules now live in a separate module.
356. Moved the comment warning rules and their test from generic `js/` into
    `features/comments/commentValidation.js`, updating the Rushee Zoom import.
    Removed redundant comments and trailing whitespace while retaining the
    word bank, regex matching, warning text, and public exports. All 503
    client tests, typecheck, changed-file ESLint, and build pass. Full lint
    remains at 8 errors and 26 warnings; production JS and CSS hashes match
    slice 355 exactly.
357. Moved the shared rushee rush-night interaction logic and its summary type
    from generic `js/` to `features/rushee/`, updating dashboard, zoom, and
    test imports. The season dates and implementation are unchanged. All 503
    client tests, typecheck, changed-file ESLint, and build pass; production
    JS and CSS hashes match slice 356 exactly.
358. Added a sorting WebSocket loopback test showing that a binary frame does
    not close the connection before a valid admin save event. Split the
    268-line WebSocket test module into snapshot/reconnect and access/failure
    modules with a shared fixture (115, 132, and 56 lines respectively).
    Rustfmt and all 13 sorting tests pass; production protocol code is
    unchanged.
359. Simplified the legacy PIS response handler's temporary variables and
    redundant matches while retaining its separate clear-then-push writes,
    response messages, and error-status quirks. A new isolated database
    scenario pins replacement order and empty-payload clearing before and
    after the change. Rustfmt, all 58 API unit tests, and all 59 isolated
    integration tests pass.
360. Consolidated PIS autosave's four brother-name expressions into one
    helper that preserves trimming and the `none` marker for blank names.
    Removed redundant locals and comments while keeping a single MongoDB
    update for answers and names. A new unit test pins the normalization;
    Rustfmt, all 59 API unit tests, and all 60 isolated integration tests
    pass.
361. Moved the auth facade from the generic `client/src/js` directory into
    `features/auth`, updating its four callers and three page-test mocks.
    The facade's behavior and comments are unchanged. All 503 client tests,
    typecheck, changed-file ESLint, and the production build pass; JS and CSS
    asset hashes match slice 357 exactly.
362. Characterized the admin HTTP wrapper's missing-user rejection, per-request
    Firebase token, optional API key, and GET/POST/PUT forwarding with three
    tests before moving it from `client/src/js` to `features/admin`. Updated
    caller imports and page-test mocks, and documented why tokens must stay in
    the request client. All 506 client tests, typecheck, and build pass;
    changed-file ESLint has zero errors and seven existing hook warnings in
    callers. Production JS and CSS hashes match slice 357 exactly.
363. Added two tests for both shared API client variants, covering base URL,
    custom headers, request-time API-key injection, missing-key behavior, and
    error forwarding. Consolidated their duplicate interceptor setup into one
    helper without changing either public client or its request contract.
    All 508 client tests, typecheck, changed-file ESLint, and build pass. CSS
    is unchanged; the JS hash changed with the emitted helper.
364. Characterized global Axios startup configuration with two tests, then
    moved the default client and side-effect setup into `client/src/api`.
    Updated the startup and midterm-context imports and their tests. All 510
    client tests, typecheck, and build pass; changed-file ESLint has zero errors
    and one existing fast-refresh warning. Production JS and CSS hashes match
    slice 363 exactly.
365. Added two byte-level tests for the shared base64-to-Blob helper, including
    its 512-byte chunk boundary, then moved it to `client/src/lib` with a
    consistent filename and updated its callers and page-test mocks. The
    separate, unexported `base64ToTensor` reference in the unused
    FaceAttendance page was left unchanged. All 512 client tests, typecheck,
    changed-file ESLint, and build pass; JS and CSS hashes match slice 363.
366. Removed the unreferenced `client/src/js/timezone.js` module and the now
    empty generic `js` directory after checking every export for repository
    callers. The production build passes with JS and CSS hashes identical to
    slice 365; no runtime imports or routes changed.
367. Added an isolated MongoDB scenario for previously assigned interview
    questions: the endpoint preserves the reveal timestamp, returns the pinned
    question in order with fixed questions, and leaves the stored assignment
    intact. It passed before and after consolidating the handler's three
    success-response and sorting branches into one helper. Both changed Rust
    files pass rustfmt; all 60 API tests with the integration feature pass.
368. Added planner tests for duplicate availability and unnormalized names,
    verifying both against the original implementation. Consolidated the
    first- and second-brother selection, load count, and timeslot reservation
    into one helper without changing tie order or write-failure reservations.
    Changed files pass rustfmt, all six planner tests pass, and all 62 API
    tests with the isolated database integration feature pass.
369. Consolidated duplicate admin and voter WebSocket session lifecycles into
    one internal module while retaining separate route handlers, ID counters,
    snapshot loaders, log messages, and wire events. The Redis-backed loopback
    scenario now uses the same numeric ID in both roles to pin their independent
    client registries; it passed before and after the refactor. Rustfmt, all
    three voting WebSocket unit tests, and all four tests with the Redis
    integration feature pass.
370. Added two command-level tests for the PIS collaboration hook's connected
    event payloads and disconnected guards, then moved the hook beside its
    protocol and presence helpers in `features/pis`. Updated the PIS page and
    tests without changing hook call order or exports. All 514 client tests,
    typecheck, and build pass; changed-file ESLint has zero errors and two
    existing PIS-page warnings. Production JS and CSS hashes are unchanged.
371. Added two hook-level tests for comment visibility's server request,
    forced role-claim refresh, and restrictive failure defaults, then moved
    the hook beside its policy in `features/comments`. Updated three callers
    and their page mocks without changing effects or rendered output. All 516
    client tests, typecheck, and build pass; changed-file ESLint has zero errors
    and three existing caller warnings. Production JS and CSS hashes match
    slice 370 exactly.
372. Grouped the voice-recording hook, recorder component, and transcription
    handler under `features/voice`, removing the now-empty generic `hooks`
    directory. The nine existing voice tests retain microphone, upload,
    transcription, and markup contracts. All 516 client tests, typecheck,
    changed-file ESLint, and build pass; JS and CSS hashes match slice 371.
373. Moved the availability modal's one-time timeslot loader inside its mount
    effect and listed the stable API prefix dependency. The existing five
    modal tests preserve request, sorting, loading/error order, and markup;
    all 516 client tests, typecheck, changed-file ESLint, and build pass.
    Full ESLint drops from 26 to 25 warnings with its eight Attendance errors
    unchanged. CSS is unchanged; the JS hash changed with the effect code.
374. Replaced the client Vite starter README with current run, configuration,
    source-layout, and verification guidance. Added the client API-key variable
    to the root environment example and corrected the maintenance cleanup
    script's stale interaction-helper path and default-night description.
    Checked each referenced path and variable against the current source; this
    slice changes documentation only.
375. Consolidated identical admin allowlist parsing from five client entry
    points into `features/auth/parseAdminAllowlist`. Preserved each caller's
    evaluation timing, normalized order, duplicate entries, and existing
    authorization checks. Added two parser tests and kept the five page markup
    fixtures passing. All 518 client tests, typecheck, and build pass; CSS is
    unchanged. Full ESLint remains at the same eight Attendance errors and 25
    warnings.
376. Moved collaborative PIS room initialization from the membership event
    handler into the room module. A new characterization test pins independent
    presence, operation, document, and version state for newly joined rooms.
    All 23 collaboration tests pass, including local Socket.IO protocol and
    reconnect coverage.
377. Renamed the admin voting page directory from
    `AdminVotingDashboardComponents` to `AdminVotingDashboard`, updating the
    route import and six focused test paths. All 518 client tests, typecheck,
    and build pass. Production JavaScript and CSS hashes match slice 375.
378. Separated the midterm-mode provider component from its context and hook,
    keeping the shared context instance and the existing status request,
    fallback, and mount effect. The context tests now exercise the two modules
    together; focused page fixtures and all 518 client tests pass. Typecheck
    and build pass, CSS is unchanged, and full ESLint drops to 24 warnings
    with the eight Attendance errors unchanged.
379. Added two voter-context tests for its initial provider value and
    missing-provider guard, then separated the provider component from the
    context and hook. All 520 client tests, typecheck, and build pass.
    Production JavaScript and CSS hashes match slice 378, and full ESLint
    drops to 23 warnings with the eight Attendance errors unchanged.
380. Separated the admin voting provider component from its context and hook,
    preserving the five state initializers, brother-fetch effect, fallback,
    and context value. The existing provider and page-markup tests pass, as do
    all 520 client tests, typecheck, and build. CSS is unchanged; full ESLint
    drops to 22 warnings with the eight Attendance errors unchanged.
381. Moved Firebase role wire types and pure claim parsing from the auth network
    module into `auth/roles/claims.rs`. Shared one boolean-role predicate across
    the three status methods without changing token fetches, HTTP requests, or
    the existing empty-map fallback. Two new tests pin last-record selection,
    malformed attributes, and boolean-only role grants. Targeted rustfmt,
    all 63 server unit tests, and all 64 Docker-backed integration-feature tests
    pass.
382. Consolidated the three season seed-file request loops into one internal
    replay helper while preserving file and record order, endpoint paths,
    progress labels, response decoding, and distinct error messages. Added an
    offline multi-record test covering HTTP, API, and network failures. All 60
    maintenance tests and Python compilation pass; no setup or reset command
    was run.
383. Moved the identical sorting viewer WebSocket mount and cleanup effects
    from the brother and bid-committee pages into one sorting hook. Kept each
    page's effect order, audience flag, five-second ghost cleanup, and closure
    of the latest reconnected socket. Three new hook tests and the existing
    page fixtures pass; all 523 client tests, typecheck, and build pass. CSS
    is unchanged, and full ESLint remains at eight Attendance errors and 22
    warnings.
384. Moved the admin sorting WebSocket mount and cleanup effect into a paired
    sorting hook. The page still registers it before its auth effect; drag
    cancellation resolves when that mount effect runs, after render. One new
    hook test covers connection options, ghost and lock cleanup, and the latest
    reconnected socket. All 524 client tests, typecheck, and build pass; CSS
    is unchanged, and full ESLint remains at eight Attendance errors and 22
    warnings.
385. Moved the six outbound PIS collaboration callbacks into a command hook,
    leaving socket registration and presence cleanup in the parent hook. The
    existing command tests now exercise the extracted hook directly and also
    pin local operation and pending-update refs; the socket registration test
    checks the parent passes the same user and initial socket. All 524 client
    tests, typecheck, and build pass. CSS is unchanged, and full ESLint remains
    at eight Attendance errors and 22 warnings.
386. Added isolated database assertions for `get_brother_pis`, covering both
    signup slots, exact-name matching, and the brother-facing response fields.
    They pass against the original and cleaned handler. Simplified its
    equivalent match expression and empty-document query, removed a stale
    TODO and unused error binding, and kept all response payloads intact.
    Targeted rustfmt and all 64 isolated integration-feature tests pass.
387. Characterized `get_signup_timeslots` against the isolated database with
    empty, registered, and updated signup assertions before changing the
    handler. Simplified its empty-document query, named the collected values
    `signups`, and removed a stale TODO and unused error binding without
    changing the response. Targeted rustfmt and all 64 isolated
    integration-feature tests pass before and after the cleanup.
388. Pinned attendance's existing success response when the GTID has no
    matching rushee, alongside the existing duplicate-scan assertion, before
    simplifying the handler. Removed an inaccurate doc comment and redundant
    temporary binding, and made the intentional matched-count behavior clear
    at the write result. Targeted rustfmt and all 64 isolated integration
    tests pass before and after the cleanup.
389. Characterized the cloud update's existing success response for a missing
    rushee and the empty profile-edit response before simplifying profile
    writes. Removed no-op success arms, scoped each update document to its
    branch, and documented the sequential partial-write behavior already
    covered by the integration scenario. Targeted rustfmt and all 64 isolated
    integration tests pass before and after the cleanup.
390. Characterized GTID validation before cleaning the validator module:
    short IDs fail, any otherwise-unused nine-byte value passes, and a
    registered GTID fails. Replaced nested matches and manual allowlist
    construction with equivalent expressions, named the profile field sets
    after their actual roles, and accepted a comment slice instead of a vector
    reference. Existing profile and comment contracts still pass. Targeted
    rustfmt and all 64 isolated integration tests pass before and after.
391. Shared the collaborative input and textarea pending-change and debounced
    send timers without changing their call order or distinct 300/450 ms
    delays. Added an input interaction test and shared-timer edge assertions
    for offline clearing, replacement, composition, and unmount cleanup.
    Existing markup hashes remain unchanged. All 527 client tests, typecheck,
    and build pass; CSS remains byte-identical, and full lint remains at the
    existing eight Attendance errors and 22 warnings.
392. Removed the tracked Firebase Hosting upload cache and an empty root npm
    lockfile; neither is a source dependency. Ignored future client Firebase
    caches while retaining the client and PIS WebSocket lockfiles. The client
    production build still emits the same JS and CSS asset names.

The API baseline builds with 78 existing warnings and zero tests. On this Mac,
select the installed command-line tools for Cargo with
`DEVELOPER_DIR=/Library/Developer/CommandLineTools`; the selected Xcode app has an
unaccepted license. No machine-wide toolchain settings were changed.

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
and TS/TSX lint; the current state has 8 errors and 22 warnings, so it is
tracked debt, not a passing check.
The regression workflow runs the passing suites and client
build on pushes and pull requests; its first GitHub run remains unverified.

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

Current verified totals: 527 client tests, 63 server unit tests, 23 collaboration
tests, 13 sorting WebSocket tests, 4 voting WebSocket tests with the Redis
feature, and 64 server tests with the integration feature (including its
isolated database contract), plus 60 maintenance-script tests. The last
client build differs from baseline CSS only by the unused `hover:bg-blue-600`
rule from removed commented-out JSX. Authenticated browser flows, later
registration steps, and end-to-end database flows are still pending; the
public-entry comparison does not establish full application parity.
