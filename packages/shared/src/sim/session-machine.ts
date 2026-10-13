/**
 * Session state machine (masterplan/01_specs.md §14.7 transition table; book §6.2;
 * FAULT and RECOVERY are demo assumptions, 01 G4).
 *
 * `session === null` means IDLE. Every transition is a pure function `(state, …) → state`:
 * the action layer applies it with one `setState`, the engine subsystem advances the timed
 * transitions (precheck checks, STOPPING, finalization steps, recovery), and the scenarios
 * reuse the same functions to build their starting states. Disallowed transitions throw
 * `SimTransitionError` (AC-52).
 *
 * Timed transitions happen at their **scheduled** time, not at the tick that notices them, so
 * a catch-up after a hidden period gives the same timestamps as a live run (the Core kept
 * running while the page or app was hidden). Audit and event rows go through
 * `recordActivity`, which keeps them in time order.
 */
import { AuditEventKind, FINALIZATION_STEPS_V2, SessionState, type FinalizationStep, type TimeSource } from '../domain';
import { DEFAULT_SESSION_ROOM, sessionCreateSchema } from '../api/session-schema';
import { findOperatorById, requirePermission, roleHas } from './auth';
import { captureMicLines, channelOfMicLine, micInputOfRole } from './audio';
import { selectorInForce, selectorOfSession } from './selector-in-force';
import {
  CAPTURE_SOURCE_NOT_ASSIGNED_REASON,
  CAPTURE_START_REQUIRED_SLOTS,
  CaptureStartRule,
  SOURCE_NOT_ASSIGNED_PRECHECK_VALUE,
  captureReachabilityOf,
  unassignedSlotsOf,
} from './capture-notices';
import { advanceCaptureEnd, advanceCaptureStart, endCaptureFaultAtSeal } from './capture-session';
import { CORE_NOT_RUNNING_LABEL, CORE_NOT_RUNNING_RESTART_SENTENCE } from './core-not-running';
import { HOST_CLOCK_PRECHECK_REASON, HOST_CLOCK_PRECHECK_RULE, HOST_CLOCK_PRECHECK_VALUE, SECURITY_NOT_REPORTED_PRECHECK_REASON, SECURITY_NOT_REPORTED_PRECHECK_RULE, SECURITY_NOT_REPORTED_PRECHECK_VALUE, isHostClockTime, isOwnCaptureCoreState, isPlatformNotReported, isPrecheckNote } from './core-facts';
import {
  ALERT_RING_SIZE,
  FINALIZATION_STEP_MAX_MS,
  FINALIZATION_STEP_MIN_MS,
  PRECHECK_CHECK_MAX_MS,
  PRECHECK_CHECK_MIN_MS,
  PRECHECK_TOTAL_MAX_MS,
  RECOVERY_MS,
  RECOVERY_SCAN_MS,
  SEALING_FIRST_ATTEMPT,
  STOPPING_MS,
  STOP_REASON_MIN_LENGTH,
  TIMELINE_MAX,
} from './constants';
import {
  caseNumberFor,
  DEVICE_ID,
  DEVICE_NAME,
  evidenceIdFor,
  PRODUCT_NAME,
  RECORDING_PROFILES,
  recordingBytes,
  sessionIdFor,
} from './dataset';
import { deriveDeviceState } from './derive';
// Seal block (fix pass F-M7b): the terminal UNSEALABLE outcome.
import { SEAL_UNSEALABLE_CAUSE_CODE, SEAL_UNSEALABLE_REASON, unsealableSentence } from './seal-unsealable';
import { SimErrorCode, SimNotFoundError, SimTransitionError } from './errors';
import { nextItemId, pushRing, recordActivity, type ActivityInput } from './events';
import { createEvidenceItem, EVIDENCE_STATUS_STAGE } from './evidence';
import { RngStream, type Rng, type RngStreams } from './rng';
import { cutText } from './text-cut';
import type {
  ActiveSession,
  CaptureLevelSource,
  CaptureMicInputId,
  CaptureSelectorSlot,
  CreateSessionResult,
  EpochMs,
  CustodyEntry,
  EvidenceItem,
  EvidenceMarker,
  EvidenceSignature,
  EvidenceTranscriptSummary,
  FinalizationStepState,
  PrecheckItem,
  PrecheckSlice,
  SessionCreateInput,
  SessionHistoryEntry,
  SessionNote,
  SimAlert,
  SimState,
  TimelineEvent,
} from './types';
import {
  AuthStatus,
  CRITICAL_FAULTS,
  FaultEvt,
  FaultKind,
  IntegritySource,
  OperatorRole,
  Permission,
  PRECHECK_ORDER,
  PrecheckReasonCode,
  SessionOutcome,
  SubjectType,
  type PrecheckCheckId,
  type PrecheckStatus,
} from './vocabulary';

/** `details.reason` of a stop refused while the cameras connect: the contract's `CAPTURE_NOT_DURABLE_REASON` (`api/sessions.ts`), by value. */
const CAPTURE_NOT_DURABLE_REASON = 'CAPTURE_NOT_DURABLE';

// ── State groups ─────────────────────────────────────────────────────────────────────────

/** States in which a critical fault moves the session to FAULT (§14.7; STOPPING added, S32-4). */
export const FAULTABLE_STATES: readonly SessionState[] = [
  SessionState.PRECHECK,
  SessionState.ARMED,
  SessionState.RECORDING,
  SessionState.STOPPING,
  SessionState.FINALIZING,
];
/** States `cancel()` accepts. */
export const CANCELLABLE_STATES: readonly SessionState[] = [
  SessionState.CREATE,
  SessionState.PRECHECK,
  SessionState.ARMED,
];
/** States with people in the room: the audio model plays the conversation. */
export const SPEECH_STATES: readonly SessionState[] = [
  SessionState.CREATE,
  SessionState.PRECHECK,
  SessionState.ARMED,
  SessionState.RECORDING,
  SessionState.STOPPING,
];
/**
 * The sealing steps the simulator runs, in pipeline order. Schema v2 (register SH-01): the six
 * normal-path steps of `domain/enums.ts` `FINALIZATION_STEPS_V2` (`CLOSE_TRACKS` ..
 * `STORE_SEALED_PACKAGE`). The v1 names (`FINALIZE_TRACKS`, `CALCULATE_HASHES`) and the v1
 * `ENCRYPT_PAYLOAD` step are gone: v2 encrypts inside `CLOSE_TRACKS` (the Core seals at seal time,
 * ruling D147 - never while recording), and the two fallback-only steps
 * (OD-21) never appear in this order. The per-step progress/ETA fields are SH-06 (row 51).
 */
export const FINALIZATION_ORDER = FINALIZATION_STEPS_V2;

/** A session that is not SEALED blocks `createSession` (S26). */
export function isSessionActive(session: ActiveSession | null): session is ActiveSession {
  return session !== null && session.state !== SessionState.SEALED;
}

export function isCriticalFault(kind: FaultKind): boolean {
  return (CRITICAL_FAULTS as readonly FaultKind[]).includes(kind);
}

/** The signed-in operator's ID, or null. */
export function signedInOperatorId(state: Pick<SimState, 'auth'>): string | null {
  return state.auth.status === AuthStatus.SIGNED_IN ? state.auth.operatorId : null;
}

/**
 * The session commands (beginPrecheck, acknowledgePrecheckWarnings, retryPrecheck, startRecording,
 * stopRecording, cancel) need a signed-in operator with SESSION_START (step 54, review 40 M5). The
 * returned ID is the audit actor: never the session creator standing in for someone else.
 */
export function requireSessionOperator(state: Pick<SimState, 'auth' | 'operators'>, action: string): string {
  return requirePermission(state, action, Permission.SESSION_START).id;
}

// ── Small helpers ────────────────────────────────────────────────────────────────────────

function record(state: SimState, t: EpochMs, items: ActivityInput | readonly ActivityInput[]): SimState {
  return { ...state, ...recordActivity(state, t, items) };
}

function requireSession(state: SimState, event: string, allowed: readonly SessionState[]): ActiveSession {
  const session = state.session;
  if (!session || !allowed.includes(session.state)) {
    throw new SimTransitionError(session?.state ?? null, event);
  }
  return session;
}

function withSession(state: SimState, session: ActiveSession | null): SimState {
  return deriveDeviceState({ ...state, session });
}

/**
 * Sets the session's final `bytesWritten` and grows the evidence volume by the bytes the 1 Hz
 * health tick has not counted yet, so the volume and the evidence size always agree.
 */
function settleBytes(state: SimState, session: ActiveSession, bytesWritten: number): { state: SimState; session: ActiveSession } {
  const delta = bytesWritten - session.bytesWritten;
  if (delta <= 0) return { state, session };
  return {
    session: { ...session, bytesWritten },
    state: {
      ...state,
      storage: {
        ...state.storage,
        volumes: state.storage.volumes.map((volume) =>
          volume.kind === 'EVIDENCE' ? { ...volume, usedBytes: Math.min(volume.totalBytes, volume.usedBytes + delta) } : volume,
        ),
      },
    },
  };
}

/** Appends one item to the current session's timeline (at most 200 kept). */
export function addTimelineItem(state: SimState, item: Omit<TimelineEvent, 'id'>): SimState {
  const session = state.session;
  if (!session) return state;
  const { id, meta } = nextItemId(state.meta, 'TL');
  return {
    ...state,
    meta,
    session: { ...session, timeline: pushRing(session.timeline, [{ id, ...item }], TIMELINE_MAX) },
  };
}

/** When the session timeline last got an item of `kind` (null if never). */
export function lastTimelineAt(session: ActiveSession, kind: TimelineEvent['kind']): EpochMs | null {
  for (let i = session.timeline.length - 1; i >= 0; i -= 1) {
    const item = session.timeline[i];
    if (item?.kind === kind) return item.at;
  }
  return null;
}

// ── createSession (S26: idempotent; §5.6: a resync never creates a second session) ──────

/** Trims text fields and fills defaults (room: Interview Room 1; notes: empty). */
export function normalizeSessionInput(input: SessionCreateInput): Required<SessionCreateInput> {
  // Tolerates a missing or malformed body (the simulated API passes request JSON straight in).
  const source: Partial<SessionCreateInput> = typeof input === 'object' && input !== null ? input : {};
  const text = (value: unknown) => (typeof value === 'string' ? value : '').trim().replace(/\s+/g, ' ');
  return {
    caseNumber: text(source.caseNumber),
    subjectType: source.subjectType as SubjectType,
    subjectName: text(source.subjectName),
    investigatorId: text(source.investigatorId),
    room: text(source.room) || DEVICE_NAME,
    profileId: source.profileId as SessionCreateInput['profileId'],
    notes: typeof source.notes === 'string' ? source.notes.trim() : '',
  };
}

export type SessionInputValidation =
  | { ok: true; value: Required<SessionCreateInput> }
  | { ok: false; path: string; message: string };

/**
 * Validates a create body with the shared `sessionCreateSchema` (D62, step 54; review 40 M6), so
 * the UI, the action and the simulated API accept exactly what the OpenAPI document describes.
 * `message` is the first issue's i18n key, `path` its dotted field path.
 */
export function validateSessionInput(raw: unknown): SessionInputValidation {
  const parsed = sessionCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, path: issue?.path.map(String).join('.') || 'body', message: issue?.message ?? 'invalid' };
  }
  return { ok: true, value: normalizeSessionInput(parsed.data as SessionCreateInput) };
}

/**
 * Server-side checks a static schema cannot make: the investigator exists and holds SESSION_START
 * (plus the step-31 bounds, kept as a second line of defence).
 */
export function isValidSessionInput(state: Pick<SimState, 'operators'>, input: Required<SessionCreateInput>): boolean {
  const investigator = findOperatorById(state.operators, input.investigatorId);
  return (
    input.caseNumber.length > 0 &&
    input.caseNumber.length <= 64 &&
    input.subjectName.length > 0 &&
    input.subjectName.length <= 120 &&
    (Object.values(SubjectType) as string[]).includes(input.subjectType) &&
    investigator !== null &&
    roleHas(investigator.role, Permission.SESSION_START) &&
    input.room.length > 0 &&
    input.room.length <= 80 &&
    RECORDING_PROFILES.some((profile) => profile.id === input.profileId) &&
    input.notes.length <= 2_000
  );
}

function sameInput(a: Required<SessionCreateInput>, b: Required<SessionCreateInput>): boolean {
  return (
    a.caseNumber === b.caseNumber &&
    a.subjectType === b.subjectType &&
    a.subjectName === b.subjectName &&
    a.investigatorId === b.investigatorId &&
    a.room === b.room &&
    a.profileId === b.profileId
  );
}

function emptyPrecheck(): PrecheckSlice {
  return {
    items: PRECHECK_ORDER.map((id) => ({ id, status: 'PENDING', value: null, reason: null, reasonCode: null, resolvesAt: null })),
    startedAt: null,
    completedAt: null,
    outcome: null,
    warningsAcknowledged: false,
  };
}

function emptyFinalization(): ActiveSession['finalization'] {
  return {
    steps: FINALIZATION_ORDER.map((id) => ({ id, status: 'pending', startedAt: null, completedAt: null, durationMs: null })),
    startedAt: null,
    completedAt: null,
  };
}

/**
 * Opens a session with no auth checks (used by `createSessionTransition` after its checks,
 * and by the scenarios). Audit SESSION_CREATED.
 */
