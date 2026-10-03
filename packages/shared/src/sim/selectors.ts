/**
 * Selectors: pure reads over `SimState` (masterplan/01_specs.md §14.5 "Data" column;
 * 04_mobile_specs.md §5.6). Use them with `useSim(selector)`; `useSim` compares results
 * shallowly, so a selector may return a fresh object or array of stable members.
 *
 * Derived values live here, not in the state, so they can never disagree with their
 * sources (one event stream, one dataset: 04 §9 #12-#18).
 */
import { SessionState, type AudioTrackId, type TimeSource, type TrackId } from '../domain';
import { findOperatorById, lockoutStatus, roleHas, type LockoutStatus } from './auth';
import { startOfWibDay, wibDateParts } from './clock';
import { RECORDING_BYTES_PER_HOUR, STORAGE_FULL_PERCENT, STORAGE_LOW_PERCENT } from './constants';
import { caseNumberFor } from './dataset';
import { stableSelector } from './memo';
import type {
  ActiveSession,
  AuditRow,
  CameraStatus,
  EpochMs,
  EvidenceItem,
  MicStatus,
  SessionHistoryEntry,
  SimAlert,
  SimEvent,
  SimOperator,
  SimState,
  StorageVolume,
  WriteRatePoint,
} from './types';
import {
  AuthStatus,
  EvidenceStatus,
  Permission,
  Severity,
  SignOutReason,
  SystemState,
  type OperatorRole,
  type SimEventType,
} from './vocabulary';

const EMPTY: never[] = [];

// ── Auth ─────────────────────────────────────────────────────────────────────────────────
export const selectAuth = (s: SimState) => s.auth;
export const selectIsSignedIn = (s: SimState): boolean => s.auth.status === AuthStatus.SIGNED_IN;
export const selectOperator = (s: SimState): SimOperator | null =>
  s.auth.status === AuthStatus.SIGNED_IN ? findOperatorById(s.operators, s.auth.operatorId) : null;
export const selectRole = (s: SimState): OperatorRole | null => selectOperator(s)?.role ?? null;
export const selectCan = (s: SimState, permission: Permission): boolean =>
  roleHas(selectRole(s), permission);
/**
 * Lockout at the published sim time (the component only displays it, §14.8). Its `retryInMs`
 * changes at 10 Hz: for a countdown use `selectLockoutSeconds` (1 Hz; review 40 m9).
 */
export const selectLockout = (s: SimState): LockoutStatus => lockoutStatus(s.authLockout, s.clock.now);
/** Whole seconds until the lockout ends (0 when not locked): changes at 1 Hz (step 54, m9). */
export const selectLockoutSeconds = (s: SimState): number => Math.ceil(selectLockout(s).retryInMs / 1_000);
/** Whether the console is locked (a primitive; step 54). */
export const selectIsLocked = (s: SimState): boolean => selectLockout(s).locked;
/** Failures left before the lockout (a primitive; step 54). */
export const selectAttemptsRemaining = (s: SimState): number => selectLockout(s).attemptsRemaining;

/** Why the last operator session ended (step 54, SIM-GAP-W43-2). */
export interface LastSignOut {
  /** USER (Sign out), LOCK (Lock console) or EXPIRED (15 min idle). */
  reason: SignOutReason | 'EXPIRED';
  at: EpochMs;
  operatorId: string | null;
}

const lastSignOutCache = new WeakMap<readonly SimEvent[], LastSignOut | null>();

/**
 * The newest sign-out, console lock or idle expiry, from the event ring (survives a reload), or
 * null when the newest auth event is a sign-in (or there is none). Memoised on the events array,
 * so the result is the same object until a new event arrives.
 */
export const selectLastSignOut = (s: SimState): LastSignOut | null => {
  const cached = lastSignOutCache.get(s.events);
  if (cached !== undefined) return cached;
  let result: LastSignOut | null = null;
  for (let index = s.events.length - 1; index >= 0; index -= 1) {
    const event = s.events[index];
    if (!event) continue;
    if (event.type === 'AUTH_LOGIN') break;
    if (event.type === 'AUTH_EXPIRED') {
      const operatorId = typeof event.params.operatorId === 'string' ? event.params.operatorId : null;
      result = { reason: 'EXPIRED', at: event.at, operatorId };
      break;
    }
    if (event.type === 'AUTH_LOGOUT') {
      const operatorId = typeof event.params.operatorId === 'string' ? event.params.operatorId : null;
      result = { reason: event.params.reason === SignOutReason.LOCK ? SignOutReason.LOCK : SignOutReason.USER, at: event.at, operatorId };
      break;
    }
  }
  lastSignOutCache.set(s.events, result);
  return result;
};
export const selectOperatorById = (s: SimState, operatorId: string | null): SimOperator | null =>
  findOperatorById(s.operators, operatorId);

