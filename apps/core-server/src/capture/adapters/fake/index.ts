/**
 * The fake registry (blueprint row 65; check M4-FAKE-1; capture spec §A.1 "Test hook"
 * `createFakeRegistry()`): the built-in devices of the seed, each behind an in-memory `FAKE`
 * adapter. Device IDs, labels, capabilities and the PoE port are READ from the seed's device list
 * (`DEFAULT_CAPTURE_DEVICES`), not restated.
 *
 * Two topologies (OD-05): `TWO_CAMERAS` — `CAM-01` and `CAM-02`, one profile each (two fakes
 * emulate two cameras); `DUAL_LENS` — one camera with two profiles, which the selector assigns to
 * two of the four tracks (D60, 2026-11-04: was both of the two).
 */
import { DEFAULT_CAPTURE_DEVICES } from '@dems/shared/sim';
import { CaptureOperation } from '../kinds';
import { createCaptureDeviceRegistry } from '../registry';
import type { CaptureCapability, CaptureDeviceRegistry } from '../types';
import { FAKE_MIC_PRIMARY_DBFS, FAKE_MIC_STANDBY_DBFS, createFakeAudioInputAdapter, type FakeAudioInputAdapter } from './audio';
import { FAKE_CAMERA_PROFILE, createFakeCameraAdapter, type FakeCameraAdapter, type FakeCameraOptions } from './camera';
import { createFakePoeController, type FakePoeController } from './poe';

export { FAKE_MIC_PRIMARY_DBFS, FAKE_MIC_STANDBY_DBFS, createFakeAudioInputAdapter, type FakeAudioInputAdapter, type FakeAudioOptions } from './audio';
export { FAKE_CAMERA_PROFILE, createFakeCameraAdapter, type FakeCameraAdapter, type FakeCameraOptions } from './camera';
export { createFakePoeController, type FakePoeController, type FakePoeOptions } from './poe';

export const FakeTopology = { TWO_CAMERAS: 'TWO_CAMERAS', DUAL_LENS: 'DUAL_LENS' } as const;
export type FakeTopology = (typeof FakeTopology)[keyof typeof FakeTopology];

/** The second profile of the dual-lens fake. */
export const FAKE_CAMERA_SECOND_PROFILE = 'H264_720P25';

export interface FakeRegistryOptions {
  /** Default `REAL_DEVELOPMENT`: the one operation that registers `FAKE` adapters (rule RG-1). */
  readonly operation?: CaptureOperation;
  readonly topology?: FakeTopology;
  /** The absolute directory the fake microphones' pipe names are built under. */
  readonly runDir: string;
  readonly locked?: () => boolean;
  /** Per-camera additions of a test's set-up (candidates, the fixture's `authenticate`). */
  readonly camera?: Partial<Omit<FakeCameraOptions, 'id'>>;
}

export interface FakeRegistry {
  readonly registry: CaptureDeviceRegistry;
  readonly cameras: readonly FakeCameraAdapter[];
  readonly mics: readonly FakeAudioInputAdapter[];
  readonly poe: FakePoeController;
}

const CAPABILITIES: readonly CaptureCapability[] = ['VIDEO', 'AUDIO', 'PULL', 'SNMP'];
const capabilitiesOf = (codes: readonly string[]): CaptureCapability[] => CAPABILITIES.filter((code) => codes.includes(code));

export function createFakeRegistry(options: FakeRegistryOptions): FakeRegistry {
  const topology = options.topology ?? FakeTopology.TWO_CAMERAS;
  const seeded = DEFAULT_CAPTURE_DEVICES.devices;
  const seededCameras = seeded.filter((device) => device.kind === 'CAMERA');
  const cameraDevices = topology === FakeTopology.DUAL_LENS ? seededCameras.slice(0, 1) : seededCameras;
  const cameras = cameraDevices.map((device) =>
    createFakeCameraAdapter({
      ...options.camera,
      id: device.id,
      label: device.model ?? device.id,
      capabilities: capabilitiesOf(device.capabilities),
      profiles: topology === FakeTopology.DUAL_LENS ? [FAKE_CAMERA_PROFILE, FAKE_CAMERA_SECOND_PROFILE] : [FAKE_CAMERA_PROFILE],
    }),
  );
  const mics = seeded
    .filter((device) => device.kind === 'MIC')
    .map((device, index) => createFakeAudioInputAdapter({ id: device.id, label: device.model ?? device.id, runDir: options.runDir, dbfs: index === 0 ? FAKE_MIC_PRIMARY_DBFS : FAKE_MIC_STANDBY_DBFS }));
  const switches = seeded.filter((device) => device.kind === 'POE');
  const ports = [...new Set(seededCameras.flatMap((device) => (device.poePort === null ? [] : [device.poePort])))];
  const [poe] = switches.map((device) => createFakePoeController({ id: device.id, label: device.model ?? device.id, ports, capabilities: capabilitiesOf(device.capabilities) }));
  if (poe === undefined) throw new Error('the seed holds no PoE switch');

  const registry = createCaptureDeviceRegistry({ operation: options.operation ?? CaptureOperation.REAL_DEVELOPMENT, ...(options.locked === undefined ? {} : { locked: options.locked }) });
  for (const adapter of [...cameras, ...mics, poe]) registry.register(adapter);
  return { registry, cameras, mics, poe };
}
