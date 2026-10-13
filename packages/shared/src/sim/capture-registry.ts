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
import type { CaptureDeviceStatus, ReaddressCaptureDeviceInput, RegisterCaptureDeviceInput, RegisterCaptureMicrophoneInput, SimState } from './types';

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

// ── A microphone joins the registry (task 4 row 185; design addendum 04 section 4.2 "Where it is
// stored"; security addendum AD-07; ruling RG-4) ──────────────────────────────────────────────
//
// The INTERNAL action `registerCaptureMicrophone` of `SimActions` is built from the functions
// below. It is the one way a `USB_AUDIO` microphone is added to the replicated `captureDevices`
// slice, and the one way a registered one is enabled again:
//
//   - on the Core server, inside the unit of work of operation 99 (`registerCaptureAudioInput`),
//     after that operation's access rule, idle lock and its own second card listing. No client can
//     call it: it has no operation of its own (`sim-actions.ts`);
//   - the in-app simulator does not run it: its operation 99 answers as before (`sim/api.ts`).
//
// As the camera's action, it checks no permission and no session state, writes NO audit row and
// no event (the caller writes `CAPTURE_AUDIO_INPUT_CHANGED` in the same unit) and leaves
// `captureConfig` alone: a registration decides no role (decision C25). RG-4 holds as for a
// camera: a listed card is no descriptor and never enters the registry; only this action, run by
// operation 99 after the Core's own listing, creates one.
//
// What it holds itself, so that no stored row can break a CHECK of `capture_devices`:
//
// | Rule | Refusal (`SimTransitionError`, code INVALID_INPUT) |
// |------|---------|
// | The class `MIC` and the adapter `USB_AUDIO` are literals of this file: no input names them | - |
// | A new microphone takes the next free `MIC-NN`, minted here: the caller names no id | - |
// | The model is the product name of a card listing: printable ASCII, 1 to 64 characters (AD-07 (1)) | anything else |
// | Re-enabling names a microphone the registry holds, of adapter `USB_AUDIO` | another id, another class, another adapter (a built-in or a local microphone) |

/** The name the microphone action carries in a refusal. */
export const REGISTER_CAPTURE_MICROPHONE_ACTION = 'registerCaptureMicrophone';

/** The adapter kind of every microphone this file registers. A literal: no input can name another. */
export const REGISTERED_MICROPHONE_ADAPTER = 'USB_AUDIO';

/** A registered microphone: `MIC-` and two or more digits. */
export const REGISTERED_MICROPHONE_ID_PATTERN = /^MIC-\d{2,}$/;

/**
 * The character rule of a microphone's model: the closed rule of a product name of the card
 * listing (`CAPTURE_AUDIO_CARD_TEXT_PATTERN` of the API contract, AD-07 (1)), stated here because
 * this file imports nothing of the contract; `sim-capture-discovery.test.ts` holds the two equal.
 */
export const REGISTERED_MICROPHONE_MODEL_PATTERN = /^[ -~]{1,64}$/;

const invalidMicrophone = (detail: string): SimTransitionError => new SimTransitionError(null, REGISTER_CAPTURE_MICROPHONE_ACTION, detail, SimErrorCode.INVALID_INPUT);

/** The next free microphone id: the highest number of the registry plus 1, two digits at least. Never a reused one. */
export function nextCaptureMicrophoneId(devices: readonly { readonly id: string }[]): string {
  const highest = devices.reduce((max, device) => {
    const number = /^MIC-(\d+)$/.exec(device.id)?.[1];
    return number === undefined ? max : Math.max(max, Number(number));
  }, 0);
  return `MIC-${String(highest + 1).padStart(2, '0')}`;
}

/**
 * `registerCaptureMicrophone`. With `deviceId: null` the state with ONE device appended to slice
 * 30, under the next free `MIC-NN`; with an id, the state in which that `USB_AUDIO` microphone is
 * online again and carries the model of the new listing - no device is appended, and a microphone
 * that already is so gives the SAME state object. Nothing else changes. Throws as the table says.
 */