export function openSession(
  state: SimState,
  at: EpochMs,
  input: Required<SessionCreateInput>,
  actorId: string | null,
): SimState {
  const seq = state.meta.counters.session;
  const id = sessionIdFor(seq, at);
  const session: ActiveSession = {
    id,
    state: SessionState.CREATE,
    input,
    createdAt: at,
    createdBy: actorId,
    precheck: emptyPrecheck(),
    armedAt: null,
    startedAt: null,
    stoppedAt: null,
    stopReason: null,
    sealedAt: null,
    finalization: emptyFinalization(),
    timeline: [],
    notes: [],
    markerCount: 0,
    snapshotCount: 0,
    bytesWritten: 0,
    fault: null,
    recovery: null,
    evidenceId: null,
  };
  const next: SimState = {
    ...state,
    meta: { ...state.meta, counters: { ...state.meta.counters, session: seq + 1 } },
    session,
    // A new session implicitly acknowledges a pending summary (SCR-02; route-sync follows the new state).
    lastSealedAcknowledged: true,
  };
  return withSession(
    record(next, at, {
      audit: {
        type: 'SESSION_CREATED',
        message: `Session ${id} created`,
        actorId,
        ...sentFrom(sendingDeviceOf(state, false)),
        sessionId: id,
        details: { caseNumber: input.caseNumber, subjectType: input.subjectType },
      },
      event: { type: 'SESSION_CREATED', message: `Session ${id} created`, sessionId: id },
    }),
    session,
  );
}

export interface CreateSessionOptions {
  /**
   * Fill a missing `room` with the device's room before validating (step-31 behaviour kept for
   * existing callers of `actions.createSession`). The simulated API passes false: its body must
   * match the documented schema exactly (D62).
   */
  defaultRoom?: boolean;
}

/** `LP/{YYYY}/{MMDD}-NNNN` → its sequence when the prefix is today's (sim clock), else null. */
function todaysCaseSeq(caseNumber: string, now: EpochMs): number | null {
  const prefix = caseNumberFor(0, now).slice(0, -4);
  if (!caseNumber.startsWith(prefix)) return null;
  const seq = Number(caseNumber.slice(prefix.length));
  return Number.isInteger(seq) ? seq : null;
}

/**
 * Order (step 54, review 40 §5.d): sign-in (NOT_SIGNED_IN) → SESSION_START (NOT_PERMITTED) → the
 * shared schema (INVALID_INPUT) → an active session (same input: the existing session, S26; other
 * input: SESSION_ACTIVE) → the investigator check (INVALID_INPUT) → created. A created case number
 * at or past the scanner's next number advances it (SIM-GAP-W46-1).
 */
export function createSessionTransition(
  state: SimState,
  now: EpochMs,
  rawInput: SessionCreateInput,
  options: CreateSessionOptions = {},
): { state: SimState; result: CreateSessionResult } {
  const operator = findOperatorById(state.operators, signedInOperatorId(state));
  if (!operator) return { state, result: { ok: false, reason: 'NOT_SIGNED_IN', sessionId: null } };
  if (!roleHas(operator.role, Permission.SESSION_START)) {
    return { state, result: { ok: false, reason: 'NOT_PERMITTED', sessionId: null } };
  }
  const body: unknown =
    (options.defaultRoom ?? true) && typeof rawInput === 'object' && rawInput !== null && rawInput.room === undefined
      ? { ...rawInput, room: DEFAULT_SESSION_ROOM }
      : rawInput;
  const validation = validateSessionInput(body);
  if (!validation.ok) {
    return {
      state,
      result: { ok: false, reason: 'INVALID_INPUT', sessionId: isSessionActive(state.session) ? state.session.id : null },
    };
  }
  const input = validation.value;
  if (isSessionActive(state.session)) {
    // Same input: the retry of a create that already happened returns that session (S26, §5.6).
    if (sameInput(state.session.input, input)) {
      return { state, result: { ok: true, sessionId: state.session.id, created: false } };
    }
    return { state, result: { ok: false, reason: 'SESSION_ACTIVE', sessionId: state.session.id } };
  }
  if (!isValidSessionInput(state, input)) {
    return { state, result: { ok: false, reason: 'INVALID_INPUT', sessionId: null } };
  }
  let next = openSession(state, now, input, operator.id);
  const caseSeq = todaysCaseSeq(input.caseNumber, now);
  if (caseSeq !== null && caseSeq >= next.meta.counters.caseNumber) {
    next = { ...next, meta: { ...next.meta, counters: { ...next.meta.counters, caseNumber: caseSeq + 1 } } };
  }
  return { state: next, result: { ok: true, sessionId: next.session?.id ?? '', created: true } };
}

/**
 * The simulated case-number scanner (step 54, SIM-GAP-W46-1 / M78-1): the next case number on the
 * sim clock's day, reserved (the counter advances). Needs SESSION_START.
 */
export function scanCaseNumberTransition(state: SimState, now: EpochMs): { state: SimState; result: string } {
  requireSessionOperator(state, 'scanCaseNumber');
  const seq = state.meta.counters.caseNumber;
  return {
    result: caseNumberFor(seq, now),
    state: { ...state, meta: { ...state.meta, counters: { ...state.meta.counters, caseNumber: seq + 1 } } },
  };
}

// ── PRECHECK (§5.3 gate; policy 01_specs §14.5.11, demo G8) ─────────────────────────────

/** 8 seeded durations of 300-700 ms each, budgeted so the whole gate takes ≤ 4.9 s. */
export function drawPrecheckDurations(rng: Rng, count: number = PRECHECK_ORDER.length): number[] {
  let budget = PRECHECK_TOTAL_MAX_MS;
  const durations: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const reserve = (count - 1 - index) * PRECHECK_CHECK_MIN_MS;
    const high = Math.max(PRECHECK_CHECK_MIN_MS, Math.min(PRECHECK_CHECK_MAX_MS, budget - reserve));
    const duration = rng.int(PRECHECK_CHECK_MIN_MS, high);
    durations.push(duration);
    budget -= duration;
  }
  return durations;
}

export interface PrecheckEvaluation {
  status: Extract<PrecheckStatus, 'PASS' | 'WARN' | 'BLOCK'>;
  /** The live device state shown as the description. */
  value: string;
  reason: string | null;
  /** Machine-readable reason (step 54, SIM-GAP-W46-2); null on PASS. */
  reasonCode: PrecheckReasonCode | null;
  /** Values for the reason copy (`{track}`, `{source}`). */
  params: Readonly<Record<string, string>>;
}

const PASSED = { reason: null, reasonCode: null, params: {} } as const;

/**
 * The check result of a configured source that does not answer, or null when it does (task 3 row
 * 133; C3 §3.1; D80(6), D83). `slot` is a video track or a mic role. The start rule itself is
 * `captureReachabilityOf`. No reason code of the closed set fits, so `reasonCode` is null and the
 * row is read from `value: 'UNREACHABLE'` and `params`: `deviceId`, `deviceKind`, `rule` (the
 * suffix of the text key `captureNotice.start.*`) and, for the active microphone, `other`.
 */
function unreachableSource(state: SimState, slot: string): PrecheckEvaluation | null {
  const source = captureReachabilityOf(state).find((row) => row.slot === slot);
  if (source === undefined || source.reachable || source.rule === null || source.status === 'PASS') return null;
  return {
    status: source.status,
    value: 'UNREACHABLE',
    reason: `${source.deviceId} is not reachable`,
    reasonCode: null,
    params: { deviceId: source.deviceId, deviceKind: source.deviceKind, rule: source.rule, ...(source.otherDeviceId === null ? {} : { other: source.otherDeviceId }) },
  };
}

/**
 * The check result of a selector slot that holds NO source, or null (task 4 row 163, WP-13a;
 * decisions C18 (1), C21 (6), C25; names register 5.2; sites C4, C5 of row 27).
 *
 * Only in a state of REAL capture (`isOwnCaptureCoreState`: the one reader of "is this a Core in
 * its own capture"): there the slot's item is BLOCK "source not assigned" - for each of the four
 * slots, the STANDBY too (`CAPTURE_START_REQUIRED_SLOTS`, C25) - where it was PASS READY for a
 * video slot and an acknowledgeable WARN NO_SIGNAL for a microphone role. In Simulated mode and in
 * the in-app simulator the answer is null and the item is computed as before (C21 (6)).
 *
 * The slot is found by its track or its role in the selector in force. The item carries no
 * `deviceId` and no `deviceKind`: there is no device. No reason code of the closed set fits, so
 * `reasonCode` is null and the row is read from `value` and `params.rule` / `params.slot`
 * (`unassignedSlotOfPrecheckItem`).
 */
function unassignedSource(state: SimState, slot: CaptureSelectorSlot): PrecheckEvaluation | null {
  if (!isOwnCaptureCoreState(state)) return null;
  if (!unassignedSlotsOf(selectorInForce(state)).includes(slot)) return null;
  return {
    status: CAPTURE_START_REQUIRED_SLOTS.includes(slot) ? 'BLOCK' : 'WARN',
    value: SOURCE_NOT_ASSIGNED_PRECHECK_VALUE,
    reason: `${slot}: source not assigned`,
    reasonCode: null,
    params: { rule: CaptureStartRule.SOURCE_NOT_ASSIGNED, slot },
  };
}

/**
 * One gate check against the live device state:
 * - BLOCK: Core OFFLINE (the tablet link is the Core link, MA-10), lens FAULT, storage FULL,
 *   security FAULT.
 * - WARN: MIC NO SIGNAL or CLIP, storage LOW, time on RTC, enclosure tamper (S32-5).
 * - PASS otherwise. Time on NTP passes and shows its source (informational, §5.3).
 */
export function evaluatePrecheck(state: SimState, id: PrecheckCheckId): PrecheckEvaluation {
  const R = PrecheckReasonCode;
  switch (id) {
    case 'CORE':
      return state.tabletLink.state === 'OFFLINE'
        ? { status: 'BLOCK', value: 'OFFLINE', reason: 'Core link offline', reasonCode: R.CORE_OFFLINE, params: {} }
        : { status: 'PASS', value: 'ONLINE', ...PASSED };
    case 'LENS_1':
    case 'LENS_2': {
      const track = id === 'LENS_1' ? 'VIDEO-01' : 'VIDEO-02';
      // Real capture only: a track without a source blocks, before every other rule of the item (C18 (1)).
      const unassigned = unassignedSource(state, track);
      if (unassigned !== null) return unassigned;
      const camera = state.cameras.find((c) => c.id === track);
      if (!camera || camera.lens === 'FAULT' || !camera.online) {
        return { status: 'BLOCK', value: 'FAULT', reason: `${camera?.name ?? id} lens fault`, reasonCode: R.LENS_FAULT, params: { track } };
      }
      // The configured capture device does not answer (row 133; D80(6)): one of two warns, both block.
      return unreachableSource(state, track) ?? { status: 'PASS', value: 'READY', ...PASSED };
    }
    case 'MIC_PRIMARY':
    case 'MIC_STANDBY': {
      // Role-keyed (D101(2)): the input that holds the role, whichever channel it is.
      const role = id === 'MIC_PRIMARY' ? 'PRIMARY' : 'STANDBY';
      // Real capture only: a role without a source blocks - the STANDBY too (C25) - before every other rule of the item.
      const unassigned = unassignedSource(state, role);
      if (unassigned !== null) return unassigned;
      // An unreachable PRIMARY blocks, an unreachable STANDBY warns (D83: no switch at pre-check).
      const unreachable = unreachableSource(state, role);
      if (unreachable !== null) return unreachable;
      const input = captureMicLines(state).find((line) => line.role === role)?.inputId ?? null;
      const track = input === null ? null : channelOfMicLine(captureMicLines(state), input);
      const mic = track === null ? undefined : state.mics.find((m) => m.id === track);
      if (!mic || track === null || mic.state === 'NO_SIGNAL') {
        return { status: 'WARN', value: 'NO_SIGNAL', reason: `${mic?.name ?? id}: no signal`, reasonCode: R.MIC_NO_SIGNAL, params: track === null ? {} : { track } };
      }
      if (mic.state === 'CLIP' || mic.clipLatched) {
        return { status: 'WARN', value: 'CLIP', reason: `${mic.name}: clipping`, reasonCode: R.MIC_CLIP, params: { track } };
      }
      return { status: 'PASS', value: 'READY', ...PASSED };
    }
    case 'MIC_1':
    case 'MIC_2': {
      const track = id === 'MIC_1' ? 'AUDIO-01' : 'AUDIO-02';
      const mic = state.mics.find((m) => m.id === track);
      if (!mic || mic.state === 'NO_SIGNAL') {
        return { status: 'WARN', value: 'NO_SIGNAL', reason: `${mic?.name ?? id}: no signal`, reasonCode: R.MIC_NO_SIGNAL, params: { track } };
      }
      if (mic.state === 'CLIP' || mic.clipLatched) {
        return { status: 'WARN', value: 'CLIP', reason: `${mic.name}: clipping`, reasonCode: R.MIC_CLIP, params: { track } };
      }
      return { status: 'PASS', value: 'READY', ...PASSED };
    }
    case 'STORAGE':
      if (state.storage.state === 'FULL') {
        return { status: 'BLOCK', value: 'FULL', reason: 'Evidence storage full', reasonCode: R.STORAGE_FULL, params: {} };
      }
      if (state.storage.state === 'LOW') {
        return { status: 'WARN', value: 'LOW', reason: 'Evidence storage low', reasonCode: R.STORAGE_LOW, params: {} };
      }
      return { status: 'PASS', value: 'READY', ...PASSED };
    case 'TIME':
      // Fix wave H Z1 (ruling D203 (1)): a Core in its own capture has the host system clock and no
      // time service. The item says so as a NOTE (`isPrecheckNote`): WARN level, no reason code of the
      // closed table, never counted as a warning and never acknowledged (`advancePrecheck`).
      if (isHostClockTime(state.time)) {
        return { status: 'WARN', value: HOST_CLOCK_PRECHECK_VALUE, reason: HOST_CLOCK_PRECHECK_REASON, reasonCode: null, params: { rule: HOST_CLOCK_PRECHECK_RULE, source: state.time.source } };
      }
      return state.time.source === 'RTC'
        ? {
            status: 'WARN',
            value: 'RTC',
            reason: 'Time from the RTC (GNSS and NTP unavailable)',
            reasonCode: R.TIME_RTC,
            params: { source: 'RTC' },
          }
        : { status: 'PASS', value: state.time.source, ...PASSED };
    case 'SECURITY':
      if (state.security.state === 'FAULT') {
        return { status: 'BLOCK', value: 'FAULT', reason: 'Critical security fault', reasonCode: R.SECURITY_FAULT, params: {} };
      }
      if (state.security.tamper) {
        return { status: 'WARN', value: 'READY', reason: 'Enclosure tamper detected', reasonCode: R.ENCLOSURE_TAMPER, params: {} };
      }
      // Fix wave J (truth rule 3c; JW-04 / JT-03): a Core in its own capture reads no TPM, no Secure Boot state and
      // computes no posture. Its SECURITY item says so as a NOTE (`isPrecheckNote`), as the host-clock TIME item does:
      // WARN level, no reason code, never counted, never acknowledged - and never "READY PASS".
      if (isPlatformNotReported(state.security)) {
        return { status: 'WARN', value: SECURITY_NOT_REPORTED_PRECHECK_VALUE, reason: SECURITY_NOT_REPORTED_PRECHECK_REASON, reasonCode: null, params: { rule: SECURITY_NOT_REPORTED_PRECHECK_RULE } };
      }
      return { status: 'PASS', value: 'READY', ...PASSED };
    default:
      return { status: 'PASS', value: 'READY', ...PASSED };
  }
}

