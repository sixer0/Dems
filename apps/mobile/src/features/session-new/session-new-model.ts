/**
 * Start New Session: the pure rules of the three-step flow (04_mobile_specs §4.4, §1.3, §3.7;
 * research 01 §5.3; 01_specs §14.5.11). No React, no simulator instance: every function takes
 * plain values, so the precheck test (T-M10) and the screen share one set of rules.
 */
import type { SessionState } from '@dems/shared/domain';
import {
  HOST_CLOCK_PRECHECK_VALUE,
  PRECHECK_ORDER,
  isPrecheckNote,
  roleHas,
  type PrecheckCheckId,
  type PrecheckItem,
  type PrecheckSlice,
  type RecordingProfileId,
  type SessionHistoryEntry,
  type SimOperator,
  type SubjectType,
} from '@dems/shared/sim';
import type { StatusTone } from '@dems/shared/tokens';
import type { StepStatus } from '@/components/composed/stepper';
import type { LayoutClass } from '@/layout';

export type WizardStep = 1 | 2 | 3;

/** The three step keys, in order (labels: `sessionNew.steps.*`). */
export const WIZARD_STEPS = ['info', 'devices', 'ready'] as const;

/** Session states the wizard itself owns (CREATE → PRECHECK → ARMED; §1.3 rows 3–6). */
export function isWizardState(state: SessionState | null): boolean {
  return state === 'CREATE' || state === 'PRECHECK' || state === 'ARMED';
}

/**
 * The step to show. The simulator state is the source of truth (§3.7: the route follows the
 * state), the `?step=` param only chooses within what the state allows:
 *
 * | state | steps allowed | why |
 * |---|---|---|
 * | none, SEALED | 1 | nothing created yet (a SEALED session is not active, S26) |
 * | CREATE | 1 | created but not checked: the form, prefilled |
 * | PRECHECK | 2 | the gate is running or waits for a decision |
 * | ARMED | 2 or 3 | 3 by default; 2 to review the checks (Stepper back-press) |
 *
 * Busy states (RECORDING and later) never reach the screen: the route redirects them (§3.5).
 */
export function effectiveStep(state: SessionState | null, requested: number): WizardStep {
  switch (state) {
    case 'PRECHECK':
      return 2;
    case 'ARMED':
      return requested === 2 ? 2 : 3;
    default:
      return 1;
  }
}

// ---------------------------------------------------------------------------------------------
// Step 1: the form
// ---------------------------------------------------------------------------------------------

/** Operators who may run a session as its investigator (the simulator's SESSION_START rule). */
export function eligibleInvestigators(operators: readonly SimOperator[]): SimOperator[] {
  return operators.filter((operator) => roleHas(operator.role, 'SESSION_START'));
}

/**
 * Investigator default (MB 3; 04 §4.4 "Defaults to the signed-in operator"): the signed-in
 * operator when eligible, else the first eligible operator, else empty (the form stays invalid).
 */
export function defaultInvestigatorId(operators: readonly SimOperator[], signedInId: string | null): string {
  const eligible = eligibleInvestigators(operators);
  return eligible.find((operator) => operator.id === signedInId)?.id ?? eligible[0]?.id ?? '';
}

/** Filters the investigator list by a search term (name, rank or operator id; case-insensitive). */
export function filterInvestigators(operators: readonly SimOperator[], query: string): SimOperator[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [...operators];
  return operators.filter(
    (operator) => operator.displayName.toLowerCase().includes(needle) || operator.id.toLowerCase().includes(needle),
  );
}

/** The values "Start with last profile" copies (a follow-up interview of the same case). */
export interface LastProfileValues {
  caseNumber: string;
  investigatorId: string;
  room: string;
  profileId: RecordingProfileId;
}

/** Copies case, investigator, room and profile; subject, subject type and notes stay empty. */
export function lastProfileValues(entry: SessionHistoryEntry, operators: readonly SimOperator[]): LastProfileValues {
  const eligible = eligibleInvestigators(operators);
  return {
    caseNumber: entry.caseNumber,
    investigatorId: eligible.some((operator) => operator.id === entry.investigatorId) ? entry.investigatorId : (eligible[0]?.id ?? ''),
    room: entry.room,
    profileId: entry.profileId,
  };
}

/** The newest session of the history (by end time), or null. */
export function newestHistoryEntry(history: readonly SessionHistoryEntry[]): SessionHistoryEntry | null {
  let newest: SessionHistoryEntry | null = null;
  for (const entry of history) if (newest === null || entry.endedAt > newest.endedAt) newest = entry;
  return newest;
}

/** The subject-type tags in MB 3 order. */
export const SUBJECT_TYPE_ORDER = ['TERSANGKA', 'SAKSI', 'LAINNYA'] as const satisfies readonly SubjectType[];

// ---------------------------------------------------------------------------------------------
// Step 2: the §5.3 gate
// ---------------------------------------------------------------------------------------------

