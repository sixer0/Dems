/**
 * The database side of the slice-to-table mapping: the statements that write and read the rows
 * of `../mapping` (plan row W20; database contract §6.4, §9.5, MR-3, MR-4, MR-6, MR-8; the
 * database half of hand-built element HB-13).
 *
 * The mapping folder is pure; this file is the only place that turns its rows into statements.
 * Three callers:
 *
 *   writeRows       a whole state into empty tables: the seed, and the reset routine;
 *   readStoredRows  the rows back, for `fromRows`: rehydration at start, and the tests;
 *   applyChanges    the changes `diffSlices` found between two states: the engine's
 *                   write-through.
 *
 * ITS OWN FOLDER (review finding CPB1-11; decisions D62 DN-10, D77 DN-13). Four units call it:
 * the seed, the reset routine and the bulk fixture (owner-role programs, which must not import
 * the engine) and the engine host at run time (which must not import the seed program). So it
 * lives beside the pure mapping, and the imports run one way:
 * `db/schema` <- `db/mapping` <- `db/store` <- seed, reset, fixtures, engine.
 *
 * Every function takes an EXECUTOR: a Drizzle database or, normally, a Drizzle transaction. None
 * of them opens, commits or rolls back anything; the caller owns the transaction, so the rows of
 * one unit of work are committed together (ENG-1, AP-5).
 *
 * Statements carry values as bind parameters only. A failure is reported as a `StoreError` that
 * names the table, the SQLSTATE and the constraint, and nothing else: the driver's and the query
 * builder's own messages can quote a statement with its parameters, so they are not passed on.
 */
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgColumn, PgDatabase, PgTable } from 'drizzle-orm/pg-core';
import {
  RING_LIMITS,
  TABLE_SQL_NAMES,
  WRITE_ORDER,
  type MappedRows,
  type MappedTable,
  type RbacRows,
  type RowChange,
  type StoredRows,
  type WrittenTable,
} from '../mapping';
import * as schema from '../schema';

/** A Drizzle database or transaction on the node-postgres driver, whatever its schema generic. */
export type RowExecutor = PgDatabase<NodePgQueryResultHKT, Record<string, never>>;

export type StoreErrorCode = 'WRITE_FAILED' | 'READ_FAILED' | 'AUDIT_HEAD_DIVERGED' | 'ROW_NOT_FOUND';

/** A failed statement of the store. `message` is safe to print: it never holds a value of a row. */
export class StoreError extends Error {
  readonly code: StoreErrorCode;
  /** SQL name of the table the statement was for. */
  readonly table: string;
  /** The SQLSTATE the server answered, when there was one. */
  readonly sqlState: string | undefined;
  /** The constraint the server named, when there was one. */
  readonly constraint: string | undefined;

  constructor(code: StoreErrorCode, table: string, detail: string, sqlState?: string, constraint?: string) {
    super(`${code}: ${table}: ${detail}`);
    this.name = 'StoreError';
    this.code = code;
    this.table = table;
    this.sqlState = sqlState;
    this.constraint = constraint;
  }
}

/** The SQLSTATE and constraint of a failure. Drizzle wraps the driver error: they are on `cause` (D38). */
function serverAnswer(error: unknown): { sqlState: string | undefined; constraint: string | undefined } {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && typeof current === 'object' && current !== null; depth += 1) {
    const candidate = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (typeof candidate.code === 'string') {
      return {
        sqlState: candidate.code,
        constraint: typeof candidate.constraint === 'string' ? candidate.constraint : undefined,
      };
    }
    current = candidate.cause;
  }
  return { sqlState: undefined, constraint: undefined };
}

function failed(code: 'WRITE_FAILED' | 'READ_FAILED', table: string, error: unknown): StoreError {
  if (error instanceof StoreError) return error;
  const { sqlState, constraint } = serverAnswer(error);
  const detail =
    sqlState === undefined
      ? 'the statement failed before the server answered.'
      : `the server answered ${sqlState}${constraint === undefined ? '' : ` (constraint ${constraint})`}.`;
  return new StoreError(code, table, detail, sqlState, constraint);
}

