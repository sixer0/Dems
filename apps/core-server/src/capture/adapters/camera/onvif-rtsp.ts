/**
 * CLASS C — the production camera adapter, adapter kind `ONVIF_RTSP` (blueprint row 65; register
 * NM-09; capture spec §A.6, §A.6.0; structured §9 C-1, C-2).
 *
 * An INTERFACE-COMPLETE STUB. It states the seam for a real IP camera and builds none of it: no
 * socket, no process, no package. Every member that would touch a device refuses with
 * `CAPTURE_ADAPTER_CLASS_C`. It has no opener (D86 C-5): the path that records a real camera is
 * class C-2 and is decided nowhere yet (spec §A.6.3).
 *
 * This file is loaded by `adapters/real.ts` only, and never in a test (static rule in
 * `adapters/__tests__/static.test.ts`). The search is NOT here: row 131 built it as its own adapter
 * (`camera/onvif-discovery.ts` over `camera/ws-discovery.ts`), because this file may import nothing
 * but the layer's vocabulary (rule A-1). Row 142 builds the connection test (`camera/onvif-session.ts`).
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
