// One recording from create to history, and the recovery after a restart fault, through HTTP
// against PostgreSQL as `dems_app` (plan row W34; spec §7.8, §8.6; AC-B-49, AC-B-50; row rule 3).
//
// The app is the real one, booted on a clone of the seed, on a manual clock and a manual timer.
// Every request passes the real stages 2 to 7; the callers are the seeded operators, signed in
// on the web console. After EVERY step the test reads what PostgreSQL holds as `dems_owner`:
// the status, the two headers of API-7, the audit rows the step stored, the state after it.
//
// THE SAME JOURNEY ON THE SHARED SIMULATOR. A headless `Sim` of `@dems/shared/sim` (the engine
// row's `createHost`) runs the same actions as the same operators at the same instants of its
// own manual clock. The audit types of each step are compared with the server's. The arrivals
// of the recording's integrity stream are left out of the comparison of the timed phases: they
// are drawn from the random streams, which a process start re-derives from the epoch.
import { validateCoreApiResponse, type CurrentSessionResponse, type SessionCommandResponse, type SessionHistoryPage } from '@dems/shared/api';
import type { AuditRow } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../core/__tests__/support';
import { FIXED_NOW, storedSlices } from '../../../engine/__tests__/support';
import { createHost, withoutNegativeZeros, type Host } from '../../../../test/support/seed';
import {
  CURRENT,
  HISTORY,
  OTHER_SESSION,
  SESSION,
  bodyOf,
  errorOf,
  on,
  outcome,
  sessionInput,
  sessionsApp,
  typesOf,
  withoutIntegrityStream,
  type Caller,
  type SessionsApp,
} from './support';

const db = useTestDatabase({ template: 'seed' });

// A clone is made inside a test, and clone and drop wait for the clone lock, which other rows'
// runs may hold; a walk of the history in pages of 1 is 520 requests. Under a loaded host the
// default five seconds of a test are not enough for either (the reset row's files do the same).
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

/** The engine resolves the eight checks within 4.9 s, stops in 1.5 s and finalises in at most 7.2 s. */
const PRECHECK_MS = 5_000;
const RECORD_MS = 3_000;
const FINALIZE_MS = 20_000;
const RECOVERY_MS = 4_000;
/** Exactly five characters: the shortest reason the specification accepts (AC-B-50). */
const FIVE_CHARACTERS = 'Done.';

interface StepRecord {
  readonly step: string;
  readonly status: number | null;
  readonly revision: number;
  readonly audit: readonly string[];
  readonly state: string | null;
}

/** What one journey leaves behind, on the server or on the reference simulator. */
interface Journey {
  readonly steps: StepRecord[];
  /** Every audit row of the journey, in order. */
  readonly rows: AuditRow[];
}

