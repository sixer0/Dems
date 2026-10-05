// The unit of work, the event writer and the queue's limits against the real PostgreSQL, as
// `dems_app` (plan row W21; spec §2.3 stages 8 to 10, ENG-1, ENG-5, ENG-23, SR-54, SR-72;
// database contract §5.6 AT-1, AT-5).
//
// What is proven here: a unit commits as a whole or not at all; a failing unit leaves no row,
// does not advance the head and does not consume an event number; the tools of a unit refuse
// what would break it; a unit that runs too long is abandoned and the queue goes on; shutdown
// drains; the log holds codes and numbers, never the content of a row.
import type { ApiErrorCode } from '@dems/shared/api';
import { eq } from 'drizzle-orm';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { coreState, insertRbac, insertRow } from '../../../test/db/fixtures';
import { runtimePool } from '../../../test/db/support';
import { useTestDatabase } from '../../../test/helpers/db';
import { auditChainHead, auditLog, events as eventsTable, operators } from '../../db/schema';
import { ApiFailure } from '../../plugins/error-envelope';
import { CoreError, PipelineFailure, sqlStateOf } from '../errors';
import { unitContextOf } from '../index';
import { createPipeline } from '../pipeline';
import type { Pipeline, UnitContext } from '../types';
import {
  CLOCK_START,
  coreApp,
  linkProblems,
  readEventCounter,
  readEvents,
  readHead,
  readTrail,
  sleep,
  verifyTrail,
  type CoreApp,
} from './support';

const db = useTestDatabase({ template: 'schema' });
let core: CoreApp;
let owner: Pool;

async function seedMinimum(pool: Pool, withCounter = true): Promise<void> {
  await insertRbac(pool);
  await insertRow(pool, 'core_state', coreState());
  if (withCounter) await insertRow(pool, 'engine_counters', { name: 'event', next_value: 1 });
}

beforeAll(async () => {
  owner = db.ownerPool();
  await seedMinimum(owner);
  core = await coreApp(db, db.run.dataDir);
});

const caught = <T>(work: Promise<T>): Promise<unknown> =>
  work.then(
    () => null,
    (error: unknown) => error,
  );

const entry = (message: string, details: Record<string, string | number | boolean | null> = {}) =>
  ({ type: 'SYSTEM_BOOT', actorId: null, deviceId: null, message, details }) as const;

async function stored(): Promise<{ head: Awaited<ReturnType<typeof readHead>>; rows: number; events: number; counter: number | null }> {
  return {
    head: await readHead(owner),
    rows: (await readTrail(owner)).length,
    events: (await readEvents(owner)).length,
    counter: await readEventCounter(owner),
  };
}

async function operatorEnabled(id: string): Promise<boolean> {
  const { rows } = await owner.query<{ enabled: boolean }>('SELECT enabled FROM public.operators WHERE id = $1', [id]);
  return rows[0]?.enabled === true;
}

/** A pipeline on a pool of its own (one connection), with its own limits. */
function separatePipeline(limits: { unitTimeoutMs?: number; maxPending?: number; closeTimeoutMs?: number } = {}): { pipeline: Pipeline; pool: Pool } {
  const pool = runtimePool(db.runtime, 1, 'dems-w21-unit');
  db.onCleanup(() => pool.end());
  return {
    pool,
    pipeline: createPipeline({ pool: () => pool, clock: core.clock, log: core.app.log, errorLog: core.app.errorLog, limits }),
  };
}

