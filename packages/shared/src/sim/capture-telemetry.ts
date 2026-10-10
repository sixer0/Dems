/**
 * What the capture layer tells the simulator (task 3, register SH-18 / CS-04; `capture-spec §B.1`,
 * §E.1; contract C3 §6 slices 29 and 30, the meters slice SH-17).
 *
 * Two INTERNAL actions of `SimActions` are built from this file, on the precedent of
 * `setTabletLink`: the Core server calls them from the capture supervisor's events, no client may.
 *
 * `applyCaptureTelemetry` — one TELEMETRY frame of the worker, about 20 a second:
 *
 * | Part of the frame | Where it goes | Stored? |
 * |-------------------|---------------|---------|
 * | `levels` | `AudioRuntime.captureLevels`, which the audio subsystem shows in its next 20 Hz frame of the `audio` slice (the streamed meters) | never: `audio` is not a durable slice |
 * | `ingest` | `online` and `streamState` of that camera in `captureDevices` and in `captureConfig.cameras` | yes, when the value changed; else nothing is committed |
 * | `fragments` | nowhere: no slice holds a fragment count while a session records (it is part of the sealed evidence file, row 82) | no |
 *
 * So a frame that reports what the state already holds commits nothing: the store is not set, the
 * engine host plans no write and the revision does not move.
 *
 * `raiseCaptureWarning` — `MIC_SILENT` or `CAPTURE_FAULT` as the fault of that kind: the alert,
 * the FAULT_RAISED audit row and the event that `inject` writes, and nothing else. It never
 * changes the active mic input (OD-11): the operator decides.
 *
 * `clearCaptureWarning` — the condition is over: that fault is cleared as `clearFault` clears it
 * (FAULT_CLEARED), so the next episode is a new fault with its own alert and audit row.
 */
import { SessionState, type MicRole } from '../domain';
import { activeMeterChannel, captureMicLines, channelOfMicLine, type AudioRuntime } from './audio';
import { SimNotFoundError } from './errors';
import { clearFaultAtKey, raiseFaultAtKey } from './faults';
import type {
  ActiveSession,
  CaptureConfigMic,
  CaptureIngestStateName,
  CaptureMicInputId,
  CaptureTelemetryInput,
  CaptureTelemetryLevel,
  CaptureFaultFacts,
  CaptureWarningInput,
  EpochMs,
  SimState,
} from './types';
import { CaptureStreamState, FaultKind } from './vocabulary';

/**
 * The mic rows a role is read from: the snapshot of the open session when it has one (OD-10: the
 * worker was started with it), else the selector.
 */
function captureMics(state: SimState): readonly CaptureConfigMic[] {
  return captureMicLines(state);
}

/**
 * The mic input that holds `role` in the capture configuration, or null when no row names that
 * role. Any `MIC-NN` of the pair: each of the two lines has its meter channel (ruling D137).
 */
export function micInputOfCaptureRole(state: SimState, role: MicRole): CaptureMicInputId | null {
  return captureMics(state).find((mic) => mic.role === role)?.inputId ?? null;
}

/**
 * Whether the capture of a session is durable (D84, D91 R-1 option A): everything but an explicit
 * `false`. A session without the member - every simulated one, every one stored before the member
 * existed - reads as durable.
 */
export function captureDurableOf(session: Pick<ActiveSession, 'captureDurable'> | null | undefined): boolean {
  return session?.captureDurable !== false;
}

/**
 * THE SEAM of `captureDurable`: what the capture supervisor reports (`status().durable`) becomes
 * the member of the open session's payload. Returns THE SAME state when no session records or the
 * member holds that value already, so a repeated report publishes nothing. Never moves the
 * session state and writes no audit row.
 * NOT CALLED BY PRODUCTION CODE (review R74-16): row 71 was built on the two transitions of
 * `capture-session.ts` that name their session (`captureConnectingTransition`,
 * `captureDurableOfSessionTransition`), which a late report of an ended capture cannot move. This
 * one is kept for its test and for a caller that holds no session ID; it is no part of the path.
 */
export function captureDurableTransition(state: SimState, durable: boolean): SimState {
  const session = state.session;
  if (session === null || session.state !== SessionState.RECORDING) return state;
  if (session.captureDurable === durable) return state;
  return { ...state, session: { ...session, captureDurable: durable } };
}

/**
 * Hands the measured levels to the audio subsystem. Transient: it touches the runtime only, never
 * the store. A role that no mic row holds is ignored; of two entries for one role the later wins.
 */
export function feedCaptureLevels(runtime: AudioRuntime, state: SimState, now: EpochMs, levels: readonly CaptureTelemetryLevel[]): void {
  for (const level of levels) {
    const input = micInputOfCaptureRole(state, level.role);
    if (input === null) continue;
    const dbfs = level.dbfs === null || !Number.isFinite(level.dbfs) ? null : Math.min(0, level.dbfs);
    runtime.captureLevels[input] = { dbfs, clipped: level.clipped === true, at: now };
  }
}

