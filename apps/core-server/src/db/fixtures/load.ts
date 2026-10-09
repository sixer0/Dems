/**
 * The loader of the bulk fixture (plan row W25; database contract §11, BF-1, BF-2, BF-5, BF-6,
 * TI-13, §6.4).
 *
 *   loadBulkFixture(pool, { now, seed?, activeSession?, log? })  ->  BulkFixtureReport
 *
 * `pool` is an OWNER pool on a TEST database that holds the seed and nothing else. The loader
 * is a library function: there is no command for it, because it never runs on a project
 * database.
 *
 * ORDER OF THE CHECKS.
 *   1. The NAME, before anything is sent: the database the pool is configured for must be a test
 *      database of the helper (`target.ts`). `dems_demo`, a lane and the maintenance database
 *      are refused here, with no connection opened.
 *   2. The session: role `dems_owner`, not a superuser; the database the session is really on
 *      must be the one that was named.
 *   3. The schema version this code writes.
 *
 * ONE TRANSACTION, READ COMMITTED (AP-1). Its first statement takes the chain lock (AP-2, AP-7).
 * Then it reads the base through the one mapping (`readStoredRows`, `fromRows`), builds the
 * rows (`build.ts`, pure), and writes them parents before children. The audit rows go through
 * the guard trigger like every writer's: one INSERT per row in ascending sequence (AP-4), by the
 * same `insertRows` the seed uses. No trigger is switched off and no audit row is ever updated.
 * At the end the stored chain head must be the head the builder expects, or everything is
 * rolled back.
 *
 * Statements carry values as bind parameters only. A failure names the table, the SQLSTATE and
 * the constraint, never a value of a row: the driver's own message can quote a statement with
 * its parameters, so it is not passed on.
 */
import { performance } from 'node:perf_hooks';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { Pool } from 'pg';
import { readSchemaVersion } from '../commands/migrations';
import { verifyOwnerSession } from '../commands/owner-connection';
import { MappingError, fromRows, type RowChange } from '../mapping';
import * as schema from '../schema';
import { DB_CONTRACT_REVISION, DB_SCHEMA_VERSION } from '../schema';
import { ALL_TABLES, StoreError, applyChanges, countAllTables, insertRows, lockAuditChain, readStoredRows, type RowExecutor } from '../store';
import { buildBulkFixture, type BulkFixture } from './build';
import { formatBulkFixtureReport, minimumReport, type BulkFixtureReport } from './report';
import { BulkFixtureError, assertBulkFixtureTarget, configuredDatabase } from './target';
import type { BulkBase, BulkFixtureOptions } from './world';

export interface LoadBulkFixtureOptions extends BulkFixtureOptions {
  /** Receives each line of the report. Default: nothing is printed. */
  readonly log?: (line: string) => void;
}

/** Rows per INSERT statement: far below the driver's limit of 65,535 bind parameters. */
const INSERT_CHUNK_ROWS = 500;

/** The SQLSTATE and constraint of a failure. Drizzle wraps the driver error: they are on `cause`. */
function serverAnswer(error: unknown): { sqlState: string | undefined; constraint: string | undefined } {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && typeof current === 'object' && current !== null; depth += 1) {
    const candidate = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (typeof candidate.code === 'string') {
      return { sqlState: candidate.code, constraint: typeof candidate.constraint === 'string' ? candidate.constraint : undefined };
    }
    current = candidate.cause;
  }
  return { sqlState: undefined, constraint: undefined };
}

function writeFailure(table: string, error: unknown): BulkFixtureError {
  if (error instanceof BulkFixtureError) return error;
  if (error instanceof StoreError) return new BulkFixtureError('WRITE_FAILED', `the bulk fixture was not written: ${error.message}`);
  const { sqlState, constraint } = serverAnswer(error);
  const detail =
    sqlState === undefined
      ? 'the statement failed before the server answered.'
      : `the server answered ${sqlState}${constraint === undefined ? '' : ` (constraint ${constraint})`}.`;
  return new BulkFixtureError('WRITE_FAILED', `the bulk fixture was not written: ${table}: ${detail}`);
}

