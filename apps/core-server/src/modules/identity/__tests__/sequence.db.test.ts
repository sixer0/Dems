// The order of work of each identity operation, statement by statement (plan row W24; spec §8.2
// ENG-24, ENG-26; ID-2; database contract §5.6 AT-1, AT-2, AT-C1). A clone of the seed template;
// the pool of the app records every statement it is asked to run, on the pool ("pool") and on a
// unit's connection ("unit"), and the lockout, the denial budget and the Argon2id derivation
// add their own marks, so each operation leaves one timeline.
//
// What the timelines pin: the attempt is taken BEFORE the derivation; the derivation runs between
// the two units and outside any transaction; every unit opens with the chain lock; a failed
// attempt of a known and of an unknown username does exactly the same work; a locked attempt is
// not verified; a read costs one indexed lookup; and nothing is asked of the database for a
// request without a credential.
import { OPERATORS } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { createRuntimePool, type PoolFactory } from '../../../plugins/db';
import { rateLimited } from '../../../plugins/throttle';
import { deriveArgon2id } from '../password-hash';
import * as store from '../session-store';
import {
  SESSION,
  SIGN_OUT,
  STATUS,
  TOUCH,
  WEB_ORIGIN,
  errorOf,
  forgetCounters,
  get,
  identityApp,
  signInOnWeb,
  webPost,
  webSignIn,
  type IdentityApp,
} from '../../../../test/support/identity';

const db = useTestDatabase({ template: 'seed' });
let identity: IdentityApp;
const timeline: string[] = [];

const SUPERVISOR = OPERATORS[1]!;

/** The name of a statement: the store's constant, or what the core's unit and writers issue. */
const NAMES = new Map<string, string>(
  Object.entries(store).flatMap(([name, value]): Array<[string, string]> => {
    if (typeof value === 'string') return [[value, name]];
    if (typeof value === 'object' && value !== null) return Object.entries(value).map(([key, text]) => [String(text), `${name}.${key}`]);
    return [];
  }),
);

function nameOf(query: unknown, values: unknown): string {
  const text = typeof query === 'string' ? query : (query as { text: string }).text;
  const parameters = (Array.isArray(values) ? values : ((query as { values?: unknown[] }).values ?? [])) as unknown[];
  const known = NAMES.get(text);
  if (known !== undefined) return known;
  if (text.startsWith('BEGIN')) return text;
  if (text.includes('audit_chain_lock()')) return 'chain lock';
  if (text.includes('set_config')) return 'statement timeout';
  if (text.startsWith('insert into "audit_log"')) return `INSERT audit_log ${String(parameters[3])}`;
  if (text.startsWith('insert into "events"')) return `INSERT events ${String(parameters[3])}`;
  if (text.startsWith('UPDATE public.engine_counters')) return 'event number';
  return text;
}

/** The runtime pool, recording. A unit's connection is handed out behind a proxy, so the pooled client itself is not changed. */
const recordingPool: PoolFactory = (connection) => {
  const pool = createRuntimePool(connection);
  const query = pool.query.bind(pool) as (...args: unknown[]) => unknown;
  const connect = pool.connect.bind(pool) as (...args: unknown[]) => unknown;
  Object.assign(pool, {
    query(text: unknown, values?: unknown) {
      timeline.push(`pool  ${nameOf(text, values)}`);
      return query(text, values);
    },
    connect(...args: unknown[]) {
      // The pool's own `query` connects with a callback: that statement is recorded above.
      if (args.length > 0) return connect(...args);
      return (connect() as Promise<PoolClient>).then(
        (client) =>
          new Proxy(client, {
            get(target, property) {
              if (property === 'query') {
                return (text: unknown, values?: unknown) => {
                  timeline.push(`unit  ${nameOf(text, values)}`);
                  return (target.query as (...inner: unknown[]) => unknown)(text, values);
                };
              }
              const member = Reflect.get(target, property) as unknown;
              return typeof member === 'function' ? (member as (...inner: unknown[]) => unknown).bind(target) : member;
            },
          }),
      );
    },
  });
  return pool as Pool;
};

beforeAll(async () => {
  identity = await identityApp(db, { createPool: recordingPool });
  const { lockout } = identity.control;
  for (const method of ['take', 'fail', 'succeed'] as const) {
    const original = lockout[method].bind(lockout) as (...args: unknown[]) => unknown;
    vi.spyOn(lockout, method).mockImplementation(((...args: unknown[]) => {
      timeline.push(`lockout.${method} ${String(args[0])}`);
      return original(...args);
    }) as never);
  }
  const budget = identity.app.denialBudget;
  const consume = budget.consume.bind(budget);
  vi.spyOn(budget, 'consume').mockImplementation((request) => {
    timeline.push('denialBudget.consume');
    return consume(request);
  });
  identity.derive.mockImplementation((request) => {
    timeline.push('Argon2id derivation');
    return deriveArgon2id(request);
  });
});