describe('one unit: check, change rows, audit, event, commit, answer', () => {
  it('commits everything together; the answer comes after the commit', async () => {
    const before = await stored();
    const outcome = await core.app.pipeline.run('test.handler', async (unit) => {
      const changed = await unit.query('UPDATE public.operators SET enabled = false, updated_at = $2 WHERE id = $1 AND enabled RETURNING id', [
        'OPR-003',
        core.clock.now(),
      ]);
      // A made-up code of this test, which is about the unit and not about the answer: `ApiFailure.code` is the
      // contract's vocabulary (review finding CPB1-9), so it needs the cast.
      if (changed.rowCount !== 1) throw new ApiFailure(409, 'NOT_ENABLED' as ApiErrorCode, 'The operator is not enabled.');
      const row = await unit.audit.append({
        type: 'USER_DISABLED',
        actorId: 'OPR-002',
        deviceId: null,
        message: 'Operator disabled.',
        severity: 'WARNING',
        details: { targetOperatorId: 'OPR-003', sessionsEnded: 0, reason: 'Left the unit' },
      });
      const event = await unit.events.append({ type: 'AUTH_LOGOUT', message: 'Operator disabled.', params: { operatorId: 'OPR-003' } });
      return { row, event };
    });

    // Read on another connection, as another role: it is committed.
    expect(await operatorEnabled('OPR-003')).toBe(false);
    const after = await stored();
    expect(after).toEqual({
      head: { seq: outcome.row.seq, hash: outcome.row.hash },
      rows: before.rows + 1,
      events: before.events + 1,
      counter: (before.counter ?? 0) + 1,
    });
    expect(outcome.row).toMatchObject({
      seq: before.head.seq + 1,
      id: `AUD-${String(before.head.seq + 1).padStart(6, '0')}`,
      type: 'USER_DISABLED',
      category: 'SECURITY',
      severity: 'WARNING',
      actorId: 'OPR-002',
      prevHash: before.head.hash,
      at: CLOCK_START,
    });
    expect(outcome.event).toMatchObject({ seq: before.counter, id: `LOG-${String(before.counter).padStart(6, '0')}`, type: 'AUTH_LOGOUT' });
    expect((await readTrail(owner)).at(-1)).toEqual(outcome.row);
    await owner.query('UPDATE public.operators SET enabled = true WHERE id = $1', ['OPR-003']);
  });

  it('a unit that throws leaves no row, does not advance the head, consumes no event number, and rejects with what was thrown', async () => {
    const before = await stored();
    const failure = new Error('the handler failed after it wrote');
    const error = await caught(
      core.app.pipeline.run('test.failing', async (unit) => {
        await unit.query('UPDATE public.operators SET enabled = false WHERE id = $1', ['OPR-003']);
        await unit.audit.appendMany([entry('Written and rolled back, one'), entry('Written and rolled back, two')]);
        await unit.events.appendMany([
          { type: 'AUTOSAVE', message: 'Rolled back' },
          { type: 'AUTOSAVE', message: 'Rolled back too' },
        ]);
        expect(unit.audit.appended()).toHaveLength(2);
        throw failure;
      }),
    );
    expect(error).toBe(failure);
    expect(await stored()).toEqual(before);
    expect(await operatorEnabled('OPR-003')).toBe(true);

    // The next unit takes the very next sequence and the very next event number: no gap.
    const next = await core.app.pipeline.run('test.next', async (unit) => ({
      row: await unit.audit.append(entry('The unit after the failed one')),
      event: await unit.events.append({ type: 'AUTOSAVE', message: 'After the failed one' }),
    }));
    expect(next.row.seq).toBe(before.head.seq + 1);
    expect(next.row.prevHash).toBe(before.head.hash);
    expect(next.event.seq).toBe(before.counter);
  });

  it('a refusal (ApiFailure) thrown inside a unit rolls back and reaches the caller as it is', async () => {
    const before = await stored();
    const refusal = new ApiFailure(409, 'LAST_ADMIN', 'At least one administrator must remain.');
    const error = await caught(
      core.app.pipeline.run('test.refusing', async (unit) => {
        await unit.audit.append(entry('Written before the refusal'));
        throw refusal;
      }),
    );
    expect(error).toBe(refusal);
    expect(await stored()).toEqual(before);
  });

  it('a statement that failed marks the unit: it cannot commit, also when the work caught the failure', async () => {
    const before = await stored();
    const error = await caught(
      core.app.pipeline.run('test.swallowing', async (unit) => {
        await unit.audit.append(entry('Written before the failing statement'));
        await unit.query('SELECT 1 / $1::int AS impossible', [0]).catch(() => undefined);
        return 'the work returned normally';
      }),
    );
    expect(error).toMatchObject({ code: '22012' });
    expect(await stored()).toEqual(before);
  });
});

