/**
 * Pure model of the device selector on the tablet and the phone (task 3, blueprint row 68, M4-W4;
 * `masterplan/08_client_ux_spec.md` §2 flow 1; specs R-1; register MB-08, MB-09). No React, no
 * simulator instance, no clock: rows, options, the gate and the refusal classes are plain functions
 * of the two replicated slices (`captureConfig`, `captureDevices`) and of what an operation answered.
 *
 * | What | Function | Spec |
 * |---|---|---|
 * | The two camera rows and the two microphone rows | `cameraRows`, `micRows` | §2.2 step 2 |
 * | The cameras an operator may assign to a track | `cameraOptions` | §2.6 "Source options" (PE-125-04): every registered camera of op 77, never a search candidate |
 * | The state of the edit controls G1-G3 | `selectorGate` | §2.4; §11 (E-16): checking, waiting, denied, locked, allowed |
 * | What a refused operation 79 / 80 means | `classifyAnswer` | §2.5: 403, 404, 409 `CAPTURE_CONFIG_LOCKED`, 422, 503 `CAPTURE_NOT_READY`, no answer |
 * | Whether a saved change is still on its way | `isAwaitingRepublish` | §2.2 step 4 ("optimistic-free"), §2.7 (no client countdown) |
 *
 * OD-12: nothing here names a frame or a preview; a row is text and an icon state only.
 */
import { TrackId, type MicRole, type VideoTrackId } from '@dems/shared/domain';
import { CaptureDeviceKind, CaptureStreamState, type CaptureConfigSlice, type CaptureDeviceStatus, type CaptureDevicesSlice } from '@dems/shared/sim';

// ── Rows ─────────────────────────────────────────────────────────────────────────────────

export interface CameraSelectorRow {
  readonly trackId: VideoTrackId;
  /** The capture device behind the track (`CAM-01`, or a camera added later: `CAM-NN`). */
  readonly deviceId: string;
  /** The model the registry names for that device, or null when the registry does not hold it. */
  readonly model: string | null;
  readonly online: boolean;
  readonly streamState: CaptureStreamState;
  /** `sourceClass` as the Core sent it on the device (flow 12); null when the device carries none. */
  readonly sourceClass: string | null;
  /** `adapter` as the Core sent it on the device; null when the device carries none. */
  readonly adapter: string | null;
}

export interface MicSelectorRow {
  /** The mic input (`MIC-01`, `MIC-02`, or an input added later): the shared contract's open id (D115, pass C1). */
  readonly inputId: string;
  readonly deviceId: string;
  readonly model: string | null;
  readonly role: MicRole;
  readonly transport: string;
  readonly online: boolean;
  /** `sourceClass` as the Core sent it on the device (flow 12); null when the device carries none. */
  readonly sourceClass: string | null;
  /** `adapter` as the Core sent it on the device; null when the device carries none. */
  readonly adapter: string | null;
}

function modelOf(devices: readonly CaptureDeviceStatus[], deviceId: string): string | null {
  return devices.find((device) => device.id === deviceId)?.model ?? null;
}

/**
 * The two members the "Development source" badge is decided from (task 3 row 138; ux §8f.2 "Selector":
 * the data is the Core's, never client state). Read from the registry entry of the device; null when
 * the Core sent none — the built-in devices carry none until rows 136 / 139 surface them.
 */
function sourceOf(devices: readonly CaptureDeviceStatus[], deviceId: string): { sourceClass: string | null; adapter: string | null } {
  const device = devices.find((candidate) => candidate.id === deviceId);
  return { sourceClass: device?.sourceClass ?? null, adapter: device?.adapter ?? null };
}

const TRACK_ORDER: readonly VideoTrackId[] = [TrackId.VIDEO_01, TrackId.VIDEO_02];

/** VIDEO-01 first, then VIDEO-02, whatever order the slice carries. */
export function cameraRows(config: Pick<CaptureConfigSlice, 'cameras'>, registry: CaptureDevicesSlice): CameraSelectorRow[] {
  return [...config.cameras]
    .sort((a, b) => TRACK_ORDER.indexOf(a.trackId) - TRACK_ORDER.indexOf(b.trackId))
    .map((line) => ({
      trackId: line.trackId,
      deviceId: line.deviceId,
      model: modelOf(registry.devices, line.deviceId),
      online: line.online,
      streamState: line.streamState,
      ...sourceOf(registry.devices, line.deviceId),
    }));
}

