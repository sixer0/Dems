/**
 * CLASS C — the production microphone adapter, adapter kind `USB_AUDIO` (blueprint row 65;
 * register NM-10; capture spec §A.7; OD-06 "USB working assumption"; structured §9 C-4).
 *
 * An INTERFACE-COMPLETE STUB: no device is opened, no process is started. It has no opener
 * (D86 C-5): the transport of a real microphone is class C-4. Loaded by `adapters/real.ts` only,
 * and never in a test.
 */
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import { CaptureAdapterKind } from '../kinds';
import type { AudioInputAdapter, CaptureDeviceEntry } from '../types';

const classC = (deviceId: string | null = null): never => {
  throw new CaptureAdapterError(CaptureAdapterRefusal.CLASS_C_NOT_BUILT, deviceId);
};

export function createUsbAudioInputAdapter(devices: readonly CaptureDeviceEntry[]): AudioInputAdapter {
  return {
    seam: 'AUDIO',
    kind: CaptureAdapterKind.USB_AUDIO,
    devices: Object.freeze([...devices]),
    hasOpener: false,
    enumerate: async () => classC(),
    open: async (inputId) => {
      throw new CaptureAdapterError(CaptureAdapterRefusal.SOURCE_KIND_NOT_RECORDABLE, inputId);
    },
    level: async (inputId) => classC(inputId),
  };
}