/** The table object of each mapped table. */
const TABLES = {
  operators: schema.operators,
  coreDevice: schema.coreDevice,
  coreState: schema.coreState,
  storagePolicy: schema.storagePolicy,
  consoleSettings: schema.consoleSettings,
  captureDevices: schema.captureDevices,
  captureConfig: schema.captureConfig,
  engineCounters: schema.engineCounters,
  hardwareSnapshot: schema.hardwareSnapshot,
  sessionHistory: schema.sessionHistory,
  evidenceItems: schema.evidenceItems,
  evidenceTracks: schema.evidenceTracks,
  evidenceCustody: schema.evidenceCustody,
  exportRecords: schema.exportRecords,
  activeSession: schema.activeSession,
  alerts: schema.alerts,
  auditLog: schema.auditLog,
  auditChainHead: schema.auditChainHead,
  events: schema.events,
} as const satisfies Record<MappedTable, PgTable>;

/** Rows per INSERT statement: far below the driver's limit of 65,535 bind parameters. */
const INSERT_CHUNK_ROWS = 500;

/**
 * Inserts the rows of one mapped table. A caller that interleaves other tables (the seed writes
 * the credentials after the operators) walks `WRITE_ORDER` itself and calls this per table.
 */
export async function insertRows<K extends WrittenTable>(executor: RowExecutor, table: K, rows: MappedRows[K]): Promise<void> {
  await insertInto(executor, table, rows);
}

async function insertInto(executor: RowExecutor, table: WrittenTable, rows: readonly object[], captureDevicesAsUpsert = false): Promise<void> {
  if (rows.length === 0) return;
  const target: PgTable = TABLES[table];
  try {
    if (table === 'auditLog') {
      // AP-4: one INSERT per audit row, in ascending sequence. The guard trigger checks each row
      // against the chain head and moves the head; a multi-row INSERT fires it in no fixed order.
      const ordered = [...(rows as MappedRows['auditLog'])].sort((a, b) => a.seq - b.seq);
      for (const row of ordered) await executor.insert(schema.auditLog).values(row);
      return;
    }
    if (table === 'captureDevices' && captureDevicesAsUpsert) {
      // dbc-3 §B.2/D: the engine's write-through adds OR updates a registry row and never deletes
      // one; `dems_app` holds INSERT and UPDATE and no DELETE. An applied device change is
      // therefore an UPSERT on the id key, updating every column the grant list names. The
      // whole-state writers (seed, reset staging) keep the plain INSERT: their table is empty.
      // `kind` is NOT in the SET list: migration 0005 grants `dems_app` no UPDATE on it (a
      // device's kind never changes under its id), and naming it made every update of an
      // existing row fail with 42501 (found by blueprint row 58, the first writer of this path).
      // `adapter_kind` is NOT in the SET list either (dbc-4 §N.2, D-DB-13/D83; row 129 owns this
      // rule): it is written at INSERT, `0009` grants no UPDATE on it, and naming it here would be
      // the D72(f) defect again. It travels in the VALUES list only (M4-MT-12 pins both names out).
      const d = schema.captureDevices;
      for (const row of rows as MappedRows['captureDevices']) {
        await executor
          .insert(d)
          .values(row)
          .onConflictDoUpdate({
            target: d.id,
            set: {
              transport: row.transport,
              model: row.model,
              firmware: row.firmware,
              address: row.address,
              poePort: row.poePort,
              enabled: row.enabled,
              // Row 65 (D72(e), D72(l); pair-58 A-11) owns this rule: `mac`, `onvif_uuid`,
              // `profiles` and `last_seen_at` are NOT in the SET list. The engine state does not
              // model them (`captureDevicesToRows` gives their empty forms), so naming them here
              // blanked what discovery and adoption stored at the camera's first ingest-state
              // change. They travel in the VALUES list only, until a writer that knows them exists.
            },
          });
      }
      return;
    }
    for (let start = 0; start < rows.length; start += INSERT_CHUNK_ROWS) {
      // The rows of `table` are the select shape of exactly that table (`MappedRows`), which the
      // loop over the table keys cannot express in the type of one call.
      await executor.insert(target).values(rows.slice(start, start + INSERT_CHUNK_ROWS) as never);
    }
  } catch (error) {
    throw failed('WRITE_FAILED', TABLE_SQL_NAMES[table], error);
  }
}

// ── The chain lock (AP-2) ──────────────────────────────────────────────────────────────────────

export interface ChainHead {
  readonly seq: number;
  readonly hash: string;
}

/**
 * AP-2: takes the chain lock and returns the head to extend. It blocks while another writer
 * holds the head; the lock is released when the caller's transaction ends. Call it inside a
 * transaction, before any other table is written (AP-7).
 */
