/**
 * The camera adapter that SEARCHES (blueprint row 131; capture spec §A.1.1 rule RG-1, §A.6.0,
 * §A.6.1; decisions D75, D76, D80(1)).
 *
 * Adapter kind `ONVIF_RTSP`, serving NO registered device: it is the "discovery half" that rule
 * RG-1 registers in `REAL_PRODUCTION` and in `REAL_DEVELOPMENT`. `discover()` is the probe of
 * `ws-discovery.ts` and nothing more: a candidate is built from the probe answer alone, nothing is
 * connected, registered or authenticated (D76 (1)).
 *
 * WHAT IT DOES NOT DO:
 *   - `testConnection` is row 142 (`camera/onvif-session.ts`): until then it refuses with
 *     `CAPTURE_ADAPTER_CLASS_C`. This file imports no ONVIF client and makes no authenticated and
 *     no configuration call (no clock set, no GOP set, no profile change, no PoE cycle);
 *   - it has no opener (D86 C-5) and no device: every device member refuses;
 *   - it is not registered anywhere by this row. Row 132 builds it with the server's message-ID
 *     source, the capture timers and its registry lookup, and is the only caller of `discover`
 *     besides the pre-check (static rule G-R13).
 *
 * The class-C file `onvif-rtsp.ts` stays as it is (it may import nothing but the layer's own
 * vocabulary, rule A-1): its `discover` is not this one.
 */
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import { CaptureAdapterKind } from '../kinds';
import type { CameraAdapter, DiscoverySearch } from '../types';
import { createWsDiscovery, type WsDiscoveryOptions, type WsDiscoveryResult } from './ws-discovery';

export interface OnvifDiscoveryAdapter extends CameraAdapter {
  /** Probe only. Rejects with `DiscoveryNotRunError` when the search could not run: that is never an empty result (DS-13). */
  discover(search: DiscoverySearch): Promise<WsDiscoveryResult>;
}

export function createOnvifDiscoveryAdapter(options: WsDiscoveryOptions): OnvifDiscoveryAdapter {
  const discovery = createWsDiscovery(options);
  const noDevice = (): never => {
    throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN);
  };
  return {
    seam: 'CAMERA',
    kind: CaptureAdapterKind.ONVIF_RTSP,
    devices: Object.freeze([]),
    hasOpener: false,
    discover: (search) => discovery.search(search),
    testConnection: async () => {
      throw new CaptureAdapterError(CaptureAdapterRefusal.CLASS_C_NOT_BUILT);
    },
    openSource: async (deviceId) => {
      throw new CaptureAdapterError(CaptureAdapterRefusal.SOURCE_KIND_NOT_RECORDABLE, deviceId);
    },
    profiles: async () => noDevice(),
    pullUrl: () => noDevice(),
    ntpOffsetMs: async () => noDevice(),
  };
}