// ── Session ──────────────────────────────────────────────────────────────────────────────
export const selectSession = (s: SimState): ActiveSession | null => s.session;
export const selectSessionState = (s: SimState): SessionState | null => s.session?.state ?? null;
export const selectIsRecording = (s: SimState): boolean =>
  s.session?.state === SessionState.RECORDING;
/**
 * Recording time: clock-derived (S4), frozen once the recording stopped. Changes at 10 Hz: for a
 * 1 Hz timer use `selectElapsedSeconds` (review 40 m9).
 */
export const selectElapsedMs = (s: SimState): number => {
  const session = s.session;
  if (!session || session.startedAt === null) return 0;
  const end = session.stoppedAt ?? s.clock.now;
  return Math.max(0, end - session.startedAt);
};
/** Whole seconds of recording time: changes at 1 Hz (step 54, m9; §9.3). */
export const selectElapsedSeconds = (s: SimState): number => Math.floor(selectElapsedMs(s) / 1_000);
export const selectTimeline = (s: SimState) => s.session?.timeline ?? EMPTY;
/** SCR-02: the sealed session whose summary still needs acknowledging, or null. */
export const selectPendingSummaryId = (s: SimState): string | null =>
  s.lastSealedSessionId !== null && !s.lastSealedAcknowledged ? s.lastSealedSessionId : null;
/** Newest first. */
export const selectSessionHistory = (s: SimState): SessionHistoryEntry[] =>
  s.sessionHistory.slice().sort((a, b) => b.endedAt - a.endedAt);
export const selectRecentSessions = (s: SimState, count = 3): SessionHistoryEntry[] =>
  selectSessionHistory(s).slice(0, count);
export const selectSessionHistoryById = (s: SimState, sessionId: string) =>
  s.sessionHistory.find((entry) => entry.id === sessionId) ?? null;
/**
 * The case number the simulated scanner offers next, `LP/{YYYY}/{MMDD}-NNNN` on the sim clock's day
 * (step 54, SIM-GAP-W46-1 / M78-1). A string: changes only when the counter or the day changes.
 * `actions.scanCaseNumber()` returns it and reserves it.
 */
export const selectNextCaseNumber = (s: SimState): string => caseNumberFor(s.meta.counters.caseNumber, s.clock.now);
/** Time source at the start / end of a finished session (step 54, SIM-GAP-M80-1); null when unknown. */
export const selectHistoryTimeSources = (
  s: SimState,
  sessionId: string,
): { start: TimeSource | null; end: TimeSource | null } | null => {
  const entry = selectSessionHistoryById(s, sessionId);
  return entry ? { start: entry.startTimeSource ?? null, end: entry.endTimeSource ?? null } : null;
};

// ── Devices ──────────────────────────────────────────────────────────────────────────────
export const selectCameras = (s: SimState): CameraStatus[] => s.cameras;
export const selectMics = (s: SimState): MicStatus[] => s.mics;
export const selectCameraById = (s: SimState, id: TrackId) => s.cameras.find((c) => c.id === id) ?? null;
export const selectMicById = (s: SimState, id: AudioTrackId) => s.mics.find((m) => m.id === id) ?? null;
/** Any device by its device ID (CAM-01, MIC-02, POE-SWITCH, …) for the device drawer. */
export const selectDeviceById = (s: SimState, deviceId: string) =>
  s.cameras.find((c) => c.deviceId === deviceId) ??
  s.mics.find((m) => m.deviceId === deviceId) ??
  s.otherDevices.find((d) => d.id === deviceId) ??
  null;

