// The last-administrator rule under concurrency, for real against PostgreSQL (plan row W33; spec
// §4.6 RB-8, §8.2 ENG-23 and ENG-27; database contract §5.6 AT-2, AT-3, AT-C5, T-AT-5; SR-47,
// SR-72; AC-B-79; security design review SD-04).
//
// With exactly two enabled holders of USER_ADMIN, two changes that would each take one of them
// away must give ONE success and ONE 409 `LAST_ADMIN`, never two successes, however they arrive:
//
//   A  free-running   two requests sent together to one instance, many rounds. Each holder takes
//                     ITSELF away, so neither request can lose its permission to the other
//                     before stage 6 has let it through: the answer of the loser is always the
//                     rule's 409, never the guard's 403.
//   B  gated          both requests are held behind one unit of the pipeline until both have
//                     passed stages 3 to 6 and queued their units, then let go: each holder
//                     takes THE OTHER away. The unit that runs second decides on what the first
//                     committed.
//   C  second writer  a second connection of the runtime role holds an uncommitted change of
//                     one holder, with and WITHOUT the lock of the audit chain head; the
//                     server's unit for the other holder waits at the lock point and then
//                     decides on the committed rows. This is what a second process on the same
//                     database would be: the pipeline of this process orders nothing there.
//   D  two instances  two apps built by the real factory on ONE cloned database, each with its
//                     own pipeline, each asked to take one holder away, many rounds.
//
// Counts are printed, so the document can quote them.
import { validateCoreApiResponse } from '@dems/shared/api';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readTrail, sleep } from '../../../../test/support/core';
import { SESSION, cookieValue, webSignIn, type Headers } from '../../../../test/support/identity';
import * as store from '../statements';
import { LOCK_OPERATORS } from '../statements';
import {
  INVESTIGATOR,
  SUPERVISOR,
  TECHNICIAN,
  adminApp,
  disableUrl,
  forgetCounters,
  outcome,
  putOperator,
  recordingPool,
  roleUrl,
  signInWeb,
  storedAdministrators,
  storedOperators,
  web,
  type AdminApp,
} from './support';

const db = useTestDatabase({ template: 'seed' });

// Under the load of several rows' runs a clone, a boot or a sign-in takes many times its usual
// time (seen: a 0.2 s test past the default 5 s). The limits of this file are wide enough for
// that; a real hang still fails, later.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });
let admin: AdminApp;
let owner: Pool;

/** The two holders of USER_ADMIN of this file: the seeded SUPERVISOR and the seeded INVESTIGATOR, promoted. */
const A = SUPERVISOR;
const B = INVESTIGATOR;
const sessions: Record<string, Headers> = {};

const FREE_ROUNDS = 25;
const MIXED_ROUNDS = 15;
const GATED_ROUNDS = 10;
const INSTANCE_ROUNDS = 15;
const CHANGE_TYPES = ['ROLE_CHANGED', 'USER_DISABLED'];

const trailLength = async (): Promise<number> => (await readTrail(owner)).length;
const changesSince = async (from: number, pool: Pool = owner): Promise<string[]> =>
  (await readTrail(pool)).slice(from).filter((row) => CHANGE_TYPES.includes(row.type)).map((row) => `${row.type} ${String(row.actorId)}>${String(row.details['targetOperatorId'])}`);
const statuses = (responses: readonly LightMyRequestResponse[]): number[] => responses.map((response) => response.statusCode).sort((a, b) => a - b);

/** The session of a holder, signed in again when a disable of an earlier round ended it. */
async function sessionOf(operator: typeof A): Promise<Headers> {
  const held = sessions[operator.id];
  if (held !== undefined && (await web(admin.app, held, 'GET', SESSION)).statusCode === 200) return held;
  const fresh = await signInWeb(admin, operator.username);
  sessions[operator.id] = fresh;
  return fresh;
}

