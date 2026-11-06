/**
 * Local simulator adapter of the Start Session flow (P6 / P12: screen steps never edit
 * `packages/shared/src/sim`; a missing selector is logged as a SIM-GAP and bridged here).
 *
 * **SIM-GAP-1 (step 78): no "next case number" selector.** 04_mobile_specs §4.4 says the simulated
 * Scan "fills the next synthetic case number `LP/{YYYY}/{MMDD}-0008`". The simulator keeps
 * `meta.counters.caseNumber` ("the Scan helper", 13_sim_engine) but exports no selector, and no
 * action advances the counter, so a second scan in the same run would repeat a case number that a
 * session already uses. This adapter derives the next number from the simulator's own data, with
 * the simulator's own formatter (`caseNumberFor`, WIB calendar day of the simulator clock):
 *
 *   next = max(counters.caseNumber, 1 + highest NNNN among the active session and the history)
 *
 * Proposed closure for the simulator owner (step 91): export `selectNextCaseNumber(state)` with
 * this rule (or advance the counter in `openSession`). Swapping this file for it changes no screen.
 */
import { caseNumberFor, type SimState } from '@dems/shared/sim';

/** `LP/2026/1001-0007` → 7; anything that does not end in `-NNNN` → 0. */
export function caseSeqOf(caseNumber: string | null | undefined): number {
  if (typeof caseNumber !== 'string') return 0;
  const match = /-(\d{4})$/.exec(caseNumber.trim());
  return match ? Number(match[1]) : 0;
}

/** The sequence number the next scan uses (pure; reads only the simulator state). */
export function nextCaseSeq(state: Pick<SimState, 'meta' | 'session' | 'sessionHistory'>): number {
  let highest = caseSeqOf(state.session?.input.caseNumber);
  for (const entry of state.sessionHistory) highest = Math.max(highest, caseSeqOf(entry.caseNumber));
  return Math.max(state.meta.counters.caseNumber, highest + 1);
}

/** The next synthetic case number on the simulator's clock, e.g. `LP/2026/1001-0008`. */
export function nextCaseNumber(state: Pick<SimState, 'meta' | 'session' | 'sessionHistory' | 'clock'>): string {
  return caseNumberFor(nextCaseSeq(state), state.clock.now);
}