function startPrecheck(state: SimState, session: ActiveSession, now: EpochMs, rng: RngStreams): SimState {
  const durations = drawPrecheckDurations(rng.get(RngStream.PRECHECK));
  let at = now;
  const items: PrecheckItem[] = PRECHECK_ORDER.map((id, index) => {
    at += durations[index] ?? PRECHECK_CHECK_MIN_MS;
    return { id, status: index === 0 ? 'RUNNING' : 'PENDING', value: null, reason: null, reasonCode: null, resolvesAt: at };
  });
  const next = withSession(state, {
    ...session,
    state: SessionState.PRECHECK,
    // Fix wave I (G75b-04): the paired device that sent this pre-check, for the row its outcome
    // writes later on a tick. Absent for a web console session; a retry is a new pre-check.
    precheck: { items, startedAt: now, completedAt: null, outcome: null, warningsAcknowledged: false, ...precheckSentFrom(sendingDeviceOf(state, false)) },
  });
  return record(next, now, {
    event: { type: 'PRECHECK_STARTED', message: 'Pre-recording checks started', sessionId: session.id },
  });
}

/** CREATE → PRECHECK ("sim.precheck()" in 01_specs §14.5.11 and 04 §5.6). */
export function beginPrecheckTransition(state: SimState, now: EpochMs, rng: RngStreams): SimState {
  requireSessionOperator(state, 'beginPrecheck');
  const session = requireSession(state, 'beginPrecheck', [SessionState.CREATE]);
  return startPrecheck(state, session, now, rng);
}

/** PRECHECK with a resolved BLOCK or WARN outcome → a fresh run of all 8 checks. */
export function retryPrecheckTransition(state: SimState, now: EpochMs, rng: RngStreams): SimState {
  requireSessionOperator(state, 'retryPrecheck');
  const session = requireSession(state, 'retryPrecheck', [SessionState.PRECHECK]);
  if (session.precheck.outcome === null) {
    throw new SimTransitionError(session.state, 'retryPrecheck', 'checks still running', SimErrorCode.CHECKS_RUNNING);
  }
  return startPrecheck(state, session, now, rng);
}

/**
 * PRECHECK → ARMED. `actorId` is the operator who acknowledged the warnings, or null when the
 * engine armed a clean PASS by itself: then the row names the session creator with
 * `details.by = 'system'` (step 54, review 40 §5.e item 2).
 */
function arm(state: SimState, session: ActiveSession, at: EpochMs, warnings: number, actorId: string | null): SimState {
  const next = withSession(state, { ...session, state: SessionState.ARMED, armedAt: at });
  return record(next, at, [
    {
      audit: {
        type: 'PRECHECK_PASSED',
        message: warnings > 0 ? `Pre-recording checks passed with ${warnings} acknowledged warning(s)` : 'Pre-recording checks passed',
        actorId: actorId ?? session.createdBy,
        // Fix wave I (G75b-04): acknowledged by an operator = the device of THAT command; resolved
        // by the engine = the device that sent the pre-check.
        ...sentFrom(actorId === null ? (session.precheck.sendingDeviceId ?? null) : sendingDeviceOf(state, false)),
        sessionId: session.id,
        details: { warnings, acknowledged: warnings > 0, by: actorId === null ? 'system' : 'operator' },
      },
      event: {
        type: 'PRECHECK_PASSED',
        message: 'Pre-recording checks passed',
        severity: 'SUCCESS',
        sessionId: session.id,
      },
    },
  ]);
}

/** Resolves every check whose time has come, in order; finishes the gate when all resolved. */
export function advancePrecheck(state: SimState, now: EpochMs): SimState {
  const session = state.session;
  if (!session || session.state !== SessionState.PRECHECK || session.precheck.outcome !== null) return state;
  const items = session.precheck.items.slice();
  let changed = false;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index] as PrecheckItem;
    if (item.status !== 'RUNNING' && item.status !== 'PENDING') continue;
    if (item.resolvesAt === null || item.resolvesAt > now) break;
    const result = evaluatePrecheck(state, item.id);
    items[index] = {
      ...item,
      status: result.status,
      value: result.value,
      reason: result.reason,
      reasonCode: result.reasonCode,
      params: result.params,
    };
    const following = items[index + 1];
    if (following && following.status === 'PENDING') items[index + 1] = { ...following, status: 'RUNNING' };
    changed = true;
  }
  if (!changed) return state;
  const done = items.every((item) => item.status === 'PASS' || item.status === 'WARN' || item.status === 'BLOCK');
  if (!done) return { ...state, session: { ...session, precheck: { ...session.precheck, items } } };

  const completedAt = items[items.length - 1]?.resolvesAt ?? now;
  const blocks = items.filter((item) => item.status === 'BLOCK');
  // A note (the host-clock time item, Z1) is no warning: it neither holds the gate nor is it counted.
  const warnings = items.filter((item) => item.status === 'WARN' && !isPrecheckNote(item));
  const outcome = blocks.length > 0 ? 'BLOCK' : warnings.length > 0 ? 'WARN' : 'PASS';
  const resolved: ActiveSession = {
    ...session,
    precheck: { ...session.precheck, items, completedAt, outcome },
  };
  const next = { ...state, session: resolved };
  if (outcome === 'PASS') return arm(next, resolved, completedAt, 0, null);
  // WARN: the gate waits for "Acknowledge warnings"; PRECHECK_PASSED is written then.
  if (outcome === 'WARN') return next;
  const reasons = blocks.map((item) => item.reason ?? item.id).join('; ');
  return record(next, completedAt, {
    audit: {
      type: 'PRECHECK_BLOCKED',
      message: `Pre-recording checks blocked: ${reasons}`,
      severity: 'WARNING',
      // Engine-timed (the gate resolved by itself): the creator, labelled as the system.
      actorId: session.createdBy,
      ...sentFrom(session.precheck.sendingDeviceId ?? null),
      sessionId: session.id,
      details: {
        blocks: blocks.length,
        checks: blocks.map((item) => item.id).join(','),
        reasons: blocks.map((item) => item.reasonCode ?? item.id).join(','),
        by: 'system',
      },
    },
    event: {
      type: 'PRECHECK_BLOCKED',
      message: `Start blocked: ${reasons}`,
      severity: 'CRITICAL',
      sessionId: session.id,
      params: { blocks: blocks.length },
    },
  });
}

/** PRECHECK with outcome WARN → ARMED (the "Acknowledge warnings" checkbox). */
export function acknowledgePrecheckWarningsTransition(state: SimState, now: EpochMs): SimState {
  const actorId = requireSessionOperator(state, 'acknowledgePrecheckWarnings');
  const session = requireSession(state, 'acknowledgePrecheckWarnings', [SessionState.PRECHECK]);
  if (session.precheck.outcome !== 'WARN') {
    throw new SimTransitionError(
      session.state,
      'acknowledgePrecheckWarnings',
      `outcome ${session.precheck.outcome ?? 'pending'}`,
      session.precheck.outcome === null ? SimErrorCode.CHECKS_RUNNING : SimErrorCode.NO_WARNINGS,
    );
  }
  const warnings = session.precheck.items.filter((item) => item.status === 'WARN' && !isPrecheckNote(item)).length;
  const acknowledged: ActiveSession = {
    ...session,
    precheck: { ...session.precheck, warningsAcknowledged: true },
  };
  return arm({ ...state, session: acknowledged }, acknowledged, now, warnings, actorId);
}

// ── Capture-config snapshot + audio-source state (schema v2, SH-06) ──────────────────────

/**
 * The selector as it stands right now, copied into a session at its start (SH-05/SH-06; OD-10).
 * A plain structural copy: later edits to `state.captureConfig` never reach a running session.
 * `revision` is the selector's own change stamp (`updatedAt`), the value op 78 bumps on every edit.
 */
export function captureConfigSnapshot(state: SimState): ActiveSession['captureConfig'] {
  const { cameras, mics, updatedAt } = state.captureConfig;
  return {
    cameras: cameras.map((camera) => ({ ...camera })),
    mics: mics.map((mic) => ({ ...mic })),
    revision: updatedAt,
    updatedAt,
  };
}

/**
 * The active/standby pair at recording start (SH-05/SH-06; OD-09). The PRIMARY input feeds
 * `AUDIO-01`; the STANDBY is hot. `intervalFromMs` is the media-pts origin of the first interval
 * (0 at the start of the recording — never an operator wall clock, S2 §6).
 *
 * BY ROLE, WITH NO STAND-IN (task 4 row 163; decisions C18 (2), AD-04 (2); names register 5.3;
 * site C2 of row 27): the pair is the PRIMARY line and the STANDBY line of the selector, each found
 * by its role (`micInputOfRole`). Where EITHER role has no line the selector names no pair and the
 * answer is `null`: the session then states no `audioSource` (the member is nullable and optional
 * on the wire). No line of another role, no line by its place and no built-in input stands in - a
 * lone STANDBY line is never the active input. Reached with `null` only in Simulated mode: a Core
 * in its own capture refuses the start before this is read (`startRecordingTransition`).
 */
export function audioSourceAtStart(state: SimState, sessionId: string): NonNullable<ActiveSession['audioSource']> | null {
  const mics = state.captureConfig.mics;
  // The pair of the session is the selector's pair, by role, whatever its inputs are named: any
  // registered `MIC-NN` (D133 (1), ruling D137; request of pass D1b).
  const primary = micInputOfRole(mics, 'PRIMARY');
  const standby = micInputOfRole(mics, 'STANDBY');
  if (primary === null || standby === null) return null;
  return {
    sessionId,
    activeInputId: primary,
    standbyInputId: standby,
    switchedAt: null,
    intervalFromMs: 0,
  };
}

// ── RECORDING, STOPPING, cancel ──────────────────────────────────────────────────────────

/**
 * ARMED → RECORDING. `startedAt = now`; audit RECORDING_STARTED; timeline START.
 *
 * Where the simulator runs its own capture (`capture: 'simulated'`, the default) the start is a
 * CONNECTING one, as the Core's (integration pass D10; D84, D91 R-1 option A): the session says
 * `captureDurable: false` until `advanceCaptureStart` decides it, `CAPTURE_CONNECT_MS` later
 * (durable = the member is removed: absent reads as durable, and the session is then exactly what
 * the Core stores of it).
 * With `'external'` the member is left to the Core's capture session, which writes it in the same
 * unit (`captureConnectingTransition`).
 */
