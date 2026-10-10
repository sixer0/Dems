/**
 * The INTERNAL simulator actions a server module may run INSIDE its own engine unit (task 3 R-9,
 * blueprint rows 132 / 142; contract C3 §2.6 "Adoption"; `SIM_ACTION_OPERATIONS`, execution
 * `internal`).
 *
 * `scope.command` runs the 33 HOSTED actions, under the caller's identity. An INTERNAL action has
 * no operation and no client: the host has a door of its own for each (`setTabletLink`,
 * `applyCaptureTelemetry`, `raiseCaptureWarning`, `clearCaptureWarning`), and each of those doors
 * is a unit of its own. `registerCaptureDevice` is different: the device must commit TOGETHER with
 * the rows of operation 96 (the adoption's audit rows, the credential row) or not at all. So its
 * door is a function over the unit the module already holds:
 *
 *     await app.engine.run('captureDiscovery.adopt', async (scope) => {
 *       const device = await registerCaptureDeviceIn(scope, { id, model, host, adapter });
 *       await scope.unit.audit.append(...);
 *     });
 *
 * The host binds what the function does when it builds a unit's scope (`bindInternalActions`).
 * A scope the host did not build - a test double - has no binding, and the call says so.
 */
import type { CaptureDeviceStatus, RegisterCaptureDeviceInput } from '@dems/shared/sim';
import type { AudioSourceSwitch, AudioSourceSwitched } from './capture-session';
import { EngineError } from './errors';
import type { EngineUnit } from './types';

export interface InternalActions {
  registerCaptureDevice(device: RegisterCaptureDeviceInput): Promise<CaptureDeviceStatus>;
  /** Blueprint row 71 (capture session): see `markCaptureConnectingIn`. */
  markCaptureConnecting(sessionId: string): Promise<boolean>;
  /** Blueprint row 71 (capture session): see `switchCaptureAudioSourceIn`. */
  switchCaptureAudioSource(change: AudioSourceSwitch): Promise<AudioSourceSwitched | null>;
}

const bound = new WeakMap<EngineUnit, InternalActions>();

/** Called by the host for every unit scope it hands to a module. */
export function bindInternalActions(unit: EngineUnit, actions: InternalActions): EngineUnit {
  bound.set(unit, actions);
  return unit;
}

/**
 * Runs the INTERNAL action `registerCaptureDevice` in `unit` and writes its effect through it: the
 * new row of `capture_devices` and the publication of slice `captureDevices` commit with the
 * unit. Resolves with the registry entry. It checks no permission and writes no audit row: the
 * operation that calls it (96) has passed stage 6 and writes its own rows in the same unit.
 * Rejects with the mapped `ApiFailure` when the simulator refuses the device.
 */
export function registerCaptureDeviceIn(unit: EngineUnit, device: RegisterCaptureDeviceInput): Promise<CaptureDeviceStatus> {
  const actions = bound.get(unit);
  if (actions === undefined) {
    return Promise.reject(new EngineError('ENGINE_ACTION_NOT_HOSTED', 'this unit was not opened by the engine host: an INTERNAL action runs in a unit of `app.engine.run` only'));
  }
  return actions.registerCaptureDevice(device);
}

const NOT_A_HOST_UNIT = 'this unit was not opened by the engine host: an INTERNAL action runs in a unit of `app.engine.run` only';

/**
 * Blueprint row 71 (D84, D91 R-1 option A; `dbc-4` MR-S1): in the unit that persists RECORDING of
 * a REAL recording, the session payload gains `captureDurable: false` ("connecting cameras"). The
 * session wiring calls it right after the hosted `startRecording`, so the start, the member and the
 * four source rows commit together. Resolves true when the member was set; false when that session
 * is not RECORDING in this unit.
 */
export function markCaptureConnectingIn(unit: EngineUnit, sessionId: string): Promise<boolean> {
  const actions = bound.get(unit);
  if (actions === undefined) return Promise.reject(new EngineError('ENGINE_ACTION_NOT_HOSTED', NOT_A_HOST_UNIT));
  return actions.markCaptureConnecting(sessionId);
}

/**
 * Blueprint row 71 (operation 81 in capture mode `real`): the switch the worker ACKNOWLEDGED becomes
 * the state of the open session - the active / standby pair, the media time of the boundary, the
 * timeline item - in the unit in which the caller writes the interval rows and the
 * `AUDIO_SOURCE_SWITCHED` row. Writes no audit row itself. Resolves null when nothing changed.
 */
export function switchCaptureAudioSourceIn(unit: EngineUnit, change: AudioSourceSwitch): Promise<AudioSourceSwitched | null> {
  const actions = bound.get(unit);
  if (actions === undefined) return Promise.reject(new EngineError('ENGINE_ACTION_NOT_HOSTED', NOT_A_HOST_UNIT));
  return actions.switchCaptureAudioSource(change);
}
