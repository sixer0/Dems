/**
 * Registration of this Mac's camera and microphone as device rows of their own (blueprint row
 * 136; capture spec §A.1.1 "Development slots", §A.7.1; `dbc-4` §N.2; decisions D74(2), D83
 * D-DB-13 and O-8, D106(4)).
 *
 * ONLY in `REAL_DEVELOPMENT` (the caller, `boot.ts`, asks the one capture-operation function).
 * Each local device is a NEW row with the adapter kind `LOCAL_DEVICE` and the next free id of its
 * class; for the microphone that id is also its input id (D106(4): a microphone line needs
 * `deviceId` == `inputId`). The seeded built-ins are never touched: they stay `FAKE`, and no
 * statement here updates anything.
 *
 * IDEMPOTENT: a second boot finds the two rows and writes nothing.
 *
 * NO DEVICE IS OPENED. `listed` is what the device LIST says (it opens no device and asks for no
 * permission); it is written once, at INSERT, as the row's `enabled`.
 */
import { CaptureAdapterKind, type CaptureAdapterKind as AdapterKind } from '../adapters/kinds';
import { READ_STORED_DEVICES, REGISTER_LOCAL_DEVICE } from './statements';

export type LocalDeviceClass = 'CAMERA' | 'MIC';

/** One row of the registry as the fence reads it. */
export interface StoredCaptureDevice {
  readonly id: string;
  readonly kind: 'CAMERA' | 'MIC' | 'POE';
  readonly adapterKind: AdapterKind;
  readonly model: string | null;
}

/** The statement runner of the unit the registration runs in (`UnitContext.query`). */
export interface FenceExecutor {
  query<Row extends Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: Row[] }>;
}

/** What a local device row is written with. The label is the device's name in the device list: a fixed text of the code, never an input. */
export const LOCAL_DEVICE_ROWS = Object.freeze({
  CAMERA: Object.freeze({ prefix: 'CAM-', transport: 'AVFOUNDATION' }),
  MIC: Object.freeze({ prefix: 'MIC-', transport: 'AVFOUNDATION' }),
} as const satisfies Record<LocalDeviceClass, { prefix: string; transport: string }>);

export interface LocalDeviceRegistrationInput {
  readonly labels: Readonly<Record<LocalDeviceClass, string>>;
  /** Whether each device is in the device list now. Asked only for a class that is not registered yet. */
  readonly listed: (deviceClass: LocalDeviceClass) => Promise<boolean>;
}

export interface LocalDeviceRegistration {
  readonly cameraId: string;
  readonly micId: string;
  /** The ids this call inserted: empty at every boot after the first. */
  readonly inserted: readonly string[];
  /** The registry after the registration, in id order. */
  readonly devices: readonly StoredCaptureDevice[];
}

const KINDS: readonly string[] = Object.values(CaptureAdapterKind);

/** Reads the registry. A row whose class or kind is outside the closed sets is refused: the fence never guesses a class. */
export async function readStoredDevices(executor: FenceExecutor): Promise<StoredCaptureDevice[]> {
  const { rows } = await executor.query<Record<string, unknown>>(READ_STORED_DEVICES);
  return rows.map((row) => {
    const { id, kind, adapterKind, model } = row;
    if (typeof id !== 'string' || (kind !== 'CAMERA' && kind !== 'MIC' && kind !== 'POE') || typeof adapterKind !== 'string' || !KINDS.includes(adapterKind)) {
      throw new Error('a capture device row carries a class or an adapter kind outside the closed sets');
    }
    return { id, kind, adapterKind: adapterKind as AdapterKind, model: typeof model === 'string' ? model : null };
  });
}

const localOf = (devices: readonly StoredCaptureDevice[], deviceClass: LocalDeviceClass): StoredCaptureDevice | undefined =>
  devices.find((device) => device.kind === deviceClass && device.adapterKind === CaptureAdapterKind.LOCAL_DEVICE);

/** Registers what is missing and answers the two ids. Runs inside the caller's unit: all or nothing. */
export async function registerLocalDevices(executor: FenceExecutor, input: LocalDeviceRegistrationInput): Promise<LocalDeviceRegistration> {
  const before = await readStoredDevices(executor);
  const inserted: string[] = [];
  for (const deviceClass of ['CAMERA', 'MIC'] as const) {
    if (localOf(before, deviceClass) !== undefined) continue;
    const { prefix, transport } = LOCAL_DEVICE_ROWS[deviceClass];
    const { rows } = await executor.query<{ id: string }>(REGISTER_LOCAL_DEVICE, [deviceClass, prefix, transport, input.labels[deviceClass], await input.listed(deviceClass)]);
    const id = rows[0]?.id;
    if (typeof id === 'string') inserted.push(id);
  }
  const devices = inserted.length === 0 ? before : await readStoredDevices(executor);
  const camera = localOf(devices, 'CAMERA');
  const mic = localOf(devices, 'MIC');
  if (camera === undefined || mic === undefined) throw new Error('the local devices are not in the registry after their registration');
  return { cameraId: camera.id, micId: mic.id, inserted: Object.freeze(inserted), devices };
}