/** How the gate stands, from the simulator's precheck slice and session state. */
export type GatePhase = 'idle' | 'running' | 'pass' | 'warn' | 'block';

export function gatePhase(precheck: PrecheckSlice | null): GatePhase {
  if (precheck === null || precheck.startedAt === null) return 'idle';
  switch (precheck.outcome) {
    case 'PASS':
      return 'pass';
    case 'WARN':
      return 'warn';
    case 'BLOCK':
      return 'block';
    default:
      return 'running';
  }
}

/**
 * Whether Next may leave step 2 (01S §14.5.11 policy, demo G8): never while running or on BLOCK;
 * on WARN only once "Acknowledge warnings" is ticked, or once the simulator is already ARMED
 * (the warnings were acknowledged earlier, for example before a relaunch).
 */
export function canLeaveGate(phase: GatePhase, acknowledged: boolean, state: SessionState | null): boolean {
  if (state === 'ARMED') return true;
  if (phase === 'pass') return true;
  return phase === 'warn' && acknowledged;
}

/** Resolved checks (PASS, WARN or BLOCK) out of the eight. */
export function resolvedCount(items: readonly PrecheckItem[]): number {
  return items.filter((item) => item.status === 'PASS' || item.status === 'WARN' || item.status === 'BLOCK').length;
}

/**
 * A pre-check NOTE (wave H closing pass Z2; closing pass Z1's line of 10:30:00Z, ruling D203 (1)): an
 * item at WARN level that states a fact of the installation and asks nothing of the operator - today
 * the TIME item of a Core in its own capture, the host system clock (`isPrecheckNote`).
 */
export function precheckNoteOf(item: Pick<PrecheckItem, 'status' | 'params'> | null | undefined): boolean {
  return item !== null && item !== undefined && isPrecheckNote(item);
}

/** The items at `status`. A NOTE is no warning: it is never among the WARN items to list, count or acknowledge. */
export function itemsWith(items: readonly PrecheckItem[], status: 'WARN' | 'BLOCK'): PrecheckItem[] {
  return items.filter((item) => item.status === status && !(status === 'WARN' && precheckNoteOf(item)));
}

/** True for the live value of the host-clock TIME item (`evaluatePrecheck` of a Core in its own capture); the encoded live row keeps no `params`. */
export function hostClockValue(id: PrecheckCheckId, value: string): boolean {
  return id === 'TIME' && value === HOST_CLOCK_PRECHECK_VALUE;
}

/** Tone of a per-check result chip. `note`: the item is a NOTE (`precheckNoteOf`) - informative, not a warning. */
export function precheckTone(status: PrecheckItem['status'], note = false): StatusTone {
  if (note) return 'info';
  switch (status) {
    case 'PASS':
      return 'success';
    case 'WARN':
      return 'warning';
    case 'BLOCK':
      return 'danger';
    default:
      return 'default';
  }
}

/**
 * The i18n key of a check's live value (`common.enums.*`), keyed by the simulator value. Unknown
 * values fall back to the raw value through `defaultValue` at the call site.
 */
export function valueKey(id: PrecheckCheckId, value: string): string {
  switch (id) {
    case 'CORE':
      return `common.enums.coreLinkState.${value}`;
    case 'LENS_1':
    case 'LENS_2':
      return `common.enums.lensState.${value}`;
    case 'MIC_1':
    case 'MIC_2':
    case 'MIC_PRIMARY':
    case 'MIC_STANDBY':
      return `common.enums.micState.${value}`;
    case 'STORAGE':
      return `common.enums.storageState.${value}`;
    case 'TIME':
      // Wave H closing pass Z2: the value of the host-clock note is no member of the time-source enumeration.
      return value === HOST_CLOCK_PRECHECK_VALUE ? 'session.captureFacts.timeSource.hostClock' : `common.enums.timeSource.${value}`;
    case 'SECURITY':
      return `common.enums.securityState.${value}`;
    default:
      return `common.enums.lensState.${value}`;
  }
}

// ---------------------------------------------------------------------------------------------
// Selector mapping of the microphone checks (task 3 row 68; register MB-02; ux §2, §8)
// ---------------------------------------------------------------------------------------------

/** The microphone input a channel-keyed check stands for (`MIC_1` = `MIC-01`, `MIC_2` = `MIC-02`). */
const CHECK_MIC_INPUT: Readonly<Partial<Record<PrecheckCheckId, string>>> = { MIC_1: 'MIC-01', MIC_2: 'MIC-02' };
/** The role a role-keyed check stands for. */
const CHECK_MIC_ROLE: Readonly<Partial<Record<PrecheckCheckId, 'PRIMARY' | 'STANDBY'>>> = { MIC_PRIMARY: 'PRIMARY', MIC_STANDBY: 'STANDBY' };

/**
 * Flat encoding of the selector's microphone lines for `useSim` (F74-13): `MIC-01:PRIMARY|MIC-02:STANDBY`.
 * The lines are the open session's own snapshot when it holds one (the selector may not change under
 * a session, OD-10), else the Core's current selector.
 */
