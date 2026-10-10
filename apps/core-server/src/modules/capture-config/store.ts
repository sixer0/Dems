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
  "'micPrimaryId', c.mic_primary_id, 'micStandbyId', c.mic_standby_id, " +
  "'revision', c.revision::int, 'updatedAt', c.updated_at) " +
  'FROM public.capture_config c LIMIT 1) AS config, ' +
  "(SELECT COALESCE(json_agg(json_build_object(" +
  "'id', d.id, 'kind', d.kind, 'transport', d.transport, 'model', d.model, 'firmware', d.firmware, " +
  "'address', d.address, 'poePort', d.poe_port, 'enabled', d.enabled) ORDER BY d.id), '[]'::json) " +
  'FROM public.capture_devices d) AS devices, ' +
  'EXISTS (SELECT 1 FROM public.active_session) AS session_open';

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
  const text = (member: string): string => {
    const found = row[member];
    if (typeof found !== 'string') throw new CaptureSliceError('CAPTURE_ROW_INVALID', 'the selector row carries a non-text member', { member });
    return found;
  };
  const count = (member: string): number => {
    const found = row[member];
    if (typeof found !== 'number' || !Number.isInteger(found)) throw new CaptureSliceError('CAPTURE_ROW_INVALID', 'the selector row carries a non-integer member', { member });
    return found;
  };
  return {
    video01DeviceId: text('video01DeviceId'),
    video01Profile: text('video01Profile'),
    video02DeviceId: text('video02DeviceId'),
    video02Profile: text('video02Profile'),
    micPrimaryId: text('micPrimaryId'),
    micStandbyId: text('micStandbyId'),
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
