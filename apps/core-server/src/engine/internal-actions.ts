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
import type { CaptureDeviceStatus, ReaddressCaptureDeviceInput, RegisterCaptureDeviceInput, RegisterCaptureMicrophoneInput, SimState, StoreCaptureDeviceProfilesInput } from '@dems/shared/sim';
import { EngineError } from './errors';
import type { EngineUnit } from './types';

export interface InternalActions {
  registerCaptureDevice(device: RegisterCaptureDeviceInput): Promise<CaptureDeviceStatus>;
  /** Task 4 rows 185 / 190 (operation 99): see `registerCaptureMicrophoneIn`. */
  registerCaptureMicrophone(microphone: RegisterCaptureMicrophoneInput): Promise<CaptureDeviceStatus>;
  /** Task 4 rows 195 / 196 (operation 100): see `readdressCaptureDeviceIn`. */
  readdressCaptureDevice(change: ReaddressCaptureDeviceInput): Promise<CaptureDeviceStatus>;
  /** Task 4 row V7 (the stored profile list of a camera): see `storeCaptureDeviceProfilesIn`. */
  storeCaptureDeviceProfiles(change: StoreCaptureDeviceProfilesInput): Promise<CaptureDeviceStatus>;
  /** Blueprint row 71 (capture session): see `markCaptureConnectingIn`. */
  markCaptureConnecting(sessionId: string): Promise<boolean>;
  /** Audit row 127 (DF-12; decisions D19, D24, D90): see `noteCaptureDeviceReachIn`. */
  noteCaptureDeviceReach(reading: CaptureDeviceReachReading): Promise<boolean>;
}

/**
 * Audit row 127 (DF-12; decisions D19, D24, D90; contract of row 125): one reach reading of a capture device - the
 * outcome of a live preview. `REACHABLE`: its first picture arrived; `NOT_REACHABLE`: it failed. `checkedAt` is the
 * server clock of the reading (epoch ms).
 *
 * Audit row M97 (D104, D116): `reach: null` with `checkedAt: null` CLEARS the reading ("not checked") - what a path
 * states when it learns that an earlier reading no longer holds but proves no answer itself (a microphone listed again
 * by operation 97, re-enabled by operation 99: a listing opens nothing, so it never states REACHABLE).
 */
export interface CaptureDeviceReachReading {
  readonly deviceId: string;
  readonly reach: 'REACHABLE' | 'NOT_REACHABLE' | null;
  readonly checkedAt: number | null;
}

/**
 * Audit row 127: THE PURE TRANSITION of a reach reading. `checkedAt` and `reach` of that device in
 * `captureDevices.devices[]` - nothing else: `online` (the registry flag the session engine and the pre-check read)
 * and `streamState` stay as they are, `captureConfig` is not touched. Returns THE SAME state for a device the Core
 * does not hold or a reading the entry states already, so nothing is published. The two members are no column of
 * `capture_devices` (`captureDevicesToRows` names neither): the change set of the engine writes no row for them -
 * memory only, absent after a restart (decision D29 Q1).
 */
