/**
 * SECURE pill model (masterplan/01_specs.md §14.4 item 10; research/04 §2.1 #11).
 *
 * Read-only derivations over the simulator state. Since step 54 (D96, review 40 m5) both the pill
 * state and the checklist come from the simulator's own rule set, so they always agree with the
 * Dashboard ring and the Session Monitor:
 * - the pill reads `selectSystemSeverity` (the worst flag), which RECORDING never hides: a mic clip
 *   or a fan stall during a recording shows ATTENTION (amber), a critical fault CRITICAL;
 * - the checklist is `selectIntegrityChecklist`: every system flag lands on exactly one row
 *   (POWER_FAIL on `recording`), so the popover can never read all-OK under a CRITICAL ring.
 * Every selector returns primitives or a stable array, so `useSim` (shallow) stays stable.
 */
import {
  INTEGRITY_CHECKLIST_IDS,
  selectIntegrityChecklist,
  selectSystemSeverity,
  type IntegrityCheckStatus,
  type IntegrityChecklistId,
  type SimState,
} from '@dems/shared/sim'

export type PillState = 'SECURE' | 'ATTENTION' | 'CRITICAL' | 'UNKNOWN'
export type CheckStatus = IntegrityCheckStatus

/** The popover rows, in order (the simulator's checklist IDs). */
export const INTEGRITY_CHECK_IDS = INTEGRITY_CHECKLIST_IDS
export type IntegrityCheckId = IntegrityChecklistId

/**
 * CRITICAL on a critical flag, ATTENTION on a warning (also while RECORDING, D96), else SECURE.
 */
export function selectPillState(s: SimState): Exclude<PillState, 'UNKNOWN'> {
  const severity = selectSystemSeverity(s)
  if (severity === 'CRITICAL') return 'CRITICAL'
  if (severity === 'WARNING') return 'ATTENTION'
  return 'SECURE'
}

/** One status per `INTEGRITY_CHECK_IDS` entry, in that order (a stable array). */
export function selectIntegrityChecks(s: SimState): CheckStatus[] {
  return selectIntegrityChecklist(s)
}
