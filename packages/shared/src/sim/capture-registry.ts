/**
 * A camera joins the capture-device registry (task 3 R-9, blueprint rows 132 / 142; contract C3
 * §2.6 "Adoption: when a `capture_devices` row comes into being", "What adoption stores"; §6 slice
 * 30; decisions D81, D83, D117).
 *
 * The INTERNAL action `registerCaptureDevice` of `SimActions` is built from this file. It is the
 * one way a device is added to the replicated `captureDevices` slice:
 *
 *   - on the Core server, inside the unit of work of operation 96 (`adoptCaptureCandidate`), after
 *     the access rule, the idle lock, the candidate checks and the re-verification of that
 *     operation. No client can call it: it has no operation of its own (`sim-actions.ts`);
 *   - in the in-app simulator, by the simulated operation 96 (`sim/api.ts`).
 *
 * It checks no permission and no session state: the operation that calls it has done both. It
 * writes NO audit row and no event: the caller writes `CAPTURE_CANDIDATE_ADOPTED` (and the rows
 * beside it) in the same unit, so that the device and its rows commit together or not at all.
 *
 * What it holds itself, so that no stored row can break a CHECK of `capture_devices`:
 *
 * | Rule | Refusal (`SimTransitionError`, code INVALID_INPUT) |
 * |------|---------|
 * | The device is a camera with an id of the form `CAM-NN` | another id |
 * | The id is not in the registry (an id is never reused) | a duplicate |
 * | `host` is a host or an address, never a URL and never `user:password@` (C-N8) | a `/` or an `@` in it |
 * | `adapter` is a machine code | anything else |
 *
 * Adoption is not assignment: `captureConfig` is not changed. The new device carries `adapter` and
 * the class the Core derives from it (`DEVELOPMENT` for `FAKE` and `LOCAL_DEVICE`).
 */
import { SimErrorCode, SimTransitionError } from './errors';
import type { CaptureDeviceStatus, RegisterCaptureDeviceInput, SimState } from './types';

/** The name the action carries in a refusal. */
export const REGISTER_CAPTURE_DEVICE_ACTION = 'registerCaptureDevice';

/** An adopted camera: `CAM-` and two or more digits. */
export const ADOPTED_CAMERA_ID_PATTERN = /^CAM-\d{2,}$/;
const ADAPTER_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
/** The adapter kinds of a source that is not a production device (`dbc-4` §N.2). */
const DEVELOPMENT_ADAPTERS: ReadonlySet<string> = new Set(['FAKE', 'LOCAL_DEVICE']);
const TEXT_MAX = 120;

const invalid = (detail: string): SimTransitionError => new SimTransitionError(null, REGISTER_CAPTURE_DEVICE_ACTION, detail, SimErrorCode.INVALID_INPUT);

/** The next free camera id: the highest number of the registry plus 1, two digits at least. Never a reused one. */
export function nextCaptureCameraId(devices: readonly { readonly id: string }[]): string {
  const highest = devices.reduce((max, device) => {
    const number = /^CAM-(\d+)$/.exec(device.id)?.[1];
    return number === undefined ? max : Math.max(max, Number(number));
  }, 0);
  return `CAM-${String(highest + 1).padStart(2, '0')}`;
}

/** The registry entry of a device that is being registered. Throws as the table of this file says. */
export function captureDeviceOf(state: SimState, input: RegisterCaptureDeviceInput): CaptureDeviceStatus {
  if (!ADOPTED_CAMERA_ID_PATTERN.test(input.id)) throw invalid('a registered camera has an id of the form CAM-NN');
  if (state.captureDevices.devices.some((device) => device.id === input.id)) throw invalid('the registry holds a device with this id');
  if (input.host.length < 1 || input.host.length > TEXT_MAX || /[/@\s]/.test(input.host)) throw invalid('the host of a device is a host or an address');
  if (!ADAPTER_CODE.test(input.adapter)) throw invalid('the adapter of a device is a code');
  if (input.model !== null && (input.model.length < 1 || input.model.length > TEXT_MAX)) throw invalid('the model of a device is a text of 1 to 120 characters');
  return {
    id: input.id,
    kind: 'CAMERA',
    model: input.model,
    firmware: null,
    host: input.host,
    poePort: null,
    online: true,
    // A registered camera feeds no track until operation 78 or 79 assigns it.
    streamState: null,
    capabilities: ['VIDEO'],
    adapter: input.adapter,
    sourceClass: DEVELOPMENT_ADAPTERS.has(input.adapter) ? 'DEVELOPMENT' : 'PRODUCTION',
  };
}

/** `registerCaptureDevice`: the state with the device appended to slice 30. Nothing else changes. */
export function registerCaptureDeviceTransition(state: SimState, input: RegisterCaptureDeviceInput): { state: SimState; result: CaptureDeviceStatus } {
  const device = captureDeviceOf(state, input);
  return { state: { ...state, captureDevices: { ...state.captureDevices, devices: [...state.captureDevices.devices, device] } }, result: device };
}