/** Inserts rows of a server-native table (no mapped table of the store), in chunks. */
async function insertNative(executor: RowExecutor, table: PgTable, sqlName: string, rows: readonly object[]): Promise<void> {
  try {
    for (let start = 0; start < rows.length; start += INSERT_CHUNK_ROWS) {
      // The rows of each call are the insert shape of exactly that table (`BulkFixtureRows`).
      await executor.insert(table).values(rows.slice(start, start + INSERT_CHUNK_ROWS) as never);
    }
  } catch (error) {
    throw writeFailure(sqlName, error);
  }
}

/** What the builder needs to know about the seeded database, read inside the transaction. */
async function readBase(executor: RowExecutor): Promise<BulkBase> {
  const state = await executor.select({ seededAt: schema.coreState.seededAt }).from(schema.coreState);
  const seeded = state[0];
  if (state.length !== 1 || seeded === undefined) {
    throw new BulkFixtureError('NOT_SEEDED', 'the database holds no seed. The bulk fixture is loaded on top of a seeded database: clone the seed template.');
  }
  let slices: BulkBase['slices'];
  try {
    slices = fromRows(await readStoredRows(executor, { rings: 'all' }));
  } catch (error) {
    if (error instanceof MappingError || error instanceof StoreError) {
      throw new BulkFixtureError('BASE_UNEXPECTED', `the seeded database could not be read back: ${error.message}`);
    }
    throw error;
  }
  // The Core's identity, as the pairing module reads it for the row of a pairing.
  const core = await executor.select({ certificateFingerprint: schema.coreDevice.certificateFingerprint }).from(schema.coreDevice);
  const identity = core[0];
  if (core.length !== 1 || identity === undefined) throw new BulkFixtureError('BASE_UNEXPECTED', 'the table core_device does not hold its one row.');
  const registry = await executor.select().from(schema.registryCounters);
  const counter = (name: 'device' | 'pairingCode'): number => {
    const row = registry.find((candidate) => candidate.name === name);
    if (row === undefined) throw new BulkFixtureError('BASE_UNEXPECTED', `the registry counter ${name} has no row.`);
    return row.nextValue;
  };
  return {
    slices,
    seededAt: seeded.seededAt,
    certificateFingerprint: identity.certificateFingerprint,
    registryCounters: { device: counter('device'), pairingCode: counter('pairingCode') },
    counts: await countAllTables(executor),
  };
}