export function captureDeviceReachTransition(state: SimState, reading: CaptureDeviceReachReading): SimState {
  const devices = state.captureDevices.devices;
  const index = devices.findIndex((device) => device.id === reading.deviceId);
  if (index < 0) return state;
  const device = devices[index] as CaptureDeviceStatus;
  // Row M97: absent and null both read "not checked", so a clear of an entry that states nothing is no change.
  if ((device.reach ?? null) === reading.reach && (device.checkedAt ?? null) === reading.checkedAt) return state;
  const next = devices.slice();
  next[index] = { ...device, reach: reading.reach, checkedAt: reading.checkedAt };
  return { ...state, captureDevices: { ...state.captureDevices, devices: next } };
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
 * Task 4 rows 185 / 190 (design addendum 04 section 4.2; operation 99): runs the INTERNAL action
 * `registerCaptureMicrophone` in `unit` and writes its effect through it. With `deviceId: null`
 * the new row of `capture_devices` - class `MIC`, adapter kind `USB_AUDIO`, the next free
 * `MIC-NN`, all three the action's own - and the publication of slice `captureDevices` commit
 * with the unit; with an id that registered microphone is enabled again and no row is added.
 * Resolves with the registry entry. It checks no permission and writes no audit row: operation 99
 * has passed stage 6 and writes `CAPTURE_AUDIO_INPUT_CHANGED` in the same unit. Rejects with the
 * mapped `ApiFailure` when the simulator refuses the input.
 */
export function registerCaptureMicrophoneIn(unit: EngineUnit, microphone: RegisterCaptureMicrophoneInput): Promise<CaptureDeviceStatus> {
  const actions = bound.get(unit);
  if (actions === undefined) return Promise.reject(new EngineError('ENGINE_ACTION_NOT_HOSTED', NOT_A_HOST_UNIT));
  return actions.registerCaptureMicrophone(microphone);
}

/**
 * Task 4 rows 195 / 196 (WP-12; operation 100 `confirmCaptureDeviceAddress`): THE ENGINE DOOR OF A
 * RE-ADDRESS. Runs the INTERNAL action `readdressCaptureDevice` in `unit` and writes its effect
 * through it: the `host` of ONE registered camera in slice `captureDevices` and the `address` of
 * its `capture_devices` row change in the caller's unit - together with whatever else that unit
 * writes (the audit entry of the operation), or not at all. The slice is published with the
 * commit; a unit that throws after this call leaves the row and the running engine at the old
 * address. Resolves with the registry entry as it stands in the unit.
 *
 * It checks no permission, asks no destination rule and writes no audit row: the operation that
 * calls it has passed stage 6, holds the operator's confirmation and the rule's admission, and
 * writes `CAPTURE_DEVICE_ADDRESS_CHANGED` in the same unit. The address is stored AS GIVEN. An
 * address the camera already holds writes nothing. Rejects with the mapped `ApiFailure` when the
 * action refuses the input (an unknown id, a microphone, the switch, an address not of the form).
 */
export function readdressCaptureDeviceIn(unit: EngineUnit, change: ReaddressCaptureDeviceInput): Promise<CaptureDeviceStatus> {
  const actions = bound.get(unit);
  if (actions === undefined) return Promise.reject(new EngineError('ENGINE_ACTION_NOT_HOSTED', NOT_A_HOST_UNIT));
  return actions.readdressCaptureDevice(change);
}

/**
 * Task 4 row V7 (decisions C36, C117; request of row PR): THE ENGINE DOOR OF A STORED PROFILE LIST.
 * Runs the INTERNAL action `storeCaptureDeviceProfiles` in `unit`: the device entry of ONE registered
 * camera in slice `captureDevices` states `profiles` (the minted codes, in the stored order, each
 * with what it states of its stream). The slice is published with the commit; a unit that throws
 * after this call leaves the running engine with the list it had.
 *
 * IT WRITES NO ROW. The column `capture_devices.profiles` has ONE writer, the caller's own statement
 * in the same unit (`writeAdoptedCameraColumns`): the row mapping never names the column in a
 * change. So the caller writes the row AND calls this door with the SAME list, in one unit - the
 * row and the slice then commit together, and a restart reads back what the slice states.
 *
 * It checks no permission and writes no audit row: the operation that calls it has passed stage 6
 * and writes its own entry in the same unit. A list the entry already states changes nothing.
 * Rejects with the mapped `ApiFailure` when the action refuses the input (an unknown id, a device
 * that is no camera, a value that is no list of at most 16 profile codes, each once).
 */
export function storeCaptureDeviceProfilesIn(unit: EngineUnit, change: StoreCaptureDeviceProfilesInput): Promise<CaptureDeviceStatus> {
  const actions = bound.get(unit);
  if (actions === undefined) return Promise.reject(new EngineError('ENGINE_ACTION_NOT_HOSTED', NOT_A_HOST_UNIT));
  return actions.storeCaptureDeviceProfiles(change);
}

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
 * Audit row 127 (DF-12, DF-13; decisions D19, D24, D90): the outcome of a live preview becomes the reach of that
 * device - `captureDeviceReachTransition` in the unit, published with it. Writes no audit row and no table row: a
 * reach reading is display state (the device tile, the automatic preview gate of the clients), never evidence.
 * Resolves true when the entry changed; false for a device the Core does not hold or a reading it states already.
 */
export function noteCaptureDeviceReachIn(unit: EngineUnit, reading: CaptureDeviceReachReading): Promise<boolean> {
  const actions = bound.get(unit);
  if (actions === undefined) return Promise.reject(new EngineError('ENGINE_ACTION_NOT_HOSTED', NOT_A_HOST_UNIT));
  return actions.noteCaptureDeviceReach(reading);
}
