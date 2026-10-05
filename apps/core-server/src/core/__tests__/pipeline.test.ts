// The serial unit-of-work queue, database-free (plan row W21; spec §2.3 stages 8 to 10, ENG-1,
// ENG-5, ENG-6, ENG-23; SR-72): order, atomicity of the statement sequence, the bounded length,
// the watchdog, nesting, shutdown, and what runs after a commit.
//
// The pool is a stand-in that records every statement and applies a transaction's writes at
// COMMIT (`support.ts`). The same behaviour against PostgreSQL is in the `*.db.test.ts` files.
import { appendActivity, createManualClock, type ActivitySlices, type AuditRow, type SimEvent } from '@dems/shared/sim';
import { afterAll, describe, expect, it } from 'vitest';
import { RUNTIME_SEARCH_PATH } from '../../plugins/db';
import { CoreError, PipelineFailure, sqlStateOf } from '../errors';
import { EVENT_COUNTER_ADVANCE, EVENT_COUNTER_RAISE } from '../event-writer';
import { PIPELINE_CLOSE_TIMEOUT_MS, PIPELINE_MAX_PENDING, PIPELINE_UNIT_TIMEOUT_MS } from '../limits';
import { PIPELINE_LIMITS, createPipeline, type PipelineLimits } from '../pipeline';
import type { CommittedUnit, Pipeline, UnitContext } from '../types';
import { UNIT_STATEMENTS, isTransactionControl, isWriterOwnedInsert, stateOf } from '../unit-of-work';
import { CLOCK_START, GENESIS, recordingErrorLog, sleep, standInDatabase, testLogger, type StandInDatabase, type StandInOptions } from './support';

const logger = testLogger('trace');
afterAll(() => logger.close());

interface Rig {
  readonly pipeline: Pipeline;
  readonly database: StandInDatabase;
  readonly clock: ReturnType<typeof createManualClock>;
  readonly errorLog: ReturnType<typeof recordingErrorLog>;
  readonly databaseFailures: { count: number };
  /** What the pipeline told readiness, in order: `lost` (a unit lost its connection), `failure`. */
  readonly told: string[];
  /** The log lines written since this rig was built. */
  lines(): Array<Record<string, unknown>>;
}

function rig(limits: Partial<PipelineLimits> = {}, options: StandInOptions = {}): Rig {
  const database = standInDatabase(options);
  const clock = createManualClock(CLOCK_START);
  const errorLog = recordingErrorLog();
  const databaseFailures = { count: 0 };
  const told: string[] = [];
  const from = logger.captured.lines().length;
  const pipeline = createPipeline({
    pool: () => database.pool,
    clock,
    log: logger.log,
    errorLog,
    limits,
    onDatabaseFailure: () => {
      databaseFailures.count += 1;
      told.push('failure');
    },
    onConnectionLost: () => void told.push('lost'),
  });
  return { pipeline, database, clock, errorLog, databaseFailures, told, lines: () => logger.captured.lines().slice(from) };
}

const caught = <T>(work: Promise<T>): Promise<unknown> =>
  work.then(
    () => null,
    (error: unknown) => error,
  );

const entry = (message: string) => ({ type: 'SYSTEM_BOOT', actorId: null, deviceId: null, message, details: {} }) as const;

/** A promise and the function that resolves it. */
function gate(): { readonly opened: Promise<void>; open(): void } {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open };
}

const OPENING = [UNIT_STATEMENTS.begin, UNIT_STATEMENTS.chainLock, UNIT_STATEMENTS.settings];

// AP-4 as the query builder writes it for the typed tables of the schema: one INSERT per row,
// the columns of the contract in the contract's order, every value a bind parameter.
const AUDIT_INSERT =
  'insert into "audit_log" ("seq", "id", "at", "type", "category", "severity", "actor_id", "message", ' +
  '"session_id", "evidence_id", "device_id", "details", "prev_hash", "hash") ' +
  'values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)';
const EVENT_INSERT =
  'insert into "events" ("seq", "id", "at", "type", "category", "severity", "message", "params", "session_id", "device_id") ' +
  'values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)';

describe('the limits', () => {
  it('are the constants of limits.ts: 256 waiting, 5 s a unit, 6 s to close', () => {
    expect(PIPELINE_LIMITS).toEqual({ maxPending: 256, unitTimeoutMs: 5_000, closeTimeoutMs: 6_000 });
    expect([PIPELINE_MAX_PENDING, PIPELINE_UNIT_TIMEOUT_MS, PIPELINE_CLOSE_TIMEOUT_MS]).toEqual([256, 5_000, 6_000]);
  });
});