export async function lockAuditChain(executor: RowExecutor): Promise<ChainHead> {
  try {
    const result = await executor.execute<{ seq: string | number; hash: string }>(sql`SELECT seq, hash FROM public.audit_chain_lock()`);
    const row = result.rows[0];
    if (row === undefined) throw new StoreError('READ_FAILED', 'audit_chain_head', 'the chain head has no row.');
    return { seq: Number(row.seq), hash: row.hash };
  } catch (error) {
    throw failed('READ_FAILED', 'audit_chain_head', error);
  }
}

// ── Whole-state write ──────────────────────────────────────────────────────────────────────────

/**
 * Inserts the rows of a whole state, in the write order of the contract (§9.5): parents before
 * children, the audit rows one by one in ascending sequence, the events last. The tables must
 * be empty of engine data; `audit_chain_head` is not written (the guard trigger moves it).
 */
export async function writeRows(executor: RowExecutor, rows: MappedRows): Promise<void> {
  for (const table of WRITE_ORDER) await insertInto(executor, table, rows[table]);
}

/** Inserts the three RBAC tables: roles and permissions before the grants that name them. */
export async function writeRbacRows(executor: RowExecutor, rows: RbacRows): Promise<void> {
  try {
    await executor.insert(schema.roles).values(rows.roles);
    await executor.insert(schema.permissions).values(rows.permissions);
    await executor.insert(schema.rolePermissions).values(rows.rolePermissions);
  } catch (error) {
    throw failed('WRITE_FAILED', 'roles, permissions, role_permissions', error);
  }
}

// ── Read ───────────────────────────────────────────────────────────────────────────────────────

export interface ReadOptions {
  /**
   * `newest` (default): the newest 1,000 audit rows, 500 events and 100 alerts, which is what the
   * engine's rings hold (MR-4). `all`: every row of the three tables, for a check over a whole table.
   */
  readonly rings?: 'newest' | 'all';
}

/**
 * Reads the rows `fromRows` needs, in the order of MR-3. Run it inside one transaction (the
 * reader's snapshot then covers every table) or on a database nothing else writes.
 */
export async function readStoredRows(executor: RowExecutor, options: ReadOptions = {}): Promise<StoredRows> {
  const all = options.rings === 'all';
  let table: MappedTable = 'operators';
  try {
    const operators = await executor.select().from(schema.operators).orderBy(asc(schema.operators.id));
    table = 'coreDevice';
    const coreDevice = await executor.select().from(schema.coreDevice);
    table = 'coreState';
    const coreState = await executor.select().from(schema.coreState);
    table = 'storagePolicy';
    const storagePolicy = await executor.select().from(schema.storagePolicy);
    table = 'consoleSettings';
    const consoleSettings = await executor.select().from(schema.consoleSettings);
    table = 'captureDevices';
    const captureDevices = await executor.select().from(schema.captureDevices).orderBy(asc(schema.captureDevices.id));
    table = 'captureConfig';
    const captureConfig = await executor.select().from(schema.captureConfig);
    table = 'engineCounters';
    const engineCounters = await executor.select().from(schema.engineCounters);
    table = 'hardwareSnapshot';
    const hardwareSnapshot = await executor.select().from(schema.hardwareSnapshot);
    table = 'sessionHistory';
    const sessionHistory = await executor
      .select()
      .from(schema.sessionHistory)
      .orderBy(desc(schema.sessionHistory.endedAt), desc(schema.sessionHistory.id));
    table = 'evidenceItems';
    const evidenceItems = await executor
      .select()
      .from(schema.evidenceItems)
      .orderBy(asc(schema.evidenceItems.recordedAt), asc(schema.evidenceItems.id));
    table = 'evidenceTracks';
    const evidenceTracks = await executor
      .select()
      .from(schema.evidenceTracks)
      .orderBy(asc(schema.evidenceTracks.evidenceId), asc(schema.evidenceTracks.position));
    table = 'evidenceCustody';
    const evidenceCustody = await executor
      .select()
      .from(schema.evidenceCustody)
      .orderBy(asc(schema.evidenceCustody.evidenceId), asc(schema.evidenceCustody.seq));
    table = 'activeSession';
    const activeSession = await executor.select().from(schema.activeSession);
    table = 'alerts';
    const alertsQuery = executor.select().from(schema.alerts).orderBy(desc(schema.alerts.at), desc(schema.alerts.id));
    const alerts = await (all ? alertsQuery : alertsQuery.limit(RING_LIMITS.alerts));
    table = 'auditChainHead';
    const auditChainHead = await executor.select().from(schema.auditChainHead);
    table = 'auditLog';
    const auditQuery = executor.select().from(schema.auditLog).orderBy(desc(schema.auditLog.seq));
    const auditLog = await (all ? auditQuery : auditQuery.limit(RING_LIMITS.auditLog));
    table = 'events';
    const eventsQuery = executor.select().from(schema.events).orderBy(desc(schema.events.seq));
    const events = await (all ? eventsQuery : eventsQuery.limit(RING_LIMITS.events));

    return {
      operators,
      coreDevice,
      coreState,
      storagePolicy,
      consoleSettings,
      captureDevices,
      captureConfig,
      engineCounters,
      hardwareSnapshot,
      sessionHistory,
      evidenceItems,
      evidenceTracks,
      evidenceCustody,
      activeSession,
      alerts: alerts.reverse(),
      auditLog: auditLog.reverse(),
      auditChainHead,
      events: events.reverse(),
    };
  } catch (error) {
    throw failed('READ_FAILED', TABLE_SQL_NAMES[table], error);
  }
}

