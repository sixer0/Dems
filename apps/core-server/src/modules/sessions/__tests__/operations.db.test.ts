// The hosted actions of the sessions module that the journey does not reach, each run against
// PostgreSQL as `dems_app` through HTTP (plan row W34; engine row finding F-11; spec §7.8):
// the pre-check that blocks, the retry, the acknowledgement, the composite start with
// acknowledged warnings, the cancel, the case-number scanner. Also here: what a refused unit
// sends to the database, who is refused by the real stages 4 and 6, and the measured round
// trips of one command.
//
// Every test boots the real app on its own clone of the seed (a process start), on a manual
// clock and a manual timer, and reads what is stored as `dems_owner`.
import { validateCoreApiResponse, type SessionCommandResponse } from '@dems/shared/api';
import type { AuditRow } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readEvents, readHead, readTrail, verifyTrail } from '../../../core/__tests__/support';
import { storedSlices } from '../../../engine/__tests__/support';
import { withoutNegativeZeros } from '../../../../test/support/seed';
import { CASE_NUMBER, CURRENT, OTHER_SESSION, SESSION, bodyOf, errorOf, on, outcome, sessionInput, sessionsApp, typesOf, type Caller, type SessionsApp } from './support';

const db = useTestDatabase({ template: 'seed' });

// A clone is made inside a test, and clone and drop wait for the clone lock, which other rows'
// runs may hold; a walk of the history in pages of 1 is 520 requests. Under a loaded host the
// default five seconds of a test are not enough for either (the reset row's files do the same).
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const PRECHECK_MS = 5_000;

interface Booted {
  readonly host: SessionsApp;
  readonly investigator: Caller;
  readonly supervisor: Caller;
}

/** A process start on a fresh clone of the seed, with two operators signed in. The tablet link is OFFLINE. */
async function booted(slug: string): Promise<Booted> {
  const target = await db.another({ template: 'seed', slug });
  const host = await sessionsApp(target, db.run.dataDir);
  return { host, investigator: await host.signIn('INVESTIGATOR'), supervisor: await host.signIn('SUPERVISOR') };
}

/** Creates a session as the caller and returns its ID. */
async function create(host: SessionsApp, caller: Caller, caseNumber?: string): Promise<string> {
  const response = await host.post(caller, SESSION, sessionInput(caller.operator.id, caseNumber));
  expect(response.statusCode).toBe(201);
  return (response.json() as SessionCommandResponse).sessionId;
}

/** One request: the documented status, a body the contract accepts, API-7 on a 2xx, and the rows it stored. */
async function command(
  host: SessionsApp,
  operationId: string,
  status: number,
  call: () => Promise<LightMyRequestResponse>,
): Promise<{ response: LightMyRequestResponse; rows: AuditRow[] }> {
  let response: LightMyRequestResponse | undefined;
  const rows = await host.written(async () => {
    response = await call();
  });
  if (response === undefined) throw new Error('no request was sent');
  expect(response.statusCode, `${operationId}: ${response.body}`).toBe(status);
  expect(validateCoreApiResponse(operationId, status, bodyOf(response)), operationId).toEqual({ ok: true });
  if (status < 300) {
    expect(response.headers['x-dems-epoch']).toBe(String(host.engine.epoch));
    expect(response.headers['x-dems-revision']).toBe(String(host.engine.revision));
  } else {
    expect(response.headers['x-dems-revision']).toBeUndefined();
  }
  // No answer of this module sets a cookie (M8).
  expect(response.headers['set-cookie']).toBeUndefined();
  expect(await readHead(host.owner)).toEqual({ seq: host.engine.slice('audit').total, hash: host.engine.slice('audit').head });
  return { response, rows };
}

/**
 * The statements a request sent on unit-of-work connections, one list per unit (a transaction
 * from its BEGIN on). The counting pool records those connections only: the reads of stage 4
 * go through `pool.query` and are not among them.
 */
function unitsSince(host: SessionsApp, position: number): string[][] {
  const units: string[][] = [];
  for (const text of host.database.statements.slice(position)) {
    if (text.startsWith('BEGIN') || units.length === 0) units.push([]);
    units.at(-1)?.push(text);
  }
  return units;
}

