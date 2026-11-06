/**
 * RETIRED BY THE LIFT (task 4 row 88, decision AM-1) - formerly the CLASS C stub of the production
 * camera adapter, adapter kind `ONVIF_RTSP` (blueprint row 65; register NM-09; capture spec §A.6).
 *
 * The loader (`adapters/real.ts`) builds the BUILT adapter `camera/onvif-relay.ts` in its place
 * since row 88 (pin table, specification 6.3: "Stub literal, camera: replaced by the built
 * adapter"). NO FILE IMPORTS THIS ONE any more, in the product or in a test (static rule A-1 of
 * `adapters/__tests__/static.test.ts` holds it to that). It is left in the tree, unchanged in its
 * behaviour, only because a row deletes no file nobody asked it to delete: its removal is the
 * controller's (record `implementation/088_class_c_lift.md`). It states no opener and builds
 * nothing: every member that would touch a device refuses with `CAPTURE_ADAPTER_CLASS_C`.
 */
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import { CaptureAdapterKind } from '../kinds';
import type { CameraAdapter, CaptureDeviceEntry } from '../types';

const classC = (deviceId: string | null = null): never => {
  throw new CaptureAdapterError(CaptureAdapterRefusal.CLASS_C_NOT_BUILT, deviceId);
};

export function createOnvifRtspCameraAdapter(devices: readonly CaptureDeviceEntry[]): CameraAdapter {
  return {
    seam: 'CAMERA',
    kind: CaptureAdapterKind.ONVIF_RTSP,
    devices: Object.freeze([...devices]),
    hasOpener: false,
    discover: async () => classC(),
    testConnection: async () => classC(),
    openSource: async (deviceId) => {
      throw new CaptureAdapterError(CaptureAdapterRefusal.SOURCE_KIND_NOT_RECORDABLE, deviceId);
    },
    profiles: async (deviceId) => classC(deviceId),
    pullUrl: (deviceId) => classC(deviceId),
    ntpOffsetMs: async (deviceId) => classC(deviceId),
  };
}