/** A round starts with exactly two enabled holders, the engine's slice equal to the table, and fresh counters. */
async function twoHolders(): Promise<{ a: Headers; b: Headers; from: number }> {
  await admin.app.pipeline.drain();
  await putOperator(owner, A.id, { role: 'SUPERVISOR', enabled: true });
  await putOperator(owner, B.id, { role: 'SUPERVISOR', enabled: true });
  await putOperator(owner, TECHNICIAN.id, { role: 'TECHNICIAN', enabled: true });
  await admin.app.engine.mirrorOperators();
  forgetCounters(admin);
  const a = await sessionOf(A);
  const b = await sessionOf(B);
  forgetCounters(admin);
  expect(await storedAdministrators(owner)).toEqual([B.id, A.id]);
  return { a, b, from: await trailLength() };
}

/** One success and one refusal by the rule; one holder left; one row; the loser's row untouched. */
async function expectOneOfTwo(responses: readonly LightMyRequestResponse[], from: number): Promise<number> {
  expect(statuses(responses)).toEqual([200, 409]);
  const lost = responses.findIndex((response) => response.statusCode === 409);
  const refusal = responses[lost];
  expect(refusal === undefined ? null : outcome(refusal)).toEqual([409, 'LAST_ADMIN']);
  expect(refusal?.headers['x-dems-revision']).toBeUndefined();
  expect(await storedAdministrators(owner)).toHaveLength(1);
  expect(await changesSince(from)).toHaveLength(1);
  return 1 - lost;
}

/**
 * Sends `requests` while one unit holds the pipeline, waits until every one of them has passed
 * the stages and queued its unit behind it, then lets them go in the order they queued.
 */
async function gated(requests: () => Promise<LightMyRequestResponse>[]): Promise<LightMyRequestResponse[]> {
  let release: () => void = () => undefined;
  const gate = admin.app.pipeline.run('test.gate', () => new Promise<void>((resolve) => void (release = resolve)));
  // The gate is a unit like any other: the pipeline abandons it after 5 s. It is let go well before that.
  const deadline = performance.now() + 4_000;
  try {
    while (admin.app.pipeline.snapshot().running?.label !== 'test.gate') {
      if (performance.now() > deadline) throw new Error('the gate unit did not start');
      await sleep(1);
    }
    const sent = requests();
    while (admin.app.pipeline.snapshot().pending < sent.length) {
      if (performance.now() > deadline) throw new Error('the requests did not queue their units behind the gate within 4 s');
      await sleep(1);
    }
    release();
    await gate;
    return await Promise.all(sent);
  } finally {
    release();
    await gate.catch(() => undefined);
  }
}

/** The statements the app sent, by the name of the store's constant where it is one of this module's. */
const timeline: string[] = [];
const STORE_NAMES = new Map(Object.entries(store).flatMap(([name, value]): Array<[string, string]> => (typeof value === 'string' ? [[value, name]] : [])));
const nameOf = (text: string): string => STORE_NAMES.get(text) ?? (text.includes('audit_chain_lock()') ? 'chain lock' : text.split(' ').slice(0, 3).join(' '));
/** The last statement a unit of the app has sent. */
const lastOfUnit = (): string | undefined => timeline.filter((entry) => entry.startsWith('unit  ')).at(-1);

beforeAll(async () => {
  owner = db.ownerPool();
  admin = await adminApp(db, { createPool: recordingPool(timeline, nameOf) });
});

beforeEach(() => {
  forgetCounters(admin);
});