/** The unit of the identity module that moves a session's `last_seen_at` on, when a POST comes later than the last one. */
const isActivityUnit = (unit: readonly string[]): boolean => unit.some((text) => text.includes('auth_sessions'));

async function verified(host: SessionsApp): Promise<void> {
  const trail = await readTrail(host.owner);
  expect(linkProblems(trail)).toEqual([]);
  expect(verifyTrail(trail, await readHead(host.owner))).toMatchObject({ ok: true, checked: trail.length });
  expect(await storedSlices(host.owner)).toStrictEqual(withoutNegativeZeros(host.engine.state()));
  expect(host.engine.stats()).toMatchObject({ ticksFailed: 0, simErrors: 0, resyncs: 0 });
  expect(host.log.lines().filter((line) => Number(line['level']) >= 50)).toEqual([]);
}

describe('the pre-check that blocks, the retry and the cancel (operations 25, 28, 29, 30, 31)', () => {
  it('with the Core link offline the checks end with a block: start is 409 PRECHECK_BLOCKED, acknowledge has nothing to acknowledge; after the link is back a retry arms the session; a cancel from ARMED leaves no session and no history entry', async () => {
    const { host, investigator, supervisor } = await booted('w34_block');
    const sessionId = await create(host, investigator);

    const begun = await command(host, 'beginPrecheck', 202, () => host.post(investigator, on(sessionId, 'precheck')));
    expect(begun.response.json()).toEqual({ sessionId, state: 'PRECHECK' });
    // NONE-P: no audit row; the event PRECHECK_STARTED is stored.
    expect(begun.rows).toEqual([]);
    expect((await readEvents(host.owner)).at(-1)).toMatchObject({ type: 'PRECHECK_STARTED', sessionId });

    // While the eight checks run: the three operations that need their outcome answer PRECHECK_RUNNING.
    for (const [operationId, path] of [['startSession', 'start'], ['retryPrecheck', 'precheck/retry'], ['acknowledgePrecheckWarnings', 'precheck/acknowledge']] as const) {
      const running = await command(host, operationId, 409, () => host.post(supervisor, on(sessionId, path)));
      expect(errorOf(running.response), operationId).toMatchObject({ code: 'PRECHECK_RUNNING', details: { simCode: 'CHECKS_RUNNING', from: 'PRECHECK' } });
      expect(running.rows).toEqual([]);
    }

    const blocked = await host.written(() => host.drive(PRECHECK_MS));
    expect(typesOf(blocked)).toEqual(['PRECHECK_BLOCKED']);
    expect(blocked[0]).toMatchObject({ actorId: investigator.operator.id, details: { by: 'system', checks: 'CORE', reasons: 'CORE_OFFLINE' } });
    expect(host.engine.slice('session')).toMatchObject({ state: 'PRECHECK', precheck: { outcome: 'BLOCK' } });

    const start = await command(host, 'startSession', 409, () => host.post(investigator, on(sessionId, 'start'), { acknowledgeWarnings: true }));
    expect(errorOf(start.response)).toMatchObject({ code: 'PRECHECK_BLOCKED', message: 'Start blocked: Core link offline', details: { simCode: 'ILLEGAL_STATE', from: 'PRECHECK', event: 'startRecording' } });
    const acknowledge = await command(host, 'acknowledgePrecheckWarnings', 409, () => host.post(investigator, on(sessionId, 'precheck/acknowledge')));
    expect(errorOf(acknowledge.response)).toMatchObject({ code: 'INVALID_STATE', details: { simCode: 'NO_WARNINGS', from: 'PRECHECK', event: 'acknowledgePrecheckWarnings' } });
    expect([...start.rows, ...acknowledge.rows]).toEqual([]);

    // The tablet connects (the realtime channel's call), and another operator retries.
    await host.engine.setTabletLink('CONNECTED');
    const retried = await command(host, 'retryPrecheck', 202, () => host.post(supervisor, on(sessionId, 'precheck/retry')));
    expect(retried.response.json()).toEqual({ sessionId, state: 'PRECHECK' });
    expect(retried.rows).toEqual([]);
    expect(host.engine.slice('session')?.precheck).toMatchObject({ outcome: null, warningsAcknowledged: false });
    const armed = await host.written(() => host.drive(PRECHECK_MS));
    expect(typesOf(armed)).toEqual(['PRECHECK_PASSED']);
    expect(host.engine.slice('session')?.state).toBe('ARMED');

    const cancelled = await command(host, 'cancelSession', 204, () => host.post(supervisor, on(sessionId, 'cancel')));
    expect(cancelled.rows.map((row) => [row.type, row.actorId, row.sessionId, row.details])).toEqual([['SESSION_CANCELLED', supervisor.operator.id, sessionId, { fromState: 'ARMED' }]]);
    expect(host.engine.slice('session')).toBeNull();
    const stored = await host.owner.query<{ sessions: string; history: string; evidence: string }>(
      `SELECT (SELECT count(*) FROM public.active_session)::text AS sessions,
              (SELECT count(*) FROM public.session_history WHERE id = $1)::text AS history,
              (SELECT count(*) FROM public.evidence_items WHERE session_id = $1)::text AS evidence`,
      [sessionId],
    );
    expect(stored.rows).toEqual([{ sessions: '0', history: '0', evidence: '0' }]);
    expect((await host.get(investigator, CURRENT)).json()).toMatchObject({ session: null });
    await verified(host);
  });
});

