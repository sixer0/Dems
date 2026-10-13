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
 * | Mic lines BY ROLE (lines with `role`; D133 (1), rule MIC-ASSIGN of task 4) are one or two lines, no role twice, each `deviceId == inputId`, each a registered microphone; a single line never names the other role's input | `SimTransitionError`, code INVALID_INPUT |
 * | A slot is never cleared (`unassign`) and filled by the same change (AD-10 (3)) | `SimTransitionError`, code INVALID_INPUT, reason `SLOT_UNASSIGNED_AND_ASSIGNED` |
 *
 * An edit that changes nothing returns the SAME state: no audit row, no new `updatedAt`. One
 * CAPTURE_CONFIG_CHANGED row is written per line that changed. A refused edit writes nothing.
 *
 * A SLOT MAY BE UNASSIGNED (task 4 row 162, WP-13a; decisions C14, C18, C21 (8), C25; requirements
 * AD-04, AD-10; names register of row 161, section 4). An unassigned slot is an ABSENT line. Nothing
 * here finds a line by its place: a camera line is found by its track, a microphone line by its
 * role or by the input it names. Order inside one change: `unassign`, then `cameras`, then `mics`;
 * the rules of the selector as a whole are held on the result.
 *
 * | Edit | Audit rows |
 * |------|------------|
 * | `unassign` of a slot that holds a source | 1: the track or the input, `from` the device cleared; no `to`, no `deviceId` |
 * | `unassign` of an empty slot | 0, nothing changes |
 * | an assignment into an empty slot | 1, as for a held slot, WITHOUT `from` (nothing was there) |
 *
 * The mic rows are kept in INPUT order (ascending input ID: `MIC-01` then `MIC-02`), whichever holds the PRIMARY role:
 * a list of the two mic inputs is always that ordered pair (acceptance criterion AC-B-70; the
 * simulated operations 76 and 80 answer the same). The role is a member of a row, not its place.
 */
import { MicRole } from '../domain';
import { AUDIO_CHANNELS, meterInputOfChannel, micInputOfRole, noInputFrame } from './audio';
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
import { AuditType, CaptureStreamState, Permission } from './vocabulary';

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
/** The microphone chosen for an input already is the other input's. */
export const CAPTURE_CONFIG_MIC_ON_BOTH_INPUTS = 'MIC_ON_BOTH_INPUTS';
/**
 * One change clears a slot (`unassign`) and fills the same slot (task 4 row 162; names register
 * N17; AD-10 (3)). The contract's schema refuses the forms it can see (a camera line of the track,
 * a mic line of the role); the action holds the rule for those too and for the one form no schema
 * can see: a mic line WITHOUT `role` that edits the input the cleared slot held.
 */
export const CAPTURE_CONFIG_SLOT_UNASSIGNED_AND_ASSIGNED = 'SLOT_UNASSIGNED_AND_ASSIGNED';

/**
 * The profile of a camera line that is assigned into an EMPTY video slot by a change that names no
 * profile (operation 79 never names one; neither client's camera command does): the profile every
 * seeded line holds. A held slot keeps its own profile, as before. A line that names a profile is
 * taken at its word.
 */
export const CAPTURE_CONFIG_EMPTY_SLOT_PROFILE = CAPTURE_PROFILE_1080P25;

const VIDEO_SLOTS: readonly CaptureSelectorSlot[] = ['VIDEO-01', 'VIDEO-02'];
const MIC_SLOTS: readonly CaptureSelectorSlot[] = [MicRole.PRIMARY, MicRole.STANDBY];
const isVideoSlot = (slot: CaptureSelectorSlot): slot is CaptureConfigCamera['trackId'] => VIDEO_SLOTS.includes(slot);
const isMicSlot = (slot: CaptureSelectorSlot): slot is MicRole => MIC_SLOTS.includes(slot);
const otherRole = (role: MicRole): MicRole => (role === MicRole.PRIMARY ? MicRole.STANDBY : MicRole.PRIMARY);

function deviceOf(state: SimState, deviceId: string, kind: CaptureDeviceStatus['kind']): CaptureDeviceStatus | null {
  const device = state.captureDevices.devices.find((candidate) => candidate.id === deviceId);
  return device !== undefined && device.kind === kind ? device : null;
}