describe('A: AC-B-79 free-running, one instance: two concurrent changes, one of each holder', () => {
  it(`two demotions, each holder demoting itself, ${FREE_ROUNDS} rounds: every round one 200 and one 409 LAST_ADMIN, one enabled holder left, one ROLE_CHANGED row`, async () => {
    const won = [0, 0];
    for (let round = 0; round < FREE_ROUNDS; round += 1) {
      const { a, b, from } = await twoHolders();
      const responses = await Promise.all([
        web(admin.app, a, 'POST', roleUrl(A.id), { role: 'INVESTIGATOR' }),
        web(admin.app, b, 'POST', roleUrl(B.id), { role: 'TECHNICIAN' }),
      ]);
      const winner = await expectOneOfTwo(responses, from);
      won[winner] = (won[winner] ?? 0) + 1;
      const refusal = responses[1 - winner];
      expect(validateCoreApiResponse('assignUserRole', 409, refusal?.json())).toEqual({ ok: true });
      // The one who is left is the one who was refused: its row is as it was.
      expect(await storedAdministrators(owner)).toEqual([winner === 0 ? B.id : A.id]);
      expect((await changesSince(from))[0]).toBe(winner === 0 ? `ROLE_CHANGED ${A.id}>${A.id}` : `ROLE_CHANGED ${B.id}>${B.id}`);
    }
    expect(won[0]! + won[1]!).toBe(FREE_ROUNDS);
    console.info(`[w33] AC-B-79 free-running, two demotions: ${FREE_ROUNDS} rounds, ${FREE_ROUNDS} x (one 200, one 409 LAST_ADMIN); the first request won ${won[0]}, the second ${won[1]}; two successes: 0`);
  });

  it(`one demotion and one disable, each holder taking itself away, ${MIXED_ROUNDS} rounds: every round one 200 and one 409 LAST_ADMIN`, async () => {
    const won = { demotion: 0, disable: 0 };
    for (let round = 0; round < MIXED_ROUNDS; round += 1) {
      const { a, b, from } = await twoHolders();
      // The order of the two alternates, so that neither kind is always sent first.
      const demotion = (): Promise<LightMyRequestResponse> => web(admin.app, a, 'POST', roleUrl(A.id), { role: 'TECHNICIAN' });
      const disable = (): Promise<LightMyRequestResponse> => web(admin.app, b, 'POST', disableUrl(B.id), { reason: 'round' });
      const [first, second] = await Promise.all(round % 2 === 0 ? [demotion(), disable()] : [disable(), demotion()]);
      const [demoted, disabled] = round % 2 === 0 ? [first, second] : [second, first];
      await expectOneOfTwo([demoted, disabled], from);
      if (demoted.statusCode === 200) {
        won.demotion += 1;
        expect(await changesSince(from)).toEqual([`ROLE_CHANGED ${A.id}>${A.id}`]);
        expect(await storedAdministrators(owner)).toEqual([B.id]);
        expect(validateCoreApiResponse('disableUser', 409, disabled.json())).toEqual({ ok: true });
        // The refused disable ended no session: B is still signed in.
        expect((await web(admin.app, b, 'GET', SESSION)).statusCode).toBe(200);
      } else {
        won.disable += 1;
        expect(await changesSince(from)).toEqual([`USER_DISABLED ${B.id}>${B.id}`]);
        expect(await storedAdministrators(owner)).toEqual([A.id]);
      }
    }
    expect(won.demotion + won.disable).toBe(MIXED_ROUNDS);
    console.info(`[w33] AC-B-79 free-running, one demotion and one disable: ${MIXED_ROUNDS} rounds, ${MIXED_ROUNDS} x (one 200, one 409 LAST_ADMIN); the demotion won ${won.demotion}, the disable ${won.disable}; two successes: 0`);
  });
});

