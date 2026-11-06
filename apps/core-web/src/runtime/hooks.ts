/**
 * What a page reads from the runtime through React (backend task 04_client_integration_spec §2.3
 * CL-15, §3.1 MD-4; brief list rows 1 and 21 of implementation/44_live_source.md §17.4; plan row
 * W50). Light: nothing here loads the typed client or the Live source (the type is erased).
 *
 * The other hooks a page needs are the shared ones of `@dems/shared/live`: `useCoreMode()`,
 * `useLiveLink()`, `useCorePermission(permission)`, `useCoreActions()` and `useLiveSelector(read)`.
 */
import { useRouter } from '@tanstack/react-router'
import { useLive } from '@dems/shared/live'
import type { CoreModeControl } from './core-mode'
import type { WebLive } from './live-start'

/**
 * The Live source of the page, or `null` in Simulated mode. Its `client` is the ONE way a page
 * calls an operation that is no simulator action: `live.client.call(operationId, input)`, typed
 * by the contract's registry. A page never builds a typed client of its own.
 */
export function useWebLive(): WebLive | null {
  return useLive<WebLive>()
}

/**
 * The data mode of this page load and its switch, or `null` when the router was built without
 * them (every test that passes no `coreMode`): a selector then renders nothing (MD-4). Render a
 * selector only when `selectable` is true.
 */
export function useCoreModeControl(): CoreModeControl | null {
  return useRouter().options.context.coreMode ?? null
}
