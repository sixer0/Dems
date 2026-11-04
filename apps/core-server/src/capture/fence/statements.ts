/**
 * The statements of the capture fence (blueprint row 136; database contract `dbc-4` §N.2 "Who may
 * write the column", §N.9; decisions D83 D-DB-13, O-8; SEC35-41 (c)).
 *
 * Run as the runtime role `dems_app`, inside one unit of the pipeline. Three statements:
 *   - two reads: the four devices the selector assigns, and the whole registry, each with its
 *     adapter kind;
 *   - ONE write: the INSERT of a local device as a NEW row. It names `adapter_kind` (static pin:
 *     every INSERT into `capture_devices` does) with the literal `LOCAL_DEVICE` - never a bind
 *     value, so that no caller can make this statement write another kind.
 *
 * THERE IS NO UPDATE HERE AND THERE NEVER MAY BE ONE OF `adapter_kind`: the column is written at
 * INSERT and `dems_app` holds no UPDATE on it (a device that changes its adapter is another
 * device with another id). The seeded built-ins stay `FAKE`.
 *
 * The INSERT is idempotent by itself: it writes nothing while a device of that class with the
 * kind `LOCAL_DEVICE` exists, and otherwise takes the next free number of the class
 * (`CAM-03` / `MIC-03` on a fresh seed: the id rule of `capture_devices_id_check`).
 */

/** The six slots of the selector with the device each names (D60, 2026-11-04: four video tracks and two mic roles). No row when the selector table is empty. */
export const READ_ASSIGNED_SOURCES =
  'SELECT s.slot, d.id, d.kind, d.adapter_kind AS "adapterKind" ' +
  'FROM public.capture_config c ' +
  "CROSS JOIN LATERAL (VALUES ('VIDEO-01', c.video_01_device_id), ('VIDEO-02', c.video_02_device_id), ('VIDEO-03', c.video_03_device_id), ('VIDEO-04', c.video_04_device_id), ('MIC-PRIMARY', c.mic_primary_id), ('MIC-STANDBY', c.mic_standby_id)) AS s(slot, device_id) " + // D60 (2026-11-04): the two further camera lines are read too - a dev source on VIDEO-03/04 must reach the class check
  'JOIN public.capture_devices d ON d.id = s.device_id ' +
  'ORDER BY s.slot';

/** Every registered device with its class and its adapter kind, in id order. */
export const READ_STORED_DEVICES = 'SELECT d.id, d.kind, d.adapter_kind AS "adapterKind", d.model FROM public.capture_devices d ORDER BY d.id';

/**
 * Registers the local device of one class. Binds: `$1` the device class (`CAMERA` | `MIC`), `$2`
 * the id prefix of that class (`CAM-` | `MIC-`), `$3` the transport code, `$4` the label, `$5`
 * whether the device was in the device list when it was registered. Returns the new id, or no row
 * when a local device of the class is registered already.
 */
export const REGISTER_LOCAL_DEVICE =
  'INSERT INTO public.capture_devices (id, kind, transport, model, enabled, adapter_kind) ' +
  "SELECT $2::text || lpad((COALESCE(max(substring(d.id from '-([0-9]+)$')::int), 0) + 1)::text, 2, '0'), $1::text, $3::text, $4::text, $5::boolean, 'LOCAL_DEVICE' " +
  'FROM public.capture_devices d WHERE d.kind = $1::text ' +
  "HAVING NOT EXISTS (SELECT 1 FROM public.capture_devices x WHERE x.kind = $1::text AND x.adapter_kind = 'LOCAL_DEVICE') " +
  'RETURNING id';

/** Every statement of this file that writes, for the static pin. */
export const CAPTURE_FENCE_WRITES: readonly string[] = Object.freeze([REGISTER_LOCAL_DEVICE]);