describe('what a unit refuses, before a statement is sent', () => {
  it('transaction control, a session setting, the query builder\'s own transaction, and an insert into audit_log or events', async () => {
    const before = await stored();
    const refusals: string[] = [];
    // The query builder wraps what its statements throw; the refusal is then the cause.
    const refused = async (work: () => Promise<unknown>): Promise<void> => {
      const error = await caught(work());
      expect(error).toBeInstanceOf(Error);
      refusals.push(String(sqlStateOf(error)));
    };

    const row = await core.app.pipeline.run('test.guards', async (unit) => {
      await unit.query('SELECT 1'); // the transaction is open
      for (const statement of ['COMMIT', '  rollback', '/* a comment */ BEGIN', '-- a comment\nSAVEPOINT a', 'RELEASE a', 'END', 'ABORT']) {
        await refused(() => unit.query(statement));
      }
      await refused(() => unit.query('SET statement_timeout = 0'));
      await refused(() => unit.query('RESET ALL'));
      await refused(() => unit.query('CREATE TEMP TABLE audit_log (seq bigint)'));
      await refused(() => unit.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"));
      await refused(() => unit.db.transaction(async () => undefined));
      await refused(() => unit.db.insert(auditLog).values({ seq: 1, id: 'AUD-000001', at: 1, type: 'X', category: 'SYSTEM', severity: 'INFO', message: 'm', prevHash: 'a', hash: 'b' }));
      await refused(() => unit.db.insert(eventsTable).values({ seq: 1, id: 'LOG-000001', at: 1, type: 'X', category: 'SYSTEM', severity: 'INFO', message: 'm' }));
      await refused(() => unit.query('INSERT INTO public.events (seq) VALUES ($1)', [1]));
      await refused(() => unit.query('WITH x AS (SELECT 1) INSERT INTO audit_log (seq) SELECT 1 FROM x'));
      // A setting that ends with the transaction is allowed.
      await unit.query("SET LOCAL lock_timeout = '1s'");
      // None of the refusals reached the server: the transaction is not in the failed state.
      expect((await unit.query<{ one: number }>('SELECT 1 AS one')).rows).toEqual([{ one: 1 }]);
      return unit.audit.append(entry('The unit commits after sixteen refusals'));
    });

    expect(refusals).toEqual(Array.from({ length: 16 }, () => 'UNIT_STATEMENT_NOT_ALLOWED'));
    expect(row.seq).toBe(before.head.seq + 1);
    expect((await stored()).rows).toBe(before.rows + 1);
  });

  it('a row that breaks a rule of the writers: the unit stays usable, so no statement had been sent', async () => {
    const before = await stored();
    const codes: string[] = [];
    await core.app.pipeline.run('test.validation', async (unit) => {
      await unit.query('SELECT 1');
      const attempts: Array<() => Promise<unknown>> = [
        () => unit.audit.append({ ...entry('Unknown type'), type: 'NOT_A_TYPE' } as never),
        () => unit.audit.append(entry('A key that may name a secret', { password: 'x' })),
        () => unit.audit.append(entry('A nested value', { nested: { a: 1 } as never })),
        () => unit.audit.append(entry('A value in the form of a session token', { note: `ses_${'a'.repeat(43)}` })),
        () => unit.audit.append({ ...entry('A typed name as the actor'), actorId: 'someone@example.test' }),
        () => unit.audit.append({ type: 'ACCESS_DENIED', actorId: 'OPR-003', deviceId: null, message: 'Denied', details: { operationId: 'startSession', body: 'x' } }),
        () => unit.audit.append({ type: 'PAIRING_CODE_ISSUED', actorId: 'OPR-002', deviceId: null, message: 'Issued', details: { codeId: 'PCD-000001' } }),
        () => unit.events.append({ type: 'NOT_AN_EVENT', message: 'Unknown event type' } as never),
        () => unit.events.append({ type: 'AUTOSAVE', message: 'A forbidden key', params: { token: 'x' } }),
      ];
      for (const attempt of attempts) {
        const error = await caught(attempt());
        expect(error).toBeInstanceOf(CoreError);
        codes.push((error as CoreError).code);
        // After a statement that a CHECK refused, this would fail with SQLSTATE 25P02.
        expect((await unit.query<{ one: number }>('SELECT 1 AS one')).rows).toEqual([{ one: 1 }]);
      }
      await unit.audit.append({
        type: 'ACCESS_DENIED',
        actorId: 'OPR-003',
        deviceId: null,
        message: 'Access denied.',
        details: { operationId: 'startSession', permission: 'SESSION_START', role: 'TECHNICIAN' },
      });
    });
    expect(codes).toEqual([
      'AUDIT_TYPE_UNKNOWN',
      'AUDIT_DETAIL_KEY_FORBIDDEN',
      'AUDIT_DETAILS_NOT_FLAT',
      'AUDIT_SECRET_SHAPED_VALUE',
      'AUDIT_ACTOR_INVALID',
      'AUDIT_DETAIL_KEY_NOT_ALLOWED',
      'AUDIT_DETAIL_MISSING',
      'EVENT_TYPE_UNKNOWN',
      'EVENT_PARAM_KEY_FORBIDDEN',
    ]);
    const after = await stored();
    expect(after.rows).toBe(before.rows + 1);
    expect(after.events).toBe(before.events);
    expect((await readTrail(owner)).at(-1)).toMatchObject({ type: 'ACCESS_DENIED', category: 'SECURITY', actorId: 'OPR-003' });
  });
});

describe('an insert of the writers that the database refuses', () => {
  it('reaches the caller as the driver\'s error with its SQLSTATE, never as the query builder\'s wrapper that quotes the row', async () => {
    const before = await stored();
    const MARK = 'MARK-unknown-actor-19f2';
    // The actor has the form of an operator ID and names nobody: the foreign key refuses the row.
    const error = await caught(
      core.app.pipeline.run('test.foreignKey', (unit) =>
        unit.audit.append({ type: 'NOTE_ADDED', actorId: 'OPR-999', deviceId: null, message: MARK, details: { note: MARK } }),
      ),
    );
    expect(error).toMatchObject({ code: '23503', constraint: 'audit_log_actor_id_fkey' });
    expect(String((error as Error).message)).not.toContain('Failed query');
    expect(String((error as Error).message)).not.toContain(MARK);
    expect(await stored()).toEqual(before);
  });
});

describe('the typed query builder on the unit', () => {
  it('reads and writes inside the unit\'s transaction and rolls back with it', async () => {
    const error = await caught(
      core.app.pipeline.run('test.builder', async (unit) => {
        const [head] = await unit.db.select().from(auditChainHead);
        expect(head?.seq).toBe((await unit.audit.head()).seq);
        await unit.db.update(operators).set({ enabled: false }).where(eq(operators.id, 'OPR-001'));
        const [inside] = await unit.db.select({ enabled: operators.enabled }).from(operators).where(eq(operators.id, 'OPR-001'));
        expect(inside?.enabled).toBe(false);
        // Not committed: another connection still sees the old value.
        expect(await operatorEnabled('OPR-001')).toBe(true);
        throw new Error('roll it back');
      }),
    );
    expect((error as Error).message).toBe('roll it back');
    expect(await operatorEnabled('OPR-001')).toBe(true);
  });
});

describe('the seam app.auditWriter and the bare handle', () => {
  it('appends inside the caller\'s unit; a handle the pipeline did not issue, or one whose unit ended, is refused', async () => {
    const before = await stored();
    let leaked: UnitContext | undefined;
    await core.app.pipeline.run('rbac.denied', async (unit) => {
      leaked = unit;
      expect(unitContextOf(unit)).toBe(unit);
      await core.app.auditWriter.append(unit, {
        type: 'ACCESS_DENIED',
        actorId: 'OPR-003',
        deviceId: null,
        message: 'Access denied.',
        details: { operationId: 'exportAudit', permission: 'AUDIT_EXPORT', role: 'TECHNICIAN' },
      });
    });
    expect((await stored()).rows).toBe(before.rows + 1);

    await expect(core.app.auditWriter.append({ label: 'made.up' }, entry('Not a unit'))).rejects.toMatchObject({ code: 'UNIT_NOT_ACTIVE' });
    await expect(core.app.auditWriter.append(leaked as UnitContext, entry('After the end'))).rejects.toMatchObject({ code: 'UNIT_ENDED' });
    await expect((leaked as UnitContext).query('SELECT 1')).rejects.toMatchObject({ code: 'UNIT_ENDED' });
    await expect((leaked as UnitContext).events.append({ type: 'AUTOSAVE', message: 'After the end' })).rejects.toMatchObject({ code: 'UNIT_ENDED' });
    expect(() => (leaked as UnitContext).db).toThrow(CoreError);
    expect(() => (leaked as UnitContext).afterCommit(() => undefined)).toThrow(CoreError);
    expect((await stored()).rows).toBe(before.rows + 1);
  });
});

describe('the event writer', () => {
  it('takes consecutive numbers from the counter in one statement; the category is derived with the shared code', async () => {
    const before = await stored();
    const first = before.counter as number;
    const appended = await core.app.pipeline.run('test.events', (unit) =>
      unit.events.appendMany([
        { type: 'PAIRED', message: 'Device paired', deviceId: 'DEV-0001' },
        { type: 'FAULT_RAISED', message: 'Fault raised', severity: 'CRITICAL', params: { kind: 'GNSS_LOSS' } },
        { type: 'FAULT_RAISED', message: 'Fault raised', severity: 'WARNING', params: { kind: 'TAMPER' } },
      ]),
    );
    expect(appended.map((event) => event.seq)).toEqual([first, first + 1, first + 2]);
    expect(appended.map((event) => event.id)).toEqual([first, first + 1, first + 2].map((seq) => `LOG-${String(seq).padStart(6, '0')}`));
    const storedEvents = (await readEvents(owner)).slice(-3);
    expect(storedEvents.map((event) => event.category)).toEqual(['NETWORK', 'TIME', 'SECURITY']);
    expect(storedEvents.map((event) => event.params)).toEqual([{}, { kind: 'GNSS_LOSS' }, { kind: 'TAMPER' }]);
    expect(await readEventCounter(owner)).toBe(first + 3);
  });

  it('a database without the counter row (never seeded): refused by its code, nothing stored', async () => {
    const clone = await db.another({ slug: 'core_no_counter' });
    await seedMinimum(clone.ownerPool(), false);
    const other = await coreApp(clone, db.run.dataDir);
    const error = await caught(
      other.app.pipeline.run('test.unseeded', async (unit) => {
        await unit.audit.append(entry('Before the event'));
        return unit.events.append({ type: 'AUTOSAVE', message: 'No counter' });
      }),
    );
    expect(error).toBeInstanceOf(CoreError);
    expect((error as CoreError).code).toBe('EVENT_COUNTER_MISSING');
    expect(await readHead(clone.ownerPool())).toMatchObject({ seq: 0 });
    expect(await readEvents(clone.ownerPool())).toEqual([]);
  });
});

describe('the watchdog: a unit that runs too long', () => {
  it('a statement that does not return: the unit is abandoned after the limit, nothing is stored, the queue goes on', async () => {
    const { pipeline } = separatePipeline({ unitTimeoutMs: 400 });
    const before = await stored();
    const started = performance.now();
    const error = await caught(
      pipeline.run('test.slow', async (unit) => {
        await unit.audit.append(entry('Written by a unit that then hangs'));
        await unit.query('SELECT pg_sleep(5)');
      }),
    );
    const waited = performance.now() - started;
    expect(error).toBeInstanceOf(PipelineFailure);
    expect(error).toMatchObject({ statusCode: 503, code: 'NOT_READY', reason: 'UNIT_TIMEOUT' });
    expect(waited).toBeGreaterThanOrEqual(390);
    expect(waited).toBeLessThan(2_500);

    // The same queue, the next unit: it gets the head the abandoned unit never moved.
    const next = await pipeline.run('test.afterSlow', (unit) => unit.audit.append(entry('The unit after the abandoned one')));
    expect(next.seq).toBe(before.head.seq + 1);
    expect(next.prevHash).toBe(before.head.hash);
    expect((await stored()).rows).toBe(before.rows + 1);
    expect(pipeline.snapshot()).toMatchObject({ timedOut: 1, completed: 1, pending: 0, running: null });
    console.info(`[w21] watchdog: abandoned after ${Math.round(waited)} ms (limit 400 ms); the next unit committed seq ${next.seq}`);
  });

  it('a unit that waits for something that never comes while it holds the chain lock: the lock is given up', async () => {
    const { pipeline } = separatePipeline({ unitTimeoutMs: 300 });
    const before = await stored();
    const error = await caught(
      pipeline.run('test.stuck', async (unit) => {
        await unit.audit.append(entry('Written by a unit that never returns'));
        await new Promise<never>(() => undefined);
      }),
    );
    expect(error).toMatchObject({ reason: 'UNIT_TIMEOUT' });
    // Another connection gets the lock at once: the abandoned connection was closed.
    const started = performance.now();
    const next = await core.app.pipeline.run('test.afterStuck', (unit) => unit.audit.append(entry('Appended on another connection')));
    expect(performance.now() - started).toBeLessThan(1_500);
    expect(next.seq).toBe(before.head.seq + 1);
  });

  it('the statement limit is set for the unit only: 5 s inside it, the server default after it', async () => {
    const { pipeline, pool } = separatePipeline();
    const inside = await pipeline.run('test.limit', async (unit) => {
      const { rows } = await unit.query<{ value: string; isolation: string }>(
        "SELECT current_setting('statement_timeout') AS value, current_setting('transaction_isolation') AS isolation",
      );
      return rows[0];
    });
    expect(inside).toEqual({ value: '5s', isolation: 'read committed' });
    const outside = await pool.query<{ value: string }>("SELECT current_setting('statement_timeout') AS value");
    expect(outside.rows).toEqual([{ value: '0' }]);
  });
});

describe('what a unit costs (measured, not asserted beyond sanity)', () => {
  it('200 units of one audit row each, and 200 units that touch no table', async () => {
    const { pipeline } = separatePipeline();
    const before = await stored();
    let started = performance.now();
    await Promise.all(Array.from({ length: 200 }, (_, index) => pipeline.run('test.cost', (unit) => unit.audit.append(entry(`Cost ${index}`, { index })))));
    const withRow = performance.now() - started;
    started = performance.now();
    await Promise.all(Array.from({ length: 200 }, (_, index) => pipeline.run('test.idle', () => index)));
    const withoutTable = performance.now() - started;
    expect((await stored()).rows).toBe(before.rows + 200);
    expect(withRow).toBeLessThan(20_000);
    console.info(
      `[w21] cost: 200 units with one audit row in ${Math.round(withRow)} ms (${(withRow / 200).toFixed(2)} ms a unit: BEGIN, lock, limit, INSERT, COMMIT); ` +
        `200 units without a statement in ${Math.round(withoutTable)} ms (${(withoutTable / 200).toFixed(2)} ms a unit)`,
    );
  });
});

describe('shutdown', () => {
  it('close() lets the accepted units commit, in order, and refuses every later one', async () => {
    const { pipeline } = separatePipeline();
    const before = await stored();
    const accepted = [0, 1, 2, 3, 4].map((index) =>
      pipeline.run('test.draining', async (unit) => {
        await sleep(10);
        return unit.audit.append(entry(`Accepted before the close, ${index}`, { index }));
      }),
    );
    const closed = pipeline.close();
    const late = await caught(pipeline.run('test.late', (unit) => unit.audit.append(entry('After the close'))));
    expect(late).toBeInstanceOf(PipelineFailure);
    expect(late).toMatchObject({ statusCode: 503, reason: 'CLOSED' });

    const rows = await Promise.all(accepted);
    await closed;
    expect(rows.map((row) => row.seq)).toEqual([1, 2, 3, 4, 5].map((offset) => before.head.seq + offset));
    expect(rows.map((row) => row.details['index'])).toEqual([0, 1, 2, 3, 4]);
    expect(pipeline.snapshot()).toMatchObject({ accepting: false, completed: 5, pending: 0, running: null, refused: 1 });
    expect((await stored()).rows).toBe(before.rows + 5);
  });

  it('closing the app closes its pipeline before its pool: a unit in flight commits, a later one is refused', async () => {
    const other = await coreApp(db, db.run.dataDir);
    const before = await stored();
    const inFlight = other.app.pipeline.run('test.inFlight', async (unit) => {
      await unit.audit.head();
      await sleep(30);
      return unit.audit.append(entry('In flight while the app closes'));
    });
    await sleep(5);
    await other.app.close();
    const row = await inFlight;
    expect(row.seq).toBe(before.head.seq + 1);
    await expect(other.app.pipeline.run('test.afterClose', async () => 1)).rejects.toMatchObject({ reason: 'CLOSED' });
    expect((await stored()).head).toEqual({ seq: row.seq, hash: row.hash });
  });
});

describe('the log: codes and numbers, never the content of a row', () => {
  it('at level trace, a unit that appends, one that is refused and one that fails leave none of their values', async () => {
    const MARK = {
      message: 'MARK-message-7f3a',
      detail: 'MARK-detail-91bc',
      device: 'MARK-device-2d4e',
      session: 'MARK-session-66a0',
      evidence: 'MARK-evidence-c1c1',
      eventMessage: 'MARK-event-0c1e',
      param: 'MARK-param-55d0',
      refusedValue: `ses_${'M'.repeat(43)}`,
      refusedNeighbour: 'MARK-neighbour-e9f1',
      statementValue: 'MARK-statement-4b7d',
      thrown: 'MARK-thrown-a8a8',
    };
    const from = core.log.lines().length;

    await core.app.pipeline.run('test.logged', async (unit) => {
      await unit.audit.append({
        type: 'NOTE_ADDED',
        actorId: 'OPR-004',
        deviceId: MARK.device,
        sessionId: MARK.session,
        evidenceId: MARK.evidence,
        message: MARK.message,
        details: { note: MARK.detail },
      });
      await unit.events.append({ type: 'NOTE_ADDED', message: MARK.eventMessage, params: { note: MARK.param }, sessionId: MARK.session });
    });
    await caught(
      core.app.pipeline.run('test.loggedRefusal', (unit) =>
        unit.audit.append(entry(MARK.refusedNeighbour, { value: MARK.refusedValue, other: MARK.refusedNeighbour })),
      ),
    );
    await caught(
      core.app.pipeline.run('test.loggedFailure', async (unit) => {
        await unit.query('SELECT $1::text AS value, 1 / 0', [MARK.statementValue]);
      }),
    );
    await caught(
      core.app.pipeline.run('test.loggedThrow', async () => {
        throw new Error(MARK.thrown);
      }),
    );

    const lines = core.log.lines().slice(from);
    const text = lines.map((line) => JSON.stringify(line)).join('\n');
    for (const value of Object.values(MARK)) expect(text, value).not.toContain(value);
    expect(text).not.toContain('OPR-004');

    const messages = lines.map((line) => line['msg']);
    expect(messages).toEqual([
      'audit row appended',
      'event appended',
      'unit completed',
      'audit row refused',
      'unit rolled back',
      'unit rolled back',
      'unit rolled back',
    ]);
    expect(lines[0]).toMatchObject({ label: 'test.logged', type: 'NOTE_ADDED' });
    expect(lines[2]).toMatchObject({ label: 'test.logged', committed: true, audit: 1, events: 1 });
    expect(lines[3]).toMatchObject({ label: 'test.loggedRefusal', code: 'AUDIT_SECRET_SHAPED_VALUE' });
    expect(lines[4]).toMatchObject({ label: 'test.loggedRefusal', code: 'AUDIT_SECRET_SHAPED_VALUE' });
    expect(lines[5]).toMatchObject({ label: 'test.loggedFailure', code: '22012' });
    expect(lines[6]).toMatchObject({ label: 'test.loggedThrow', code: 'Error' });

    // Every line holds only these members.
    const allowed = new Set(['level', 'time', 'pid', 'hostname', 'msg', 'unit', 'label', 'seq', 'type', 'code', 'ms', 'committed', 'audit', 'events']);
    for (const line of lines) expect(Object.keys(line).filter((key) => !allowed.has(key))).toEqual([]);
  });
});

describe('at the end of the file', () => {
  it('the chain of this database verifies over all rows', async () => {
    const rows = await readTrail(owner);
    const head = await readHead(owner);
    expect(linkProblems(rows)).toEqual([]);
    expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
  });
});