export function registerCaptureMicrophoneTransition(state: SimState, input: RegisterCaptureMicrophoneInput): { state: SimState; result: CaptureDeviceStatus } {
  if (typeof input.model !== 'string' || !REGISTERED_MICROPHONE_MODEL_PATTERN.test(input.model)) throw invalidMicrophone('the model of a microphone is a product name of 1 to 64 printable characters');
  const devices = state.captureDevices.devices;
  if (input.deviceId === null) {
    const device: CaptureDeviceStatus = {
      id: nextCaptureMicrophoneId(devices),
      kind: 'MIC',
      model: input.model,
      firmware: null,
      host: null,
      poePort: null,
      online: true,
      // A microphone carries no stream state.
      streamState: null,
      // The one capability of a microphone, as the built-in pair states it (decision C43 (3);
      // integration pass I-7). The registry stores no capability: the Core's row mapping reads this
      // same value back for a `USB_AUDIO` microphone, as it does `VIDEO` for an adopted camera.
      capabilities: ['AUDIO'],
      adapter: REGISTERED_MICROPHONE_ADAPTER,
      sourceClass: 'PRODUCTION',
    };
    return { state: { ...state, captureDevices: { ...state.captureDevices, devices: [...devices, device] } }, result: device };
  }
  if (typeof input.deviceId !== 'string' || !REGISTERED_MICROPHONE_ID_PATTERN.test(input.deviceId)) throw invalidMicrophone('a registered microphone has an id of the form MIC-NN');
  const found = devices.find((device) => device.id === input.deviceId);
  if (found === undefined || found.kind !== 'MIC' || found.adapter !== REGISTERED_MICROPHONE_ADAPTER) throw invalidMicrophone('the registry holds no USB audio microphone with this id');
  if (found.online && found.model === input.model) return { state, result: found };
  const enabled: CaptureDeviceStatus = { ...found, online: true, model: input.model };
  return { state: { ...state, captureDevices: { ...state.captureDevices, devices: devices.map((device) => (device === found ? enabled : device)) } }, result: enabled };
}

// ── The address of a registered camera changes (task 4 row 195, WP-12; finding of row 97; decisions
// U12 A7, C47 (29)) ─────────────────────────────────────────────────────────────────────────────
//
// The INTERNAL action `readdressCaptureDevice` of `SimActions` is built from the function below. It
// is the one way the address of a registered camera changes in the replicated `captureDevices`
// slice:
//
//   - on the Core server, inside the unit of work of operation 100 (`confirmCaptureDeviceAddress`),
//     through the engine's door (blueprint row 196), after that operation's access rule, idle lock,
//     candidate checks and the destination rule. No client can call it: it has no operation of its
//     own (`sim-actions.ts`);
//   - the in-app simulator does not run it: its operation 100 refuses every call (`sim/api.ts`).
//
// As its two siblings, it checks no permission and no session state, writes NO audit row and no
// event (the caller writes `CAPTURE_DEVICE_ADDRESS_CHANGED` in the same unit) and leaves
// `captureConfig` alone: a track that names the device keeps naming it. NEVER AUTOMATIC is the
// caller's rule, not this file's: the action runs only where an operator's confirmation stands.
//
// The address is taken AS THE CALLER GIVES IT: whether the Core may dial it is the destination rule
// of the operation, which this file cannot ask. What it holds itself:
//
// | Rule | Refusal (`SimTransitionError`, code INVALID_INPUT) |
// |------|---------|
// | The device is in the registry and is a camera | an unknown id; a microphone; any other class |
// | The address has the form of a registered `host`: 1 to 120 characters, never a URL, never `user:password@` (C-N8) | a `/`, an `@` or a blank in it; an empty or longer text; no text |
// | Nothing else of the device changes, and no other device changes | - |
// | An address the device already holds gives the SAME state object | - |

/** The name the re-address action carries in a refusal. */
export const READDRESS_CAPTURE_DEVICE_ACTION = 'readdressCaptureDevice';

const invalidReaddress = (detail: string): SimTransitionError => new SimTransitionError(null, READDRESS_CAPTURE_DEVICE_ACTION, detail, SimErrorCode.INVALID_INPUT);

/**
 * `readdressCaptureDevice`: the state in which the camera `deviceId` holds `address` as its `host`.
 * Every other member of that device, every other device and every other slice is the same object as
 * before; a camera that already holds the address gives the SAME state object. Throws as the table says.
 */
export function readdressCaptureDeviceTransition(state: SimState, input: ReaddressCaptureDeviceInput): { state: SimState; result: CaptureDeviceStatus } {
  if (typeof input.deviceId !== 'string') throw invalidReaddress('the registry holds no camera with this id');
  const devices = state.captureDevices.devices;
  const found = devices.find((device) => device.id === input.deviceId);
  if (found === undefined || found.kind !== 'CAMERA') throw invalidReaddress('the registry holds no camera with this id');
  if (typeof input.address !== 'string' || input.address.length < 1 || input.address.length > TEXT_MAX || /[/@\s]/.test(input.address)) {
    throw invalidReaddress('the host of a device is a host or an address');
  }
  if (found.host === input.address) return { state, result: found };
  const moved: CaptureDeviceStatus = { ...found, host: input.address };
  return { state: { ...state, captureDevices: { ...state.captureDevices, devices: devices.map((device) => (device === found ? moved : device)) } }, result: moved };
}