describe('order (ENG-6)', () => {
  it('units submitted together run strictly one after another, in the order of submission', async () => {
    const { pipeline, database } = rig();
    const trace: string[] = [];
    let inside = 0;
    let most = 0;
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        pipeline.run('test.order', async (unit) => {
          inside += 1;
          most = Math.max(most, inside);
          trace.push(`start ${index}`);
          await unit.audit.append(entry(`Unit ${index}`));
          await sleep((20 - index) % 5); // later units are quicker: order must not follow speed
          trace.push(`end ${index}`);
          inside -= 1;
          return index;
        }),
      ),
    );
    expect(results).toEqual(Array.from({ length: 20 }, (_, index) => index));
    expect(trace).toEqual(Array.from({ length: 20 }, (_, index) => [`start ${index}`, `end ${index}`]).flat());
    expect(most).toBe(1);
    expect(database.committed.auditSeqs).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    // Twenty transactions, never nested: each BEGIN is followed by its COMMIT before the next.
    const control = database.statements.filter((text) => text === UNIT_STATEMENTS.begin || text === UNIT_STATEMENTS.commit);
    expect(control).toEqual(Array.from({ length: 20 }, () => [UNIT_STATEMENTS.begin, UNIT_STATEMENTS.commit]).flat());
    expect(database.connections).toEqual({ opened: 20, released: 20, destroyed: 0 });
  });

  it('the work never runs inside the caller\'s own turn, and the caller continues before the next unit starts', async () => {
    const { pipeline } = rig();
    const trace: string[] = [];
    const first = pipeline.run('test.turn', () => void trace.push('first runs')).then(() => void trace.push('first caller continues'));
    const second = pipeline.run('test.turn', () => void trace.push('second runs'));
    trace.push('submitted');
    await Promise.all([first, second]);
    expect(trace).toEqual(['submitted', 'first runs', 'first caller continues', 'second runs']);
  });
});

describe('one unit, one transaction', () => {
  it('the statements of a unit that appends a row and an event, exactly', async () => {
    const { pipeline, database } = rig();
    const result = await pipeline.run('test.statements', async (unit) => {
      const row = await unit.audit.append(entry('One row'));
      const event = await unit.events.append({ type: 'AUTOSAVE', message: 'One event' });
      await unit.query('UPDATE public.operators SET enabled = $2 WHERE id = $1', ['OPR-001', false]);
      return { row, event };
    });
    expect(database.statements).toEqual([
      'BEGIN ISOLATION LEVEL READ COMMITTED',
      'SELECT seq, hash FROM public.audit_chain_lock()',
      "SELECT set_config('statement_timeout', $1, true), set_config('search_path', $2, true)",
      AUDIT_INSERT,
      EVENT_COUNTER_ADVANCE,
      EVENT_INSERT,
      'UPDATE public.operators SET enabled = $2 WHERE id = $1',
      'COMMIT',
    ]);
    expect(result.row).toMatchObject({ seq: 1, id: 'AUD-000001', at: CLOCK_START, category: 'SYSTEM', severity: 'INFO' });
    expect(result.event).toMatchObject({ seq: 1, id: 'LOG-000001', at: CLOCK_START });
    expect(database.committed).toMatchObject({ head: { seq: 1, hash: result.row.hash }, auditSeqs: [1], eventSeqs: [1], eventCounter: 2 });
  });

  it('the third statement carries the unit\'s statement limit and the pinned search path, for the transaction only', async () => {
    const { pipeline, database } = rig({ unitTimeoutMs: 1_234 });
    await pipeline.run('test.settings', (unit) => unit.query('SELECT 1'));
    const settings = database.sent.find((statement) => statement.text === UNIT_STATEMENTS.settings);
    expect(settings?.values).toEqual(['1234', RUNTIME_SEARCH_PATH]);
    expect(RUNTIME_SEARCH_PATH).toBe('public,pg_temp');
    // Both are set with the third argument `true`: local to the transaction.
    expect(UNIT_STATEMENTS.settings).toBe("SELECT set_config('statement_timeout', $1, true), set_config('search_path', $2, true)");
    // One statement, so no round trip more than before.
    expect(database.statements).toEqual([...OPENING, 'SELECT 1', UNIT_STATEMENTS.commit]);
    expect(OPENING).toHaveLength(3);
  });

  it('the category column of an event is derived with the shared code: a fault event takes its fault kind\'s', async () => {
    const { pipeline, database } = rig();
    await pipeline.run('test.categories', (unit) =>
      unit.events.appendMany([
        { type: 'PAIRED', message: 'Paired' },
        { type: 'FAULT_RAISED', message: 'Fault raised', params: { kind: 'STORAGE_FULL' } },
        { type: 'FAULT_CLEARED', message: 'Fault cleared', params: { kind: 'TPM_FAILURE' } },
        { type: 'FAULT_RAISED', message: 'Fault raised, kind unknown' },
      ]),
    );
    expect(database.committed.eventCategories).toEqual(['NETWORK', 'STORAGE', 'SECURITY', 'DEVICE']);
    expect(database.committed.eventSeqs).toEqual([1, 2, 3, 4]);
  });

  it('a unit that touches no table opens no transaction and takes no connection', async () => {
    const { pipeline, database } = rig();
    const tasks: string[] = [];
    const seen: CommittedUnit[] = [];
    pipeline.onCommit((unit) => seen.push(unit));
    const value = await pipeline.run('engine.tick', (unit) => {
      unit.afterCommit(() => tasks.push('after'));
      return 42; // a synchronous work function is a unit too
    });
    expect(value).toBe(42);
    expect(database.statements).toEqual([]);
    expect(database.connections.opened).toBe(0);
    expect(tasks).toEqual(['after']);
    expect(seen).toEqual([]);
    expect(pipeline.snapshot()).toMatchObject({ completed: 1, failed: 0 });
  });

  it('the chain lock is taken by every unit that opens a transaction, before its first statement (AT-2, AP-7)', async () => {
    const { pipeline, database } = rig();
    await pipeline.run('test.readOnly', (unit) => unit.query('SELECT 1'));
    expect(database.statements).toEqual([...OPENING, 'SELECT 1', UNIT_STATEMENTS.commit]);
  });

  it('two appends started together in one unit run one after the other: consecutive sequences', async () => {
    const { pipeline, database } = rig();
    const rows = await pipeline.run('test.together', (unit) => Promise.all([unit.audit.append(entry('A')), unit.audit.append(entry('B'))]));
    expect(rows.map((row) => row.seq)).toEqual([1, 2]);
    expect(rows[1]?.prevHash).toBe(rows[0]?.hash);
    expect(database.committed.auditSeqs).toEqual([1, 2]);
  });

  it('the pool is read when a unit starts: a pool that was replaced (a reset) is the one the next unit uses', async () => {
    const first = standInDatabase();
    const second = standInDatabase();
    let current = first;
    const pipeline = createPipeline({ pool: () => current.pool, clock: createManualClock(CLOCK_START), log: logger.log, errorLog: recordingErrorLog() });
    await pipeline.run('test.generation', (unit) => unit.audit.append(entry('On the first pool')));
    current = second;
    await pipeline.run('test.generation', (unit) => unit.audit.append(entry('On the second pool')));
    expect(first.committed.auditSeqs).toEqual([1]);
    expect(second.committed.auditSeqs).toEqual([1]);
  });
});