/** The PRIMARY input first, then the STANDBY; inside a role by input id. */
export function micRows(config: Pick<CaptureConfigSlice, 'mics'>, registry: CaptureDevicesSlice): MicSelectorRow[] {
  return [...config.mics]
    .sort((a, b) => (a.role === b.role ? a.inputId.localeCompare(b.inputId) : a.role === 'PRIMARY' ? -1 : 1))
    .map((line) => ({
      inputId: line.inputId,
      deviceId: line.deviceId,
      model: modelOf(registry.devices, line.deviceId),
      role: line.role,
      transport: line.transport,
      online: line.online,
      ...sourceOf(registry.devices, line.deviceId),
    }));
}

export interface CameraOption {
  readonly deviceId: string;
  readonly model: string | null;
  readonly online: boolean;
  readonly streamState: CaptureStreamState | null;
  /** The track this camera feeds right now, or null. */
  readonly assignedTo: VideoTrackId | null;
  /** `sourceClass` as the Core sent it on the device (flow 12); null when the device carries none. */
  readonly sourceClass: string | null;
  /** `adapter` as the Core sent it on the device; null when the device carries none. */
  readonly adapter: string | null;
}

/**
 * Every REGISTERED camera of the registry (op 77), in registry order: the seeded ones and any camera
 * the web console added later (`CAM-NN`, PE-127-07). A search candidate is not in the registry, so it
 * can never be an option (§2.6).
 */
export function cameraOptions(config: Pick<CaptureConfigSlice, 'cameras'>, registry: CaptureDevicesSlice): CameraOption[] {
  return registry.devices
    .filter((device) => device.kind === CaptureDeviceKind.CAMERA)
    .map((device) => ({
      deviceId: device.id,
      model: device.model,
      online: device.online,
      streamState: device.streamState,
      assignedTo: config.cameras.find((line) => line.deviceId === device.id)?.trackId ?? null,
      sourceClass: device.sourceClass ?? null,
      adapter: device.adapter ?? null,
    }));
}

/**
 * One registered microphone as an option of a microphone line (fix wave H, gate 70 finding G70-02;
 * ruling D196: the selector offers EVERY registered microphone on both lines).
 */
export interface MicOption {
  /** The registered microphone (`MIC-01`, `MIC-03`, …): the input of the same id (D106 (4)). */
  readonly deviceId: string;
  readonly model: string | null;
  readonly online: boolean;
  /** The line this microphone holds right now, or null ("not assigned"). */
  readonly role: MicRole | null;
  /** `sourceClass` as the Core sent it on the device (flow 12); null when the device carries none. */
  readonly sourceClass: string | null;
  /** `adapter` as the Core sent it on the device; null when the device carries none. */
  readonly adapter: string | null;
}

/**
 * Every REGISTERED microphone of the registry (op 77), in registry order: the built-in pair and any
 * microphone registered later (`MIC-03`, the Core Mac's microphone of a development configuration).
 * Whether the Core accepts one on a line is the Core's decision (a development source on a production
 * Core is refused with 422 `DEVELOPMENT_SOURCE_NOT_ALLOWED`, drawn in place).
 */
export function micOptions(config: Pick<CaptureConfigSlice, 'mics'>, registry: CaptureDevicesSlice): MicOption[] {
  return registry.devices
    .filter((device) => device.kind === CaptureDeviceKind.MIC)
    .map((device) => ({
      deviceId: device.id,
      model: device.model,
      online: device.online,
      role: config.mics.find((line) => line.deviceId === device.id)?.role ?? null,
      sourceClass: device.sourceClass ?? null,
      adapter: device.adapter ?? null,
    }));
}

/** Why an option of a microphone line cannot be chosen; null when it can. */
export type MicOptionRefusal = 'onOtherLine';

/**
 * The same microphone cannot be on both lines (C3 §2.4: "the two mic inputs need two devices").
 * On the PRIMARY line the standby microphone stays choosable: that is the trade of roles operation 80
 * has always done. On the STANDBY line the primary microphone is refused, with its reason: taking it
 * there would leave no primary.
 */
export function micOptionRefusal(role: MicRole, option: Pick<MicOption, 'role'>): MicOptionRefusal | null {
  return role === 'STANDBY' && option.role === 'PRIMARY' ? 'onOtherLine' : null;
}