/** The mic rows in input order (`MIC-01`, `MIC-02`); the SAME array when it is in that order already. */
function inInputOrder(mics: CaptureConfigMic[]): CaptureConfigMic[] {
  const ordered = mics.every((mic, index) => index === 0 || (mics[index - 1]?.inputId ?? '') <= mic.inputId);
  return ordered ? mics : [...mics].sort((left, right) => (left.inputId < right.inputId ? -1 : left.inputId > right.inputId ? 1 : 0));
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
    throw invalid('the two mic inputs need two devices', CAPTURE_CONFIG_MIC_ON_BOTH_INPUTS);
  }
}

/**
 * The transport of an input the selector did not hold and whose line names none: the registry
 * slice carries no transport, so nothing is known here. It is the same neutral code the durable
 * mapping writes for a device no selector slot names (`db/mapping/rows.ts`, `NEUTRAL_TRANSPORT`).
 */
export const UNKNOWN_MIC_TRANSPORT = 'UNKNOWN';

/**
 * Mic lines BY ROLE of operation 78 (decision D133 (1); task 4 rule MIC-ASSIGN, decision C21 (8);
 * names register section 4.2): every line carries `role` and puts its input on the slot of that
 * role. Two lines are the pair replacement of D133 (1); ONE line assigns a role alone, and the
 * slot of the role it does not name keeps what it holds. Held here, for the simulator and the
 * Core alike:
 *
 *   - one or two lines, each with a role, no role twice (a body that mixes the two forms is refused);
 *   - `deviceId == inputId` on each line (D106 (4): a microphone is the input of its own ID), so
 *     two inputs are two devices;
 *   - each device is a microphone of the registry (`MIC-NN`, the built-in pair or one registered later);
 *   - a single line never names the input the OTHER role holds (`MIC_ON_BOTH_INPUTS`): two
 *     microphones trade roles through operation 80 or through the two-line form.
 *
 * The audit rows are those of C3 §5.2, per ROLE: when the same two inputs only trade roles, the one
 * ROLE row operation 80 writes; otherwise one SOURCE row per role whose device (or transport)
 * changed, `from` the device that held the role - ABSENT when the slot of the role was empty
 * (AD-10 (1): `from` is what was there, never the new device). Lines equal to the stored ones give
 * no row.
 */
