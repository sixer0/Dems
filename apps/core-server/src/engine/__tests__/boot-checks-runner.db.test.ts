// The one runner of the database boot checks on a RUNNING server, against PostgreSQL as
// `dems_app` (fix round B2a; decision D101; database contract §7.4, §8.5 R-9).
//
// `runDatabaseBootChecks(app)` is what a caller runs after it reopened the pool of a running
// server (the demo reset). Here: on a good database it passes, reports B-8 as a start does,
// changes no row and touches nothing of the server; after a stop of the engine and a reopen of
// the pool it passes again and the engine reloads; a database that violates a check is named by
// the check's ID, and the function writes nothing for it. The broken states are built by the
// test as `dems_owner` on clones of its own.
import { describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { tableChecksums } from '../../../test/support/seed';
import { runDatabaseBootChecks } from '../../core';
import { BootCheckError } from '../../db/schema/boot-checks';
import { BootError } from '../../plugins/readiness';
import { engineApp, type EngineApp } from './support';

const db = useTestDatabase({ template: 'seed' });

const CHAIN_VERIFIES = 'the stored audit chain verifies';
const linesOf = (host: EngineApp, text: string) => host.log.lines().filter((line) => line['msg'] === text);
const errorLines = (host: EngineApp) => host.log.lines().filter((line) => Number(line['level']) >= 50);

async function failureOf(host: EngineApp): Promise<BootError> {
  const thrown: unknown = await runDatabaseBootChecks(host.app).then(
    () => null,
    (error: unknown) => error,
  );
  expect(thrown).toBeInstanceOf(BootError);
  return thrown as BootError;
}

describe('on a running server', () => {
  it('a good database: every check passes, B-8 is reported as at a start, no row changes and the server is as it was', async () => {
    const target = await db.another({ slug: 'b2a_checks_good' });
    const owner = target.ownerPool();
    const host = await engineApp(target, db.run.dataDir, { logLevel: 'info' });
    await host.app.readiness.boot();
    await host.engine.idle();
    // The start reported the stored chain once.
    expect(linesOf(host, CHAIN_VERIFIES)).toHaveLength(1);
    const before = await tableChecksums(owner);
    const stats = host.engine.stats();
    const passed = linesOf(host, 'boot step passed').length;
    const persisted = vi.spyOn(host.app.errorLog, 'append');

    await runDatabaseBootChecks(host.app);

    // The same line as at a start, a second time, with the same facts.
    const reports = linesOf(host, CHAIN_VERIFIES);
    expect(reports).toHaveLength(2);
    expect(reports[1]).toMatchObject({ level: 30, step: 'B-8', linkBreaks: 0, digests: 'ok' });
    // The chain it checked is the one the tables hold now: the rows of the start, and the one row the start appended.
    expect(reports[1]?.['rowsChecked']).toBe(Number(reports[0]?.['rowsChecked']) + 1);
    expect(reports[1]?.['lastSeq']).toBe(host.engine.slice('audit').total);
    // It is no boot: no step is added or run through the readiness, no flag moves, the engine is not touched.
    expect(linesOf(host, 'boot step passed')).toHaveLength(passed);
    expect(host.app.readiness.snapshot()).toEqual({ database: true, engine: true });
    expect(host.engine.stats()).toEqual(stats);
    expect(host.engine.running).toBe(true);
    expect(await tableChecksums(owner)).toEqual(before);
    expect(errorLines(host)).toEqual([]);
    expect(persisted).not.toHaveBeenCalled();
    // And again: it can be run any number of times.
    await runDatabaseBootChecks(host.app);
    expect(linesOf(host, CHAIN_VERIFIES)).toHaveLength(3);
  });

  it('the order of a reset: the engine stopped, the pool reopened, the checks on the NEW pool, the engine reloaded', async () => {
    const target = await db.another({ slug: 'b2a_checks_reopen' });
    const host = await engineApp(target, db.run.dataDir, { logLevel: 'info' });
    await host.app.readiness.boot();
    const epoch = host.engine.epoch;
    const generation = host.app.db.generation;

    await host.engine.stop();
    await host.app.db.reopen();
    expect(host.app.db.generation).toBe(generation + 1);
    expect(host.app.readiness.snapshot()).toEqual({ database: false, engine: false });

    await runDatabaseBootChecks(host.app);
    // B-1's probe set the flag of the database; the engine's is the caller's.
    expect(host.app.readiness.snapshot()).toEqual({ database: true, engine: false });
    expect(host.database.connections.pools).toBe(2);

    await host.engine.reload();
    expect(host.engine).toMatchObject({ running: true, epoch });
    expect(host.app.readiness.isReady()).toBe(true);
    expect(errorLines(host)).toEqual([]);
  });

  it('a database that violates a check: the rejection names the check and holds its error; nothing is written; repaired, the checks pass', async () => {
    const target = await db.another({ slug: 'b2a_checks_trigger' });
    const owner = target.ownerPool();
    const host = await engineApp(target, db.run.dataDir, { logLevel: 'info' });
    await host.app.readiness.boot();
    const persisted = vi.spyOn(host.app.errorLog, 'append');
    const lines = host.log.lines().length;

    // B-5: one of the audit triggers is no longer in the mode ALWAYS.
    await owner.query('ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_append_only');
    const failure = await failureOf(host);
    expect(failure.stepId).toBe('B-5');
    expect(failure.cause).toBeInstanceOf(BootCheckError);
    expect((failure.cause as BootCheckError).message).toContain('audit_log_append_only=O');
    // B-8 comes after B-5: it did not run. And this function wrote nothing: the caller reports once.
    expect(host.log.lines().slice(lines)).toEqual([]);
    expect(persisted).not.toHaveBeenCalled();
    // It decides nothing about the server: the flags and the engine are the caller's.
    expect(host.app.readiness.snapshot()).toEqual({ database: true, engine: true });
    expect(host.engine.running).toBe(true);

    await owner.query('ALTER TABLE public.audit_log ENABLE ALWAYS TRIGGER audit_log_append_only');
    await runDatabaseBootChecks(host.app);
    expect(linesOf(host, CHAIN_VERIFIES)).toHaveLength(2);
  });

  it('a migrated database that was never seeded: B-6, and the error says how to seed it', async () => {
    const target = await db.another({ template: 'schema', slug: 'b2a_checks_unseeded' });
    const host = await engineApp(target, db.run.dataDir, { logLevel: 'info' });
    const failure = await failureOf(host);
    expect(failure.stepId).toBe('B-6');
    expect(failure.cause).toBeInstanceOf(BootCheckError);
    expect((failure.cause as BootCheckError).message).toContain('db:seed');
    expect(errorLines(host)).toEqual([]);
  });
});
