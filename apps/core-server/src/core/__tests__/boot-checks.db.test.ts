// The boot checks as the core services register them (plan row W21, decision D40; database
// contract §7.4; spec §8.6 "Start"), on the real app factory against clones, as `dems_app`.
//
// The checks themselves are tested by the migration row (`test/db/boot-checks.db.test.ts`).
// Here: they ARE registered, in the order of the contract, with B-8 among them; a database that
// violates one stops the boot at that check, the app stays not ready, and the log names the
// check and says what to do; a stored chain that does not verify is reported and does not stop
// the boot. The broken states are built by the test as `dems_owner` on clones of its own.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterAll, describe, expect, it } from 'vitest';
import { AUDIT_INSERT as RAW_AUDIT_INSERT, coreState, insertRbac, insertRow, lockChain, nextAuditRow } from '../../../test/db/fixtures';
import { inTransaction } from '../../../test/db/support';
import { useTestDatabase, type TestDatabase } from '../../../test/helpers/db';
import { buildApp } from '../../app';
import { BLOCKING_BOOT_CHECKS, BootCheckError } from '../../db/schema/boot-checks';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../test/support/config';
import { BootError } from '../../plugins/readiness';
import { REPORTED_BOOT_CHECK } from '../boot-checks';
import { BOOT_CHECKS, passedAmong } from './support';

const db = useTestDatabase({ template: 'schema' });
const scratch = mkdtempSync(join(tmpdir(), 'dems-w21-boot-'));

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

interface Booted {
  readonly app: FastifyInstance;
  readonly log: CapturedLog;
  /** What `boot()` threw, or undefined when every step ran. */
  readonly stopped: BootError | undefined;
  /** Of the nine boot checks, those that passed, in order (finding CPB1-13: not every step of the server). */
  readonly passed: string[];
  readonly errorLogFile: string;
}

/** The real app on `database`, ready, then booted exactly as the entry point boots it. */
async function boot(database: TestDatabase, role: 'app' | 'owner' = 'app'): Promise<Booted> {
  const log = captureLog();
  const errorLogFile = join(scratch, `${database.name}.errors.log`);
  const app = buildApp({
    config: unitTestConfig({ database: db.run.connectionOn(database.name, role), dataDir: db.run.dataDir, logLevel: 'info' }),
    logStream: log.stream,
    errorLogFile,
  });
  database.onCleanup(() => app.close());
  app.get('/api/v1/scratch', { config: { operationId: 'scratch' } }, async () => ({ ok: true }));
  await app.ready();
  const stopped = await app.readiness.boot().then(
    () => undefined,
    (error: unknown) => {
      expect(error).toBeInstanceOf(BootError);
      return error as BootError;
    },
  );
  const passed = passedAmong(
    log
      .lines()
      .filter((line) => line['msg'] === 'boot step passed')
      .map((line) => line['step']),
    BOOT_CHECKS,
  );
  return { app, log, stopped, passed, errorLogFile };
}

async function seeded(slug: string): Promise<TestDatabase> {
  const clone = await db.another({ slug });
  await insertRbac(clone.ownerPool());
  await insertRow(clone.ownerPool(), 'core_state', coreState());
  await insertRow(clone.ownerPool(), 'engine_counters', { name: 'event', next_value: 1 });
  return clone;
}

const failedLine = (booted: Booted): Record<string, unknown> | undefined =>
  booted.log.lines().find((line) => line['msg'] === 'boot check failed');

describe('the registration (decision D40)', () => {
  it('B-2 to B-9 follow B-1 in the order of the contract; B-8 is among them; every one passes on a good database', async () => {
    const clone = await seeded('boot_good');
    const booted = await boot(clone);
    // Some rows through the server's own writer, then a second boot of a fresh app sees them.
    await booted.app.pipeline.run('test.rows', (unit) =>
      unit.audit.appendMany([
        { type: 'SYSTEM_BOOT', actorId: null, deviceId: null, message: 'Booted', details: {} },
        { type: 'AUTH_SUCCESS', actorId: 'OPR-001', deviceId: null, message: 'Signed in', details: { method: 'PASSWORD' } },
      ]),
    );
    const again = await boot(clone);

    for (const result of [booted, again]) {
      // By-design change (decision D72, plan row W26): the boot no longer ends after B-9. A step
      // of another unit follows and refuses this fixture (today the engine host's: a state row
      // and no engine state). What is tested here: none of the nine checks stopped the boot.
      expect(result.stopped).toBeDefined();
      expect(BOOT_CHECKS as readonly string[]).not.toContain(result.stopped?.stepId);
      expect(result.passed).toEqual([...BOOT_CHECKS]);
      expect(result.app.server.listening).toBe(false);
    }
    expect(BLOCKING_BOOT_CHECKS.map((check) => check.id)).toEqual(['B-2', 'B-3', 'B-4', 'B-5', 'B-6', 'B-7', 'B-9']);
    expect(REPORTED_BOOT_CHECK).toBe('B-8');

    const verified = again.log.lines().find((line) => line['msg'] === 'the stored audit chain verifies');
    expect(verified).toMatchObject({ step: 'B-8', rowsChecked: 2, firstSeq: 1, lastSeq: 2, linkBreaks: 0, digests: 'ok', lineage: 'none' });
    expect(failedLine(again)).toBeUndefined();

    // The database is ready; the engine could not rehydrate from this fixture, so the server is not ready.
    expect(again.app.readiness.snapshot()).toEqual({ database: true, engine: false });
    expect((await again.app.inject({ method: 'GET', url: '/api/v1/scratch' })).statusCode).toBe(503);
  });
});