describe('one recording, from create to history (spec §7.8)', () => {
  let host: SessionsApp;
  let investigator: Caller;
  let supervisor: Caller;
  let sessionId = '';
  const journey: Journey = { steps: [], rows: [] };

  beforeAll(async () => {
    host = await sessionsApp(db, db.run.dataDir);
    investigator = await host.signIn('INVESTIGATOR');
    supervisor = await host.signIn('SUPERVISOR');
    // What the realtime channel does when the tablet connects: the pre-check needs the Core link.
    await host.engine.setTabletLink('CONNECTED');
  });

  const sessionState = (): string | null => host.engine.slice('session')?.state ?? null;

  /**
   * One request of the journey. Asserts what every command of this module owes: the documented
   * status, a body the contract accepts, the headers of API-7 naming the revision that holds
   * the effect, and the stored head equal to the engine's (the answer came after the commit).
   */
  async function command(
    step: string,
    operationId: string,
    status: number,
    call: () => Promise<LightMyRequestResponse>,
  ): Promise<{ response: LightMyRequestResponse; rows: AuditRow[]; /** By how much the revision of the replicated state moved. */ moved: number }> {
    const revisionBefore = host.engine.revision;
    let response: LightMyRequestResponse | undefined;
    const rows = await host.written(async () => {
      response = await call();
    });
    if (response === undefined) throw new Error('the step sent no request');
    expect(response.statusCode, step).toBe(status);
    expect(validateCoreApiResponse(operationId, status, bodyOf(response)), step).toEqual({ ok: true });
    if (status < 300) {
      expect(response.headers['x-dems-epoch'], step).toBe(String(host.engine.epoch));
      expect(response.headers['x-dems-revision'], step).toBe(String(host.engine.revision));
      // One command is one unit: at most one state change, and exactly one when it stored a row.
      expect(host.engine.revision - revisionBefore, step).toBeLessThanOrEqual(1);
      if (rows.length > 0) expect(host.engine.revision, step).toBe(revisionBefore + 1);
    } else {
      expect(response.headers['x-dems-epoch'], step).toBeUndefined();
      expect(response.headers['x-dems-revision'], step).toBeUndefined();
      expect(host.engine.revision, step).toBe(revisionBefore);
    }
    // No answer of this module sets a cookie (M8).
    expect(response.headers['set-cookie'], step).toBeUndefined();
    const head = await readHead(host.owner);
    expect(head, step).toEqual({ seq: host.engine.slice('audit').total, hash: host.engine.slice('audit').head });
    // Every row of a command is stamped with the server clock (SR-65).
    for (const row of rows) expect(row.at, `${step} ${row.type}`).toBe(host.clock.now());
    journey.steps.push({ step, status, revision: host.engine.revision, audit: typesOf(rows), state: sessionState() });
    journey.rows.push(...rows);
    return { response, rows, moved: host.engine.revision - revisionBefore };
  }

  /** The engine alone for `ms`: the rows its ticks stored. */
  async function elapse(step: string, ms: number): Promise<AuditRow[]> {
    const rows = await host.written(() => host.drive(ms));
    journey.steps.push({ step, status: null, revision: host.engine.revision, audit: typesOf(rows), state: sessionState() });
    journey.rows.push(...rows);
    return rows;
  }

  it('create: 201 CREATE, SESSION_CREATED by the caller; the same input again is 200 with created false and no row', async () => {
    const input = sessionInput(investigator.operator.id);
    const created = await command('createSession', 'createSession', 201, () => host.post(investigator, SESSION, input));
    const body = created.response.json() as SessionCommandResponse;
    sessionId = body.sessionId;
    expect(body).toEqual({ sessionId, state: 'CREATE', created: true });
    expect(created.rows.map((row) => [row.type, row.actorId, row.sessionId])).toEqual([['SESSION_CREATED', investigator.operator.id, sessionId]]);
    expect(host.engine.slice('session')).toMatchObject({ id: sessionId, state: 'CREATE', createdBy: investigator.operator.id });

    // API-11: the one idempotent command. Equal input returns the open session; nothing is stored.
    const again = await command('createSession (equal input)', 'createSession', 200, () => host.post(investigator, SESSION, input));
    expect(again.response.json()).toEqual({ sessionId, state: 'CREATE', created: false });
    expect(again.rows).toEqual([]);
    expect([created.moved, again.moved]).toEqual([1, 0]);
  });

  it('AC-B-49: another create while the session is open is 409 SESSION_ACTIVE, names the open session and stores nothing', async () => {
    const other = await command('createSession (other input)', 'createSession', 409, () =>
      host.post(supervisor, SESSION, sessionInput(supervisor.operator.id, 'LP/2026/1001-0100')),
    );
    expect(errorOf(other.response)).toMatchObject({ code: 'SESSION_ACTIVE', details: { simCode: 'SESSION_ACTIVE', sessionId } });
    expect(other.rows).toEqual([]);
    expect(host.engine.slice('session')?.id).toBe(sessionId);
  });

  it('getCurrentSession: the open session as the contract writes it, for every role', async () => {
    const response = await host.get(investigator, CURRENT);
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('getCurrentSession', 200, response.json())).toEqual({ ok: true });
    const body = response.json() as CurrentSessionResponse;
    expect(body.session).toMatchObject({
      id: sessionId,
      state: 'CREATE',
      investigatorId: investigator.operator.id,
      investigatorName: investigator.operator.displayName,
      elapsedMs: 0,
      precheck: null,
      fault: null,
    });
    // ISO-8601 in UTC+07:00 on the server clock (API-5: the design-book operations keep that form).
    expect(body.serverTime).toBe('2026-10-01T10:00:00.000+07:00');
    // A GET carries no state position.
    expect(response.headers['x-dems-revision']).toBeUndefined();
  });

  it('start from CREATE: 202 PRECHECK and no audit row (NONE-P); the engine arms the session by itself', async () => {
    const started = await command('startSession (from CREATE)', 'startSession', 202, () => host.post(investigator, on(sessionId, 'start')));
    expect(started.response.json()).toEqual({ sessionId, state: 'PRECHECK' });
    expect(started.rows).toEqual([]);
    // No audit row, and still a state change: the session moved to PRECHECK and an event was stored.
    expect(started.moved).toBe(1);
    expect(sessionState()).toBe('PRECHECK');

    const armed = await elapse('(the eight checks resolve)', PRECHECK_MS);
    expect(typesOf(armed)).toEqual(['PRECHECK_PASSED']);
    // The engine's own row: it names the session's creator, as the system (decision D28 D-2).
    expect(armed[0]).toMatchObject({ actorId: investigator.operator.id, details: { by: 'system' } });
    expect(sessionState()).toBe('ARMED');
  });

  it('start from ARMED: 200 RECORDING, RECORDING_STARTED by the caller', async () => {
    const started = await command('startSession (from ARMED)', 'startSession', 200, () => host.post(investigator, on(sessionId, 'start')));
    expect(started.response.json()).toEqual({ sessionId, state: 'RECORDING' });
    expect(started.rows.map((row) => [row.type, row.actorId])).toEqual([['RECORDING_STARTED', investigator.operator.id]]);
    expect(host.engine.slice('session')).toMatchObject({ state: 'RECORDING', startedAt: host.clock.now() });
    await elapse('(recording)', RECORD_MS);
  });

  it('marker, note, snapshot: 204 each, one row each, by the caller; the note text is in the session and not in its row', async () => {
    const marker = await command('addSessionMarker', 'addSessionMarker', 204, () => host.post(investigator, on(sessionId, 'markers'), { label: 'Key statement' }));
    expect(marker.response.body).toBe('');
    expect(marker.rows.map((row) => [row.type, row.actorId, row.details])).toEqual([['MARKER_ADDED', investigator.operator.id, { label: 'Key statement', index: 1 }]]);

    const note = await command('addSessionNote', 'addSessionNote', 204, () => host.post(supervisor, on(sessionId, 'notes'), { text: 'Subject asked for a break' }));
    expect(note.rows.map((row) => [row.type, row.actorId])).toEqual([['NOTE_ADDED', supervisor.operator.id]]);
    expect(JSON.stringify(note.rows)).not.toContain('asked for a break');
    expect(host.engine.slice('session')?.notes).toMatchObject([{ authorId: supervisor.operator.id, text: 'Subject asked for a break' }]);

    const snapshot = await command('takeSessionSnapshot', 'takeSessionSnapshot', 204, () => host.post(investigator, on(sessionId, 'snapshots')));
    expect(snapshot.rows.map((row) => [row.type, row.actorId])).toEqual([['SNAPSHOT_TAKEN', investigator.operator.id]]);
    expect(host.engine.slice('session')).toMatchObject({ markerCount: 1, snapshotCount: 1 });
  });

  it('AC-B-50: a reason of four characters is 422 INVALID_REASON, decided by the hosted action after the session and its state; nothing is stored and the recording goes on', async () => {
    const refusedBefore = host.engine.stats().commandsRefused;
    const short = await command('stopSession (four characters)', 'stopSession', 422, () => host.post(supervisor, on(sessionId, 'stop'), { reason: 'Done' }));
    expect(errorOf(short.response)).toMatchObject({ code: 'INVALID_REASON', details: { simCode: 'REASON_TOO_SHORT', from: 'RECORDING', event: 'stopRecording' } });
    expect(short.rows).toEqual([]);
    expect(sessionState()).toBe('RECORDING');
    // One error precedence (decision D94): the refusal is the simulator's own, so the engine counted it.
    expect(host.engine.stats().commandsRefused).toBe(refusedBefore + 1);
    // The same short reason on a session that is not the open one is 404: the session is looked at first.
    const other = await host.post(supervisor, on(OTHER_SESSION, 'stop'), { reason: 'Done' });
    expect(outcome(other)).toEqual([404, 'NOT_FOUND']);
    expect(validateCoreApiResponse('stopSession', 404, other.json())).toEqual({ ok: true });
    expect(host.engine.stats().commandsRefused).toBe(refusedBefore + 1);
    expect(host.engine.slice('session')).toMatchObject({ state: 'RECORDING', stopReason: null });
  });

  it('AC-B-50: ANOTHER operator stops the recording with a reason of five characters: 202 STOPPING, RECORDING_STOPPED names that operator', async () => {
    expect(supervisor.operator.id).not.toBe(host.engine.slice('session')?.createdBy);
    const stopped = await command('stopSession (by another operator)', 'stopSession', 202, () =>
      host.post(supervisor, on(sessionId, 'stop'), { reason: FIVE_CHARACTERS }),
    );
    expect(FIVE_CHARACTERS).toHaveLength(5);
    expect(stopped.response.json()).toEqual({ sessionId, state: 'STOPPING' });
    expect(stopped.rows).toHaveLength(1);
    expect(stopped.rows[0]).toMatchObject({
      type: 'RECORDING_STOPPED',
      actorId: supervisor.operator.id,
      sessionId,
      details: { reason: FIVE_CHARACTERS, durationMs: RECORD_MS },
    });
    expect(host.engine.slice('session')).toMatchObject({ state: 'STOPPING', stopReason: FIVE_CHARACTERS, createdBy: investigator.operator.id });
    console.info(
      `[w34] AC-B-50: session ${sessionId} created by ${investigator.operator.id}, stopped by ${supervisor.operator.id} with a reason of ${FIVE_CHARACTERS.length} characters: ` +
        `202 STOPPING, row RECORDING_STOPPED actor ${stopped.rows[0]?.actorId}; four characters: 422 INVALID_REASON, no row`,
    );
  });

  it('finalize: the engine seals by itself; the rows have no actor; the sealed evidence item exists', async () => {
    const sealed = await elapse('(stopping, finalisation, seal)', FINALIZE_MS);
    expect(typesOf(sealed)).toContain('EVIDENCE_SEALED');
    expect(sealed.every((row) => row.actorId === null)).toBe(true);
    expect(sessionState()).toBe('SEALED');
    const evidenceId = host.engine.slice('session')?.evidenceId ?? '';
    expect(host.engine.slice('evidence').find((item) => item.id === evidenceId)).toMatchObject({ sessionId, status: 'SEALED' });
    // No route of this module names evidence: the item is the engine's (operations 39 to 43 are the evidence module's).
    const stored = await host.owner.query<{ status: string }>('SELECT status FROM public.evidence_items WHERE session_id = $1', [sessionId]);
    expect(stored.rows).toEqual([{ status: 'SEALED' }]);
  });

  it('summary: the sealed session stays the current one, with its evidence item and the times of the recording', async () => {
    const response = await host.get(supervisor, CURRENT);
    expect(validateCoreApiResponse('getCurrentSession', 200, response.json())).toEqual({ ok: true });
    const { session } = response.json() as CurrentSessionResponse;
    expect(session).toMatchObject({ id: sessionId, state: 'SEALED', elapsedMs: RECORD_MS, evidenceId: host.engine.slice('session')?.evidenceId });
    expect(session?.sealedAt).not.toBeNull();
    expect(host.engine.slice('lastSealedSessionId')).toBe(sessionId);
    expect(host.engine.slice('lastSealedAcknowledged')).toBe(false);
  });

  it('acknowledge: 204 and SUMMARY_ACKNOWLEDGED once; a repeat and another ID are 204 with no row (the one {id} that never answers 404)', async () => {
    const first = await command('acknowledgeSessionSummary', 'acknowledgeSessionSummary', 204, () => host.post(investigator, on(sessionId, 'summary/acknowledge')));
    expect(first.rows.map((row) => [row.type, row.actorId, row.sessionId])).toEqual([['SUMMARY_ACKNOWLEDGED', investigator.operator.id, sessionId]]);
    expect(host.engine.slice('lastSealedAcknowledged')).toBe(true);

    const repeat = await command('acknowledgeSessionSummary (repeat)', 'acknowledgeSessionSummary', 204, () => host.post(investigator, on(sessionId, 'summary/acknowledge')));
    expect(repeat.rows).toEqual([]);
    const other = await command('acknowledgeSessionSummary (another ID)', 'acknowledgeSessionSummary', 204, () => host.post(investigator, on(OTHER_SESSION, 'summary/acknowledge')));
    expect(other.rows).toEqual([]);
    // Nothing replicated changed: both answers name the revision the first one named.
    expect([first.moved, repeat.moved, other.moved]).toEqual([1, 0, 0]);
    expect([repeat.response.headers['x-dems-revision'], other.response.headers['x-dems-revision']]).toEqual(Array.from({ length: 2 }, () => first.response.headers['x-dems-revision']));
    // Finding F-7 of the engine row: the sealed session stays in place until the next create.
    expect(sessionState()).toBe('SEALED');
  });

  it('history: the session is the newest entry, SEALED, with its evidence item', async () => {
    const response = await host.get(investigator, `${HISTORY}?limit=1`);
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('listSessionHistory', 200, response.json())).toEqual({ ok: true });
    const page = response.json() as SessionHistoryPage;
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ id: sessionId, outcome: 'SEALED', durationMs: RECORD_MS, evidenceId: host.engine.slice('session')?.evidenceId, faultKind: null });
    // The page read from PostgreSQL is the entry of the engine's committed slice.
    expect(page.items[0]).toEqual(host.engine.slice('sessionHistory')[0]);
    expect(page.nextCursor).toBe(`${page.items[0]?.endedAt}-${sessionId}`);
  });

  it('the next create replaces the sealed session (201), and a cancel leaves the Core idle (204, SESSION_CANCELLED)', async () => {
    const next = await command('createSession (after the seal)', 'createSession', 201, () =>
      host.post(supervisor, SESSION, sessionInput(supervisor.operator.id, 'LP/2026/1001-0100')),
    );
    const nextId = (next.response.json() as SessionCommandResponse).sessionId;
    expect(nextId).not.toBe(sessionId);
    expect(typesOf(next.rows)).toEqual(['SESSION_CREATED']);

    const cancelled = await command('cancelSession', 'cancelSession', 204, () => host.post(investigator, on(nextId, 'cancel')));
    expect(cancelled.rows.map((row) => [row.type, row.actorId, row.details])).toEqual([['SESSION_CANCELLED', investigator.operator.id, { fromState: 'CREATE' }]]);
    expect(host.engine.slice('session')).toBeNull();
    expect((await host.get(investigator, CURRENT)).json()).toMatchObject({ session: null });
    // A cancelled session leaves no history entry and no evidence item.
    const stored = await host.owner.query('SELECT 1 FROM public.session_history WHERE id = $1', [nextId]);
    expect(stored.rowCount).toBe(0);
  });

  it('after the journey: the stored chain verifies over all rows, the tables hold the engine\'s committed state, and nothing failed', async () => {
    const trail = await readTrail(host.owner);
    expect(linkProblems(trail)).toEqual([]);
    expect(verifyTrail(trail, await readHead(host.owner))).toMatchObject({ ok: true, checked: trail.length });
    expect(await storedSlices(host.owner)).toStrictEqual(withoutNegativeZeros(host.engine.state()));
    // One command of the journey was refused by the simulator: the stop with a reason of four characters.
    expect(host.engine.stats()).toMatchObject({ commandsRefused: 1, ticksFailed: 0, simErrors: 0, resyncs: 0 });
    expect(host.log.lines().filter((line) => Number(line['level']) >= 50)).toEqual([]);
  });

  it('the audit sequence of the journey is the shared simulator\'s for the same journey', async () => {
    const reference = await createHost({ scenario: 'idle', startAt: FIXED_NOW });
    const simulated = simulatedJourney(reference);

    const comparable = (steps: readonly StepRecord[]): Array<[string, string[], string | null]> =>
      steps.map((step) => [step.step, step.status === null ? withoutIntegrityStream(step.audit.map((type) => ({ type }))).map((row) => row.type) : [...step.audit], step.state]);
    expect(comparable(journey.steps)).toEqual(comparable(simulated.steps));
    expect(typesOf(withoutIntegrityStream(journey.rows))).toEqual(typesOf(withoutIntegrityStream(simulated.rows)));
    // Who each row names is the simulator's too: the caller for a command, nobody for the engine.
    const actors = (rows: readonly AuditRow[]): Array<[string, string | null]> => withoutIntegrityStream(rows).map((row) => [row.type, row.actorId]);
    expect(actors(journey.rows)).toEqual(actors(simulated.rows));
    expect(reference.errors).toEqual([]);

    const width = Math.max(...journey.steps.map((step) => step.step.length));
    console.info(
      [
        `[w34] journey through HTTP against PostgreSQL, beside the shared simulator (session ${sessionId}; ${journey.rows.length} audit rows, ${withoutIntegrityStream(journey.rows).length} without the integrity stream):`,
        `[w34]   ${'step'.padEnd(width)}  status  revision  state      audit rows stored (server) | (simulator)`,
        ...journey.steps.map((step, index) => {
          const other = simulated.steps[index];
          return `[w34]   ${step.step.padEnd(width)}  ${String(step.status ?? '-').padEnd(6)}  ${String(step.revision).padEnd(8)}  ${(step.state ?? 'none').padEnd(9)}  ${step.audit.join(', ') || '-'} | ${other?.audit.join(', ') || '-'}`;
        }),
      ].join('\n'),
    );
  });

  /** The journey above, on the shared simulator: the same actions, operators and instants. */
  function simulatedJourney(reference: Host): Journey {
    const result: Journey = { steps: [], rows: [] };
    const state = (): string | null => reference.state().session?.state ?? null;
    const record = (step: string, status: number | null, work: () => void): void => {
      const before = reference.state().audit.total;
      work();
      const rows = reference.state().audit.rows.filter((row) => row.seq > before);
      result.steps.push({ step, status, revision: 0, audit: typesOf(rows), state: state() });
      result.rows.push(...rows);
    };
    const first = reference.operator('INVESTIGATOR');
    const second = reference.operator('SUPERVISOR');
    const { actions } = reference.sim;
    const input = sessionInput(first.id);

    record('createSession', 201, () => reference.runAs(first, () => actions.createSession(input)));
    record('createSession (equal input)', 200, () => reference.runAs(first, () => actions.createSession(input)));
    record('createSession (other input)', 409, () => reference.runAs(second, () => actions.createSession(sessionInput(second.id, 'LP/2026/1001-0100'))));
    record('startSession (from CREATE)', 202, () => reference.runAs(first, () => actions.beginPrecheck()));
    record('(the eight checks resolve)', null, () => reference.drive(PRECHECK_MS));
    record('startSession (from ARMED)', 200, () => reference.runAs(first, () => actions.startRecording()));
    record('(recording)', null, () => reference.drive(RECORD_MS));
    record('addSessionMarker', 204, () => reference.runAs(first, () => actions.addMarker('Key statement')));
    record('addSessionNote', 204, () => reference.runAs(second, () => actions.addNote('Subject asked for a break')));
    record('takeSessionSnapshot', 204, () => reference.runAs(first, () => actions.snapshot()));
    record('stopSession (four characters)', 422, () => {
      expect(() => reference.runAs(second, () => actions.stopRecording('Done'))).toThrow();
    });
    record('stopSession (by another operator)', 202, () => reference.runAs(second, () => actions.stopRecording(FIVE_CHARACTERS)));
    record('(stopping, finalisation, seal)', null, () => reference.drive(FINALIZE_MS));
    const sealedId = reference.state().lastSealedSessionId ?? '';
    record('acknowledgeSessionSummary', 204, () => reference.runAs(first, () => actions.acknowledgeSummary(sealedId)));
    record('acknowledgeSessionSummary (repeat)', 204, () => reference.runAs(first, () => actions.acknowledgeSummary(sealedId)));
    record('acknowledgeSessionSummary (another ID)', 204, () => reference.runAs(first, () => actions.acknowledgeSummary(OTHER_SESSION)));
    record('createSession (after the seal)', 201, () => reference.runAs(second, () => actions.createSession(sessionInput(second.id, 'LP/2026/1001-0100'))));
    record('cancelSession', 204, () => reference.runAs(first, () => actions.cancel()));
    return result;
  }
});

