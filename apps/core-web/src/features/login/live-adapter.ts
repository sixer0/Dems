/**
 * Login reads over the Core server (backend task 04_client_integration_spec §5.5 WS-5; plan row
 * W55). The counterpart of `./sim-adapter` for Live mode. Light: it loads neither the typed client
 * nor the Live source (types only).
 *
 * - **Health** (`useLiveCoreHealth`). An anonymous client receives no Core state, so the device
 *   strip shows what is public: the service, its version and its readiness. The answer comes from
 *   the console's one health reader, `fetchCoreHealth()` (the page's own origin in Live mode),
 *   under the shared key `['health']`, which the query bridge refetches after a resync. Nothing is
 *   asked in Simulated mode (`enabled` is false there).
 *
 * The presentation-mode follow-up of WS-10 used to be here. It runs on every route, so decision
 * D144(4) (finding CPW1-4) moved it to `runtime/presentation-follow.ts`, beside `query-bridge.ts`,
 * where the root route installs it.
 */
import { useQuery } from '@tanstack/react-query'
import { HEALTH_QUERY_KEY } from '@dems/shared/api'
import { fetchCoreHealth } from '@/lib/core-endpoint'
import { HEALTH_REFETCH_MS, HEALTH_STARTING_REFETCH_MS, isCoreStarting } from './login-live-model'

/**
 * The health answer of the Core server, for the Login page in Live mode. No retry of its own: the
 * heartbeat says whether the Core is reachable, and the answer is asked for again on the interval.
 */
export function useLiveCoreHealth(enabled: boolean) {
  return useQuery({
    queryKey: HEALTH_QUERY_KEY,
    queryFn: () => fetchCoreHealth(),
    enabled,
    retry: false,
    refetchInterval: (query) => (isCoreStarting(query.state.data) ? HEALTH_STARTING_REFETCH_MS : HEALTH_REFETCH_MS),
  })
}
