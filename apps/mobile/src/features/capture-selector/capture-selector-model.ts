/**
 * Pure model of the device selector on the tablet and the phone (task 3, blueprint row 68, M4-W4;
 * `masterplan/08_client_ux_spec.md` §2 flow 1; specs R-1; register MB-08, MB-09). No React, no
 * simulator instance, no clock: rows, options, the gate and the refusal classes are plain functions
 * of the two replicated slices (`captureConfig`, `captureDevices`) and of what an operation answered.
 *
 * | What | Function | Spec |
 * |---|---|---|
 * | The four camera rows and the four microphone rows: one row per SLOT, an empty slot included (task 4 row 32; decision C18 (3); D60/D61 widened both planes) | `cameraRows`, `micRows` | §2.2 step 2 |
 * | The cameras an operator may assign to a track | `cameraOptions` | §2.6 "Source options" (PE-125-04): every registered camera of op 77, never a search candidate |
 * | The state of the edit controls G1-G3 | `selectorGate` | §2.4; §11 (E-16): checking, waiting, denied, locked, allowed |
 * | What a refused operation 78 / 79 means | `classifyAnswer` | §2.5: 403, 404, 409 `CAPTURE_CONFIG_LOCKED`, 422, 503 `CAPTURE_NOT_READY`, no answer |
 * | Whether a saved change is still on its way | `isAwaitingRepublish` | §2.2 step 4 ("optimistic-free"), §2.7 (no client countdown) |
 *
 * OD-12: nothing here names a frame or a preview; a row is text and an icon state only.
 */
import { VIDEO_TRACK_IDS, type VideoTrackId } from '@dems/shared/domain';
// D61 (2026-11-04): the microphone plane mirrors the video plane — the roles became the four numbered channels.
import { MIC_CHANNEL_IDS, capturePairOfMicChannel, type MicChannel } from '@dems/shared/sim';
import { CaptureDeviceKind, CaptureStreamState, type CaptureConfigSlice, type CaptureDeviceStatus, type CaptureDevicesSlice } from '@dems/shared/sim';
import { storedProfilesOf } from './camera-profile';

// ── Rows ─────────────────────────────────────────────────────────────────────────────────

export interface CameraSelectorRow {
  readonly trackId: VideoTrackId;
  /**
   * The capture device behind the track (`CAM-01`, or a camera added later: `CAM-NN`). `null`: the
   * slot is NOT ASSIGNED - the selector holds no line for this track (task 4 row 32).
   */
  readonly deviceId: string | null;
  /** The model the registry names for that device, or null when the registry does not hold it. */
  readonly model: string | null;
  readonly online: boolean;
  /** The line's stream state; null for a slot that is not assigned (there is no line to state one). */
  readonly streamState: CaptureStreamState | null;
  /** `sourceClass` as the Core sent it on the device (flow 12); null when the device carries none. */
  readonly sourceClass: string | null;
  /** `adapter` as the Core sent it on the device; null when the device carries none. */
  readonly adapter: string | null;
}

export interface MicSelectorRow {
  /**
   * The mic input (`MIC-01`..`MIC-04`, or an input added later): the shared contract's open id (D115, pass C1).
   * `null`: the slot of `channel` is NOT ASSIGNED - the selector holds no line with this channel (task 4 row 32; D61).
   */
  readonly inputId: string | null;
  /** The registered microphone on the line; null with `inputId` for a slot that is not assigned. */
  readonly deviceId: string | null;
  readonly model: string | null;
  /** The selector CHANNEL this row fills (`MIC-01`..`MIC-04`; D61 superseded the PRIMARY/STANDBY roles). */
  readonly channel: MicChannel;
  /** The line's transport word; null for a GENERATED source (`statedTransportOf`). */
  readonly transport: string | null;
  readonly online: boolean;
  /** `sourceClass` as the Core sent it on the device (flow 12); null when the device carries none. */
  readonly sourceClass: string | null;
  /** `adapter` as the Core sent it on the device; null when the device carries none. */
  readonly adapter: string | null;
}

