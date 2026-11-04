/**
 * The store of the capture-config module (blueprint row 52 / M2-W10; register NM-09; dbc-3 §B.1/§B.2).
 *
 * WHAT IT IS. The in-memory holder of the two capture slices, loaded once from the two KEPT
 * tables (`capture_config`, `capture_devices`) and read by reference afterwards. It is the
 * server-native counterpart of the engine's committed state: the slices are classified
 * `S (server-native)` in `db/mapping/slices.ts` (row 49), so they never travel through the
 * engine's durable mapping and this store is their only reader at runtime. Operations 76/77
 * answer from it and 78/79/80/89 will write through it when their live paths land (row 66);
 * supervisor telemetry will update it when the seam lands (row 57, SH-18).
 *
 * ONE STATEMENT. Like the stored matrix of the permission guard (`permission-guard/matrix.ts`,
 * whose hand-written read this follows), the load is a single statement so the selector, the
 * registry and the session fact are one snapshot: a seed or a reset that swaps rows is never
 * seen half-applied. The statement carries no parameter and reads no credential table:
 * `capture_device_credentials` is invisible to this module end to end (RK-12; SEC35-01/02). A
 * unit test holds its table names against the typed schema of `db/schema/capture.ts`.
 *
 * FAIL CLOSED. A row set that cannot form a valid slice raises `CaptureSliceError` naming codes
 * and identifiers only - never a value beyond an id or a code. The boot step turns such a refusal
 * into a stopped start (the same rule the engine's rehydration states for a stored state).
 *
 * AN UNASSIGNED SLOT IS NOT SUCH A ROW SET (task 4 row 29; decisions C14, C18; AD-04). A selector
 * slot whose column is NULL is a valid state: the load answers a selector WITHOUT that line, down
 * to a row of six NULLs (two empty lists). A production Core with unassigned slots boots; what
 * refuses a session start on it is the session start, not this step.
 */
import { CaptureSliceError, captureConfigSliceOf, captureDevicesSliceOf, type CaptureConfigRecord, type CaptureDeviceRecord } from './slices';

/** What loads the store: the runtime pool, or a unit's connection (the `MatrixReader` idiom). */
export interface CaptureStoreReader {
  query<Row>(text: string): Promise<{ rows: Row[] }>;
}

/** The selector row as the store reads it (T-31), the registry aggregate, and the lock fact. */
export interface CaptureStateRow {
  readonly config: unknown;
  readonly devices: unknown;
  readonly session_open: boolean;
}

/**
 * One statement, three aggregates: the selector row (or null when the seed has not written it),
 * the registry rows in id order, and whether a session is open (the lock of OD-10 is a fact about
 * the live session, never a column). `revision` is cast to `int` (a count of edits, far below
 * 2^31). `updated_at` is NOT cast: it is an instant in epoch milliseconds (about 1.76e12), which
 * no 32-bit integer holds - the cast this statement had until blueprint row 57 mounted the module
 * failed on the first real row with `integer out of range` and stopped the boot. As a `bigint` in
 * `json_build_object` it is written as a JSON number, exact for every instant below 2^53.
 */
export const READ_CAPTURE_STATE =
  'SELECT ' +
  "(SELECT json_build_object(" +
  "'video01DeviceId', c.video_01_device_id, 'video01Profile', c.video_01_profile, " +
  "'video02DeviceId', c.video_02_device_id, 'video02Profile', c.video_02_profile, " +
  // D60 (2026-11-04): the third and fourth video slots of the selector row (migration 0039).
  "'video03DeviceId', c.video_03_device_id, 'video03Profile', c.video_03_profile, " +
  "'video04DeviceId', c.video_04_device_id, 'video04Profile', c.video_04_profile, " +
  // D61 (2026-11-04): the two mic roles became four numbered channels (0040 renames `mic_primary_id`/`mic_standby_id` to `mic_01_id`/`mic_02_id` and adds 3/4).
  "'mic01Id', c.mic_01_id, 'mic02Id', c.mic_02_id, 'mic03Id', c.mic_03_id, 'mic04Id', c.mic_04_id, " +
  "'revision', c.revision::int, 'updatedAt', c.updated_at) " +
  'FROM public.capture_config c LIMIT 1) AS config, ' +
  "(SELECT COALESCE(json_agg(json_build_object(" +
  "'id', d.id, 'kind', d.kind, 'transport', d.transport, 'model', d.model, 'firmware', d.firmware, " +
  "'address', d.address, 'poePort', d.poe_port, 'enabled', d.enabled) ORDER BY d.id), '[]'::json) " +
  'FROM public.capture_devices d) AS devices, ' +
  // Fix wave L (re-check 70 note G70c-04): ONE rule for "a session is open" - `isSessionActive` of the session machine, which
  // operation 76 answers `locked` with: a session that is not SEALED. The row of the last session stays in the table after its
  // seal; "a row exists" made the boot line say `locked: true` on an idle Core whose selector accepted every edit.
  "EXISTS (SELECT 1 FROM public.active_session s WHERE s.state <> 'SEALED') AS session_open";

