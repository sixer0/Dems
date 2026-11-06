/**
 * The edit of the device selector as one pure transition (task 3, blueprint row 66; register SH-18;
 * contract C3 §2.4 operations 78 to 80, §5.2 `CAPTURE_CONFIG_CHANGED`, §6 slice 29).
 *
 * The hosted action `setCaptureConfig` of `SimActions` is built from this file: the Core server
 * runs it under the caller's identity for operations 78, 79 and 80, so the selector, its audit row
 * and the publication of the `captureConfig` slice are one unit of work.
 *
 * What the transition holds, so that no statement can reach a CHECK of `capture_config`
 * (`dbc-3 §B.1`) and no audit row can leave the key list of C3 §5.2:
 *
 * | Rule | Refusal |
 * |------|---------|
 * | CAPTURE_CONFIG is needed (SUPERVISOR, TECHNICIAN; OD-10) | `SimPermissionError` |
 * | Editable only while no session is open (OD-10) | `SimTransitionError` (the Core answers `409 CAPTURE_CONFIG_LOCKED` before it calls the action) |
 * | The camera of operation 79 and the mic input of operation 80 are in the registry | `SimNotFoundError` |
 * | A line of operation 78 names a registered device of the right class, and a profile that is a code | `SimTransitionError`, code INVALID_INPUT |
 * | The two mic inputs have two devices; one camera on both tracks has two profiles (OD-05) | `SimTransitionError`, code INVALID_INPUT |
 * | Mic lines BY CHANNEL (lines with `channel`; D133 (1) generalized by D61 of 2026-11-04, rule MIC-ASSIGN of task 4) are one to four lines, no channel twice, each `deviceId == inputId`, each a registered microphone; a single line never names the input another assigned channel holds | `SimTransitionError`, code INVALID_INPUT |
 * | A slot is never cleared (`unassign`) and filled by the same change (AD-10 (3)) | `SimTransitionError`, code INVALID_INPUT, reason `SLOT_UNASSIGNED_AND_ASSIGNED` |
 * | A line never names a RETIRED device (task 4 row RD2; operation 111) | `SimTransitionError`, code INVALID_INPUT, reason `CAPTURE_DEVICE_RETIRED` |
 *
 * An edit that changes nothing returns the SAME state: no audit row, no new `updatedAt`. One
 * CAPTURE_CONFIG_CHANGED row is written per line that changed. A refused edit writes nothing.
 *
 * A SLOT MAY BE UNASSIGNED (task 4 row 162, WP-13a; decisions C14, C18, C21 (8), C25; requirements
 * AD-04, AD-10; names register of row 161, section 4). An unassigned slot is an ABSENT line. Nothing
 * here finds a line by its place: a camera line is found by its track, a microphone line by its
 * channel or by the input it names (D61: the role became the numbered channel). Order inside one
 * change: `unassign`, then `cameras`, then `mics`;
 * the rules of the selector as a whole are held on the result.
 *
 * | Edit | Audit rows |
 * |------|------------|
 * | `unassign` of a slot that holds a source | 1: the track or the input, `from` the device cleared; no `to`, no `deviceId` |
 * | `unassign` of an empty slot | 0, nothing changes |
 * | an assignment into an empty slot | 1, as for a held slot, WITHOUT `from` (nothing was there) |
 *
 * The mic rows are kept in CHANNEL order (`MIC-01`, `MIC-02`, `MIC-03`, `MIC-04`): D61 of
 * 2026-11-04 widened the ordered pair of AC-B-70 to the ordered four and made the channel the key
 * of the row, as the track is the key of a camera row. The simulated operations 76 and 80 answer
 * the same.
 */
import { VIDEO_TRACK_IDS } from '../domain'; // VIDEO_TRACK_IDS: D60 (2026-11-04), the one source of the four video slots
import { AUDIO_CHANNELS, meterInputOfChannel, micInputOfChannel, noInputFrame } from './audio';
import { MIC_CHANNEL_IDS, PRIMARY_MIC_CHANNEL, type MicChannel } from './vocabulary'; // D61 (2026-11-04): the four microphone channels
import { requirePermission } from './auth';
import { SimErrorCode, SimNotFoundError, SimTransitionError } from './errors';
import { recordActivity } from './events';
import { CAPTURE_PROFILE_1080P25 } from './initial-state';
import { isSessionActive, sendingDeviceOf } from './session-machine';
import type {
  AudioFrame,
  CaptureConfigCamera,
  CaptureConfigChange,
  CaptureConfigMic,
  CaptureConfigMicChange,
  CaptureDeviceStatus,
  CaptureSelectorSlot,
  EpochMs,
  SimState,
} from './types';
import { AuditType, Permission } from './vocabulary';

