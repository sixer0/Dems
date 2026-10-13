// Boot checks B-2 to B-9 (database contract §7.4) and T-PV-3 (§7.5): what the server checks
// before it listens. The checks are pure functions over a pool (`src/db/schema/boot-checks.ts`);
// the core-services row registers them (D40). Each check has a passing case on the real runtime
// pool and a failing case; the failing database states are built by the test as `dems_owner` on
// clones of its own (TI-17 allows the one trigger change of T-PV-3 for this).
//
// The schema-version check (B-3) is among them.
import { verifyAuditChain, type AuditLogSlice, type AuditRow } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { createConfig } from '../../src/config';
import {
  BLOCKING_BOOT_CHECKS,
  BOOT_CHECK_IDS,
  BootCheckError,
  checkAuditProtection,
  checkChainHead,
  checkOwnerRole,
  checkRuntimeRole,
  checkSchemaVersion,
  checkSeeded,
  checkServerVersion,
  checkStoredChain,
  type Queryable,
} from '../../src/db/schema/boot-checks';
import { DB_CONTRACT_REVISION, DB_SCHEMA_VERSION } from '../../src/db/schema/meta';
import type { AuditLogRow } from '../../src/db/schema';
import { captureLog } from '../support/config';
import { BOOT_STEP_DATABASE_ANSWERS } from '../../src/plugins/db';
import { BootError } from '../../src/plugins/readiness';
import { useTestDatabase } from '../helpers/db';
import type { TestDatabase } from '../helpers/db';
import { appendAuditRows, coreState, insertRbac, insertRow, lineageRow, nextAuditRow, AUDIT_INSERT } from './fixtures';
import { EMPTY_DATABASE } from './support';

const db = useTestDatabase({ template: 'schema' });

/** B-1 of the pool plugin and B-2 to B-9 of the contract, in the order in which they run. */
const NINE_BOOT_CHECKS: readonly string[] = [BOOT_STEP_DATABASE_ANSWERS, ...BOOT_CHECK_IDS];
let app: Pool;
let owner: Pool;

beforeAll(async () => {
  app = db.appPool();
  owner = db.ownerPool();
  await insertRbac(owner);
});

/** Expects `work` to throw the boot check error of `id`, and returns its message. */
async function failsAt(id: string, work: () => Promise<unknown>): Promise<string> {
  try {
    await work();
  } catch (error) {
    expect(error).toBeInstanceOf(BootCheckError);
    expect((error as BootCheckError).checkId).toBe(id);
    return (error as BootCheckError).message;
  }
  throw new Error(`the check ${id} was expected to fail, and it passed`);
}

/** A stand-in pool that answers each statement from a table: for states a real server cannot be put in. */
function standIn(answers: Array<[RegExp, unknown[]]>): Queryable {
  return {
    query: (async (text: string) => {
      const found = answers.find(([pattern]) => pattern.test(text));
      if (found === undefined) throw new Error(`no answer for: ${text}`);
      return { rows: found[1], rowCount: found[1].length };
    }) as unknown as Queryable['query'],
  };
}

/** The shared digest check, as the core-services row will pass it in. */
const sharedDigests = (rows: readonly AuditLogRow[], context: { dropped: number; head: string }) => {
  const log: AuditLogSlice = { rows: rows as unknown as AuditRow[], head: context.head, total: context.dropped + rows.length, dropped: context.dropped };
  const verdict = verifyAuditChain(log);
  return verdict.ok ? { ok: true } : { ok: false, reason: JSON.stringify(verdict) };
};

describe('the list', () => {
  it('seven blocking checks in the order of the contract; B-1 is the pool plugin, B-8 is reported only', () => {
    expect(BLOCKING_BOOT_CHECKS.map((check) => check.id)).toEqual(['B-2', 'B-3', 'B-4', 'B-5', 'B-6', 'B-7', 'B-9']);
    expect(BOOT_STEP_DATABASE_ANSWERS).toBe('B-1');
  });
});

