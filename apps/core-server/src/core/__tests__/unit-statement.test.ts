// What a statement of a unit of work may be, database-free (checkpoint CP-B1, finding CPB1-4;
// finding F53, decision D87): the rules of `unit-statement.ts`, every refused form, the
// statements the server really sends (which must pass unchanged), and the protocol a unit sends
// them with. The same against PostgreSQL: `unit-guard.db.test.ts`.
import { createManualClock } from '@dems/shared/sim';
import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { auditChainHead, auditLog, engineCounters, events, operators } from '../../db/schema';
import * as identityStatements from '../../modules/identity/session-store';
import { sqlStateOf } from '../errors';
import { EVENT_COUNTER_ADVANCE, EVENT_COUNTER_RAISE } from '../event-writer';
import { createPipeline } from '../pipeline';
import { UNIT_STATEMENTS, asUnitQuery, isTransactionControl } from '../unit-of-work';
import { UnitStatementRule, unitStatementRefusal, withoutLiterals } from '../unit-statement';
import { CLOCK_START, recordingErrorLog, standInDatabase, testLogger } from './support';

const logger = testLogger('silent');
afterAll(() => logger.close());

const caught = <T>(work: Promise<T>): Promise<unknown> =>
  work.then(
    () => null,
    (error: unknown) => error,
  );

/** The query builder's texts for the typed tables: what `unit.db` sends. */
function builderStatements(): string[] {
  const db = drizzle({ client: {} as PoolClient, logger: false });
  return [
    db.select().from(auditChainHead).toSQL().sql,
    db.select({ enabled: operators.enabled }).from(operators).where(eq(operators.id, 'OPR-001')).toSQL().sql,
    db.update(operators).set({ enabled: false }).where(eq(operators.id, 'OPR-001')).toSQL().sql,
    db
      .insert(auditLog)
      .values({ seq: 1, id: 'AUD-000001', at: 1, type: 'X', category: 'SYSTEM', severity: 'INFO', message: 'm', prevHash: 'a', hash: 'b' })
      .toSQL().sql,
    db.insert(events).values({ seq: 1, id: 'LOG-000001', at: 1, type: 'X', category: 'SYSTEM', severity: 'INFO', message: 'm' }).toSQL().sql,
    db
      .insert(engineCounters)
      .values({ name: 'event', nextValue: 1 })
      .onConflictDoUpdate({ target: engineCounters.name, set: { nextValue: 2 } })
      .toSQL().sql,
    db.delete(engineCounters).where(and(eq(engineCounters.name, 'event'), sql`${engineCounters.nextValue} > 0`)).toSQL().sql,
    db.select().from(operators).union(db.select().from(operators)).toSQL().sql,
  ];
}

/** Every statement constant the identity module exports: the texts its units and reads send. */
function identityModuleStatements(): Array<[name: string, text: string]> {
  return Object.entries(identityStatements).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string' && /^\s*(?:SELECT|INSERT|UPDATE|DELETE|WITH)\b/i.test(entry[1]),
  );
}