/** What one load read, kept as the store's current snapshot. */
export interface CaptureSnapshot {
  /** Slice 29, the device selector (wire form). */
  readonly captureConfig: ReturnType<typeof captureConfigSliceOf>;
  /** Slice 30, the capture-device registry (wire form). */
  readonly captureDevices: ReturnType<typeof captureDevicesSliceOf>;
  /** The optimistic revision of the selector row (0 for the built-in baseline, which has no row). */
  readonly revision: number;
  /** True while a session is open: every edit refuses `409 CAPTURE_CONFIG_LOCKED` then (OD-10). */
  readonly locked: boolean;
  /** True when the selector table held no row and the built-in baseline answered instead. */
  readonly builtInBaseline: boolean;
}

/** The store: `load` once at boot, `snapshot` by reference after it. */
export interface CaptureConfigStore {
  /** Reads the tables and replaces the snapshot. Throws `CaptureSliceError` on an invalid row set. */
  load(reader: CaptureStoreReader): Promise<CaptureSnapshot>;
  /** The current snapshot; throws until the first `load` succeeded (the boot step loads first). */
  snapshot(): CaptureSnapshot;
}

function recordOf(value: unknown): CaptureConfigRecord | null {
  if (value === null || value === undefined) return null;
  const row = value as Record<string, unknown>;
  const count =(member: string): number => {
    const found = row[member];
    if (typeof found !== 'number' || !Number.isInteger(found)) throw new CaptureSliceError('CAPTURE_ROW_INVALID', 'the selector row carries a non-integer member', { member });
    return found;
  };
  // AN UNASSIGNED SLOT (task 4 row 29, site A1; decisions C14, C18; security requirement AD-04).
  // The slot columns (twelve since D61, 2026-11-04: four video pairs and four mic channels; ten under D60) are nullable since schema set A, and `json_build_object` writes a NULL
  // column as a JSON null. A null (or a member the aggregate left out) is the slot's "nothing
  // assigned": it is handed on as `null` and the slice builder makes an ABSENT line of it. Until
  // this row `text()` threw for it, which stopped the boot at the step `capture.config`. Anything
  // else that is not text is still refused, by member name: fail closed, never read as empty.
  const slot = (member: string): string | null => {
    const found = row[member];
    if (found === null || found === undefined) return null;
    if (typeof found !== 'string') throw new CaptureSliceError('CAPTURE_ROW_INVALID', 'the selector row carries a non-text member', { member });
    return found;
  };
  return {
    video01DeviceId: slot('video01DeviceId'),
    video01Profile: slot('video01Profile'),
    video02DeviceId: slot('video02DeviceId'),
    video02Profile: slot('video02Profile'),
    // D60 (2026-11-04): the third and fourth video slots.
    video03DeviceId: slot('video03DeviceId'),
    video03Profile: slot('video03Profile'),
    video04DeviceId: slot('video04DeviceId'),
    video04Profile: slot('video04Profile'),
    mic01Id: slot('mic01Id'), // D61 (2026-11-04): four numbered microphone channels
    mic02Id: slot('mic02Id'), // D61
    mic03Id: slot('mic03Id'), // D61
    mic04Id: slot('mic04Id'), // D61
    revision: count('revision'),
    updatedAt: count('updatedAt'),
  };
}

function recordsOf(value: unknown): readonly CaptureDeviceRecord[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new CaptureSliceError('CAPTURE_ROW_INVALID', 'the registry aggregate is not a list', {});
  return value.map((entry) => {
    const row = entry as Record<string, unknown>;
    const kind = row['kind'];
    if (kind !== 'CAMERA' && kind !== 'MIC' && kind !== 'POE') {
      throw new CaptureSliceError('CAPTURE_ROW_INVALID', 'a registry row carries a kind outside CAMERA/MIC/POE', { deviceId: typeof row.id === 'string' ? row.id : 'unknown' });
    }
    const textOrNull = (member: string): string | null => {
      const found = row[member];
      if (found === null || found === undefined) return null;
      if (typeof found !== 'string') throw new CaptureSliceError('CAPTURE_ROW_INVALID', 'a registry row carries a non-text member', { member });
      return found;
    };
    if (typeof row.id !== 'string' || typeof row.transport !== 'string' || typeof row.enabled !== 'boolean') {
      throw new CaptureSliceError('CAPTURE_ROW_INVALID', 'a registry row misses id/transport/enabled', {});
    }
    return {
      id: row.id,
      kind,
      transport: row.transport,
      model: textOrNull('model'),
      firmware: textOrNull('firmware'),
      address: textOrNull('address'),
      poePort: textOrNull('poePort'),
      enabled: row.enabled,
    };
  });
}