describe('the pre-check that ends with a warning (operations 25 and 30)', () => {
  /** A session whose pre-check ended with WARN: one microphone has no signal. */
  async function warned(slug: string): Promise<Booted & { sessionId: string }> {
    const started = await booted(slug);
    const { host, investigator } = started;
    await host.engine.setTabletLink('CONNECTED');
    // The demo fault of the demo-control module (plan row W43), run on the engine as a test's set-up.
    await host.engine.command(host.principal('SUPERVISOR'), 'inject', 'MIC_NO_SIGNAL');
    const sessionId = await create(host, investigator);
    expect(outcome(await host.post(investigator, on(sessionId, 'start')))).toEqual([202, null]);
    await host.drive(PRECHECK_MS);
    expect(host.engine.slice('session')).toMatchObject({ state: 'PRECHECK', precheck: { outcome: 'WARN', warningsAcknowledged: false } });
    return { ...started, sessionId };
  }

  it('30 acknowledgePrecheckWarnings: 200 ARMED, PRECHECK_PASSED by the caller with the warnings counted; a second acknowledgement is 409', async () => {
    const { host, investigator, supervisor, sessionId } = await warned('w34_warn_ack');
    const refused = await command(host, 'startSession', 409, () => host.post(investigator, on(sessionId, 'start')));
    expect(errorOf(refused.response)).toMatchObject({ code: 'PRECHECK_WARNINGS', details: { simCode: 'ILLEGAL_STATE', from: 'PRECHECK', event: 'startRecording' } });

    const acknowledged = await command(host, 'acknowledgePrecheckWarnings', 200, () => host.post(supervisor, on(sessionId, 'precheck/acknowledge')));
    expect(acknowledged.response.json()).toEqual({ sessionId, state: 'ARMED' });
    expect(acknowledged.rows).toHaveLength(1);
    expect(acknowledged.rows[0]).toMatchObject({ type: 'PRECHECK_PASSED', actorId: supervisor.operator.id, sessionId, details: { warnings: 1 } });
    expect(host.engine.slice('session')).toMatchObject({ state: 'ARMED', precheck: { warningsAcknowledged: true } });

    const again = await command(host, 'acknowledgePrecheckWarnings', 409, () => host.post(supervisor, on(sessionId, 'precheck/acknowledge')));
    expect(errorOf(again.response)).toMatchObject({ code: 'INVALID_STATE', details: { simCode: 'ILLEGAL_STATE', from: 'ARMED' } });
    // A retry is for a pre-check that has not armed the session.
    const retry = await command(host, 'retryPrecheck', 409, () => host.post(supervisor, on(sessionId, 'precheck/retry')));
    expect(errorOf(retry.response)).toMatchObject({ code: 'INVALID_STATE', details: { from: 'ARMED', event: 'retryPrecheck' } });
    await verified(host);
  });

  it('25 startSession with acknowledgeWarnings: ONE unit runs the acknowledgement and the start: one transaction, PRECHECK_PASSED and RECORDING_STARTED by the caller, one state change', async () => {
    const { host, supervisor, sessionId } = await warned('w34_warn_start');
    const revision = host.engine.revision;
    const statements = host.database.statements.length;
    const started = await command(host, 'startSession', 200, () => host.post(supervisor, on(sessionId, 'start'), { acknowledgeWarnings: true }));
    expect(started.response.json()).toEqual({ sessionId, state: 'RECORDING' });
    expect(started.rows.map((row) => [row.type, row.actorId, row.at])).toEqual([
      ['PRECHECK_PASSED', supervisor.operator.id, host.clock.now()],
      ['RECORDING_STARTED', supervisor.operator.id, host.clock.now()],
    ]);
    // One unit of the engine between the request and its answer: one transaction, two audit inserts.
    const units = unitsSince(host, statements).filter((unit) => !isActivityUnit(unit));
    expect(units).toHaveLength(1);
    const [unit = []] = units;
    expect(unit[0]).toBe('BEGIN ISOLATION LEVEL READ COMMITTED');
    expect(unit.at(-1)).toBe('COMMIT');
    expect(unit.filter((text) => text.startsWith('BEGIN') || text === 'COMMIT' || text === 'ROLLBACK')).toHaveLength(2);
    expect(unit.filter((text) => text.startsWith('insert into "audit_log"'))).toHaveLength(2);
    // One state change for both actions: the header names it.
    expect(host.engine.revision).toBe(revision + 1);
    expect(started.response.headers['x-dems-revision']).toBe(String(revision + 1));
    expect(host.engine.slice('session')).toMatchObject({ state: 'RECORDING', startedAt: host.clock.now(), precheck: { warningsAcknowledged: true } });
    await verified(host);
  });
});

