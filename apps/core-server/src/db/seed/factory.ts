/**
 * `db:seed --factory`: the FACTORY seed — what a database of a unit leaving the workshop holds
 * (PT GSP's ruling of 30 Oct 2026; the demonstration seed of `seed.ts` is unchanged).
 *
 *   npm run db:seed -w @dems/core-server -- --database <name> --factory
 *
 * It writes the minimum a Core needs to boot and to be set up on site, and NOTHING of the
 * demonstration dataset:
 *
 *   roles, permissions, role_permissions   the shared vocabulary (`rbacRows`), unchanged;
 *   operators                              the two vendor identities of `FACTORY_OPERATORS`;
 *   operator_credentials                   NO ROW. A factory account is born without a password:
 *                                          the published demo password is what boot check 4c of a
 *                                          REAL_PRODUCTION Core counts (`CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION`,
 *                                          S99-01), and the only writer of a credential is the
 *                                          command a human types (`operator:set-password`), which
 *                                          since decision D56 (2026-11-03) CREATES this row as the
 *                                          first thing it writes for such an account. A hash
 *                                          of a thrown-away random value was the other candidate;
 *                                          it would have made an unusable row that still has to be
 *                                          replaced by that command, so the seed writes none.
 *                                          Sign-in reads `operators JOIN operator_credentials`, so
 *                                          an operator with no credential simply cannot sign in.
 *   core_device, core_state,               the configuration singletons of this unit: the state's
 *   storage_policy, console_settings,      own values (the neutral state of the client layer), the
 *   stt_config, engine_counters,           `stt_config` row boot needs (STT_CONFIG_NOT_SEEDED), the
 *   registry_counters, hardware_snapshot,  counters at their first value;
 *   capture_devices, capture_config
 *   session_history, evidence_items,       ZERO ROWS each — the tables of the demonstration
 *   evidence_tracks, evidence_custody,     dataset are not written, not written with another actor
 *   exports, active_session, alerts,       in front of them, and not emptied after a demo seed
 *   audit_log, events                      (which would break the append-only chain).
 *
 * THE CHAIN STAYS AT ITS GENESIS: the seed appends no audit row, so `audit_chain_head` keeps
 * `seq = 0` / the genesis hash, which boot check B-7 accepts for an empty log, and B-6 accepts the
 * one `core_state` row. The guard trigger is never switched off.
 *
 * The unit's name comes from the Core's own environment keys — `DEMS_INSTALLATION_DEVICE_ID`,
 * `DEMS_INSTALLATION_NAME` and `DEMS_DEVICE_CERT_FINGERPRINT` (the fingerprint the pairing screen
 * shows) — parsed by the same functions the server parses them with, and refused when missing:
 * a unit whose identity is unknown is not seeded with the demonstration identity instead.
 *
 * Idempotence, exit codes and the owner-role rules are the demonstration seed's: a database with a
 * `core_state` row is refused before anything is written (a rebuild is a `db:reset`).
 */
import { performance } from 'node:perf_hooks';
import { GENESIS_HASH, createFactoryState, type FactoryIdentityInput, type SimState } from '@dems/shared/sim';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { ENV_INSTALLATION_DEVICE_ID, ENV_INSTALLATION_NAME, ConfigError, parseInstallationDeviceId, parseInstallationName } from '../../config';
import { isReservedInstallationId } from '../../capture/boot/checks';
import { readSchemaVersion } from '../commands/migrations';
import { verifyOwnerSession } from '../commands/owner-connection';
import { MappingError, WRITE_ORDER, assertCompleteRings, rbacRows, toRows, type MappedRows, type RbacRows } from '../mapping';
import * as schema from '../schema';
import { DB_CONTRACT_REVISION, DB_SCHEMA_VERSION } from '../schema';
import { REGISTRY_COUNTER, type RegistryCounterRow } from '../schema';
import { SEED_DEMO_NOT_ASKED, type SeedDemoPlacement, type SeedDemoReport } from './demo-packages';
import { assertSeedTarget, sttConfigSeedRow, type SeedReport, type SeedTarget } from './seed';
import { StoreError, countAllTables, insertRows, lockAuditChain, writeRbacRows, type ChainHead, type RowExecutor } from '../store';

