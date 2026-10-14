/**
 * THE `USB_AUDIO` ADAPTER OF A HOST WITHOUT A PRODUCTION MICROPHONE OPENER (blueprint row 65;
 * register NM-10; capture spec §A.7; task 4 row 88, decision AM-1 (3)(h) as read with the erratum
 * of C135). Formerly the class-C stub of the production microphone.
 *
 * Since the lift the loader builds the BUILT adapter `audio/usb-audio-production.ts` (with an
 * opener) on `linux`. On every other platform - `darwin` until the macOS microphone rows (N10,
 * then the M2b gates and their security acceptance) admit an opener there - it builds THIS one in
 * its place: a microphone registered there is listed and assignable and is NEVER recorded, because
 * this adapter states no opener (`SOURCE_KIND_NOT_RECORDABLE`), so no `REAL_PRODUCTION` session
 * can start on such a host (fail-closed). No device is opened, no process is started. Loaded by
 * `adapters/real.ts` only, and never in a test (static rule A-1).
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