describe('32 scanCaseNumber, and what a unit sends to PostgreSQL', () => {
  it('32: each scan answers the next case number of the day and reserves it in the stored counter; no audit row', async () => {
    const { host, investigator, supervisor } = await booted('w34_scan');
    const counter = async (): Promise<number> =>
      Number((await host.owner.query<{ next_value: string }>("SELECT next_value::text FROM public.engine_counters WHERE name = 'caseNumber'")).rows[0]?.next_value);
    const before = await counter();
    const first = await command(host, 'scanCaseNumber', 200, () => host.post(investigator, CASE_NUMBER));
    const second = await command(host, 'scanCaseNumber', 200, () => host.post(supervisor, CASE_NUMBER));
    const numbers = [first, second].map((answer) => (answer.response.json() as { caseNumber: string }).caseNumber);
    expect(numbers).toEqual([`LP/2026/1001-${String(before).padStart(4, '0')}`, `LP/2026/1001-${String(before + 1).padStart(4, '0')}`]);
    expect(await counter()).toBe(before + 2);
    expect([...first.rows, ...second.rows]).toEqual([]);
    // A session created with a scanned number does not hand that number out again.
    const sessionId = await create(host, investigator, numbers[1]);
    expect(host.engine.slice('session')).toMatchObject({ id: sessionId, input: { caseNumber: numbers[1] } });
    const third = (await command(host, 'scanCaseNumber', 200, () => host.post(investigator, CASE_NUMBER))).response.json() as { caseNumber: string };
    expect(third.caseNumber).toBe(`LP/2026/1001-${String(before + 2).padStart(4, '0')}`);
    await verified(host);
  });

  it('a request that names another session: 404 from a unit that sends NO statement (the unit opens its transaction at its first write), stores nothing and runs no action; a refusal of the simulator costs four statements and a ROLLBACK', async () => {
    const { host, investigator } = await booted('w34_not_open');
    await host.engine.setTabletLink('CONNECTED');
    const sessionId = await create(host, investigator);
    const commands = host.engine.stats().commands;
    const statements = host.database.statements.length;
    const refused = await command(host, 'cancelSession', 404, () => host.post(investigator, on(OTHER_SESSION, 'cancel')));
    expect(errorOf(refused.response)).toMatchObject({ code: 'NOT_FOUND', details: { simCode: 'NOT_FOUND' } });
    expect(refused.rows).toEqual([]);
    expect(unitsSince(host, statements)).toEqual([]);
    expect(host.engine.stats().commands).toBe(commands);
    expect(host.engine.slice('session')).toMatchObject({ id: sessionId, state: 'CREATE' });

    // For comparison, a refusal the SIMULATOR decides (a stop of a session in CREATE): the unit
    // locked the chain head and mirrored the operators before the action ran, then rolled back.
    const position = host.database.statements.length;
    const wrongState = await command(host, 'stopSession', 409, () => host.post(investigator, on(sessionId, 'stop'), { reason: 'Interview completed' }));
    expect(errorOf(wrongState.response)).toMatchObject({ code: 'INVALID_STATE', details: { simCode: 'ILLEGAL_STATE', from: 'CREATE', event: 'stopRecording' } });
    const [rolledBack = []] = unitsSince(host, position);
    expect(rolledBack).toHaveLength(5);
    expect(rolledBack[0]).toBe('BEGIN ISOLATION LEVEL READ COMMITTED');
    expect(rolledBack.at(-1)).toBe('ROLLBACK');
    expect(host.engine.stats().commands).toBe(commands + 1);
    expect(host.engine.stats().commandsRefused).toBe(1);
    // Each refusal is one line of the engine at debug level, with the label and codes only; no error line.
    const refusals = host.log.lines().filter((line) => line['msg'] === 'engine state set back: the unit was refused');
    expect(refusals.map((line) => [line['level'], line['label'], line['code'], line['simCode']])).toEqual([
      [20, 'sessions.cancelSession', 'NOT_FOUND', 'NOT_FOUND'],
      [20, 'sessions.stopSession', 'INVALID_STATE', 'ILLEGAL_STATE'],
    ]);
    await verified(host);
  });

  it('the measured round trips of one command (addSessionMarker): one transaction, the statements of the engine row\'s recipe', async () => {
    const { host, investigator } = await booted('w34_round_trips');
    await host.engine.setTabletLink('CONNECTED');
    const sessionId = await create(host, investigator);
    await host.post(investigator, on(sessionId, 'start'));
    await host.drive(PRECHECK_MS);
    await host.post(investigator, on(sessionId, 'start'));
    await host.drive(1_000);
    expect(host.engine.slice('session')?.state).toBe('RECORDING');

    const statements = host.database.statements.length;
    const marked = await command(host, 'addSessionMarker', 204, () => host.post(investigator, on(sessionId, 'markers'), { label: 'Key statement' }));
    expect(typesOf(marked.rows)).toEqual(['MARKER_ADDED']);
    const units = unitsSince(host, statements);
    // The clock moved since this operator's last POST: the identity module's unit comes first.
    const activity = units.filter(isActivityUnit);
    const own = units.filter((unit) => !isActivityUnit(unit));
    expect(activity).toHaveLength(1);
    expect(own).toHaveLength(1);
    const [unit = []] = own;
    expect(unit).toHaveLength(11);
    expect(unit[0]).toBe('BEGIN ISOLATION LEVEL READ COMMITTED');
    expect(unit.at(-1)).toBe('COMMIT');
    expect(unit.filter((text) => text.startsWith('insert into "audit_log"'))).toHaveLength(1);
    expect(unit.filter((text) => text.startsWith('insert into "events"'))).toHaveLength(1);
    expect(unit.filter((text) => text.startsWith('update "active_session"'))).toHaveLength(1);

    // A second command at the same instant of the clock: no activity unit, the engine's alone.
    const position = host.database.statements.length;
    expect((await host.post(investigator, on(sessionId, 'snapshots'))).statusCode).toBe(204);
    expect(unitsSince(host, position).filter(isActivityUnit)).toEqual([]);
    expect(unitsSince(host, position)).toHaveLength(1);

    // Wall time of the whole request, 30 times (a measurement, never an assertion).
    const times: number[] = [];
    for (let index = 0; index < 30; index += 1) {
      const began = performance.now();
      const response = await host.post(investigator, on(sessionId, 'snapshots'));
      times.push(performance.now() - began);
      expect(response.statusCode).toBe(204);
    }
    times.sort((a, b) => a - b);
    const name = (text: string): string => text.replace(/\s+/g, ' ').slice(0, 44);
    console.info(
      `[w34] one command through HTTP (addSessionMarker), statements on unit-of-work connections: ` +
        `the engine's unit, ${unit.length} statements in one transaction: ${unit.map(name).join(' | ')}; ` +
        `before it, when the clock moved since the caller's last POST, the identity module's activity unit of ${activity[0]?.length} statements; ` +
        `takeSessionSnapshot x30 (whole request, stages included) wall time: median ${(times[15] ?? 0).toFixed(2)} ms, min ${(times[0] ?? 0).toFixed(2)} ms, max ${(times[29] ?? 0).toFixed(2)} ms`,
    );
    await verified(host);
  });
});