/** The environment key of the certificate fingerprint the pairing screen shows. Factory seed only. */
export const ENV_DEVICE_CERT_FINGERPRINT = 'DEMS_DEVICE_CERT_FINGERPRINT';
/** The form of a shown fingerprint: 16 byte pairs of the certificate digest, colon-separated. */
export const CERT_FINGERPRINT_PATTERN = /^([0-9A-F]{2}:){15}[0-9A-F]{2}$/;

export type FactorySeedErrorCode =
  | 'TARGET_REFUSED'
  | 'NOT_MIGRATED'
  | 'SCHEMA_VERSION'
  | 'ALREADY_SEEDED'
  | 'IDENTITY_MISSING'
  | 'IDENTITY_INVALID'
  | 'DATASET_INVALID'
  | 'WRITE_FAILED'
  | 'VERIFY_FAILED';

/** A refused or failed factory seed. `message` names a key, a table or a number — never a credential. */
export class FactorySeedError extends Error {
  readonly code: FactorySeedErrorCode;

  constructor(code: FactorySeedErrorCode, message: string) {
    super(message);
    this.name = 'FactorySeedError';
    this.code = code;
  }
}

/** Why the environment of this command does not name a unit: the keys it is missing or holds wrong. */
export interface FactoryIdentityProblem {
  readonly code: 'IDENTITY_MISSING' | 'IDENTITY_INVALID';
  readonly keys: readonly string[];
}

export type FactoryIdentityAnswer = { readonly ok: true; readonly identity: FactoryIdentityInput } | { readonly ok: false; readonly problem: FactoryIdentityProblem };

/**
 * The unit identity of a factory seed, read from the keys the Core itself is configured with. The
 * two installation keys go through the server's own parsers, so the seed refuses exactly what the
 * boot would refuse; a reserved id (the tests', the demonstration data's, the documentation's) is
 * refused here too, because writing it into `core_device` would name a factory unit after the demo.
 */
export function factoryIdentityOfEnvironment(environment: Readonly<Record<string, string | undefined>>): FactoryIdentityAnswer {
  const missing = [ENV_INSTALLATION_DEVICE_ID, ENV_INSTALLATION_NAME, ENV_DEVICE_CERT_FINGERPRINT].filter((key) => (environment[key] ?? '') === '');
  if (missing.length > 0) return { ok: false, problem: { code: 'IDENTITY_MISSING', keys: missing } };
  let deviceId: string | null = null;
  let name: string | null = null;
  try {
    deviceId = parseInstallationDeviceId(environment[ENV_INSTALLATION_DEVICE_ID]);
    name = parseInstallationName(environment[ENV_INSTALLATION_NAME]);
  } catch (error) {
    const key = error instanceof ConfigError && error.message.startsWith(ENV_INSTALLATION_NAME) ? ENV_INSTALLATION_NAME : ENV_INSTALLATION_DEVICE_ID;
    return { ok: false, problem: { code: 'IDENTITY_INVALID', keys: [key] } };
  }
  if (deviceId === null || name === null) return { ok: false, problem: { code: 'IDENTITY_MISSING', keys: [ENV_INSTALLATION_DEVICE_ID, ENV_INSTALLATION_NAME] } };
  if (isReservedInstallationId(deviceId)) return { ok: false, problem: { code: 'IDENTITY_INVALID', keys: [ENV_INSTALLATION_DEVICE_ID] } };
  const fingerprint = (environment[ENV_DEVICE_CERT_FINGERPRINT] ?? '').toUpperCase();
  if (!CERT_FINGERPRINT_PATTERN.test(fingerprint)) return { ok: false, problem: { code: 'IDENTITY_INVALID', keys: [ENV_DEVICE_CERT_FINGERPRINT] } };
  return { ok: true, identity: { installationDeviceId: deviceId, installationName: name, certificateFingerprint: fingerprint } };
}