export interface DeviceStats {
  camerasOnline: number;
  camerasTotal: number;
  micsReady: number;
  micsTotal: number;
  otherOnline: number;
  otherTotal: number;
}
export const selectDeviceStats = (s: SimState): DeviceStats => ({
  camerasOnline: s.cameras.filter((c) => c.online && c.lens === 'READY').length,
  camerasTotal: s.cameras.length,
  micsReady: s.mics.filter((m) => m.state === 'READY').length,
  micsTotal: s.mics.length,
  otherOnline: s.otherDevices.filter((d) => d.online).length,
  otherTotal: s.otherDevices.length,
});

// ── Storage (D28/Q1 USED %; AC-54 estimated remaining) ──────────────────────────────────
export function evidenceVolume(s: Pick<SimState, 'storage'>): StorageVolume | null {
  return s.storage.volumes.find((v) => v.kind === 'EVIDENCE') ?? null;
}

export interface StorageSummary {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  /** Whole percent, rounded (804 GB of 4.0 TB → 20). */
  usedPercent: number;
  /** Unrounded share, 0-100. */
  usedRatioPercent: number;
  /** free ÷ 8.2 GB/h, in milliseconds. */
  estimatedRemainingMs: number;
  state: SimState['storage']['state'];
}

export function storageSummary(s: Pick<SimState, 'storage'>): StorageSummary {
  const volume = evidenceVolume(s);
  const totalBytes = volume?.totalBytes ?? 0;
  const usedBytes = volume?.usedBytes ?? 0;
  const freeBytes = Math.max(0, totalBytes - usedBytes);
  const ratio = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
  return {
    totalBytes,
    usedBytes,
    freeBytes,
    usedPercent: Math.round(ratio),
    usedRatioPercent: ratio,
    estimatedRemainingMs: (freeBytes / RECORDING_BYTES_PER_HOUR) * 3_600_000,
    state: s.storage.state,
  };
}
export const selectStorage = (s: SimState): StorageSummary => storageSummary(s);

/** READY / LOW / FULL from a used percentage (thresholds are a demo assumption, 04 G8). */
export function storageStateFor(usedRatioPercent: number): SimState['storage']['state'] {
  if (usedRatioPercent >= STORAGE_FULL_PERCENT) return 'FULL';
  if (usedRatioPercent >= STORAGE_LOW_PERCENT) return 'LOW';
  return 'READY';
}

// ── Evidence ─────────────────────────────────────────────────────────────────────────────
export const selectEvidence = (s: SimState): EvidenceItem[] => s.evidence;
export const selectEvidenceById = (s: SimState, evidenceId: string): EvidenceItem | null =>
  s.evidence.find((item) => item.id === evidenceId) ?? null;

export interface EvidenceStats {
  total: number;
  recorded: number;
  sealed: number;
  exported: number;
  underReview: number;
  archived: number;
  /** Awaiting sealing or review: the RECORDED items ("1 pending"). */
  pending: number;
  sealedToday: number;
}
export const selectEvidenceStats = (s: SimState): EvidenceStats => {
  const count = (status: EvidenceStatus) => s.evidence.filter((e) => e.status === status).length;
  return {
    total: s.evidence.length,
    recorded: count(EvidenceStatus.RECORDED),
    sealed: count(EvidenceStatus.SEALED),
    exported: count(EvidenceStatus.EXPORTED),
    underReview: count(EvidenceStatus.UNDER_REVIEW),
    archived: count(EvidenceStatus.ARCHIVED),
    pending: count(EvidenceStatus.RECORDED),
    sealedToday: selectSealedToday(s),
  };
};

/** Items sealed per WIB hour of the current sim day (Dashboard H). A new seal bumps its hour. */
export function sealedHourly(s: Pick<SimState, 'evidence' | 'clock'>): number[] {
  const buckets: number[] = Array.from({ length: 24 }, () => 0);
  const dayStart = startOfWibDay(s.clock.now);
  const dayEnd = dayStart + 86_400_000;
  for (const item of s.evidence) {
    if (item.sealedAt === null || item.sealedAt < dayStart || item.sealedAt >= dayEnd) continue;
    const hour = wibDateParts(item.sealedAt).hour;
    buckets[hour] = (buckets[hour] ?? 0) + 1;
  }
  return buckets;
}
export const selectSealedHourly = (s: SimState): number[] => sealedHourly(s);
export const selectSealedToday = (s: SimState): number =>
  sealedHourly(s).reduce((sum, value) => sum + value, 0);

