# apps/core-web/src/runtime

Up: [src](../README.md)

## Purpose

The web runtime: how a page load picks its data source (SIMULATED or LIVE), starts it, and exposes it to the pages. `main.tsx` imports `./boot` dynamically and calls `bootCoreRuntime` once, before the router exists. Pages and the shell import only the light barrel `index.ts` (as `src/runtime` through the path alias); the heavy module `live-start.ts`, which loads the typed client and the Live source, is reached only through `boot.ts`.

Mode resolution (`core-mode.ts`), first matching rule wins:

| # | Rule | Result | Choice offered |
|--:|------|--------|----------------|
| 1 | A packaged build (`VITE_DEMS_CORE_ORIGIN=same-origin`) or a production build | SIMULATED | no |
| 1b | `VITE_DEMS_PRODUCTION_LOCK` is exactly `1` (the production console lock) | LIVE | no |
| 2 | `localStorage` key `dems.core.mode.v1` holds `SIMULATED` or `LIVE` | that value | yes |
| 3 | `VITE_DEMS_CORE_MODE` is `simulated` or `live` | that value | yes |
| 4 | Otherwise | SIMULATED | yes |

## Files

| File | Role |
|---|---|
| [`boot.ts`](boot.ts) | Start of the data source, one per page load (`bootCoreRuntime`, `createCoreModeControl`). SIMULATED builds the simulator and never loads the Live module; LIVE checks the page host, then loads `live-start.ts`; a refused host builds neither source and returns a `RefusedRuntime`. Changing the mode signs out, stores the choice and reloads at `/login`. |
| [`core-mode.ts`](core-mode.ts) | The mode resolver and the stored choice (`resolveCoreMode`, `parseCoreModeEnv`, `readStoredCoreMode`, `writeStoredCoreMode`, `CORE_MODE_STORAGE_KEY`, `CORE_MODE_ENV_KEY`, `CORE_MODE_LOCK_ENV_KEY`). Storage helpers never throw. |
| [`env.d.ts`](env.d.ts) | Type declaration of the build-time mode key; merges with `src/env.d.ts`. |
| [`error-sink.ts`](error-sink.ts) | The page's own log (`webErrorSink`, `createErrorSink`, `redactCredentials`): the last `ERROR_SINK_CAPACITY` records in memory, printed to the browser console in dev builds, never sent over the network, credentials redacted. |
| [`hooks.ts`](hooks.ts) | React hooks over the runtime: `useWebLive` (the Live runtime or `null`) and `useCoreModeControl` (the mode switch, or `null` when no choice is offered). |
| [`index.ts`](index.ts) | The light barrel the pages import; re-exports mode keys, the error sink, the hooks, the live host, the `WebLive` type and the query-bridge keys. |
| [`live-host-refusal.tsx`](live-host-refusal.tsx) | `LiveHostRefusalScreen`: shown when a Live page was opened under the wrong host; offers the Simulated way out only when a choice exists (not under the production lock). |
| [`live-host.ts`](live-host.ts) | The address the console must be opened at in Live mode, `http://127.0.0.1:<port>` (`LIVE_CONSOLE_HOST`, `liveConsoleOrigin`, `liveHostRefusal`); a page under `localhost` would be refused by the Core with 403 `ORIGIN_NOT_ALLOWED`, so it does not start. |
| [`live-start.ts`](live-start.ts) | The Live start-up (`startLiveRuntime`): the only file that imports `@dems/shared/client` and `@dems/shared/live/source` as values; loaded only through the dynamic import in `boot.ts`. |
| [`owed-sign-out-storage.ts`](owed-sign-out-storage.ts) | Storage of a sign-out the Core has not heard of (a "debt", for example a Lock while the Core was unreachable) in the origin's `localStorage`, holding no credential; the Live source settles it before it takes any session. `watchOwedSignOut` follows the `storage` event so an open tab ends its own session (with `signOut`) when another tab records a debt for it (`createOwedSignOutPort`, `hasUsableStorage`). |
| [`presentation-follow.ts`](presentation-follow.ts) | `followServerPresentationMode`: while an operator is signed in, copies the server's `settings.presentationMode` into the tab-local flag `dems.presentation.v1` (see [`../lib/presentation-mode.ts`](../lib/presentation-mode.ts)); installed once in `routes/__root.tsx`, so it holds on every route. |
| [`query-bridge.ts`](query-bridge.ts) | What the Live source tells the `@tanstack/react-query` cache: Core keys (`CORE_QUERY_KEYS` under the root `'core'`), refetch on `admin.changed`, clear on a session change (`attachQueryBridge`, `clearCoreQueries`, `onCoreQueriesCleared`, `applyCoreQueryDefaults`). |
| [`testing/`](testing/) | Test-only helpers, not imported by production code: `live-harness.ts` (builds a Live page on a fake transport) and `fake-time.ts` (page timers on a fake clock). |