describe('never a half-written unit', () => {
  it('a unit that throws: ROLLBACK, the original error, nothing committed, and the next unit runs', async () => {
    const { pipeline, database } = rig();
    const failure = new Error('thrown by the work');
    const error = await caught(
      pipeline.run('test.throwing', async (unit) => {
        await unit.audit.append(entry('Rolled back'));
        await unit.events.append({ type: 'AUTOSAVE', message: 'Rolled back' });
        throw failure;
      }),
    );
    expect(error).toBe(failure);
    expect(database.statements.at(-1)).toBe('ROLLBACK');
    expect(database.statements).not.toContain('COMMIT');
    expect(database.committed).toMatchObject({ head: { seq: 0 }, auditSeqs: [], eventSeqs: [], eventCounter: 1 });
    expect(database.connections).toEqual({ opened: 1, released: 1, destroyed: 0 });

    const next = await pipeline.run('test.next', (unit) => unit.audit.append(entry('After the failed one')));
    expect(next.seq).toBe(1);
    expect(pipeline.snapshot()).toMatchObject({ completed: 1, failed: 1 });
  });

  it('a statement that failed: ROLLBACK, also when the work caught the failure; the rejection is that failure', async () => {
    const boom = Object.assign(new Error('division by zero'), { code: '22012' });
    const { pipeline, database } = rig({}, { failOn: (text) => (text.includes('1 / 0') ? boom : undefined) });
    const error = await caught(
      pipeline.run('test.swallowing', async (unit) => {
        await unit.audit.append(entry('Before the failing statement'));
        await unit.query('SELECT 1 / 0').catch(() => undefined);
        return 'returned normally';
      }),
    );
    expect(error).toBe(boom);
    expect(database.statements.at(-1)).toBe('ROLLBACK');
    expect(database.statements).not.toContain('COMMIT');
    expect(database.committed.auditSeqs).toEqual([]);
  });

  it('COMMIT that the server answers with ROLLBACK is not a commit: 503, the connection is closed, readiness is told', async () => {
    const { pipeline, database, databaseFailures, errorLog, lines } = rig({}, { commitAnswer: 'ROLLBACK' });
    const tasks: string[] = [];
    const error = await caught(
      pipeline.run('test.commit', async (unit) => {
        unit.afterCommit(() => tasks.push('must not run'));
        return unit.audit.append(entry('Not committed'));
      }),
    );
    expect(error).toBeInstanceOf(PipelineFailure);
    expect(error).toMatchObject({ statusCode: 503, code: 'NOT_READY', reason: 'COMMIT_FAILED' });
    expect(database.connections).toEqual({ opened: 1, released: 0, destroyed: 1 });
    expect(database.committed.auditSeqs).toEqual([]);
    expect(tasks).toEqual([]);
    expect(databaseFailures.count).toBe(1);
    expect(lines().find((line) => line['msg'] === 'unit not committed')).toMatchObject({ level: 50, code: 'COMMIT_FAILED', label: 'test.commit' });
    expect(errorLog.entries).toHaveLength(1);
    expect(errorLog.entries[0]).toMatchObject({ level: 'error', source: 'core.pipeline', context: { label: 'test.commit', reason: 'COMMIT_FAILED' } });
  });

  it('no connection: 503 with the cause, one persistent entry by the driver\'s code, readiness is told', async () => {
    const refusedConnection = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1'), { code: 'ECONNREFUSED' });
    const { pipeline, database, databaseFailures, errorLog } = rig({}, { connectError: refusedConnection });
    const error = await caught(pipeline.run('test.offline', (unit) => unit.query('SELECT 1')));
    expect(error).toMatchObject({ statusCode: 503, code: 'NOT_READY', reason: 'DATABASE_UNAVAILABLE' });
    expect((error as PipelineFailure).cause).toBe(refusedConnection);
    expect(database.statements).toEqual([]);
    expect(databaseFailures.count).toBe(1);
    expect(errorLog.entries[0]).toMatchObject({ source: 'core.pipeline', code: 'ECONNREFUSED', context: { reason: 'DATABASE_UNAVAILABLE' } });
    expect(JSON.stringify(errorLog.entries)).not.toContain('127.0.0.1:1');
  });

  it('an outage is announced once: one error line and one persistent entry until a unit commits again', async () => {
    const outage: { error: Error | undefined } = { error: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }) };
    const { pipeline, databaseFailures, errorLog, lines } = rig(
      {},
      {
        get connectError() {
          return outage.error;
        },
      },
    );
    const announced = (): number => lines().filter((line) => line['msg'] === 'unit not committed' && line['level'] === 50).length;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await caught(pipeline.run('engine.tick', (unit) => unit.query('SELECT 1')))).toMatchObject({ reason: 'DATABASE_UNAVAILABLE' });
    }
    expect(announced()).toBe(1);
    expect(errorLog.entries).toHaveLength(1);
    expect(lines().filter((line) => line['msg'] === 'unit not committed')).toHaveLength(5);
    // Readiness is told every time: the probe decides, and it reuses its own result.
    expect(databaseFailures.count).toBe(5);

    outage.error = undefined;
    await pipeline.run('engine.tick', (unit) => unit.query('SELECT 1'));
    outage.error = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    await caught(pipeline.run('engine.tick', (unit) => unit.query('SELECT 1')));
    expect(announced()).toBe(2);
    expect(errorLog.entries).toHaveLength(2);
  });

  it('the connection is lost while the unit holds it: the unit cannot commit, and the answer is 503 with the loss as its cause', async () => {
    // By-design change (checkpoint CP-B1, finding CPB1-6): this test expected the driver's own
    // error, which the error envelope answers with 500. A lost connection is "the database does
    // not answer": 503, and readiness is told.
    const { pipeline, database, told } = rig();
    const lost = Object.assign(new Error('Connection terminated unexpectedly'), { code: 'ECONNRESET' });
    const error = await caught(
      pipeline.run('test.lost', async (unit) => {
        await unit.audit.append(entry('Before the connection was lost'));
        database.breakConnection(lost);
      }),
    );
    expect(error).toBeInstanceOf(PipelineFailure);
    expect(error).toMatchObject({ statusCode: 503, code: 'NOT_READY', reason: 'DATABASE_UNAVAILABLE' });
    expect((error as PipelineFailure).cause).toBe(lost);
    expect(told).toEqual(['lost', 'failure']);
    expect(database.statements).not.toContain('COMMIT');
    expect(database.committed.auditSeqs).toEqual([]);
  });

  it('a row the database refuses as not continuing the chain (ZA001): 503 and one error line by the code', async () => {
    const refusal = Object.assign(new Error('audit chain: row 1 does not continue head 3'), { code: 'ZA001' });
    const { pipeline, database, errorLog, lines } = rig({}, { failOn: (text) => (text === AUDIT_INSERT ? refusal : undefined) });
    const error = await caught(pipeline.run('test.chain', (unit) => unit.audit.append(entry('Refused by the guard'))));
    expect(error).toMatchObject({ statusCode: 503, reason: 'AUDIT_CHAIN_REFUSED' });
    expect((error as PipelineFailure).cause).toBe(refusal);
    expect(database.statements.at(-1)).toBe('ROLLBACK');
    expect(lines().find((line) => line['msg'] === 'the audit chain refused a row')).toMatchObject({ level: 50, code: 'ZA001', seq: 1, label: 'test.chain' });
    expect(errorLog.entries[0]).toMatchObject({ source: 'core.auditWriter', code: 'ZA001' });
  });

  it('an insert of the writers that fails reaches the caller as the driver\'s error, not as the query builder\'s wrapper', async () => {
    const refusedRow = Object.assign(new Error('violates foreign key constraint'), { code: '23503', constraint: 'audit_log_actor_id_fkey' });
    const forAudit = rig({}, { failOn: (text) => (text === AUDIT_INSERT ? refusedRow : undefined) });
    const auditError = await caught(forAudit.pipeline.run('test.auditInsert', (unit) => unit.audit.append(entry('MARK-row-content-88e1'))));
    expect(auditError).toBe(refusedRow);

    const refusedEvent = Object.assign(new Error('duplicate key value'), { code: '23505', constraint: 'events_pkey' });
    const forEvents = rig({}, { failOn: (text) => (text === EVENT_INSERT ? refusedEvent : undefined) });
    const eventError = await caught(forEvents.pipeline.run('test.eventInsert', (unit) => unit.events.append({ type: 'AUTOSAVE', message: 'MARK-row-content-88e1' })));
    expect(eventError).toBe(refusedEvent);
    for (const error of [auditError, eventError]) expect(String((error as Error).message)).not.toContain('MARK-row-content-88e1');
    expect(forAudit.database.statements.at(-1)).toBe('ROLLBACK');
    expect(forEvents.database.statements.at(-1)).toBe('ROLLBACK');
    // The rolled-back line of the pipeline carries the SQLSTATE.
    expect(forAudit.lines().find((line) => line['msg'] === 'unit rolled back')).toMatchObject({ code: '23503', label: 'test.auditInsert' });
  });

  it('a row that breaks a rule of the writers is refused before any statement: nothing is sent', async () => {
    const { pipeline, database, errorLog } = rig();
    const error = await caught(
      pipeline.run('test.refused', (unit) => unit.audit.append({ ...entry('A key that may name a secret'), details: { token: 'x' } })),
    );
    expect(error).toBeInstanceOf(CoreError);
    expect((error as CoreError).code).toBe('AUDIT_DETAIL_KEY_FORBIDDEN');
    expect(database.statements).toEqual([]);
    expect(database.connections.opened).toBe(0);
    expect(errorLog.entries[0]).toMatchObject({ level: 'error', source: 'core.auditWriter', code: 'AUDIT_DETAIL_KEY_FORBIDDEN', context: { label: 'test.refused' } });
  });

  it('a clock that gives a fraction: refused before any statement (the column is a whole number)', async () => {
    const { pipeline, database, clock } = rig();
    clock.set(CLOCK_START + 0.5);
    const error = await caught(pipeline.run('test.clock', (unit) => unit.audit.append(entry('At half a millisecond'))));
    expect((error as CoreError).code).toBe('CLOCK_VALUE_INVALID');
    expect(database.statements).toEqual([]);
  });
});

