/**
 * A one-shot hand-over from the list's kebab menu to the detail (04_mobile_specs §4.10 E4
 * "Verify"): open the item on its Hash & Integrity tab and start a verification. Kept in feature
 * memory rather than the URL, because the route files are step 70's and pass the evidence ID only.
 * The detail takes the intent for its own ID once and clears it.
 */
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

export type DetailTab = 'media' | 'metadata' | 'integrity';

export interface DetailIntent {
  evidenceId: string;
  tab: DetailTab;
  verify: boolean;
  /** Distinguishes two identical requests in a row. */
  seq: number;
}

interface IntentState {
  intent: DetailIntent | null;
}

const intentStore = createStore<IntentState>(() => ({ intent: null }));
let seq = 0;

export function requestDetailIntent(evidenceId: string, tab: DetailTab, verify: boolean): void {
  seq += 1;
  intentStore.setState({ intent: { evidenceId, tab, verify, seq } });
}

/** Clears the intent if it is still the one given (a newer request is kept). */
export function consumeDetailIntent(intent: DetailIntent): void {
  if (intentStore.getState().intent?.seq === intent.seq) intentStore.setState({ intent: null });
}

/** The pending intent for this evidence item, or null. */
export function useDetailIntent(evidenceId: string): DetailIntent | null {
  return useStore(intentStore, (s) => (s.intent?.evidenceId === evidenceId ? s.intent : null));
}

/** Test helper. */
export function resetDetailIntentForTests(): void {
  intentStore.setState({ intent: null });
}
