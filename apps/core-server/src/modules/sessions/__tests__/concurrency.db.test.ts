// AC-B-49, Q16, edge case E5: one active session per Core, with two clients at the same moment,
// through HTTP against PostgreSQL as `dems_app` (plan row W34; spec §7.8, §8.2).
//
// Two requests are sent together and are in flight together: each passes the real stages (its
// own statement of stage 4), then each is one unit of the engine's serial pipeline. The first
// unit opens the session; the second finds it open. Nothing here is mocked or ordered by the
// test: the rounds alternate who is sent first, a tick of the engine is queued beside them in
// every other round, and after each round the test reads what PostgreSQL holds.
import { validateCoreApiResponse, type SessionCommandResponse } from '@dems/shared/api';
import type { LightMyRequestResponse } from 'fastify';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { storedSlices } from '../../../../test/support/engine';
import { withoutNegativeZeros } from '../../../../test/support/seed';
import { throttleControl } from '../../../plugins/throttle';
import { SESSION, errorOf, on, sessionInput, sessionsApp, typesOf, type Caller, type SessionsApp } from './support';

const db = useTestDatabase({ template: 'seed' });

// A clone is made inside a test, and clone and drop wait for the clone lock, which other rows'
// runs may hold; a walk of the history in pages of 1 is 520 requests. Under a loaded host the
// default five seconds of a test are not enough for either (the reset row's files do the same).
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const ROUNDS = 40;

let host: SessionsApp;
let investigator: Caller;
let supervisor: Caller;

beforeAll(async () => {
  host = await sessionsApp(db, db.run.dataDir);
  investigator = await host.signIn('INVESTIGATOR');
  supervisor = await host.signIn('SUPERVISOR');
});

const openSessions = async (): Promise<string[]> => (await host.owner.query<{ id: string }>('SELECT id FROM public.active_session')).rows.map((row) => row.id);

/** Ends the open session, so the next round starts from an idle Core. */
async function cancel(caller: Caller, sessionId: string): Promise<void> {
  const response = await host.post(caller, on(sessionId, 'cancel'));
  expect(response.statusCode).toBe(204);
  expect(await openSessions()).toEqual([]);
}

const idOf = (response: LightMyRequestResponse): string => (response.json() as SessionCommandResponse).sessionId;