describe('what a unit refuses, before a statement is sent', () => {
  it('transaction control and session settings, whatever stands before them', () => {
    for (const text of [
      'COMMIT',
      'commit;',
      '  ROLLBACK',
      'BEGIN',
      'begin isolation level serializable',
      'START TRANSACTION',
      'END',
      'ABORT',
      'SAVEPOINT a',
      'RELEASE SAVEPOINT a',
      'ROLLBACK TO SAVEPOINT a',
      'PREPARE TRANSACTION \'x\'',
      '/* c */ COMMIT',
      '-- c\nCOMMIT',
      '-- c\n  /* d */\n rollback',
      'SET statement_timeout = 0',
      'SET SESSION lock_timeout = 0',
      'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE',
      'RESET ALL',
      'DISCARD ALL',
      'CREATE TEMP TABLE audit_log (seq bigint)',
      'create temporary table events (seq bigint)',
      'CREATE TABLE public.x (a int)',
    ]) {
      expect(isTransactionControl(text), text).toBe(true);
    }
    for (const text of [
      'SELECT 1',
      'UPDATE public.operators SET enabled = $2 WHERE id = $1',
      'SET LOCAL lock_timeout = \'1s\'',
      'SET CONSTRAINTS ALL DEFERRED',
      'SELECT committed FROM t',
      'WITH ended AS (SELECT 1) SELECT * FROM ended',
      'select "end" from t',
      'SELECT created_at FROM public.operators',
    ]) {
      expect(isTransactionControl(text), text).toBe(false);
    }
  });

  it('an insert into audit_log or events that does not come from the two writers', () => {
    for (const text of [
      'INSERT INTO public.audit_log (seq) VALUES ($1)',
      'insert into audit_log (seq) values ($1)',
      'insert into "audit_log" ("seq", "id") values ($1, $2)',
      'INSERT INTO "public"."events" (seq) VALUES ($1)',
      'INSERT INTO ONLY public.events (seq) VALUES ($1)',
      'WITH x AS (SELECT 1) INSERT INTO events (seq) SELECT 1 FROM x',
      'MERGE INTO public.audit_log AS a USING s ON false WHEN NOT MATCHED THEN INSERT VALUES (1)',
      'insert\n  into\n  public.events (seq) values ($1)',
    ]) {
      expect(isWriterOwnedInsert(text), text).toBe(true);
    }
    for (const text of [
      'SELECT * FROM public.audit_log WHERE seq > $1',
      'INSERT INTO public.audit_chain_history (reset_no) VALUES ($1)',
      'INSERT INTO public.events_archive (seq) VALUES ($1)',
      'INSERT INTO public.evidence_custody (seq) VALUES ($1)',
      'UPDATE public.engine_counters SET next_value = next_value + $2 WHERE name = $1',
    ]) {
      expect(isWriterOwnedInsert(text), text).toBe(false);
    }
  });

  it('the refusals reach nothing: no statement, and the unit goes on and commits', async () => {
    const { pipeline, database } = rig();
    const codes = await pipeline.run('test.guards', async (unit) => {
      await unit.query('SELECT 1');
      const refusals = await Promise.all(
        [
          () => unit.query('COMMIT'),
          () => unit.query('SAVEPOINT a'),
          () => unit.query('SET statement_timeout = 0'),
          () => unit.query('CREATE TEMP TABLE audit_log (seq bigint)'),
          () => unit.query('INSERT INTO public.audit_log (seq) VALUES ($1)', [1]),
          () => unit.query('INSERT INTO public.events (seq) VALUES ($1)', [1]),
          () => unit.db.transaction(async () => undefined),
        ].map((attempt) => caught(attempt())),
      );
      await unit.audit.append(entry('After seven refusals'));
      return refusals.map((error) => sqlStateOf(error));
    });
    expect(codes).toEqual(Array.from({ length: 7 }, () => 'UNIT_STATEMENT_NOT_ALLOWED'));
    expect(database.statements).toEqual([...OPENING, 'SELECT 1', AUDIT_INSERT, UNIT_STATEMENTS.commit]);
    expect(database.committed.auditSeqs).toEqual([1]);
  });

  it('a handle that outlived its unit: every tool refuses', async () => {
    const { pipeline, database } = rig();
    let leaked: UnitContext | undefined;
    await pipeline.run('test.leak', (unit) => {
      leaked = unit;
    });
    const unit = leaked as UnitContext;
    await expect(unit.query('SELECT 1')).rejects.toMatchObject({ code: 'UNIT_ENDED' });
    await expect(unit.audit.append(entry('Too late'))).rejects.toMatchObject({ code: 'UNIT_ENDED' });
    await expect(unit.audit.head()).rejects.toMatchObject({ code: 'UNIT_ENDED' });
    await expect(unit.events.append({ type: 'AUTOSAVE', message: 'Too late' })).rejects.toMatchObject({ code: 'UNIT_ENDED' });
    expect(() => unit.db).toThrow(CoreError);
    expect(() => unit.afterCommit(() => undefined)).toThrow(CoreError);
    expect(() => stateOf({ label: 'made.up' })).toThrow(CoreError);
    expect(stateOf(unit).ended).toBe(true);
    expect(database.statements).toEqual([]);
  });
});