describe('the statements the server sends pass unchanged', () => {
  it('the writers of the core: the event counter, and the inserts of the query builder', () => {
    for (const text of [EVENT_COUNTER_ADVANCE, EVENT_COUNTER_RAISE, ...builderStatements()]) {
      expect(unitStatementRefusal(text), text).toBeNull();
    }
    // The premise: the builder's texts are the forms this test means.
    const texts = builderStatements();
    expect(texts[3]).toMatch(/^insert into "audit_log" \(/);
    expect(texts[5]).toContain('on conflict ("name") do update set');
    expect(texts[7]).toMatch(/^\(select .* union \(select /);
  });

  it('every statement of the identity module', () => {
    const statements = identityModuleStatements();
    expect(statements.length).toBeGreaterThanOrEqual(15);
    for (const [name, text] of statements) expect(unitStatementRefusal(text), name).toBeNull();
  });

  it('row statements in every form a module may write', () => {
    for (const text of [
      'SELECT 1',
      'select 1;',
      '  \n SELECT 1  ;  \n',
      'SELECT 1 / $1::int AS impossible',
      "SELECT current_setting('statement_timeout') AS value, current_setting('transaction_isolation') AS isolation",
      "SELECT current_setting('search_path') AS path",
      'UPDATE public.operators SET enabled = false, updated_at = $2 WHERE id = $1 AND enabled RETURNING id',
      'INSERT INTO public.auth_sessions (id, operator_id) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id',
      'INSERT INTO public.paired_devices (id) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM public.paired_devices WHERE id = $1)',
      'DELETE FROM public.active_session WHERE id = $1 RETURNING id',
      'WITH ended AS (UPDATE public.auth_sessions SET ended_at = $2, end_reason = $3 WHERE id = $1 AND ended_at IS NULL RETURNING id) SELECT count(*) FROM ended',
      'MERGE INTO public.engine_counters AS c USING (SELECT $1::text AS name) AS s ON c.name = s.name WHEN MATCHED THEN UPDATE SET next_value = c.next_value + 1',
      'VALUES (1), (2)',
      '(SELECT 1) UNION ALL (SELECT 2)',
      'SELECT id FROM public.auth_sessions WHERE id = $1 FOR UPDATE',
      'SELECT pg_advisory_xact_lock($1)',
      'SELECT CASE WHEN ended_at IS NULL THEN 1 ELSE 0 END AS open FROM public.auth_sessions',
      "SET LOCAL lock_timeout = '1s'",
      'SET CONSTRAINTS ALL DEFERRED',
      'SELECT committed, rollbacks, savepoints FROM t',
      'select "end", "commit", "search_path", "pg_temp" from t',
      // The words of the rules as VALUES: a reason text, a note, a code.
      "UPDATE public.paired_devices SET revoke_reason = 'ROLLBACK; COMMIT; DROP TABLE x' WHERE id = $1",
      "SELECT 'set_config(''search_path'', ''pg_temp'', false)' AS text, 'into temp' AS other",
      "SELECT 'it''s; done' AS text -- a comment; with a semicolon and the word commit",
      'SELECT 1 /* a comment; COMMIT; /* nested */ rollback */ AS one',
      "SELECT E'a\\'; COMMIT; --' AS escaped",
      'SELECT $tag$; COMMIT; into temp$tag$ AS dollar, $1::text AS parameter',
    ]) {
      expect(unitStatementRefusal(text), text).toBeNull();
    }
  });
});

describe('what is refused, by the rule that refuses it', () => {
  const cases: ReadonlyArray<readonly [rule: UnitStatementRule, texts: readonly string[]]> = [
    [
      UnitStatementRule.NOT_A_ROW_STATEMENT,
      [
        'COMMIT',
        'commit;',
        '  ROLLBACK',
        'BEGIN',
        'START TRANSACTION',
        'END',
        'ABORT',
        'SAVEPOINT a',
        'RELEASE SAVEPOINT a',
        "PREPARE TRANSACTION 'x'",
        '/* c */ COMMIT',
        '-- c\nCOMMIT',
        'SET statement_timeout = 0',
        'SET SESSION lock_timeout = 0',
        'SET search_path = pg_temp, public',
        'RESET ALL',
        'DISCARD ALL',
        'CREATE TEMP TABLE audit_log (seq bigint)',
        'create temporary table events (seq bigint)',
        'CREATE TABLE public.x (a int)',
        'CREATE FUNCTION pg_temp.f() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$',
        // The forms the review names, and their neighbours.
        "DO $$ BEGIN EXECUTE 'create temp table audit_log (seq bigint)'; END $$",
        'do language plpgsql $body$ begin commit; end $body$',
        'CALL public.anything()',
        'PREPARE p AS SELECT 1',
        'EXECUTE p',
        'DEALLOCATE ALL',
        'LISTEN channel',
        'NOTIFY channel',
        'LOCK TABLE public.operators',
        'TRUNCATE public.events',
        'DROP TABLE audit_log',
        'ALTER TABLE public.audit_log ADD COLUMN extra int',
        'GRANT ALL ON public.audit_log TO PUBLIC',
        'COPY public.operators TO STDOUT',
        'DECLARE c CURSOR WITH HOLD FOR SELECT 1',
        'SHOW search_path',
        'EXPLAIN ANALYZE DELETE FROM public.operators',
        'TABLE public.operators',
        '',
        '   ',
        '-- only a comment',
        ';',
      ],
    ],
    [
      UnitStatementRule.SEVERAL_STATEMENTS,
      [
        'SELECT 1; SELECT 2',
        'UPDATE public.operators SET enabled = false WHERE id = $1; COMMIT',
        'UPDATE public.operators SET enabled = false; commit;',
        'SELECT 1;\n-- then\nROLLBACK',
        'SELECT 1; /* quiet */ BEGIN',
        "SELECT 'a'; CREATE TEMP TABLE audit_log (seq bigint)",
        'SELECT 1;;',
      ],
    ],
    [
      UnitStatementRule.CREATES_A_TABLE,
      [
        'SELECT * INTO TEMP audit_log FROM public.audit_log',
        'select * into temporary table events from public.events',
        'SELECT 1 AS seq INTO TEMPORARY audit_log',
        'SELECT * INTO UNLOGGED copy FROM public.operators',
        'SELECT * INTO copy FROM public.operators',
        'SELECT 1 AS seq INTO pg_temp.audit_log',
        'WITH x AS (SELECT 1 AS seq) SELECT * INTO TEMP audit_log FROM x',
        'SELECT 1 /* insert */ INTO audit_log',
      ],
    ],
    [
      UnitStatementRule.TRANSACTION_CONTROL,
      [
        'SELECT 1 FROM t WHERE commit',
        'SELECT rollback FROM t',
        'UPDATE t SET savepoint = 1',
        'WITH x AS (SELECT 1) SELECT 1 FROM x, start transaction',
      ],
    ],
    [
      UnitStatementRule.SESSION_SETTING,
      [
        "SELECT set_config('search_path', 'pg_temp, public', false)",
        "select pg_catalog.set_config ('statement_timeout', '0', false)",
        "SELECT SET_CONFIG('search_path', $1, true)",
        'SET LOCAL search_path = pg_temp, public',
        "SET LOCAL search_path TO 'pg_temp'",
        "UPDATE t SET x = (SELECT set_config('role', 'none', false))",
      ],
    ],
    [
      UnitStatementRule.TEMPORARY_SCHEMA,
      ['SELECT * FROM pg_temp.audit_log', 'INSERT INTO pg_temp.audit_log (seq) VALUES ($1)', 'DELETE FROM pg_temp_3.events', 'UPDATE PG_TEMP.x SET a = 1'],
    ],
    [
      UnitStatementRule.UNREADABLE,
      ["SELECT 'not closed", 'SELECT "not closed', 'SELECT 1 /* not closed', 'SELECT $tag$ not closed', 'SELECT 1 /* outer /* inner */ still open'],
    ],
  ];

  it.each(cases)('%s', (rule, texts) => {
    for (const text of texts) {
      expect(unitStatementRefusal(text), text).toBe(rule);
      expect(isTransactionControl(text), text).toBe(true);
    }
  });

  it('every rule has a case', () => {
    expect(cases.map(([rule]) => rule).sort()).toEqual(Object.values(UnitStatementRule).sort());
  });
});

describe('withoutLiterals: the text the rules read', () => {
  it('removes the content of strings, quoted names and dollar-quoted strings, and replaces comments by a space', () => {
    expect(withoutLiterals("SELECT 'a;b' AS x")).toBe("SELECT '' AS x");
    expect(withoutLiterals("SELECT 'it''s' AS x")).toBe("SELECT '' AS x");
    expect(withoutLiterals('SELECT "a""b;c" FROM t')).toBe('SELECT "" FROM t');
    expect(withoutLiterals('SELECT 1 -- note; COMMIT\nFROM t')).toBe('SELECT 1  \nFROM t');
    expect(withoutLiterals('SELECT /* a /* b */ c */ 1')).toBe('SELECT   1');
    expect(withoutLiterals('SELECT $$ ; $$, $1, $a$ x $a$')).toBe('SELECT $$, $1, $$');
    expect(withoutLiterals('SELECT $1::text, $2')).toBe('SELECT $1::text, $2');
    expect(withoutLiterals("SELECT U&'d\\0061t', B'101', X'1F'")).toBe("SELECT U&'', B'', X''");
  });

  it('a backslash escapes only in a string with the prefix E, as the server reads it', () => {
    // A plain string ends at its quote: what follows is SQL, and it is read as SQL.
    expect(withoutLiterals("SELECT 'a\\'; COMMIT")).toBe("SELECT ''; COMMIT");
    expect(unitStatementRefusal("SELECT 'a\\'; COMMIT")).toBe(UnitStatementRule.SEVERAL_STATEMENTS);
    // With the prefix, the quote after the backslash belongs to the string.
    expect(withoutLiterals("SELECT E'a\\'; COMMIT' AS x")).toBe("SELECT E'' AS x");
    expect(withoutLiterals("SELECT e'a\\\\' AS x, 1")).toBe("SELECT e'' AS x, 1");
    // A name that ends in e before a string is not that prefix.
    expect(withoutLiterals("SELECT namee'x'")).toBe("SELECT namee''");
  });

  it('gives null when a quote or a comment does not end', () => {
    for (const text of ["'", '"', '/*', '$x$', "E'\\'"]) expect(withoutLiterals(text), text).toBeNull();
  });
});

describe('inside a unit: refused before it is sent, and sent with the extended protocol', () => {
  function rig() {
    const database = standInDatabase();
    const pipeline = createPipeline({ pool: () => database.pool, clock: createManualClock(CLOCK_START), log: logger.log, errorLog: recordingErrorLog() });
    return { database, pipeline };
  }

  it('the forms of the review reach no connection; the unit goes on and commits', async () => {
    const { database, pipeline } = rig();
    const refused = [
      'SELECT * INTO TEMP audit_log FROM public.audit_log',
      "DO $$ BEGIN EXECUTE 'create temp table audit_log (seq bigint)'; END $$",
      "SELECT set_config('search_path', 'pg_temp, public', false)",
      'UPDATE public.operators SET enabled = false WHERE id = $1; COMMIT',
      'SET LOCAL search_path = pg_temp, public',
      'SELECT 1 AS seq INTO pg_temp.events',
    ];
    const outcomes = await pipeline.run('test.guard', async (unit) => {
      await unit.query('SELECT 1');
      const errors: unknown[] = [];
      for (const text of refused) errors.push(await caught(unit.query(text, text.includes('$1') ? ['OPR-001'] : undefined)));
      errors.push(await caught(unit.db.execute(sql`select 1; commit`)));
      await unit.query('SELECT 2');
      return errors;
    });
    expect(outcomes.map((error) => sqlStateOf(error))).toEqual(Array.from({ length: 7 }, () => 'UNIT_STATEMENT_NOT_ALLOWED'));
    // The text of a refusal names the rule and never the statement.
    const messages = outcomes.slice(0, 6).map((error) => (error as Error).message);
    expect(messages.map((message) => /\(rule ([A-Z_]+)\)$/.exec(message)?.[1])).toEqual([
      'CREATES_A_TABLE',
      'NOT_A_ROW_STATEMENT',
      'SESSION_SETTING',
      'SEVERAL_STATEMENTS',
      'SESSION_SETTING',
      'CREATES_A_TABLE',
    ]);
    for (const message of messages) expect(message).not.toMatch(/audit_log|search_path|operators|pg_temp/);
    expect(database.statements).toEqual([UNIT_STATEMENTS.begin, UNIT_STATEMENTS.chainLock, UNIT_STATEMENTS.settings, 'SELECT 1', 'SELECT 2', UNIT_STATEMENTS.commit]);
  });

  it('every statement of the unit\'s user asks for the extended protocol, with values or without; the unit\'s own five do not need to', async () => {
    const { database, pipeline } = rig();
    await pipeline.run('test.protocol', async (unit) => {
      await unit.query('SELECT 1');
      await unit.query('UPDATE public.operators SET enabled = $2 WHERE id = $1', ['OPR-001', false]);
      await unit.db.select().from(auditChainHead);
      await unit.audit.append({ type: 'SYSTEM_BOOT', actorId: null, deviceId: null, message: 'A row', details: {} });
      await unit.events.append({ type: 'AUTOSAVE', message: 'An event' });
    });
    const own: readonly string[] = Object.values(UNIT_STATEMENTS);
    const ofTheUser = database.sent.filter((statement) => !own.includes(statement.text));
    expect(ofTheUser.map((statement) => statement.text.split(' ')[0]?.toLowerCase())).toEqual(['select', 'update', 'select', 'insert', 'update', 'insert']);
    expect(ofTheUser.map((statement) => statement.mode)).toEqual(Array.from({ length: 6 }, () => 'extended'));
    expect(database.sent.filter((statement) => own.includes(statement.text)).map((statement) => statement.text)).toEqual([
      UNIT_STATEMENTS.begin,
      UNIT_STATEMENTS.chainLock,
      UNIT_STATEMENTS.settings,
      UNIT_STATEMENTS.commit,
    ]);
  });

  it('asUnitQuery copies what the caller gave and adds the protocol', () => {
    expect(asUnitQuery('SELECT 1')).toEqual({ text: 'SELECT 1', queryMode: 'extended' });
    const given = { name: 'named', text: 'SELECT $1', rowMode: 'array', types: { getTypeParser: () => String } };
    const made = asUnitQuery(given);
    expect(made).toEqual({ ...given, queryMode: 'extended' });
    expect(made).not.toBe(given);
    expect(given).not.toHaveProperty('queryMode');
  });
});
