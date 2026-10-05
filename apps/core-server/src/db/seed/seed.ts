/**
 * The seed program (plan row W20; hand-built element HB-2; database contract §9; spec ENG-17,
 * SR-62, SR-63).
 *
 * It builds the shared simulator's initial dataset as of one instant, maps it with the one
 * mapping module, and writes it into a freshly migrated database in ONE transaction, as the
 * owner role `dems_owner`:
 *
 *   prepareSeed   pure work and the three password hashes, before any transaction is open;
 *   writeSeed     the statements, inside the caller's transaction (the reset routine calls it
 *                 inside its own, with its carry-over, R-5);
 *   seedDatabase  the whole thing on an owner pool: checks, prepare, one transaction, counts.
 *
 * THE AUDIT CHAIN. The 82 audit rows of the dataset are written exactly as the shared replay
 * built them (`seq`, `prev_hash`, `hash`); nothing is hashed again (SD-6). They go through the
 * append protocol like any other writer's rows: the chain lock (AP-2), then one INSERT per row
 * in ascending sequence (AP-4). The guard trigger, which binds the owner as it binds every role,
 * accepts each row because it continues the head, and moves the head; after the last row the
 * head is the dataset's own head, which `writeSeed` verifies before it returns. No trigger is
 * switched off and no row is ever updated: a first seed needs neither.
 *
 * THE CHAIN LOCK IS TAKEN FIRST. The contract's seed order (§9.5) takes it after the other
 * tables, because nothing else can reach the database yet. Taking it as the first statement
 * (AP-2, AP-7 as written) changes no table order and makes two seeds of one database queue: the
 * second one then sees a chain that is not at its genesis and is refused, with nothing written.
 *
 * IDEMPOTENCE. A database whose `core_state` has a row, or whose chain is not at its genesis,
 * is refused before a row is written (SD-3). Seeding again is a reset (`db:reset`): the audit
 * table is append-only, so an in-place second seed is impossible by design.
 *
 * THE DEMO PASSWORD (SD-4, SR-63). The published demo password is read by import and handed to
 * `hashPassword`, once per operator, and to nothing else. What reaches a statement is the
 * Argon2id record (salt, hash, three cost parameters), as bind parameters. The password is in
 * no statement, no row, no message and no output of this program.
 */
import { performance } from 'node:perf_hooks';
import { DEMO_OPERATOR_PASSWORD, GENESIS_HASH, type SimState } from '@dems/shared/sim';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { PROJECT_DATABASES, TEST_DATABASE_PATTERN } from '../commands/database-names';
import { readSchemaVersion } from '../commands/migrations';
import { verifyOwnerSession } from '../commands/owner-connection';
import { hashPassword, type PasswordHashRecord } from '../../modules/identity/password-hash';
import {
  MappingError,
  WRITE_ORDER,
  assertCompleteRings,
  rbacRows,
  toRows,
  type MappedRows,
  type RbacRows,
} from '../mapping';
import * as schema from '../schema';
import { DB_CONTRACT_REVISION, DB_SCHEMA_VERSION } from '../schema';
import { REGISTRY_COUNTER, type NewOperatorCredentialRow, type RegistryCounterRow } from '../schema';
import { DatasetOptionError, buildSeedState, resolveDatasetOptions, type DatasetOptions, type ResolvedDatasetOptions } from './dataset';
import { StoreError, countAllTables, insertRows, lockAuditChain, writeRbacRows, type ChainHead, type RowExecutor } from '../store';

export type SeedErrorCode =
  | 'TARGET_REFUSED'
  | 'NOT_MIGRATED'
  | 'SCHEMA_VERSION'
  | 'ALREADY_SEEDED'
  | 'DATASET_INVALID'
  | 'HASH_FAILED'
  | 'WRITE_FAILED'
  | 'VERIFY_FAILED';

/** A refused or failed seed. `message` is safe to print: it never holds a credential or a row value. */
export class SeedError extends Error {
  readonly code: SeedErrorCode;

  constructor(code: SeedErrorCode, message: string) {
    super(message);
    this.name = 'SeedError';
    this.code = code;
  }
}

/** The suffix of the staging database a reset builds beside its target (contract §8.5, R-4). */
export const STAGING_SUFFIX = '_next';

/**
 * `project`: the command line and the reset routine; the target is a project database or the
 * staging copy of one. `test`: a test or a template hook; the target must be a test database
 * (TI-13), so a test can never seed `dems_demo` or a lane.
 */
export type SeedTarget = 'project' | 'test';

export interface SeedOptions extends DatasetOptions {
  /** `core_state.last_reset_at`. Default null: a first seed. The reset passes its `now`. */
  readonly lastResetAt?: number | null;
}

export interface SeedDependencies {
  /** The password hasher. Default: the Argon2id wrapper of the identity module. */
  readonly hashPassword?: (password: string) => Promise<PasswordHashRecord>;
}