describe('B-2: server version and encoding', () => {
  it('passes on PostgreSQL 18.4, UTF8, as dems_app', async () => {
    await checkServerVersion(app);
    const { rows } = await app.query("SELECT current_setting('server_version_num') AS num, current_setting('server_encoding') AS encoding");
    expect(rows).toEqual([{ num: '180004', encoding: 'UTF8' }]);
  });

  it('fails on another major version and on another encoding', async () => {
    const pool = (num: string, encoding: string) =>
      standIn([
        [/server_version_num/, [{ server_version_num: num }]],
        [/server_encoding/, [{ server_encoding: encoding }]],
      ]);
    expect(await failsAt('B-2', () => checkServerVersion(pool('170006', 'UTF8')))).toBe(
      'B-2: the server reports version number 170006; PostgreSQL 18 is expected.',
    );
    expect(await failsAt('B-2', () => checkServerVersion(pool('180004', 'SQL_ASCII')))).toBe(
      'B-2: the database encoding is SQL_ASCII; UTF8 is expected.',
    );
  });
});

describe('B-3: the schema version', () => {
  it('passes when schema_meta holds the constants of the server code (8, dbc-9)', async () => {
    expect({ DB_SCHEMA_VERSION, DB_CONTRACT_REVISION }).toEqual({ DB_SCHEMA_VERSION: 8, DB_CONTRACT_REVISION: 'dbc-9' });
    await checkSchemaVersion(app);
  });

  it('fails with both numbers and the migrate command when the code expects another version', async () => {
    const message = await failsAt('B-3', () => checkSchemaVersion(app, { schemaVersion: 1, contractRevision: 'dbc-2' }));
    expect(message).toBe(
      'B-3: the database is at schema version 8 (dbc-9); this server expects 1 (dbc-2). Apply the migrations: npm run db:migrate -w @dems/core-server -- --database <name>',
    );
  });

  it('fails when the database is ahead of the code, and when it has no schema at all', async () => {
    const ahead = await db.another({ slug: 'boot_ahead' });
    await ahead.ownerPool().query("UPDATE schema_meta SET schema_version = 9, contract_revision = 'dbc-10'");
    expect(await failsAt('B-3', () => checkSchemaVersion(ahead.appPool()))).toContain(
      'the database is at schema version 9 (dbc-10); this server expects 8 (dbc-9)',
    );

    const empty = await db.another({ template: EMPTY_DATABASE, slug: 'boot_empty' });
    expect(await failsAt('B-3', () => checkSchemaVersion(empty.appPool()))).toContain(
      'the database has no schema (no table schema_meta); this server expects schema version 8 (dbc-9)',
    );
  });

  it('the runtime role can read schema_meta and cannot change it', async () => {
    expect((await app.query('SELECT schema_version, contract_revision FROM schema_meta')).rows).toEqual([
      { schema_version: 8, contract_revision: 'dbc-9' },
    ]);
    await expect(app.query('UPDATE schema_meta SET schema_version = 9')).rejects.toMatchObject({ code: '42501' });
  });
});

describe('B-4: the runtime role is not privileged', () => {
  it('passes as dems_app', async () => {
    await checkRuntimeRole(app);
  });

  it('fails for a pool of the owner role, naming rolcreatedb', async () => {
    expect(await failsAt('B-4', () => checkRuntimeRole(owner))).toBe(
      'B-4: the pool is connected as dems_owner with rolcreatedb; the server runs as dems_app, which has none of the five role attributes.',
    );
  });
});

