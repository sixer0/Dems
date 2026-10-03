/**
 * Runtime internals shared by the runtime's own components (route sync, auth, debug hooks): the
 * simulator instance and the resync bus. Screens use the contract hooks and `@dems/shared/sim`
 * selectors (`useSim`) instead; this context is not part of the screen-facing contract.
 */
import { createContext, useContext } from 'react';
import type { Sim } from '@dems/shared/sim';
import type { ResyncBus } from './resync-bus';

export interface RuntimeInternals {
  readonly sim: Sim;
  readonly resyncBus: ResyncBus;
}

export const RuntimeInternalsContext = createContext<RuntimeInternals | null>(null);

/** The runtime internals, or `null` outside `SimRuntimeProvider` (fakes in tests). */
export function useRuntimeInternals(): RuntimeInternals | null {
  return useContext(RuntimeInternalsContext);
}
