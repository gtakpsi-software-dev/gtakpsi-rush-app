# Rush app client

The client is a React and Vite application. `src/main.jsx` loads the global
Axios configuration and mounts `src/App.jsx`, which defines the application
routes and the midterm-mode provider.

## Run locally

From `client/`:

```bash
npm ci
npm run dev
```

Set the Firebase and API variables in `client/.env`. The required variable names
are listed in the [root README](../README.md#environment-variables). The client
also reads `VITE_ADMIN_ALLOWLIST` for its existing admin checks. Vite embeds
`VITE_*` values in browser code, so service-account credentials belong only in
server-side configuration.

The three real-time URLs are read by `src/config/realtimeBaseUrls.js`. Their
existing deployment variable names and local fallback behavior are documented
in the [root README](../README.md#environment-variables).

## Source layout

| Path | Purpose |
| --- | --- |
| `src/pages/` | Components used by routes in `src/App.jsx` |
| `src/features/` | Domain code for PIS, rush registration, comments, sorting, voting, admin, and other flows |
| `src/components/` | Components shared across flows |
| `src/api/` | Shared Axios setup and API client |
| `src/config/` | Client configuration, including real-time service URLs |
| `src/contexts/` | App-wide React providers |
| `src/lib/` | Cross-feature utilities |
| `tests/` | Node tests for client behavior and rendered markup |

## Checks

```bash
npm test
npm run typecheck
npm run build
npm run lint
```

The first three checks pass locally. Repository-wide lint still has tracked
findings; see [the refactoring ledger](../docs/refactoring.md#verification) for
the current count and remaining integration limits. The Node tests cover
contracts and markup, while authenticated browser flows still need end-to-end
verification.
