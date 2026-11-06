/**
 * THE SELECTOR LINE OF A GENERATED TEST SOURCE STATES ITS ADAPTER'S PROFILE (fix wave K, reconcile
 * pass; re-gate 89 finding G89b-01, second half; controller ruling of 2026-10-11).
 *
 * The seeded built-in cameras (`CAM-01`, `CAM-02`, adapter kind `FAKE`) and the selector that names
 * them are written by the SEED, with the simulator's profile (`H264_1080P25`), and both tables are
 * KEPT across a reset. On a development-capture Core those devices are the GENERATED sources
 * (`generated-sources.ts`), whose adapter declares - and makes - `GENERATED_CAMERA_PROFILE`. The
 * selector then stated a profile no stream of that source ever has, the signed manifest stated the
 * stream, and every session carried the notice `STREAM_PROFILE_DIFFERS`.
 *
 * ONE statement, run in the unit of the fence boot, in `REAL_DEVELOPMENT` ONLY (the caller asks
 * the one capture-operation function): a camera line of the selector whose device is of the kind
 * `FAKE` and whose profile is not the generated adapter's takes that profile. It is how a database
 * seeded before this pass (a lane whose rows are kept) and a fresh seed both come to the truth, at
 * the start of the Core that registers the generated adapters. No migration.
 *
 * WHAT IT NEVER TOUCHES: a line of another adapter kind (this Mac's camera, a production camera);
 * `capture_devices` (no row, no `adapter_kind`); a selector that puts ONE device behind two of its
 * tracks (D60, 2026-11-04: pairwise over the four - two profiles must differ there, `capture_config_dual_lens_check`: left as it is, and the notice
 * of the seal says what was recorded); a Core in simulated or production capture. A second start
 * writes nothing. An operator may still set another profile on such a line (operation 77): the
 * manifest then states the stream and the session carries the notice, until the next start.
 */
import { CaptureAdapterKind } from '../adapters/kinds';
import { GENERATED_CAMERA_PROFILE } from './generated-sources';
import type { FenceExecutor } from './registration';

/**
 * Binds: `$1` the profile of the generated camera adapter, `$2` the adapter kind of a generated
 * source, `$3` the server clock (null: the instant stays). Returns the four lines as they are now (D60, 2026-11-04), or no row when nothing was
 * to correct. `revision` moves by one: the selector's content changed.
 */
// D60 (2026-11-04): the correction covers the four camera lines, not two. Each line's device is read by a scalar
// subquery so an UNASSIGNED line (NULL) never blocks the correction of the others (the old comma-join equated
// "no line" with "no correction"); the dual-lens exclusion is the pairwise form of `capture_config_selector_check`:
// a device shared by two tracks is left alone, correcting both FAKE lines would collide there.
export const CORRECT_GENERATED_SOURCE_PROFILES =
  'UPDATE public.capture_config c SET ' +
  'video_01_profile = CASE WHEN (SELECT d.adapter_kind FROM public.capture_devices d WHERE d.id = c.video_01_device_id) = $2::text THEN $1::text ELSE c.video_01_profile END, ' +
  'video_02_profile = CASE WHEN (SELECT d.adapter_kind FROM public.capture_devices d WHERE d.id = c.video_02_device_id) = $2::text THEN $1::text ELSE c.video_02_profile END, ' +
  'video_03_profile = CASE WHEN (SELECT d.adapter_kind FROM public.capture_devices d WHERE d.id = c.video_03_device_id) = $2::text THEN $1::text ELSE c.video_03_profile END, ' + // D60
  'video_04_profile = CASE WHEN (SELECT d.adapter_kind FROM public.capture_devices d WHERE d.id = c.video_04_device_id) = $2::text THEN $1::text ELSE c.video_04_profile END, ' + // D60
  'revision = c.revision + 1, updated_at = COALESCE($3::bigint, c.updated_at) ' +
  'WHERE (c.video_01_device_id IS NULL OR c.video_02_device_id IS NULL OR c.video_01_device_id <> c.video_02_device_id) ' + // D60: pairwise, NULL-safe
  'AND (c.video_01_device_id IS NULL OR c.video_03_device_id IS NULL OR c.video_01_device_id <> c.video_03_device_id) ' +
  'AND (c.video_01_device_id IS NULL OR c.video_04_device_id IS NULL OR c.video_01_device_id <> c.video_04_device_id) ' +
  'AND (c.video_02_device_id IS NULL OR c.video_03_device_id IS NULL OR c.video_02_device_id <> c.video_03_device_id) ' +
  'AND (c.video_02_device_id IS NULL OR c.video_04_device_id IS NULL OR c.video_02_device_id <> c.video_04_device_id) ' +
  'AND (c.video_03_device_id IS NULL OR c.video_04_device_id IS NULL OR c.video_03_device_id <> c.video_04_device_id) ' +
  'AND ( ((SELECT d.adapter_kind FROM public.capture_devices d WHERE d.id = c.video_01_device_id) = $2::text AND c.video_01_profile <> $1::text) ' +
  'OR ((SELECT d.adapter_kind FROM public.capture_devices d WHERE d.id = c.video_02_device_id) = $2::text AND c.video_02_profile <> $1::text) ' +
  'OR ((SELECT d.adapter_kind FROM public.capture_devices d WHERE d.id = c.video_03_device_id) = $2::text AND c.video_03_profile <> $1::text) ' + // D60
  'OR ((SELECT d.adapter_kind FROM public.capture_devices d WHERE d.id = c.video_04_device_id) = $2::text AND c.video_04_profile <> $1::text) ) ' + // D60
  'RETURNING c.video_01_profile AS "video01Profile", c.video_02_profile AS "video02Profile", c.video_03_profile AS "video03Profile", c.video_04_profile AS "video04Profile"';

/** True when the statement changed the selector. Runs inside the caller's unit: all or nothing with the rest of the boot. */
export async function correctGeneratedSourceProfiles(executor: FenceExecutor, now: number | null): Promise<boolean> {
  const { rows } = await executor.query<Record<string, unknown>>(CORRECT_GENERATED_SOURCE_PROFILES, [GENERATED_CAMERA_PROFILE, CaptureAdapterKind.FAKE, now]);
  return rows.length > 0;
}