describe('AP-6: rows and events the engine built', () => {
  /** The engine's side: the shared `appendActivity` on a ring that ends at the given head. */
  function engineBuilt(head: { seq: number; hash: string }, nextEvent: number, at: number): ActivitySlices {
    const state = {
      audit: { rows: [], head: head.hash, total: head.seq, dropped: head.seq },
      events: [],
      meta: { counters: { event: nextEvent } },
    } as unknown as ActivitySlices;
    return appendActivity(state, at, [
      { audit: { type: 'RECORDING_STARTED', message: 'Recording started', actorId: 'OPR-001' }, event: { type: 'RECORDING_STARTED', message: 'Recording started' } },
      { audit: { type: 'FRAME_HASH', message: 'Frame hash' } },
    ]);
  }

  it('that continue the head of the unit are inserted as they are; the event counter is raised above them', async () => {
    const { pipeline, database, clock } = rig();
    const built = engineBuilt({ seq: 0, hash: GENESIS }, 7, clock.now());
    await pipeline.run('engine.tick', async (unit) => {
      await unit.audit.appendPrepared(built.audit.rows);
      await unit.events.appendPrepared(built.events);
      expect(unit.audit.appended()).toEqual(built.audit.rows);
      expect(await unit.audit.head()).toEqual({ seq: 2, hash: built.audit.head });
    });
    expect(database.statements).toEqual([...OPENING, AUDIT_INSERT, AUDIT_INSERT, EVENT_INSERT, EVENT_COUNTER_RAISE, UNIT_STATEMENTS.commit]);
    expect(database.committed).toMatchObject({ head: { seq: 2, hash: built.audit.head }, auditSeqs: [1, 2], eventSeqs: [7], eventCounter: 8 });
  });

  it('that do not continue it: no statement of theirs is sent, one line with both sequence numbers, 503', async () => {
    const { pipeline, database, errorLog, lines } = rig();
    await pipeline.run('test.native', (unit) => unit.audit.append(entry('A server-native row moved the head')));
    const stale = engineBuilt({ seq: 0, hash: GENESIS }, 1, CLOCK_START).audit.rows;
    const before = database.statements.length;
    const error = await caught(pipeline.run('engine.tick', (unit) => unit.audit.appendPrepared(stale)));
    expect(error).toBeInstanceOf(PipelineFailure);
    expect(error).toMatchObject({ statusCode: 503, code: 'NOT_READY', reason: 'AUDIT_HEAD_DIVERGED' });
    expect(database.statements.slice(before)).toEqual([...OPENING, 'ROLLBACK']);
    expect(lines().find((line) => line['msg'] === 'audit head diverged')).toMatchObject({ level: 50, code: 'AUDIT_HEAD_DIVERGED', headSeq: 1, rowSeq: 1 });
    expect(errorLog.entries.find((item) => item.code === 'AUDIT_HEAD_DIVERGED')).toMatchObject({ context: { headSeq: 1, rowSeq: 1 } });
    expect(database.committed.auditSeqs).toEqual([1]);
  });

  it('a batch whose rows do not continue each other, and events whose sequences do not rise, are refused', async () => {
    const { pipeline, database } = rig();
    const built = engineBuilt({ seq: 0, hash: GENESIS }, 1, CLOCK_START);
    const [first, second] = built.audit.rows;
    const swapped = await caught(pipeline.run('engine.tick', (unit) => unit.audit.appendPrepared([second, first] as AuditRow[])));
    expect(swapped).toMatchObject({ reason: 'AUDIT_HEAD_DIVERGED' });
    const event = built.events[0] as SimEvent;
    const repeated = await caught(pipeline.run('engine.tick', (unit) => unit.events.appendPrepared([event, event])));
    expect((repeated as CoreError).code).toBe('EVENT_ROW_INVALID');
    expect(database.committed).toMatchObject({ auditSeqs: [], eventSeqs: [] });
  });

  it('an event counter that has no row (a database never seeded) is refused by its code', async () => {
    const { pipeline, database } = rig({}, { withoutEventCounter: true });
    const error = await caught(pipeline.run('test.unseeded', (unit) => unit.events.append({ type: 'AUTOSAVE', message: 'No counter' })));
    expect((error as CoreError).code).toBe('EVENT_COUNTER_MISSING');
    expect(database.statements.at(-1)).toBe('ROLLBACK');
  });
});