## Main exports

From `index.ts`: `useWebLive`, `useCoreModeControl`, `webErrorSink`, `redactCredentials`, `ERROR_SINK_CAPACITY`, `LIVE_CONSOLE_HOST`, `liveConsoleOrigin`, `CORE_MODE_ENV_KEY`, `CORE_MODE_STORAGE_KEY`, `CORE_QUERY_ROOT`, `CORE_QUERY_KEY`, `CORE_QUERY_KEYS`, `CORE_QUERY_PERMISSIONS`, `CORE_QUERY_DEFAULTS`, `ADMIN_CHANGED_QUERY_KEYS`, `onCoreQueriesCleared`, and the types `WebLive`, `CoreModeControl`, `ErrorRecord`, `ErrorSink`.

Not re-exported: `bootCoreRuntime` (entry only), `startLiveRuntime`, `LiveHostRefusalScreen`, `followServerPresentationMode`, `attachQueryBridge`, and everything in `testing/`.

How a page reaches the Core (from the `index.ts` header): mode with `useCoreMode()`, link with `useLiveLink()`, simulator actions with `useCoreActions()` and `settle` (all `@dems/shared/live`); an operation that is no action with `useWebLive()?.client.call(operationId, input)`.

## Core operations, state and shared modules

- Core calls: `signOut` (in `owed-sign-out-storage.ts`, paying an owed sign-out). The query bridge names the keys of operations 76 and 77 (capture device selector) and the administration lists; the reads themselves live in [`../lib/core-queries.ts`](../lib/core-queries.ts).
- Live source events used: `admin.changed` (`USERS`, `DEVICES`, `PAIRING_CODE`) and session changes.
- Shared package modules: `@dems/shared/live`, `@dems/shared/live/source`, `@dems/shared/client`, `@dems/shared/sim`, `@dems/shared/api`, `@dems/shared/realtime`, `@dems/shared/redaction`.
- Console folders used: [`../lib/`](../lib/README.md) (`core-endpoint.ts`, `presentation-mode.ts`).

## Tests

This folder has no `__tests__/`. Its tests are in [`../test/`](../test/README.md): `live-runtime-mode.test.tsx`, `live-runtime-startup.test.tsx`, `live-runtime-boot-failure.test.tsx`, `live-runtime-bridge.test.tsx`, `live-runtime-sink.test.tsx`, `live-runtime-static.test.tsx`, `live-runtime-storage.test.tsx`, `live-runtime-surface.test.tsx`, `media-token-blanking.test.ts`. Most `live-*` page tests build their page with [`testing/live-harness.ts`](testing/live-harness.ts).

## Related decisions

From `decisions.md` of the 2026-11-05 audit:

- D25: the production web login offers no Simulated mode (N3).
- D29: Q6, a production-only console lock variable (`VITE_DEMS_PRODUCTION_LOCK`) set in the `dems-console` unit; no Simulated mode when set.
- D47: row 106 accepted; root cause was the web deciding the mode in `boot.ts`; fix is `VITE_DEMS_PRODUCTION_LOCK` (rule 1b above).
- D71: the deploy sets `Environment=VITE_DEMS_PRODUCTION_LOCK=1` on `dems-console`.
- D81: the served console checked with `VITE_DEMS_PRODUCTION_LOCK=1`.