export function startRecordingTransition(state: SimState, now: EpochMs, capture: CaptureLevelSource = 'simulated'): SimState {
  const actorId = requireSessionOperator(state, 'startRecording');
  const session = requireSession(state, 'startRecording', [SessionState.ARMED]);
  // THE SELECTOR MUST BE COMPLETE IN REAL CAPTURE (task 4 row 163; decisions C18 (1), C25; names
  // register 5.3; site C1 of row 27). A Core in its own capture refuses the start while any of the
  // four slots holds no source - the STANDBY too - before the audio pair is read: no state change,
  // no audit row, and the refused state names no input the selector does not hold. The Core
  // answers `409 INVALID_STATE` with `details.reason: CAPTURE_SOURCE_NOT_ASSIGNED`. In Simulated
  // mode and in the in-app simulator the start is NOT refused: it behaves as before (C21 (6)).
  if (isOwnCaptureCoreState(state)) {
    const unassigned = unassignedSlotsOf(state.captureConfig);
    if (CAPTURE_START_REQUIRED_SLOTS.some((slot) => unassigned.includes(slot))) {
      throw new SimTransitionError(session.state, 'startRecording', 'a capture source is not assigned', SimErrorCode.ILLEGAL_STATE, CAPTURE_SOURCE_NOT_ASSIGNED_REASON);
    }
  }
  // Schema v2 (register SH-06; OD-10): the selector is copied into the session the instant
  // recording starts, so a later edit never changes a running session. `audioSource` records which
  // mic input feeds `AUDIO-01` (PRIMARY) and which is the hot standby (STANDBY); op 81 moves the
  // active one through `switchAudioSourceTransition`. `null`: the selector names no pair (a role
  // without a line; Simulated mode only) and the session states no audio source.
  const audioSource = audioSourceAtStart(state, session.id);
  // The input whose level is inside `AUDIO-01` from the first sample on is the session's primary.
  const armed: SimState =
    audioSource === null || state.audio.activeInputId === audioSource.activeInputId ? state : { ...state, audio: { ...state.audio, activeInputId: audioSource.activeInputId } };
  const next = addTimelineItem(
    withSession(armed, {
      ...session,
      state: SessionState.RECORDING,
      startedAt: now,
      startTimeSource: state.time.source,
      captureConfig: captureConfigSnapshot(state),
      ...(audioSource === null ? {} : { audioSource }),
      ...(capture === 'simulated' ? { captureDurable: false } : {}),
    }),
    {
      at: now,
      kind: 'START',
      label: 'Recording started',
      detail: session.id,
      channel: null,
      params: { sessionId: session.id, timeSource: state.time.source },
    },
  );
  return record(next, now, {
    audit: {
      type: 'RECORDING_STARTED',
      message: `Recording started (${session.id})`,
      actorId,
      ...sentFrom(sendingDeviceOf(state, false)),
      sessionId: session.id,
      details: { timeSource: state.time.source },
    },
    event: {
      type: 'RECORDING_STARTED',
      message: `Recording started · ${session.id}`,
      severity: 'SUCCESS',
      sessionId: session.id,
      params: { sessionId: session.id },
    },
  });
}

/** RECORDING → STOPPING with a reason of at least 5 characters (S21). Audit RECORDING_STOPPED. */
export function stopRecordingTransition(state: SimState, now: EpochMs, reason: string): SimState {
  const actorId = requireSessionOperator(state, 'stopRecording');
  const session = requireSession(state, 'stopRecording', [SessionState.RECORDING]);
  // A recording that is still connecting its cameras holds nothing durable: there is nothing to
  // stop and seal. A refusal of the STATE, so it comes before the reason, as the 409 before the 422 (D84; C3 §3.1: `409 INVALID_STATE`, `details.reason: CAPTURE_NOT_DURABLE`).
  if (session.captureDurable === false) {
    throw new SimTransitionError(session.state, 'stopRecording', 'the recording is still connecting its cameras', SimErrorCode.ILLEGAL_STATE, CAPTURE_NOT_DURABLE_REASON);
  }
  const trimmed = typeof reason === 'string' ? reason.trim() : '';
  if (trimmed.length < STOP_REASON_MIN_LENGTH) {
    throw new SimTransitionError(
      session.state,
      'stopRecording',
      `reason needs at least ${STOP_REASON_MIN_LENGTH} characters`,
      SimErrorCode.REASON_TOO_SHORT,
    );
  }
  const startedAt = session.startedAt ?? now;
  const settled = settleBytes(state, session, recordingBytes(now - startedAt));
  const next = withSession(settled.state, {
    ...settled.session,
    state: SessionState.STOPPING,
    stoppedAt: now,
    stopReason: trimmed,
    stopTimeSource: state.time.source,
  });
  return record(next, now, {
    audit: {
      type: 'RECORDING_STOPPED',
      message: `Recording stopped (${session.id})`,
      actorId,
      ...sentFrom(sendingDeviceOf(state, false)),
      sessionId: session.id,
      details: { reason: trimmed, durationMs: now - startedAt },
    },
    event: {
      type: 'RECORDING_STOPPED',
      message: `Recording stopped · ${session.id}`,
      sessionId: session.id,
      params: { sessionId: session.id, durationMs: now - startedAt },
    },
  });
}

/**
 * Switches the active mic input inside `AUDIO-01` while recording (schema v2; register SH-06/SH-08;
 * op 81; OD-09 hot standby). The Core never switches on its own — this transition is driven by the
 * operator's toggle (the session holder or a SUPERVISOR), never by a silence warning (OD-11). It
 * moves `audio.activeInputId`, records the new active/standby pair with the media-pts boundary of
 * the interval it opens, and writes one timeline `AUDIO_SWITCH` plus one `AUDIO_SOURCE_SWITCHED`
 * audit row carrying the sending device id (E-30). Idempotent when the input is already active; a
 * recording session is required.
 *
 * `sendingDeviceId` (closing pass F-X): the paired device the command came from, where the caller
 * knows one - a simulator that runs inside a tablet or phone app passes `SIM_CONSOLE_DEVICE_ID`.
 * Null (a web console session): the row has no device and its details no `sendingDeviceId` key,
 * as the Core writes it (`capture-session`, contract C3 §5.2).
 */
export const SIM_CONSOLE_DEVICE_ID = 'TABLET';

/** A paired-device ID as a row may name it: letters, digits and dashes. Anything else names no device. */
const SENDING_DEVICE_ID = /^[A-Z][A-Z0-9-]{1,31}$/;

/**
 * THE DEVICE A COMMAND CAME FROM (wave H driver B, finding G75-02; E-30 / SEC35-17), one rule for
 * the action and for operation 81: the paired device of the acting identity when its holder set
 * one (`auth.deviceId`: a Core in simulated capture, for the command of a tablet's or a phone's
 * device session); else the simulator's own paired device when it runs inside a device app; else
 * null - a web console session, whose row names no device.
 */
export function sendingDeviceOf(state: Pick<SimState, 'auth'>, deviceConsole: boolean): string | null {
  const scoped = state.auth.deviceId;
  if (typeof scoped === 'string' && SENDING_DEVICE_ID.test(scoped)) return scoped;
  return deviceConsole ? SIM_CONSOLE_DEVICE_ID : null;
}

/**
 * THE DEVICE OF A SESSION ROW (fix wave I, driver A2; re-gate 75 finding G75b-04; ruling D216 (2)):
 * every audit row of a session action a PAIRED DEVICE sent names that device in the row's
 * `deviceId` - created, pre-check passed / blocked, recording started / stopped, cancelled - as the
 * switch row does. The device is the one of the acting identity (`sendingDeviceOf(state, false)`:
 * what the Core's actor scope sets for the command of a device session). Null (a web console
 * session, the simulator inside an app, a scenario): the row keeps no device, as before. No
 * `details` key is added to these rows.
 */
function sentFrom(deviceId: string | null): { deviceId?: string } {
  return deviceId === null ? {} : { deviceId };
}

/** The member a pre-check keeps of the device that sent it (`PrecheckSlice.sendingDeviceId`); nothing for a web console session. */
function precheckSentFrom(deviceId: string | null): { sendingDeviceId?: string } {
  return deviceId === null ? {} : { sendingDeviceId: deviceId };
}

export function switchAudioSourceTransition(state: SimState, now: EpochMs, inputId: CaptureMicInputId, sendingDeviceId: string | null = null): SimState {
  const actorId = requireSessionOperator(state, 'switchAudioSource');
  const session = requireSession(state, 'switchAudioSource', [SessionState.RECORDING]);
  // The inputs of a session are those of its selector snapshot (OD-10); the selector when it has none.
  const mic = selectorOfSession(session, state.captureConfig).mics.find((entry) => entry.inputId === inputId);
  if (!mic) throw new SimNotFoundError('captureMic', inputId);
  // Media-pts start of the interval this switch opens (never the operator wall clock, S2 §6).
  const applied = applyAudioSourceSwitch(state, now, session, inputId, Math.max(0, now - (session.startedAt ?? now)));
  if (applied.switched === null) return state;
  const { fromInputId, toInputId, fromMs, toMs } = applied.switched;
  return record(applied.state, now, {
    audit: {
      type: 'AUDIO_SOURCE_SWITCHED',
      message: `Audio source switched to ${inputId}`,
      actorId,
      sessionId: session.id,
      ...(sendingDeviceId === null ? {} : { deviceId: sendingDeviceId }),
      // Contract C3 §5.2 (review R74-05): the keys of the row, with the MEDIA times of the interval the
      // switch closed. `sendingDeviceId` only when a paired device sent the command (E-30).
      details: { fromInput: fromInputId, toInput: toInputId, fromMs, toMs, ...(sendingDeviceId === null ? {} : { sendingDeviceId }) },
    },
    // No operational event row: `SimEventType` is the book's closed 46-value set and does not name a
    // mic switch; the switch is carried by the `AUDIO_SWITCH` timeline item and this audit row.
  });
}

/** What a switch moved: the two inputs and the interval it closed, in media ms. */
export interface AudioSourceSwitchFacts {
  readonly fromInputId: CaptureMicInputId;
  readonly toInputId: CaptureMicInputId;
  /** Start of the interval the switch closed. */
  readonly fromMs: number;
  /** End of that interval = start of the one it opens. */
  readonly toMs: number;
}

/**
 * THE STATE OF A SWITCH, for both of its callers (review R74-10: one rule, not two copies): the
 * simulator's own operation 81 above, with the media time of its clock, and the Core's engine in
 * real capture, with the media time the capture worker acknowledged. Moves `audio.activeInputId`,
 * records the new active / standby pair with the media time of the boundary, and adds the timeline
 * item `AUDIO_SWITCH` whose `params` hold the boundary (`atMs`) - the interval list of operation 82
 * in simulated capture is read from those items. Writes no audit row.
 * `switched: null` and the same state when `toInputId` is active already. The boundary never lies
 * before the start of the interval it closes.
 */
export function applyAudioSourceSwitch(state: SimState, now: EpochMs, session: ActiveSession, toInputId: CaptureMicInputId, atMediaMs: number): { readonly state: SimState; readonly switched: AudioSourceSwitchFacts | null } {
  const source = session.audioSource ?? null;
  const lines = selectorOfSession(session, state.captureConfig).mics;
  // THE INPUT THE SWITCH LEAVES (task 4 row 163; seam readers 3 and 4 of row 28). The session's own
  // pair says which input is active. Where the session states none (it was started in Simulated
  // mode on a selector without a complete pair), the meters' active input stands - but only while
  // it is a line of the session: an input the session does not hold is nothing to switch from.
  // `held` is `null` when the selector holds no PRIMARY (the meters slice, task 4 row 149).
  const held = state.audio.activeInputId;
  const fromInputId: CaptureMicInputId | null = source !== null ? source.activeInputId : held !== null && lines.some((entry) => entry.inputId === held) ? held : null;
  if (fromInputId === toInputId) return { state, switched: null };
  // NO ACTIVE INPUT, NO SWITCH. A switch moves the source FROM one input TO another: its interval,
  // its audit row (`fromInput`) and the new standby all name the input it leaves. No input is
  // invented for the three. Refused as a refusal of the state; nothing is written.
  if (fromInputId === null) {
    throw new SimTransitionError(session.state, 'switchAudioSource', 'the session states no active microphone input', SimErrorCode.ILLEGAL_STATE);
  }
  const fromMs = source?.intervalFromMs ?? 0;
  const toMs = Math.max(fromMs, Math.round(atMediaMs));
  const switched: ActiveSession = {
    ...session,
    audioSource: { sessionId: session.id, activeInputId: toInputId, standbyInputId: fromInputId, switchedAt: now, intervalFromMs: toMs },
  };
  const next = addTimelineItem(
    { ...state, session: switched, audio: { inputs: state.audio.inputs, activeInputId: toInputId } },
    {
      at: now,
      kind: 'AUDIO_SWITCH',
      label: `Active microphone switched to ${toInputId}`,
      detail: null,
      channel: channelOfMicLine(lines, toInputId) ?? 'AUDIO-01',
      params: { from: fromInputId, to: toInputId, deviceId: lines.find((entry) => entry.inputId === toInputId)?.deviceId ?? null, atMs: toMs },
    },
  );
  return { state: next, switched: { fromInputId, toInputId, fromMs, toMs } };
}

/** CREATE, PRECHECK or ARMED → no session. Audit SESSION_CANCELLED. */
export function cancelTransition(state: SimState, now: EpochMs): SimState {
  const actorId = requireSessionOperator(state, 'cancel');
  const session = requireSession(state, 'cancel', CANCELLABLE_STATES);
  return record(withSession(state, null), now, {
    audit: {
      type: 'SESSION_CANCELLED',
      message: `Session ${session.id} cancelled`,
      actorId,
      ...sentFrom(sendingDeviceOf(state, false)),
      sessionId: session.id,
      details: { fromState: session.state },
    },
    event: { type: 'SESSION_CANCELLED', message: `Session ${session.id} cancelled`, sessionId: session.id },
  });
}

