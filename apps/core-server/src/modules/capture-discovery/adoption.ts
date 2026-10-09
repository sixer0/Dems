/**
 * The registry side of an adoption (blueprint rows 132 / 142; contract C3 §2.6 "Adoption: when a
 * `capture_devices` row comes into being", "What adoption stores"; database contract `dbc-4` §N).
 *
 * The connect flow (`connect/service.ts`) calls this as its `DeviceRegistrar`, INSIDE the unit of
 * work of operation 96, after every check and the re-verification of that operation:
 *
 *   1. the INTERNAL action `registerCaptureDevice` of the engine adds the camera to the replicated
 *      `captureDevices` slice; the durable mapping writes its `capture_devices` row (with the
 *      adapter kind, written once and never updated) through the same unit;
 *   2. ONE statement sets the columns of that row the slice does not model: the transport `RTSP`,
 *      the endpoint reference (`onvif_uuid`), the usable profile codes the re-verification read,
 *      and `last_seen_at`. The row count decides: anything but one row fails the unit.
 *
 * Both are part of the caller's unit: with the adoption's audit rows and the credential row they
 * commit together or not at all. Nothing here reads or holds a credential, and nothing is logged:
 * the endpoint reference and the address are in no log line (the caller's audit row carries them
 * for a PRODUCTION candidate only, D86 C-3).
 */
import type { CaptureDeviceStatus } from '@dems/shared/sim';
import { registerCaptureDeviceIn, type EngineUnit } from '../../engine';

/** The stored transport of an adopted camera (C3 §2.6 "What adoption stores"). */
export const ADOPTED_CAMERA_TRANSPORT = 'RTSP';

/** The discovery columns of the new row. Columns the runtime role may update (`0005_capture_privileges.sql`); never `adapter_kind`. */
export const SET_ADOPTED_CAMERA_COLUMNS =
  'UPDATE public.capture_devices SET transport = $2, onvif_uuid = $3, profiles = $4::jsonb, last_seen_at = $5 WHERE id = $1 AND kind = \'CAMERA\'';

/** What an adoption registers, as the connect flow hands it in (`connect/service.ts` `AdoptedDevice`). */
export interface AdoptedCamera {
  readonly id: string;
  readonly adapterKind: string;
  readonly model: string | null;
  /** Host, or host and port: never a locator with a user part. */
  readonly address: string;
  readonly endpointRef: string | null;
  readonly profiles: readonly string[];
  readonly at: number;
}

export class AdoptionRowMissing extends Error {
  readonly code = 'CAPTURE_ADOPTION_ROW_MISSING';
  constructor() {
    super('the registry row of an adopted camera was not there to take its discovery columns');
    this.name = 'AdoptionRowMissing';
  }
}

/** Registers `device` in `scope`. Resolves with the device as the slice holds it. Throws to roll the caller's unit back. */
export async function registerAdoptedCamera(scope: EngineUnit, device: AdoptedCamera): Promise<CaptureDeviceStatus> {
  const registered = await registerCaptureDeviceIn(scope, { id: device.id, model: device.model, host: device.address, adapter: device.adapterKind });
  const updated = await scope.unit.query(SET_ADOPTED_CAMERA_COLUMNS, [device.id, ADOPTED_CAMERA_TRANSPORT, device.endpointRef, JSON.stringify(device.profiles), device.at]);
  if (updated.rowCount !== 1) throw new AdoptionRowMissing();
  return registered;
}