describe('one error precedence through the real stages against PostgreSQL (spec §7.3 lines 8 and 10; decision D94)', () => {
  it('a stop whose reason is absent or too short: 404 for a session that is not open, 409 for one that is not recording, then 422 INVALID_REASON from the hosted action; a note without text the same way; nothing is stored by any of them; the shape of a body is 422 INVALID_INPUT before the engine', async () => {
    const { host, investigator, supervisor } = await booted('w34_precedence');
    await host.engine.setTabletLink('CONNECTED');
    const SHORT = [{ reason: 'Done' }, { reason: '   ' }, {}] as const;

    /** One refused request: the status, the code, and that it stored nothing. */
    const refused = async (operationId: string, status: number, code: string, call: () => Promise<LightMyRequestResponse>) => {
      const answer = await command(host, operationId, status, call);
      expect(errorOf(answer.response).code, operationId).toBe(code);
      expect(answer.rows, operationId).toEqual([]);
      return errorOf(answer.response);
    };

    // No session is open: every ID is another one.
    for (const body of SHORT) await refused('stopSession', 404, 'NOT_FOUND', () => host.post(investigator, on(OTHER_SESSION, 'stop'), body));

    // CREATE: the session (404), then its state (409). The reason is not looked at.
    const sessionId = await create(host, investigator);
    for (const body of SHORT) {
      await refused('stopSession', 404, 'NOT_FOUND', () => host.post(supervisor, on(OTHER_SESSION, 'stop'), body));
      const state = await refused('stopSession', 409, 'INVALID_STATE', () => host.post(supervisor, on(sessionId, 'stop'), body));
      expect(state.details).toEqual({ simCode: 'ILLEGAL_STATE', from: 'CREATE', event: 'stopRecording' });
    }
    await refused('addSessionNote', 409, 'INVALID_STATE', () => host.post(supervisor, on(sessionId, 'notes'), {}));

    // RECORDING: the session (404), then, last, the reason (422), decided by the simulator.
    expect(outcome(await host.post(investigator, on(sessionId, 'start')))).toEqual([202, null]);
    await host.drive(PRECHECK_MS);
    expect(outcome(await host.post(investigator, on(sessionId, 'start')))).toEqual([200, null]);
    await host.drive(1_000);
    const refusedBefore = host.engine.stats().commandsRefused;
    for (const body of SHORT) {
      await refused('stopSession', 404, 'NOT_FOUND', () => host.post(supervisor, on(OTHER_SESSION, 'stop'), body));
      const position = host.database.statements.length;
      const reason = await refused('stopSession', 422, 'INVALID_REASON', () => host.post(supervisor, on(sessionId, 'stop'), body));
      expect(reason.details).toEqual({ simCode: 'REASON_TOO_SHORT', from: 'RECORDING', event: 'stopRecording' });
      // The action ran and refused: its unit locked the chain head, mirrored the operators and rolled back.
      const [unit = []] = unitsSince(host, position).filter((candidate) => !isActivityUnit(candidate));
      expect(unit).toHaveLength(5);
      expect(unit.at(-1)).toBe('ROLLBACK');
    }
    expect(host.engine.stats().commandsRefused).toBe(refusedBefore + SHORT.length);

    // A note: the same order, and the same code as the schema stage's with the simulator's code in the details.
    for (const body of [{ text: '' }, { text: '   ' }, {}]) {
      await refused('addSessionNote', 404, 'NOT_FOUND', () => host.post(supervisor, on(OTHER_SESSION, 'notes'), body));
      const text = await refused('addSessionNote', 422, 'INVALID_INPUT', () => host.post(supervisor, on(sessionId, 'notes'), body));
      expect(text.details).toEqual({ simCode: 'NOTE_INVALID', from: 'RECORDING', event: 'addNote' });
    }

    // Line 8: the shape of the body, before the engine, on the open session and on another one.
    const units = host.database.statements.length;
    for (const id of [sessionId, OTHER_SESSION]) {
      for (const reason of [null, 12_345, 'a\u0000']) {
        expect((await refused('stopSession', 422, 'INVALID_INPUT', () => host.post(supervisor, on(id, 'stop'), { reason }))).details).toEqual({ in: 'body' });
      }
      for (const text of [7, 'n'.repeat(2_001)]) {
        expect((await refused('addSessionNote', 422, 'INVALID_INPUT', () => host.post(supervisor, on(id, 'notes'), { text }))).details).toEqual({ in: 'body' });
      }
    }
    expect(unitsSince(host, units).filter((candidate) => !isActivityUnit(candidate))).toEqual([]);

    // Nothing of all that changed the recording; a stop with a reason then works, and a note without text is 409 afterwards.
    expect(host.engine.slice('session')).toMatchObject({ id: sessionId, state: 'RECORDING', stopReason: null, notes: [] });
    const stopped = await command(host, 'stopSession', 202, () => host.post(supervisor, on(sessionId, 'stop'), { reason: 'Done.' }));
    expect(stopped.rows.map((row) => [row.type, row.actorId, row.details['reason']])).toEqual([['RECORDING_STOPPED', supervisor.operator.id, 'Done.']]);
    await refused('addSessionNote', 409, 'INVALID_STATE', () => host.post(supervisor, on(sessionId, 'notes'), { text: '' }));
    await refused('stopSession', 409, 'INVALID_STATE', () => host.post(supervisor, on(sessionId, 'stop'), {}));
    await verified(host);
  });
});

