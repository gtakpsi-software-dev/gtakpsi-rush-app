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
- Resolve lint findings in verified slices and add a lint gate; document setup,
  service naming, and remaining integration limits.

## Verification

Run `npm --prefix client test` for dependency-free client domain tests and
`npm --prefix client run build` for the production bundle. Use Node 20 or newer
for the test runner. Run `npm --prefix client run lint` for repository-wide lint;
the current baseline has 314 errors and 19 warnings, so it is tracked debt,
not a passing check. The regression workflow runs the passing suites and client
build on pushes and pull requests; its first GitHub run remains unverified.

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

Run `python3 -m unittest discover -s scripts-migrations/tests -p 'test_*.py'`
for offline maintenance-script tests. These use fake collections and do not
require PyMongo or a database connection.

Current verified totals: 257 client tests, 40 server unit tests, 15 collaboration
tests, 9 sorting WebSocket tests, 2 voting WebSocket tests with the Redis
feature, and 41 server tests with the integration feature (including its
isolated database contract), plus 48 maintenance-script tests. The last
client build differs from baseline CSS only by the unused `hover:bg-blue-600`
rule from removed commented-out JSX. Full browser flow/visual testing
and end-to-end authenticated
database flows are still pending; these checks do not yet establish full
application parity.