/** The name the action carries in a refusal. */
export const SET_CAPTURE_CONFIG_ACTION = 'setCaptureConfig';

/** The operation each kind of change is (C3 §2.2). Held equal to the contract's table by a test. */
export const CAPTURE_CONFIG_CHANGE_OPERATION_ID = {
  UPDATE: 'updateCaptureConfig',
  CAMERA_SOURCE: 'setCaptureCameraSource',
  PRIMARY_MIC: 'setPrimaryMic',
} as const satisfies Record<CaptureConfigChange['kind'], string>;

/** A media profile is a machine code (`dbc-3 §B.1`, `capture_config_profile_check`). */
const PROFILE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;

type AuditDetails = Record<string, string>;

/**
 * `reason`: the NAMED reason of the two refusals an operator can run into from a picker (fix wave J,
 * finding JA2-24: "Choice not accepted - Nothing was changed" said no why). It travels as
 * `details.reason` of the Core's `422 INVALID_INPUT` and as `SimTransitionError.reason`.
 */
const invalid = (detail: string, reason: string | null = null): SimTransitionError => new SimTransitionError(null, SET_CAPTURE_CONFIG_ACTION, detail, SimErrorCode.INVALID_INPUT, reason);
/** The camera chosen for a track already feeds the other track with the same profile. */
export const CAPTURE_CONFIG_CAMERA_ON_BOTH_TRACKS = 'CAMERA_ON_BOTH_TRACKS';
/** The microphone chosen for a channel already stands on another channel. */
export const CAPTURE_CONFIG_MIC_ON_BOTH_INPUTS = 'MIC_ON_BOTH_INPUTS';
/**
 * One change clears a slot (`unassign`) and fills the same slot (task 4 row 162; names register
 * N17; AD-10 (3)). The contract's schema refuses the forms it can see (a camera line of the track,
 * a mic line of the role); the action holds the rule for those too and for the one form no schema
 * can see: a mic line WITHOUT `role` that edits the input the cleared slot held.
 */
export const CAPTURE_CONFIG_SLOT_UNASSIGNED_AND_ASSIGNED = 'SLOT_UNASSIGNED_AND_ASSIGNED';
/**
 * The device a line names is RETIRED (task 4 row RD2; design 07 section 4.4; decision C147): it is
 * never assigned again. The contract's word `CaptureRetireRefusalReason.CAPTURE_DEVICE_RETIRED`
 * (a test holds them equal); the clients word it with `common.captureSlotRefusal.CAPTURE_DEVICE_RETIRED`.
 */
export const CAPTURE_CONFIG_DEVICE_RETIRED = 'CAPTURE_DEVICE_RETIRED';
const notRetired = (device: CaptureDeviceStatus): CaptureDeviceStatus => {
  if (device.retiredAt !== undefined) throw invalid('a retired device is never assigned again', CAPTURE_CONFIG_DEVICE_RETIRED);
  return device;
};

/**
 * The profile of a camera line that is assigned into an EMPTY video slot by a change that names no
 * profile (operation 79 never names one; neither client's camera command does): the profile every
 * seeded line holds. A held slot keeps its own profile, as before. A line that names a profile is
 * taken at its word.
 */
export const CAPTURE_CONFIG_EMPTY_SLOT_PROFILE = CAPTURE_PROFILE_1080P25;

// D60 (2026-11-04): the four video slots derive from the widened track domain, not a literal pair.
// D61 (2026-11-04): the four microphone slots derive from the channel vocabulary — EIGHT slots.
const VIDEO_SLOTS: readonly CaptureSelectorSlot[] = VIDEO_TRACK_IDS;
const MIC_SLOTS: readonly CaptureSelectorSlot[] = MIC_CHANNEL_IDS;
const isVideoSlot = (slot: CaptureSelectorSlot): slot is CaptureConfigCamera['trackId'] => VIDEO_SLOTS.includes(slot);
const isMicSlot = (slot: CaptureSelectorSlot): slot is MicChannel => MIC_SLOTS.includes(slot);
/** The channel a camera-line-style mic change names, or null. */

