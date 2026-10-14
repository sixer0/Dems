/**
 * The slice builders of the capture-config module (blueprint row 52 / M2-W10; register NM-09,
 * SH-16, E-04; C3 §6; dbc-3 §B.1/§B.2/§E.3).
 *
 * Two pure builders turn the rows of the two KEPT tables into the two replicated slices:
 *
 *   `captureConfigSliceOf`  T-31 `capture_config` (the one-row selector) + the T-32 registry rows
 *                           it names  ->  slice 29 `captureConfig` (wire form, API-6);
 *   `captureDevicesSliceOf` T-32 `capture_devices`                            ->  slice 30 `captureDevices`.
 *
 * Rules the builders carry:
 *   - `locked` is NEVER read from a table: it is true while a session is open (OD-10), so the
 *     caller passes it in; the tables hold no lock column;
 *   - the slice field list is `C3 §2.3`: no credential member exists anywhere (RK-12), `host` is
 *     the registry's `address` only, never a `user:password@` URL (C-N8);
 *   - the mics travel in INPUT order, `MIC-01` then `MIC-02`, whichever holds the PRIMARY role: a
 *     list of the two mic inputs is always that ordered pair (acceptance criterion AC-B-70; the
 *     simulator's operation 76 answers the same). Until blueprint row 66 this builder put the
 *     PRIMARY row first, which is the same list only while MIC-01 is PRIMARY;
 *   - `capabilities` are "codes the adapters reported" (telemetry, SH-18): the registry table has
 *     no capabilities column (`profiles` holds MEDIA profiles for OD-05, dbc-3 §B.2), so a row
 *     maps to an empty list until supervisor telemetry lands (row 57 `applyCaptureTelemetry`).
 *     The built-in baseline keeps the simulator's own codes (decision D-52-3);
 *   - every answer parses with the slice's own zod schema before it leaves the builder: a table
 *     row that cannot form a valid slice is a refusal (fail closed), never a half-built slice.
 */
import { CaptureConfigSliceSchema, CaptureDevicesSliceSchema, MIC_INPUT_ID_PATTERN, type CaptureConfigSliceBody, type CaptureDevicesSliceBody } from '@dems/shared/api';
import { DEFAULT_CAPTURE_CONFIG, DEFAULT_CAPTURE_DEVICES } from '@dems/shared/sim';

/**
 * The selector row as the store reads it (T-31, all runtime-relevant columns). The six slot
 * members are `null` for an UNASSIGNED slot (task 4 row 29, site A2; names register E15): the
 * columns are nullable since schema set A.
 */
export interface CaptureConfigRecord {
  readonly video01DeviceId: string | null;
  readonly video01Profile: string | null;
  readonly video02DeviceId: string | null;
  readonly video02Profile: string | null;
  readonly micPrimaryId: string | null;
  readonly micStandbyId: string | null;
  readonly revision: number;
  readonly updatedAt: number;
}

/** One registry row as the store reads it (T-32, the columns the slice and the boot need). */
export interface CaptureDeviceRecord {
  readonly id: string;
  readonly kind: 'CAMERA' | 'MIC' | 'POE';
  readonly transport: string;
  readonly model: string | null;
  readonly firmware: string | null;
  readonly address: string | null;
  readonly poePort: string | null;
  readonly enabled: boolean;
}

/** What a slice that refuses to build says: the code names it, the detail lists identifiers only. */
export class CaptureSliceError extends Error {
  readonly code: string;
  readonly context: Readonly<Record<string, string | number>>;

  constructor(code: string, message: string, context: Readonly<Record<string, string | number>>) {
    super(message);
    this.name = 'CaptureSliceError';
    this.code = code;
    this.context = context;
  }
}

/**
 * The ids of the five built-in devices of the demonstration model (`dbc-3 §E.3`). Task 4 row V7d
 * (decisions C126 (b), C141): only their cameras state `LIVE` / `LOST` from the registry flag - the
 * model's value; a REGISTERED camera states null (NOT READ) at rest, since no builder here reads a
 * stream. The same derivation as the row layer's (`db/mapping/rows.ts` `BUILT_IN_CAPABILITIES`).
 */
const BUILT_IN_DEVICE_IDS: ReadonlySet<string> = new Set(DEFAULT_CAPTURE_DEVICES.devices.map((device) => device.id));

/** A camera's stream state at rest, as these builders state it: the model's for a built-in camera, NOT READ (null) for any other. */
function streamStateAtRest(device: CaptureDeviceRecord): 'LIVE' | 'LOST' | null {
  if (!BUILT_IN_DEVICE_IDS.has(device.id)) return null;
  return device.enabled ? 'LIVE' : 'LOST';
}

/** The built-in selector with its live `locked` flag (the baseline constant pins `locked: false`). */
export function baselineCaptureConfig(locked: boolean): CaptureConfigSliceBody {
  return { ...DEFAULT_CAPTURE_CONFIG, locked };
}

/** The built-in device registry (the five rows of `dbc-3 §E.3`, hosts loopback-only). */
export function baselineCaptureDevices(): CaptureDevicesSliceBody {
  return DEFAULT_CAPTURE_DEVICES;
}

/**
 * The input a mic device is: its own ID, of the form `MIC-NN` (decisions D106 (4), D115 (2):
 * the built-in pair, or a microphone registered later such as the local `MIC-03`). Any other ID
 * cannot name a slice input (fail closed, identifiers only).
 */
