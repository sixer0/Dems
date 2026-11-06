/**
 * `@/runtime`: what the pages and the shell import from the web runtime (plan row W50). LIGHT:
 * this barrel loads neither the typed client nor the Live source; `./live-start` (the heavy
 * module) and `./boot` (the entry's) are not re-exported as values, and `./testing` never is.
 *
 * | A page wants to | It imports |
 * |-----------------|------------|
 * | Know the mode | `useCoreMode()` from `@dems/shared/live` (SIMULATED or LIVE, from the data source in the context) |
 * | Offer the mode switch | `useCoreModeControl()`: `{ mode, selectable, switchTo(next) }`, or `null` |
 * | Follow the link | `useLiveLink()` from `@dems/shared/live` |
 * | Run a simulator action | `useCoreActions()` and `settle` from `@dems/shared/live` |
 * | Call an operation that is no action | `useWebLive()?.client.call(operationId, input)` |
 * | Keep a list of the Core | TanStack Query under `CORE_QUERY_KEYS` (the bridge refetches and empties them) |
 * | Drop what it holds outside the cache when the cache is emptied | `onCoreQueriesCleared(queryClient, listener)` |
 * | Word a refusal | `useCoreErrorPresenter()` from `@/lib/core-errors` |
 * | React to a session end | `auth.status` of the store (the shell's leave path), and `useLiveSelector((live: WebLive \| null) => live?.lastSessionEnd ?? null)` for the notice |
 * | Read the page's own log | `webErrorSink.records()` |
 */
export { CORE_MODE_ENV_KEY, CORE_MODE_STORAGE_KEY, type CoreModeControl } from './core-mode'
export { ERROR_SINK_CAPACITY, redactCredentials, webErrorSink, type ErrorRecord, type ErrorSink } from './error-sink'
export { useCoreModeControl, useWebLive } from './hooks'
export { LIVE_CONSOLE_HOST, liveConsoleOrigin } from './live-host'
export type { WebLive } from './live-start'
export {
  ADMIN_CHANGED_QUERY_KEYS,
  CORE_QUERY_DEFAULTS,
  CORE_QUERY_KEY,
  CORE_QUERY_KEYS,
  CORE_QUERY_PERMISSIONS,
  CORE_QUERY_ROOT,
  onCoreQueriesCleared,
} from './query-bridge'