function deviceOf(state: SimState, deviceId: string, kind: CaptureDeviceStatus['kind']): CaptureDeviceStatus | null {
  const device = state.captureDevices.devices.find((candidate) => candidate.id === deviceId);
  return device !== undefined && device.kind === kind ? device : null;
}

/** The mic rows in channel order (`MIC-01`..`MIC-04`; D61); the SAME array when it is in that order already. */
function inChannelOrder(mics: CaptureConfigMic[]): CaptureConfigMic[] {
  const ordered = mics.every((mic, index) => index === 0 || (mics[index - 1]?.channel ?? '') <= mic.channel);
  return ordered ? mics : [...mics].sort((left, right) => (left.channel < right.channel ? -1 : left.channel > right.channel ? 1 : 0));
}

/** The camera rows in track order (`VIDEO-01`, `VIDEO-02`); the SAME array when it is in that order already. */
function inTrackOrder(cameras: CaptureConfigCamera[]): CaptureConfigCamera[] {
  const ordered = cameras.every((camera, index) => index === 0 || (cameras[index - 1]?.trackId ?? '') <= camera.trackId);
  return ordered ? cameras : [...cameras].sort((left, right) => (left.trackId < right.trackId ? -1 : left.trackId > right.trackId ? 1 : 0));
}

/**
 * The rules of the selector as a whole. They are the CHECKs of the stored row, said before any
 * write. Each holds between ANY two lines, not between "the first and the second": a selector with
 * one line of a kind, or none, has no pair to compare.
 */
function assertSelector(cameras: readonly CaptureConfigCamera[], mics: readonly CaptureConfigMic[]): void {
  if (cameras.some((camera) => cameras.some((other) => other !== camera && other.trackId !== camera.trackId && other.deviceId === camera.deviceId && other.profile === camera.profile))) {
    throw invalid('one camera on both tracks needs two profiles', CAPTURE_CONFIG_CAMERA_ON_BOTH_TRACKS);
  }
  if (mics.some((mic) => mics.some((other) => other !== mic && other.deviceId === mic.deviceId))) {
    throw invalid('two mic channels need two devices', CAPTURE_CONFIG_MIC_ON_BOTH_INPUTS);
  }
}

/**
 * The transport of an input the selector did not hold and whose line names none: the registry
 * slice carries no transport, so nothing is known here. It is the same neutral code the durable
 * mapping writes for a device no selector slot names (`db/mapping/rows.ts`, `NEUTRAL_TRANSPORT`).
 */
export const UNKNOWN_MIC_TRANSPORT = 'UNKNOWN';

/**
 * Mic lines BY CHANNEL of operation 78 (decision D133 (1), generalized by D61 of 2026-11-04: the
 * roles became the four numbered channels; task 4 rule MIC-ASSIGN, decision C21 (8); names register
 * section 4.2): every line carries `channel` and puts its input on the slot of that channel. The
 * lines over the channels a change names are the replacing set; a line assigns its channel ALONE,
 * and the slot of a channel it does not name keeps what it holds. Held here, for the simulator and
 * the Core alike:
 *
 *   - one to four lines, each with a channel, no channel twice (a body that mixes the two forms is
 *     refused);
 *   - `deviceId == inputId` on each line (D106 (4): a microphone is the input of its own ID), so
 *     two channels are two devices;
 *   - each device is a microphone of the registry (`MIC-NN`, a built-in one or one registered later);
 *   - a line never names the input ANOTHER assigned channel holds (`MIC_ON_BOTH_INPUTS`).
 *
 * The audit rows are those of C3 §5.2, per CHANNEL (D61: the field word became `CHANNEL`): one
 * SOURCE row per channel whose device (or transport) changed, `from` the device that held the
 * channel - ABSENT when the slot of the channel was empty (AD-10 (1): `from` is what was there,
 * never the new device). Lines equal to the stored ones give no row.
 *
 * A SWAP is ONE row (D30 K-6, blueprint row 155; the op 78 text of row 143): two lines that trade
 * the two inputs of two assigned channels - each line takes the device (and transport) the other
 * channel held - write the channel-swap row of operation 80 (`field: 'CHANNEL'`), not two SOURCE
 * rows. The row names the microphone that lands on the LOWER channel: `from` its old channel, `to`
 * the channel it took (so a swap onto channel 1 writes the very row operation 80 writes; the other
 * microphone is the one that held `to`). Any other line (a new device, a rotation over three
 * channels, a changed transport) keeps its SOURCE row. The Core runs this action in its engine unit
 * (`modules/capture-config/routes.ts`), so the Core writes the same rows.
 */