function assignMicsByRole(
  state: SimState,
  current: CaptureConfigMic[],
  lines: readonly CaptureConfigMicChange[],
): { mics: CaptureConfigMic[]; rows: AuditDetails[] } {
  if (lines.length < 1 || lines.length > 2 || lines.some((line) => line.role === undefined)) throw invalid('mic lines by role are one or two lines, each with a role');
  if (lines.length === 2 && lines[0]?.role === lines[1]?.role) throw invalid('mic lines by role name each role once: one PRIMARY, one STANDBY');
  const heldBy = (role: MicRole): CaptureConfigMic | undefined => current.find((entry) => entry.role === role);
  const built = lines.map((line): CaptureConfigMic => {
    if (line.deviceId !== line.inputId) throw invalid('a mic input holds the microphone of the same ID');
    const device = deviceOf(state, line.deviceId, 'MIC');
    if (device === null) throw invalid('a mic line names no microphone of the registry');
    const held = current.find((entry) => entry.inputId === line.inputId);
    return { inputId: line.inputId, deviceId: device.id, role: line.role ?? MicRole.STANDBY, transport: line.transport ?? held?.transport ?? UNKNOWN_MIC_TRANSPORT, online: device.online };
  });
  const [one, two] = built;
  if (one === undefined) throw invalid('mic lines by role are one or two lines, each with a role');
  if (two !== undefined && one.inputId === two.inputId) throw invalid('the two mic inputs need two devices');
  // The line of the role this change does not name stays as it is (found by its role, never by its place).
  const kept = two === undefined ? heldBy(otherRole(one.role)) : undefined;
  if (kept !== undefined && kept.inputId === one.inputId) throw invalid('the microphone chosen is the one the other role holds', CAPTURE_CONFIG_MIC_ON_BOTH_INPUTS);
  const next = kept === undefined ? built : [...built, kept];

  // A pure trade of roles: two lines over a selector that holds exactly these two inputs.
  const sameInputs = built.length === 2 && current.length === 2 && built.every((mic) => current.some((entry) => entry.inputId === mic.inputId && entry.deviceId === mic.deviceId));
  const rows: AuditDetails[] = [];
  const nextPrimary = built.find((mic) => mic.role === MicRole.PRIMARY);
  if (sameInputs && nextPrimary !== undefined && heldBy(MicRole.PRIMARY)?.inputId !== nextPrimary.inputId) {
    rows.push({ scope: 'MIC', field: 'ROLE', inputId: nextPrimary.inputId, deviceId: nextPrimary.deviceId, from: MicRole.STANDBY, to: MicRole.PRIMARY });
  }
  // The rows in the order PRIMARY, STANDBY, whatever the order of the lines (as the pair replacement always wrote them).
  for (const mic of [...built].sort((left, right) => (left.role === right.role ? 0 : left.role === MicRole.PRIMARY ? -1 : 1))) {
    // After a pure trade of roles the comparison is by input (a transport that changed); otherwise by role.
    const before = sameInputs ? current.find((entry) => entry.inputId === mic.inputId) : heldBy(mic.role);
    if (before !== undefined && before.deviceId === mic.deviceId && before.transport === mic.transport) continue;
    rows.push({ scope: 'MIC', field: 'SOURCE', inputId: mic.inputId, deviceId: mic.deviceId, ...(before === undefined ? {} : { from: before.deviceId }), to: mic.deviceId });
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
    if (profile !== undefined && !PROFILE_CODE.test(profile)) throw invalid('a media profile is a code');
    const slot = cameras.find((entry) => entry.trackId === trackId);
    if (slot === undefined) {
      const streamState = device.streamState ?? (device.online ? CaptureStreamState.LIVE : CaptureStreamState.LOST);
      cameras = inTrackOrder([...cameras, { trackId, deviceId: device.id, profile: profile ?? CAPTURE_CONFIG_EMPTY_SLOT_PROFILE, online: device.online, streamState }]);
      rows.push({ operationId, scope: 'CAMERA', field: 'SOURCE', trackId, deviceId: device.id, to: device.id, permission });
      return;
    }
    const nextProfile = profile ?? slot.profile;
    if (slot.deviceId === device.id && slot.profile === nextProfile) return;
    cameras = cameras.map((entry) =>
      entry === slot ? { ...entry, deviceId: device.id, profile: nextProfile, online: device.online, streamState: device.streamState ?? entry.streamState } : entry,
    );
    rows.push({ operationId, scope: 'CAMERA', field: 'SOURCE', trackId, deviceId: device.id, from: slot.deviceId, to: device.id, permission });
  };

  switch (change.kind) {
    case 'UPDATE': {
      const micLines = change.mics ?? [];
      const byRole = micLines.some((line) => line.role !== undefined);
      // 1. `unassign` (AD-10): each slot named loses its line. One row per slot that held a source,
      //    none for an empty one. The slot is found by its track or its role.
      const cleared = change.unassign ?? [];
      /** The inputs the cleared microphone slots held: a line WITHOUT `role` cannot edit one of them. */
      const clearedInputs = new Set<string>();
      for (const slot of cleared) {
        if (isVideoSlot(slot)) {
          if ((change.cameras ?? []).some((line) => line.trackId === slot)) throw invalid('a slot is not cleared and assigned by one change', CAPTURE_CONFIG_SLOT_UNASSIGNED_AND_ASSIGNED);
          const held = cameras.find((entry) => entry.trackId === slot);
          if (held === undefined) continue;
          cameras = cameras.filter((entry) => entry !== held);
          rows.push({ operationId, scope: 'CAMERA', field: 'SOURCE', trackId: slot, from: held.deviceId, permission });
        } else if (isMicSlot(slot)) {
          if (micLines.some((line) => line.role === slot)) throw invalid('a slot is not cleared and assigned by one change', CAPTURE_CONFIG_SLOT_UNASSIGNED_AND_ASSIGNED);
          const held = mics.find((entry) => entry.role === slot);
          if (held === undefined) continue;
          mics = mics.filter((entry) => entry !== held);
          clearedInputs.add(held.inputId);
          rows.push({ operationId, scope: 'MIC', field: 'SOURCE', inputId: held.inputId, from: held.deviceId, permission });
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
      if (byRole) {
        // BY ROLE (D133 (1); rule MIC-ASSIGN): each line puts its input on the slot of its role.
        const assigned = assignMicsByRole(state, mics, micLines);
        for (const row of assigned.rows) rows.push({ operationId, ...row, permission });
        mics = assigned.mics;
        break;
      }
      for (const line of micLines) {
        const device = deviceOf(state, line.deviceId, 'MIC');
        if (device === null) throw invalid('a mic line names no microphone of the registry');
        // The form the schema cannot see (names register 4.3): the line edits the input a slot of this change just lost.
        if (clearedInputs.has(line.inputId)) throw invalid('a slot is not cleared and assigned by one change', CAPTURE_CONFIG_SLOT_UNASSIGNED_AND_ASSIGNED);
        const slot = mics.find((entry) => entry.inputId === line.inputId);
        if (slot === undefined) throw invalid('the selector has no such mic input');
        const transport = line.transport ?? slot.transport;
        if (slot.deviceId === device.id && slot.transport === transport) continue;
        mics = mics.map((entry) => (entry === slot ? { ...entry, deviceId: device.id, transport, online: device.online } : entry));
        rows.push({ operationId, scope: 'MIC', field: 'SOURCE', inputId: line.inputId, deviceId: device.id, from: slot.deviceId, to: device.id, permission });
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
      const slot = mics.find((entry) => entry.inputId === change.inputId);
      if (slot === undefined) throw new SimNotFoundError('captureMic', change.inputId);
      if (slot.role === MicRole.PRIMARY) break;
      mics = mics.map((entry) => ({ ...entry, role: entry === slot ? MicRole.PRIMARY : MicRole.STANDBY }));
      rows.push({ operationId, scope: 'MIC', field: 'ROLE', inputId: slot.inputId, deviceId: slot.deviceId, from: MicRole.STANDBY, to: MicRole.PRIMARY, permission });
      break;
    }
    default: {
      const unknown: never = change;
      throw invalid(`no such change: ${String((unknown as { kind?: unknown }).kind)}`);
    }
  }

  if (rows.length === 0) return state;
  // Only an edit of the mic rows puts them in order: a camera edit leaves that list alone.
  if (mics !== state.captureConfig.mics) mics = inInputOrder(mics);
  assertSelector(cameras, mics);

  // A meter channel is a line of a COMPLETE pair, at its place in the list as held (ruling D137, kept
  // by C21 (7); `meterInputOfChannel`). Without a complete pair no channel has an input: such a
  // channel moves no role and names no meter.
  const roleOfChannel = (channel: (typeof AUDIO_CHANNELS)[number]): MicRole | undefined => {
    const inputId = meterInputOfChannel(mics, channel);
    return inputId === null ? undefined : mics.find((entry) => entry.inputId === inputId)?.role;
  };
  const roleMoved = state.mics.some((mic) => {
    const role = roleOfChannel(mic.id);
    return role !== undefined && role !== mic.micRole;
  });
  // An edit that changes WHICH inputs the selector holds (or their order) re-keys the meters: one
  // frame per microphone line of the new selector and no other key (names register 4.5; site C12),
  // and the active input is the PRIMARY of the new selector - the input a recording would start
  // on. (No session is open here - the selector is locked while one is - so no recording is being
  // metered. An edit that keeps the inputs leaves the meters slice alone, as before.)
  //   - two complete pairs, before and after: each CHANNEL keeps its newest frame under the input
  //     it is now, as before (D137);
  //   - anything else: a line keeps the frame of ITS OWN input, and an input the meters did not
  //     hold starts at "no signal". Nothing is keyed by an input the selector does not hold.
  const before = state.captureConfig.mics;
  const rekeyed = mics.length !== before.length || mics.some((mic, index) => mic.inputId !== before[index]?.inputId);
  const heldFrameOf = (inputId: string): AudioFrame | undefined => {
    for (const channel of AUDIO_CHANNELS) {
      if (meterInputOfChannel(mics, channel) !== inputId) continue;
      const was = meterInputOfChannel(before, channel);
      // Two complete pairs: the frame of the input this CHANNEL was.
      if (was !== null) return state.audio.inputs[was];
    }
    return state.audio.inputs[inputId];
  };
  const inputs = Object.fromEntries(mics.map((mic) => [mic.inputId, heldFrameOf(mic.inputId) ?? noInputFrame(now)]));
  // Without a PRIMARY line the state holds NO active input (task 4 row 149): `null` - never the
  // input it held, never a line by its place, never a built-in input.
  const activeInputId = micInputOfRole(mics, MicRole.PRIMARY);
  let next: SimState = {
    ...state,
    captureConfig: { ...state.captureConfig, cameras, mics, updatedAt: now },
    // The mic slice carries the same capture role, so that health, audio status and the selector
    // agree. It is a new slice only when a role moved: a camera edit leaves it alone.
    ...(roleMoved ? { mics: state.mics.map((mic) => ({ ...mic, micRole: roleOfChannel(mic.id) ?? mic.micRole })) } : {}),
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
