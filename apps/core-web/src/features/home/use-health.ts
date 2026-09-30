import { useQuery } from '@tanstack/react-query'
import { fetchHealth, HEALTH_QUERY_KEY } from '@dems/shared/api'

export { HEALTH_QUERY_KEY }

/**
 * mock-core liveness. TanStack Query retries failed fetches with exponential backoff
 * (3 retries by default) and the heartbeat's `onResync` invalidates this key after a reconnect.
 */
export function useHealth() {
  return useQuery({ queryKey: HEALTH_QUERY_KEY, queryFn: () => fetchHealth(), refetchInterval: 10_000 })
}