describe('the bounded length', () => {
  it('at most maxPending units wait; one more is refused at once with 503, and announced once', async () => {
    const { pipeline, database, errorLog, lines } = rig({ maxPending: 3 });
    const hold = gate();
    const started = gate();
    const running = pipeline.run('test.holder', async () => {
      started.open();
      await hold.opened;
      return 'holder';
    });
    await started.opened;
    const waiting = [0, 1, 2].map((index) => pipeline.run('test.waiting', (unit) => unit.audit.append(entry(`Waiting ${index}`))));
    expect(pipeline.snapshot()).toMatchObject({ pending: 3, running: { label: 'test.holder' }, refused: 0 });

    const refusals = await Promise.all([caught(pipeline.run('test.over', async () => 1)), caught(pipeline.run('test.over', async () => 2))]);
    for (const refusal of refusals) {
      expect(refusal).toBeInstanceOf(PipelineFailure);
      expect(refusal).toMatchObject({ statusCode: 503, code: 'NOT_READY', reason: 'QUEUE_FULL' });
    }
    expect(pipeline.snapshot()).toMatchObject({ pending: 3, refused: 2 });
    expect(lines().filter((line) => line['msg'] === 'pipeline queue full')).toHaveLength(1);
    expect(errorLog.entries.filter((item) => item.code === 'QUEUE_FULL')).toHaveLength(1);

    hold.open();
    expect(await running).toBe('holder');
    expect((await Promise.all(waiting)).map((row) => row.seq)).toEqual([1, 2, 3]);
    // Room again: the next submission is accepted.
    expect((await pipeline.run('test.later', (unit) => unit.audit.append(entry('Accepted again')))).seq).toBe(4);
    expect(database.committed.auditSeqs).toEqual([1, 2, 3, 4]);
  });

  it('from idle, a burst of maxPending + 1 is accepted: the first is the one that runs, not one that waits', async () => {
    const { pipeline } = rig({ maxPending: 3 });
    const burst = [0, 1, 2, 3, 4].map((index) => caught(pipeline.run('test.burst', async () => index).then((value) => value)));
    const outcomes = await Promise.all(burst);
    expect(outcomes.slice(0, 4)).toEqual([null, null, null, null]);
    expect(outcomes[4]).toMatchObject({ reason: 'QUEUE_FULL' });
  });
});

