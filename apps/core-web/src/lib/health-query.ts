/**
 * The health query of the console: one definition of the key `['health']` (`HEALTH_QUERY_KEY`).
 *
 * FXR-W, findings W92-8 and W92-9 (`verification/11_code_review_shared_web.md`; decision D242;
 * CPW1-9, D187 ruling 5): the query lived in `features/home/use-health.ts`, and the API Reference
 * feature reached into the Home feature for it, while the Login page defined the same key again.
 * It now has one home here. `healthQueryOptions()` is the key and its one `queryFn` (the console's one
 * health reader, `fetchCoreHealth()`: the packaged build's own origin, or 127.0.0.1:4400 in dev); each
 * reader adds only what its own screen needs to the observer (an interval, `enabled`, `retry`).
 * The heartbeat's `onResync` and the query bridge invalidate the key after a reconnect.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'
import { HEALTH_QUERY_KEY } from '@dems/shared/api'
import { fetchCoreHealth } from '@/lib/core-endpoint'

export { HEALTH_QUERY_KEY }

/** The key `['health']` and its one `queryFn`. */
export function healthQueryOptions() {
  return queryOptions({ queryKey: HEALTH_QUERY_KEY, queryFn: () => fetchCoreHealth() })
}

/**
 * Liveness for the Home page and the API Reference banner. TanStack Query retries failed fetches
 * with exponential backoff (3 retries by default); the answer is asked for again every 10 s.
 */
export function useHealth() {
  return useQuery({ ...healthQueryOptions(), refetchInterval: 10_000 })
}