describe('a database that violates a check keeps the app not ready, and the log names the check', () => {
  it('one audit trigger in the default mode: the boot stops at B-5', async () => {
    const clone = await seeded('boot_trigger');
    await clone.ownerPool().query('ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_append_only');
    const booted = await boot(clone);

    expect(booted.stopped?.stepId).toBe('B-5');
    expect(booted.stopped?.cause).toBeInstanceOf(BootCheckError);
    expect(booted.passed).toEqual(['B-1', 'B-2', 'B-3', 'B-4']);

    const line = failedLine(booted);
    expect(line).toMatchObject({ level: 50, step: 'B-5', code: 'BootCheckError' });
    expect(String(line?.['detail'])).toContain('audit_log_append_only=O');
    expect(String(line?.['detail'])).toContain('expected exactly [audit_chain_history_append_only=A, audit_log_append_only=A, audit_log_chain_guard=A]');

    // Not ready: everything except health answers 503, and nothing listens.
    expect(booted.app.readiness.isReady()).toBe(false);
    const refused = await booted.app.inject({ method: 'GET', url: '/api/v1/scratch' });
    expect(refused.statusCode).toBe(503);
    expect((refused.json() as { error: { code: string } }).error.code).toBe('NOT_READY');
    expect((await booted.app.inject({ method: 'GET', url: '/api/v1/health' })).statusCode).toBe(200);
    expect(booted.app.server.listening).toBe(false);

    // The same failure in the persistent error log, by the check's ID.
    const entries = readFileSync(booted.errorLogFile, 'utf8')
      .split('\n')
      .filter((text) => text !== '')
      .map((text) => JSON.parse(text) as { level: string; source: string; message: string; context: { step: string; title: string } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: 'fatal',
      source: 'core.bootChecks',
      errorName: 'BootCheckError',
      context: { step: 'B-5', title: 'the audit table and the lineage table are protected' },
    });
    expect(entries[0]?.message).toContain('audit_log_append_only=O');
  });

  it('a pool of the owner role: B-4', async () => {
    const clone = await seeded('boot_owner');
    const booted = await boot(clone, 'owner');
    expect(booted.stopped?.stepId).toBe('B-4');
    expect(booted.passed).toEqual(['B-1', 'B-2', 'B-3']);
    expect(failedLine(booted)).toMatchObject({ step: 'B-4', code: 'BootCheckError' });
    expect(String(failedLine(booted)?.['detail'])).toContain('the pool is connected as dems_owner with rolcreatedb');
  });

  it('a migrated database that was never seeded: B-6, and the line says how to seed it', async () => {
    const clone = await db.another({ slug: 'boot_unseeded' });
    const booted = await boot(clone);
    expect(booted.stopped?.stepId).toBe('B-6');
    expect(booted.passed).toEqual(['B-1', 'B-2', 'B-3', 'B-4', 'B-5']);
    expect(failedLine(booted)).toMatchObject({ step: 'B-6' });
    expect(String(failedLine(booted)?.['detail'])).toContain('npm run db:seed');
  });

  it('a chain head that does not agree with the table: B-7; B-8 and B-9 do not run', async () => {
    const clone = await seeded('boot_head');
    await clone.ownerPool().query("UPDATE public.audit_chain_head SET seq = 7, hash = repeat('a', 64)");
    const booted = await boot(clone);
    expect(booted.stopped?.stepId).toBe('B-7');
    expect(booted.passed).toEqual(['B-1', 'B-2', 'B-3', 'B-4', 'B-5', 'B-6']);
    expect(failedLine(booted)).toMatchObject({ step: 'B-7' });
    expect(booted.log.lines().some((line) => line['step'] === 'B-8' || line['step'] === 'B-9')).toBe(false);
  });
});

describe('B-8 is reported, never blocking', () => {
  it('a stored row whose digest is not the shared one: one error line with a rule and a sequence, and the boot goes on to B-9', async () => {
    const clone = await seeded('boot_digest');
    const owner = clone.ownerPool();
    const MARK = 'MARK-altered-message-3c9d';
    // Three rows through the append protocol; the second is altered AFTER it was hashed. The
    // database checks the link, not the digest (GD-01), so it stores the row.
    await inTransaction(owner, async (client) => {
      let head = await lockChain(client);
      for (const index of [1, 2, 3]) {
        const row = nextAuditRow(head, { message: `Row ${index}` });
        const parameters = Object.values(index === 2 ? { ...row, message: MARK } : row);
        await client.query(RAW_AUDIT_INSERT, parameters);
        head = { seq: Number(row['seq']), hash: String(row['hash']) };
      }
    });

    const booted = await boot(clone);
    // By-design change (decision D72, plan row W26): neither B-8 nor B-9 stops the boot; it goes
    // on to a step of another unit, which refuses this fixture (a state row and no engine state).
    expect(booted.stopped).toBeDefined();
    expect(BOOT_CHECKS as readonly string[]).not.toContain(booted.stopped?.stepId);
    expect(booted.passed).toEqual([...BOOT_CHECKS]);

    const line = booted.log.lines().find((entry) => entry['code'] === 'STORED_CHAIN_NOT_VERIFIED');
    expect(line).toMatchObject({
      level: 50,
      step: 'B-8',
      rowsChecked: 3,
      linkBreaks: 0,
      digests: 'failed',
      lineage: 'none',
      problems: ['the stored chain does not verify (HASH_MISMATCH at sequence 2).'],
    });
    expect(failedLine(booted)).toBeUndefined();
    // Not the content of the row.
    expect(booted.log.text()).not.toContain(MARK);
    const persisted = readFileSync(booted.errorLogFile, 'utf8');
    expect(persisted).toContain('STORED_CHAIN_NOT_VERIFIED');
    expect(persisted).not.toContain(MARK);
  });
});