// ── Events, alerts, audit ────────────────────────────────────────────────────────────────
/** Newest first. */
export const selectRecentEvents = (s: SimState, count = 6): SimEvent[] =>
  s.events.slice(-count).reverse();
export const selectActiveAlerts = (s: SimState): SimAlert[] => s.alerts.filter((a) => a.active);
const SEVERITY_RANK = { INFO: 0, SUCCESS: 0, WARNING: 1, CRITICAL: 2 } as const satisfies Record<Severity, number>;
export const selectWorstAlert = (s: SimState): SimAlert | null =>
  selectActiveAlerts(s).reduce<SimAlert | null>(
    (worst, alert) => (!worst || SEVERITY_RANK[alert.severity] > SEVERITY_RANK[worst.severity] ? alert : worst),
    null,
  );
export const selectUnacknowledgedAlertCount = (s: SimState): number =>
  s.alerts.filter((a) => a.active && !a.acknowledged).length;
/** Newest first. */
export const selectAuditTail = (s: SimState, count = 12): AuditRow[] => s.audit.rows.slice(-count).reverse();
export const selectChainHead = (s: SimState): string => s.audit.head;

// ── System state (GlowRing; 01_specs §14.6) ──────────────────────────────────────────────
/** Structured values of a flag (step 54, review 40 §5.b): consumers never parse `message`. */
export interface SystemFlagParams {
  track?: TrackId;
  source?: TimeSource;
  /** The device's EN name (fallback only; copy comes from `track`). */
  name?: string;
}

export interface SystemFlag {
  id: string;
  severity: typeof Severity.WARNING | typeof Severity.CRITICAL;
  /** EN fallback text; the UI renders i18n copy from `id` and `params`. */
  message: string;
  /** Step 54: `{track}` for CAMERA_* and MIC_*, `{source}` for TIME_FALLBACK. Absent on hand-built flags. */
  params?: SystemFlagParams;
}

export interface SystemStatus {
  state: SystemState;
  flags: SystemFlag[];
}

/** Worst flag severity: OK (no flag), WARNING or CRITICAL (step 54, D96). */
export type SystemSeverity = 'OK' | 'WARNING' | 'CRITICAL';

/**
 * `SystemStatus` plus the worst flag severity (step 54, D96). The ring shows RECORDING while a
 * recording runs without a critical flag, but a warning must stay visible: consumers that summarise
 * (the SECURE pill) read `severity`, which RECORDING never hides.
 */
export interface SystemStatusDetail extends SystemStatus {
  severity: SystemSeverity;
}

/** Every flag ID `systemStatus` can emit (a finite set: step 54, review 40 §5.b). */
export const SYSTEM_FLAG_IDS = [
  'SESSION_FAULT',
  'POWER_FAIL',
  'AUDIT_CHAIN',
  'STORAGE_FULL',
  'SECURITY_FAULT',
  'CAMERA_VIDEO-01',
  'CAMERA_VIDEO-02',
  'STORAGE_LOW',
  'MIC_AUDIO-01_NO_SIGNAL',
  'MIC_AUDIO-01_CLIP',
  'MIC_AUDIO-02_NO_SIGNAL',
  'MIC_AUDIO-02_CLIP',
  'TIME_FALLBACK',
  'FAN_STALL',
  'TAMPER',
  'TABLET_OFFLINE',
  'RECOVERY',
] as const;
export type SystemFlagId = (typeof SYSTEM_FLAG_IDS)[number];