describe('AC-B-49: two creates at the same moment', () => {
  it(`different input, ${ROUNDS} rounds: one 201 and one 409 SESSION_ACTIVE every time; one stored session, one SESSION_CREATED row, and the refusal names the winner's session`, async () => {
    const winners: Record<string, number> = {};
    for (let round = 0; round < ROUNDS; round += 1) {
      // A fresh window for both operators' throttle keys: this test is not about the throttle.
      throttleControl(host.app).reset();
      const callers = round % 2 === 0 ? [investigator, supervisor] : [supervisor, investigator];
      const before = await readHead(host.owner);
      if (round % 4 >= 2) {
        // A tick of the engine in the same queue: it must change nothing about who wins.
        host.clock.advance(50);
        host.timer.fire();
      }
      const answers = await Promise.all(
        callers.map((caller, index) => host.post(caller, SESSION, sessionInput(caller.operator.id, `LP/2026/1001-${String(1000 + round * 2 + index).padStart(4, '0')}`))),
      );
      await host.engine.idle();

      const statuses = answers.map((answer) => answer.statusCode).sort();
      expect(statuses, `round ${round}`).toEqual([201, 409]);
      const won = answers.findIndex((answer) => answer.statusCode === 201);
      const winner = answers[won] as LightMyRequestResponse;
      const loser = answers[1 - won] as LightMyRequestResponse;
      const sessionId = idOf(winner);
      expect(validateCoreApiResponse('createSession', 201, winner.json())).toEqual({ ok: true });
      expect(validateCoreApiResponse('createSession', 409, loser.json())).toEqual({ ok: true });
      expect(winner.json()).toEqual({ sessionId, state: 'CREATE', created: true });
      expect(errorOf(loser), `round ${round}`).toMatchObject({ code: 'SESSION_ACTIVE', details: { simCode: 'SESSION_ACTIVE', sessionId } });
      // API-7 on the 201 only.
      expect(winner.headers['x-dems-revision']).toBeDefined();
      expect(loser.headers['x-dems-revision']).toBeUndefined();

      // What PostgreSQL holds: exactly one session, the winner's, and one row for it.
      expect(await openSessions(), `round ${round}`).toEqual([sessionId]);
      const rows = (await readTrail(host.owner)).filter((row) => row.seq > before.seq);
      const creator = callers[won] as Caller;
      expect(rows.filter((row) => row.type === 'SESSION_CREATED').map((row) => [row.actorId, row.sessionId]), `round ${round}`).toEqual([[creator.operator.id, sessionId]]);
      expect(host.engine.slice('session')).toMatchObject({ id: sessionId, createdBy: creator.operator.id });
      winners[creator.operator.id] = (winners[creator.operator.id] ?? 0) + 1;

      await cancel(creator, sessionId);
    }
    // Both operators won some rounds: neither is favoured by the module.
    expect(Object.keys(winners).sort()).toEqual([investigator.operator.id, supervisor.operator.id].sort());
    expect(Object.values(winners).reduce((sum, count) => sum + count, 0)).toBe(ROUNDS);
    console.info(
      `[w34] AC-B-49: ${ROUNDS} rounds of two simultaneous creates with different input: ${ROUNDS} x (201, 409 SESSION_ACTIVE), never two sessions; ` +
        `winners ${Object.entries(winners)
          .map(([operator, count]) => `${operator} ${count}`)
          .join(', ')}; a tick of the engine queued beside them in ${ROUNDS / 2} rounds`,
    );
  });

  it('equal input, 20 rounds: one 201 and one 200 with created false, the same session in both answers, one row', async () => {
    for (let round = 0; round < 20; round += 1) {
      throttleControl(host.app).reset();
      const before = await readHead(host.owner);
      const input = sessionInput(investigator.operator.id, `LP/2026/1001-${String(2000 + round).padStart(4, '0')}`);
      const callers = round % 2 === 0 ? [investigator, supervisor] : [supervisor, investigator];
      const answers = await Promise.all(callers.map((caller) => host.post(caller, SESSION, input)));
      expect(answers.map((answer) => answer.statusCode).sort(), `round ${round}`).toEqual([200, 201]);
      const created = answers.find((answer) => answer.statusCode === 201) as LightMyRequestResponse;
      const replayed = answers.find((answer) => answer.statusCode === 200) as LightMyRequestResponse;
      expect(validateCoreApiResponse('createSession', 200, replayed.json())).toEqual({ ok: true });
      expect(replayed.json()).toEqual({ sessionId: idOf(created), state: 'CREATE', created: false });
      expect(await openSessions()).toEqual([idOf(created)]);
      expect(typesOf((await readTrail(host.owner)).filter((row) => row.seq > before.seq))).toEqual(['SESSION_CREATED']);
      await cancel(investigator, idOf(created));
    }
  });

  it('eight creates at once, four from each operator: one 201 and seven 409', async () => {
    throttleControl(host.app).reset();
    const before = await readHead(host.owner);
    const answers = await Promise.all(
      Array.from({ length: 8 }, (_, index) => {
        const caller = index % 2 === 0 ? investigator : supervisor;
        return host.post(caller, SESSION, sessionInput(caller.operator.id, `LP/2026/1001-${String(3000 + index).padStart(4, '0')}`));
      }),
    );
    expect(answers.map((answer) => answer.statusCode).sort()).toEqual([201, 409, 409, 409, 409, 409, 409, 409]);
    const created = answers.find((answer) => answer.statusCode === 201) as LightMyRequestResponse;
    for (const answer of answers.filter((candidate) => candidate.statusCode === 409)) {
      expect(errorOf(answer)).toMatchObject({ code: 'SESSION_ACTIVE', details: { sessionId: idOf(created) } });
    }
    expect(await openSessions()).toEqual([idOf(created)]);
    expect(typesOf((await readTrail(host.owner)).filter((row) => row.seq > before.seq))).toEqual(['SESSION_CREATED']);
  });

  it('a create and a cancel of the open session at the same moment: whichever unit runs first, the Core ends with at most one session and every answer is a documented one', async () => {
    const open = (await openSessions())[0] ?? '';
    expect(open).not.toBe('');
    for (let round = 0; round < 10; round += 1) {
      throttleControl(host.app).reset();
      const current = (await openSessions())[0] ?? '';
      const input = sessionInput(supervisor.operator.id, `LP/2026/1001-${String(4000 + round).padStart(4, '0')}`);
      const pair = round % 2 === 0 ? [host.post(investigator, on(current, 'cancel')), host.post(supervisor, SESSION, input)] : [host.post(supervisor, SESSION, input), host.post(investigator, on(current, 'cancel'))];
      const answers = await Promise.all(pair);
      const cancelled = answers[round % 2 === 0 ? 0 : 1] as LightMyRequestResponse;
      const created = answers[round % 2 === 0 ? 1 : 0] as LightMyRequestResponse;
      expect(cancelled.statusCode, `round ${round}`).toBe(204);
      // The create ran after the cancel (201) or before it (409: the old session was still open).
      expect([201, 409], `round ${round}`).toContain(created.statusCode);
      const stored = await openSessions();
      expect(stored, `round ${round}`).toEqual(created.statusCode === 201 ? [idOf(created)] : []);
      if (stored.length === 0) expect((await host.post(supervisor, SESSION, input)).statusCode).toBe(201);
    }
  });

  it('after all rounds: the chain verifies over every row, the tables hold the committed state, and no unit failed', async () => {
    const trail = await readTrail(host.owner);
    expect(linkProblems(trail)).toEqual([]);
    expect(verifyTrail(trail, await readHead(host.owner))).toMatchObject({ ok: true, checked: trail.length });
    expect(await storedSlices(host.owner)).toStrictEqual(withoutNegativeZeros(host.engine.state()));
    expect(host.engine.stats()).toMatchObject({ ticksFailed: 0, simErrors: 0, resyncs: 0, commandsRefused: 0 });
    expect(host.log.lines().filter((line) => Number(line['level']) >= 50)).toEqual([]);
  });
});
