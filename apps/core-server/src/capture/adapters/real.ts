/**
 * The ONE loader of the production adapters (blueprint row 65; task 4 row 88, THE LIFT, decision
 * AM-1; capture spec §A.1 "class-C adapters must never load in a test").
 *
 * The production adapter files are imported HERE and, for their values, nowhere else in the
 * product, and only when this function is called for the operation `REAL_PRODUCTION`: the import
 * is dynamic, so that reading the adapter layer (its barrel, its fakes, its registry) never
 * evaluates a production adapter. Its one production caller is the boot step of the fence, by a
 * dynamic import (rule A-1 as rewritten by row 88). At run time any other operation is refused
 * BEFORE the import.
 *
 * SINCE THE LIFT (row 88) it builds the BUILT adapters: the camera `camera/onvif-relay.ts` (with
 * an opener) and, where the host has a production microphone opener, `audio/usb-audio-production.ts`.
 * The microphone is the one choice by platform (AM-1 (3)(h) as read with the erratum of C135): the
 * caller hands `audio: null` where the host has none - every platform but `linux` until the macOS
 * rows (N10, then the M2b gate row) - and the stub `audio/usb-audio.ts` is built in its place: a
 * `USB_AUDIO` adapter that states NO opener, so that a production microphone is listed and
 * assignable there and never recorded, and no `REAL_PRODUCTION` session can start (fail-closed).
 * The switch stays the class-C stub `poe/snmp-poe.ts` (no opener; `SNMP_POE` is not lifted).
 */
import { CaptureAdapterError, CaptureAdapterRefusal } from './errors';
import { CaptureOperation } from './kinds';
import type { OnvifRelayCameraAdapter, OnvifRelayCameraDependencies } from './camera/onvif-relay';
import type { UsbAudioProductionOptions } from './audio/usb-audio-production';
import type { AudioInputAdapter, CaptureDeviceEntry, PoeController } from './types';

export interface ProductionDevices {
  readonly cameras: readonly CaptureDeviceEntry[];
  readonly mics: readonly CaptureDeviceEntry[];
  readonly switches: readonly CaptureDeviceEntry[];
}

export interface ProductionAdapters {
  /** The built camera adapter: its own report source (`relayReports`) is attached to the session's hub by the boot step. */
  readonly camera: OnvifRelayCameraAdapter;
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
 * SINCE THE LIFT (row 88) the two shapes are the adapters' own option types (they were type
 * parameters while rule A-9 let no production source name a built file). The imports above are
 * TYPE imports: they are erased and evaluate nothing.
 */
/** What the production microphone adapter takes beside its device list. */
export type ProductionMicrophoneDependencies = Omit<UsbAudioProductionOptions, 'devices'>;

export interface ProductionAdapterDependencies {
  readonly camera: OnvifRelayCameraDependencies;
  /** NULL: this host has no production microphone opener (every platform but `linux` today; AM-1 (3)(h), C135) - the stub without an opener is built. */
  readonly audio: ProductionMicrophoneDependencies | null;
}

export async function loadProductionAdapters(operation: CaptureOperation, devices: ProductionDevices, dependencies: ProductionAdapterDependencies): Promise<ProductionAdapters> {
  if (operation !== CaptureOperation.REAL_PRODUCTION) throw new CaptureAdapterError(CaptureAdapterRefusal.REAL_ADAPTERS_REFUSED);
  // A caller that forgot the bundle is refused before anything is imported: a missing member would be a production adapter
  // without its door or its reader. `audio` must be STATED - a bundle or null - never left out.
  if (typeof dependencies !== 'object' || dependencies === null || typeof dependencies.camera !== 'object' || dependencies.camera === null || !('audio' in dependencies) || typeof dependencies.audio !== 'object') throw new CaptureAdapterError(CaptureAdapterRefusal.ADAPTER_INVALID);
  const microphone = dependencies.audio;
  const [camera, poe] = await Promise.all([import('./camera/onvif-relay'), import('./poe/snmp-poe')]);
  const audio: AudioInputAdapter =
    microphone === null ? (await import('./audio/usb-audio')).createUsbAudioInputAdapter(devices.mics) : (await import('./audio/usb-audio-production')).createUsbAudioProductionAdapter({ ...microphone, devices: devices.mics });
  return {
    camera: camera.createOnvifRelayCameraAdapter(devices.cameras, dependencies.camera),
    audio,
    poe: poe.createSnmpPoeController(devices.switches),
  };
}