// ── FINALIZING → SEALED (§12.2; FinalizationStep × 6 at 0.6-1.2 s each) ─────────────────

/** STOPPING for 1.5 s → FINALIZING (tracks closed). Assigns the evidence ID. */
export function advanceStopping(state: SimState, now: EpochMs, rng: RngStreams): SimState {
  const session = state.session;
  if (!session || session.state !== SessionState.STOPPING || session.stoppedAt === null) return state;
  // A SESSION THE CORE'S CAPTURE RECORDED IS SEALED BY THE CORE'S PIPELINE, NEVER BY THE TIME
  // (blueprint row 82b; decisions D67, D147). Such a session carries `captureDurable`. A session
  // the simulator's own capture recorded never does when it stops: the member is `false` only
  // while its cameras connect (a stop is refused then) and is REMOVED when the start is decided
  // (`advanceCaptureStart`, pass D10). It stays STOPPING until the pipeline's first
  // report moves it to FINALIZING (`applySealingProgressTransition`): the capture worker may need
  // longer than `STOPPING_MS` to close its files, and a timed seal here would put a SIMULATED item
  // beside a real recording.
  if (session.captureDurable !== undefined) return state;
  const at = session.stoppedAt + STOPPING_MS;
  if (now < at) return state;
  const random = rng.get(RngStream.FINALIZATION);
  const stepDurations = FINALIZATION_ORDER.map(() => random.int(FINALIZATION_STEP_MIN_MS, FINALIZATION_STEP_MAX_MS));
  const steps: FinalizationStepState[] = FINALIZATION_ORDER.map((id, index) => ({
    id,
    status: index === 0 ? 'active' : 'pending',
    startedAt: index === 0 ? at : null,
    completedAt: null,
    durationMs: stepDurations[index] ?? FINALIZATION_STEP_MIN_MS,
    // Schema v2 (SH-06; R-6 op 83): the driver reports per-step progress + ETA from Core instants.
    // A fresh run is attempt 1; a resumed run (RECOVERY) bumps it (`dbc-3 §B.4`).
    // `etaMs` is the remaining time of THIS step (decision D121; `sealing_jobs.eta_ms` is per step,
    // `dbc-3 §B.4`): the running step carries its own duration, a step that has not started none.
    // The remaining time of the whole run is op 83's own sum, never a step's member.
    progress: 0,
    etaMs: index === 0 ? (stepDurations[0] ?? FINALIZATION_STEP_MIN_MS) : null,
    detail: null,
    attempt: SEALING_FIRST_ATTEMPT,
  }));
  const evidenceSeq = state.meta.counters.evidence;
  const evidenceId = session.evidenceId ?? evidenceIdFor(evidenceSeq, session.createdAt);
  const next: SimState = {
    ...state,
    meta: session.evidenceId
      ? state.meta
      : { ...state.meta, counters: { ...state.meta.counters, evidence: evidenceSeq + 1 } },
    session: {
      ...session,
      state: SessionState.FINALIZING,
      evidenceId,
      finalization: { steps, startedAt: at, completedAt: null },
    },
  };
  return record(deriveDeviceState(next), at, {
    event: {
      type: 'FINALIZATION_STARTED',
      message: `Finalizing evidence · ${evidenceId}`,
      sessionId: session.id,
      params: { evidenceId },
    },
  });
}

function historyEntry(
  session: ActiveSession,
  outcome: SessionOutcome,
  endedAt: EpochMs,
  evidenceId: string | null,
  faultKind: FaultKind | null,
): SessionHistoryEntry {
  const startedAt = session.startedAt;
  return {
    id: session.id,
    outcome,
    caseNumber: session.input.caseNumber,
    subjectName: session.input.subjectName,
    subjectType: session.input.subjectType,
    investigatorId: session.input.investigatorId,
    room: session.input.room,
    profileId: session.input.profileId,
    createdAt: session.createdAt,
    startedAt,
    endedAt,
    durationMs: startedAt === null ? 0 : Math.max(0, endedAt - startedAt),
    sizeBytes: session.bytesWritten,
    evidenceId,
    faultKind,
    startTimeSource: session.startedAt === null ? null : (session.startTimeSource ?? null),
    endTimeSource: session.startedAt === null ? null : (session.stopTimeSource ?? null),
  };
}

/** `id` of the item note that carries the session form's "Notes" (one per item at most). */
export const SESSION_FORM_NOTE_ID = 'NOTE-FORM';
/** `origin` of that note: it was written on the session form before the recording, not during it. */
export const SESSION_FORM_NOTE_ORIGIN = 'SESSION_FORM';

/**
 * THE NOTES AN ITEM KEEPS (fix wave J round two; findings JT-11 / JW-13 / JA2-08). The notes written
 * during the recording, and BEFORE them the text of the session form's "Notes" field when it holds
 * one: that text lived in the open session only (`input.notes`), and the open session is gone once
 * the next one is created - so what the operator wrote was on no item and in no other record. It is
 * carried as one note of the item's existing list (no column): `id: NOTE-FORM`, `at` the creation
 * of the session, `authorId` who created it, `origin: SESSION_FORM`. Copied from the session at the
 * moment the item is made, never reconstructed later. An empty field adds nothing.
 */
export function itemNotesOf(session: Pick<ActiveSession, 'input' | 'notes' | 'createdAt' | 'createdBy'>): SessionNote[] {
  const form = typeof session.input.notes === 'string' ? session.input.notes.trim() : '';
  if (form === '') return session.notes;
  return [{ id: SESSION_FORM_NOTE_ID, at: session.createdAt, authorId: session.createdBy, text: form, origin: SESSION_FORM_NOTE_ORIGIN }, ...session.notes];
}

/** The session's markers, from its timeline (step 54, SIM-GAP-W47-3). */
function sessionMarkers(session: ActiveSession): EvidenceMarker[] {
  const markers: EvidenceMarker[] = [];
  for (const item of session.timeline) {
    if (item.kind !== 'MARKER') continue;
    const index = typeof item.params?.index === 'number' ? item.params.index : markers.length + 1;
    markers.push({ id: item.id, at: item.at, index, label: item.label });
  }
  return markers;
}

/**
 * The operator a custody entry names for the start or the stop of the recording (E-fix FX-C,
 * ruling R1: a sealed chain of custody is evidence; E2E-W1-1, E2E-T-3). Before the fix both
 * entries named `createdBy`, so a SUPERVISOR who stopped an INVESTIGATOR's session was recorded
 * as the investigator while the audit row of the same instant named the supervisor.
 *
 * The custody follows the session's own audit row of that transition (RECORDING_STARTED,
 * RECORDING_STOPPED), newest first: `startRecordingTransition` and `stopRecordingTransition` write
 * the acting operator there (`requireSessionOperator`), never the creator standing in. The audit
 * ring is kept by every host and is durable on the Core (`audit_log`; a reload restores the newest
 * 1,000 rows), so a reload between the stop and the seal still finds the stop's row. The actor is
 * deliberately NOT a member of the session: the Core stores the session as the columns of
 * `active_session`, and a member without a column would break its lossless round trip (MR-1);
 * a column is a database contract revision.
 *
 * Only when the row has left the 1,000-row ring does the creator stand in, as before the fix:
 * never for the stop (sealed 5-9 s after its row), and for the start only after about 2 hours of
 * recording (one integrity row per 8 s), and then it differs only if another operator started it.
 */
export function recordingActor(state: Pick<SimState, 'audit'>, session: ActiveSession, transition: 'START' | 'STOP'): string | null {
  const type = transition === 'START' ? 'RECORDING_STARTED' : 'RECORDING_STOPPED';
  const rows = state.audit.rows;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (row?.type === type && row.sessionId === session.id) return row.actorId;
  }
  return session.createdBy;
}

function seal(state: SimState, session: ActiveSession, at: EpochMs): SimState {
  const evidenceId = session.evidenceId ?? evidenceIdFor(state.meta.counters.evidence, session.createdAt);
  const recordedAt = session.startedAt ?? session.createdAt;
  const endedAt = session.stoppedAt ?? at;
  const item = createEvidenceItem({
    evidenceId,
    sessionId: session.id,
    caseNumber: session.input.caseNumber,
    recordedAt,
    endedAt,
    sizeBytes: session.bytesWritten,
    subjectName: session.input.subjectName,
    subjectType: session.input.subjectType,
    investigatorId: session.input.investigatorId,
    room: session.input.room,
    profileId: session.input.profileId,
    sealedAt: at,
    status: 'SEALED',
    custody: [
      { at: recordedAt, action: 'RECORDING_STARTED', actorId: recordingActor(state, session, 'START'), detail: null },
      { at: endedAt, action: 'RECORDING_STOPPED', actorId: recordingActor(state, session, 'STOP'), detail: session.stopReason },
      { at, action: 'SEALED', actorId: null, detail: null },
    ],
    markers: sessionMarkers(session),
    notes: itemNotesOf(session),
    startTimeSource: session.startTimeSource ?? null,
    endTimeSource: session.stopTimeSource ?? null,
    // Schema v2 (SH-07): a live seal carries the file list, the fragment-chain head and the transcript
    // hash; the pre-built dataset items stay on the v1 shape.
    schemaV2: true,
  });
  const sealed: ActiveSession = { ...session, state: SessionState.SEALED, sealedAt: at, evidenceId };
  const next: SimState = {
    ...state,
    session: sealed,
    evidence: [...state.evidence, item],
    lastSealedSessionId: session.id,
    lastSealedAcknowledged: false,
    sessionHistory: [historyEntry(sealed, SessionOutcome.SEALED, endedAt, evidenceId, null), ...state.sessionHistory],
  };
  return record(deriveDeviceState(next), at, {
    audit: {
      type: 'EVIDENCE_SEALED',
      message: `Evidence ${evidenceId} sealed`,
      sessionId: session.id,
      evidenceId,
      details: { manifestHash: item.manifestHash, tracks: item.tracks.length, sizeBytes: item.sizeBytes },
    },
    event: {
      type: 'EVIDENCE_SEALED',
      message: `Evidence sealed · ${evidenceId}`,
      severity: 'SUCCESS',
      sessionId: session.id,
      params: { evidenceId },
    },
  });
}

/**
 * True while the Core's sealing pipeline drives the session's finalization (`applySealingProgressTransition`):
 * a step that is not done carries NO planned duration, so no timed transition of this file advances
 * it. The simulator's own seal gives every step a duration when STOPPING ends (`advanceStopping`).
 */
export function isCoreDrivenSeal(session: ActiveSession | null): boolean {
  if (session === null || session.state !== SessionState.FINALIZING) return false;
  const open = session.finalization.steps.filter((step) => step.status !== 'done');
  return open.length > 0 && open.every((step) => step.durationMs === null);
}

/** Completes every finalization step whose time has come; seals after the sixth. */
export function advanceFinalization(state: SimState, now: EpochMs): SimState {
  const session = state.session;
  if (!session || session.state !== SessionState.FINALIZING) return state;
  // A seal the Core's pipeline drives is advanced by its progress and its completion only
  // (`applySealingProgressTransition`, `completeSealTransition`): never by the time.
  if (session.finalization.steps.some((step) => step.status === 'active' && step.durationMs === null)) return state;
  const steps = session.finalization.steps.slice();
  let changed = false;
  let sealAt: EpochMs | null = null;
  for (;;) {
    const index = steps.findIndex((step) => step.status === 'active');
    const step = steps[index];
    if (!step || step.startedAt === null) break;
    const due = step.startedAt + (step.durationMs ?? FINALIZATION_STEP_MIN_MS);
    if (now < due) break;
    steps[index] = { ...step, status: 'done', completedAt: due, progress: 100, etaMs: 0 };
    changed = true;
    const following = steps[index + 1];
    if (following) steps[index + 1] = { ...following, status: 'active', startedAt: due, etaMs: following.durationMs ?? FINALIZATION_STEP_MIN_MS };
    else {
      sealAt = due;
      break;
    }
  }
  // Schema v2 (SH-06; R-6 op 83): while a step is still running, move its `progress` toward 100 and
  // recompute ITS remaining time from Core instants (decision D121: the running step's own ETA,
  // not the run's). The engine calls this every tick, so the client's progress line is
  // forward-only and never derived from its own wall clock (E-13).
  const activeIndex = steps.findIndex((step) => step.status === 'active');
  const active = activeIndex >= 0 ? steps[activeIndex] : undefined;
  if (active && sealAt === null && active.startedAt !== null) {
    const durationMs = active.durationMs ?? FINALIZATION_STEP_MIN_MS;
    const elapsed = Math.max(0, Math.min(now - active.startedAt, durationMs));
    const progress = Math.min(99, Math.floor((elapsed / durationMs) * 100));
    const etaMs = durationMs - elapsed;
    if (progress !== active.progress || etaMs !== active.etaMs) {
      steps[activeIndex] = { ...active, progress, etaMs };
      changed = true;
    }
  }
  if (!changed) return state;
  const updated: ActiveSession = {
    ...session,
    finalization: { ...session.finalization, steps, completedAt: sealAt },
  };
  const next = { ...state, session: updated };
  return sealAt === null ? next : seal(next, updated, sealAt);
}

