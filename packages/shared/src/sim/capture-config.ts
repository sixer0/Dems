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
 * | A replacing mic pair (lines with `role`, D133 (1)) is two lines, one PRIMARY and one STANDBY, each `deviceId == inputId`, each a registered microphone | `SimTransitionError`, code INVALID_INPUT |
 *
 * An edit that changes nothing returns the SAME state: no audit row, no new `updatedAt`. One
 * CAPTURE_CONFIG_CHANGED row is written per line that changed. A refused edit writes nothing.
 *
 * The mic rows are kept in INPUT order (ascending input ID: `MIC-01` then `MIC-02`), whichever holds the PRIMARY role:
 * a list of the two mic inputs is always that ordered pair (acceptance criterion AC-B-70; the
 * simulated operations 76 and 80 answer the same). The role is a member of a row, not its place.
 */
import { MicRole } from '../domain';
import { AUDIO_CHANNELS, micInputOfChannel, noInputFrame } from './audio';
import { requirePermission } from './auth';
import { SimErrorCode, SimNotFoundError, SimTransitionError } from './errors';
import { recordActivity } from './events';
import { isSessionActive, sendingDeviceOf } from './session-machine';
import type { CaptureConfigCamera, CaptureConfigChange, CaptureConfigMic, CaptureConfigMicChange, CaptureDeviceStatus, EpochMs, SimState } from './types';
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
/** The microphone chosen for an input already is the other input's. */
export const CAPTURE_CONFIG_MIC_ON_BOTH_INPUTS = 'MIC_ON_BOTH_INPUTS';

function deviceOf(state: SimState, deviceId: string, kind: CaptureDeviceStatus['kind']): CaptureDeviceStatus | null {
  const device = state.captureDevices.devices.find((candidate) => candidate.id === deviceId);
  return device !== undefined && device.kind === kind ? device : null;
}

/** The mic rows in input order (`MIC-01`, `MIC-02`); the SAME array when it is in that order already. */
function inInputOrder(mics: CaptureConfigMic[]): CaptureConfigMic[] {
  const ordered = mics.every((mic, index) => index === 0 || (mics[index - 1]?.inputId ?? '') <= mic.inputId);
  return ordered ? mics : [...mics].sort((left, right) => (left.inputId < right.inputId ? -1 : left.inputId > right.inputId ? 1 : 0));
}