/** Everything a seed writes, built before a transaction is open. Holds hash records, never a password. */
export interface PreparedSeed {
  readonly options: ResolvedDatasetOptions & { readonly lastResetAt: number | null };
  readonly state: SimState;
  readonly rbac: RbacRows;
  readonly rows: MappedRows;
  readonly credentials: NewOperatorCredentialRow[];
  readonly registryCounters: RegistryCounterRow[];
  /** The head the chain must have after the last audit row. */
  readonly expectedHead: ChainHead;
}

/** A project database, the staging copy of one, or (for `test`) a test database. */
export function assertSeedTarget(database: string, target: SeedTarget): void {
  if (target === 'test') {
    if (TEST_DATABASE_PATTERN.test(database)) return;
    throw new SeedError('TARGET_REFUSED', 'refused: a seed called by a test writes only a test database (its name starts with dems_test_).');
  }
  const project: readonly string[] = PROJECT_DATABASES;
  const base = database.endsWith(STAGING_SUFFIX) ? database.slice(0, -STAGING_SUFFIX.length) : database;
  if (project.includes(base)) return;
  throw new SeedError(
    'TARGET_REFUSED',
    `refused: the seed writes only ${PROJECT_DATABASES.join(', ')} or the staging copy of one; this session is on another database.`,
  );
}

/**
 * Builds the dataset for `options.now`, maps it, and derives the three operators' hash records.
 * No database is touched. The Argon2id derivations (about 20 ms each) run here, so that the
 * transaction of `writeSeed` holds the chain lock only while it writes.
 */
export async function prepareSeed(options: SeedOptions, dependencies: SeedDependencies = {}): Promise<PreparedSeed> {
  let resolved: ResolvedDatasetOptions;
  let state: SimState;
  let rows: MappedRows;
  const lastResetAt = options.lastResetAt ?? null;
  try {
    resolved = resolveDatasetOptions(options);
    state = buildSeedState(resolved);
    // The tables keep every audit row and event: the dataset must hold its whole chain.
    assertCompleteRings(state);
    rows = toRows(state, { at: resolved.now, seededAt: resolved.now, lastResetAt });
  } catch (error) {
    if (error instanceof DatasetOptionError || error instanceof MappingError) throw new SeedError('DATASET_INVALID', error.message);
    throw error;
  }

  // SD-4: one derivation per operator, each with a fresh random salt. The password constant is
  // used here and nowhere else.
  const hasher = dependencies.hashPassword ?? hashPassword;
  const credentials: NewOperatorCredentialRow[] = [];
  for (const operator of rows.operators) {
    let record: PasswordHashRecord;
    try {
      record = await hasher(DEMO_OPERATOR_PASSWORD);
    } catch (error) {
      // The hasher's error carries a code only; nothing of the input is passed on.
      const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : 'UNKNOWN';
      throw new SeedError('HASH_FAILED', `the password hash of operator ${operator.id} could not be derived (${code}).`);
    }
    credentials.push({
      operatorId: operator.id,
      algorithm: record.algorithm,
      memoryKib: record.memoryKib,
      passes: record.passes,
      parallelism: record.parallelism,
      salt: record.salt,
      hash: record.hash,
      hashedAt: resolved.now,
    });
  }

  const head = rows.auditChainHead[0];
  if (head === undefined) throw new SeedError('DATASET_INVALID', 'the dataset has no chain head.');
  return {
    options: { ...resolved, lastResetAt },
    state,
    rbac: rbacRows(),
    rows,
    credentials,
    // The two registry counters have no dataset entity: both start at 1 (contract §4.11).
    registryCounters: REGISTRY_COUNTER.map((name) => ({ name, nextValue: 1 })),
    expectedHead: { seq: head.seq, hash: head.hash },
  };
}

function writeFailure(error: unknown): unknown {
  return error instanceof StoreError ? new SeedError('WRITE_FAILED', `the seed was not written: ${error.message}`) : error;
}

/**
 * Writes a prepared seed inside the caller's transaction (READ COMMITTED, AP-1). It commits
 * nothing: when it throws, the caller rolls back and the database is as it was.
 *
 * Order: the chain lock; the "not seeded yet" check; then the tables of contract §9.5, that is
 * roles, permissions, role_permissions, operators, operator_credentials, core_device,
 * core_state, storage_policy, console_settings, engine_counters, registry_counters,
 * hardware_snapshot, session_history, evidence_items, evidence_tracks, evidence_custody,
 * exports, active_session and alerts (scenarios only), audit_log in ascending sequence, events.
 * `audit_chain_history` is never written here: a first seed discards nothing (LN-1).
 */
