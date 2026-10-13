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

/**
 * WHAT THE PRODUCTION ADAPTERS ARE BUILT FROM (task 4 row 85, WP-13b; design addendum 6.4): one
 * bundle per adapter, composed by the production registry builder of the fence and handed through
 * this loader unchanged.
 *
 *   camera   what `createOnvifRelayCameraAdapter(devices, camera)` takes: the production door, the
 *            relay program, the timers, the credential reader of the holder `CAMERA_ADAPTER`, the
 *            locator read, the stored facts of a stream, the destination rule on the stored address,
 *            the loss callback, the clock read;
 *   audio    what `createUsbAudioProductionAdapter({ devices, ...audio })` takes: the stored row of
 *            a microphone, the card enumerator, the configuration writer, the helper and the guard
 *            program, the run directory, the timers, the loss callback.
 *
 * THE TWO SHAPES ARE TYPE PARAMETERS UNTIL THE LIFT. Static rule A-9 lets no production source name
 * a built adapter file before row 88 - not for a type either - so this file cannot state the two
 * option types. The test of this loader binds them to the adapters' own types and builds both
 * adapters from one bundle. AT THE LIFT (row 88): the two parameters become those two types, the
 * first two imports below become the built files, and the bundle is passed on. Until then the
 * class-C stubs are loaded and the bundle is carried and NOT READ: a stub builds nothing.
 */
export interface ProductionAdapterDependencies<Camera = unknown, Audio = unknown> {
  readonly camera: Camera;
  readonly audio: Audio;
}

export async function loadProductionAdapters<Camera, Audio>(operation: CaptureOperation, devices: ProductionDevices, dependencies: ProductionAdapterDependencies<Camera, Audio>): Promise<ProductionAdapters> {
  if (operation !== CaptureOperation.REAL_PRODUCTION) throw new CaptureAdapterError(CaptureAdapterRefusal.REAL_ADAPTERS_REFUSED);
  // A caller that forgot the bundle is refused before anything is imported: after the lift a missing member would be a
  // production adapter without its door or its reader.
  if (typeof dependencies !== 'object' || dependencies === null || !('camera' in dependencies) || !('audio' in dependencies)) throw new CaptureAdapterError(CaptureAdapterRefusal.ADAPTER_INVALID);
  const [camera, audio, poe] = await Promise.all([import('./camera/onvif-rtsp'), import('./audio/usb-audio'), import('./poe/snmp-poe')]);
  return {
    camera: camera.createOnvifRtspCameraAdapter(devices.cameras),
    audio: audio.createUsbAudioInputAdapter(devices.mics),
    poe: poe.createSnmpPoeController(devices.switches),
  };
}
