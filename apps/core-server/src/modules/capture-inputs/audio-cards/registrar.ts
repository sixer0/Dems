/**
 * The registry side of a microphone registration (task 4, blueprint rows 185 and 190, package
 * WP-07c; design addendum 04 section 4.2 "Where it is stored"; security addendum AD-07; the
 * finding of row 70). The camera's counterpart is `capture-discovery/adoption.ts`.
 *
 * The registration unit (`service.ts`, `registerAudioInput`) calls this as its
 * `MicrophoneRegistrar`, INSIDE the unit of work of operation 99, after every check of that
 * operation and the Core's own second card listing:
 *
 *   1. the INTERNAL action `registerCaptureMicrophone` of the engine adds the microphone to the
 *      replicated `captureDevices` slice - class `MIC`, adapter kind `USB_AUDIO` and the next free
 *      `MIC-nn` are the ACTION's, no value of this file or of a request names them - or enables a
 *      registered one again. The durable mapping writes its `capture_devices` row through the same
 *      unit (the adapter kind at the first write and never after);
 *   2. ONE statement sets the columns of that row the slice does not model: the transport `USB`
 *      (a literal), `enabled` and `last_seen_at`. The row count decides: anything but one row
 *      fails the unit.
 *
 * Both are part of the caller's unit: with the row of `capture_audio_inputs` and the audit entry
 * they commit together or not at all. No statement here adds a row to the registry (static rule
 * SEC35-41 (c)): the row comes from the engine's typed writer. Nothing is logged here, and the
 * product name goes to the action as the listing returned it and to nothing else.
 */
import { noteCaptureDeviceReachIn, registerCaptureMicrophoneIn } from '../../../engine';
import type { MicrophoneRegistrar } from './service';

/** The stored transport of a registered sound-card input (the transport of the built-in pair, `dbc-3` §B.2). A literal of the statement. */
export const REGISTERED_MICROPHONE_TRANSPORT = 'USB';

/**
 * The columns of the microphone's row the slice does not model. `$1` the microphone, `$2` the
 * instant. Columns the runtime role may update; never `adapter_kind`, never `kind`. The class and
 * the adapter kind are in the WHERE: no other device can be touched by it.
 */
export const SET_REGISTERED_MICROPHONE_COLUMNS =
  "UPDATE public.capture_devices SET transport = 'USB', enabled = true, last_seen_at = $2 WHERE id = $1 AND kind = 'MIC' AND adapter_kind = 'USB_AUDIO'";

/**
 * The microphone ids the registry TABLE holds, whatever their adapter kind (finding D50): a
 * production Core keeps the seeded `FAKE` rows out of its slice, so the slice alone would mint an id
 * whose row already exists - the UPSERT then keeps that row's adapter kind and the update below
 * finds no `USB_AUDIO` row. A read only; it adds no row (static rule SEC35-41 (c)).
 */
export const READ_TAKEN_MICROPHONE_IDS = "SELECT id FROM public.capture_devices WHERE kind = 'MIC'";

export class MicrophoneRegistryRowMissing extends Error {
  readonly code = 'CAPTURE_MICROPHONE_ROW_MISSING';
  constructor() {
    super('the registry row of a registered microphone was not there to take its columns');
    this.name = 'MicrophoneRegistryRowMissing';
  }
}

/**
 * The registrar of the product: the engine's action, then the one statement, both in the unit it
 * is handed. It throws to roll the caller's unit back (the mapped refusal of the action, or
 * `MicrophoneRegistryRowMissing`).
 */
export function createEngineMicrophoneRegistrar(): MicrophoneRegistrar {
  const settle = async (unit: Parameters<MicrophoneRegistrar['register']>[0], deviceId: string, at: number): Promise<void> => {
    const updated = await unit.db.query(SET_REGISTERED_MICROPHONE_COLUMNS, [deviceId, at]);
    if (updated.rowCount !== 1) throw new MicrophoneRegistryRowMissing();
  };
  return {
    async register(unit, device) {
      const taken = await unit.db.query<{ id: string }>(READ_TAKEN_MICROPHONE_IDS);
      const registered = await registerCaptureMicrophoneIn(unit.scope, { deviceId: null, model: device.model, takenIds: taken.rows.map((row) => row.id) });
      await settle(unit, registered.id, device.at);
      return registered.id;
    },
    async reenable(unit, device) {
      await registerCaptureMicrophoneIn(unit.scope, { deviceId: device.deviceId, model: device.model });
      // Audit row M97 (D104, D116): the microphone is back, so a stated NOT_REACHABLE no longer holds. The card was only
      // LISTED (opened by nothing here): the reach is cleared to "not checked", never stated REACHABLE. Same unit, through
      // row 127's door; a stated REACHABLE or no reading is left as it is.
      const entry = unit.scope.pending().captureDevices.devices.find((candidate) => candidate.id === device.deviceId);
      if (entry?.reach === 'NOT_REACHABLE') await noteCaptureDeviceReachIn(unit.scope, { deviceId: device.deviceId, reach: null, checkedAt: null });
      await settle(unit, device.deviceId, device.at);
    },
  };
}