/**
 * The transport code of every registered microphone, by device ID: the registry aggregate of the
 * module's ONE read statement, nothing else of it. The replicated device slice carries no
 * transport, so a pair replacement of operation 78 (decision D133 (1)) that puts a microphone
 * behind the capture for the first time reads its stored transport here; the selector slot then
 * says what the registry row says, before and after a restart.
 */
export async function readMicTransports(reader: CaptureStoreReader): Promise<ReadonlyMap<string, string>> {
  const { rows } = await reader.query<CaptureStateRow>(READ_CAPTURE_STATE);
  return new Map(recordsOf(rows[0]?.devices ?? null).filter((device) => device.kind === 'MIC').map((device) => [device.id, device.transport]));
}

/**
 * THE PROFILE CODES A CAMERA'S STORED ROW LISTS (`capture_devices.profiles`; task 4 row 187, ruling
 * C36 (1)): for a production camera they are the statements of its own streams, minted when it was
 * adopted (rows 50 / 51). The replicated device slice carries no profile list, so the edit that
 * assigns a production camera reads them here. No parameter, no credential table, cameras only.
 */
export const READ_CAMERA_PROFILES = "SELECT d.id, d.profiles FROM public.capture_devices d WHERE d.kind = 'CAMERA'";

interface CameraProfilesRow {
  readonly id: unknown;
  readonly profiles: unknown;
}

/**
 * By camera, the profile codes its stored row lists. A row whose list is no list, or an element
 * that is no text, states nothing: FAIL CLOSED - the caller then finds no code to accept.
 */
export async function readCameraProfiles(reader: CaptureStoreReader): Promise<ReadonlyMap<string, readonly string[]>> {
  const { rows } = await reader.query<CameraProfilesRow>(READ_CAMERA_PROFILES);
  const byCamera = new Map<string, readonly string[]>();
  for (const row of rows) {
    if (typeof row.id !== 'string') continue;
    byCamera.set(row.id, Array.isArray(row.profiles) && row.profiles.every((code) => typeof code === 'string') ? Object.freeze([...(row.profiles as string[])]) : Object.freeze([]));
  }
  return byCamera;
}

/**
 * THE PROFILE CODES THAT HAVE A STORED STREAM ROW (`capture_device_streams`; task 4 row S86a,
 * caution C-1 of the security review row 86, decision C127). The camera adapter's open reads the
 * stream row of the assigned code and refuses a code without one (`CAPTURE_PROFILE_UNKNOWN`, before
 * the reveal); the assignment of a production camera now asks the same table, so such a code - a
 * raw camera token in code form (C61) or a listed code no stream stated - is refused at assignment,
 * not at the start. Only the key columns: no token, no address, no credential table, no parameter.
 */
export const READ_CAMERA_STREAM_PROFILES = 'SELECT s.device_id AS id, s.profile FROM public.capture_device_streams s';

interface CameraStreamProfileRow {
  readonly id: unknown;
  readonly profile: unknown;
}

/**
 * By camera, the profile codes that have a stored stream row. A row whose key is no text states
 * nothing (FAIL CLOSED: a camera this map does not hold has no code with a stream row).
 */
export async function readCameraStreamProfiles(reader: CaptureStoreReader): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
  const { rows } = await reader.query<CameraStreamProfileRow>(READ_CAMERA_STREAM_PROFILES);
  const byCamera = new Map<string, Set<string>>();
  for (const row of rows) {
    if (typeof row.id !== 'string' || typeof row.profile !== 'string') continue;
    const codes = byCamera.get(row.id) ?? new Set<string>();
    codes.add(row.profile);
    byCamera.set(row.id, codes);
  }
  return byCamera;
}

/** Creates the store. One instance per app; the boot step of the module loads it. */
export function createCaptureConfigStore(): CaptureConfigStore {
  let current: CaptureSnapshot | null = null;
  return {
    async load(reader) {
      const { rows } = await reader.query<CaptureStateRow>(READ_CAPTURE_STATE);
      const row = rows[0];
      const config = recordOf(row?.config ?? null);
      const devices = recordsOf(row?.devices ?? null);
      const locked = row?.session_open === true;
      const captureConfig = captureConfigSliceOf(config, devices, locked);
      const captureDevices = captureDevicesSliceOf(devices);
      current = {
        captureConfig,
        captureDevices,
        revision: config?.revision ?? 0,
        locked,
        builtInBaseline: config === null,
      };
      return current;
    },
    snapshot() {
      if (current === null) throw new CaptureSliceError('CAPTURE_STORE_UNLOADED', 'the capture-config store was read before the boot step loaded it', {});
      return current;
    },
  };
}