/** Computes the status afresh (a new object on every call). Components use `selectSystemState`. */
export function systemStatus(s: SimState): SystemStatusDetail {
  const flags: SystemFlag[] = [];
  const critical = (id: SystemFlagId, message: string, params: SystemFlagParams = {}) =>
    flags.push({ id, severity: 'CRITICAL', message, params });
  const warning = (id: SystemFlagId, message: string, params: SystemFlagParams = {}) =>
    flags.push({ id, severity: 'WARNING', message, params });

  if (s.session?.state === SessionState.FAULT) critical('SESSION_FAULT', 'Session fault');
  if (s.faults.active.some((fault) => fault.kind === 'POWER_FAIL')) critical('POWER_FAIL', 'Power fail');
  if (s.faults.active.some((fault) => fault.kind === 'AUDIT_TAMPER')) {
    critical('AUDIT_CHAIN', 'Audit chain discontinuity');
  }
  if (s.storage.state === 'FULL') critical('STORAGE_FULL', 'Evidence storage full');
  if (s.security.state === 'FAULT') critical('SECURITY_FAULT', 'Security fault');
  for (const camera of s.cameras) {
    if (camera.lens === 'FAULT' || !camera.online) {
      critical(`CAMERA_${camera.id}`, `${camera.name} offline`, { track: camera.id, name: camera.name });
    }
  }
  if (s.storage.state === 'LOW') warning('STORAGE_LOW', 'Evidence storage low');
  for (const mic of s.mics) {
    if (mic.state === 'NO_SIGNAL') warning(`MIC_${mic.id}_NO_SIGNAL`, `${mic.name}: no signal`, { track: mic.id, name: mic.name });
    if (mic.state === 'CLIP' || mic.clipLatched) warning(`MIC_${mic.id}_CLIP`, `${mic.name}: clipping`, { track: mic.id, name: mic.name });
  }
  if (s.time.source !== 'GNSS') warning('TIME_FALLBACK', `Time source ${s.time.source}`, { source: s.time.source });
  if (!s.health.fanOk) warning('FAN_STALL', 'Fan stalled');
  if (s.security.tamper) warning('TAMPER', 'Tamper detected');
  if (s.tabletLink.state === 'OFFLINE') warning('TABLET_OFFLINE', 'Tablet offline');
  if (s.session?.state === SessionState.RECOVERY) warning('RECOVERY', 'Recovery in progress');

  const hasCritical = flags.some((f) => f.severity === 'CRITICAL');
  let state: SystemState;
  if (hasCritical) state = SystemState.CRITICAL;
  else if (s.session?.state === SessionState.RECORDING) state = SystemState.RECORDING;
  else if (flags.length > 0) state = SystemState.ATTENTION;
  else state = SystemState.READY;
  const severity: SystemSeverity = hasCritical ? 'CRITICAL' : flags.length > 0 ? 'WARNING' : 'OK';
  return { state, flags, severity };
}

/**
 * The system status, referentially stable (step 54, review 40 M1): the same object while its
 * inputs are the same references, and while a recomputed status deep-equals the previous one
 * (the 1 Hz health tick replaces `time`, `health` and `storage` without changing the status).
 * Safe for `useSim(selectSystemState)`.
 */
export const selectSystemState: (s: SimState) => SystemStatusDetail = stableSelector(
  (s: SimState) => [s.session, s.faults, s.storage, s.security, s.cameras, s.mics, s.time, s.health, s.tabletLink],
  systemStatus,
);
/** The ring state alone (a primitive; step 54). */
export const selectSystemStateValue = (s: SimState): SystemState => selectSystemState(s).state;
/** The worst flag severity, never hidden by RECORDING (a primitive; step 54, D96). */
export const selectSystemSeverity = (s: SimState): SystemSeverity => selectSystemState(s).severity;
const flagIdsOf = new WeakMap<SystemStatusDetail, string[]>();
/** The active flag IDs, in display order (a stable array while the status is unchanged; step 54). */
export const selectSystemFlagIds = (s: SimState): string[] => {
  const status = selectSystemState(s);
  let ids = flagIdsOf.get(status);
  if (!ids) {
    ids = status.flags.map((flag) => flag.id);
    flagIdsOf.set(status, ids);
  }
  return ids;
};

// ── SECURE pill checklist (step 54; review 40 m5, D96) ──────────────────────────────────
/** The SECURE pill rows (same IDs and order as the shell's `INTEGRITY_CHECK_IDS`). */
export const INTEGRITY_CHECKLIST_IDS = [
  'encryption',
  'hashChain',
  'platform',
  'tamper',
  'timeSource',
  'storage',
  'inputs',
  'recording',
  'tablet',
] as const;
export type IntegrityChecklistId = (typeof INTEGRITY_CHECKLIST_IDS)[number];
export type IntegrityCheckStatus = 'OK' | 'ATTENTION' | 'CRITICAL';