/** Reads the three RBAC tables, in `sort_order`. */
export async function readRbacRows(executor: RowExecutor): Promise<RbacRows> {
  try {
    return {
      roles: await executor.select().from(schema.roles).orderBy(asc(schema.roles.sortOrder)),
      permissions: await executor.select().from(schema.permissions).orderBy(asc(schema.permissions.sortOrder)),
      rolePermissions: await executor.select().from(schema.rolePermissions),
    };
  } catch (error) {
    throw failed('READ_FAILED', 'roles, permissions, role_permissions', error);
  }
}

// ── Write-through ──────────────────────────────────────────────────────────────────────────────

export interface ApplyOptions {
  /**
   * AP-6: the head the engine last committed. When the changes hold audit rows, the head the
   * chain lock returns must equal it; a difference means another writer exists, and nothing is
   * written (`AUDIT_HEAD_DIVERGED`).
   */
  readonly expectedHead?: ChainHead;
}

function keyCondition(table: PgTable, key: object, sqlName: string): SQL {
  const columns = table as unknown as Record<string, PgColumn | undefined>;
  const conditions: SQL[] = [];
  for (const [property, value] of Object.entries(key)) {
    const column = columns[property];
    if (column === undefined) throw new StoreError('WRITE_FAILED', sqlName, `the key names ${property}, which is not a column.`);
    conditions.push(eq(column, value));
  }
  const condition = and(...conditions);
  if (condition === undefined) throw new StoreError('WRITE_FAILED', sqlName, 'an update needs a key.');
  return condition;
}

/**
 * Applies the row changes of one unit of work, in the order given (the mapping returns them in
 * write order). When they hold audit rows, the chain lock is taken first (AP-2, AP-7). An
 * UPDATE names exactly the columns of the change (MR-8) and must hit exactly one row.
 */
export async function applyChanges(executor: RowExecutor, changes: readonly RowChange[], options: ApplyOptions = {}): Promise<void> {
  const appends = changes.some((change) => change.op === 'insert' && change.table === 'auditLog');
  if (appends) {
    const head = await lockAuditChain(executor);
    const expected = options.expectedHead;
    if (expected !== undefined && (head.seq !== expected.seq || head.hash !== expected.hash)) {
      throw new StoreError(
        'AUDIT_HEAD_DIVERGED',
        'audit_chain_head',
        `the stored head is at sequence ${head.seq}, the engine expected ${expected.seq}: another writer exists.`,
      );
    }
  }
  for (const change of changes) {
    const sqlName = TABLE_SQL_NAMES[change.table];
    if (change.op === 'insert') {
      await insertInto(executor, change.table, change.rows, true);
      continue;
    }
    try {
      if (change.op === 'delete') {
        await executor.delete(schema.activeSession);
        continue;
      }
      const table: PgTable = TABLES[change.table];
      const result = await executor
        .update(table)
        .set(change.set as never)
        .where(keyCondition(table, change.key, sqlName));
      if (result.rowCount !== 1) {
        throw new StoreError('ROW_NOT_FOUND', sqlName, `an update changed ${String(result.rowCount)} row(s); it must change exactly one.`);
      }
    } catch (error) {
      throw failed('WRITE_FAILED', sqlName, error);
    }
  }
}

// ── Counts ─────────────────────────────────────────────────────────────────────────────────────