/**
 * Fix wave L (the ONE RULE; contract_wave_l.md section 5, G75d-06): `model` of a device whose
 * `adapter` is `FAKE` is a MODEL VALUE of the seed dataset ("Dual-lens IP camera DL-2", "USB condenser
 * microphone UM-1") or what a fake device announced - not a fact of a generated test source. It is
 * not drawn: the line names the device by its id and the "Development source / Test source" badge
 * says what it is. Every other device keeps the model the registry names.
 */
export function statedModelOf(device: Pick<CaptureDeviceStatus, 'model'> & { readonly adapter?: string | null | undefined }): string | null {
  return device.adapter === 'FAKE' ? null : (device.model ?? null);
}

/**
 * Closing pass L-Z (the ONE RULE; decision 5 of note 155): the `transport` of a microphone line ("USB") is
 * the seed dataset's word for the built-in microphones. A source the Core names `adapter: 'FAKE'` is a
 * generated tone - it has no USB input, so the word is not drawn. Every other line keeps what the
 * selector states (a Core in simulated capture and Simulated mode name no adapter: unchanged).
 */
export function statedTransportOf(transport: string | null | undefined, adapter: string | null | undefined): string | null {
  if (adapter === 'FAKE') return null;
  return typeof transport === 'string' && transport !== '' ? transport : null;
}