export function micRoleLine(state: { session: { captureConfig?: { mics: readonly { inputId: string; role: string }[] } | null } | null; captureConfig: { mics: readonly { inputId: string; role: string }[] } }): string {
  const mics = state.session?.captureConfig?.mics ?? state.captureConfig.mics;
  return mics.map((mic) => `${mic.inputId}:${mic.role}`).join('|');
}

export interface CheckMicBinding {
  /** The role the checked input holds in the selector. */
  readonly role: 'PRIMARY' | 'STANDBY';
  /** The input that holds it (`MIC-01`, `MIC-02`). */
  readonly inputId: string;
}

/**
 * Which selector line a microphone check is about, or null for any other check and for a selector
 * that does not hold the line (an empty selector before the first snapshot). `MIC_1`/`MIC_2` are
 * looked up by input, `MIC_PRIMARY`/`MIC_STANDBY` by role, so the row reads the same whichever pair
 * the Core sends.
 */
export function checkMicBinding(id: PrecheckCheckId, roleLine: string): CheckMicBinding | null {
  const lines = roleLine
    .split('|')
    .map((part) => part.split(':'))
    .filter((parts): parts is [string, string] => parts.length === 2 && (parts[1] === 'PRIMARY' || parts[1] === 'STANDBY'));
  const input = CHECK_MIC_INPUT[id];
  const role = CHECK_MIC_ROLE[id];
  const found = input !== undefined ? lines.find(([inputId]) => inputId === input) : role !== undefined ? lines.find(([, held]) => held === role) : undefined;
  return found ? { inputId: found[0], role: found[1] as 'PRIMARY' | 'STANDBY' } : null;
}

/** The eight checks in the book's order (§5.3), for rows that have not been created yet. */
export const CHECK_ORDER: readonly PrecheckCheckId[] = PRECHECK_ORDER;

/**
 * Flat encoding of a live device evaluation for `useSim` (F74-13: selectors return primitives or
 * stable references; an array of strings compares shallowly). `"PASS|ONLINE"` → parts.
 */
export function encodeEvaluation(status: string, value: string): string {
  return `${status}|${value}`;
}

export function decodeEvaluation(encoded: string): { status: 'PASS' | 'WARN' | 'BLOCK'; value: string } {
  const [status, value = ''] = encoded.split('|');
  return { status: status === 'WARN' || status === 'BLOCK' ? status : 'PASS', value };
}

// ---------------------------------------------------------------------------------------------
// Stepper and layout
// ---------------------------------------------------------------------------------------------

/**
 * C-4 statuses: step 1 done once past it; step 2 running while the gate runs, `error` on BLOCK,
 * `warn` on an unacknowledged WARN, done on step 3; step 3 active on step 3.
 */
export function stepperStatuses(current: WizardStep, phase: GatePhase, state: SessionState | null): StepStatus[] {
  const first: StepStatus = current === 1 ? 'active' : 'done';
  let second: StepStatus = 'pending';
  if (current === 3) second = 'done';
  else if (current === 2) {
    if (phase === 'running' || phase === 'idle') second = 'running';
    else if (phase === 'block') second = 'error';
    else if (phase === 'warn' && state !== 'ARMED') second = 'warn';
    else second = 'active';
  }
  const third: StepStatus = current === 3 ? 'active' : 'pending';
  return [first, second, third];
}

/** 04 §2.4 "Start Session" row, one arrangement per layout class. */
export type SessionNewArrangement = 'phone' | 'phone-landscape' | 'tablet-portrait' | 'tablet-landscape';

export function arrangementFor(layoutClass: LayoutClass): SessionNewArrangement {
  switch (layoutClass) {
    case 'compact-landscape':
      return 'phone-landscape';
    case 'medium':
      return 'tablet-portrait';
    case 'expanded':
      return 'tablet-landscape';
    default:
      return 'phone';
  }
}

/** Horizontal stepper on phones (MB 3), vertical 240 dp column on tablets (§2.4). */
export function stepperOrientation(arrangement: SessionNewArrangement): 'horizontal' | 'vertical' {
  return arrangement === 'tablet-portrait' || arrangement === 'tablet-landscape' ? 'vertical' : 'horizontal';
}

/** Tablet landscape keeps the live device column (previews, meters, live check list) on every step. */
export function hasDeviceColumn(arrangement: SessionNewArrangement): boolean {
  return arrangement === 'tablet-landscape';
}

// ---------------------------------------------------------------------------------------------
// Step 3: the 3-2-1 countdown (03M M-PG-NEW: each digit 1 s apart)
// ---------------------------------------------------------------------------------------------

export const COUNTDOWN_FROM = 3;
export const COUNTDOWN_STEP_MS = 1_000;
/** Each digit rack-focuses in and scales 1.1 → 1 over 600 ms (03M M-PG-NEW). */
export const COUNTDOWN_DIGIT_MS = 600;