describe('the watchdog', () => {
  it('a unit that never returns is abandoned at the limit: 503, the connection is closed, the queue goes on', async () => {
    const { pipeline, database, errorLog, lines } = rig({ unitTimeoutMs: 60 });
    const resume = gate();
    let zombie: UnitContext | undefined;
    const started = performance.now();
    const stuck = caught(
      pipeline.run('test.stuck', async (unit) => {
        zombie = unit;
        await unit.audit.append(entry('Written by a unit that never returns'));
        await resume.opened;
        // What the work still does after it was abandoned can no longer write through the unit.
        await unit.audit.append(entry('Too late'));
      }),
    );
    const next = pipeline.run('test.next', (unit) => unit.audit.append(entry('The unit after the abandoned one')));

    const error = await stuck;
    expect(performance.now() - started).toBeGreaterThanOrEqual(55);
    expect(error).toBeInstanceOf(PipelineFailure);
    expect(error).toMatchObject({ statusCode: 503, code: 'NOT_READY', reason: 'UNIT_TIMEOUT' });
    expect((await next).seq).toBe(1);
    expect(database.connections).toEqual({ opened: 2, released: 1, destroyed: 1 });
    expect(database.committed.auditSeqs).toEqual([1]);

    resume.open();
    await sleep(5);
    await expect((zombie as UnitContext).query('SELECT 1')).rejects.toMatchObject({ code: 'UNIT_ENDED' });
    expect(database.committed.auditSeqs).toEqual([1]);
    expect(database.statements.filter((text) => text === 'COMMIT')).toHaveLength(1);

    expect(pipeline.snapshot()).toMatchObject({ timedOut: 1, completed: 1, failed: 0, running: null, pending: 0 });
    expect(lines().find((line) => line['msg'] === 'unit abandoned: it ran too long')).toMatchObject({
      level: 50,
      code: 'UNIT_TIMEOUT',
      label: 'test.stuck',
      phase: 'open',
      timeoutMs: 60,
    });
    expect(errorLog.entries.find((item) => item.code === 'UNIT_TIMEOUT')).toMatchObject({ level: 'error', source: 'core.pipeline' });
  });

  it('statements slower than the limit: the unit is abandoned and never commits', async () => {
    const { pipeline, database } = rig({ unitTimeoutMs: 50 }, { statementMs: 40 });
    const error = await caught(pipeline.run('test.slow', (unit) => unit.audit.append(entry('Too slow'))));
    expect(error).toMatchObject({ reason: 'UNIT_TIMEOUT' });
    await sleep(120);
    expect(database.statements).not.toContain('COMMIT');
    expect(database.committed.auditSeqs).toEqual([]);
    expect(database.connections.destroyed).toBe(1);
  });

  it('a statement the server cancelled at the unit\'s statement limit (57014) is the same refusal', async () => {
    const cancelled = Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' });
    const { pipeline, database } = rig({}, { failOn: (text) => (text.includes('pg_sleep') ? cancelled : undefined) });
    const error = await caught(pipeline.run('test.cancelled', (unit) => unit.query('SELECT pg_sleep(60)')));
    expect(error).toMatchObject({ statusCode: 503, reason: 'UNIT_TIMEOUT' });
    expect((error as PipelineFailure).cause).toBe(cancelled);
    expect(database.statements.at(-1)).toBe('ROLLBACK');
    expect(pipeline.snapshot()).toMatchObject({ timedOut: 1, failed: 0 });
  });
});

describe('no nesting', () => {
  it('a unit that submits another unit is refused at once; it would wait for itself', async () => {
    const { pipeline, database } = rig();
    const outcome = await pipeline.run('test.outer', async (unit) => {
      const inner = await caught(pipeline.run('test.inner', async () => 'never'));
      await unit.audit.append(entry('The outer unit goes on'));
      return inner;
    });
    expect(outcome).toBeInstanceOf(CoreError);
    expect((outcome as CoreError).code).toBe('PIPELINE_REENTRANT');
    expect(database.committed.auditSeqs).toEqual([1]);
  });

  it('after the unit ended, the same chain of calls may submit: from afterCommit, and from a timer the unit started', async () => {
    const { pipeline } = rig();
    const later: Array<Promise<unknown>> = [];
    await pipeline.run('test.first', (unit) => {
      unit.afterCommit(() => later.push(pipeline.run('test.fromAfterCommit', async () => 'after commit')));
      setTimeout(() => later.push(pipeline.run('test.fromTimer', async () => 'from the timer')), 5);
    });
    await sleep(20);
    expect(await Promise.all(later)).toEqual(['after commit', 'from the timer']);
  });
});

