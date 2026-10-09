/**
 * Simulator contract: state slices, action signatures, platform adapters and results
 * (masterplan/01_specs.md §14.7; 04_mobile_specs.md §5 and SCR-01 / SCR-02).
 *
 * Rules that keep web and mobile on one store:
 * - The state is plain JSON data: numbers, strings, booleans, arrays and objects. No
 *   functions, class instances, Maps or Dates. Times are epoch milliseconds on the sim clock.
 * - Actions live outside the state (`Sim.actions`), so the persisted snapshot is the state
 *   minus the `audio`, `clock` and `auth` slices.
 * - IDs come from counters in `meta.counters` or from the seeded RNG, never from a
 *   platform UUID source.
 */
import type { PersistStorage } from 'zustand/middleware';
import type {
  AudioTrackId,
  BootRecoveryState,
  EvidenceLifecycleStage,
  FinalizationStep,
  LensState,
  MicInputId,
  MicRole,
  MicState,
  NetworkDomain,
  SecurityState,
  SessionState,
  StorageState,
  SystemSlot,
  TimeSource,
  TrackId,
  TrackRecState,
  UpdateStep,
  VideoTrackId,
} from '../domain';
import type {
  AuditCategory,
  AuditType,
  AuthMethod,
  AuthStatus,
  CaptureDeviceKind,
  CaptureStreamState,
  CaseType,
  DeviceCommand,
  DiagnosticStatus,
  EvidenceStatus,
  FaultKind,
  IntegritySource,
  OperatorRole,
  PairingState,
  PrecheckCheckId,
  PrecheckReasonCode,
  PrecheckStatus,
  RecordingProfileId,
  RetentionPolicyId,
  ScenarioName,
  SecurityPosture,
  ServiceStatus,
  SessionOutcome,
  Severity,
  SignOutReason,
  SimEventType,
  StepStatus,
  SubjectType,
  TabletLinkState,
  TimelineKind,
  UpdateState,
  VerificationStatus,
} from './vocabulary';

/** Epoch milliseconds on the sim clock. */
export type EpochMs = number;
/** Flat detail values allowed inside events and audit rows (canonical-JSON safe). */
export type DetailValue = string | number | boolean | null;
export type Details = Readonly<Record<string, DetailValue>>;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Platform adapters (SCR-01)
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Persisted snapshot = the state minus the transient slices. */
export type SimSnapshot = Omit<SimState, 'audio' | 'clock' | 'auth'>;

/**
 * Snapshot storage: a zustand `PersistStorage`. Web default: session storage via
 * `createJSONStorage`. Mobile: `createJSONStorage(() => AsyncStorage)`. Tests: in-memory.
 */
export type SimPersistStorage = PersistStorage<SimSnapshot>;

/** Page or app visibility. Web default: the page visibility API. Mobile: AppState. */
export interface VisibilityAdapter {
  isHidden(): boolean;
  /** Calls `onChange` whenever visibility may have changed; returns an unsubscribe. */
  subscribe(onChange: () => void): () => void;
}

/** The signed-in operator record (`dems.auth`): never a password (§14.8). */
export interface AuthSessionRecord {
  operatorId: string;
  issuedAt: EpochMs;
}

/**
 * Where the signed-in operator record lives. Web default: session storage key `dems.auth`.
 * Mobile: memory only (04 §6.4: sign in again after a cold start).
 */
export interface AuthSessionStorage {
  load(): AuthSessionRecord | null;
  save(record: AuthSessionRecord): void;
  clear(): void;
}

/** Engine scheduler: calls `tick` every `intervalMs`; returns a cancel function. */
export type SimScheduler = (tick: () => void, intervalMs: number) => () => void;