beforeEach(() => {
  forgetCounters(identity);
});

/** Runs `work` and returns what it left on the timeline. */
async function recorded(work: () => Promise<unknown>): Promise<string[]> {
  timeline.length = 0;
  await work();
  await identity.app.pipeline.drain();
  return [...timeline];
}

const UNIT_OPENS = ['unit  BEGIN ISOLATION LEVEL READ COMMITTED', 'unit  chain lock', 'unit  statement timeout'];

describe('signIn: two units with the derivation between them (ENG-26)', () => {
  it('a success: take the attempt; read the hash set; derive; then ONE transaction that re-checks the operator and writes the session and its row', async () => {
    const steps = await recorded(() => webSignIn(identity.app, SUPERVISOR.username));
    expect(steps).toEqual([
      'lockout.take web',
      'pool  FIND_SIGN_IN_CANDIDATE',
      'Argon2id derivation',
      ...UNIT_OPENS,
      'unit  MARK_SIGNED_IN',
      'unit  READ_ROLE_PERMISSIONS',
      'unit  INSERT_SESSION',
      'unit  INSERT audit_log AUTH_SUCCESS',
      'unit  event number',
      'unit  INSERT events AUTH_LOGIN',
      'unit  COMMIT',
      'lockout.succeed web',
    ]);
    console.info(`[w24] signIn, success:\n  ${steps.join('\n  ')}`);
  });

  it('a failure of a known and of an unknown username: the same work, step for step', async () => {
    const known = await recorded(() => webSignIn(identity.app, SUPERVISOR.username, 'not-the-password-w24'));
    const unknown = await recorded(() => webSignIn(identity.app, 'nobody.w24', 'not-the-password-w24'));
    expect(known).toEqual([
      'lockout.take web',
      'pool  FIND_SIGN_IN_CANDIDATE',
      'Argon2id derivation',
      'denialBudget.consume',
      'lockout.fail web',
      ...UNIT_OPENS,
      'unit  READ_OPERATOR_ENABLED',
      'unit  INSERT audit_log AUTH_FAILED',
      'unit  event number',
      'unit  INSERT events AUTH_FAILED',
      'unit  COMMIT',
    ]);
    expect(unknown).toEqual(known);
    console.info(`[w24] signIn, failure (known and unknown username alike):\n  ${known.join('\n  ')}`);
  });

  // Security checkpoint CPS1-6. The seam's contract: `consume` throws the 429 when the key holds
  // its 20 refusals. Stage 5 lets no request through once that is so, so only an attempt that was
  // already under way can meet it; here the seam says it for ONE call, and the timeline shows that
  // the attempt then does what every verified failure does (SR-08: comparable time).
  it('a verified failure that finds no place in the denial budget: the same work, step for step, the row included; only the answer is the budget\'s 429', async () => {
    const inside = await recorded(() => webSignIn(identity.app, SUPERVISOR.username, 'not-the-password-w24'));
    const rows = async (): Promise<number> => Number((await db.ownerPool().query<{ n: string }>("SELECT count(*) AS n FROM public.audit_log WHERE type = 'AUTH_FAILED'")).rows[0]?.n);
    const before = await rows();

    vi.mocked(identity.app.denialBudget.consume).mockImplementationOnce(() => {
      timeline.push('denialBudget.consume');
      return Promise.reject(rateLimited(42));
    });
    const answers: LightMyRequestResponse[] = [];
    const beyond = await recorded(async () => void answers.push(await webSignIn(identity.app, SUPERVISOR.username, 'not-the-password-w24')));
    const answer = answers[0]!;

    expect(beyond).toEqual(inside);
    expect(beyond.filter((step) => step === 'Argon2id derivation')).toHaveLength(1);
    expect(beyond).toContain('unit  INSERT audit_log AUTH_FAILED');
    expect(await rows()).toBe(before + 1);
    expect([answer.statusCode, errorOf(answer).code, answer.headers['retry-after']]).toEqual([429, 'RATE_LIMITED', '42']);
    // The failure was counted on the console like the one before it: two of five are gone.
    expect((await get(identity.app, STATUS, { origin: WEB_ORIGIN })).json()).toMatchObject({ locked: false, attemptsRemaining: 3 });
    console.info(`[w24b] signIn, a verified failure beyond the denial budget (answered 429):\n  ${beyond.join('\n  ')}`);
  });

  it('an attempt during the lock: no derivation, no hash set read; one row', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) await webSignIn(identity.app, SUPERVISOR.username, 'not-the-password-w24');
    const steps = await recorded(() => webSignIn(identity.app, SUPERVISOR.username));
    expect(steps).toEqual([
      'lockout.take web',
      'denialBudget.consume',
      'pool  FIND_OPERATOR_ID',
      ...UNIT_OPENS,
      'unit  INSERT audit_log AUTH_LOCKED',
      'unit  event number',
      'unit  INSERT events AUTH_LOCKED',
      'unit  COMMIT',
    ]);
    console.info(`[w24] signIn, during the lock:\n  ${steps.join('\n  ')}`);
  });

  it('a sign-in that presents a session: stage 4 resolves it with one lookup, and unit 2 ends it before it issues the new one', async () => {
    const first = await signInOnWeb(identity, SUPERVISOR.username);
    const steps = await recorded(() => webSignIn(identity.app, SUPERVISOR.username, undefined, first.cookie));
    expect(steps).toEqual([
      'pool  FIND_SESSION_BY_TRANSPORT.COOKIE',
      'lockout.take web',
      'pool  FIND_SIGN_IN_CANDIDATE',
      'Argon2id derivation',
      ...UNIT_OPENS,
      'unit  MARK_SIGNED_IN',
      'unit  READ_ROLE_PERMISSIONS',
      'unit  END_SESSION',
      'unit  INSERT_SESSION',
      'unit  INSERT audit_log AUTH_SUCCESS',
      'unit  event number',
      'unit  INSERT events AUTH_LOGIN',
      'unit  COMMIT',
      'lockout.succeed web',
    ]);
  });
});