describe('B-5: the audit table and the lineage table are protected', () => {
  it('passes as dems_app on a migrated database', async () => {
    await checkAuditProtection(app);
  });

  it('fails when a trigger was set back to the default mode', async () => {
    const clone = await db.another({ slug: 'boot_mode' });
    await clone.ownerPool().query('ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_append_only');
    expect(await failsAt('B-5', () => checkAuditProtection(clone.appPool()))).toBe(
      'B-5: the triggers on audit_log and audit_chain_history are [audit_chain_history_append_only=A, audit_log_append_only=O, audit_log_chain_guard=A]; expected exactly [audit_chain_history_append_only=A, audit_log_append_only=A, audit_log_chain_guard=A].',
    );
  });

  it('fails for each privilege the runtime role must not hold, also when it is granted on one column only', async () => {
    const cases: Array<[string, string]> = [
      ['GRANT UPDATE ON public.audit_log TO dems_app', 'UPDATE on public.audit_log'],
      ['GRANT UPDATE (message) ON public.audit_log TO dems_app', 'UPDATE on public.audit_log'],
      ['GRANT DELETE ON public.audit_log TO dems_app', 'DELETE on public.audit_log'],
      ['GRANT TRUNCATE ON public.audit_chain_history TO dems_app', 'TRUNCATE on public.audit_chain_history'],
      ['GRANT INSERT ON public.audit_chain_history TO dems_app', 'INSERT on public.audit_chain_history'],
      ['GRANT UPDATE (seq) ON public.audit_chain_head TO dems_app', 'UPDATE on public.audit_chain_head'],
    ];
    const clone = await db.another({ slug: 'boot_grant' });
    for (const [grant, held] of cases) {
      await clone.ownerPool().query(grant);
      expect(await failsAt('B-5', () => checkAuditProtection(clone.appPool())), grant).toBe(
        `B-5: the session holds ${held}; the runtime role must hold none of them.`,
      );
      await clone.ownerPool().query(grant.replace(/^GRANT/, 'REVOKE').replace(' TO dems_app', ' FROM dems_app'));
      await checkAuditProtection(clone.appPool());
    }
  });
});

describe('B-6: the database is seeded', () => {
  it('fails on a migrated database without a core_state row, naming the seed command; passes with one', async () => {
    expect(await failsAt('B-6', () => checkSeeded(app))).toBe(
      'B-6: core_state holds 0 row(s); a seeded database holds one. Seed it: npm run db:seed -w @dems/core-server -- --database <name>',
    );
    await insertRow(owner, 'core_state', coreState());
    await checkSeeded(app);
  });
});

describe('B-7: the chain head agrees with the table', () => {
  it('passes on an empty log (head at 0, the genesis hash) and after appends', async () => {
    await checkChainHead(app);
    await appendAuditRows(app, 5);
    await checkChainHead(app);
  });

  it('fails when the head and the newest row differ', async () => {
    const clone = await db.another({ slug: 'boot_head' });
    await appendAuditRows(clone.appPool(), 3);
    await checkChainHead(clone.appPool());
    // Only the owner can move the head by hand; the runtime role cannot (T-CH-3).
    await clone.ownerPool().query('UPDATE audit_chain_head SET seq = 7');
    expect(await failsAt('B-7', () => checkChainHead(clone.appPool()))).toBe(
      'B-7: the chain head is at sequence 7, the newest audit row at 3.',
    );
    await clone.ownerPool().query("UPDATE audit_chain_head SET seq = 3, hash = repeat('e', 64)");
    expect(await failsAt('B-7', () => checkChainHead(clone.appPool()))).toBe(
      'B-7: the chain head is at sequence 3, the newest audit row at 3, and their hashes differ.',
    );
  });
});