function assignMicsByChannel(
  state: SimState,
  current: CaptureConfigMic[],
  lines: readonly CaptureConfigMicChange[],
): { mics: CaptureConfigMic[]; rows: AuditDetails[] } {
  if (lines.length < 1 || lines.length > MIC_CHANNEL_IDS.length || lines.some((line) => line.channel === undefined)) throw invalid('mic lines by channel are one to four lines, each with a channel');
  const channels = lines.map((line) => line.channel as MicChannel);
  if (new Set(channels).size !== channels.length) throw invalid(`mic lines by channel name each channel once: ${MIC_CHANNEL_IDS.join(', ')}`);
  const heldBy = (channel: MicChannel): CaptureConfigMic | undefined => current.find((entry) => entry.channel === channel);
  const built = lines.map((line): CaptureConfigMic => {
    if (line.deviceId !== line.inputId) throw invalid('a mic input holds the microphone of the same ID');
    const device = deviceOf(state, line.deviceId, 'MIC');
    if (device === null) throw invalid('a mic line names no microphone of the registry');
    notRetired(device);
    const held = current.find((entry) => entry.inputId === line.inputId);
    return { channel: line.channel as MicChannel, inputId: line.inputId, deviceId: device.id, transport: line.transport ?? held?.transport ?? UNKNOWN_MIC_TRANSPORT, online: device.online };
  });
  // A line may not take an input another ASSIGNED channel holds — the untouched lines included.
  for (const mic of built) {
    const other = current.find((entry) => entry.inputId === mic.inputId && entry.channel !== mic.channel);
    if (other !== undefined && !built.some((line) => line.channel === other.channel)) throw invalid('the microphone chosen already stands on another channel', CAPTURE_CONFIG_MIC_ON_BOTH_INPUTS);
  }
  // The lines of channels this change does not name stay as they are (found by their channel, never by their place).
  const named = new Set(channels);
  const kept = current.filter((entry) => !named.has(entry.channel));
  const next = [...built, ...kept];

  /**
   * The line of the OTHER channel of a swap (D30 K-6), or undefined: `mic` takes the input another
   * assigned channel held, with its device and transport, and the line of that channel takes back
   * what `mic`'s channel held, with its device and transport.
   */
  const swapPartnerOf = (mic: CaptureConfigMic, before: CaptureConfigMic | undefined): CaptureConfigMic | undefined => {
    if (before === undefined) return undefined;
    const origin = current.find((entry) => entry.inputId === mic.inputId && entry.channel !== mic.channel);
    if (origin === undefined || origin.deviceId !== mic.deviceId || origin.transport !== mic.transport) return undefined;
    const partner = built.find((line) => line.channel === origin.channel);
    if (partner === undefined || partner.inputId !== before.inputId || partner.deviceId !== before.deviceId || partner.transport !== before.transport) return undefined;
    return partner;
  };
  const rows: AuditDetails[] = [];
  /** The higher channels of the swaps already written: their line is inside the swap row. */
  const swappedChannels = new Set<MicChannel>();
  // The rows in channel order, whatever the order of the lines (as the replacing set always wrote them).
  for (const mic of [...built].sort((left, right) => (left.channel < right.channel ? -1 : left.channel > right.channel ? 1 : 0))) {
    if (swappedChannels.has(mic.channel)) continue;
    const before = heldBy(mic.channel);
    if (before !== undefined && before.deviceId === mic.deviceId && before.transport === mic.transport) continue;
    const partner = swapPartnerOf(mic, before);
    if (partner !== undefined) {
      // D30 K-6 (row 155): ONE channel-swap row of the operation-80 form for the two lines.
      swappedChannels.add(partner.channel);
      rows.push({ scope: 'MIC', field: 'CHANNEL', inputId: mic.inputId, deviceId: mic.deviceId, from: partner.channel, to: mic.channel });
      continue;
    }
    rows.push({ scope: 'MIC', field: 'SOURCE', channel: mic.channel, inputId: mic.inputId, deviceId: mic.deviceId, ...(before === undefined ? {} : { from: before.deviceId }), to: mic.deviceId });
  }
  return { mics: rows.length === 0 ? current : next, rows };
}