/** The 48 tables of the typed schema (schema v11: v2 + R-8 + T-41 of dbc-4 + T-42 of PE-129b-01 + T-43 of PE-0013-01 + T-44 and T-45 of task 4 set A + T-46 and T-47 of task 4 set B + T-48 of task 4 set C): binding name and SQL name, sorted by SQL name. */
export const ALL_TABLES: ReadonlyArray<{ readonly sqlName: string; readonly table: PgTable }> = [
  ['roles', schema.roles],
  ['permissions', schema.permissions],
  ['role_permissions', schema.rolePermissions],
  ['operators', schema.operators],
  ['operator_credentials', schema.operatorCredentials],
  ['auth_sessions', schema.authSessions],
  ['pairing_codes', schema.pairingCodes],
  ['paired_devices', schema.pairedDevices],
  ['device_credentials', schema.deviceCredentials],
  ['biometric_tokens', schema.biometricTokens],
  ['registry_counters', schema.registryCounters],
  ['audit_log', schema.auditLog],
  ['audit_chain_head', schema.auditChainHead],
  ['events', schema.events],
  ['active_session', schema.activeSession],
  ['session_history', schema.sessionHistory],
  ['evidence_items', schema.evidenceItems],
  ['evidence_tracks', schema.evidenceTracks],
  ['evidence_custody', schema.evidenceCustody],
  ['exports', schema.exportRecords],
  ['alerts', schema.alerts],
  ['storage_policy', schema.storagePolicy],
  ['console_settings', schema.consoleSettings],
  ['engine_counters', schema.engineCounters],
  ['core_device', schema.coreDevice],
  ['core_state', schema.coreState],
  ['hardware_snapshot', schema.hardwareSnapshot],
  ['health_snapshots', schema.healthSnapshots],
  ['schema_meta', schema.schemaMeta],
  ['audit_chain_history', schema.auditChainHistory],
  // Schema v2 (dbc-3 §A.2) and R-8 (T-40): the nine new tables of 0004/0006 and the selector's
  // companions. The seed writes the capture built-ins and `stt_config`; the other six are the
  // recording/transcript/sealing homes the later milestones fill.
  ['capture_devices', schema.captureDevices],
  ['capture_config', schema.captureConfig],
  ['capture_device_credentials', schema.captureDeviceCredentials],
  ['session_audio_intervals', schema.sessionAudioIntervals],
  ['recording_fragments', schema.recordingFragments],
  ['transcript_chunks', schema.transcriptChunks],
  ['transcripts', schema.transcripts],
  ['transcript_revisions', schema.transcriptRevisions],
  ['sealing_jobs', schema.sealingJobs],
  ['stt_config', schema.sttConfig],
  // Schema v3 (dbc-4 §N.3; row 129): the session-start source record.
  ['session_capture_sources', schema.sessionCaptureSources],
  // Schema v5 (erratum PE-129b-01; row 129b): the per-session STT snapshot. Counted here only;
  // the engine's write-through never names it.
  ['session_stt_config', schema.sessionSttConfig],
  // Schema v6 (erratum PE-0013-01; ruling D166): the Core's media store root. Counted here only;
  // the engine's write-through never names it (its one writer is the boot step `media.storeRoot`).
  ['core_media_store', schema.coreMediaStore],
  // Schema v7 (task 4 schema set A; T-44, T-45): the stream facts of a camera profile and the
  // sound-card input of a microphone. Counted here only; the engine's write-through never names them.
  ['capture_device_streams', schema.captureDeviceStreams],
  ['capture_audio_inputs', schema.captureAudioInputs],
  // Schema v8 (task 4 schema set B; T-46, T-47): the network settings of the commissioning
  // functions and the state of a temporary host address. Counted here only; the engine's
  // write-through never names them.
  ['capture_network_config', schema.captureNetworkConfig],
  ['host_network_aliases', schema.hostNetworkAliases],
  // Schema v11 (task 4 schema set C; T-48): the record that an installation was accepted. Counted
  // here only; the engine's write-through never names it (its writer is the acceptance operation).
  ['installation_acceptances', schema.installationAcceptances],
]
  .map(([sqlName, table]) => ({ sqlName: sqlName as string, table: table as PgTable }))
  .sort((a, b) => (a.sqlName < b.sqlName ? -1 : 1));

/** The row count of each of the 48 tables, by SQL name. */
export async function countAllTables(executor: RowExecutor): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const { sqlName, table } of ALL_TABLES) {
    try {
      const result = await executor.select({ rows: sql<string>`count(*)` }).from(table);
      counts[sqlName] = Number(result[0]?.rows ?? 0);
    } catch (error) {
      throw failed('READ_FAILED', sqlName, error);
    }
  }
  return counts;
}
