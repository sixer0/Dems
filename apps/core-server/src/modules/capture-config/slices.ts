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
 *   - the mics travel PRIMARY first, then STANDBY (the slice schema's stated order);
 *   - `capabilities` are "codes the adapters reported" (telemetry, SH-18): the registry table has
 *     no capabilities column (`profiles` holds MEDIA profiles for OD-05, dbc-3 §B.2), so a row
 *     maps to an empty list until supervisor telemetry lands (row 57 `applyCaptureTelemetry`).
 *     The built-in baseline keeps the simulator's own codes (decision D-52-3);
 *   - every answer parses with the slice's own zod schema before it leaves the builder: a table
 *     row that cannot form a valid slice is a refusal (fail closed), never a half-built slice.
 */
import { CaptureConfigSliceSchema, CaptureDevicesSliceSchema, type CaptureConfigSliceBody, type CaptureDevicesSliceBody } from '@dems/shared/api';
import { DEFAULT_CAPTURE_CONFIG, DEFAULT_CAPTURE_DEVICES } from '@dems/shared/sim';
import type { MicInputId } from '@dems/shared/domain';

/** The selector row as the store reads it (T-31, all runtime-relevant columns). */
export interface CaptureConfigRecord {
  readonly video01DeviceId: string;
  readonly video01Profile: string;
  readonly video02DeviceId: string;
  readonly video02Profile: string;
  readonly micPrimaryId: string;
  readonly micStandbyId: string;
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

/** The built-in selector with its live `locked` flag (the baseline constant pins `locked: false`). */
export function baselineCaptureConfig(locked: boolean): CaptureConfigSliceBody {
  return { ...DEFAULT_CAPTURE_CONFIG, locked };
}

/** The built-in device registry (the five rows of `dbc-3 §E.3`, hosts loopback-only). */
export function baselineCaptureDevices(): CaptureDevicesSliceBody {
  return DEFAULT_CAPTURE_DEVICES;
}

/** A mic device outside the two-input set cannot name a slice input (fail closed, identifiers only). */
function micInputOf(deviceId: string): MicInputId {
  if (deviceId === 'MIC-01' || deviceId === 'MIC-02') return deviceId;
  throw new CaptureSliceError(
    'CAPTURE_MIC_INPUT_UNKNOWN',
    'the selector names a mic device outside the MIC-01/MIC-02 input set',
    { deviceId },
  );
}

/**
 * Slice 29 from the selector row and the registry rows it names. `config === null` (a database
 * whose seed has not written the built-in row yet) answers the built-in baseline instead; the
 * boot step logs that case explicitly (store.ts). A named device missing from the registry is a
 * refusal: the FK makes it impossible in a migrated database, and a slice must never invent one.
 */
export function captureConfigSliceOf(config: CaptureConfigRecord | null, devices: readonly CaptureDeviceRecord[], locked: boolean): CaptureConfigSliceBody {
  if (config === null) return baselineCaptureConfig(locked);
  const byId = new Map(devices.map((device) => [device.id, device]));
  const camera = (trackId: 'VIDEO-01' | 'VIDEO-02', deviceId: string, profile: string) => {
    const device = byId.get(deviceId);
    if (device === undefined || device.kind !== 'CAMERA') {
      throw new CaptureSliceError('CAPTURE_DEVICE_UNKNOWN', 'the selector names a camera the registry does not hold', { trackId, deviceId });
    }
    return { trackId, deviceId, profile, online: device.enabled, streamState: device.enabled ? ('LIVE' as const) : ('LOST' as const) };
  };
  const mic = (inputId: MicInputId, deviceId: string, role: 'PRIMARY' | 'STANDBY') => {
    const device = byId.get(deviceId);
    if (device === undefined || device.kind !== 'MIC') {
      throw new CaptureSliceError('CAPTURE_DEVICE_UNKNOWN', 'the selector names a mic the registry does not hold', { inputId, deviceId });
    }
    return { inputId, deviceId, role, transport: device.transport, online: device.enabled };
  };
  const slice: CaptureConfigSliceBody = {
    cameras: [camera('VIDEO-01', config.video01DeviceId, config.video01Profile), camera('VIDEO-02', config.video02DeviceId, config.video02Profile)],
    mics: [mic(micInputOf(config.micPrimaryId), config.micPrimaryId, 'PRIMARY'), mic(micInputOf(config.micStandbyId), config.micStandbyId, 'STANDBY')],
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
        streamState: device.kind === 'CAMERA' ? (device.enabled ? ('LIVE' as const) : ('LOST' as const)) : null,
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
