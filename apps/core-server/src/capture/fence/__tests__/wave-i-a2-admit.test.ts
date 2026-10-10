// FIX WAVE I, DRIVER A2 - finding G70b-01 (re-gate 70): the registry of a development Core takes a
// device that was registered AFTER the boot (`admit`), with the adapter a boot would give its
// stored row. No database, no process: a helper door that fails the test when it is called -
// admitting a device opens nothing and lists nothing.
import { describe, expect, it } from 'vitest';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../../adapters';
import type { HelperDoor } from '../../adapters/local';
import { trustedInspector } from '../../adapters/local/__tests__/mic-support';
import type { CaptureTimers } from '../../types';
import { CaptureDeviceAdmission, buildDevelopmentRegistry, buildProductionRegistry } from '../index';
import { HELPER, LOCAL, SEEDED } from './support';

const soon: CaptureTimers = {
  after(_delayMs, callback) {
    const handle = setImmediate(callback);
    return () => clearImmediate(handle);
  },
};
const neverCalled: HelperDoor = (() => {
  throw new Error('admitting a device must start no helper process');
}) as unknown as HelperDoor;

const development = () =>
  buildDevelopmentRegistry({ devices: [...SEEDED, ...LOCAL], local: { cameraId: 'CAM-03', micId: 'MIC-03' }, program: HELPER, runDir: '/data/dems/run/capture', now: () => 1_760_000_000_000, timers: soon, door: neverCalled, inspect: trustedInspector() });
const ADOPTED = { id: 'CAM-04', kind: 'CAMERA', adapterKind: 'FAKE', model: 'FAKE-CAM-1' } as const;

describe('G70b-01: a camera registered after the boot is admitted to the development registry', () => {
  it('RED BEFORE THE FIX: unknown to the registry until it is admitted; then described, listed, assignable, recordable and probed like a stored test camera', () => {
    const built = development();
    // The state of the finding: the registry was filled at boot only.
    expect(() => built.registry.assertAssignable('CAMERA', 'CAM-04')).toThrow(CaptureAdapterError);
    expect(built.probeAdapters()?.cameras.flatMap((camera) => camera.devices.map((device) => device.id))).not.toContain('CAM-04');

    expect(built.admit(ADOPTED)).toBe(CaptureDeviceAdmission.ADMITTED);
    expect(built.registry.assertAssignable('CAMERA', 'CAM-04')).toMatchObject({ id: 'CAM-04', deviceClass: 'CAMERA', label: 'FAKE-CAM-1', adapterKind: 'FAKE', sourceClass: 'DEVELOPMENT', hasOpener: true });
    expect(built.registry.assertRecordable('CAM-04').hasOpener).toBe(true);
    expect(built.registry.list().map((entry) => entry.id)).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02', 'MIC-03', 'POE-SWITCH']);
    expect(built.registry.resolve('CAMERA', 'CAM-04').devices.map((device) => device.id)).toEqual(['CAM-04']);
    // The pre-check's reachability probe asks it as well.
    expect(built.probeAdapters()?.cameras.flatMap((camera) => camera.devices.map((device) => device.id))).toContain('CAM-04');
    // The devices of the boot are untouched.
    expect(built.registry.describe('CAM-02')).toMatchObject({ adapterKind: 'FAKE', hasOpener: true });
    expect(built.openSources()).toEqual([]);
  });

  it('a repeat is no error and registers nothing twice; a device of the boot is ALREADY_SERVED', () => {
    const built = development();
    expect(built.admit(ADOPTED)).toBe(CaptureDeviceAdmission.ADMITTED);
    expect(built.admit(ADOPTED)).toBe(CaptureDeviceAdmission.ALREADY_SERVED);
    expect(built.admit({ id: 'CAM-01', kind: 'CAMERA', adapterKind: 'FAKE', model: null })).toBe(CaptureDeviceAdmission.ALREADY_SERVED);
    expect(built.registry.list().filter((entry) => entry.id === 'CAM-04')).toHaveLength(1);
    expect(built.probeAdapters()?.cameras.filter((camera) => camera.devices.some((device) => device.id === 'CAM-04'))).toHaveLength(1);
  });

  it('NEGATIVE CONTROL: a production camera and a second local device get NO adapter - they stay refused, each by name', () => {
    const built = development();
    expect(built.admit({ id: 'CAM-11', kind: 'CAMERA', adapterKind: 'ONVIF_RTSP', model: 'Vendor X' })).toBe(CaptureDeviceAdmission.NOT_SERVED);
    expect(built.admit({ id: 'CAM-12', kind: 'CAMERA', adapterKind: 'LOCAL_DEVICE', model: 'Another camera' })).toBe(CaptureDeviceAdmission.NOT_SERVED);
    for (const id of ['CAM-11', 'CAM-12']) {
      let refusal: unknown = null;
      try {
        built.registry.assertAssignable('CAMERA', id);
      } catch (error) {
        refusal = error;
      }
      expect(refusal).toBeInstanceOf(CaptureAdapterError);
      expect((refusal as CaptureAdapterError).code).toBe(CaptureAdapterRefusal.DEVICE_UNKNOWN);
    }
    expect(built.registry.list().map((entry) => entry.id)).not.toContain('CAM-11');
  });

  it('REAL_PRODUCTION in this phase serves nothing: an adopted camera is NOT_SERVED and no development source appears', () => {
    const built = buildProductionRegistry();
    expect(built.admit(ADOPTED)).toBe(CaptureDeviceAdmission.NOT_SERVED);
    expect(built.admit({ id: 'CAM-11', kind: 'CAMERA', adapterKind: 'ONVIF_RTSP', model: null })).toBe(CaptureDeviceAdmission.NOT_SERVED);
    expect(built.registry.list()).toEqual([]);
  });
});