function modelOf(devices: readonly CaptureDeviceStatus[], deviceId: string): string | null {
  const device = devices.find((candidate) => candidate.id === deviceId);
  return device === undefined ? null : statedModelOf(device);
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

// D60 (2026-11-04): four simultaneous video tracks — the selector holds a line for each.
const TRACK_ORDER: readonly VideoTrackId[] = VIDEO_TRACK_IDS;

// D61 (2026-11-04): four simultaneous microphone channels — the one order the rows derive from.
const CHANNEL_ORDER: readonly MicChannel[] = MIC_CHANNEL_IDS;

/**
 * One row per VIDEO SLOT, always four (D60, 2026-11-04): VIDEO-01 first, then VIDEO-02, VIDEO-03 and
 * VIDEO-04, whatever order the slice carries
 * (task 4 row 32; decision C18 (3); names register E38). A track the selector holds no line for is a
 * row with `deviceId: null`: the screen draws it "Not assigned" with the offer to assign. A line is
 * found by its track, never by its place in the list.
 */
export function cameraRows(config: Pick<CaptureConfigSlice, 'cameras'>, registry: CaptureDevicesSlice): CameraSelectorRow[] {
  return TRACK_ORDER.map((trackId) => {
    const line = config.cameras.find((candidate) => candidate.trackId === trackId);
    if (line === undefined) return { trackId, deviceId: null, model: null, online: false, streamState: null, sourceClass: null, adapter: null };
    return {
      trackId,
      deviceId: line.deviceId,
      model: modelOf(registry.devices, line.deviceId),
      online: line.online,
      streamState: line.streamState,
      ...sourceOf(registry.devices, line.deviceId),
    };
  });
}

/**
 * One row per MICROPHONE SLOT, always four (D61, 2026-11-04): channel `MIC-01` first, then
 * `MIC-02`, `MIC-03`, `MIC-04`, whatever order the slice carries (task 4 row 32; decision C18 (3);
 * names register E38). A channel no line holds is a row with `inputId: null`. A line is found by
 * its CHANNEL, never by its place in the list; should a slice carry one channel twice, the row is
 * the line with the lowest input id.
 */
export function micRows(config: Pick<CaptureConfigSlice, 'mics'>, registry: CaptureDevicesSlice): MicSelectorRow[] {
  return CHANNEL_ORDER.map((channel) => {
    const [line] = config.mics.filter((candidate) => candidate.channel === channel).sort((a, b) => a.inputId.localeCompare(b.inputId));
    if (line === undefined) return { inputId: null, deviceId: null, model: null, channel, transport: null, online: false, sourceClass: null, adapter: null };
    return {
      inputId: line.inputId,
      deviceId: line.deviceId,
      model: modelOf(registry.devices, line.deviceId),
      channel,
      transport: statedTransportOf(line.transport, sourceOf(registry.devices, line.deviceId).adapter),
      online: line.online,
      ...sourceOf(registry.devices, line.deviceId),
    };
  });
}

/** True for the row of a slot that is not assigned (camera or microphone). */
export function isEmptySlotRow(row: Pick<CameraSelectorRow, 'deviceId'>): boolean {
  return row.deviceId === null;
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
  /**
   * Task 4 row W5 (review 060d Q-02; `camera-profile.ts`): the stream profile codes the Core states for this
   * camera (`storedProfilesOf`), in its order. Present only when the device entry states at least one.
   */
  readonly profiles?: readonly string[];
  /** Row W5: the profile of the selector line this camera feeds (`assignedTo`). Present only with such a line. */
  readonly lineProfile?: string;
}

/**
 * Every REGISTERED camera of the registry (op 77), in registry order: the seeded ones and any camera
 * the web console added later (`CAM-NN`, PE-127-07). A search candidate is not in the registry, so it
 * can never be an option (§2.6).
 */
export function cameraOptions(config: Pick<CaptureConfigSlice, 'cameras'>, registry: CaptureDevicesSlice): CameraOption[] {
  return registry.devices
    .filter((device) => device.kind === CaptureDeviceKind.CAMERA)
    .map((device) => {
      const line = config.cameras.find((candidate) => candidate.deviceId === device.id);
      const profiles = storedProfilesOf(device);
      return {
        deviceId: device.id,
        model: statedModelOf(device),
        online: device.online,
        streamState: device.streamState,
        assignedTo: line?.trackId ?? null,
        sourceClass: device.sourceClass ?? null,
        adapter: device.adapter ?? null,
        // Row W5: members only where the Core states them, so an option of before reads exactly as before.
        ...(profiles.length === 0 ? {} : { profiles }),
        ...(line === undefined ? {} : { lineProfile: line.profile }),
      };
    });
}

/** One registered microphone as an option of a microphone channel (fix wave H, gate 70 finding
 * G70-02; ruling D196 widened by D61 of 2026-11-04: the selector offers EVERY registered microphone
 * on each of the four channels).
 */
export interface MicOption {
  /** The registered microphone (`MIC-01`, `MIC-05`, …): the input of the same id (D106 (4)). */
  readonly deviceId: string;
  readonly model: string | null;
  readonly online: boolean;
  /** D61 (2026-11-04): the CHANNEL this microphone holds right now, or null ("not assigned"). */
  readonly channel: MicChannel | null;
  /** `sourceClass` as the Core sent it on the device (flow 12); null when the device carries none. */
  readonly sourceClass: string | null;
  /** `adapter` as the Core sent it on the device; null when the device carries none. */
  readonly adapter: string | null;
}

/**
 * Every REGISTERED microphone of the registry (op 77), in registry order: the four built-ins (D61)
 * and any microphone registered later (`MIC-05`, the Core Mac's microphone of a development
 * configuration). Whether the Core accepts one on a channel is the Core's decision (a development
 * source on a production Core is refused with 422 `DEVELOPMENT_SOURCE_NOT_ALLOWED`, drawn in place).
 */
export function micOptions(config: Pick<CaptureConfigSlice, 'mics'>, registry: CaptureDevicesSlice): MicOption[] {
  return registry.devices
    .filter((device) => device.kind === CaptureDeviceKind.MIC)
    .map((device) => ({
      deviceId: device.id,
      model: statedModelOf(device),
      online: device.online,
      channel: config.mics.find((line) => line.deviceId === device.id)?.channel ?? null,
      sourceClass: device.sourceClass ?? null,
      adapter: device.adapter ?? null,
    }));
}

/** Why an option of a microphone row cannot be chosen; null when it can. */
export type MicOptionRefusal = 'onOtherLine';

/**
 * D61 (2026-11-04): one microphone never stands on two channels, but a microphone another channel
 * holds is an ENABLED MOVE option (R-FLEX row 133, T-14 — the same rule the web console follows):
 * nothing is refused any more, and `micLineCommand` answers the move. The refusal vocabulary stays
 * for the one case that is no edit at all: the microphone already on THIS channel.
 */
export function micOptionRefusal(channel: MicChannel, option: Pick<MicOption, 'channel'>): MicOptionRefusal | null {
  void channel;
  void option;
  return null; // D61: every option is choosable; a held one moves (`micLineCommand`).
}

/** D61: the channel an option already holds that the sheet is NOT about — choosing it moves it here. */
export function micOptionMoveHint(channel: MicChannel, option: Pick<MicOption, 'channel'>): MicChannel | null {
  return option.channel !== null && option.channel !== channel ? option.channel : null;
}

/**
 * The command that puts microphone `chosenId` on the `channel` row, or null when nothing is to send
 * (the channel already holds it). D61 (2026-11-04) generalizes decision D133 (1) and task 4 row 32:
 * the pair replacement is GONE — operation 78's mic lines are keyed by CHANNEL and a line assigns
 * its channel ALONE, the slots it does not name keeping what they hold.
 *
 * | The choice | Command |
 * |---|---|
 * | the microphone already on this channel | none (no change) |
 * | a microphone on no channel | operation 78, ONE line by channel (`micLine`) |
 * | a microphone another channel holds, this channel holding none | ONE operation 78 MOVE `{ unassign: [from], mics: [line] }` (`micMove`, register S2; R-FLEX row 133 / T-14) — the pair it leaves is incomplete |
 * | a microphone another channel holds, this channel holding one | ONE operation 78 SWAP `{ mics: [to-line, from-line] }` (`micMove` with `other`, register S1; audit row 188, M3-07 R1; D126) — the two microphones trade channels, no pair is left without one |
 *
 * Either way one microphone never stands on two channels, and the move is sent only after the operator's confirm (`micMoveGate`).
 */
export function micLineCommand(channel: MicChannel, chosenId: string, config: { readonly mics: readonly { readonly inputId: string; readonly channel: MicChannel }[] }): SelectorCommand | null {
  const held = config.mics.find((line) => line.channel === channel)?.inputId ?? null;
  if (chosenId === held) return null;
  const other = config.mics.find((line) => line.channel !== channel && line.inputId === chosenId);
  // Audit row 188 (M3-07 R1/R2; D126): a channel that holds a microphone gives it back to `from` (the SWAP, S1);
  // an empty channel takes the microphone alone (the MOVE, S2).
  if (other !== undefined) return held === null ? { kind: 'micMove', from: other.channel, channel, inputId: chosenId } : { kind: 'micMove', from: other.channel, channel, inputId: chosenId, other: held };
  return { kind: 'micLine', channel, inputId: chosenId };
}

/**
 * What the operator confirms before a microphone move is sent (audit row 188, M3-07 R1/R2; register S5-S10): the
 * SWAP asks `devices.pairs.swapTitle` / `swapConfirm` / `swap` (S5/S6/S7), the MOVE asks `moveTitle` / `moveConfirm` /
 * `move` (S8/S9/S10). `fromPair` / `toPair` are the pair numbers of the two channels (D5: `MIC-0N` is Pair N);
 * `deviceId` is the chosen microphone, `other` the one the target channel gives back. The dialog is row 189's.
 */
export type MicMoveAsk =
  | { readonly kind: 'SWAP'; readonly from: MicChannel; readonly to: MicChannel; readonly fromPair: number; readonly toPair: number; readonly deviceId: string; readonly other: string }
  | { readonly kind: 'MOVE'; readonly from: MicChannel; readonly to: MicChannel; readonly fromPair: number; readonly toPair: number; readonly deviceId: string };

export function micMoveAskOf(command: Extract<SelectorCommand, { kind: 'micMove' }>): MicMoveAsk {
  const base = { from: command.from, to: command.channel, fromPair: capturePairOfMicChannel(command.from).pair, toPair: capturePairOfMicChannel(command.channel).pair, deviceId: command.inputId };
  return command.other === undefined ? { kind: 'MOVE', ...base } : { kind: 'SWAP', ...base, other: command.other };
}

/** True when the Core holds no selector line and no capture device at all (§2.5 "Empty device list"). */
export function isSelectorEmpty(config: Pick<CaptureConfigSlice, 'cameras' | 'mics'>, registry: CaptureDevicesSlice): boolean {
  return config.cameras.length === 0 && config.mics.length === 0 && registry.devices.length === 0;
}

/**
 * The status word of a camera row: text only (OD-12). Task 4 row W6 (request lines 566, 569; decisions C141,
 * C143): `NOT_READ` is the Core's `streamState: null` - nobody reads the camera's stream now (an idle registered
 * camera; LIVE only while an open session's ingest receives it). Never "Live" or "Lost" for it.
 */
export type CameraLineStatus = 'LIVE' | 'LOST' | 'OFFLINE' | 'NOT_READ';

export function cameraLineStatus(row: Pick<CameraSelectorRow, 'online' | 'streamState'>): CameraLineStatus {
  if (!row.online) return 'OFFLINE';
  if (row.streamState === null) return 'NOT_READ';
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

// ── Commands and their answers (ops 78, 79; D61: the selector edits lines by channel) ────

export type SelectorCommand =
  /**
   * Operation 79. With `profile` (task 4 row W5, review 060d Q-02; `camera-profile.ts`): ONE camera line of
   * operation 78 that names the chosen stream profile - operation 79's body has no profile member, and a
   * production camera is assigned with one of its own.
   */
  | { readonly kind: 'camera'; readonly trackId: VideoTrackId; readonly deviceId: string; readonly profile?: string }
  /**
   * Operation 78, ONE line by CHANNEL (D61 of 2026-11-04, superseding the pair replacement D133 (1)
   * and the lone-line-by-role N16): `mics: [{ channel, inputId, deviceId: inputId }]`. A line assigns
   * its channel alone; the slots it does not name keep what they hold (rule MIC-ASSIGN, C21 (8)).
   */
  | { readonly kind: 'micLine'; readonly channel: MicChannel; readonly inputId: string }
  /**
   * Operation 78, ONE edit: the microphone `inputId` leaves the channel `from` and takes the channel `channel`.
   * - `other` absent (the target channel holds none): the MOVE `{ unassign: [from], mics: [line] }` (S2; R-FLEX row 133, T-14; D61).
   * - `other` present (the microphone the target channel holds): the SWAP `{ mics: [to-line, from-line] }`, `other`
   *   going to `from`, no `unassign` (S1; audit row 188, M3-07 R1; D126; D22(3)).
   */
  | { readonly kind: 'micMove'; readonly from: MicChannel; readonly channel: MicChannel; readonly inputId: string; readonly other?: string };

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
  // Row W5: the same camera with ANOTHER of its profiles is a change; a command that names no profile is judged as before.
  if (command.kind === 'camera') {
    return config.cameras.some((line) => line.trackId === command.trackId && line.deviceId === command.deviceId && (command.profile === undefined || command.profile === line.profile));
  }
  // D61 (2026-11-04): a line by channel; a move is always a change (the channel it names differs).
  if (command.kind === 'micMove') return false;
  return config.mics.some((line) => line.inputId === command.inputId && line.channel === command.channel);
}