describe('B: both requests past the guard, their units queued, then run one after the other', () => {
  it(`two demotions, each holder demoting THE OTHER, ${GATED_ROUNDS} rounds: the unit that runs second is refused on what the first committed`, async () => {
    for (let round = 0; round < GATED_ROUNDS; round += 1) {
      const { a, b, from } = await twoHolders();
      const responses = await gated(() => [
        web(admin.app, a, 'POST', roleUrl(B.id), { role: 'INVESTIGATOR' }),
        web(admin.app, b, 'POST', roleUrl(A.id), { role: 'INVESTIGATOR' }),
      ]);
      await expectOneOfTwo(responses, from);
      // Both were let through by stage 6: the refusal is the rule's, and no denial row was written.
      expect((await readTrail(owner)).slice(from).filter((row) => row.type === 'ACCESS_DENIED')).toEqual([]);
    }
    console.info(`[w33] gated, two cross demotions: ${GATED_ROUNDS} rounds, ${GATED_ROUNDS} x (one 200, one 409 LAST_ADMIN); two successes: 0`);
  });

  it('each holder DISABLES the other: one 200 and one 409; the request of the holder who was disabled first changes nothing', async () => {
    for (let round = 0; round < 5; round += 1) {
      const { a, b, from } = await twoHolders();
      const responses = await gated(() => [web(admin.app, a, 'POST', disableUrl(B.id)), web(admin.app, b, 'POST', disableUrl(A.id))]);
      await expectOneOfTwo(responses, from);
      const [left] = await storedAdministrators(owner);
      const rows = await storedOperators(owner);
      // One of the two is disabled, the other untouched.
      expect(rows.filter((row) => row.id === A.id || row.id === B.id).map((row) => row.enabled).sort()).toEqual([false, true]);
      expect(rows.find((row) => row.id === left)).toMatchObject({ enabled: true, role: 'SUPERVISOR' });
    }
  });

  it('a demotion and a disable of the SAME holder, by the two holders: both succeed while the other holder stays, in either order', async () => {
    const { a, b, from } = await twoHolders();
    const responses = await gated(() => [web(admin.app, a, 'POST', roleUrl(B.id), { role: 'TECHNICIAN' }), web(admin.app, a, 'POST', disableUrl(B.id))]);
    expect(statuses(responses)).toEqual([200, 200]);
    expect(await changesSince(from)).toHaveLength(2);
    expect(await storedAdministrators(owner)).toEqual([A.id]);
    expect((await web(admin.app, b, 'GET', SESSION)).statusCode).toBe(401);
  });
});