describe('who may call, through the real stages 4 and 6 against PostgreSQL', () => {
  it('a TECHNICIAN is refused 403 NOT_PERMITTED with exactly one ACCESS_DENIED row by the guard; nobody without a session is 401 with no row; the recording is untouched; every role reads the monitor', async () => {
    const { host, investigator } = await booted('w34_access');
    const technician = await host.signIn('TECHNICIAN');
    await host.engine.setTabletLink('CONNECTED');
    const sessionId = await create(host, investigator);
    await host.post(investigator, on(sessionId, 'start'));
    await host.drive(PRECHECK_MS);
    await host.post(investigator, on(sessionId, 'start'));
    expect(host.engine.slice('session')?.state).toBe('RECORDING');

    for (const [operationId, path, body, permission] of [
      ['stopSession', 'stop', { reason: 'Interview completed' }, 'SESSION_START'],
      ['addSessionNote', 'notes', { text: 'A note the simulator would have accepted' }, 'SESSION_NOTE'],
    ] as const) {
      const denied = await command(host, operationId, 403, () => host.post(technician, on(sessionId, path), body));
      expect(errorOf(denied.response)).toMatchObject({ code: 'NOT_PERMITTED', details: { permission } });
      expect(denied.rows).toHaveLength(1);
      expect(denied.rows[0]).toMatchObject({ type: 'ACCESS_DENIED', actorId: technician.operator.id, details: { operationId, permission, role: 'TECHNICIAN' } });
    }
    const anonymous = await command(host, 'stopSession', 401, () => host.post(null, on(sessionId, 'stop'), { reason: 'Interview completed' }));
    expect(errorOf(anonymous.response).code).toBe('NOT_SIGNED_IN');
    expect(anonymous.rows).toEqual([]);

    expect(host.engine.slice('session')).toMatchObject({ state: 'RECORDING', notes: [] });
    const monitor = await host.get(technician, CURRENT);
    expect(monitor.statusCode).toBe(200);
    expect(validateCoreApiResponse('getCurrentSession', 200, monitor.json())).toEqual({ ok: true });
    expect(monitor.json()).toMatchObject({ session: { id: sessionId, state: 'RECORDING' } });
    expect((await host.get(null, CURRENT)).statusCode).toBe(401);
    await verified(host);
  });
});