/**
 * What an ingest state says about its camera, or null when it says nothing.
 *
 * | Ingest | Camera | Why |
 * |--------|--------|-----|
 * | `CONNECTED` | online, stream LIVE | the worker receives the stream |
 * | `WAITING` | not online, stream LOST | the worker asked and receives nothing |
 * | `ENDED` while the session is RECORDING | not online, stream LOST | the stream ended under a running recording |
 * | `ENDED` otherwise | unchanged | the worker closes its ingest when a recording stops: that is no loss |
 */
function cameraOfIngest(state: SimState, ingest: CaptureIngestStateName): { online: boolean; streamState: CaptureStreamState } | null {
  if (ingest === 'CONNECTED') return { online: true, streamState: CaptureStreamState.LIVE };
  if (ingest === 'WAITING') return { online: false, streamState: CaptureStreamState.LOST };
  if (ingest === 'ENDED' && state.session?.state === SessionState.RECORDING) return { online: false, streamState: CaptureStreamState.LOST };
  return null;
}

/**
 * The durable part of one telemetry frame. Returns THE SAME state when the frame changes nothing,
 * so the caller commits nothing. An ID that names no camera of `captureDevices` is ignored.
 * `captureConfig.updatedAt` is left alone: it is the stamp of an edit of the selector (the
 * revision a session snapshot records), and telemetry edits nothing.
 */
export function applyCaptureTelemetryTransition(state: SimState, telemetry: CaptureTelemetryInput): SimState {
  let devices = state.captureDevices.devices;
  let cameras = state.captureConfig.cameras;
  for (const entry of telemetry.ingest) {
    const want = cameraOfIngest(state, entry.state);
    if (want === null) continue;
    const device = devices.find((candidate) => candidate.id === entry.deviceId && candidate.kind === 'CAMERA');
    if (device === undefined) continue;
    if (device.online !== want.online || device.streamState !== want.streamState) {
      devices = devices.map((candidate) => (candidate === device ? { ...candidate, ...want } : candidate));
    }
    if (cameras.some((camera) => camera.deviceId === entry.deviceId && (camera.online !== want.online || camera.streamState !== want.streamState))) {
      cameras = cameras.map((camera) => (camera.deviceId === entry.deviceId ? { ...camera, ...want } : camera));
    }
  }
  if (devices === state.captureDevices.devices && cameras === state.captureConfig.cameras) return state;
  return {
    ...state,
    ...(devices !== state.captureDevices.devices ? { captureDevices: { ...state.captureDevices, devices } } : {}),
    ...(cameras !== state.captureConfig.cameras ? { captureConfig: { ...state.captureConfig, cameras } } : {}),
  };
}

/** True when the frame would change a slice the Core stores. The engine host asks before it opens a unit. */
export function captureTelemetryChangesState(state: SimState, telemetry: CaptureTelemetryInput): boolean {
  return applyCaptureTelemetryTransition(state, telemetry) !== state;
}

const MIC_ROLES: readonly string[] = ['PRIMARY', 'STANDBY'] satisfies readonly MicRole[];

/**
 * What a frame names that the Core does not know, so `applyCaptureTelemetry` ignores it: an ingest
 * or fragment ID that is no camera of `captureDevices`, a level role no mic row holds. The IDs on
 * the wire are CAPTURE-DEVICE IDs (`CAM-01`), never track IDs (`VIDEO-01`): a worker that sends
 * the wrong vocabulary shows up here. Each entry is `<list>:<value>`; empty for a clean frame.
 */
export function captureTelemetryIgnored(state: SimState, telemetry: CaptureTelemetryInput): string[] {
  const isCamera = (deviceId: string): boolean => state.captureDevices.devices.some((device) => device.id === deviceId && device.kind === 'CAMERA');
  const ignored: string[] = [];
  for (const level of telemetry.levels) if (micInputOfCaptureRole(state, level.role) === null) ignored.push(`levels:${String(level.role)}`);
  for (const entry of telemetry.ingest) if (!isCamera(entry.deviceId)) ignored.push(`ingest:${String(entry.deviceId)}`);
  for (const entry of telemetry.fragments) if (!isCamera(entry.deviceId)) ignored.push(`fragments:${String(entry.deviceId)}`);
  return ignored;
}

/** The mic row a warning subject names: by role, by input ID or by device ID. */
function micOfSubject(state: SimState, subject: string): CaptureConfigMic | null {
  const mics = captureMics(state);
  if (MIC_ROLES.includes(subject)) return mics.find((mic) => mic.role === subject) ?? null;
  return mics.find((mic) => mic.inputId === subject) ?? mics.find((mic) => mic.deviceId === subject) ?? null;
}