describe('after the commit', () => {
  it('the commit listeners, then the unit\'s tasks in order, then the caller, then the next unit', async () => {
    const { pipeline } = rig();
    const trace: string[] = [];
    pipeline.onCommit((unit) => trace.push(`listener ${unit.label} rows ${unit.auditRows.map((row) => row.seq).join(',')} head ${unit.head.seq}`));
    const first = pipeline
      .run('test.a', async (unit) => {
        trace.push('a works');
        await unit.audit.appendMany([entry('A one'), entry('A two')]);
        unit.afterCommit(() => trace.push('a task 1'));
        unit.afterCommit(() => {
          throw new Error('a task that fails');
        });
        unit.afterCommit(() => trace.push('a task 3'));
      })
      .then(() => void trace.push('a caller'));
    const second = pipeline.run('test.b', async (unit) => {
      trace.push('b works');
      await unit.audit.append(entry('B'));
      unit.afterCommit(() => trace.push('b task'));
    });
    await Promise.all([first, second]);
    expect(trace).toEqual([
      'a works',
      'listener test.a rows 1,2 head 2',
      'a task 1',
      'a task 3',
      'a caller',
      'b works',
      'listener test.b rows 3 head 3',
      'b task',
    ]);
  });

  it('nothing runs after a unit that rolled back; a listener that was removed is not called', async () => {
    const { pipeline } = rig();
    const trace: string[] = [];
    const remove = pipeline.onCommit(() => trace.push('listener'));
    await caught(
      pipeline.run('test.rollback', async (unit) => {
        await unit.audit.append(entry('Rolled back'));
        unit.afterCommit(() => trace.push('task'));
        throw new Error('roll back');
      }),
    );
    remove();
    await pipeline.run('test.commit', (unit) => unit.audit.append(entry('Committed')));
    expect(trace).toEqual([]);
  });
});

describe('the label of a unit', () => {
  it('is a name chosen in the code: anything else is refused before the unit is queued', async () => {
    const { pipeline } = rig();
    for (const label of ['', 'Identity.signIn', 'has space', 'trailing.', 'a'.repeat(65), '/api/v1/session?token=1']) {
      await expect(pipeline.run(label, async () => 1)).rejects.toMatchObject({ code: 'UNIT_LABEL_INVALID' });
    }
    await expect(pipeline.run(7 as never, async () => 1)).rejects.toMatchObject({ code: 'UNIT_LABEL_INVALID' });
    for (const label of ['identity.signIn', 'rbac.denied', 'engine.tick', 'pairing.redeem-code', 'x']) {
      await expect(pipeline.run(label, async () => label)).resolves.toBe(label);
    }
    expect(pipeline.snapshot()).toMatchObject({ completed: 5, refused: 0 });
  });
});

describe('drain and close', () => {
  it('drain() resolves at once when idle, and otherwise when nothing runs or waits any more', async () => {
    const { pipeline } = rig();
    await pipeline.drain();
    const done: number[] = [];
    for (const index of [0, 1, 2]) {
      void pipeline.run('test.drain', async () => {
        await sleep(5);
        done.push(index);
      });
    }
    await pipeline.drain();
    expect(done).toEqual([0, 1, 2]);
    expect(pipeline.snapshot()).toMatchObject({ pending: 0, running: null, accepting: true });
  });

  it('close() past its limit: the waiting units are refused in order, the running one is abandoned, and close() ends', async () => {
    const { pipeline, database, errorLog, lines } = rig({ unitTimeoutMs: 10_000, closeTimeoutMs: 60 });
    const order: string[] = [];
    const stuck = caught(
      pipeline.run('test.stuck', async (unit) => {
        await unit.audit.append(entry('Never committed'));
        await new Promise<never>(() => undefined);
      }),
    ).then((error) => {
      order.push('stuck');
      return error;
    });
    const waiting = [0, 1, 2].map((index) =>
      caught(pipeline.run('test.waiting', async () => index)).then((error) => {
        order.push(`waiting ${index}`);
        return error;
      }),
    );
    await sleep(10);
    const closing = pipeline.close();
    expect(pipeline.close()).toBe(closing);
    await closing;

    for (const error of await Promise.all([stuck, ...waiting])) {
      expect(error).toBeInstanceOf(PipelineFailure);
      expect(error).toMatchObject({ statusCode: 503, reason: 'CLOSED' });
    }
    expect(order).toEqual(['waiting 0', 'waiting 1', 'waiting 2', 'stuck']);
    expect(database.connections).toEqual({ opened: 1, released: 0, destroyed: 1 });
    expect(database.committed.auditSeqs).toEqual([]);
    expect(pipeline.snapshot()).toMatchObject({ accepting: false, running: null, pending: 0 });
    expect(lines().find((line) => line['msg'] === 'pipeline closed before it was drained')).toMatchObject({
      level: 50,
      code: 'PIPELINE_CLOSE_TIMEOUT',
      abandoned: 4,
      running: 'test.stuck',
    });
    expect(errorLog.entries.some((item) => item.code === 'PIPELINE_CLOSE_TIMEOUT')).toBe(true);
    await expect(pipeline.run('test.late', async () => 1)).rejects.toMatchObject({ reason: 'CLOSED' });
  });
});