/** The rules of the selector as a whole. They are the CHECKs of the stored row, said before any write. */
function assertSelector(cameras: readonly CaptureConfigCamera[], mics: readonly CaptureConfigMic[]): void {
  const [first, second] = cameras;
  if (first !== undefined && second !== undefined && first.deviceId === second.deviceId && first.profile === second.profile) {
    throw invalid('one camera on both tracks needs two profiles', CAPTURE_CONFIG_CAMERA_ON_BOTH_TRACKS);
  }
  const [one, other] = mics;
  if (one !== undefined && other !== undefined && one.deviceId === other.deviceId) {
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
 * PAIR REPLACEMENT of operation 78 (decision D133 (1)): the mic lines carry `role` and are the new
 * pair. Held here, for the simulator and the Core alike:
 *
 *   - exactly two lines, each with a role: one PRIMARY, one STANDBY (a body that mixes the two
 *     forms is refused);
 *   - `deviceId == inputId` on each line (D106 (4): a microphone is the input of its own ID), so
 *     two inputs are two devices;
 *   - each device is a microphone of the registry (`MIC-NN`, the built-in pair or one registered later).
 *
 * The audit rows are those of C3 §5.2, per ROLE: when the same two inputs only trade roles, the one
 * ROLE row operation 80 writes; otherwise one SOURCE row per role whose device (or transport)
 * changed, `from` the device that held the role. A pair equal to the stored one gives no row.
 */
function replaceMicPair(
  state: SimState,
  current: CaptureConfigMic[],
  lines: readonly CaptureConfigMicChange[],
): { mics: CaptureConfigMic[]; rows: AuditDetails[] } {
  if (lines.length !== 2 || lines.some((line) => line.role === undefined)) throw invalid('a replacing mic pair is two lines, each with a role');
  const lineOf = (role: MicRole): CaptureConfigMicChange | undefined => lines.find((line) => line.role === role);
  const primary = lineOf(MicRole.PRIMARY);
  const standby = lineOf(MicRole.STANDBY);
  if (primary === undefined || standby === undefined) throw invalid('a replacing mic pair has one PRIMARY and one STANDBY');
  const built = [primary, standby].map((line): CaptureConfigMic => {
    if (line.deviceId !== line.inputId) throw invalid('a mic input holds the microphone of the same ID');
    const device = deviceOf(state, line.deviceId, 'MIC');
    if (device === null) throw invalid('a mic line names no microphone of the registry');
    const held = current.find((entry) => entry.inputId === line.inputId);
    return { inputId: line.inputId, deviceId: device.id, role: line.role ?? MicRole.STANDBY, transport: line.transport ?? held?.transport ?? UNKNOWN_MIC_TRANSPORT, online: device.online };
  });
  const [nextPrimary, nextStandby] = built;
  if (nextPrimary === undefined || nextStandby === undefined || nextPrimary.inputId === nextStandby.inputId) throw invalid('the two mic inputs need two devices');

  const heldBy = (role: MicRole): CaptureConfigMic | undefined => current.find((entry) => entry.role === role);
  const sameInputs = current.length === 2 && built.every((mic) => current.some((entry) => entry.inputId === mic.inputId && entry.deviceId === mic.deviceId));
  const rows: AuditDetails[] = [];
  if (sameInputs && heldBy(MicRole.PRIMARY)?.inputId !== nextPrimary.inputId) {
    rows.push({ scope: 'MIC', field: 'ROLE', inputId: nextPrimary.inputId, deviceId: nextPrimary.deviceId, from: MicRole.STANDBY, to: MicRole.PRIMARY });
  }
  for (const mic of built) {
    // After a pure trade of roles the comparison is by input (a transport that changed); otherwise by role.
    const before = sameInputs ? current.find((entry) => entry.inputId === mic.inputId) : heldBy(mic.role);
    if (before !== undefined && before.deviceId === mic.deviceId && before.transport === mic.transport) continue;
    rows.push({ scope: 'MIC', field: 'SOURCE', inputId: mic.inputId, deviceId: mic.deviceId, from: before?.deviceId ?? mic.deviceId, to: mic.deviceId });
  }
  return { mics: rows.length === 0 ? current : built, rows };
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

  const assignCamera = (trackId: CaptureConfigCamera['trackId'], device: CaptureDeviceStatus, profile: string | undefined): void => {
    const slot = cameras.find((entry) => entry.trackId === trackId);
    if (slot === undefined) throw invalid('the selector has no such video track');
    if (profile !== undefined && !PROFILE_CODE.test(profile)) throw invalid('a media profile is a code');
    const nextProfile = profile ?? slot.profile;
    if (slot.deviceId === device.id && slot.profile === nextProfile) return;
    cameras = cameras.map((entry) =>
      entry === slot ? { ...entry, deviceId: device.id, profile: nextProfile, online: device.online, streamState: device.streamState ?? entry.streamState } : entry,
    );
    rows.push({ operationId, scope: 'CAMERA', field: 'SOURCE', trackId, deviceId: device.id, from: slot.deviceId, to: device.id, permission });
  };

  switch (change.kind) {
    case 'UPDATE': {
      for (const line of change.cameras ?? []) {
        const device = deviceOf(state, line.deviceId, 'CAMERA');
        if (device === null) throw invalid('a camera line names no camera of the registry');
        assignCamera(line.trackId, device, line.profile);
      }
      const micLines = change.mics ?? [];
      if (micLines.some((line) => line.role !== undefined)) {
        // PAIR REPLACEMENT (decision D133 (1)): the two lines ARE the new pair of inputs.
        const replaced = replaceMicPair(state, mics, micLines);
        for (const row of replaced.rows) rows.push({ operationId, ...row, permission });
        mics = replaced.mics;
        break;
      }
      for (const line of micLines) {
        const device = deviceOf(state, line.deviceId, 'MIC');
        if (device === null) throw invalid('a mic line names no microphone of the registry');
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

  const roleOf = (inputId: string): MicRole | undefined => mics.find((entry) => entry.inputId === inputId)?.role;
  // A meter channel is the microphone line of its place (ruling D137): channel 1 the first line, channel 2 the second.
  const roleMoved = state.mics.some((mic) => {
    const role = roleOf(micInputOfChannel(mics, mic.id));
    return role !== undefined && role !== mic.micRole;
  });
  // A replaced pair re-keys the meters: each channel keeps its newest frame under the input it is
  // now, and the active input is the PRIMARY of the new pair - the input a recording would start
  // on. (No session is open here - the selector is locked while one is - so no recording is being
  // metered. An edit that keeps the two inputs leaves the meters slice alone, as before.)
  const before = state.captureConfig.mics;
  const rekeyed = AUDIO_CHANNELS.some((channel) => micInputOfChannel(mics, channel) !== micInputOfChannel(before, channel));
  const inputs = Object.fromEntries(AUDIO_CHANNELS.map((channel) => [micInputOfChannel(mics, channel), state.audio.inputs[micInputOfChannel(before, channel)] ?? noInputFrame(now)]));
  const activeInputId = mics.find((entry) => entry.role === MicRole.PRIMARY)?.inputId ?? micInputOfChannel(mics, 'AUDIO-01');
  let next: SimState = {
    ...state,
    captureConfig: { ...state.captureConfig, cameras, mics, updatedAt: now },
    // The mic slice carries the same capture role, so that health, audio status and the selector
    // agree. It is a new slice only when a role moved: a camera edit leaves it alone.
    ...(roleMoved ? { mics: state.mics.map((mic) => ({ ...mic, micRole: roleOf(micInputOfChannel(mics, mic.id)) ?? mic.micRole })) } : {}),
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
