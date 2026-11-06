/**
 * THE RESTART FAULT OF A CORE IN ITS OWN CAPTURE says what the Core knows (closing pass J of fix
 * wave I; finding G75b-03, rulings D216 (3) and D217 (5)).
 *
 * A Core that records with its own capture and was stopped while its session was PRECHECK, ARMED,
 * RECORDING or STOPPING moves that session to FAULT at its next start (`engine/rehydrate.ts`
 * `applyProcessStart`). The simulator's model of that is a POWER FAILURE: the fault row read
 * "Power fail detected - recovery marker written". A real Core does not observe its power and
 * writes no such marker: all it knows is that it was not running while the session was active.
 *
 * WHAT DOES NOT CHANGE (ruling D217 (5): no new cause now). The fault kind is still `POWER_FAIL`,
 * `session.fault.fromState` is what it was, the fault has no `reason`, the recovery path and what
 * an interrupted seal reads are untouched. A truthful KIND (`CORE_STOPPED`) is listed for the next
 * task.
 *
 * WHAT CHANGES is the wording, carried by ONE member with ONE name on every record of that fault:
 *
 *   `coreNotRunning: true`   on `session.fault`, on its entry of `faults.active`, in the `params`
 *                            of its alert and of its event, in the `details` of its `FAULT_RAISED`
 *                            row (and of the `SYSTEM_BOOT` row a recovery writes), and in the
 *                            `params` of its timeline item.
 *
 * The Core's own sentences below are the `message` of those rows. A client that words a fault by
 * its KIND (`common.faultKind.POWER_FAIL`: "Power failure") reads the member first:
 * `faultKindLabelKey(kind, carrier)`. Absent member = the fault is what its kind says (the
 * simulated lane and the in-app simulator are unchanged).
 */

/** The name of the member (one name end to end). */
export const CORE_NOT_RUNNING_MEMBER = 'coreNotRunning';

/** `message` of the fault's alert, `FAULT_RAISED` row and event on a Core in its own capture. */
export const CORE_NOT_RUNNING_SENTENCE = 'The Core was not running while this session was active. It does not know why it stopped.';

/** The short label a surface shows where it would name the fault kind. */
export const CORE_NOT_RUNNING_LABEL = 'Core was not running';

/** `message` of the `SYSTEM_BOOT` row / event a recovery of that fault writes. `{{product}}`: the product name. */
export const CORE_NOT_RUNNING_RESTART_SENTENCE = '{{product}} is running again. It was not running while this session was active';

/** `message` of the `FAULT_CLEARED` row / event of that fault (written when its recovery starts). */
export const CORE_NOT_RUNNING_CLEARED_SENTENCE = 'The Core is running again — the fault of the time it was not running is cleared';

/** i18n key of the label (block `common.coreNotRunning`, which IS these constants). */
export const CORE_NOT_RUNNING_LABEL_KEY = 'common.coreNotRunning.label';
/** i18n key of the sentence. */
export const CORE_NOT_RUNNING_SENTENCE_KEY = 'common.coreNotRunning.sentence';

/** Any record of a fault that may carry the member: a session fault, an active fault, alert params, audit details, timeline params. */
export type CoreNotRunningCarrier = { readonly coreNotRunning?: unknown } | Readonly<Record<string, unknown>> | null | undefined;

/** True when the record says "the Core was not running" (`coreNotRunning: true`, read by name). */
export function isCoreNotRunning(carrier: CoreNotRunningCarrier): boolean {
  return carrier !== null && carrier !== undefined && (carrier as { coreNotRunning?: unknown }).coreNotRunning === true;
}

/**
 * The i18n key a surface words a fault with: `common.coreNotRunning.label` when one of the given
 * records of that fault carries the member, else `common.faultKind.<kind>`.
 */
export function faultKindLabelKey<K extends string>(kind: K, ...carriers: CoreNotRunningCarrier[]): typeof CORE_NOT_RUNNING_LABEL_KEY | `common.faultKind.${K}` {
  return carriers.some(isCoreNotRunning) ? CORE_NOT_RUNNING_LABEL_KEY : `common.faultKind.${kind}`;
}

/** The active restart fault of a Core in its own capture, or null. Read from `faults.active` by the member. */
export function coreNotRunningFaultOf<F extends { readonly coreNotRunning?: true }>(state: { readonly faults: { readonly active: readonly F[] } } | null | undefined): F | null {
  return state?.faults.active.find((fault) => fault.coreNotRunning === true) ?? null;
}

/**
 * True when the fault of `kind` is, in this state, the restart fault of a Core in its own capture:
 * the open session's fault or an active fault of that kind carries the member. For a surface that
 * has only a kind in hand (a status flag, a list row of the open session).
 */
export function isCoreNotRunningKind(
  state: { readonly session?: { readonly fault?: { readonly kind: string; readonly coreNotRunning?: true } | null } | null; readonly faults: { readonly active: readonly { readonly kind: string; readonly coreNotRunning?: true }[] } } | null | undefined,
  kind: string | null | undefined,
): boolean {
  if (state === null || state === undefined || typeof kind !== 'string') return false;
  if (state.session?.fault?.kind === kind && state.session.fault.coreNotRunning === true) return true;
  return state.faults.active.some((fault) => fault.kind === kind && fault.coreNotRunning === true);
}