describe('C: a second writer on the same database (what a second process would be)', () => {
  let second: Pool;

  /**
   * How many backends of THIS database wait for a lock: a lock request that is not granted, of a
   * backend connected to the clone (keyed by the clone's own name, finding F63). The lock view is
   * used, not the wait columns of the activity view: those are hidden from a role that is not the
   * backend's own, and the helper role here is `dems_owner` while the server is `dems_app`.
   */
  const waiting = async (): Promise<number> =>
    (
      await owner.query<{ waiting: number }>(
        'SELECT count(DISTINCT l.pid)::int AS waiting FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid WHERE a.datname = current_database() AND NOT l.granted',
      )
    ).rows[0]?.waiting ?? 0;

  /** Resolves once a backend of this database waits for a lock; fails when the request ends first. */
  async function untilItWaits(request: Promise<LightMyRequestResponse>): Promise<void> {
    let ended = false;
    void request.then(
      () => void (ended = true),
      () => void (ended = true),
    );
    for (let tries = 0; tries < 400; tries += 1) {
      if ((await waiting()) > 0) return;
      if (ended) throw new Error('the request ended without waiting at the lock point');
      await sleep(5);
    }
    throw new Error('no backend of this database waited for a lock within 2 s');
  }

  /** Opens a transaction as `dems_app`, locks as asked, and takes holder A away without committing. */
  async function holdChange(client: PoolClient, options: { chainLock: boolean; change: 'DEMOTE' | 'DISABLE' }): Promise<void> {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    if (options.chainLock) await client.query('SELECT seq, hash FROM public.audit_chain_lock()');
    await client.query(LOCK_OPERATORS);
    const changed =
      options.change === 'DEMOTE'
        ? await client.query("UPDATE public.operators SET role_id = 'INVESTIGATOR', role_changed_at = $2, updated_at = $2 WHERE id = $1 AND role_id = 'SUPERVISOR' RETURNING id", [A.id, admin.clock.now()])
        : await client.query('UPDATE public.operators SET enabled = false, updated_at = $2 WHERE id = $1 AND enabled RETURNING id', [A.id, admin.clock.now()]);
    expect(changed.rowCount).toBe(1);
  }

  /**
   * A connection of the second writer for one test. `body` opens its transaction and sends the
   * server's request; `decide` ends the transaction once the request waits. Whatever happens,
   * the transaction is ended and the request has answered before the next test starts, so no
   * lock and no unit is left behind.
   */
  async function withSecondWriter(
    body: (client: PoolClient) => Promise<{ request: Promise<LightMyRequestResponse>; decide: () => Promise<void> }>,
  ): Promise<LightMyRequestResponse> {
    const client = await second.connect();
    let request: Promise<LightMyRequestResponse> | undefined;
    try {
      const sent = await body(client);
      request = sent.request;
      await sent.decide();
      return await request;
    } finally {
      // A transaction that `decide` already ended answers the ROLLBACK with a warning only.
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
      await request?.catch(() => undefined);
    }
  }

  beforeAll(() => {
    second = db.appPool();
  });

  it.each([
    ['WITH the lock of the audit chain head (AT-2): the unit waits at its first statement', true, 'DEMOTE'],
    ['WITHOUT the chain lock: the unit waits at the lock point of the rule, LOCK_OPERATORS', false, 'DEMOTE'],
    ['WITHOUT the chain lock, a disable held: the same lock point', false, 'DISABLE'],
  ] as const)('the second writer holds an uncommitted change of one holder %s; the server\'s demotion of the other waits, then answers 409 on the committed rows', async (_case, chainLock, change) => {
    const { b, from } = await twoHolders();
    const response = await withSecondWriter(async (client) => {
      await holdChange(client, { chainLock, change });
      // Not committed: every other connection still sees two holders.
      expect(await storedAdministrators(owner)).toEqual([B.id, A.id]);
      const request = web(admin.app, b, 'POST', roleUrl(B.id), { role: 'TECHNICIAN' });
      return {
        request,
        decide: async () => {
          await untilItWaits(request);
          expect(admin.app.pipeline.snapshot().running?.label).toBe('admin.assignUserRole');
          // Where it waits: at the unit's first statement, or at the lock point of the rule. In
          // neither case has it read the roles of the rule or written anything.
          expect(lastOfUnit()).toBe(chainLock ? 'unit  chain lock' : 'unit  LOCK_OPERATORS');
          await client.query('COMMIT');
        },
      };
    });
    expect(outcome(response)).toEqual([409, 'LAST_ADMIN']);
    // B was refused on what the second writer committed: B is the one holder left, untouched.
    expect(await storedAdministrators(owner)).toEqual([B.id]);
    expect(await changesSince(from)).toEqual([]);
    expect(await waiting()).toBe(0);
  });

  it('two units at the lock point: while a second writer HOLDS the lock point and has changed nothing yet, the server\'s unit waits AT it: the roles are not read and nothing is written before the lock is its own', async () => {
    const { b, from } = await twoHolders();
    const response = await withSecondWriter(async (client) => {
      // The second writer is the same code one statement ahead: it holds the lock point, no more.
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await client.query(LOCK_OPERATORS);
      timeline.length = 0;
      const request = web(admin.app, b, 'POST', roleUrl(B.id), { role: 'TECHNICIAN' });
      return {
        request,
        decide: async () => {
          await untilItWaits(request);
          const sent = timeline.filter((entry) => entry.startsWith('unit  '));
          // It has opened its transaction, taken the chain lock, and asked for the lock point: no more.
          expect(sent[0]).toBe('unit  BEGIN ISOLATION LEVEL');
          expect(sent).toContain('unit  chain lock');
          expect(sent.at(-1)).toBe('unit  LOCK_OPERATORS');
          expect(sent.filter((entry) => /READ_ROLES_HOLDING|ASSIGN_ROLE|READ_USER|insert into/.test(entry))).toEqual([]);
          await client.query('COMMIT');
        },
      };
    });
    // The second writer took nobody away: the demotion is a change.
    expect(response.statusCode).toBe(200);
    expect(await storedAdministrators(owner)).toEqual([A.id]);
    expect(await changesSince(from)).toEqual([`ROLE_CHANGED ${B.id}>${B.id}`]);
    const all = timeline.filter((entry) => entry.startsWith('unit  '));
    const lockPoint = all.indexOf('unit  LOCK_OPERATORS');
    expect(all.slice(lockPoint + 1, lockPoint + 3)).toEqual(['unit  READ_ROLES_HOLDING', 'unit  ASSIGN_ROLE']);
  });

  it('the same for a disable by the server: it waits, then 409, and ends no session', async () => {
    const { b, from } = await twoHolders();
    const response = await withSecondWriter(async (client) => {
      await holdChange(client, { chainLock: false, change: 'DEMOTE' });
      const request = web(admin.app, b, 'POST', disableUrl(B.id));
      return {
        request,
        decide: async () => {
          await untilItWaits(request);
          await client.query('COMMIT');
        },
      };
    });
    expect(outcome(response)).toEqual([409, 'LAST_ADMIN']);
    expect(await storedAdministrators(owner)).toEqual([B.id]);
    expect(await changesSince(from)).toEqual([]);
    expect((await web(admin.app, b, 'GET', SESSION)).statusCode).toBe(200);
  });

  it('a second writer that ROLLS BACK takes nobody away: the server\'s demotion waits, then answers 200', async () => {
    const { b, from } = await twoHolders();
    const response = await withSecondWriter(async (client) => {
      await holdChange(client, { chainLock: false, change: 'DEMOTE' });
      const request = web(admin.app, b, 'POST', roleUrl(B.id), { role: 'TECHNICIAN' });
      return {
        request,
        decide: async () => {
          await untilItWaits(request);
          await client.query('ROLLBACK');
        },
      };
    });
    expect(response.statusCode).toBe(200);
    expect(await storedAdministrators(owner)).toEqual([A.id]);
    expect(await changesSince(from)).toEqual([`ROLE_CHANGED ${B.id}>${B.id}`]);
  });

  it('two enables of ONE operator: while a second writer holds an uncommitted enable of it, the server\'s enable waits at its row lock, then finds the operator enabled: 200, nothing written', async () => {
    await twoHolders();
    await putOperator(owner, TECHNICIAN.id, { role: 'TECHNICIAN', enabled: false });
    const a = await sessionOf(A);
    const from = await trailLength();
    const response = await withSecondWriter(async (client) => {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await client.query(store.LOCK_OPERATOR, [TECHNICIAN.id]);
      expect((await client.query(store.ENABLE_OPERATOR, [TECHNICIAN.id, admin.clock.now()])).rowCount).toBe(1);
      timeline.length = 0;
      const request = web(admin.app, a, 'POST', `/api/v1/admin/users/${TECHNICIAN.id}/enable`, { reason: 'second' });
      return {
        request,
        decide: async () => {
          await untilItWaits(request);
          // It waits at its lock, before it has read whether the operator is enabled.
          expect(lastOfUnit()).toBe('unit  LOCK_OPERATOR');
          await client.query('COMMIT');
        },
      };
    });
    // Enabled already, by the other writer: the same answer as "already enabled", and no row of the server.
    expect(response.statusCode).toBe(200);
    expect((response.json() as { enabled: boolean }).enabled).toBe(true);
    expect((await readTrail(owner)).slice(from).filter((row) => row.type === 'USER_ENABLED')).toEqual([]);
    expect(timeline.filter((entry) => entry.startsWith('unit  ') && entry.includes('ENABLE_OPERATOR'))).toEqual([]);
  });

  it('an enable takes no lock on the other rows: it is not held up by a second writer that holds another operator\'s row', async () => {
    await twoHolders();
    await putOperator(owner, TECHNICIAN.id, { role: 'TECHNICIAN', enabled: false });
    const client = await second.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await client.query('SELECT id FROM public.operators WHERE id = $1 FOR UPDATE', [B.id]);
      const response = await web(admin.app, await sessionOf(A), 'POST', `/api/v1/admin/users/${TECHNICIAN.id}/enable`);
      expect(response.statusCode).toBe(200);
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
  });
});