/** Writes a built fixture inside the caller's transaction, parents before children. */
async function writeBulkFixture(executor: RowExecutor, fixture: BulkFixture, base: BulkBase): Promise<void> {
  const { rows, updates } = fixture;
  try {
    // Operators first: almost every other row names one.
    await insertRows(executor, 'operators', rows.operators);
    await insertNative(executor, schema.operatorCredentials, 'operator_credentials', rows.operatorCredentials);
    for (const signIn of updates.operatorSignIns) {
      try {
        await executor.update(schema.operators).set({ lastSignInAt: signIn.lastSignInAt }).where(eq(schema.operators.id, signIn.id));
      } catch (error) {
        throw writeFailure('operators', error);
      }
    }

    // Pairing: codes before the devices they paired, devices before what names them.
    await insertNative(executor, schema.pairingCodes, 'pairing_codes', rows.pairingCodes);
    await insertNative(executor, schema.pairedDevices, 'paired_devices', rows.pairedDevices);
    await insertNative(executor, schema.deviceCredentials, 'device_credentials', rows.deviceCredentials);
    await insertNative(executor, schema.authSessions, 'auth_sessions', rows.authSessions);
    await insertNative(executor, schema.biometricTokens, 'biometric_tokens', rows.biometricTokens);
    // Schema v2 (dbc-3 §G): the discovered capture devices before any row that names a mic, and
    // their write-only credentials (the fake cameras only; the reveal path is the reader).
    await insertNative(executor, schema.captureDevices, 'capture_devices', rows.captureDevices);
    await insertNative(executor, schema.captureDeviceCredentials, 'capture_device_credentials', rows.captureDeviceCredentials);
    for (const row of updates.registryCounters) {
      try {
        await executor.update(schema.registryCounters).set({ nextValue: row.nextValue }).where(eq(schema.registryCounters.name, row.name));
      } catch (error) {
        throw writeFailure('registry_counters', error);
      }
    }

    // The engine's counters and the state row, as changes of the one mapping.
    const seeded = base.slices.meta.counters;
    const changes: RowChange[] = [];
    for (const row of updates.engineCounters) {
      // The `export` counter has no row until the first export: it is inserted, the others move.
      if (seeded[row.name] === undefined) changes.push({ op: 'insert', table: 'engineCounters', rows: [row] });
      else changes.push({ op: 'update', table: 'engineCounters', key: { name: row.name }, set: { nextValue: row.nextValue } });
    }
    if (updates.coreState !== null) changes.push({ op: 'update', table: 'coreState', key: { singleton: true }, set: updates.coreState });
    await applyChanges(executor, changes);

    // Recordings: sessions before their evidence, evidence before its tracks and custody (MR-6).
    await insertRows(executor, 'sessionHistory', rows.sessionHistory);
    await insertRows(executor, 'evidenceItems', rows.evidenceItems);
    await insertRows(executor, 'evidenceTracks', rows.evidenceTracks);
    await insertRows(executor, 'evidenceCustody', rows.evidenceCustody);
    await insertRows(executor, 'exportRecords', rows.exportRecords);
    await insertRows(executor, 'activeSession', rows.activeSession);
    // The v2 pipeline (CS-20): intervals and fragments and chunks hang on session ids only
    // (D-DB-07); transcripts and revisions on the evidence items inserted above; the jobs on the
    // sealed sessions. All parents exist by now; the chain rows follow, as always, last.
    // The session-start source record first (dbc-4 MR-S1: durable before the first fragment).
    await insertNative(executor, schema.sessionCaptureSources, 'session_capture_sources', rows.sessionCaptureSources);
    await insertNative(executor, schema.sessionAudioIntervals, 'session_audio_intervals', rows.sessionAudioIntervals);
    await insertNative(executor, schema.recordingFragments, 'recording_fragments', rows.recordingFragments);
    await insertNative(executor, schema.transcriptChunks, 'transcript_chunks', rows.transcriptChunks);
    await insertNative(executor, schema.transcripts, 'transcripts', rows.transcripts);
    await insertNative(executor, schema.transcriptRevisions, 'transcript_revisions', rows.transcriptRevisions);
    await insertNative(executor, schema.sealingJobs, 'sealing_jobs', rows.sealingJobs);
    await insertRows(executor, 'alerts', rows.alerts);
    await insertNative(executor, schema.healthSnapshots, 'health_snapshots', rows.healthSnapshots);
    // The lineage is append-only for every role: these are plain INSERTs, as the reset routine issues them.
    await insertNative(executor, schema.auditChainHistory, 'audit_chain_history', rows.auditChainHistory);

    // AP-4: one INSERT per audit row, in ascending sequence, through the guard trigger.
    await insertRows(executor, 'auditLog', rows.auditLog);
    await insertRows(executor, 'events', rows.events);

    // The guard moved the head with every row: it must now be the head the builder expects.
    const after = await executor.select().from(schema.auditChainHead);
    const stored = after[0];
    if (after.length !== 1 || stored === undefined || stored.seq !== fixture.expectedHead.seq || stored.hash !== fixture.expectedHead.hash) {
      throw new BulkFixtureError(
        'VERIFY_FAILED',
        `after the load the chain head is at sequence ${stored?.seq ?? 'none'}; the fixture ends at ${fixture.expectedHead.seq}.`,
      );
    }
  } catch (error) {
    throw writeFailure('a table of the fixture', error);
  }
}