describe('B-8: the stored chain verifies (reported, not blocking)', () => {
  it('reports ok for a chain written through the append protocol, with the shared digest check', async () => {
    const report = await checkStoredChain(app, { verifyDigests: sharedDigests });
    expect(report).toEqual({ ok: true, rowsChecked: 5, firstSeq: 1, lastSeq: 5, linkBreaks: 0, digests: 'ok', lineage: 'none', problems: [] });
  });

  it('checks only the newest rows when asked, and tells the digest check how many were left out', async () => {
    const report = await checkStoredChain(app, { limit: 2, verifyDigests: sharedDigests });
    expect(report).toMatchObject({ ok: true, rowsChecked: 2, firstSeq: 4, lastSeq: 5, digests: 'ok' });
  });

  it('a row with a wrong digest continues the chain for the database (GD-01); the report says so and nothing is thrown', async () => {
    const clone = await db.another({ slug: 'boot_digest' });
    const first = await appendAuditRows(clone.appPool(), 2);
    // The link is right (seq, prev_hash) and the digest is not what the shared function gives.
    const forged = { ...nextAuditRow(first), hash: 'd'.repeat(64) };
    await clone.appPool().query(AUDIT_INSERT, Object.values(forged));
    await checkChainHead(clone.appPool());
    const report = await checkStoredChain(clone.appPool(), { verifyDigests: sharedDigests });
    expect(report).toMatchObject({ ok: false, rowsChecked: 3, linkBreaks: 0, digests: 'failed' });
    expect(report.problems).toHaveLength(1);
    // Without the shared check the database-level links are all that is looked at.
    expect(await checkStoredChain(clone.appPool())).toMatchObject({ ok: true, digests: 'not-checked' });
  });

  it('LN-3: the newest lineage row must agree with exactly one SCENARIO_LOADED row of the chain', async () => {
    const clone = await db.another({ slug: 'boot_lineage' });
    const entry = lineageRow(1);
    await insertRow(clone.ownerPool(), 'audit_chain_history', entry);
    await appendAuditRows(clone.appPool(), 1);
    expect(await checkStoredChain(clone.appPool())).toMatchObject({ ok: false, lineage: 'mismatch' });
    await appendAuditRows(clone.appPool(), 1, {
      type: 'SCENARIO_LOADED',
      category: 'SYSTEM',
      details: { scenario: 'idle', reset: true, previousRows: Number(entry['row_count']), previousHead: String(entry['head_hash']) },
    });
    expect(await checkStoredChain(clone.appPool(), { verifyDigests: sharedDigests })).toMatchObject({ ok: true, lineage: 'ok', digests: 'ok' });
  });
});

describe('B-9: the owner role is not a superuser, and it owns the guarded objects', () => {
  it('passes as dems_app: one role row with four false flags; the database, three tables and two functions belong to dems_owner', async () => {
    await checkOwnerRole(app);
  });

  it('fails when the owner role is a superuser, and when a guarded object belongs to another role', async () => {
    const flags = { rolsuper: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false };
    const owners = [
      { object: 'database dems_demo', owner: 'dems_owner' },
      { object: 'function audit_chain_lock', owner: 'dems_owner' },
      { object: 'function audit_log_guard_insert', owner: 'dems_owner' },
      { object: 'table audit_chain_head', owner: 'dems_owner' },
      { object: 'table audit_chain_history', owner: 'dems_owner' },
      { object: 'table audit_log', owner: 'dems_owner' },
    ];
    expect(
      await failsAt('B-9', () => checkOwnerRole(standIn([[/FROM pg_roles/, [{ ...flags, rolsuper: true }]], [/pg_database/, owners]]))),
    ).toBe('B-9: the owner role dems_owner has rolsuper; it must have none of them.');
    const foreign = owners.map((entry) => (entry.object === 'function audit_chain_lock' ? { ...entry, owner: 'postgres' } : entry));
    expect(await failsAt('B-9', () => checkOwnerRole(standIn([[/FROM pg_roles/, [flags]], [/pg_database/, foreign]])))).toBe(
      'B-9: not owned by dems_owner: function audit_chain_lock (postgres).',
    );
    expect(await failsAt('B-9', () => checkOwnerRole(standIn([[/FROM pg_roles/, []], [/pg_database/, owners]])))).toBe(
      'B-9: pg_roles has 0 row(s) for dems_owner; it must have one.',
    );
  });
});