export interface FactorySeedOptions {
  /** The instant the seed is built as of, read ONCE from the server clock (DR-1). */
  readonly now: number;
  /** Default 0; a reset passes the previous epoch plus one. */
  readonly epoch?: number;
}

export interface PreparedFactorySeed {
  readonly options: { readonly now: number; readonly epoch: number };
  readonly identity: FactoryIdentityInput;
  readonly state: SimState;
  readonly rbac: RbacRows;
  readonly rows: MappedRows;
  readonly registryCounters: RegistryCounterRow[];
  /** The head the chain must hold after the seed: the genesis, because no row is appended. */
  readonly expectedHead: ChainHead;
}

/** The tables a factory seed must leave empty; the report prints their counts beside the filled ones. */
export const FACTORY_EMPTY_TABLES = ['session_history', 'evidence_items', 'evidence_tracks', 'evidence_custody', 'exports', 'active_session', 'alerts', 'audit_log', 'events', 'operator_credentials'] as const;

/**
 * Builds the factory state and maps it with the ONE row builder of the mapping module. No password
 * is derived here: the factory seed holds no credential, so it calls no hasher at all.
 */
export async function prepareFactorySeed(options: FactorySeedOptions, identity: FactoryIdentityInput): Promise<PreparedFactorySeed> {
  const now = options.now;
  const epoch = options.epoch ?? 0;
  if (!Number.isSafeInteger(now) || now <= 0) throw new FactorySeedError('DATASET_INVALID', 'now must be a positive whole number of milliseconds.');
  if (!Number.isSafeInteger(epoch) || epoch < 0) throw new FactorySeedError('DATASET_INVALID', 'epoch must be a whole number, zero or more.');
  let state: SimState;
  let rows: MappedRows;
  try {
    const built = createFactoryState(now, identity);
    state = built.meta.epoch === epoch ? built : { ...built, meta: { ...built.meta, epoch } };
    // The tables keep every audit row and event: the empty chain and the empty ring satisfy this
    // the same way a scenario does, and the counters say so (event 1 with zero events).
    assertCompleteRings(state);
    rows = toRows(state, { at: now, seededAt: now, lastResetAt: null });
  } catch (error) {
    if (error instanceof MappingError) throw new FactorySeedError('DATASET_INVALID', `the factory state could not be mapped (${error.code} at ${error.place}).`);
    throw error;
  }
  const head = rows.auditChainHead[0];
  if (head === undefined) throw new FactorySeedError('DATASET_INVALID', 'the factory state has no chain head row.');
  return {
    options: { now, epoch },
    identity,
    state,
    rbac: rbacRows(),
    rows,
    registryCounters: REGISTRY_COUNTER.map((name) => ({ name, nextValue: 1 })),
    expectedHead: { seq: head.seq, hash: head.hash },
  };
}

/**
 * Writes a prepared factory seed inside the caller's transaction. The statement order is the
 * demonstration seed's (§9.5) with its credential step left out; a table the factory state holds
 * no rows of contributes no statement, which is how the demonstration data stays off the unit.
 */