function micInputOf(deviceId: string): string {
  if (MIC_INPUT_ID_PATTERN.test(deviceId)) return deviceId;
  throw new CaptureSliceError(
    'CAPTURE_MIC_INPUT_UNKNOWN',
    'the selector names a mic device outside the MIC-NN input form',
    { deviceId },
  );
}

/**
 * Slice 29 from the selector row and the registry rows it names. `config === null` (a database
 * whose seed has not written the built-in row yet) answers the built-in baseline instead; the
 * boot step logs that case explicitly (store.ts). A named device missing from the registry is a
 * refusal: the FK makes it impossible in a migrated database, and a slice must never invent one.
 *
 * AN UNASSIGNED SLOT (task 4 row 29, site A2; decisions C14, C18 (2); AD-04). A slot whose member
 * is `null` is an ABSENT line of the slice, never a line with an empty device and never the line
 * of another slot: a camera line is made for ITS track from the columns of that track, a mic line
 * for ITS role from the column of that role. Nothing is placed by position, so a row that holds
 * only `VIDEO-02` and only a STANDBY microphone answers exactly those two lines, and a row of six
 * NULLs answers two empty lists. This is not the built-in baseline: that one stands for a table
 * WITHOUT a row (`config === null`). A video slot is a pair: a device without a profile, or a
 * profile without a device, is refused by the member that is missing (the CHECK
 * `capture_config_slot_pair_check` cannot hold it; the row mapping refuses it the same way).
 */
export function captureConfigSliceOf(config: CaptureConfigRecord | null, devices: readonly CaptureDeviceRecord[], locked: boolean): CaptureConfigSliceBody {
  if (config === null) return baselineCaptureConfig(locked);
  const byId = new Map(devices.map((device) => [device.id, device]));
  type CameraLine = CaptureConfigSliceBody['cameras'][number];
  type MicLine = CaptureConfigSliceBody['mics'][number];
  const camera = (trackId: 'VIDEO-01' | 'VIDEO-02', deviceId: string | null, profile: string | null, members: readonly [string, string]): CameraLine[] => {
    if (deviceId === null && profile === null) return [];
    if (deviceId === null || profile === null) {
      throw new CaptureSliceError('CAPTURE_ROW_INVALID', 'a video slot of the selector row holds half a pair', { trackId, member: deviceId === null ? members[0] : members[1] });
    }
    const device = byId.get(deviceId);
    if (device === undefined || device.kind !== 'CAMERA') {
      throw new CaptureSliceError('CAPTURE_DEVICE_UNKNOWN', 'the selector names a camera the registry does not hold', { trackId, deviceId });
    }
    return [{ trackId, deviceId, profile, online: device.enabled, streamState: streamStateAtRest(device) }];
  };
  const mic = (deviceId: string | null, role: 'PRIMARY' | 'STANDBY'): MicLine[] => {
    if (deviceId === null) return [];
    const inputId = micInputOf(deviceId);
    const device = byId.get(deviceId);
    if (device === undefined || device.kind !== 'MIC') {
      throw new CaptureSliceError('CAPTURE_DEVICE_UNKNOWN', 'the selector names a mic the registry does not hold', { inputId, deviceId });
    }
    return [{ inputId, deviceId, role, transport: device.transport, online: device.enabled }];
  };
  const slice: CaptureConfigSliceBody = {
    cameras: [
      ...camera('VIDEO-01', config.video01DeviceId, config.video01Profile, ['video01DeviceId', 'video01Profile']),
      ...camera('VIDEO-02', config.video02DeviceId, config.video02Profile, ['video02DeviceId', 'video02Profile']),
    ],
    mics: [...mic(config.micPrimaryId, 'PRIMARY'), ...mic(config.micStandbyId, 'STANDBY')].sort((left, right) =>
      left.inputId < right.inputId ? -1 : left.inputId > right.inputId ? 1 : 0,
    ),
    locked,
    updatedAt: config.updatedAt,
  };
  return parseSlice(CaptureConfigSliceSchema, slice, 'captureConfig');
}

/** Slice 30 from the registry rows, in id order. An empty registry answers the built-in five. */
export function captureDevicesSliceOf(devices: readonly CaptureDeviceRecord[]): CaptureDevicesSliceBody {
  if (devices.length === 0) return baselineCaptureDevices();
  const slice: CaptureDevicesSliceBody = {
    devices: [...devices]
      .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
      .map((device) => ({
        id: device.id,
        kind: device.kind,
        model: device.model,
        firmware: device.firmware,
        host: device.address,
        poePort: device.poePort,
        online: device.enabled,
        streamState: device.kind === 'CAMERA' ? streamStateAtRest(device) : null,
        capabilities: [],
      })),
  };
  return parseSlice(CaptureDevicesSliceSchema, slice, 'captureDevices');
}

/** A built slice that its own contract schema refuses is a defect, not data: fail closed. */
function parseSlice<S extends { parse(data: unknown): unknown }>(schema: S, slice: unknown, name: string): ReturnType<S['parse']> {
  try {
    return schema.parse(slice) as ReturnType<S['parse']>;
  } catch {
    throw new CaptureSliceError('CAPTURE_SLICE_INVALID', `the capture slice ${name} does not parse with its contract schema`, { name });
  }
}