describe('D: two instances on ONE database, each with its own pipeline', () => {
  const MAIN_CONSOLE = 'http://127.0.0.1:5173';
  const LANE_CONSOLE = 'http://127.0.0.1:5176';
  const MIRROR_FAILED = 'the operators mirror of the engine could not be refreshed after a committed change';

  it(`two demotions, one through each instance, ${INSTANCE_ROUNDS} rounds: every round one 200 and one 409 LAST_ADMIN; only the database orders the two units`, async () => {
    const database = await db.another({ slug: 'two_instances' });
    const pool = database.ownerPool();
    const target = { runtime: database.runtime, run: db.run, onCleanup: (close: () => Promise<unknown> | unknown) => database.onCleanup(close) };
    // Neither engine runs (two engines on one database would each see the other's rows as a
    // diverged head): the units and their locks are what is under test.
    const main = await adminApp(target, { port: 4420, boot: false });
    const lane = await adminApp(target, { port: 4421, boot: false });
    expect([main.cookieName, lane.cookieName]).toEqual(['dems_session_4420', 'dems_session_4421']);
    const persisted = [vi.spyOn(main.app.errorLog, 'append'), vi.spyOn(lane.app.errorLog, 'append')];
    await putOperator(pool, B.id, { role: 'SUPERVISOR', enabled: true });

    const signIn = async (instance: AdminApp, origin: string, username: string): Promise<Headers> => {
      const response = await webSignIn(instance.app, username, undefined, { origin });
      const token = cookieValue(response, instance.cookieName);
      if (response.statusCode !== 200 || token === null) throw new Error(`the sign-in answered ${response.statusCode}`);
      return { cookie: `${instance.cookieName}=${token}`, origin };
    };
    const onMain = await signIn(main, MAIN_CONSOLE, A.username);
    const onLane = await signIn(lane, LANE_CONSOLE, B.username);

    const won = { main: 0, lane: 0 };
    for (let round = 0; round < INSTANCE_ROUNDS; round += 1) {
      await Promise.all([main.app.pipeline.drain(), lane.app.pipeline.drain()]);
      await putOperator(pool, A.id, { role: 'SUPERVISOR', enabled: true });
      await putOperator(pool, B.id, { role: 'SUPERVISOR', enabled: true });
      forgetCounters(main);
      forgetCounters(lane);
      const from = (await readTrail(pool)).length;
      const [viaMain, viaLane] = await Promise.all([
        main.app.inject({ method: 'POST', url: roleUrl(A.id), headers: onMain, payload: { role: 'INVESTIGATOR' } }),
        lane.app.inject({ method: 'POST', url: roleUrl(B.id), headers: onLane, payload: { role: 'INVESTIGATOR' } }),
      ]);
      expect(statuses([viaMain, viaLane])).toEqual([200, 409]);
      const refusal = viaMain.statusCode === 409 ? viaMain : viaLane;
      expect(outcome(refusal)).toEqual([409, 'LAST_ADMIN']);
      expect(await storedAdministrators(pool)).toEqual([viaMain.statusCode === 200 ? B.id : A.id]);
      expect(await changesSince(from, pool)).toHaveLength(1);
      if (viaMain.statusCode === 200) won.main += 1;
      else won.lane += 1;
    }
    expect(won.main + won.lane).toBe(INSTANCE_ROUNDS);
    console.info(`[w33] two instances on one database, two demotions: ${INSTANCE_ROUNDS} rounds, ${INSTANCE_ROUNDS} x (one 200, one 409 LAST_ADMIN); the main instance won ${won.main}, the lane ${won.lane}; two successes: 0`);

    // The engines do not run here, so the mirror after each committed change refused. The
    // answers were 200 all the same, and each failure is logged by its code.
    const failures = [...main.log.lines(), ...lane.log.lines()].filter((line) => line['msg'] === MIRROR_FAILED);
    expect(failures).toHaveLength(INSTANCE_ROUNDS);
    expect(failures.every((line) => line['level'] === 50 && line['code'] === 'NOT_READY' && line['source'] === 'admin.assignUserRole')).toBe(true);
    // ... and written to the error log, with the request it belongs to.
    const entries = persisted.flatMap((spy) => spy.mock.calls.map(([entry]) => entry)).filter((entry) => entry.message === MIRROR_FAILED);
    expect(entries).toHaveLength(INSTANCE_ROUNDS);
    expect(entries.every((entry) => entry.level === 'error' && entry.source === 'admin.assignUserRole' && entry.code === 'NOT_READY' && typeof entry.context?.['requestId'] === 'string')).toBe(true);
    // The chain of the shared database is one chain: every row links to its predecessor.
    const trail = await readTrail(pool);
    expect(trail.every((row, index) => index === 0 || row.prevHash === trail[index - 1]?.hash)).toBe(true);
  });
});