/**
 * The row each system flag belongs to. Every flag maps to exactly one row, so the checklist can
 * never read all-OK while the ring shows a flag (POWER_FAIL lands on `recording`: a power fail
 * interrupts the recording pipeline; FAN_STALL on `platform`: the hardware).
 */
export const FLAG_CHECKLIST_ROW = {
  SESSION_FAULT: 'recording',
  POWER_FAIL: 'recording',
  AUDIT_CHAIN: 'hashChain',
  STORAGE_FULL: 'storage',
  SECURITY_FAULT: 'platform',
  'CAMERA_VIDEO-01': 'inputs',
  'CAMERA_VIDEO-02': 'inputs',
  STORAGE_LOW: 'storage',
  'MIC_AUDIO-01_NO_SIGNAL': 'inputs',
  'MIC_AUDIO-01_CLIP': 'inputs',
  'MIC_AUDIO-02_NO_SIGNAL': 'inputs',
  'MIC_AUDIO-02_CLIP': 'inputs',
  TIME_FALLBACK: 'timeSource',
  FAN_STALL: 'platform',
  TAMPER: 'tamper',
  TABLET_OFFLINE: 'tablet',
  RECOVERY: 'recording',
} as const satisfies Record<SystemFlagId, IntegrityChecklistId>;

const CHECK_RANK = { OK: 0, ATTENTION: 1, CRITICAL: 2 } as const satisfies Record<IntegrityCheckStatus, number>;

const checklistOf = new WeakMap<SystemStatusDetail, IntegrityCheckStatus[]>();

/**
 * One status per `INTEGRITY_CHECKLIST_IDS` row, derived from the system flags only, so it always
 * agrees with the ring and the pill (review 40 m5, D96): a flag sets its row to ATTENTION
 * (WARNING) or CRITICAL; a SECURITY_FAULT flag (TPM or Secure Boot failure) also fails
 * `encryption`, because the evidence keys live in the TPM. A stable array while the status is
 * unchanged.
 */
export const selectIntegrityChecklist = (s: SimState): IntegrityCheckStatus[] => {
  const status = selectSystemState(s);
  const cached = checklistOf.get(status);
  if (cached) return cached;
  const rows: Record<IntegrityChecklistId, IntegrityCheckStatus> = {
    encryption: 'OK',
    hashChain: 'OK',
    platform: 'OK',
    tamper: 'OK',
    timeSource: 'OK',
    storage: 'OK',
    inputs: 'OK',
    recording: 'OK',
    tablet: 'OK',
  };
  const raise = (row: IntegrityChecklistId, value: IntegrityCheckStatus) => {
    if (CHECK_RANK[value] > CHECK_RANK[rows[row]]) rows[row] = value;
  };
  for (const flag of status.flags) {
    const row = (FLAG_CHECKLIST_ROW as Record<string, IntegrityChecklistId | undefined>)[flag.id];
    if (row) raise(row, flag.severity === 'CRITICAL' ? 'CRITICAL' : 'ATTENTION');
    if (flag.id === 'SECURITY_FAULT') raise('encryption', 'CRITICAL');
  }
  const result = INTEGRITY_CHECKLIST_IDS.map((id) => rows[id]);
  checklistOf.set(status, result);
  return result;
};

// ── Misc ─────────────────────────────────────────────────────────────────────────────────
export const selectClockNow = (s: SimState): EpochMs => s.clock.now;
/** Whole seconds of the sim clock (1 Hz UI without 10 Hz re-renders). */
export const selectClockSecond = (s: SimState): number => Math.floor(s.clock.now / 1_000);
export const selectTabletLink = (s: SimState) => s.tabletLink;
export const selectPairing = (s: SimState) => s.pairing;

// ── Step 32 additions (engine slices) ────────────────────────────────────────────────────
/** The §5.3 gate of the current session (Start Session step 2), or null. */
export const selectPrecheck = (s: SimState) => s.session?.precheck ?? null;
/** The finalization pipeline of the current session (Stepper × 6), or null. */
export const selectFinalization = (s: SimState) => s.session?.finalization ?? null;
/** RECOVERY_SCAN / INCOMPLETE_SESSION_ANALYSIS progress, or null. */
export const selectRecovery = (s: SimState) => s.session?.recovery ?? null;
export const selectActiveFaults = (s: SimState) => s.faults.active;
/** Whether a fault is active (optionally for one target key: a camera, channel, …). */
export const selectIsFaultActive = (s: SimState, kind: string, target?: string | null): boolean =>
  s.faults.active.some((fault) => fault.kind === kind && (target === undefined || fault.target === target));