// ── The seal the Core's pipeline drives (schema v2; blueprint row 82) ────────────────────
//
// Register SH-06, SH-18, CS-04; evidence package spec §E.1, §E.2, §E.4; decisions D65(b), D67, D121.
//
// In real capture the finalization of a session is not a matter of time: the Core's sealing
// pipeline works through the six steps on the files of the session and tells the engine where it
// stands. Three pure transitions carry that, and the engine host applies each as one INTERNAL
// action (no actor, no permission: the pipeline is the Core itself):
//
//   applySealingProgressTransition   the step states of `sealing_jobs`, forward-only per attempt.
//                                    The first call moves the session to FINALIZING: from STOPPING
//                                    (a clean stop), or from FAULT / RECOVERY (the interrupted
//                                    durable-prefix seal of OD-08, and a seal resumed at a start).
//   completeSealTransition           FINALIZING -> SEALED with the item of the REAL package: the
//                                    hashes, the signature and the marks are the pipeline's, nothing
//                                    is computed here.
//   recordEvidenceVerificationTransition   the verdict the Core computed for a REAL item (D107 (1)).
//
// A step the pipeline has not finished carries no planned duration (`durationMs: null`), and that
// is what keeps the timed `advanceFinalization` away from it (`isCoreDrivenSeal`).

export type SealingStepReportStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

/** One step as the pipeline reports it: the members of its `sealing_jobs` row (`dbc-3 §B.4`). */
export interface SealingStepReport {
  id: FinalizationStep;
  status: SealingStepReportStatus;
  /** 0..100. */
  progress: number;
  /** The remaining time of THIS step in ms, or null when the pipeline has no estimate (D121). */
  etaMs: number | null;
  /** >= 1; one more for every resumed run. */
  attempt: number;
  /** Counts for the progress line (fragments, chunks). Never a path, a hash or transcript text. */
  detail?: string | null;
}

export interface SealingProgressInput {
  sessionId: string;
  steps: readonly SealingStepReport[];
  /**
   * The camera files whose tail was no whole fragment and was dropped by the tail validation
   * (capture spec §C.5; erratum AU2-08). Each is written ONCE into the session's timeline.
   */
  truncatedTails?: readonly { trackId: string; droppedBytes: number }[];
}

const STEP_STATUS_OF_REPORT = { PENDING: 'pending', RUNNING: 'active', DONE: 'done', FAILED: 'error' } as const;
const SEALABLE_STATES: readonly SessionState[] = [SessionState.STOPPING, SessionState.FINALIZING, SessionState.FAULT, SessionState.RECOVERY];
const wholeBetween = (value: number, least: number, most: number): number => Math.min(most, Math.max(least, Math.floor(Number.isFinite(value) ? value : least)));

function coreDrivenStep(previous: FinalizationStepState | undefined, report: SealingStepReport | undefined, id: FinalizationStep, now: EpochMs): FinalizationStepState {
  const attempt = Math.max(previous?.attempt ?? SEALING_FIRST_ATTEMPT, wholeBetween(report?.attempt ?? SEALING_FIRST_ATTEMPT, SEALING_FIRST_ATTEMPT, Number.MAX_SAFE_INTEGER));
  // A step that is DONE stays DONE, with its instants, whatever a resumed run reports (D-87-3).
  if (previous?.status === 'done' && previous.durationMs !== null) return { ...previous, progress: 100, etaMs: 0, attempt: previous.attempt ?? attempt };
  if (report === undefined || report.status === 'PENDING') {
    return { id, status: 'pending', startedAt: null, completedAt: null, durationMs: null, progress: 0, etaMs: null, detail: null, attempt };
  }
  const startedAt = previous?.startedAt ?? now;
  if (report.status === 'DONE') {
    return { id, status: 'done', startedAt, completedAt: now, durationMs: Math.max(0, now - startedAt), progress: 100, etaMs: 0, detail: report.detail ?? null, attempt };
  }
  // Forward-only inside one attempt; a resumed attempt may legitimately start lower (ev §E.2).
  const sameAttempt = previous !== undefined && (previous.attempt ?? SEALING_FIRST_ATTEMPT) === attempt && previous.durationMs === null;
  const reported = wholeBetween(report.progress, 0, 99);
  const progress = sameAttempt ? Math.max(previous.progress ?? 0, reported) : reported;
  const etaMs = report.etaMs === null ? null : wholeBetween(report.etaMs, 0, Number.MAX_SAFE_INTEGER);
  return { id, status: STEP_STATUS_OF_REPORT[report.status], startedAt, completedAt: null, durationMs: null, progress, etaMs, detail: report.detail ?? null, attempt };
}

/**
 * The sealing pipeline's step states (INTERNAL action `applySealingProgress`; no actor). The
 * session must be the one named, in STOPPING, FINALIZING, FAULT or RECOVERY. Returns the same
 * state when nothing a client would see changed.
 */
export function applySealingProgressTransition(state: SimState, now: EpochMs, input: SealingProgressInput): SimState {
  const session = requireSession(state, 'applySealingProgress', SEALABLE_STATES);
  if (session.id !== input.sessionId) throw new SimTransitionError(session.state, 'applySealingProgress', 'another session is active');
  const entering = session.state !== SessionState.FINALIZING;
  const previous = new Map(entering ? [] : session.finalization.steps.map((step) => [step.id, step] as const));
  const reported = new Map(input.steps.map((step) => [step.id, step] as const));
  const steps = FINALIZATION_ORDER.map((id) => coreDrivenStep(previous.get(id), reported.get(id), id, now));

  const known = new Set(session.timeline.filter((item) => item.kind === 'CHECK' && item.params?.source === 'TAIL_VALIDATION').map((item) => item.params?.trackId));
  const tails = (input.truncatedTails ?? []).filter((tail) => !known.has(tail.trackId));
  const sameSteps =
    !entering &&
    steps.every((step, index) => {
      const before = session.finalization.steps[index];
      return before !== undefined && before.status === step.status && before.progress === step.progress && before.etaMs === step.etaMs && (before.detail ?? null) === (step.detail ?? null) && before.attempt === step.attempt;
    });
  if (sameSteps && tails.length === 0) return state;

  const evidenceSeq = state.meta.counters.evidence;
  const evidenceId = session.evidenceId ?? evidenceIdFor(evidenceSeq, session.createdAt);
  const recovering = session.state === SessionState.FAULT || session.state === SessionState.RECOVERY;
  const updated: ActiveSession = {
    ...session,
    state: SessionState.FINALIZING,
    evidenceId,
    // The interrupted seal ends the recording where it faulted: there was no operator stop.
    recovery: null,
    finalization: { steps, startedAt: entering ? now : session.finalization.startedAt, completedAt: null },
  };
  let next: SimState = deriveDeviceState({
    ...state,
    meta: session.evidenceId ? state.meta : { ...state.meta, counters: { ...state.meta.counters, evidence: evidenceSeq + 1 } },
    session: updated,
  });
  for (const tail of tails) {
    next = addTimelineItem(next, {
      at: now,
      kind: 'CHECK',
      label: `Truncated tail dropped · ${tail.trackId}`,
      detail: null,
      channel: null,
      params: { source: 'TAIL_VALIDATION', trackId: tail.trackId, droppedBytes: tail.droppedBytes, truncated: true },
    });
  }
  if (!entering) return next;
  const items: ActivityInput[] = [];
  // A seal that starts from FAULT is the recovery of that session (the operator's `recover` wrote
  // the row already when the session is in RECOVERY).
  if (session.state === SessionState.FAULT) {
    items.push({
      audit: { type: 'RECOVERY_STARTED', message: `Recovery scan started for ${session.id}`, actorId: null, sessionId: session.id, details: { faultKind: session.fault?.kind ?? null } },
      event: { type: 'RECOVERY_STARTED', message: `Recovery started · ${session.id}`, severity: 'WARNING', sessionId: session.id },
    });
  }
  items.push({ event: { type: 'FINALIZATION_STARTED', message: `Finalizing evidence · ${evidenceId}`, sessionId: session.id, params: { evidenceId, ...(recovering ? { resumed: true } : {}) } } });
  return record(next, now, items);
}

/** One sealed camera file as the item lists it: the stored-bytes hash of the whole file. */
export interface SealedTrackInput {
  trackId: 'VIDEO-01' | 'VIDEO-02';
  sizeBytes: number;
  /** SHA-256 of the stored bytes of the whole file (`tracks[].sha256` of the manifest). */
  sha256: string;
}

export interface CompleteSealInput {
  sessionId: string;
  /** `timeline.sealedAt` of the signed manifest. */
  sealedAt: EpochMs;
  /** `manifestSha256`: the digest that was signed. */
  manifestSha256: string;
  /** The real signature of that digest (128 hex characters for Ed25519). */
  signature: { value: string; keyId: string; algorithm: 'Ed25519' };
  tracks: readonly SealedTrackInput[];
  /** `timeline.interrupted`: the durable prefix of a recording that did not end by a stop (OD-08). */
  interrupted: boolean;
  /** `timeline.durableEndMs`: where the sealed media ends on the Core clock. */
  durableEndAt: EpochMs;
  /** The three sealed columns of `FINALIZE_TRANSCRIPT` (`SealedItemColumns`). */
  transcriptSha256: string | null;
  labelsStatus: 'LABELLED' | 'UNAVAILABLE' | null;
  /** Manifest field 126. */
  developmentSources: boolean;
  /**
   * THE TRANSCRIPT SUMMARY OF THE ITEM (fix pass F-M6, R80-01): the projection of the signed
   * manifest's transcript block - state, failed chunks, the unreachable backend - with head 0. The
   * pipeline that signed the manifest hands it in; absent, the item carries no summary (nothing is
   * derived here). Its hash must be the item's `transcriptSha256`.
   */
  transcript?: EvidenceTranscriptSummary;
}

const HEX_64 = /^[0-9a-f]{64}$/;
const HEX_128 = /^[0-9a-f]{128}$/;

/**
 * FINALIZING -> SEALED with the item of the REAL package (INTERNAL action `completeSeal`; no
 * actor). Everything that identifies the evidence is handed in by the pipeline that hashed and
 * signed it; a value that is no digest is refused, and nothing is derived or defaulted here.
 * Audit EVIDENCE_SEALED (the keys of the simulator's seal), and RECOVERY_COMPLETED for a session
 * that reached the seal through a fault.
 */