/**
 * The fault a warning is: its kind and the target key it is raised and cleared under.
 *
 * | Code | Subject | Fault target |
 * |------|---------|--------------|
 * | `MIC_SILENT` | null | the channel of the active input (the default of `inject`) |
 * | `MIC_SILENT` | a mic role, input ID or device ID (`MIC-01`) | the channel of that input |
 * | `CAPTURE_FAULT` | null | none: the capture as a whole |
 * | `CAPTURE_FAULT` | a capture-device ID (`CAM-02`) | that ID |
 * | `CAPTURE_FAULT` | a mic role or input ID | the device ID of that mic |
 *
 * Any other subject throws `SimNotFoundError` (a track ID such as `VIDEO-02` among them): a warning
 * is never recorded against a device the Core does not know, and never silently moved to another.
 */
function faultOfCaptureWarning(state: SimState, warning: CaptureWarningInput): { kind: FaultKind; key: string | null } {
  const { code, subject } = warning;
  if (code === FaultKind.MIC_SILENT) {
    // The fault is keyed by a meter channel: that of the active input (ruling D137).
    if (subject === null) return { kind: code, key: activeMeterChannel(state) };
    const mic = micOfSubject(state, subject);
    if (mic === null) throw new SimNotFoundError('captureMic', subject);
    // The fault is keyed by a meter channel: the place of the input among the two lines (ruling D137).
    const channel = channelOfMicLine(captureMics(state), mic.inputId);
    if (channel === null) throw new SimNotFoundError('captureMic', subject);
    return { kind: code, key: channel };
  }
  if (code === FaultKind.CAPTURE_FAULT) {
    if (subject === null) return { kind: code, key: null };
    const device = state.captureDevices.devices.find((candidate) => candidate.id === subject);
    const key = device?.id ?? micOfSubject(state, subject)?.deviceId ?? null;
    if (key === null) throw new SimNotFoundError('captureDevice', subject);
    return { kind: code, key };
  }
  // The code comes from another process: a value outside the two is refused, never guessed.
  throw new SimNotFoundError('captureWarning', String(code));
}

/**
 * `raiseCaptureWarning`. The same warning for the same subject while it is active returns the
 * same state (nothing is written twice). The active input is never touched (OD-11).
 */
export function raiseCaptureWarningTransition(state: SimState, now: EpochMs, warning: CaptureWarningInput): SimState {
  const { kind, key } = faultOfCaptureWarning(state, warning);
  return raiseFaultAtKey(state, now, kind, key, undefined, captureFaultFactsOf(kind, key, warning));
}

const CAPTURE_FAULT_REASON = /^[A-Z][A-Z0-9_]{1,63}$/;

/**
 * The two facts of a capture fault that travel to its alert and its audit row (pass D6 item 14),
 * each only in its own form. The input comes from another process: what is not a code or a count
 * is dropped.
 *
 * `reason` - for every `CAPTURE_FAULT`, about the capture as a whole or about a device: it is the
 * third member of the fault key (kind, reason, device; ruling D146), so two causes on one device
 * are two faults. `evidenceFiles` - only for the capture as a whole (no subject): it counts the
 * files of a session, not of a device.
 */
export function captureFaultFactsOf(kind: FaultKind, key: string | null, warning: CaptureWarningInput): CaptureFaultFacts | undefined {
  if (kind !== FaultKind.CAPTURE_FAULT) return undefined;
  const { reason, evidenceFiles } = warning as { reason?: unknown; evidenceFiles?: unknown };
  const facts: CaptureFaultFacts = {};
  if (typeof reason === 'string' && CAPTURE_FAULT_REASON.test(reason)) facts.reason = reason;
  if (key === null && typeof evidenceFiles === 'number' && Number.isSafeInteger(evidenceFiles) && evidenceFiles >= 0) facts.evidenceFiles = evidenceFiles;
  return facts.reason === undefined && facts.evidenceFiles === undefined ? undefined : facts;
}

/**
 * `clearCaptureWarning`: the fault of that warning is cleared the way `clearFault` clears it (the
 * alert resolved, one FAULT_CLEARED audit row and event). Returns the same state when it is not
 * active. One exception to the table above: `MIC_SILENT` with NO subject clears every active
 * `MIC_SILENT`. The input that was active when it was raised may no longer be the active one
 * (the operator switched), and a clear that names no mic must not leave a warning behind.
 *
 * A clear of a `CAPTURE_FAULT` that names its `reason` (ruling D146) clears the fault of that
 * cause alone; a clear without one clears every cause of the kind on that device, as before.
 */
export function clearCaptureWarningTransition(state: SimState, now: EpochMs, warning: CaptureWarningInput): SimState {
  const { kind, key } = faultOfCaptureWarning(state, warning);
  if (kind === FaultKind.MIC_SILENT && warning.subject === null) return clearFaultAtKey(state, now, kind, undefined);
  return clearFaultAtKey(state, now, kind, key, captureFaultFactsOf(kind, key, warning)?.reason);
}