describe('T-PV-3: the boot stops at B-4 for a pool of the owner role, and at B-5 for a trigger in the default mode', () => {
  /** An app on `database`. The core services register the boot checks in the app itself (decision D40). */
  function appOn(database: TestDatabase, role: 'owner' | 'app') {
    const log = captureLog();
    const instance = buildApp({
      config: createConfig({
        port: 4420,
        demoControls: false,
        logLevel: 'info',
        dataDir: db.run.dataDir,
        database: db.run.connectionOn(database.name, role),
      }),
      logStream: log.stream,
    });
    database.onCleanup(() => instance.close());
    return { instance, log };
  }

  async function boot(database: TestDatabase, role: 'owner' | 'app') {
    const { instance, log } = appOn(database, role);
    await instance.ready();
    // By-design change (decision D40, plan row W21): the checks are no longer added here. The
    // app has them, in the order of the contract, with the reported check B-8 among them.
    let stopped: BootError | undefined;
    try {
      await instance.readiness.boot();
    } catch (error) {
      expect(error).toBeInstanceOf(BootError);
      stopped = error as BootError;
    }
    // Of the nine boot checks, those that passed, in order. By-design change (checkpoint CP-B1,
    // finding CPB1-13; standing rule M10): not the list of every boot step of the server, which
    // grows with each unit that adds one.
    const passed = log
      .lines()
      .filter((line) => line['msg'] === 'boot step passed')
      .map((line) => line['step'])
      .filter((step): step is string => typeof step === 'string' && NINE_BOOT_CHECKS.includes(step));
    return { stopped, passed, listening: instance.server.listening };
  }

  it('a pool configured with the owner role: the boot stops at B-4 and no listener is opened', async () => {
    const clone = await db.another({ slug: 'boot_owner_pool' });
    const result = await boot(clone, 'owner');
    expect(result.stopped?.stepId).toBe('B-4');
    expect(result.stopped?.cause).toBeInstanceOf(BootCheckError);
    expect((result.stopped?.cause as BootCheckError | undefined)?.checkId).toBe('B-4');
    expect(result.passed).toEqual(['B-1', 'B-2', 'B-3']);
    expect(result.listening).toBe(false);
  });

  it('one trigger set back to the default mode: the boot stops at B-5 and no listener is opened', async () => {
    const clone = await db.another({ slug: 'boot_default_mode' });
    await clone.ownerPool().query('ALTER TABLE public.audit_chain_history ENABLE TRIGGER audit_chain_history_append_only');
    const result = await boot(clone, 'app');
    expect(result.stopped?.stepId).toBe('B-5');
    expect((result.stopped?.cause as BootCheckError | undefined)?.message).toContain('audit_chain_history_append_only=O');
    expect(result.passed).toEqual(['B-1', 'B-2', 'B-3', 'B-4']);
    expect(result.listening).toBe(false);
  });

  it('a migrated and seeded clone with the runtime pool: every blocking check passes, in order', async () => {
    const clone = await db.another({ slug: 'boot_all_pass' });
    await insertRbac(clone.ownerPool());
    await insertRow(clone.ownerPool(), 'core_state', coreState());
    const result = await boot(clone, 'app');
    // By-design change (decision D72, plan row W26): the boot no longer ends after B-9. A step
    // of another unit follows (today the engine host's), and it refuses this clone: it holds a
    // state row and no engine state (no seed ran). Every blocking check has passed before it,
    // which is what is tested: the step that stopped the boot is none of the nine.
    expect(result.stopped).toBeDefined();
    expect(NINE_BOOT_CHECKS).not.toContain(result.stopped?.stepId);
    // B-8 is in the list since the core services register it: reported, between B-7 and B-9.
    expect(result.passed).toEqual(['B-1', 'B-2', 'B-3', 'B-4', 'B-5', 'B-6', 'B-7', 'B-8', 'B-9']);
    expect(result.listening).toBe(false);
  });

  it('a migrated clone that was never seeded stops at B-6', async () => {
    const clone = await db.another({ slug: 'boot_unseeded' });
    const result = await boot(clone, 'app');
    expect(result.stopped?.stepId).toBe('B-6');
    expect(result.passed).toEqual(['B-1', 'B-2', 'B-3', 'B-4', 'B-5']);
  });
});