/**
 * The command that puts microphone `chosenId` on the `role` line, or null when nothing is to send
 * (the line already holds it, the choice is refused, or the selector holds no pair to replace).
 *
 * | Line | Choice | Command |
 * |---|---|---|
 * | PRIMARY | the standby microphone | operation 80 `setPrimaryMic`: the two trade roles (as before) |
 * | PRIMARY | a microphone on no line | operation 78, pair replacement (D133 (1)): it becomes PRIMARY, the standby stays |
 * | STANDBY | a microphone on no line | operation 78, pair replacement: it becomes STANDBY, the primary stays |
 * | STANDBY | the primary microphone | none (`micOptionRefusal`) |
 */
export function micLineCommand(role: MicRole, chosenId: string, config: { readonly mics: readonly { readonly inputId: string; readonly role: MicRole }[] }): SelectorCommand | null {
  const primary = config.mics.find((line) => line.role === 'PRIMARY')?.inputId ?? null;
  const standby = config.mics.find((line) => line.role === 'STANDBY')?.inputId ?? null;
  if (role === 'PRIMARY') {
    if (chosenId === primary) return null;
    if (chosenId === standby) return { kind: 'primaryMic', inputId: chosenId };
    return standby === null ? null : { kind: 'micPair', primaryId: chosenId, standbyId: standby };
  }
  if (chosenId === standby || chosenId === primary) return null;
  return primary === null ? null : { kind: 'micPair', primaryId: primary, standbyId: chosenId };
}

/** True when the Core holds no selector line and no capture device at all (§2.5 "Empty device list"). */
export function isSelectorEmpty(config: Pick<CaptureConfigSlice, 'cameras' | 'mics'>, registry: CaptureDevicesSlice): boolean {
  return config.cameras.length === 0 && config.mics.length === 0 && registry.devices.length === 0;
}

/** The status word of a camera row: text only (OD-12). */
export type CameraLineStatus = 'LIVE' | 'LOST' | 'OFFLINE';

export function cameraLineStatus(row: Pick<CameraSelectorRow, 'online' | 'streamState'>): CameraLineStatus {
  if (!row.online) return 'OFFLINE';
  return row.streamState === CaptureStreamState.LOST ? 'LOST' : 'LIVE';
}

// ── The gate of G1, G2, G3 (§2.4, §11) ───────────────────────────────────────────────────

/**
 * | State | When | What the control shows |
 * |---|---|---|
 * | `checking` | the operator's role is not known yet | disabled, "Checking your permissions…" |
 * | `waiting` | the Core link is down (Live mode) | disabled, the waiting-state row (never an instant enable, P-13) |
 * | `denied` | the role lacks `CAPTURE_CONFIG` | disabled, "Requires the X role" |
 * | `locked` | a session is open (OD-10) | disabled, the locked banner |
 * | `allowed` | none of the above | editable |
 *
 * The order is the order of the table: an unknown role is never read as "denied", and a denied
 * operator is told the role, not the lock (the Core answers 403 before 409 as well).
 */
export type SelectorGateState = 'checking' | 'waiting' | 'denied' | 'locked' | 'allowed';

export interface SelectorGateInput {
  /** A signed-in operator's role is known. */
  readonly roleKnown: boolean;
  /** That role holds `CAPTURE_CONFIG`. */
  readonly permitted: boolean;
  /** The Core link is down: nothing may be sent. */
  readonly linkDown: boolean;
  /** A session is open: the slice's `locked`, or the store's own open session. */
  readonly locked: boolean;
}

export function selectorGate(input: SelectorGateInput): SelectorGateState {
  if (!input.roleKnown) return 'checking';
  if (input.linkDown) return 'waiting';
  if (!input.permitted) return 'denied';
  if (input.locked) return 'locked';
  return 'allowed';
}

/** The gated controls of flow 1 this row draws on the tablet and the phone (§11; check M4-PC-1). */
export const SELECTOR_GATED_CONTROLS = ['G1', 'G2', 'G3'] as const;
export type SelectorGatedControl = (typeof SELECTOR_GATED_CONTROLS)[number];

// ── Commands and their answers (ops 79, 80) ──────────────────────────────────────────────

export type SelectorCommand =
  | { readonly kind: 'camera'; readonly trackId: VideoTrackId; readonly deviceId: string }
  | { readonly kind: 'primaryMic'; readonly inputId: string }
  /** Operation 78, pair replacement (D133 (1); fix wave H, G70-02): the two microphones of the selector, by role. */
  | { readonly kind: 'micPair'; readonly primaryId: string; readonly standbyId: string };

/** What an operation answered, reduced to the three members both sources carry. */
export interface AnswerFacts {
  /** The HTTP status; null when there was no answer. */
  readonly status: number | null;
  /** The envelope's `error.code`, or null. */
  readonly code: string | null;
  /** The envelope's `error.details.reason`, or null. */
  readonly reason: string | null;
}

