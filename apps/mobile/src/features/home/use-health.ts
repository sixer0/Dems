import { useQuery } from '@tanstack/react-query';
import { fetchHealth, HEALTH_QUERY_KEY } from '@dems/shared/api';

export { HEALTH_QUERY_KEY };

/** mock-core liveness over `adb reverse tcp:4400 tcp:4400`; retried with Query's backoff. */
export function useHealth() {
  return useQuery({ queryKey: HEALTH_QUERY_KEY, queryFn: () => fetchHealth(), refetchInterval: 10_000 });
}
