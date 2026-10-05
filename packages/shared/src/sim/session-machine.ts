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
import { FinalizationStep, SessionState, type TimeSource } from '../domain';
import { DEFAULT_SESSION_ROOM, sessionCreateSchema } from '../api/session-schema';
import { findOperatorById, requirePermission, roleHas } from './auth';
import {
  FINALIZATION_STEP_MAX_MS,
  FINALIZATION_STEP_MIN_MS,
  PRECHECK_CHECK_MAX_MS,
  PRECHECK_CHECK_MIN_MS,
  PRECHECK_TOTAL_MAX_MS,
  RECOVERY_MS,
  RECOVERY_SCAN_MS,
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
import { SimErrorCode, SimTransitionError } from './errors';
import { nextItemId, pushRing, recordActivity, type ActivityInput } from './events';
import { createEvidenceItem } from './evidence';
import { RngStream, type Rng, type RngStreams } from './rng';
import { cutText } from './text-cut';
import type {
  ActiveSession,
  CreateSessionResult,
  EpochMs,
  EvidenceMarker,
  FinalizationStepState,
  PrecheckItem,
  PrecheckSlice,
  SessionCreateInput,
  SessionHistoryEntry,
  SimState,
  TimelineEvent,
} from './types';
import {
  AuthStatus,
  CRITICAL_FAULTS,
  FaultEvt,
  FaultKind,
  Permission,
  PRECHECK_ORDER,
  PrecheckReasonCode,
  SessionOutcome,
  SubjectType,
  type PrecheckCheckId,
  type PrecheckStatus,
} from './vocabulary';

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
export const FINALIZATION_ORDER = [
  FinalizationStep.FINALIZE_TRACKS,
  FinalizationStep.CALCULATE_HASHES,
  FinalizationStep.BUILD_MANIFEST,
  FinalizationStep.ENCRYPT_PAYLOAD,
  FinalizationStep.SIGN_MANIFEST,
  FinalizationStep.STORE_SEALED_PACKAGE,
] as const;

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
      const camera = state.cameras.find((c) => c.id === track);
      return !camera || camera.lens === 'FAULT' || !camera.online
        ? { status: 'BLOCK', value: 'FAULT', reason: `${camera?.name ?? id} lens fault`, reasonCode: R.LENS_FAULT, params: { track } }
        : { status: 'PASS', value: 'READY', ...PASSED };
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
    precheck: { items, startedAt: now, completedAt: null, outcome: null, warningsAcknowledged: false },
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
  const warnings = items.filter((item) => item.status === 'WARN');
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
  const warnings = session.precheck.items.filter((item) => item.status === 'WARN').length;
  const acknowledged: ActiveSession = {
    ...session,
    precheck: { ...session.precheck, warningsAcknowledged: true },
  };
  return arm({ ...state, session: acknowledged }, acknowledged, now, warnings, actorId);
}

// ── RECORDING, STOPPING, cancel ──────────────────────────────────────────────────────────

