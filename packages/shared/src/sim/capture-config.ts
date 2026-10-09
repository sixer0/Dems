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
 *
 * An edit that changes nothing returns the SAME state: no audit row, no new `updatedAt`. One
 * CAPTURE_CONFIG_CHANGED row is written per line that changed. A refused edit writes nothing.
 *
 * The mic rows are kept in INPUT order, `MIC-01` then `MIC-02`, whichever holds the PRIMARY role:
 * a list of the two mic inputs is always that ordered pair (acceptance criterion AC-B-70; the
 * simulated operations 76 and 80 answer the same). The role is a member of a row, not its place.
 */
import { MicRole } from '../domain';
import { MIC_INPUT_OF_CHANNEL } from './audio';
import { requirePermission } from './auth';
import { SimErrorCode, SimNotFoundError, SimTransitionError } from './errors';
import { recordActivity } from './events';
import { isSessionActive } from './session-machine';
import type { CaptureConfigCamera, CaptureConfigChange, CaptureConfigMic, CaptureDeviceStatus, EpochMs, SimState } from './types';
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

const invalid = (detail: string): SimTransitionError => new SimTransitionError(null, SET_CAPTURE_CONFIG_ACTION, detail, SimErrorCode.INVALID_INPUT);

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
    throw invalid('one camera on both tracks needs two profiles');
  }
  const [one, other] = mics;
  if (one !== undefined && other !== undefined && one.deviceId === other.deviceId) {
    throw invalid('the two mic inputs need two devices');
  }
}

/**
 * `setCaptureConfig`: one edit of the selector. Returns the same state when nothing changes.
 * Throws as the table of this file says; a refusal changes nothing.
 */
export function setCaptureConfigTransition(state: SimState, now: EpochMs, change: CaptureConfigChange): SimState {
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
      for (const line of change.mics ?? []) {
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
  const roleMoved = state.mics.some((mic) => {
    const role = roleOf(MIC_INPUT_OF_CHANNEL[mic.id]);
    return role !== undefined && role !== mic.micRole;
  });
  let next: SimState = {
    ...state,
    captureConfig: { ...state.captureConfig, cameras, mics, updatedAt: now },
    // The mic slice carries the same capture role, so that health, audio status and the selector
    // agree. It is a new slice only when a role moved: a camera edit leaves it alone.
    ...(roleMoved ? { mics: state.mics.map((mic) => ({ ...mic, micRole: roleOf(MIC_INPUT_OF_CHANNEL[mic.id]) ?? mic.micRole })) } : {}),
  };
  for (const details of rows) {
    next = {
      ...next,
      ...recordActivity(next, now, {
        audit: {
          type: AuditType.CAPTURE_CONFIG_CHANGED,
          message: `Capture configuration changed (${details['field'] ?? 'FIELD'})`,
          actorId: actor.id,
          details,
        },
      }),
    };
  }
  return next;
}