/** One-shot timers (persist throttle). Default: the global `setTimeout` / `clearTimeout`. */
export interface TimerAdapter {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** The sim clock (§14.7 `clock.ts`). */
export interface SimClock {
  now(): EpochMs;
  readonly tz: '+07:00';
  readonly tzOffsetMinutes: number;
}

/** A clock tests drive by hand ("test mode with a frozen start"). */
export interface ControllableClock extends SimClock {
  advance(ms: number): void;
  set(ms: EpochMs): void;
}

/** Structured error report (the app layer persists it; the simulator has no log sink). */
export interface SimErrorReport {
  level: 'error' | 'warn';
  source: string;
  message: string;
  stack?: string;
  context?: Readonly<Record<string, DetailValue>>;
  at: EpochMs;
}

export interface CreateSimOptions {
  /** Default 20261001. */
  seed?: number;
  /** Default 'idle'. Ignored when a persisted snapshot is hydrated (a reload resumes). */
  scenario?: ScenarioName;
  /** Default: `createSimClock()` (real time at 1×). */
  clock?: SimClock;
  /** Default: `setInterval(tick, 50)`. */
  scheduler?: SimScheduler;
  /** Snapshot storage. Default: web session storage when present, else memory. `null`: memory. */
  storage?: SimPersistStorage | null;
  /** Operator record storage. Default: web session storage when present, else memory. `null`: memory. */
  authStorage?: AuthSessionStorage | null;
  /** Default: the page visibility API when present, else always visible. */
  visibility?: VisibilityAdapter;
  /** Default: the global timers. */
  timers?: TimerAdapter;
  /** Default 1000 ms. */
  persistThrottleMs?: number;
  /** Pairing state of a fresh (not hydrated) store. Default PAIRED (web trust line, §14.8). */
  initialPairing?: PairingState;
  /** Receives every caught error. The default keeps the last 50 in `Sim.errors()`. */
  onError?: (report: SimErrorReport) => void;
  /**
   * Where the meter levels come from (task 3, register CS-04). Default `'simulated'`: the audio
   * subsystem generates them, and a level fed by `applyCaptureTelemetry` takes their place while it
   * is fresh. `'external'`: a real capture worker measures them and NOTHING is generated: an input
   * without a fresh measured level reads NO SIGNAL, before the first frame, after the last one and
   * when the worker is down. Set once by the host that creates the simulator.
   */
  capture?: CaptureLevelSource;
}

/** See `CreateSimOptions.capture`. */
export type CaptureLevelSource = 'simulated' | 'external';

// ═══════════════════════════════════════════════════════════════════════════════════════
// State slices
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface SimCounters {
  /** Next operational event number (`LOG-000001`). */
  event: number;
  /** Next session number for `SES-{YYYYMMDD}-NNNN`. */
  session: number;
  /** Next case number for `LP/{YYYY}/{MMDD}-NNNN` (the Scan helper). */
  caseNumber: number;
  /** Next evidence number for `EV-{YYYYMMDD}-NNNN`. */
  evidence: number;
  /** Timeline items, notes, markers, alerts and diagnostics runs. */
  item: number;
  /**
   * Next export number for `EXP-NNNNNN` (step 54, SIM-GAP-W47-4): continues after the dataset's
   * EXP-000031 (EV 0004's prebuilt package). Absent in a snapshot from before step 54: the
   * export transitions then fall back to `DATASET_EXPORT_SEQ + 1`.
   */
  export?: number;
}

export interface MetaSlice {
  /** Snapshot/wire schema version; the literal of `SIM_SNAPSHOT_VERSION` (SH-10, register SH-16). */
  schemaVersion: 2;
  seed: number;
  scenario: ScenarioName;
  /** 0 for a fresh store; +1 on every hydration, so re-derived RNG streams never repeat. */
  epoch: number;
  createdAt: EpochMs;
  counters: SimCounters;
}

export interface ClockSlice {
  /** Published sim time, 100 ms resolution (§14.7 "clock tick 100 ms"). */
  now: EpochMs;
  tz: '+07:00';
  tzOffsetMinutes: number;
}

/** §24.1 per-device configuration identity (12 fields; synthetic values). */
export interface DeviceIdentity {
  serialNumber: string;
  hardwareUuid: string;
  chassisRevision: string;
  somPartRevision: string;
  audioBoardRevision: string;
  poeBoardRevision: string;
  powerBoardRevision: string;
  bspVersion: string;
  coreSoftwareVersion: string;
  tabletAppVersion: string;
  tpmModelFirmware: string;
  cameraModelFirmware: string;
  provisioningRecordId: string;
  deviceCertificateId: string;
}

export interface DeviceSlice {
  id: string;
  name: string;
  room: string;
  productName: string;
  softwareVersion: string;
  identity: DeviceIdentity;
}

export interface SimOperator {
  id: string;
  username: string;
  /** e.g. "AKP"; null when the operator has no rank. */
  rank: string | null;
  name: string;
  /** Rank and name, e.g. "AKP Budi Santoso". */
  displayName: string;
  initials: string;
  role: OperatorRole;
}

/** Signed-in identity. Not persisted in the snapshot; `dems.auth` holds `{ operatorId, issuedAt }`. */
export interface AuthSlice {
  status: AuthStatus;
  operatorId: string | null;
  /** Null after a reload restore (the record keeps only operator and issue time). */
  method: AuthMethod | null;
  issuedAt: EpochMs | null;
  lastActivityAt: EpochMs | null;
}

/** Lockout bookkeeping (persisted, so a reload does not reset the counter). */
export interface AuthLockoutSlice {
  /** Failure times inside the rolling 5 min period. */
  failures: EpochMs[];
  lockedUntil: EpochMs | null;
}

export interface PairingSlice {
  state: PairingState;
  coreDeviceId: string;
  coreName: string;
  certificateFingerprint: string;
  pairedAt: EpochMs | null;
  failures: EpochMs[];
  lockedUntil: EpochMs | null;
}

export interface TabletLinkSlice {
  state: TabletLinkState;
  changedAt: EpochMs;
}

export interface SessionCreateInput {
  caseNumber: string;
  subjectType: SubjectType;
  subjectName: string;
  investigatorId: string;
  room: string;
  profileId: RecordingProfileId;
  notes?: string;
}

export interface RecordingProfile {
  id: RecordingProfileId;
  label: string;
  resolution: '1080p';
  fps: 25;
  codec: 'H.264';
  bitrateMbps: number;
}

export interface PrecheckItem {
  id: PrecheckCheckId;
  status: PrecheckStatus;
  /** Live device state shown as the description, e.g. "ONLINE", "READY", "NO_SIGNAL", "GNSS". */
  value: string | null;
  /** Why the check warns or blocks (EN fallback; the UI renders copy from `reasonCode`). */
  reason: string | null;
  /** Machine-readable reason (step 54, SIM-GAP-W46-2); null while pending or on PASS. */
  reasonCode?: PrecheckReasonCode | null;
  /** Values for the reason copy, e.g. `{ track: 'AUDIO-01' }` (step 54). */
  params?: Details;
  /** When the seeded 300-700 ms resolution completes. */
  resolvesAt: EpochMs | null;
}

export interface PrecheckSlice {
  items: PrecheckItem[];
  startedAt: EpochMs | null;
  completedAt: EpochMs | null;
  /** PASS, WARN or BLOCK once every item resolved; null while running. */
  outcome: 'PASS' | 'WARN' | 'BLOCK' | null;
  warningsAcknowledged: boolean;
}

export interface FinalizationStepState {
  id: FinalizationStep;
  status: StepStatus;
  startedAt: EpochMs | null;
  completedAt: EpochMs | null;
  durationMs: number | null;
  /**
   * Schema v2 (register SH-05; R-6; op 83): per-step progress 0..100 and the ETA in ms, both
   * written by the Core (`sealing_jobs.progress` / `eta_ms`, `dbc-3 §B.4`). Optional: the v1
   * simulator and every state written before M2 carry neither. Clients render them forward-only
   * from Core instants (E-13), never from the client wall clock.
   */
  progress?: number;
  etaMs?: number | null;
  /** Step detail the progress line shows (fragment count, chunk counters); free text. */
  detail?: string | null;
  /** The attempt of this step (>= 1): a resumed sealing run increments it (`dbc-3 §B.4`). */
  attempt?: number;
}

/**
 * The capture-config snapshot taken when a session started (register SH-05; SH-06 writes it,
 * `dbc-3 §B.10` stores it in `active_session.capture_config`). A copy of the selector at that
 * instant: later edits never change a running session (OD-10).
 */
export interface CaptureConfigSnapshot {
  cameras: CaptureConfigCamera[];
  mics: CaptureConfigMic[];
  /** Selector revision the snapshot was taken at. */
  revision: number;
  updatedAt: EpochMs;
}

/** Which mic input is active inside `AUDIO-01` right now (SH-05; op 81; `dbc-3 §B.10`). */
export interface AudioSourceState {
  sessionId: string;
  activeInputId: MicInputId;
  standbyInputId: MicInputId;
  /** When the last switch took effect (Core instant). */
  switchedAt: EpochMs | null;
  /** Media-pts start of the interval the switch opened (never operator wall clock, S2 §6). */
  intervalFromMs: number;
}

/** Transcript progress of the open session (SH-05; op 84; `ev §D`). */
export interface TranscriptSessionState {
  /** PARTIAL while chunks are still processing; READY once every chunk is terminal. */
  state: 'PENDING' | 'PARTIAL' | 'READY' | 'FAILED';
  chunksTotal: number;
  chunksDone: number;
  chunksFailed: number;
  /** Null until the transcript is assembled and hashed. */
  sha256: string | null;
}

export interface FinalizationSlice {
  steps: FinalizationStepState[];
  startedAt: EpochMs | null;
  completedAt: EpochMs | null;
}

export interface TimelineEvent {
  id: string;
  at: EpochMs;
  kind: TimelineKind;
  /** EN fallback text; the UI renders i18n copy from `kind` and `params` (step 54, SIM-GAP-W44-2). */
  label: string;
  detail: string | null;
  channel: AudioTrackId | null;
  /**
   * Structured values (step 54): START `{sessionId}`; NOTE `{noteId, length, authorRole?}`
   * (`authorRole`: the author's role when the note was written, E-fix FX-C E2E-T-5; absent on
   * older items and for an author not in the operator list); MARKER `{index, label}`; SNAPSHOT
   * `{index, cameraId}`; AUDIO_PEAK `{dbfs, track}`; AUTOSAVE `{segment, bytesWritten}`; CHECK
   * `{source}`; HEALTH `{}`; FAULT `{kind, evt}`. Absent on items written before step 54.
   */
  params?: Details;
}

export interface SessionNote {
  id: string;
  at: EpochMs;
  authorId: string | null;
  text: string;
}

export interface SessionFault {
  kind: FaultKind;
  at: EpochMs;
  fromState: SessionState;
}

export interface RecoverySlice {
  stage: BootRecoveryState;
  startedAt: EpochMs;
  completesAt: EpochMs;
}

/** The current session. `null` in the store means IDLE (no session). */
export interface ActiveSession {
  id: string;
  state: SessionState;
  input: Required<SessionCreateInput>;
  createdAt: EpochMs;
  createdBy: string | null;
  precheck: PrecheckSlice;
  armedAt: EpochMs | null;
  startedAt: EpochMs | null;
  stoppedAt: EpochMs | null;
  stopReason: string | null;
  sealedAt: EpochMs | null;
  finalization: FinalizationSlice;
  timeline: TimelineEvent[];
  notes: SessionNote[];
  markerCount: number;
  snapshotCount: number;
  bytesWritten: number;
  fault: SessionFault | null;
  recovery: RecoverySlice | null;
  evidenceId: string | null;
  /** Time source when the recording started (step 54, SIM-GAP-M80-1; S29 badge). */
  startTimeSource?: TimeSource | null;
  /** Time source when the recording stopped or faulted (step 54, SIM-GAP-M80-1). */
  stopTimeSource?: TimeSource | null;
  /**
   * Schema v2 (register SH-05; SH-06 writes it at start): the selector as it was when recording
   * began. Optional: a session created before M2 has none, and the wire schema keeps it optional.
   */
  captureConfig?: CaptureConfigSnapshot | null;
  /** The active/standby mic pair of this session and the last switch (op 81; OD-09). */
  audioSource?: AudioSourceState | null;
  /** Incremental transcript state of this session (op 84; R-5). */
  transcript?: TranscriptSessionState | null;
}

/** A finished session (Sessions hub, Recent Sessions, past-session summary). */
export interface SessionHistoryEntry {
  id: string;
  outcome: SessionOutcome;
  caseNumber: string;
  subjectName: string;
  subjectType: SubjectType;
  investigatorId: string;
  room: string;
  profileId: RecordingProfileId;
  createdAt: EpochMs;
  startedAt: EpochMs | null;
  endedAt: EpochMs;
  durationMs: number;
  sizeBytes: number;
  evidenceId: string | null;
  /** INCOMPLETE only: the fault that ended it. */
  faultKind: FaultKind | null;
  /** Time source at the start of the recording (step 54, SIM-GAP-M80-1); null when it never started. */
  startTimeSource?: TimeSource | null;
  /** Time source at the end of the recording (step 54, SIM-GAP-M80-1). */
  endTimeSource?: TimeSource | null;
}

export interface CameraStatus {
  id: VideoTrackId;
  deviceId: string;
  name: string;
  room: string;
  lens: LensState;
  online: boolean;
  recState: TrackRecState | null;
  resolution: '1080p';
  fps: 25;
  codec: 'H.264';
  bitrateMbps: number;
  poePort: string;
  model: string;
  firmware: string;
}

export interface MicStatus {
  id: AudioTrackId;
  deviceId: string;
  /** e.g. "MIC 1 – Interviewer" (04 §9 #8). */
  name: string;
  role: 'Interviewer' | 'Subject';
  /**
   * Schema v2 (register SH-05; OD-01 T1 / OD-09): the role this input holds inside `AUDIO-01`.
   * `role` above stays the interview role the screens show until SH-08 (blueprint row 51) moves
   * the copy; `micRole` is the capture role the selector and the toggle work with.
   */
  micRole: MicRole;
  channel: 1 | 2;
  state: MicState;
  recState: TrackRecState | null;
  /** Read-only in the UI (G13). */
  gainDb: number;
  phantom: boolean;
  /** CLIP latch; stays true until `resetClip(channel)`. */
  clipLatched: boolean;
}

/**
 * One 20 Hz audio frame: plain numbers and booleans only (SCR-01), so the mobile app can
 * copy it into Reanimated shared values without allocation.
 */
export interface AudioFrame {
  seq: number;
  at: EpochMs;
  /** Ballistic level, dBFS in [-90, 0]. */
  dbfs: number;
  /** Peak-hold level, dBFS in [-90, 0]. */
  peak: number;
  /** CLIP latch (≥ −0.5 dBFS, fault injection only). */
  clip: boolean;
  /** NO SIGNAL: a flat −90. */
  noSignal: boolean;
}

/** High-frequency slice: never persisted; read through `useAudioChannel`. */
/**
 * The streamed meters slice (register SH-17; E-02; `C3 §6`). Schema v2 re-keys it from the v1
 * `AUDIO-01`/`AUDIO-02` **channels** to the two microphone **inputs** `MIC-01`/`MIC-02`, and adds
 * `activeInputId`: the input whose level is the one inside `AUDIO-01` right now. The meters show
 * both input levels and mark which one is active (OD-01 T1, OD-09).
 */
export interface AudioSlice {
  inputs: Record<MicInputId, AudioFrame>;
  /** Which input currently feeds `AUDIO-01` (op 81 updates it with the switch). */
  activeInputId: MicInputId;
}

/** One camera row of the `captureConfig` slice (`C3 §6` slice 29). */
export interface CaptureConfigCamera {
  trackId: VideoTrackId;
  /** The capture device feeding this track (`CAM-01`/`CAM-02`, `dbc-3 §B.2`). */
  deviceId: string;
  /** Media profile (open `CODE` set, OD-05/OD-06). */
  profile: string;
  online: boolean;
  streamState: CaptureStreamState;
}

/** One mic row of the `captureConfig` slice (`C3 §6` slice 29). */
export interface CaptureConfigMic {
  inputId: MicInputId;
  deviceId: string;
  role: MicRole;
  /** Open set (`CODE`): USB, RTSP-embedded, ... (OD-06). */
  transport: string;
  online: boolean;
}

/**
 * The `captureConfig` slice (SH-16, slice 29): the device selector as a replicated slice.
 * `locked` is true while a session is open — the server refuses an edit then (OD-10) and the
 * clients grey the controls out before they even ask.
 */
export interface CaptureConfigSlice {
  cameras: CaptureConfigCamera[];
  mics: CaptureConfigMic[];
  locked: boolean;
  updatedAt: EpochMs;
}

/** One device of the `captureDevices` slice (`C3 §6` slice 30; `dbc-3 §B.2`). */
export interface CaptureDeviceStatus {
  id: string;
  /** The `capture_devices.kind` value set (`dbc-3 §B.2`): CAMERA, MIC, POE. */
  kind: CaptureDeviceKind;
  model: string | null;
  firmware: string | null;
  /** Host or address only, never a `user:password@` URL (RK-12, specs C-N8). */
  host: string | null;
  poePort: string | null;
  online: boolean;
  /** Null for a device that carries no stream (the PoE switch, a mic). */
  streamState: CaptureStreamState | null;
  /** Capability codes the adapters reported (open set). */
  capabilities: string[];
}

/**
 * The `captureDevices` slice (SH-16, slice 30; E-04). This is the capture-device registry fed by
 * supervisor telemetry (`applyCaptureTelemetry`, SH-18). It is **not** the paired-client registry:
 * `AdminResource.DEVICES` (`api/realtime-messages.ts`) stays what it was and no capture code uses it.
 * Carries no credential, ever (RK-12).
 */
export interface CaptureDevicesSlice {
  devices: CaptureDeviceStatus[];
}

/**
 * What one RTSP ingest of the capture worker says about itself (`capture-spec §B.2` TELEMETRY
 * `ingest[].state`). The three values are the worker protocol's; `@dems/shared` does not depend on
 * that package, so they are written here as a type only (no runtime value set, no new vocabulary).
 */
export type CaptureIngestStateName = 'WAITING' | 'CONNECTED' | 'ENDED';

/** The level of one mic input, by the role it holds in the capture config (`capture-spec §B.2`). */
export interface CaptureTelemetryLevel {
  role: MicRole;
  /** dBFS, at most 0. `null`: the input delivers no samples (the meter shows NO SIGNAL). */
  dbfs: number | null;
  /** The worker saw a clipped sample in this frame. */
  clipped: boolean;
}

/** The ingest of one camera, by its capture-device ID (`captureDevices.devices[].id`). */
export interface CaptureTelemetryIngest {
  deviceId: string;
  state: CaptureIngestStateName;
}

/** Fragments written so far for one camera file. Carried, not applied: see `applyCaptureTelemetry`. */
export interface CaptureTelemetryFragments {
  deviceId: string;
  count: number;
  bytes: number;
}

/**
 * The input of the INTERNAL action `applyCaptureTelemetry` (register SH-18, CS-04; `capture-spec
 * §B.1`). It has exactly the three lists of the worker's TELEMETRY frame, so the server's
 * translation is a copy: nothing is dropped and nothing is invented on the way.
 */
export interface CaptureTelemetryInput {
  levels: readonly CaptureTelemetryLevel[];
  ingest: readonly CaptureTelemetryIngest[];
  fragments: readonly CaptureTelemetryFragments[];
}

/** The two warnings the capture layer raises: the two capture-path values of `FaultKind`. */
export type CaptureWarningCode = Extract<FaultKind, 'MIC_SILENT' | 'CAPTURE_FAULT'>;

/**
 * The input of the INTERNAL action `raiseCaptureWarning` (register SH-18; `capture-spec §B.1`,
 * §E.1). `subject` is what the worker's WARNING frame names: a capture-device ID, a mic input ID,
 * a mic role, or `null` when the warning is about the capture as a whole.
 */
export interface CaptureWarningInput {
  code: CaptureWarningCode;
  subject: string | null;
}

export interface StorageVolume {
  id: 'NVME-SYS' | 'HDD-EVIDENCE';
  kind: 'SYSTEM' | 'EVIDENCE';
  label: string;
  totalBytes: number;
  usedBytes: number;
}

export interface StorageHistoryPoint {
  at: EpochMs;
  /** Natural usage: the STORAGE_LOW / STORAGE_FULL demo fill is never written here (step 54, F-49-2). */
  usedBytes: number;
}

/** One write-rate sample (step 54, SIM-GAP-W44-1). */
export interface WriteRatePoint {
  at: EpochMs;
  /** Measured evidence write rate (bytes/s): the nominal 8.2 GB/h with a small per-second variance. */
  bytesPerSec: number;
}

export interface StorageSlice {
  state: StorageState;
  /** [system, evidence]. The evidence volume drives USED %, free and the StorageState. */
  volumes: StorageVolume[];
  writeBytesPerSec: number;
  bitrateMbps: number;
  history: StorageHistoryPoint[];
  lastWriteVerifiedAt: EpochMs | null;
  /**
   * Bytes the STORAGE_LOW / STORAGE_FULL faults add to the evidence volume (step 32).
   * Clearing the fault removes exactly this amount. Absent or 0 when no storage fault is active.
   */
  simulatedFillBytes?: number;
  /** 1 Hz write-rate samples, at most 120 (step 54, SIM-GAP-W44-1). Absent before step 54. */
  writeRateHistory?: WriteRatePoint[];
}

export interface StoragePolicy {
  retentionPolicy: RetentionPolicyId;
  retentionDays: number;
  autoArchive: boolean;
}

export interface TimeHistoryPoint {
  at: EpochMs;
  offsetMs: number;
  source: TimeSource;
}

export interface TimeSlice {
  source: TimeSource;
  locked: boolean;
  stratum: number;
  offsetMs: number;
  lastSyncAt: EpochMs;
  gnss: { locked: boolean; satellites: number };
  ntp: { server: string; reachable: boolean; stratum: number };
  rtc: { driftPpm: number };
  history: TimeHistoryPoint[];
}

export interface BandwidthPoint {
  at: EpochMs;
  downMbps: number;
  upMbps: number;
}

export interface NetworkDomainStatus {
  id: NetworkDomain;
  vlan: number;
  active: boolean;
}

export interface NetworkSlice {
  ip: string;
  lanName: string;
  gateway: string;
  linkUp: boolean;
  linkSpeedMbps: number;
  /**
   * PoE (design book §4.2/§8; D79, step 54): 2 ports. PoE CAM 1 powers the dual-lens camera
   * (both video tracks); PoE CAM 2/AUX is the spare (0 W, reserve up to 30 W).
   * - `activePorts`: healthy ports (powered or spare-ready), so `activePorts < totalPorts` still
   *   means "degraded" for every consumer;
   * - `poweredPorts`: ports delivering power (0 or 1); `sparePorts`: spare ports (1).
   */
  poe: {
    activePorts: number;
    totalPorts: number;
    budgetW: number;
    drawW: number;
    poweredPorts?: number;
    sparePorts?: number;
  };
  bandwidth: { downMbps: number; upMbps: number; history: BandwidthPoint[] };
  domains: NetworkDomainStatus[];
}

export interface SecurityControl {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface KeyRecord {
  id: string;
  label: string;
  algorithm: string;
  fingerprint: string;
  expiresAt: EpochMs;
  simulated: boolean;
  /** The DEMO key or certificate of the step-93 packages (step 54, SIM-GAP-W1); never a real one. */
  demo?: boolean;
  /** Key identifier, e.g. `DEMO-KEY-EVSIGN-01` (step 54). */
  keyId?: string;
}

export interface SecuritySlice {
  state: SecurityState;
  posture: SecurityPosture;
  tpm: { model: string; ok: boolean };
  secureBoot: boolean;
  encryption: 'AES-256-GCM';
  hashAlgorithm: 'SHA-256';
  tamper: boolean;
  controls: SecurityControl[];
  keys: KeyRecord[];
}

export interface ServiceEntry {
  id: string;
  /** §6.1 service name, verbatim. */
  name: string;
  status: ServiceStatus;
  /**
   * When the service last started: today's boot, a services restart or the update reboot (step 54,
   * SIM-GAP-W52-1). Uptime = now − startedAt; a STOPPED service shows none.
   */
  startedAt?: EpochMs | null;
}

export interface HealthPoint {
  at: EpochMs;
  cpuPercent: number;
  cpuTempC: number;
  storageTempC: number;
  ambientTempC: number;
  fanRpm: number;
}

/** 1 Hz peak level of both microphone channels (step 54, SIM-GAP-W48-4). */
export interface MicLevelPoint {
  at: EpochMs;
  'AUDIO-01': number;
  'AUDIO-02': number;
}

export interface HealthSlice {
  cpuPercent: number;
  cpuTempC: number;
  storageTempC: number;
  ambientTempC: number;
  fanRpm: number;
  fanOk: boolean;
  series: HealthPoint[];
  /** 1 Hz microphone peak levels, at most 120 (step 54). Absent before step 54. */
  micLevels?: MicLevelPoint[];
}

export interface OtherDevice {
  id: 'POE-SWITCH' | 'REC-INDICATOR' | 'TABLET';
  name: string;
  online: boolean;
  /** Short live status, e.g. "4/4 Ports Active", "SEDANG MEREKAM", "CONNECTED". */
  status: string;
}

export interface PortStatus {
  id: 'POE_CAM_1' | 'POE_CAM_2_AUX' | 'MGMT_LAN' | 'MIC_IN_1' | 'MIC_IN_2' | 'GNSS_SMA' | 'RELAY_IO';
  label: string;
  /** The port is healthy (a spare port reads true while it is ready). */
  link: boolean;
  /** A spare port by design: no device, no load (PoE CAM 2/AUX; step 54, D79). */
  spare?: boolean;
}

export interface EvidenceTrack {
  trackId: TrackId;
  label: string;
  sizeBytes: number;
  sha256: string;
}

export interface EvidenceSignature {
  /** sha256(manifestHash ‖ keyId): a simulated signature, never called a real one. */
  value: string;
  keyId: string;
  algorithm: 'SIMULATED-SHA256';
  simulated: true;
}

export interface CustodyEntry {
  at: EpochMs;
  action: string;
  actorId: string | null;
  detail: string | null;
}

export interface EvidenceVerification {
  status: VerificationStatus;
  at: EpochMs | null;
}

/** A marker the investigator set during the recording (step 54, SIM-GAP-W47-3). */
export interface EvidenceMarker {
  id: string;
  at: EpochMs;
  /** 1-based order within the session. */
  index: number;
  label: string;
}

export interface EvidenceItem {
  id: string;
  sessionId: string;
  caseNumber: string;
  subjectName: string;
  subjectType: SubjectType;
  investigatorId: string;
  room: string;
  profileId: RecordingProfileId;
  recordedAt: EpochMs;
  endedAt: EpochMs;
  sealedAt: EpochMs | null;
  durationMs: number;
  sizeBytes: number;
  status: EvidenceStatus;
  lifecycleStage: EvidenceLifecycleStage;
  tracks: EvidenceTrack[];
  manifestHash: string;
  signature: EvidenceSignature;
  custody: CustodyEntry[];
  verification: EvidenceVerification;
  /** Set by the tamper hook (EVT-13/14); verification then fails. */
  tampered: boolean;
  /** The track whose media the tamper hook altered (step 32); verification fails on exactly this track. */
  tamperedTrackId?: TrackId | null;
  /** Case (examination) type (step 54, SIM-GAP-W47-2); the subject type of the interview. */
  caseType?: CaseType;
  /** Markers set during the recording (step 54, SIM-GAP-W47-3); empty for the dataset items. */
  markers?: EvidenceMarker[];
  /** Investigator notes written during the recording (step 54, SIM-GAP-W47-3). */
  notes?: SessionNote[];
  /**
   * DEMO_PACKAGE when the track and manifest hashes are the step-93 package's (review 40 §5.c),
   * SIMULATED for synthetic hashes (a session the presenter recorded live). Absent before step 54.
   */
  integritySource?: IntegritySource;
  /** Time source at the start and end of the recording (step 54, SIM-GAP-M80-1). */
  startTimeSource?: TimeSource | null;
  endTimeSource?: TimeSource | null;
  /**
   * Schema v2 (register SH-07; OD-02 L2; `ev §A/§B`). Present on items sealed after M2:
   * - `files` is one entry per sealed FILE (the two camera files and the single session audio
   *   track `AUDIO-01`), each with its own SHA-256 — D224/D225 "one whole file per camera";
   * - `fragmentChainHead` is the running SHA-256 head over the fragment checkpoints of the append-only
   *   files (`ev §B.6`; the S1 running-hash pattern), not a per-file hash;
   * - `transcriptSha256` binds the canonical transcript document inside the seal (D222; null until a
   *   transcript exists). Legacy v1 items carry none of these and verify on their `tracks`.
   */
  files?: EvidenceFileEntry[];
  fragmentChainHead?: string | null;
  transcriptSha256?: string | null;
  /**
   * Schema v2 (register SH-14; ops 85/86; OD-15): the signed revisions appended to this item's
   * transcript, oldest first. Append-only, and the sealed `transcriptSha256` never changes. Absent
   * on every item written before a revision exists, so v1 snapshots keep restoring (row 51a).
   */
  transcriptRevisions?: TranscriptRevisionRecord[];
}

/** One correction inside a transcript revision (`changes` of op 85/86). */
export interface TranscriptRevisionChange {
  segmentIndex: number;
  from: string;
  to: string;
}

/** The simulated signature over one transcript revision (OD-04: software key, never a real claim). */
export interface TranscriptRevisionSignature {
  value: string;
  keyId: string;
  algorithm: 'SIMULATED-SHA256';
  simulated: true;
}

/** One appended transcript revision as the simulator stores and reports it (op 85/86; SEC35-21). */
export interface TranscriptRevisionRecord {
  revisionId: string;
  number: number;
  authorId: string;
  baseRevision: number;
  machineTranscriptHash: string;
  signedBy: string;
  signature: TranscriptRevisionSignature;
  createdAt: EpochMs;
  changes: TranscriptRevisionChange[];
}

/** One sealed file of a v2 evidence item (register SH-07; `ev §A`). */
export interface EvidenceFileEntry {
  /** The track the file carries (`VIDEO-01`, `VIDEO-02`, `AUDIO-01`). */
  trackId: TrackId;
  /** Relative path inside the package (never an absolute or credential-bearing path). */
  fileName: string;
  sizeBytes: number;
  /** SHA-256 of the whole file's stored bytes. */
  sha256: string;
  /** Number of fragments the append-only file was written in (0 for the synthetic legacy shape). */
  fragmentCount: number;
}

export interface SimEvent {
  id: string;
  seq: number;
  at: EpochMs;
  type: SimEventType;
  severity: Severity;
  /** EN fallback text; the UI renders i18n copy from `type` and `params`. */
  message: string;
  params: Details;
  sessionId: string | null;
  deviceId: string | null;
}

export interface SimAlert {
  id: string;
  at: EpochMs;
  severity: Severity;
  kind: FaultKind | 'SYSTEM';
  message: string;
  active: boolean;
  acknowledged: boolean;
  resolvedAt: EpochMs | null;
  /** The fault target key (`faults.active[].target`), so clearing one target resolves its alert (step 32). */
  target?: string | null;
  /** Values for the alert copy, e.g. `{ kind, target, track }` (step 54, review 40 m4). */
  params?: Details;
}

/** The hashed part of an audit row: `hash = sha256(prevHash ‖ canonicalJSON(body))`. */
export interface AuditEventBody {
  seq: number;
  id: string;
  at: EpochMs;
  type: AuditType;
  category: AuditCategory;
  severity: Severity;
  /** Operator ID, or null for the system. Never a username typed at a failed sign-in. */
  actorId: string | null;
  /** EN fallback text; the UI renders i18n copy from `type` and `details`. */
  message: string;
  sessionId: string | null;
  evidenceId: string | null;
  deviceId: string | null;
  details: Details;
}

export interface AuditRow extends AuditEventBody {
  prevHash: string;
  hash: string;
}

export interface AuditLogSlice {
  /** Ring buffer, oldest first, at most 1000 rows. */
  rows: AuditRow[];
  /** Hash of the newest row (the chain head), or the genesis hash when empty. */
  head: string;
  /** Rows ever appended (the next `seq` is `total + 1`). */
  total: number;
  /** Rows dropped off the front of the ring. */
  dropped: number;
}

export interface DiagnosticCheck {
  id: string;
  label: string;
  status: DiagnosticStatus;
  /** EN fallback; the UI renders copy from `id`, `status` and `params`. */
  detail: string | null;
  /** Values behind `detail`, e.g. `{ cpuPercent, cpuTempC }` (step 54, review 40 m4). */
  params?: Details;
  /** When the check resolves (step 32; the checks run one after another). */
  resolvesAt?: EpochMs | null;
}

export interface DiagnosticsRun {
  id: string;
  startedAt: EpochMs;
  completedAt: EpochMs | null;
  checks: DiagnosticCheck[];
}

export interface UpdateSlice {
  currentVersion: string;
  availableVersion: string | null;
  activeSlot: SystemSlot;
  state: UpdateState;
  /** `resolvesAt`: when the step completes (step 32; absent before the update starts). */
  steps: { id: UpdateStep; status: StepStatus; resolvesAt?: EpochMs | null }[];
  startedAt: EpochMs | null;
  completedAt: EpochMs | null;
}

/**
 * Console preferences (step 54, SIM-GAP-W43-1, W52-2, W52-5): persisted with the snapshot, so a
 * reload keeps them. Presentation mode hides the demo disclosures (§14.8, §14.5.8).
 */
export interface SettingsSlice {
  presentationMode: boolean;
  timeFormat: '24' | '12';
  notifyWarnings: boolean;
  notifySound: boolean;
}

/** Active fault flags (what `inject` set and `clearFault` has not cleared). */
export interface FaultsSlice {
  active: { kind: FaultKind; since: EpochMs; target: string | null }[];
}

/** The whole simulator state. Pure data (see the file header). */
export interface SimState {
  meta: MetaSlice;
  clock: ClockSlice;
  device: DeviceSlice;
  operators: SimOperator[];
  auth: AuthSlice;
  authLockout: AuthLockoutSlice;
  pairing: PairingSlice;
  tabletLink: TabletLinkSlice;
  session: ActiveSession | null;
  lastSealedSessionId: string | null;
  lastSealedAcknowledged: boolean;
  sessionHistory: SessionHistoryEntry[];
  activeCameraId: VideoTrackId;
  cameras: CameraStatus[];
  mics: MicStatus[];
  audio: AudioSlice;
  storage: StorageSlice;
  storagePolicy: StoragePolicy;
  time: TimeSlice;
  network: NetworkSlice;
  security: SecuritySlice;
  services: ServiceEntry[];
  health: HealthSlice;
  otherDevices: OtherDevice[];
  ports: PortStatus[];
  evidence: EvidenceItem[];
  events: SimEvent[];
  alerts: SimAlert[];
  audit: AuditLogSlice;
  faults: FaultsSlice;
  diagnostics: DiagnosticsRun | null;
  update: UpdateSlice;
  /** Console preferences (step 54). */
  settings: SettingsSlice;
  /**
   * Slice 29 of the replicated state (SH-16): the device selector (ops 76-80, OD-10).
   * Its own slice — capture never reuses the paired-client registry (E-04).
   */
  captureConfig: CaptureConfigSlice;
  /**
   * Slice 30 of the replicated state (SH-16): the capture-device registry fed by supervisor
   * telemetry (SH-18). Never `AdminResource.DEVICES` (E-04) and never a credential (RK-12).
   */
  captureDevices: CaptureDevicesSlice;
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Action results
// ═══════════════════════════════════════════════════════════════════════════════════════

export type SignInResult =
  | { ok: true; operatorId: string; role: OperatorRole; method: AuthMethod }
  | { ok: false; reason: 'INVALID_CREDENTIALS'; attemptsRemaining: number }
  | { ok: false; reason: 'LOCKED'; lockedUntil: EpochMs; retryInMs: number };

export type CreateSessionResult =
  | { ok: true; sessionId: string; created: boolean }
  | {
      ok: false;
      reason: 'SESSION_ACTIVE' | 'NOT_SIGNED_IN' | 'NOT_PERMITTED' | 'INVALID_INPUT';
      sessionId: string | null;
    };

export type PairResult =
  | { ok: true; pairedAt: EpochMs }
  | { ok: false; reason: 'INVALID_CODE'; attemptsRemaining: number }
  | { ok: false; reason: 'LOCKED'; lockedUntil: EpochMs; retryInMs: number };

export interface TrackVerifyResult {
  trackId: TrackId;
  expected: string;
  actual: string;
  ok: boolean;
}

export interface EvidenceVerifyResult {
  evidenceId: string;
  ok: boolean;
  at: EpochMs;
  tracks: TrackVerifyResult[];
  manifestOk: boolean;
  signatureOk: boolean;
}

export interface ExportRequest {
  /** Mandatory reason (S21). */
  reason: string;
  destination: string;
}

/** `exportAudit(request)` / `exportLogs(request)` (step 54, SIM-GAP-W51-1, W52-7). */
export interface AuditExportRequest {
  /** Mandatory purpose of at least 5 characters (§19.2 item 8, S21). */
  reason: string;
  /** Optional destination text (defaults to "Audit archive (simulated)"). */
  destination?: string;
}

/**
 * Export outcome (§21.2 "RBAC + audit required"). 401 NOT_SIGNED_IN, 403 FORBIDDEN (audit
 * EXPORT_DENIED), 404 NOT_FOUND, 409 NOT_SEALED (RECORDED or ARCHIVED item) or 409
 * SECURITY_FAULT (TPM or security fault blocks export, FMEA §23.1; step 32), 422 INVALID_REASON.
 */
export type ExportResult =
  | { ok: true; status: 202; exportId: string }
  | {
      ok: false;
      status: 401 | 403 | 404 | 409 | 422;
      reason: 'NOT_SIGNED_IN' | 'FORBIDDEN' | 'NOT_FOUND' | 'NOT_SEALED' | 'SECURITY_FAULT' | 'INVALID_REASON';
    };

export type ChainVerifyResult =
  | { ok: true; checked: number; head: string }
  | {
      ok: false;
      checked: number;
      /** Position in `audit.rows` of the first bad row (AC-55 "the tampered index"). */
      index: number;
      seq: number;
      reason: 'HASH_MISMATCH' | 'PREV_LINK_BROKEN' | 'SEQ_GAP';
    };

/**
 * Optional fault target:
 * - `channel` for MIC_NO_SIGNAL (default AUDIO-01) and MIC_CLIP (default AUDIO-02);
 * - `cameraId` for CAMERA_LOSS (default: the active camera);
 * - `auditIndex` for AUDIT_TAMPER (position in `audit.rows`; default: 5 rows from the end);
 * - `fallback` for GNSS_LOSS: the tier the time service lands on (default NTP; RTC models NTP
 *   also unreachable) (step 32);
 * - `evidenceId` (+ optional `trackId`, default AUDIO-02) turns TAMPER into the evidence media
 *   tamper hook (EVT-13/14) instead of the enclosure tamper switch (EVT-12) (step 32).
 */
export interface FaultTarget {
  channel?: AudioTrackId;
  cameraId?: VideoTrackId;
  auditIndex?: number;
  fallback?: 'NTP' | 'RTC';
  evidenceId?: string;
  trackId?: TrackId;
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Actions (`Sim.actions`, `useSimActions()`)
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface SimActions {
  // ── Auth (§14.8; SCR-02 biometric) ──
  /** Password sign-in. Every attempt writes one audit row: AUTH_SUCCESS, AUTH_FAILED or AUTH_LOCKED. */
  signIn(username: string, password: string): SignInResult;
  /** After the OS biometric prompt succeeds (04 §6.3). Audit method BIOMETRIC. */
  signInWithBiometric(operatorId: string): SignInResult;
  /** An OS `authentication_failed` result: one failure toward the lockout. */
  recordBiometricFailure(operatorId: string | null): SignInResult;
  /** "Use security key (simulated)" (D28/Q15): signs in as the SUPERVISOR operator. */
  signInWithSecurityKey(): SignInResult;
  signOut(reason?: SignOutReason): void;
  /** Operator activity (resets the 15 min idle timer). Cheap to call often. */
  touch(): void;

  // ── Session machine (§14.7 table) ──
  /**
   * Idempotent: the same input while a CREATE session exists returns it (S26). Validates with the
   * shared `sessionCreateSchema` (D62). A created case number at or past the scanner's next number
   * advances it (step 54).
   */
  createSession(input: SessionCreateInput): CreateSessionResult;
  /**
   * The session commands below need a signed-in operator with SESSION_START (step 54, review 40
   * M5): otherwise they throw `SimPermissionError` (code NOT_SIGNED_IN or NOT_PERMITTED). The
   * audit actor is always the signed-in operator.
   */
  beginPrecheck(): void;
  acknowledgePrecheckWarnings(): void;
  retryPrecheck(): void;
  startRecording(): void;
  /** Reason of at least 5 characters (S21). */
  stopRecording(reason: string): void;
  /** CREATE, PRECHECK or ARMED → no session. Audit SESSION_CANCELLED. */
  cancel(): void;
  /**
   * The simulated case-number scanner (step 54, SIM-GAP-W46-1 / M78-1): returns the next case
   * number `LP/{YYYY}/{MMDD}-NNNN` and reserves it (the counter advances, so the next scan offers
   * a fresh number). Needs SESSION_START.
   */
  scanCaseNumber(): string;
  /** FAULT → RECOVERY. */
  recover(): void;
  addMarker(label?: string): void;
  addNote(text: string): void;
  snapshot(): void;
  /** SCR-02: acknowledges the summary of `lastSealedSessionId`. */
  acknowledgeSummary(sessionId: string): void;

  // ── Evidence and audit ──
  verify(evidenceId: string): EvidenceVerifyResult;
  exportEvidence(evidenceId: string, request: ExportRequest): ExportResult;
  archiveEvidence(evidenceId: string): void;
  /**
   * "Export audit" (S20: AUDIT_EXPORT). With a request (step 54, SIM-GAP-W51-1) the reason is
   * mandatory: 422 INVALID_REASON below 5 characters, else AUDIT_EXPORTED carries `details.reason`.
   * Without a request it behaves as before step 54 (no reason recorded).
   */
  exportAudit(request?: AuditExportRequest): ExportResult;
  /**
   * "Export logs" (step 54, SIM-GAP-W52-7): the audit chain plus the operational events, AUDIT_EXPORT
   * RBAC, one AUDIT_EXPORTED row with `details.scope = 'LOGS'`. The caller builds the bundle from
   * `logBundle(state)`.
   */
  exportLogs(request?: AuditExportRequest): ExportResult;
  /** Recomputes the audit hash chain over the ring buffer. */
  verifyAuditChain(): ChainVerifyResult;

  // ── Faults and scenarios (§14.7 `faults.ts`, `scenarios.ts`) ──
  // The Demo Control Panel actions stay open to every role and need no sign-in (step 54 ruling,
  // W52-6): they are DEMO tooling, not console features.
  inject(kind: FaultKind, target?: FaultTarget): void;
  clearFault(kind: FaultKind, target?: FaultTarget): void;
  resetClip(channel: AudioTrackId): void;
  acknowledgeAlert(alertId: string): void;
  loadScenario(name: ScenarioName): void;
  /** Demo reset (step 54, SIM-GAP-W52-8): `loadScenario('idle')` with `details.reset = true`. */
  resetDemo(): void;

  // ── Devices, storage, maintenance (RBAC per the role table, step 54 W52-6 / F-49-1) ──
  /** Starts a diagnostics run; returns its ID. Needs DIAGNOSTICS_RUN. */
  runDiagnostics(): string;
  /**
   * TEST_SIGNAL and IDENTIFY need DIAGNOSTICS_RUN; RESTART needs DEVICE_MANAGE and is refused
   * while recording (SimTransitionError RECORDING_ACTIVE, D79). IDENTIFY also accepts the
   * platform devices GNSS, TPM and FRONT-PANEL.
   */
  deviceCommand(deviceId: string, command: DeviceCommand): void;
  /** Needs EVIDENCE_REVIEW or MAINTENANCE (SUPERVISOR or TECHNICIAN; F-49-1). */
  setStoragePolicy(policy: Partial<StoragePolicy>): void;
  /** Needs MAINTENANCE. */
  startSoftwareUpdate(): void;
  /**
   * Restarts the Core services (simulated; step 54, SIM-GAP-W52-3): MAINTENANCE, refused during a
   * session (SimTransitionError SESSION_ACTIVE). One DEVICE_COMMAND row (`details.scope =
   * 'CORE_SERVICES'`); every running service gets `startedAt = now`. Returns the count restarted.
   */
  restartServices(): number;
  setActiveCamera(cameraId: VideoTrackId): void;

  // ── Console settings (step 54) ──
  /** Presentation mode (hides the demo disclosures). No sign-in needed: Login reads it. */
  setPresentationMode(enabled: boolean): void;
  updateSettings(patch: Partial<SettingsSlice>): void;

  // ── Pairing and the tablet link (SCR-02) ──
  pair(code: string): PairResult;
  unpair(): void;
  /** Driven by the app (mobile: its own Core link). Health and Devices read it. */
  setTabletLink(state: TabletLinkState): void;

  // ── Capture telemetry and warnings (task 3, register SH-18 / CS-04; `capture-spec §B.1`) ──
  // INTERNAL like `setTabletLink`: the Core server calls them from the capture supervisor's events,
  // no client may. They take no actor and need no sign-in.
  /**
   * One TELEMETRY frame of the capture worker (about 20 Hz). The levels go to the meters through
   * the audio subsystem and are never stored. The ingest states set `online` and `streamState` of
   * the camera in `captureDevices` and `captureConfig`; a frame that changes neither commits
   * nothing. Unknown device IDs and roles are ignored (`captureTelemetryIgnored` names them, and
   * the Core server logs each once). Writes no audit row and no event.
   */
  applyCaptureTelemetry(telemetry: CaptureTelemetryInput): void;
  /**
   * Raises the fault `MIC_SILENT` or `CAPTURE_FAULT` for the subject: one alert, one FAULT_RAISED
   * audit row and event, as `inject` does. Does nothing while that fault is active for the same
   * subject. It NEVER changes the active mic input (OD-11). Throws `SimNotFoundError` for a
   * subject that names no capture device, mic input or mic role.
   */
  raiseCaptureWarning(warning: CaptureWarningInput): void;
  /**
   * The condition a capture warning named is over: clears the fault `MIC_SILENT` or `CAPTURE_FAULT`
   * of that subject as `clearFault` does (the alert is resolved, one FAULT_CLEARED audit row and
   * event). Does nothing when that fault is not active. A later `raiseCaptureWarning` for the same
   * subject is then a NEW fault with its own alert and audit row. Throws `SimNotFoundError` for a
   * subject `raiseCaptureWarning` would refuse.
   */
  clearCaptureWarning(warning: CaptureWarningInput): void;
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface SimTickContext {
  now: EpochMs;
  /** Elapsed sim time since the previous tick (large after a resume: catch up from it). */
  dtMs: number;
  tickIndex: number;
}

/** One engine subsystem. Each tick runs every subsystem in order; a throw is reported, not fatal. */
export interface SimSubsystem {
  readonly name: string;
  tick(context: SimTickContext): void;
}

/** The simulated REST surface (§14.7 `api.ts`; §14.9 `simAwareFetch`). */
export interface SimApiRequest {
  /**
   * HTTP method. The simulated endpoints model GET and POST; any other method answers 405 with
   * `allow` on a known path, or 404 (step 54, SIM-GAP-W53-2: the type admits every method).
   */
  method: 'GET' | 'POST' | (string & {});
  /** Path under the Core origin, e.g. `/api/v1/session/current`. */
  path: string;
  body?: unknown;
}

export interface SimApiResponse {
  status: number;
  /** Always includes `x-dems-simulated: 1`. */
  headers: Record<string, string>;
  body: unknown;
}