export async function writeSeed(executor: RowExecutor, prepared: PreparedSeed): Promise<void> {
  try {
    // AP-2: the first statement of a transaction that appends.
    const head = await lockAuditChain(executor);
    const seeded = await executor.select({ rows: sql<string>`count(*)` }).from(schema.coreState);
    if (Number(seeded[0]?.rows ?? 0) !== 0 || head.seq !== 0 || head.hash !== GENESIS_HASH) {
      throw new SeedError(
        'ALREADY_SEEDED',
        `the database is already seeded (the audit chain holds ${head.seq} row(s)). Nothing was written. Seeding again is a reset.`,
      );
    }

    await writeRbacRows(executor, prepared.rbac);
    for (const table of WRITE_ORDER) {
      await insertRows(executor, table, prepared.rows[table]);
      if (table === 'operators') {
        try {
          await executor.insert(schema.operatorCredentials).values(prepared.credentials);
        } catch {
          // No detail of the failed statement is passed on: its parameters are the hash records.
          throw new StoreError('WRITE_FAILED', 'operator_credentials', 'the statement was refused.');
        }
      }
      if (table === 'engineCounters') {
        try {
          await executor.insert(schema.registryCounters).values(prepared.registryCounters);
        } catch {
          throw new StoreError('WRITE_FAILED', 'registry_counters', 'the statement was refused.');
        }
      }
    }

    // The guard trigger moved the head with every row: it must now be the dataset's own head.
    const after = await executor.select().from(schema.auditChainHead);
    const stored = after[0];
    if (after.length !== 1 || stored === undefined || stored.seq !== prepared.expectedHead.seq || stored.hash !== prepared.expectedHead.hash) {
      throw new SeedError(
        'VERIFY_FAILED',
        `after the seed the chain head is at sequence ${stored?.seq ?? 'none'}; the dataset ends at ${prepared.expectedHead.seq}.`,
      );
    }
  } catch (error) {
    throw writeFailure(error);
  }
}

export interface SeedReport {
  readonly database: string;
  readonly role: string;
  readonly serverVersion: string;
  readonly now: number;
  readonly seed: number;
  readonly scenario: string;
  readonly epoch: number;
  /** The row count of each of the 30 tables after the commit, by SQL name. */
  readonly counts: Readonly<Record<string, number>>;
  readonly auditHead: ChainHead;
  /** Milliseconds: building and mapping the dataset with the three hashes; the transaction; both with the checks. */
  readonly prepareMs: number;
  readonly writeMs: number;
  readonly totalMs: number;
}

export interface SeedDatabaseOptions extends SeedOptions {
  readonly target: SeedTarget;
}

/**
 * Seeds the database `pool` is connected to. `pool` is an OWNER pool: the session must be
 * `dems_owner` and must not be a superuser (the same check the reset routine makes at R-0).
 *
 * Checks before anything is built: the role; the database name (`target`); the schema version
 * (a database that is not migrated is refused with the migrate command); "not seeded yet".
 * Then `prepareSeed`, ONE transaction with `writeSeed`, and the row counts of all 30 tables.
 */
export async function seedDatabase(pool: Pool, options: SeedDatabaseOptions, dependencies: SeedDependencies = {}): Promise<SeedReport> {
  const started = performance.now();
  const session = await verifyOwnerSession(pool);
  assertSeedTarget(session.database, options.target);

  const version = await readSchemaVersion(pool);
  if (version === null) {
    throw new SeedError(
      'NOT_MIGRATED',
      `the database ${session.database} has no schema. Apply the migrations first: npm run db:migrate -w @dems/core-server -- --database <name>`,
    );
  }
  if (version.schemaVersion !== DB_SCHEMA_VERSION || version.contractRevision !== DB_CONTRACT_REVISION) {
    throw new SeedError(
      'SCHEMA_VERSION',
      `the database ${session.database} is at schema version ${version.schemaVersion} (${version.contractRevision}); this seed writes version ${DB_SCHEMA_VERSION} (${DB_CONTRACT_REVISION}).`,
    );
  }

  // A cheap first look, so that an already seeded database costs no password derivation. The
  // binding check is the one inside the transaction, under the chain lock.
  const existing = await pool.query<{ seeded_at: string }>('SELECT seeded_at FROM public.core_state');
  const existingRow = existing.rows[0];
  if (existingRow !== undefined) {
    throw new SeedError(
      'ALREADY_SEEDED',
      `the database ${session.database} is already seeded (seeded_at ${new Date(Number(existingRow.seeded_at)).toISOString()}). Nothing was written. Seeding again is a reset.`,
    );
  }

  const prepared = await prepareSeed(options, dependencies);
  const preparedAt = performance.now();

  await drizzle(pool).transaction(async (transaction) => {
    await writeSeed(transaction, prepared);
  });
  const writtenAt = performance.now();

  const counts = await countAllTables(drizzle(pool));
  return {
    database: session.database,
    role: session.role,
    serverVersion: session.serverVersion,
    now: prepared.options.now,
    seed: prepared.options.seed,
    scenario: prepared.options.scenario,
    epoch: prepared.options.epoch,
    counts,
    auditHead: prepared.expectedHead,
    prepareMs: preparedAt - started,
    writeMs: writtenAt - preparedAt,
    totalMs: performance.now() - started,
  };
}
