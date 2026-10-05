/**
 * Local simulator adapter of the Recovery Status screen (P6 / P12: screen steps never edit
 * `packages/shared/src/sim`; a missing behaviour is logged as a SIM-GAP and bridged here).
 *
 * - **SIM-GAP-M81-1: no "recovered and sealed" outcome.** `recover()` always ends the session as
 *   INCOMPLETE (13_sim_engine §2 `recover()`, S32-8; SYS-008 "never mark an incomplete session
 *   SEALED"). The brief also names a RECOVERED outcome: the session sealed with a recovery signature
 *   once the controlled analysis passes (book §6.4 item 5). The screen maps a history entry with
 *   outcome SEALED to that outcome and shows the item's signature (`recoverySignatureOf`), so the
 *   branch is ready the day the simulator produces it; today it never does, and no adapter invents
 *   one. Proposed closure (simulator owner, step 91): a `recover({ seal })` variant, or a recovery
 *   path that seals when every track is intact, writing a `recovery` flag on the history entry.
 * - **SIM-GAP-M81-2: `recover()` has no role check.** Every other session action that the brief
 *   gates by role reports SimPermissionError (D61). `startRecovery` checks SESSION_START (Investigator,
 *   Supervisor; a Technician manages devices, not sessions) and throws `SimPermissionError('recover',
 *   'SESSION_START')` before calling the simulator, so the screen's toast path is the D61 one.
 *   Proposed closure: the same check inside the simulator's `recover`.
 * - **SIM-GAP-M81-3: no per-check recovery results or timing.** The simulator's `RecoverySlice` holds
 *   only the two §18.1 stages and their times. The screen derives the track integrity, the last good
 *   segment and the time-source continuity from the simulator state at the interruption (fault flags,
 *   session timeline, time faults; `recovery.model.ts`) and paces the five checks inside the
 *   simulator's 3 s on its clock (`RECOVERY_MILESTONES_MS`). Proposed closure: a `findings` field on
 *   `RecoverySlice` (per track, segment end, time source) and a selector for it.
 * - **SIM-GAP-M81-4: no FAULT or RECOVERY scenario.** `fault-demo` keeps the session RECORDING (its
 *   three faults are not critical, §6.4 item 1), so no deep link alone opens this screen in FAULT.
 *   The device check loads `fault-demo` through the deep link and injects POWER_FAIL through the
 *   debug-only `__DEMS_DEBUG__` handle (D66 (c)); the route sync then opens `/session/recovery`.
 *   Proposed closure: a `power-fail` scenario (fault-demo plus POWER_FAIL).
 */
import type { CoreActions, CoreResult } from '@dems/shared/live';
import {
  Permission,
  SimPermissionError,
  roleHas,
  type EvidenceItem,
  type OperatorRole,
  type SimActions,
} from '@dems/shared/sim';

/** SIM-GAP-M81-2: the permission that starts a recovery. */
export const RECOVERY_PERMISSION = Permission.SESSION_START;

export function canStartRecovery(role: OperatorRole | null): boolean {
  return roleHas(role, RECOVERY_PERMISSION);
}

/**
 * FAULT → RECOVERY for a role that may do it. Throws `SimPermissionError` (SIM-GAP-M81-2) or, from
 * the simulator, `SimTransitionError` when the session is not in FAULT any more.
 *
 * Live mode (plan row W73, site S5-2): the check stays as the client-side hint, read from the
 * replicated role; the Core enforces SESSION_START on operation 33 (`recoverSession`). The action's
 * result is returned, so the caller consumes it through `settle`: the simulator answers before this
 * returns, a Live source when the Core answered and the store holds RECOVERY (CL-16). Both shapes of
 * the action are accepted: the Core actions of either mode, and the simulator's own (step 81's tests).
 */
export function startRecovery(actions: Pick<CoreActions, 'recover'> | Pick<SimActions, 'recover'>, role: OperatorRole | null): CoreResult<void> {
  if (!canStartRecovery(role)) throw new SimPermissionError('recover', RECOVERY_PERMISSION);
  return actions.recover();
}

/** Opening an evidence item needs EVIDENCE_VIEW (every demo role has it; the check keeps the D61 path). */
export function assertCanViewEvidence(role: OperatorRole | null): void {
  if (!roleHas(role, Permission.EVIDENCE_VIEW)) throw new SimPermissionError('viewEvidence', Permission.EVIDENCE_VIEW);
}

/** SIM-GAP-M81-1: the recovery signature of a sealed item, or null (simulated value; never called a real signature). */
export function recoverySignatureOf(item: Pick<EvidenceItem, 'status' | 'signature'> | null | undefined): string | null {
  if (!item || item.status === 'RECORDED') return null;
  return item.signature.value;
}
