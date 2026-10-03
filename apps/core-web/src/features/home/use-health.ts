import { useQuery } from '@tanstack/react-query'
import { HEALTH_QUERY_KEY } from '@dems/shared/api'
import { fetchCoreHealth } from '@/lib/core-endpoint'

export { HEALTH_QUERY_KEY }

/**
 * mock-core liveness. TanStack Query retries failed fetches with exponential backoff
 * (3 retries by default) and the heartbeat's `onResync` invalidates this key after a reconnect.
 * The origin is the packaged build's own origin, or 127.0.0.1:4400 in dev (lib/core-endpoint).
 */
export function useHealth() {
  return useQuery({ queryKey: HEALTH_QUERY_KEY, queryFn: () => fetchCoreHealth(), refetchInterval: 10_000 })
}