/**
 * Loads the bulk fixture into the test database `pool` is connected to, on top of its seed, and
 * returns the row counts against the contract's minimums. Everything is one transaction: when
 * it throws, the database is as it was.
 */
export async function loadBulkFixture(pool: Pool, options: LoadBulkFixtureOptions): Promise<BulkFixtureReport> {
  // 1. The name, before a connection is opened or a statement is sent (BF-1, TI-13).
  const target = assertBulkFixtureTarget(configuredDatabase(pool));
  const started = performance.now();

  // 2. Who the session is, and where it really is.
  const session = await verifyOwnerSession(pool);
  if (session.database !== target) {
    throw new BulkFixtureError('TARGET_REFUSED', 'refused: the session is not on the database the pool was configured for.');
  }
  assertBulkFixtureTarget(session.database);

  // 3. The schema this code writes.
  const version = await readSchemaVersion(pool);
  if (version === null) throw new BulkFixtureError('NOT_MIGRATED', `the database ${target} has no schema: clone the seed template.`);
  if (version.schemaVersion !== DB_SCHEMA_VERSION || version.contractRevision !== DB_CONTRACT_REVISION) {
    throw new BulkFixtureError(
      'NOT_MIGRATED',
      `the database ${target} is at schema version ${version.schemaVersion} (${version.contractRevision}); the fixture writes version ${DB_SCHEMA_VERSION} (${DB_CONTRACT_REVISION}).`,
    );
  }

  let builtAt = started;
  const fixture = await drizzle(pool).transaction(async (transaction) => {
    // AP-2, AP-7: the chain lock is the first statement of a transaction that appends.
    await lockAuditChain(transaction);
    const base = await readBase(transaction);
    const built = buildBulkFixture(options, base);
    builtAt = performance.now();
    await writeBulkFixture(transaction, built, base);
    return built;
  });
  const writtenAt = performance.now();

  const counts = await countAllTables(drizzle(pool));
  // The counts the builder announced are the counts the tables hold, or the load is not what it says.
  const differing = Object.keys(fixture.expectedCounts).filter((table) => counts[table] !== fixture.expectedCounts[table]);
  if (differing.length > 0) {
    throw new BulkFixtureError('VERIFY_FAILED', `after the load the row counts of ${differing.join(', ')} are not the counts the fixture built.`);
  }
  const report: BulkFixtureReport = {
    database: session.database,
    role: session.role,
    now: fixture.now,
    seed: fixture.seed,
    activeSession: fixture.activeSession,
    counts,
    added: fixture.added,
    ...minimumReport(counts),
    auditHead: fixture.expectedHead,
    digest: fixture.digest,
    buildMs: builtAt - started,
    writeMs: writtenAt - builtAt,
    totalMs: performance.now() - started,
  };
  if (options.log !== undefined) for (const line of formatBulkFixtureReport(report)) options.log(line);
  return report;
}

/**
 * Vacuums and analyzes the 42 tables, in one statement that names the tables of the typed schema
 * (constants). It changes no row. Two reasons:
 *
 *   - A template is locked right after its hook returns, so nothing would ever analyze it:
 *     without this, a clone plans its queries on thousands of rows with the statistics of an
 *     empty table, and reads every page without a visibility map.
 *   - A database that has just taken thousands of inserts is the first one the autovacuum
 *     launcher sends a worker to, and the worker stays while it has work. The owner role may not
 *     end that worker, so a forced drop of the database is refused while it is connected. After
 *     this statement the worker finds nothing to do.
 */
export async function vacuumFixtureTables(pool: Pool): Promise<void> {
  assertBulkFixtureTarget(configuredDatabase(pool));
  await pool.query(`VACUUM (ANALYZE) ${ALL_TABLES.map(({ sqlName }) => `public.${sqlName}`).join(', ')}`);
}