/**
 * | Class | Answer | Presentation (§2.5) |
 * |---|---|---|
 * | `ok` | 200 | the row is pending until the slice republishes |
 * | `locked` | 409 `CAPTURE_CONFIG_LOCKED` | locked banner; no audit row was written |
 * | `denied` | 403 | read-only selector with the role sentence |
 * | `signedOut` | 401 | the app's own signed-out handling |
 * | `notFound` | 404 | "This device is no longer registered." |
 * | `developmentOnly` | 422 with reason `DEVELOPMENT_SOURCE_NOT_ALLOWED` | field message (PE-125-04) |
 * | `invalid` | 400, 422 | field message; no config change |
 * | `notReady` | 503 | "Capture is not ready yet" with Retry |
 * | `offline` | no answer | the waiting-state row |
 * | `failed` | anything else | a generic failure |
 */
export type AnswerClass = 'ok' | 'locked' | 'denied' | 'signedOut' | 'notFound' | 'developmentOnly' | 'invalid' | 'notReady' | 'offline' | 'failed';

export const CAPTURE_CONFIG_LOCKED = 'CAPTURE_CONFIG_LOCKED';
export const DEVELOPMENT_SOURCE_NOT_ALLOWED = 'DEVELOPMENT_SOURCE_NOT_ALLOWED';

export function classifyAnswer(answer: AnswerFacts): AnswerClass {
  const { status, code, reason } = answer;
  if (status === null) return 'offline';
  if (status >= 200 && status < 300) return 'ok';
  if (status === 409 && code === CAPTURE_CONFIG_LOCKED) return 'locked';
  if (status === 401) return 'signedOut';
  if (status === 403) return 'denied';
  if (status === 404) return 'notFound';
  if (status === 422 && (reason === DEVELOPMENT_SOURCE_NOT_ALLOWED || code === DEVELOPMENT_SOURCE_NOT_ALLOWED)) return 'developmentOnly';
  if (status === 400 || status === 422) return 'invalid';
  if (status === 503) return 'notReady';
  return 'failed';
}

/** A refusal the Core is expected to give: a warning in the runtime log, not an error. */
export function isExpectedRefusal(result: AnswerClass): boolean {
  return result === 'locked' || result === 'denied' || result === 'notFound' || result === 'developmentOnly' || result === 'invalid' || result === 'notReady';
}

/** Reads the three facts out of a simulated answer's body (`{ error: { code, details? } }`), defensively. */
export function factsOfEnvelope(status: number | null, body: unknown): AnswerFacts {
  const error = typeof body === 'object' && body !== null ? (body as { error?: unknown }).error : null;
  if (typeof error !== 'object' || error === null) return { status, code: null, reason: null };
  const { code, details } = error as { code?: unknown; details?: unknown };
  const reason = typeof details === 'object' && details !== null ? (details as { reason?: unknown }).reason : null;
  return { status, code: typeof code === 'string' ? code : null, reason: typeof reason === 'string' ? reason : null };
}

/** `updatedAt` of a `CaptureConfig` answer, or null when the body is not one. */
export function updatedAtOf(body: unknown): number | null {
  if (typeof body !== 'object' || body === null) return null;
  const value = (body as { updatedAt?: unknown }).updatedAt;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * §2.2 step 4: after a 200 the row stays pending until the store holds a `captureConfig` at least as
 * new as the one the answer carried. It is a comparison of two Core stamps; no client clock and no
 * timer decides it (§2.7).
 */
export function isAwaitingRepublish(answeredUpdatedAt: number | null, storeUpdatedAt: number): boolean {
  return answeredUpdatedAt !== null && storeUpdatedAt < answeredUpdatedAt;
}

/** True when the command would change nothing: the control does not send it. */
export function isNoChange(command: SelectorCommand, config: Pick<CaptureConfigSlice, 'cameras' | 'mics'>): boolean {
  if (command.kind === 'camera') return config.cameras.some((line) => line.trackId === command.trackId && line.deviceId === command.deviceId);
  if (command.kind === 'micPair') {
    return (
      config.mics.some((line) => line.inputId === command.primaryId && line.role === 'PRIMARY') &&
      config.mics.some((line) => line.inputId === command.standbyId && line.role === 'STANDBY')
    );
  }
  return config.mics.some((line) => line.inputId === command.inputId && line.role === 'PRIMARY');
}
