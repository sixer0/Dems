/**
 * The versions of the components of THIS Core (fix wave J round two; JW-26 mobile half; contract_wave_j.md
 * "J2-S 2"): operation 64 `getSystemStatus`, member `components`, read BY NAME.
 *
 * - LIVE and signed in only (the operation needs a signed-in operator). The answer is not operator-dependent,
 *   so the key carries no operator; it names the service that answered.
 * - `components` absent (an older Core) or no answer: null - the caller then shows the app's own version only.
 * - Nothing of the answer's five slices is used here: the replicated state already holds them.
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { selectIsSignedIn, useSim } from '@dems/shared/sim';
import { reportRuntimeIssue, useMobileLive, type MobileLiveSim } from '@/runtime';

export interface CoreComponents {
  readonly coreName: string | null;
  readonly core: string | null;
  /** Absent on a Core in SIMULATED capture (it starts no worker). */
  readonly captureWorker: string | null;
  readonly apiContract: string | null;
}

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);
const part = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {});

/** The member as the contract states it, read defensively by name; null when the answer carries none. Pure. */
export function coreComponentsOf(status: unknown): CoreComponents | null {
  const components = part(status)['components'];
  if (typeof components !== 'object' || components === null) return null;
  const core = part(part(components)['core']);
  return {
    coreName: text(core['name']),
    core: text(core['version']),
    captureWorker: text(part(part(components)['captureWorker'])['version']),
    apiContract: text(part(part(components)['apiContract'])['version']),
  };
}

export const CORE_COMPONENTS_KEY = ['system-components', 'core-server'] as const;

async function readFromCore(live: MobileLiveSim): Promise<CoreComponents | null> {
  const answer = await live.client.call('getSystemStatus');
  if (answer.ok) return coreComponentsOf(answer.data);
  // The class of the failure and its status only; never the text of an answer.
  throw new Error(`getSystemStatus -> ${answer.kind}${answer.status === null ? '' : ` (HTTP ${answer.status})`}`);
}

export function useCoreComponents(): CoreComponents | null {
  const live = useMobileLive();
  const signedIn = useSim(selectIsSignedIn);
  const query = useQuery({
    queryKey: CORE_COMPONENTS_KEY,
    queryFn: () => (live ? readFromCore(live) : null),
    enabled: live !== null && signedIn,
    staleTime: 60_000,
  });
  // Layer 2 of the error rules: every NEW failure is one record in the persistent runtime log. The page then
  // shows the app's own version and "Not reported" for the Core's (layer 3): nothing is invented.
  const reported = useRef(0);
  useEffect(() => {
    if (query.status !== 'error' || query.errorUpdatedAt === reported.current) return;
    reported.current = query.errorUpdatedAt;
    reportRuntimeIssue('warn', 'settings.about.components', query.error, {});
  }, [query.status, query.error, query.errorUpdatedAt]);
  return live === null ? null : (query.data ?? null);
}