/**
 * `setCaptureConfig`: one edit of the selector. Returns the same state when nothing changes.
 * Throws as the table of this file says; a refusal changes nothing.
 *
 * `sendingDeviceId` (fix wave H, driver D; gate 70 finding G70-05): the paired device the command
 * came from - by default the device of the acting identity (`sendingDeviceOf`: what the Core's
 * actor scope set for the command of a tablet or a phone), null for a web console session. Every
 * row of the edit names it in its own `deviceId`, as `CAPTURE_DISCOVERY_SEARCHED` and the audio
 * switch do. The DETAILS are unchanged: their `deviceId` is the capture device a line names.
 */
export function setCaptureConfigTransition(state: SimState, now: EpochMs, change: CaptureConfigChange, sendingDeviceId: string | null = sendingDeviceOf(state, false)): SimState {
  const actor = requirePermission(state, SET_CAPTURE_CONFIG_ACTION, Permission.CAPTURE_CONFIG);
  if (isSessionActive(state.session)) {
    throw new SimTransitionError(state.session.state, SET_CAPTURE_CONFIG_ACTION, 'the capture configuration is locked while a session is open');
  }
  const operationId = CAPTURE_CONFIG_CHANGE_OPERATION_ID[change.kind];
  const permission = Permission.CAPTURE_CONFIG;
  let cameras: CaptureConfigCamera[] = state.captureConfig.cameras;
  let mics: CaptureConfigMic[] = state.captureConfig.mics;
  const rows: AuditDetails[] = [];

  /**
   * A camera device to a video track. The line is found BY ITS TRACK. A track that holds no line
   * (an unassigned slot) gets one: the slot can be assigned again, and its audit row states no
   * `from` because nothing was there.
   */
  const assignCamera = (trackId: CaptureConfigCamera['trackId'], device: CaptureDeviceStatus, profile: string | undefined): void => {
    if (!isVideoSlot(trackId)) throw invalid('the selector has no such video track');
    notRetired(device);
    if (profile !== undefined && !PROFILE_CODE.test(profile)) throw invalid('a media profile is a code');
    const slot = cameras.find((entry) => entry.trackId === trackId);
    // Task 4 row V7c (decision C126 (b)): the line states its camera's stream as the registry entry
    // does - NULL (not read) for a registered camera no session reads; an assignment reads nothing,
    // so it never says LIVE of its own (until this row: `LIVE` from `online` for such a camera).
    if (slot === undefined) {
      const streamState = device.streamState;
      cameras = inTrackOrder([...cameras, { trackId, deviceId: device.id, profile: profile ?? CAPTURE_CONFIG_EMPTY_SLOT_PROFILE, online: device.online, streamState }]);
      rows.push({ operationId, scope: 'CAMERA', field: 'SOURCE', trackId, deviceId: device.id, to: device.id, permission });
      return;
    }
    const nextProfile = profile ?? slot.profile;
    if (slot.deviceId === device.id && slot.profile === nextProfile) return;
    cameras = cameras.map((entry) =>
      entry === slot ? { ...entry, deviceId: device.id, profile: nextProfile, online: device.online, streamState: device.streamState } : entry,
    );
    rows.push({ operationId, scope: 'CAMERA', field: 'SOURCE', trackId, deviceId: device.id, from: slot.deviceId, to: device.id, permission });
  };

  switch (change.kind) {
    case 'UPDATE': {
      const micLines = change.mics ?? [];
      const byChannel = micLines.some((line) => line.channel !== undefined); // D61 (2026-11-04): the by-role form became the by-channel form
      // 1. `unassign` (AD-10): each slot named loses its line. One row per slot that held a source,
      //    none for an empty one. The slot is found by its track or its channel (D61).
      const cleared = change.unassign ?? [];
      /** The inputs the cleared microphone slots held: a line WITHOUT `channel` cannot edit one of them. */
      const clearedInputs = new Set<string>();
      for (const slot of cleared) {
        if (isVideoSlot(slot)) {
          if ((change.cameras ?? []).some((line) => line.trackId === slot)) throw invalid('a slot is not cleared and assigned by one change', CAPTURE_CONFIG_SLOT_UNASSIGNED_AND_ASSIGNED);
          const held = cameras.find((entry) => entry.trackId === slot);
          if (held === undefined) continue;
          cameras = cameras.filter((entry) => entry !== held);
          rows.push({ operationId, scope: 'CAMERA', field: 'SOURCE', trackId: slot, from: held.deviceId, permission });
        } else if (isMicSlot(slot)) {
          if (micLines.some((line) => line.channel === slot)) throw invalid('a slot is not cleared and assigned by one change', CAPTURE_CONFIG_SLOT_UNASSIGNED_AND_ASSIGNED);
          const held = mics.find((entry) => entry.channel === slot);
          if (held === undefined) continue;
          mics = mics.filter((entry) => entry !== held);
          clearedInputs.add(held.inputId);
          rows.push({ operationId, scope: 'MIC', field: 'SOURCE', channel: slot, inputId: held.inputId, from: held.deviceId, permission }); // D61: the row names the cleared channel
        } else {
          throw invalid('the selector has no such slot');
        }
      }
      // 2. `cameras`: by track.
      for (const line of change.cameras ?? []) {
        const device = deviceOf(state, line.deviceId, 'CAMERA');
        if (device === null) throw invalid('a camera line names no camera of the registry');
        assignCamera(line.trackId, device, line.profile);
      }
      // 3. `mics`.
      if (byChannel) {
        // BY CHANNEL (D133 (1) generalized by D61; rule MIC-ASSIGN): each line puts its input on the slot of its channel.
        const assigned = assignMicsByChannel(state, mics, micLines);
        for (const row of assigned.rows) rows.push({ operationId, ...row, permission });
        mics = assigned.mics;
        break;
      }
      for (const line of micLines) {
        const device = deviceOf(state, line.deviceId, 'MIC');
        if (device === null) throw invalid('a mic line names no microphone of the registry');
        notRetired(device);
        // The form the schema cannot see (names register 4.3): the line edits the input a slot of this change just lost.
        if (clearedInputs.has(line.inputId)) throw invalid('a slot is not cleared and assigned by one change', CAPTURE_CONFIG_SLOT_UNASSIGNED_AND_ASSIGNED);
        const slot = mics.find((entry) => entry.inputId === line.inputId);
        if (slot === undefined) throw invalid('the selector has no such mic input');
        const transport = line.transport ?? slot.transport;
        if (slot.deviceId === device.id && slot.transport === transport) continue;
        mics = mics.map((entry) => (entry === slot ? { ...entry, deviceId: device.id, transport, online: device.online } : entry));
        rows.push({ operationId, scope: 'MIC', field: 'SOURCE', channel: slot.channel, inputId: line.inputId, deviceId: device.id, from: slot.deviceId, to: device.id, permission }); // D61: the row names the channel it edited
      }
      break;
    }
    case 'CAMERA_SOURCE': {
      const device = deviceOf(state, change.deviceId, 'CAMERA');
      if (device === null) throw new SimNotFoundError('captureDevice', change.deviceId);
      assignCamera(change.trackId, device, undefined);
      break;
    }
    case 'PRIMARY_MIC': {
      // D61 (2026-11-04): the operation moves the TRANSCRIPTION channel. The named input takes
      // channel `MIC-01`; the input that held channel 1 takes the named input's old channel (the
      // earlier wording made it PRIMARY and the other STANDBY inside one AUDIO-01).
      const slot = mics.find((entry) => entry.inputId === change.inputId);
      if (slot === undefined) throw new SimNotFoundError('captureMic', change.inputId);
      if (slot.channel === PRIMARY_MIC_CHANNEL) break;
      const displaced = mics.find((entry) => entry.channel === PRIMARY_MIC_CHANNEL);
      const movedChannel = slot.channel;
      mics = mics.map((entry) =>
        entry === slot ? { ...entry, channel: PRIMARY_MIC_CHANNEL } : displaced !== undefined && entry === displaced ? { ...entry, channel: movedChannel } : entry,
      );
      rows.push({ operationId, scope: 'MIC', field: 'CHANNEL', inputId: slot.inputId, deviceId: slot.deviceId, from: movedChannel, to: PRIMARY_MIC_CHANNEL, permission });
      break;
    }
    default: {
      const unknown: never = change;
      throw invalid(`no such change: ${String((unknown as { kind?: unknown }).kind)}`);
    }
  }

  if (rows.length === 0) return state;
  // Only an edit of the mic rows puts them in order: a camera edit leaves that list alone.
  if (mics !== state.captureConfig.mics) mics = inChannelOrder(mics);
  assertSelector(cameras, mics);

  // D61 (2026-11-04): a meter channel is the line that NAMES it (`meterInputOfChannel`, the per-channel
  // generalization of ruling D137). Without its line a channel has no input and moves nothing.
  const inputOfMeterChannel = (channel: (typeof AUDIO_CHANNELS)[number]): string | undefined => {
    const inputId = meterInputOfChannel(mics, channel);
    return inputId === null ? undefined : inputId;
  };
  const channelMoved = state.mics.some((mic) => {
    const inputId = inputOfMeterChannel(mic.id);
    return inputId !== undefined && inputId !== mic.deviceId;
  });
  // An edit that changes WHICH inputs the selector holds (or their order) re-keys the meters: one
  // frame per microphone line of the new selector and no other key (names register 4.5; site C12),
  // and the active input is the channel-1 line of the new selector - the input the transcription
  // reads. (No session is open here - the selector is locked while one is - so no recording is being
  // metered. An edit that keeps the inputs leaves the meters slice alone, as before.)
  //   - D61 (2026-11-04): each CHANNEL that had a line before keeps its newest frame under the
  //     input it is now (the per-channel generalization of D137);
  //   - a line that moved off its channel keeps the frame of ITS OWN input, and an input the meters
  //     did not hold starts at "no signal". Nothing is keyed by an input the selector does not hold.
  const before = state.captureConfig.mics;
  const rekeyed = mics.length !== before.length || mics.some((mic, index) => mic.inputId !== before[index]?.inputId);
  const heldFrameOf = (inputId: string): AudioFrame | undefined => {
    for (const channel of AUDIO_CHANNELS) {
      if (meterInputOfChannel(mics, channel) !== inputId) continue;
      const was = meterInputOfChannel(before, channel);
      // The channel kept an input: the frame of the input this CHANNEL was.
      if (was !== null) return state.audio.inputs[was];
    }
    return state.audio.inputs[inputId];
  };
  const inputs = Object.fromEntries(mics.map((mic) => [mic.inputId, heldFrameOf(mic.inputId) ?? noInputFrame(now)]));
  // Without a channel-1 line the state holds NO active input (task 4 row 149; D61): `null` - never
  // the input it held, never a line by its place, never a built-in input.
  const activeInputId = micInputOfChannel(mics, PRIMARY_MIC_CHANNEL);
  let next: SimState = {
    ...state,
    captureConfig: { ...state.captureConfig, cameras, mics, updatedAt: now },
    // The mic slice carries the input of its own channel, so that health, audio status and the
    // selector agree (D61). It is a new slice only when a channel moved its input: a camera edit
    // leaves it alone.
    ...(channelMoved ? { mics: state.mics.map((mic) => { const inputId = inputOfMeterChannel(mic.id); return inputId === undefined || inputId === mic.deviceId ? mic : { ...mic, deviceId: inputId }; }) } : {}),
    ...(rekeyed ? { audio: { inputs, activeInputId } } : {}),
  };
  for (const details of rows) {
    next = {
      ...next,
      ...recordActivity(next, now, {
        audit: {
          type: AuditType.CAPTURE_CONFIG_CHANGED,
          message: `Capture configuration changed (${details['field'] ?? 'FIELD'})`,
          actorId: actor.id,
          ...(sendingDeviceId === null ? {} : { deviceId: sendingDeviceId }),
          details,
        },
      }),
    };
  }
  return next;
}