export async function writeFactorySeed(executor: RowExecutor, prepared: PreparedFactorySeed): Promise<void> {
  try {
    // AP-2: the first statement of a transaction that appends.
    const head = await lockAuditChain(executor);
    const seeded = await executor.select({ rows: sql<string>`count(*)` }).from(schema.coreState);
    if (Number(seeded[0]?.rows ?? 0) !== 0 || head.seq !== 0 || head.hash !== GENESIS_HASH) {
      throw new FactorySeedError('ALREADY_SEEDED', `the database is already seeded (the audit chain holds ${head.seq} row(s)). Nothing was written. Seeding again is a reset.`);
    }

    await writeRbacRows(executor, prepared.rbac);
    for (const table of WRITE_ORDER) {
      await insertRows(executor, table, prepared.rows[table]);
      if (table === 'engineCounters') {
        try {
          await executor.insert(schema.registryCounters).values(prepared.registryCounters);
        } catch {
          throw new StoreError('WRITE_FAILED', 'registry_counters', 'the statement was refused.');
        }
      }
      if (table === 'consoleSettings') {
        // The one `stt_config` row, as in the demonstration seed: boot asks for it (STT_CONFIG_NOT_SEEDED)
        // and it carries no credential value (SD-8).
        try {
          await executor.insert(schema.sttConfig).values(sttConfigSeedRow(prepared.options.now));
        } catch {
          throw new StoreError('WRITE_FAILED', 'stt_config', 'the statement was refused.');
        }
      }
    }

    const after = await executor.select().from(schema.auditChainHead);
    const stored = after[0];
    if (after.length !== 1 || stored === undefined || stored.seq !== prepared.expectedHead.seq || stored.hash !== prepared.expectedHead.hash) {
      throw new FactorySeedError('VERIFY_FAILED', `after the seed the chain head is at sequence ${stored?.seq ?? 'none'}; the factory seed appends no row and leaves it at ${prepared.expectedHead.seq}.`);
    }
  } catch (error) {
    if (error instanceof FactorySeedError) throw error;
    throw error instanceof StoreError ? new FactorySeedError('WRITE_FAILED', `the factory seed was not written: ${error.message}`) : error;
  }
}

/**
 * Seeds the database `pool` is connected to, in factory mode. The checks are the demonstration
 * seed's (the owner session, the database name, the schema version, "not seeded yet"); the work
 * between them is `prepareFactorySeed` and `writeFactorySeed`.
 *
 * The returned report is the demonstration report with `seed` 0 (the factory state consumes no
 * random stream) and `demoPackages` "not asked for": no evidence package is ever sealed here.
 */
export async function seedFactoryDatabase(pool: Pool, options: { readonly target: SeedTarget; readonly now: number; readonly epoch?: number; readonly identity: FactoryIdentityInput }): Promise<SeedReport> {
  const started = performance.now();
  const session = await verifyOwnerSession(pool);
  assertSeedTarget(session.database, options.target);

  const version = await readSchemaVersion(pool);
  if (version === null) {
    throw new FactorySeedError('NOT_MIGRATED', `the database ${session.database} has no schema. Apply the migrations first: npm run db:migrate -w @dems/core-server -- --database ${session.database}`);
  }
  if (version.schemaVersion !== DB_SCHEMA_VERSION || version.contractRevision !== DB_CONTRACT_REVISION) {
    throw new FactorySeedError('SCHEMA_VERSION', `the database ${session.database} is at schema version ${version.schemaVersion} (${version.contractRevision}); this seed writes version ${DB_SCHEMA_VERSION} (${DB_CONTRACT_REVISION}).`);
  }

  const existing = await pool.query<{ seeded_at: string }>('SELECT seeded_at FROM public.core_state');
  if (existing.rows[0] !== undefined) {
    throw new FactorySeedError('ALREADY_SEEDED', `the database ${session.database} is already seeded (seeded_at ${new Date(Number(existing.rows[0].seeded_at)).toISOString()}). Nothing was written. Seeding again is a reset.`);
  }

  const prepared = await prepareFactorySeed({ now: options.now, epoch: options.epoch }, options.identity);
  const preparedAt = performance.now();
  await drizzle(pool).transaction(async (transaction) => {
    await writeFactorySeed(transaction, prepared);
  });
  const writtenAt = performance.now();
  const counts = await countAllTables(drizzle(pool));
  return {
    database: session.database,
    role: session.role,
    serverVersion: session.serverVersion,
    now: prepared.options.now,
    seed: prepared.state.meta.seed,
    scenario: prepared.state.meta.scenario,
    epoch: prepared.options.epoch,
    counts,
    auditHead: prepared.expectedHead,
    demoPackages: SEED_DEMO_NOT_ASKED satisfies SeedDemoReport,
    demoPlacement: null satisfies SeedDemoPlacement | null,
    prepareMs: preparedAt - started,
    writeMs: writtenAt - preparedAt,
    totalMs: performance.now() - started,
  };
}
