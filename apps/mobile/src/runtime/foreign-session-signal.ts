/**
 * "A session of the Core changed, and this device does not follow it" (fix wave Q, CT-05; ruling of D246).
 *
 * `SessionRouteSync` used to take the operator to Finalizing and to the Session Summary of ANY session the Core
 * ran - also one driven from the web console while this operator read Evidence or Network & Time on the tablet
 * (three times in the confirmation; on the phone too). The ruling: a session this operator did not start on this
 * device never navigates them; a toast tells them instead. The route sync emits here what it did NOT follow;
 * `ForeignSessionToasts` (features/sessions) says it. One signal per session and phase.
 */
import type { SessionState } from '@dems/shared/domain';

export type ForeignSessionPhase = 'recording' | 'ended' | 'sealed' | 'interrupted';

export interface ForeignSessionSignal {
  readonly sessionId: string;
  readonly phase: ForeignSessionPhase;
}

/** The phase a state is told as, or null (a setup, no session: nothing to tell). Pure. */
export function foreignSessionPhase(state: SessionState | null): ForeignSessionPhase | null {
  switch (state) {
    case 'RECORDING':
      return 'recording';
    case 'STOPPING':
    case 'FINALIZING':
      return 'ended';
    case 'SEALED':
      return 'sealed';
    case 'FAULT':
    case 'RECOVERY':
      return 'interrupted';
    default:
      return null;
  }
}

type Listener = (signal: ForeignSessionSignal) => void;
const listeners = new Set<Listener>();
const told = new Set<string>();

/** Emits once per session and phase; returns whether it was new. */
export function emitForeignSession(signal: ForeignSessionSignal): boolean {
  const key = `${signal.sessionId}|${signal.phase}`;
  if (told.has(key)) return false;
  told.add(key);
  for (const listener of [...listeners]) listener(signal);
  return true;
}

export function subscribeForeignSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetForeignSessionSignalForTests(): void {
  told.clear();
  listeners.clear();
}
