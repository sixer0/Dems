import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchHealth, HEALTH_QUERY_KEY, type HealthResponse } from '@dems/shared/api';
import { useMobileLive, type MobileLiveSim } from '@/runtime';

export { HEALTH_QUERY_KEY };

/**
 * Service health of the Core the app talks to (Stack Check, `/stack-check`).
 *
 * - SIMULATED and HEARTBEAT (and outside the runtime provider): mock-core liveness over
 *   `adb reverse tcp:4400 tcp:4400`, as before.
 * - LIVE (backend task W51; 04_client_integration_spec §7.4, finding FC-9): operation 1
 *   `getServiceHealth` of the Core server, through the typed client of the Live source
 *   (`live.client`). The answer is validated against the contract and names
 *   `service: 'dems-core-server'`. No raw `fetch` goes to the Core server's origin (D69): the app's
 *   cookie store must never be filled for that host.
 *
 * The query key says which service answered, so an answer of one never shows as the other's after
 * a change of the Core link source. Retried with Query's backoff in both modes.
 */
export function useHealth() {
  const live = useMobileLive();
  const query = useQuery({
    queryKey: live ? ([...HEALTH_QUERY_KEY, 'core-server'] as const) : HEALTH_QUERY_KEY,
    queryFn: () => (live ? fetchCoreServerHealth(live) : fetchHealth()),
    refetchInterval: 10_000,
  });
  const { refetch } = query;
  // LIVE: the link came back (or the replica was resynchronised): read the health again at once.
  // In the other modes `AppProviders` invalidates the query from the mock-core heartbeat's resync.
  useEffect(() => {
    if (!live) return undefined;
    return live.onResync((event) => {
      // One request, however many screens read the health: a read that is already out is joined.
      if (event.phase === 'RESYNCED') void refetch({ cancelRefetch: false });
    });
  }, [live, refetch]);
  return query;
}

/** `GET /api/v1/health` of the Core server. Rejects when there is no valid answer, so the query shows its error state. */
async function fetchCoreServerHealth(live: MobileLiveSim): Promise<HealthResponse> {
  const answer = await live.client.call('getServiceHealth');
  if (answer.ok) return answer.data;
  // The class of the failure and its status only: the typed client has already reported a
  // failure that is no answer of the contract to the persistent log, with the request ID.
  throw new Error(`getServiceHealth -> ${answer.kind}${answer.status === null ? '' : ` (HTTP ${answer.status})`}`);
}