export function completeSealTransition(state: SimState, now: EpochMs, input: CompleteSealInput): SimState {
  const session = requireSession(state, 'completeSeal', [SessionState.FINALIZING]);
  const refuse = (reason: string): never => {
    throw new SimTransitionError(session.state, 'completeSeal', reason);
  };
  if (session.id !== input.sessionId) refuse('another session is active');
  if (session.finalization.steps.some((step) => step.status === 'error')) refuse('a sealing step failed');
  if (!HEX_64.test(input.manifestSha256)) refuse('the manifest digest is no SHA-256');
  if (input.signature.algorithm !== 'Ed25519' || !HEX_128.test(input.signature.value) || input.signature.keyId.length === 0) refuse('the signature is no Ed25519 signature');
  // Fix pass F-M7 (R88-01, D178): the camera files that EXIST - one or two, VIDEO-01 before VIDEO-02. A one-camera session is sealed with its one file.
  const sealedIds = input.tracks.map((track) => track.trackId);
  if (!(sealedIds.length === 1 ? sealedIds[0] === 'VIDEO-01' || sealedIds[0] === 'VIDEO-02' : sealedIds.length === 2 && sealedIds[0] === 'VIDEO-01' && sealedIds[1] === 'VIDEO-02')) refuse('a sealed package has one or two camera files, VIDEO-01 before VIDEO-02');
  for (const track of input.tracks) if (!HEX_64.test(track.sha256) || !Number.isSafeInteger(track.sizeBytes) || track.sizeBytes < 1) refuse('a camera file without its hash or its size');
  if (input.transcriptSha256 !== null && !HEX_64.test(input.transcriptSha256)) refuse('the transcript digest is no SHA-256');
  if (session.startedAt === null) refuse('a session that never recorded has nothing to seal');
  const summary = input.transcript;
  if (summary !== undefined) {
    if (summary.sha256 !== input.transcriptSha256 || summary.machineTranscriptHash !== input.transcriptSha256) refuse('the transcript summary names another transcript than the item');
    if (summary.revision !== 0) refuse('a seal has no transcript revision');
    if (summary.state !== 'READY' && summary.state !== 'PARTIAL' && summary.state !== 'DISABLED') refuse('a sealed transcript is READY, PARTIAL or DISABLED');
    if (summary.failedChunks !== undefined && (!Number.isSafeInteger(summary.failedChunks) || summary.failedChunks < 0)) refuse('the failed chunks of the transcript summary are no count');
  }

  const at = input.sealedAt;
  const evidenceId = session.evidenceId ?? evidenceIdFor(state.meta.counters.evidence, session.createdAt);
  const recordedAt = session.startedAt ?? session.createdAt;
  const endedAt = input.interrupted ? input.durableEndAt : (session.stoppedAt ?? input.durableEndAt);
  const sizeBytes = input.tracks.reduce((sum, track) => sum + track.sizeBytes, 0);
  const faultKind = session.fault?.kind ?? null;
  const custody: CustodyEntry[] = [
    { at: recordedAt, action: 'RECORDING_STARTED', actorId: recordingActor(state, session, 'START'), detail: null },
    input.interrupted
      ? { at: endedAt, action: 'RECORDING_INTERRUPTED', actorId: null, detail: faultKind }
      : { at: endedAt, action: 'RECORDING_STOPPED', actorId: recordingActor(state, session, 'STOP'), detail: session.stopReason },
    { at, action: 'SEALED', actorId: null, detail: input.interrupted ? 'Durable prefix sealed (interrupted)' : null },
  ];
  const item: EvidenceItem = {
    id: evidenceId,
    sessionId: session.id,
    caseNumber: session.input.caseNumber,
    subjectName: session.input.subjectName,
    subjectType: session.input.subjectType,
    investigatorId: session.input.investigatorId,
    room: session.input.room,
    profileId: session.input.profileId,
    recordedAt,
    endedAt,
    sealedAt: at,
    durationMs: Math.max(0, endedAt - recordedAt),
    sizeBytes,
    status: 'SEALED',
    lifecycleStage: EVIDENCE_STATUS_STAGE.SEALED,
    tracks: input.tracks.map((track) => ({ trackId: track.trackId, label: track.trackId === 'VIDEO-01' ? 'Camera 1' : 'Camera 2', sizeBytes: track.sizeBytes, sha256: track.sha256 })),
    manifestHash: input.manifestSha256,
    // A REAL signature. The shared `EvidenceSignature` type still names the simulated stand-in only
    // (the slice schema admits the Ed25519 pair since M2-W7): the widening of the type and of the
    // database mapping's way back is requested by row 82 (`file_requests.md`).
    signature: { value: input.signature.value, keyId: input.signature.keyId, algorithm: input.signature.algorithm, simulated: false } as unknown as EvidenceSignature,
    custody,
    verification: { status: 'NOT_RUN', at: null },
    tampered: false,
    tamperedTrackId: null,
    caseType: session.input.subjectType,
    markers: sessionMarkers(session),
    notes: itemNotesOf(session),
    integritySource: IntegritySource.REAL,
    startTimeSource: session.startTimeSource ?? null,
    endTimeSource: session.stopTimeSource ?? null,
    transcriptSha256: input.transcriptSha256,
    manifestVersion: 2,
    labelsStatus: input.labelsStatus,
    developmentSources: input.developmentSources,
    ...(summary === undefined ? {} : { transcript: { ...summary } }),
  };
  // Wave H driver A (G89-08 / G81-08): `at` is the instant under the signature - `timeline.sealedAt` of the manifest, taken
  // when BUILD_MANIFEST froze the manifest's content - so it lies BEFORE the start of the steps that ran after it (SIGN_MANIFEST,
  // STORE_SEALED_PACKAGE). A step never completes before it started: its completion is the later of the two instants.
  const steps = session.finalization.steps.map((step): FinalizationStepState => {
    if (step.status === 'done') return step;
    const startedAt = step.startedAt ?? at;
    const completedAt = Math.max(at, startedAt);
    return { ...step, status: 'done', startedAt, completedAt, durationMs: completedAt - startedAt, progress: 100, etaMs: 0 };
  });
  /** The seal as a whole completed when its last step did (never before `sealedAt`). */
  const stepsCompletedAt = steps.reduce((latest, step) => Math.max(latest, step.completedAt ?? at), at);
  // Wave H driver B (G75-08, ruling D197): an interrupted recording has no operator stop, and its end is
  // known now - the end of the durable media. `stoppedAt` says it, so every duration stops there. Written
  // only HERE, at SEALED: while the seal runs the sealing side reads a null `stoppedAt` as "interrupted".
  const sealed: ActiveSession = { ...session, state: SessionState.SEALED, sealedAt: at, evidenceId, bytesWritten: sizeBytes, ...(input.interrupted ? { stoppedAt: endedAt } : {}), finalization: { ...session.finalization, steps, completedAt: stepsCompletedAt } };
  const next: SimState = {
    ...state,
    meta: session.evidenceId ? state.meta : { ...state.meta, counters: { ...state.meta.counters, evidence: state.meta.counters.evidence + 1 } },
    session: sealed,
    evidence: [...state.evidence, item],
    lastSealedSessionId: session.id,
    lastSealedAcknowledged: false,
    // A SEALED entry names no fault (`session_history_outcome_check`: a fault kind belongs to an
    // INCOMPLETE outcome only); the fault of an interrupted recording is in the custody and the audit trail.
    sessionHistory: [historyEntry(sealed, SessionOutcome.SEALED, endedAt, evidenceId, null), ...state.sessionHistory],
  };
  const items: ActivityInput[] = [
    {
      audit: { type: 'EVIDENCE_SEALED', message: `Evidence ${evidenceId} sealed`, sessionId: session.id, evidenceId, details: { manifestHash: item.manifestHash, tracks: item.tracks.length, sizeBytes: item.sizeBytes } },
      event: { type: 'EVIDENCE_SEALED', message: `Evidence sealed · ${evidenceId}`, severity: 'SUCCESS', sessionId: session.id, params: { evidenceId } },
    },
  ];
  if (session.fault !== null) {
    items.push({
      audit: { type: 'RECOVERY_COMPLETED', message: `Recovery completed for ${session.id}`, sessionId: session.id },
      event: { type: 'RECOVERY_COMPLETED', message: `Recovery completed · ${session.id}`, sessionId: session.id },
    });
  }
  // Wave H driver B (G75-10; D84 R-4): the capture fault of the recording that was just sealed as interrupted is over.
  return endCaptureFaultAtSeal(record(deriveDeviceState(next), now, items), now, session);
}

/** What the Core says of a session it cannot seal (INTERNAL action `endUnsealable`; fix pass F-M7b, R88-02 (c)). */
export interface EndUnsealableInput {
  sessionId: string;
  /** The code of the cause (`NOTHING_SEALABLE`, a failure code of the pipeline). Never a path, a hash or text. */
  cause: string;
  /** How many files the Core moved to its quarantine folder. A count. */
  quarantinedFiles?: number;
}

/**
 * THE TERMINAL OUTCOME OF A SESSION THAT CANNOT BE SEALED (fix pass F-M7b; review R88-02 (c);
 * rulings D178 (2), D183). STOPPING / FINALIZING / FAULT / RECOVERY -> no open session: the session
 * is ended as INCOMPLETE with ONE audit row `SESSION_INCOMPLETE` (`details.reason: UNSEALABLE` and
 * the named cause) and ONE CRITICAL alert (`seal-unsealable.ts`). NO evidence item is made: nothing
 * of this session is presented as evidence - the Core moved its recordings to the quarantine
 * folder before it called this. Afterwards `isSessionActive` is false and a session can be created.
 * The Core's engine door applies this same transition (parity with the simulator).
 */
export function endUnsealableTransition(state: SimState, now: EpochMs, input: EndUnsealableInput): SimState {
  const session = requireSession(state, 'endUnsealable', SEALABLE_STATES);
  const refuse = (reason: string): never => {
    throw new SimTransitionError(session.state, 'endUnsealable', reason);
  };
  if (session.id !== input.sessionId) refuse('another session is active');
  if (typeof input.cause !== 'string' || !SEAL_UNSEALABLE_CAUSE_CODE.test(input.cause)) refuse('the cause of an unsealable session is a code');
  const quarantinedFiles = input.quarantinedFiles === undefined ? null : wholeBetween(input.quarantinedFiles, 0, Number.MAX_SAFE_INTEGER);
  const faultKind = session.fault?.kind ?? null;
  const endedAt = session.stoppedAt ?? session.fault?.at ?? now;
  const message = unsealableSentence(input.cause);
  const { id, meta } = nextItemId(state.meta, 'ALR');
  const alert: SimAlert = { id, at: now, severity: 'CRITICAL', kind: 'SYSTEM', message, active: true, acknowledged: false, resolvedAt: null, target: session.id, params: { reason: SEAL_UNSEALABLE_REASON, cause: input.cause, sessionId: session.id } };
  const next = withSession({ ...state, meta, alerts: pushRing(state.alerts, [alert], ALERT_RING_SIZE), sessionHistory: [historyEntry(session, SessionOutcome.INCOMPLETE, endedAt, null, faultKind), ...state.sessionHistory] }, null);
  return record(deriveDeviceState(next), now, [
    {
      audit: {
        type: 'SESSION_INCOMPLETE',
        message: `Session ${session.id} could not be sealed (${input.cause}): ended INCOMPLETE, its recordings are in the quarantine folder`,
        severity: 'CRITICAL',
        sessionId: session.id,
        evidenceId: null,
        details: { reason: SEAL_UNSEALABLE_REASON, cause: input.cause, faultKind, ...(quarantinedFiles === null ? {} : { quarantinedFiles }) },
      },
      event: { type: 'SESSION_INCOMPLETE', message, severity: 'CRITICAL', sessionId: session.id, params: { reason: SEAL_UNSEALABLE_REASON, cause: input.cause } },
    },
  ]);
}

/** The verdict of one verification run of a REAL item, as the Core computed it (`VerdictRecord`). */
export interface EvidenceVerdictInput {
  evidenceId: string;
  ok: boolean;
  /** The server clock of the run. */
  at: EpochMs;
  manifestOk: boolean;
  signatureOk: boolean;
  /** The camera files that did not verify, in track order. */
  failedTracks: readonly string[];
  /** The custody text: null for a pass; names, never values. */
  detail: string | null;
  /** The operator who asked for the verification. */
  actorId: string | null;
  /**
   * Fix wave K (G89b-04, G94b-03; rulings D216 (2), D222 (3)). The paired device the request came
   * from (null / absent: a web console session): this action is INTERNAL - nobody is in `auth` -
   * so the Core hands the device in. `operationId`: the operation that asked. `failedFragments`:
   * the fragments that did not verify, `<trackId>:<seq>`; the failed row then names the fragment
   * and not only the file.
   */
  deviceId?: string | null;
  operationId?: string;
  failedFragments?: readonly string[];
}

/** The most fragments a failed verify row names; the count says how many there were. */
export const VERIFY_ROW_MAX_FRAGMENTS = 8;

/**
 * Records a verdict the Core computed (INTERNAL action `recordEvidenceVerification`; decision
 * D107 (1)): the item's verification state, the custody entry and the audit row + event of the
 * hosted `verify`, with the same keys. Only for an item whose package is REAL: every other item
 * is verified by the hosted action, which computes its own verdict.
 */
export function recordEvidenceVerificationTransition(state: SimState, now: EpochMs, verdict: EvidenceVerdictInput): SimState {
  const item = state.evidence.find((existing) => existing.id === verdict.evidenceId);
  if (!item) throw new SimNotFoundError('evidence', verdict.evidenceId);
  // Integration pass E3: besides a REAL item, a SEED-SEALED demo item has a real sealed v2 package in the Core's
  // store (sealed at seed time with the development key; ev F.2 - F.4): `DEMO_PACKAGE`, version 2, marked
  // development sources, and signed for real. None of the frozen v1 demo items is one (stand-in signature).
  const seedSealedDemo = item.integritySource === IntegritySource.DEMO_PACKAGE && item.manifestVersion === 2 && item.developmentSources === true && (item.signature as { simulated: boolean }).simulated === false;
  if (item.integritySource !== IntegritySource.REAL && !seedSealedDemo) throw new SimTransitionError(state.session?.state ?? null, 'recordEvidenceVerification', 'the item has no real sealed package');
  const failed = verdict.failedTracks.join(',');
  const fragments = verdict.ok ? [] : (verdict.failedFragments ?? []).filter((fragment) => typeof fragment === 'string' && /^[A-Z0-9-]{1,16}:\d{1,9}$/.test(fragment));
  const verified: EvidenceItem = {
    ...item,
    verification: { status: verdict.ok ? 'PASS' : 'FAIL', at: verdict.at },
    custody: [...item.custody, { at: verdict.at, action: verdict.ok ? 'VERIFIED' : 'VERIFY_FAILED', actorId: verdict.actorId, detail: verdict.ok ? null : (verdict.detail ?? 'Mismatch: manifest or signature') }],
  };
  const next: SimState = { ...state, evidence: state.evidence.map((existing) => (existing.id === item.id ? verified : existing)) };
  return record(next, now, {
    audit: {
      type: verdict.ok ? 'EVIDENCE_VERIFIED' : 'EVIDENCE_VERIFY_FAILED',
      message: verdict.ok ? `Evidence ${item.id} verified: every hash matches` : `Evidence ${item.id} failed verification (${failed || 'manifest or signature'})`,
      severity: verdict.ok ? 'INFO' : 'CRITICAL',
      actorId: verdict.actorId,
      ...sentFrom(typeof verdict.deviceId === 'string' && SENDING_DEVICE_ID.test(verdict.deviceId) ? verdict.deviceId : null),
      evidenceId: item.id,
      details: {
        manifestOk: verdict.manifestOk,
        signatureOk: verdict.signatureOk,
        failedTracks: failed,
        ...(verdict.ok ? {} : { eventKind: AuditEventKind.TAMPER }),
        ...(fragments.length === 0 ? {} : { failedFragments: fragments.slice(0, VERIFY_ROW_MAX_FRAGMENTS).join(','), failedFragmentCount: fragments.length }),
        ...(typeof verdict.operationId === 'string' && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(verdict.operationId) ? { operationId: verdict.operationId } : {}),
      },
    },
    event: {
      type: verdict.ok ? 'EVIDENCE_VERIFIED' : 'EVIDENCE_VERIFY_FAILED',
      message: verdict.ok ? `Evidence verified · ${item.id}` : `Integrity check FAILED · ${item.id}`,
      severity: verdict.ok ? 'SUCCESS' : 'CRITICAL',
      params: { evidenceId: item.id, failedTracks: failed },
    },
  });
}