describe('the other operations', () => {
  it('a request without a credential asks the database nothing; getSignInStatus reads memory only', async () => {
    expect(await recorded(() => get(identity.app, STATUS))).toEqual([]);
    expect(await recorded(() => get(identity.app, SESSION))).toEqual([]);
    expect(await recorded(() => get(identity.app, SESSION, { cookie: `${identity.cookieName}=not-a-token` }))).toEqual([]);
  });

  it('getAuthSession: one indexed lookup at stage 4, and nothing more (GS-26)', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    expect(await recorded(() => get(identity.app, SESSION, web.cookie))).toEqual(['pool  FIND_SESSION_BY_TRANSPORT.COOKIE']);
  });

  it('touchSession: the lookup, then one unit with the compare-and-set touch; within a second of the last activity, the lookup only', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    expect(await recorded(() => webPost(identity.app, TOUCH, web.cookie))).toEqual(['pool  FIND_SESSION_BY_TRANSPORT.COOKIE']);
    identity.clock.advance(60_000);
    expect(await recorded(() => webPost(identity.app, TOUCH, web.cookie))).toEqual([
      'pool  FIND_SESSION_BY_TRANSPORT.COOKIE',
      ...UNIT_OPENS,
      'unit  TOUCH_SESSION',
      'unit  COMMIT',
    ]);
  });

  it('signOut: the lookup, then one unit that ends the session and writes its row', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    const steps = await recorded(() => webPost(identity.app, SIGN_OUT, web.cookie));
    expect(steps).toEqual([
      'pool  FIND_SESSION_BY_TRANSPORT.COOKIE',
      ...UNIT_OPENS,
      'unit  END_SESSION',
      'unit  INSERT audit_log AUTH_SIGNED_OUT',
      'unit  event number',
      'unit  INSERT events AUTH_LOGOUT',
      'unit  COMMIT',
    ]);
  });

  it('a request with a session past its limit: the lookup, then the unit that ends it with AUTH_EXPIRED; the sweeper: one read, and one unit only when something is past a limit', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    identity.clock.advance(15 * 60_000);
    expect(await recorded(() => get(identity.app, SESSION, web.cookie))).toEqual([
      'pool  FIND_SESSION_BY_TRANSPORT.COOKIE',
      ...UNIT_OPENS,
      'unit  EXPIRE_SESSION',
      'unit  INSERT audit_log AUTH_EXPIRED',
      'unit  event number',
      'unit  INSERT events AUTH_EXPIRED',
      'unit  COMMIT',
    ]);

    // The sweeper: one read; then, because the sessions of the tests above are now idle too, ONE
    // unit with one statement that ends them all, their rows, one statement for all event
    // numbers, their events. A second sweep finds nothing: the read, and no unit.
    const sweep = await recorded(() => identity.control.sweep());
    const ended = sweep.filter((step) => step === 'unit  INSERT audit_log AUTH_EXPIRED').length;
    expect(ended).toBeGreaterThanOrEqual(2);
    expect(sweep).toEqual([
      'pool  ANY_EXPIRED_SESSION',
      ...UNIT_OPENS,
      'unit  EXPIRE_SESSIONS',
      ...Array.from({ length: ended }, () => 'unit  INSERT audit_log AUTH_EXPIRED'),
      'unit  event number',
      ...Array.from({ length: ended }, () => 'unit  INSERT events AUTH_EXPIRED'),
      'unit  COMMIT',
    ]);
    expect(await recorded(() => identity.control.sweep())).toEqual(['pool  ANY_EXPIRED_SESSION']);
  });
});