/** Every alert, newest first (the bell history). */
export const selectAlerts = (s: SimState): SimAlert[] => s.alerts.slice().reverse();
export const selectDiagnostics = (s: SimState) => s.diagnostics;
export const selectUpdate = (s: SimState) => s.update;
export const selectStoragePolicy = (s: SimState) => s.storagePolicy;
/** The history entry of `lastSealedSessionId` (mobile Session Summary, SCR-02), or null. */
export const selectLastSealedSession = (s: SimState): SessionHistoryEntry | null =>
  s.lastSealedSessionId === null ? null : selectSessionHistoryById(s, s.lastSealedSessionId);
/** The evidence item a session produced, or null. */
export const selectEvidenceBySessionId = (s: SimState, sessionId: string): EvidenceItem | null =>
  s.evidence.find((item) => item.sessionId === sessionId) ?? null;
/** The row AUDIT_TAMPER altered (Security & Audit discontinuity Alert, EVT-30), or null. */
export const selectAuditChainBreak = (s: SimState): { seq: number; index: number; id: string } | null => {
  const fault = s.faults.active.find((entry) => entry.kind === 'AUDIT_TAMPER');
  if (!fault?.target?.startsWith('seq:')) return null;
  const seq = Number(fault.target.slice(4));
  const index = s.audit.rows.findIndex((row) => row.seq === seq);
  const row = s.audit.rows[index];
  return row ? { seq, index, id: row.id } : null;
};
/** The active POWER_FAIL fault (the global power-fail overlay, 03 §7), or null. */
export const selectPowerFail = (s: SimState) => s.faults.active.find((fault) => fault.kind === 'POWER_FAIL') ?? null;

// ── Step 54 additions ────────────────────────────────────────────────────────────────────
const EMPTY_WRITE_RATE: WriteRatePoint[] = [];
/** 1 Hz write-rate samples, oldest first (SIM-GAP-W44-1). */
export const selectWriteRateHistory = (s: SimState): WriteRatePoint[] => s.storage.writeRateHistory ?? EMPTY_WRITE_RATE;
/** Console preferences (SIM-GAP-W52-2). */
export const selectSettings = (s: SimState) => s.settings;
/** Presentation mode (SIM-GAP-W43-1, W52-5): hides the demo disclosures. */
export const selectPresentationMode = (s: SimState): boolean => s.settings?.presentationMode ?? false;
/** Event types that the Storage page's activity list shows (SIM-GAP-W49-2; 01_specs §14.5.5). */
export const STORAGE_ACTIVITY_EVENT_TYPES: ReadonlySet<SimEventType> = new Set<SimEventType>([
  'RECORDING_STARTED',
  'RECORDING_STOPPED',
  'AUTOSAVE',
  'FINALIZATION_STARTED',
  'EVIDENCE_SEALED',
  'EVIDENCE_EXPORTED',
  'EVIDENCE_ARCHIVED',
  'SESSION_INCOMPLETE',
  'STORAGE_WRITE_VERIFIED',
  'STORAGE_POLICY_CHANGED',
]);
const STORAGE_FAULT_KINDS: ReadonlySet<string> = new Set(['STORAGE_LOW', 'STORAGE_FULL']);
/** Whether an event belongs to the storage activity list (writes, seals, exports, storage faults). */
export function isStorageActivityEvent(event: SimEvent): boolean {
  if (STORAGE_ACTIVITY_EVENT_TYPES.has(event.type)) return true;
  if (event.type === 'FAULT_RAISED' || event.type === 'FAULT_CLEARED') return STORAGE_FAULT_KINDS.has(String(event.params.kind ?? ''));
  return false;
}
/** Newest first, at most `count`; returns the store-owned events (shallow-stable between ticks). */
export function selectStorageActivity(s: SimState, count = 7): SimEvent[] {
  const out: SimEvent[] = [];
  for (let index = s.events.length - 1; index >= 0 && out.length < count; index -= 1) {
    const event = s.events[index];
    if (event && isStorageActivityEvent(event)) out.push(event);
  }
  return out;
}