// ── FAULT → RECOVERY → incomplete (§6.4, §18.1; SYS-008) ────────────────────────────────

/**
 * A critical fault moves PRECHECK, ARMED, RECORDING, STOPPING or FINALIZING to FAULT.
 * Other states are left alone (the fault still raises its alert and audit row in faults.ts).
 * Recording stops at the fault: the bytes written so far are kept for the incomplete item.
 */
export function enterFault(state: SimState, now: EpochMs, kind: FaultKind): SimState {
  const session = state.session;
  if (!session || !FAULTABLE_STATES.includes(session.state)) return state;
  const settled =
    session.state === SessionState.RECORDING && session.startedAt !== null
      ? settleBytes(state, session, recordingBytes(now - session.startedAt))
      : { state, session };
  const wasRecording = session.state === SessionState.RECORDING;
  // Closing pass J (D217 (5); `core-not-running.ts`): the restart fault of a Core in its own capture says so on the session too. Read from the active fault, by its member.
  const notRunning = kind === FaultKind.POWER_FAIL && state.faults.active.some((fault) => fault.kind === kind && fault.coreNotRunning === true);
  let next = withSession(settled.state, {
    ...settled.session,
    state: SessionState.FAULT,
    fault: { kind, at: now, fromState: session.state, ...(notRunning ? { coreNotRunning: true as const } : {}) },
    ...(wasRecording ? { stopTimeSource: state.time.source as TimeSource } : {}),
  });
  if (wasRecording) {
    next = addTimelineItem(next, {
      at: now,
      kind: 'FAULT',
      label: notRunning ? CORE_NOT_RUNNING_LABEL : `Critical fault: ${kind}`,
      detail: null,
      channel: null,
      params: { kind, evt: FaultEvt[kind], critical: true, ...(notRunning ? { coreNotRunning: true } : {}) },
    });
  }
  return next;
}

/** FAULT → RECOVERY: RECOVERY_SCAN, then INCOMPLETE_SESSION_ANALYSIS, 3 s in total. */
export function recoverTransition(state: SimState, now: EpochMs): SimState {
  const session = requireSession(state, 'recover', [SessionState.FAULT]);
  const items: ActivityInput[] = [];
  if (session.fault?.kind === FaultKind.POWER_FAIL) {
    // Closing pass J (D217 (5)): a Core that was not running says that, never "after power fail".
    const notRunning = session.fault.coreNotRunning === true;
    const restarted = CORE_NOT_RUNNING_RESTART_SENTENCE.replaceAll('{{product}}', PRODUCT_NAME);
    items.push({
      audit: {
        type: 'SYSTEM_BOOT',
        message: notRunning ? restarted : `${PRODUCT_NAME} restarted after power fail`,
        deviceId: DEVICE_ID,
        details: { afterFault: FaultKind.POWER_FAIL, ...(notRunning ? { coreNotRunning: true } : {}) },
      },
      event: { type: 'SYSTEM_BOOT', message: notRunning ? restarted : 'System restarted after power fail', severity: 'WARNING', deviceId: DEVICE_ID },
    });
  }
  items.push({
    audit: {
      type: 'RECOVERY_STARTED',
      message: `Recovery scan started for ${session.id}`,
      actorId: signedInOperatorId(state),
      sessionId: session.id,
      details: { faultKind: session.fault?.kind ?? null },
    },
    event: { type: 'RECOVERY_STARTED', message: `Recovery started · ${session.id}`, severity: 'WARNING', sessionId: session.id },
  });
  // A power-fail reboot restarts every service (step 54, SIM-GAP-W52-1: uptime counts from here).
  const rebooted: SimState =
    session.fault?.kind === FaultKind.POWER_FAIL
      ? { ...state, services: state.services.map((service) => ({ ...service, startedAt: now })) }
      : state;
  const next = withSession(rebooted, {
    ...session,
    state: SessionState.RECOVERY,
    recovery: { stage: 'RECOVERY_SCAN', startedAt: now, completesAt: now + RECOVERY_MS },
  });
  return record(next, now, items);
}

/** Advances the recovery stages; at the end the session is kept as INCOMPLETE, never sealed. */
export function advanceRecovery(state: SimState, now: EpochMs): SimState {
  const session = state.session;
  if (!session || session.state !== SessionState.RECOVERY || !session.recovery) return state;
  const { recovery } = session;
  if (now >= recovery.completesAt) return finishIncomplete(state, session, recovery.completesAt);
  if (recovery.stage === 'RECOVERY_SCAN' && now >= recovery.startedAt + RECOVERY_SCAN_MS) {
    return { ...state, session: { ...session, recovery: { ...recovery, stage: 'INCOMPLETE_SESSION_ANALYSIS' } } };
  }
  return state;
}

function finishIncomplete(state: SimState, session: ActiveSession, at: EpochMs): SimState {
  const faultKind = session.fault?.kind ?? null;
  const recorded = session.startedAt !== null;
  const endedAt = session.stoppedAt ?? session.fault?.at ?? at;
  let next: SimState = state;
  let evidenceId: string | null = null;
  if (recorded) {
    // S31-7: an interrupted recording keeps its media as a RECORDED, unsealed evidence item.
    const seq = next.meta.counters.evidence;
    evidenceId = session.evidenceId ?? evidenceIdFor(seq, session.createdAt);
    const recordedAt = session.startedAt ?? session.createdAt;
    const item = createEvidenceItem({
      evidenceId,
      sessionId: session.id,
      caseNumber: session.input.caseNumber,
      recordedAt,
      endedAt,
      sizeBytes: session.bytesWritten,
      subjectName: session.input.subjectName,
      subjectType: session.input.subjectType,
      investigatorId: session.input.investigatorId,
      room: session.input.room,
      profileId: session.input.profileId,
      sealedAt: null,
      status: 'RECORDED',
      markers: sessionMarkers(session),
      notes: itemNotesOf(session),
      startTimeSource: session.startTimeSource ?? null,
      endTimeSource: session.stopTimeSource ?? null,
      custody: [
        { at: recordedAt, action: 'RECORDING_STARTED', actorId: recordingActor(state, session, 'START'), detail: null },
        {
          at: endedAt,
          action: 'SESSION_INCOMPLETE',
          actorId: null,
          detail: faultKind ? `${faultKind}; recovered` : 'Recovered',
        },
      ],
    });
    next = {
      ...next,
      meta: session.evidenceId ? next.meta : { ...next.meta, counters: { ...next.meta.counters, evidence: seq + 1 } },
      evidence: [...next.evidence, item],
    };
  }
  const entry = historyEntry(session, SessionOutcome.INCOMPLETE, endedAt, evidenceId, faultKind);
  next = withSession({ ...next, sessionHistory: [entry, ...next.sessionHistory] }, null);
  return record(next, at, [
    {
      audit: {
        type: 'SESSION_INCOMPLETE',
        message: `Session ${session.id} marked INCOMPLETE (never sealed)`,
        severity: 'WARNING',
        sessionId: session.id,
        evidenceId,
        details: { faultKind },
      },
      event: {
        type: 'SESSION_INCOMPLETE',
        message: `Session ${session.id} recovered as INCOMPLETE`,
        severity: 'WARNING',
        sessionId: session.id,
      },
    },
    {
      audit: {
        type: 'RECOVERY_COMPLETED',
        message: `Recovery completed for ${session.id}`,
        sessionId: session.id,
      },
      event: { type: 'RECOVERY_COMPLETED', message: `Recovery completed · ${session.id}`, sessionId: session.id },
    },
  ]);
}

// ── In-session actions (SM action bar; mobile S5) ────────────────────────────────────────

export function addMarkerTransition(state: SimState, now: EpochMs, label?: string): SimState {
  const session = requireSession(state, 'addMarker', [SessionState.RECORDING]);
  const count = session.markerCount + 1;
  // 80 code units, cut so that a surrogate pair is never split (SIM-GAP-1).
  const text = typeof label === 'string' && label.trim() ? cutText(label.trim(), 80) : `Marker ${count}`;
  let next: SimState = { ...state, session: { ...session, markerCount: count } };
  next = addTimelineItem(next, { at: now, kind: 'MARKER', label: text, detail: null, channel: null, params: { index: count, label: text } });
  return record(next, now, {
    audit: {
      type: 'MARKER_ADDED',
      message: `Marker added: ${text}`,
      actorId: signedInOperatorId(state),
      sessionId: session.id,
      details: { label: text, index: count },
    },
    event: { type: 'MARKER_ADDED', message: `Marker added · ${text}`, sessionId: session.id },
  });
}

/**
 * The English fallback label of a note by an author of `role` (E2E-T-5): "Supervisor note",
 * "Investigator note", "Technician note"; "Note" when the author is not known. Clients render
 * their own copy from the timeline item's `params.authorRole` (`timelineTitleKey`).
 */
export function noteLabel(role: OperatorRole | null): string {
  switch (role) {
    case OperatorRole.SUPERVISOR:
      return 'Supervisor note';
    case OperatorRole.INVESTIGATOR:
      return 'Investigator note';
    case OperatorRole.TECHNICIAN:
      return 'Technician note';
    default:
      return 'Note';
  }
}

export function addNoteTransition(state: SimState, now: EpochMs, text: string): SimState {
  const session = requireSession(state, 'addNote', [SessionState.RECORDING]);
  const body = typeof text === 'string' ? text.trim() : '';
  if (!body || body.length > 2_000) {
    throw new SimTransitionError(session.state, 'addNote', 'note text must be 1-2000 characters', SimErrorCode.NOTE_INVALID);
  }
  const { id, meta } = nextItemId(state.meta, 'NOTE');
  const authorId = signedInOperatorId(state);
  // E2E-T-5: the note is labelled by its author's role at the time of writing (a SUPERVISOR's note
  // read "Investigator note"). The note record keeps `authorId`; the timeline item carries the role.
  const authorRole = findOperatorById(state.operators, authorId)?.role ?? null;
  const label = noteLabel(authorRole);
  let next: SimState = {
    ...state,
    meta,
    session: { ...session, notes: [...session.notes, { id, at: now, authorId, text: body }] },
  };
  next = addTimelineItem(next, {
    at: now,
    kind: 'NOTE',
    label,
    // At most 139 code units and an ellipsis; the cut never splits a surrogate pair (SIM-GAP-1).
    detail: body.length > 140 ? `${cutText(body, 139)}…` : body,
    channel: null,
    params: authorRole === null ? { noteId: id, length: body.length } : { noteId: id, length: body.length, authorRole },
  });
  // The audit row proves a note was added; the note text stays in the session record.
  return record(next, now, {
    audit: {
      type: 'NOTE_ADDED',
      message: `${label} added`,
      actorId: authorId,
      sessionId: session.id,
      details: { noteId: id, length: body.length },
    },
    event: { type: 'NOTE_ADDED', message: `${label} added`, sessionId: session.id },
  });
}

export function snapshotTransition(state: SimState, now: EpochMs): SimState {
  const session = requireSession(state, 'snapshot', [SessionState.RECORDING]);
  const count = session.snapshotCount + 1;
  const camera = state.cameras.find((c) => c.id === state.activeCameraId);
  let next: SimState = { ...state, session: { ...session, snapshotCount: count } };
  next = addTimelineItem(next, {
    at: now,
    kind: 'SNAPSHOT',
    label: `Snapshot ${count}`,
    detail: camera?.name ?? state.activeCameraId,
    channel: null,
    params: { index: count, cameraId: state.activeCameraId },
  });
  return record(next, now, {
    audit: {
      type: 'SNAPSHOT_TAKEN',
      message: `Snapshot ${count} captured (${state.activeCameraId})`,
      actorId: signedInOperatorId(state),
      sessionId: session.id,
      details: { cameraId: state.activeCameraId, index: count },
    },
    event: { type: 'SNAPSHOT_TAKEN', message: `Snapshot captured · ${camera?.name ?? state.activeCameraId}`, sessionId: session.id },
  });
}

/** SCR-02: acknowledges the summary of `lastSealedSessionId`. Other IDs and repeats are no-ops. */
export function acknowledgeSummaryTransition(state: SimState, now: EpochMs, sessionId: string): SimState {
  if (state.lastSealedSessionId !== sessionId || state.lastSealedAcknowledged) return state;
  return record({ ...state, lastSealedAcknowledged: true }, now, {
    audit: {
      type: 'SUMMARY_ACKNOWLEDGED',
      message: `Session summary acknowledged (${sessionId})`,
      actorId: signedInOperatorId(state),
      sessionId,
    },
  });
}

// ── The machine tick ─────────────────────────────────────────────────────────────────────

/** Runs every timed transition that is due at `now` (several in one call after a catch-up). */
export function tickMachine(state: SimState, now: EpochMs, rng: RngStreams, capture: CaptureLevelSource = 'simulated', captureConnectMs?: number): SimState {
  let current = state;
  for (let guard = 0; guard < 8; guard += 1) {
    let next = advancePrecheck(current, now);
    // The simulator's own capture decides a connecting start by the time; an external one never.
    if (capture === 'simulated') next = advanceCaptureStart(next, now, captureConnectMs);
    // Wave H driver B (G75-07): the warning of a degraded start ends when its session no longer records.
    if (capture === 'simulated') next = advanceCaptureEnd(next, now);
    next = advanceStopping(next, now, rng);
    next = advanceFinalization(next, now);
    next = advanceRecovery(next, now);
    if (next === current) break;
    current = next;
  }
  return current;
}
