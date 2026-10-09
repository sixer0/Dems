/**
 * The ONE loader of the class-C adapters (blueprint row 65; check M4-FAKE-1 "real adapters =
 * class C, not executed"; capture spec §A.1 "class-C adapters must never load in a test").
 *
 * The three production adapter files are imported HERE and nowhere else, and only when this
 * function is called for the operation `REAL_PRODUCTION`: the import is dynamic, so that reading
 * the adapter layer (its barrel, its fakes, its registry) never evaluates a class-C file. Two
 * fences keep them out of every test:
 *   - static: no file but this one names a class-C file, and no test or test-support file
 *     imports this one except its own refusal test (`adapters/__tests__/static.test.ts`);
 *   - at run time: any other operation is refused BEFORE the import.
 */
import { CaptureAdapterError, CaptureAdapterRefusal } from './errors';
import { CaptureOperation } from './kinds';
import type { AudioInputAdapter, CameraAdapter, CaptureDeviceEntry, PoeController } from './types';

export interface ProductionDevices {
  readonly cameras: readonly CaptureDeviceEntry[];
  readonly mics: readonly CaptureDeviceEntry[];
  readonly switches: readonly CaptureDeviceEntry[];
}

export interface ProductionAdapters {
  readonly camera: CameraAdapter;
  readonly audio: AudioInputAdapter;
  readonly poe: PoeController;
}

export async function loadProductionAdapters(operation: CaptureOperation, devices: ProductionDevices): Promise<ProductionAdapters> {
  if (operation !== CaptureOperation.REAL_PRODUCTION) throw new CaptureAdapterError(CaptureAdapterRefusal.REAL_ADAPTERS_REFUSED);
  const [camera, audio, poe] = await Promise.all([import('./camera/onvif-rtsp'), import('./audio/usb-audio'), import('./poe/snmp-poe')]);
  return {
    camera: camera.createOnvifRtspCameraAdapter(devices.cameras),
    audio: audio.createUsbAudioInputAdapter(devices.mics),
    poe: poe.createSnmpPoeController(devices.switches),
  };
}