describe('the recovery after a restart fault (spec §8.6; operation 33)', () => {
  it('a session that was RECORDING when the process stopped is in FAULT after the start; recover answers 202 RECOVERY and the engine closes it as INCOMPLETE', async () => {
    const target = await db.another({ template: 'seed', slug: 'w34_recovery' });
    const first = await sessionsApp(target, db.run.dataDir);
    const investigator = await first.signIn('INVESTIGATOR');
    const supervisor = await first.signIn('SUPERVISOR');
    await first.engine.setTabletLink('CONNECTED');

    // A recording, 10 s in.
    const created = await first.post(investigator, SESSION, sessionInput(investigator.operator.id));
    expect(created.statusCode).toBe(201);
    const { sessionId } = created.json() as SessionCommandResponse;
    expect(outcome(await first.post(investigator, on(sessionId, 'precheck')))).toEqual([202, null]);
    await first.drive(PRECHECK_MS);
    expect(outcome(await first.post(investigator, on(sessionId, 'start')))).toEqual([200, null]);
    await first.drive(10_000);
    expect(first.engine.slice('session')?.state).toBe('RECORDING');
    // While it records, a recovery is the simulator's own refusal: nothing to recover.
    const refused = await first.post(supervisor, on(sessionId, 'recover'));
    expect(outcome(refused)).toEqual([409, 'INVALID_STATE']);
    expect(errorOf(refused).details).toEqual({ simCode: 'ILLEGAL_STATE', from: 'RECORDING', event: 'recover' });
    const stoppedAt = first.clock.now();
    const epoch = first.engine.epoch;
    await first.app.close();

    // A new process on the same database, 90 s later: the boot step runs `start('boot')`.
    const second = await sessionsApp(target, db.run.dataDir, { startAt: stoppedAt + 90_000 });
    expect(second.engine.epoch).toBe(epoch + 1);
    const fault = (await readTrail(second.owner)).filter((row) => row.type === 'FAULT_RAISED').at(-1);
    // The fault is stamped at the last committed instant, with no actor (decision D28 D-1).
    expect(fault).toMatchObject({ actorId: null, at: stoppedAt, sessionId, details: { kind: 'POWER_FAIL' } });

    // The operators' sessions are rows of PostgreSQL: the cookies of before the restart still sign.
    const current = await second.get(supervisor, CURRENT);
    expect(current.statusCode).toBe(200);
    expect(validateCoreApiResponse('getCurrentSession', 200, current.json())).toEqual({ ok: true });
    const faulted = (current.json() as CurrentSessionResponse).session;
    expect(faulted).toMatchObject({ id: sessionId, state: 'FAULT', fault: { kind: 'POWER_FAIL', fromState: 'RECORDING' } });
    // The fault is 10 s after the start of the recording: where the process stopped.
    expect(Date.parse(faulted?.fault?.at ?? '') - Date.parse(faulted?.startedAt ?? '')).toBe(10_000);
    // SIM-GAP-W34-1 (reported, not fixed here): `elapsedMs` is the shared simulator's
    // `selectElapsedMs`, which ends a recording at `stoppedAt` or else at the clock. A faulted
    // session has no `stoppedAt`, so its elapsed time keeps counting through the fault and
    // through the 90 s the server was down. The history entry below says 10 s.
    expect(faulted?.elapsedMs).toBe(10_000 + 90_000);

    // A session in FAULT cannot be stopped or cancelled: the simulator's own refusals.
    expect(outcome(await second.post(supervisor, on(sessionId, 'stop'), { reason: FIVE_CHARACTERS }))).toEqual([409, 'INVALID_STATE']);
    expect(outcome(await second.post(supervisor, on(sessionId, 'cancel')))).toEqual([409, 'INVALID_STATE']);

    const revision = second.engine.revision;
    let response: LightMyRequestResponse | undefined;
    const recovered = await second.written(async () => {
      response = await second.post(supervisor, on(sessionId, 'recover'));
    });
    expect(response?.statusCode).toBe(202);
    expect(response?.json()).toEqual({ sessionId, state: 'RECOVERY' });
    expect(validateCoreApiResponse('recoverSession', 202, response?.json())).toEqual({ ok: true });
    expect(response?.headers['x-dems-epoch']).toBe(String(second.engine.epoch));
    expect(response?.headers['x-dems-revision']).toBe(String(revision + 1));
    // After a power failure the simulated boot is part of the recovery (spec §7.8, operation 33).
    expect(recovered.map((row) => [row.type, row.actorId])).toEqual([
      ['SYSTEM_BOOT', null],
      ['RECOVERY_STARTED', supervisor.operator.id],
      ['FAULT_CLEARED', null],
    ]);
    expect(second.engine.slice('session')).toMatchObject({ state: 'RECOVERY', recovery: { stage: 'RECOVERY_SCAN' } });

    const closed = await second.written(() => second.drive(RECOVERY_MS));
    expect(typesOf(closed)).toEqual(['SESSION_INCOMPLETE', 'RECOVERY_COMPLETED']);
    expect(closed.every((row) => row.actorId === null)).toBe(true);
    expect(second.engine.slice('session')).toBeNull();

    // History: INCOMPLETE, with the fault, and an evidence item that is RECORDED, never sealed.
    const history = (await second.get(investigator, `${HISTORY}?limit=1`)).json() as SessionHistoryPage;
    expect(validateCoreApiResponse('listSessionHistory', 200, history)).toEqual({ ok: true });
    expect(history.items[0]).toMatchObject({ id: sessionId, outcome: 'INCOMPLETE', faultKind: 'POWER_FAIL', durationMs: 10_000 });
    const evidence = await second.owner.query<{ status: string; sealed_at: string | null }>('SELECT status, sealed_at FROM public.evidence_items WHERE session_id = $1', [sessionId]);
    expect(evidence.rows).toEqual([{ status: 'RECORDED', sealed_at: null }]);

    // The same path on the shared simulator: a power failure while recording, then `recover`.
    const reference = await createHost({ scenario: 'idle', startAt: FIXED_NOW });
    const operator = reference.operator('INVESTIGATOR');
    const other = reference.operator('SUPERVISOR');
    const { actions } = reference.sim;
    reference.runAs(operator, () => actions.createSession(sessionInput(operator.id)));
    reference.runAs(operator, () => actions.beginPrecheck());
    reference.drive(PRECHECK_MS);
    reference.runAs(operator, () => actions.startRecording());
    reference.drive(10_000);
    actions.inject('POWER_FAIL');
    const before = reference.state().audit.total;
    reference.runAs(other, () => actions.recover());
    const simulatedRecover = reference.state().audit.rows.filter((row) => row.seq > before);
    const afterRecover = reference.state().audit.total;
    reference.drive(RECOVERY_MS);
    const simulatedClose = reference.state().audit.rows.filter((row) => row.seq > afterRecover);
    expect(recovered.map((row) => [row.type, row.actorId === null ? null : 'caller'])).toEqual(
      simulatedRecover.map((row) => [row.type, row.actorId === null ? null : 'caller']),
    );
    expect(typesOf(closed)).toEqual(typesOf(simulatedClose));

    // The chain verifies over both processes' rows, and the tables hold the committed state.
    const trail = await readTrail(second.owner);
    expect(linkProblems(trail)).toEqual([]);
    expect(verifyTrail(trail, await readHead(second.owner))).toMatchObject({ ok: true, checked: trail.length });
    expect(await storedSlices(second.owner)).toStrictEqual(withoutNegativeZeros(second.engine.state()));
    console.info(
      `[w34] recovery: RECORDING at the stop (epoch ${epoch}) -> boot (epoch ${epoch + 1}): FAULT_RAISED POWER_FAIL at the last committed instant, no actor; ` +
        `recover 202 RECOVERY: ${recovered.map((row) => `${row.type}${row.actorId === null ? '' : ` (${row.actorId})`}`).join(', ')}; ` +
        `then ${typesOf(closed).join(', ')}; history INCOMPLETE, evidence RECORDED | simulator: ${typesOf(simulatedRecover).join(', ')}; ${typesOf(simulatedClose).join(', ')}`,
    );
  });
});