/** ARMED → RECORDING. `startedAt = now`; audit RECORDING_STARTED; timeline START. */
export function startRecordingTransition(state: SimState, now: EpochMs): SimState {
  const actorId = requireSessionOperator(state, 'startRecording');
  const session = requireSession(state, 'startRecording', [SessionState.ARMED]);
  let next = withSession(state, {
    ...session,
    state: SessionState.RECORDING,
    startedAt: now,
    startTimeSource: state.time.source,
  });
  next = addTimelineItem(next, {
    at: now,
    kind: 'START',
    label: 'Recording started',
    detail: session.id,
    channel: null,
    params: { sessionId: session.id, timeSource: state.time.source },
  });
  return record(next, now, {
    audit: {
      type: 'RECORDING_STARTED',
      message: `Recording started (${session.id})`,
      actorId,
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

/** CREATE, PRECHECK or ARMED → no session. Audit SESSION_CANCELLED. */
export function cancelTransition(state: SimState, now: EpochMs): SimState {
  const actorId = requireSessionOperator(state, 'cancel');
  const session = requireSession(state, 'cancel', CANCELLABLE_STATES);
  return record(withSession(state, null), now, {
    audit: {
      type: 'SESSION_CANCELLED',
      message: `Session ${session.id} cancelled`,
      actorId,
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
  const at = session.stoppedAt + STOPPING_MS;
  if (now < at) return state;
  const random = rng.get(RngStream.FINALIZATION);
  const steps: FinalizationStepState[] = FINALIZATION_ORDER.map((id, index) => ({
    id,
    status: index === 0 ? 'active' : 'pending',
    startedAt: index === 0 ? at : null,
    completedAt: null,
    durationMs: random.int(FINALIZATION_STEP_MIN_MS, FINALIZATION_STEP_MAX_MS),
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
      { at: recordedAt, action: 'RECORDING_STARTED', actorId: session.createdBy, detail: null },
      { at: endedAt, action: 'RECORDING_STOPPED', actorId: session.createdBy, detail: session.stopReason },
      { at, action: 'SEALED', actorId: null, detail: null },
    ],
    markers: sessionMarkers(session),
    notes: session.notes,
    startTimeSource: session.startTimeSource ?? null,
    endTimeSource: session.stopTimeSource ?? null,
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

/** Completes every finalization step whose time has come; seals after the sixth. */
export function advanceFinalization(state: SimState, now: EpochMs): SimState {
  const session = state.session;
  if (!session || session.state !== SessionState.FINALIZING) return state;
  const steps = session.finalization.steps.slice();
  let changed = false;
  let sealAt: EpochMs | null = null;
  for (;;) {
    const index = steps.findIndex((step) => step.status === 'active');
    const step = steps[index];
    if (!step || step.startedAt === null) break;
    const due = step.startedAt + (step.durationMs ?? FINALIZATION_STEP_MIN_MS);
    if (now < due) break;
    steps[index] = { ...step, status: 'done', completedAt: due };
    changed = true;
    const following = steps[index + 1];
    if (following) steps[index + 1] = { ...following, status: 'active', startedAt: due };
    else {
      sealAt = due;
      break;
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
  let next = withSession(settled.state, {
    ...settled.session,
    state: SessionState.FAULT,
    fault: { kind, at: now, fromState: session.state },
    ...(wasRecording ? { stopTimeSource: state.time.source as TimeSource } : {}),
  });
  if (wasRecording) {
    next = addTimelineItem(next, {
      at: now,
      kind: 'FAULT',
      label: `Critical fault: ${kind}`,
      detail: null,
      channel: null,
      params: { kind, evt: FaultEvt[kind], critical: true },
    });
  }
  return next;
}

/** FAULT → RECOVERY: RECOVERY_SCAN, then INCOMPLETE_SESSION_ANALYSIS, 3 s in total. */
export function recoverTransition(state: SimState, now: EpochMs): SimState {
  const session = requireSession(state, 'recover', [SessionState.FAULT]);
  const items: ActivityInput[] = [];
  if (session.fault?.kind === FaultKind.POWER_FAIL) {
    items.push({
      audit: {
        type: 'SYSTEM_BOOT',
        message: `${PRODUCT_NAME} restarted after power fail`,
        deviceId: DEVICE_ID,
        details: { afterFault: FaultKind.POWER_FAIL },
      },
      event: { type: 'SYSTEM_BOOT', message: 'System restarted after power fail', severity: 'WARNING', deviceId: DEVICE_ID },
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
      notes: session.notes,
      startTimeSource: session.startTimeSource ?? null,
      endTimeSource: session.stopTimeSource ?? null,
      custody: [
        { at: recordedAt, action: 'RECORDING_STARTED', actorId: session.createdBy, detail: null },
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

export function addNoteTransition(state: SimState, now: EpochMs, text: string): SimState {
  const session = requireSession(state, 'addNote', [SessionState.RECORDING]);
  const body = typeof text === 'string' ? text.trim() : '';
  if (!body || body.length > 2_000) {
    throw new SimTransitionError(session.state, 'addNote', 'note text must be 1-2000 characters', SimErrorCode.NOTE_INVALID);
  }
  const { id, meta } = nextItemId(state.meta, 'NOTE');
  const authorId = signedInOperatorId(state);
  let next: SimState = {
    ...state,
    meta,
    session: { ...session, notes: [...session.notes, { id, at: now, authorId, text: body }] },
  };
  next = addTimelineItem(next, {
    at: now,
    kind: 'NOTE',
    label: 'Investigator note',
    // At most 139 code units and an ellipsis; the cut never splits a surrogate pair (SIM-GAP-1).
    detail: body.length > 140 ? `${cutText(body, 139)}…` : body,
    channel: null,
    params: { noteId: id, length: body.length },
  });
  // The audit row proves a note was added; the note text stays in the session record.
  return record(next, now, {
    audit: {
      type: 'NOTE_ADDED',
      message: 'Investigator note added',
      actorId: authorId,
      sessionId: session.id,
      details: { noteId: id, length: body.length },
    },
    event: { type: 'NOTE_ADDED', message: 'Investigator note added', sessionId: session.id },
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
export function tickMachine(state: SimState, now: EpochMs, rng: RngStreams): SimState {
  let current = state;
  for (let guard = 0; guard < 8; guard += 1) {
    let next = advancePrecheck(current, now);
    next = advanceStopping(next, now, rng);
    next = advanceFinalization(next, now);
    next = advanceRecovery(next, now);
    if (next === current) break;
    current = next;
  }
  return current;
}
