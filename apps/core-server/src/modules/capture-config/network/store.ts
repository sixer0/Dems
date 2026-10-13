/**
 * The stored side of the camera network configuration (task 4 blueprint row 108; schema set B,
 * table `capture_network_config`, T-46; record `implementation/099_schema_set_b.md`).
 *
 * ONE ROW, OR NONE. The seed writes none: the table is empty until the first change, and a read of
 * an empty table is `null` (operation 101 then answers the contract's defaults). The first change
 * INSERTS the row; every later one is a compare-and-set UPDATE on `revision`.
 *
 * Every statement is a constant text with bind parameters; no value is ever part of a statement
 * text. They run as the runtime role `dems_app` (migration 0018: SELECT, INSERT, UPDATE of the
 * nine columns beside the key; no DELETE, no TRUNCATE). A read may run on the pool; both writes
 * run on the unit of work of the change and on nothing else.
 */
import type { QueryResultRow } from 'pg';

/** A connection that runs one parameterised statement: the pool for a read, a unit of work for a write. */
export interface Queryable {
  query<Row extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<{ readonly rows: Row[]; readonly rowCount: number | null }>;
}

/** The six settings, as stored. */
export interface NetworkConfigValues {
  readonly interfaceName: string | null;
  readonly cameraSubnet: string | null;
  readonly factoryAddresses: readonly string[];
  readonly aliasHost: number;
  readonly aliasMinutes: number;
  readonly cameraIpStart: number;
}

/** The stored row. */
export interface StoredNetworkConfig extends NetworkConfigValues {
  readonly revision: number;
  readonly updatedBy: string | null;
  readonly updatedAt: number;
}

/** A stored row that cannot be read as the table defines it. The text names the column, never a value. */
export class NetworkConfigRowError extends Error {
  readonly code = 'CAPTURE_NETWORK_CONFIG_ROW_INVALID';
  constructor(column: string) {
    super(`the stored camera network configuration cannot be read: ${column}`);
    this.name = 'NetworkConfigRowError';
  }
}

const COLUMNS =
  'interface_name AS "interfaceName", camera_subnet AS "cameraSubnet", factory_addresses AS "factoryAddresses", alias_host AS "aliasHost", ' +
  'alias_minutes AS "aliasMinutes", camera_ip_start AS "cameraIpStart", revision AS "revision", updated_by AS "updatedBy", updated_at AS "updatedAt"';

/** The one row, or none. */
export const READ_NETWORK_CONFIG = `SELECT ${COLUMNS} FROM public.capture_network_config WHERE singleton`;

/**
 * The FIRST change: `$1` to `$6` the six settings (`$3` the factory list as JSON text), `$7` the
 * revision, `$8` the operator, `$9` the instant. A row that is there already is left as it is: the
 * caller reads `rowCount` 0 as a change somebody else made first.
 */
export const INSERT_NETWORK_CONFIG =
  'INSERT INTO public.capture_network_config (singleton, interface_name, camera_subnet, factory_addresses, alias_host, alias_minutes, camera_ip_start, revision, updated_by, updated_at) ' +
  'VALUES (true, $1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9) ON CONFLICT (singleton) DO NOTHING';

/** A later change: compare-and-set on `$7`, the revision that was read. `$8` the operator, `$9` the instant. */
export const UPDATE_NETWORK_CONFIG =
  'UPDATE public.capture_network_config SET interface_name = $1, camera_subnet = $2, factory_addresses = $3::jsonb, alias_host = $4, alias_minutes = $5, camera_ip_start = $6, ' +
  'revision = revision + 1, updated_by = $8, updated_at = $9 WHERE singleton AND revision = $7';

/** The statements of this file that write, for the tests of the module. */
export const CAPTURE_NETWORK_CONFIG_WRITES: readonly string[] = Object.freeze([INSERT_NETWORK_CONFIG, UPDATE_NETWORK_CONFIG]);

interface Row extends QueryResultRow {
  interfaceName: unknown;
  cameraSubnet: unknown;
  factoryAddresses: unknown;
  aliasHost: unknown;
  aliasMinutes: unknown;
  cameraIpStart: unknown;
  revision: unknown;
  updatedBy: unknown;
  updatedAt: unknown;
}

/** A whole number the driver answered as a number or, for a wide column, as digits. */
function whole(value: unknown, column: string): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' && /^\d{1,15}$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(number) || number < 0) throw new NetworkConfigRowError(column);
  return number;
}
function textOrNull(value: unknown, column: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new NetworkConfigRowError(column);
  return value;
}

function storedOf(row: Row): StoredNetworkConfig {
  if (!Array.isArray(row.factoryAddresses) || !row.factoryAddresses.every((entry) => typeof entry === 'string')) throw new NetworkConfigRowError('factory_addresses');
  return {
    interfaceName: textOrNull(row.interfaceName, 'interface_name'),
    cameraSubnet: textOrNull(row.cameraSubnet, 'camera_subnet'),
    factoryAddresses: Object.freeze([...(row.factoryAddresses as string[])]),
    aliasHost: whole(row.aliasHost, 'alias_host'),
    aliasMinutes: whole(row.aliasMinutes, 'alias_minutes'),
    cameraIpStart: whole(row.cameraIpStart, 'camera_ip_start'),
    revision: whole(row.revision, 'revision'),
    updatedBy: textOrNull(row.updatedBy, 'updated_by'),
    updatedAt: whole(row.updatedAt, 'updated_at'),
  };
}

export interface NetworkConfigWrite {
  readonly values: NetworkConfigValues;
  readonly operatorId: string;
  readonly now: number;
}

export interface NetworkConfigStore {
  /** The stored row, or null for an empty table. Throws `NetworkConfigRowError` for a row outside the table's own definition. */
  read(db: Queryable): Promise<StoredNetworkConfig | null>;
  /** The first row, with `revision`. False when a row was there already: nothing was written. */
  insert(db: Queryable, write: NetworkConfigWrite, revision: number): Promise<boolean>;
  /** The change of the row that has `expectedRevision`. False when no row has it: nothing was written. */
  update(db: Queryable, write: NetworkConfigWrite, expectedRevision: number): Promise<boolean>;
}

const settingsOf = (values: NetworkConfigValues): unknown[] => [values.interfaceName, values.cameraSubnet, JSON.stringify(values.factoryAddresses), values.aliasHost, values.aliasMinutes, values.cameraIpStart];

export function createNetworkConfigStore(): NetworkConfigStore {
  return {
    async read(db) {
      const { rows } = await db.query<Row>(READ_NETWORK_CONFIG);
      return rows[0] === undefined ? null : storedOf(rows[0]);
    },
    async insert(db, write, revision) {
      const { rowCount } = await db.query(INSERT_NETWORK_CONFIG, [...settingsOf(write.values), revision, write.operatorId, write.now]);
      return rowCount === 1;
    },
    async update(db, write, expectedRevision) {
      const { rowCount } = await db.query(UPDATE_NETWORK_CONFIG, [...settingsOf(write.values), expectedRevision, write.operatorId, write.now]);
      return rowCount === 1;
    },
  };
}
