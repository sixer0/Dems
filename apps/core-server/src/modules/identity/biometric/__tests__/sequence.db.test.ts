// The order of work of the three biometric operations, statement by statement (plan row W41;
// spec §5.6 steps 1 and 4 to 8, §8.2 ENG-23 to ENG-25; SR-36, SR-37, SR-72; database contract §5.6
// AT-1 to AT-4, AT-C4; module rule M13 "measured round trips for one command"). A clone of the
// seed template; the pool of the app records every statement it is asked to run, on the pool
// ("pool") and on a unit's connection ("unit"), and the lockout and the denial budget add their
// own marks, so each operation leaves one timeline.
//
// What the timelines pin is THIS folder's order of work: the attempt is taken before anything is
// read; the claim is the first statement that names a token and the only one that uses it; every
// refusal that is no reuse does exactly the same work; a locked attempt touches no token; an
// enrolment revokes before it issues and issues with one statement. How a unit opens and closes
// is the core's concern: the statements between BEGIN and the first statement of the folder are
// counted as round trips and not named here.
import { AuditType } from '@dems/shared/sim';
import type { Pool, PoolClient } from 'pg';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../../test/helpers/db';
import { createRuntimePool, type PoolFactory } from '../../../../plugins/db';
import { MINUTE, STATUS, closeOpenSessions } from '../../../../../test/support/identity';
import { deviceGet } from '../../../../../test/support/pairing';
import * as sessions from '../../session-store';
import * as pairing from '../../../pairing/store';
import * as store from '../store';
import {
  INVESTIGATOR,
  TECHNICIAN,
  THIRTY_DAYS,
  biometricApp,
  biometricSignIn,
  clearTokens,
  devicePost,
  enrol,
  enrolledOperator,
  forgetLimits,
  madeUpToken,
  pairDevice,
  passwordSession,
  reportFailure,
  setEnrolment,
  signInWithToken,
  supervisorCookie,
  BIOMETRIC_SIGN_IN,
  type BiometricApp,
  type PairedTestDevice,
} from './support';

// A clone, a booted app and many requests: under the load of parallel rows the default limits are too short (finding F-9 of the administration row).
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const db = useTestDatabase({ template: 'seed' });
let bio: BiometricApp;
let tablet: PairedTestDevice;
let phone: PairedTestDevice;
const timeline: string[] = [];
/** Every statement that reached the database since the last reset, named or not. */
let roundTrips = 0;

/** The name of a statement: a constant of this folder's store, of the identity module's or of the pairing module's. */
const NAMES = new Map<string, string>(
  [...Object.entries(sessions), ...Object.entries(pairing), ...Object.entries(store)].flatMap(([name, value]): Array<[string, string]> => {
    if (typeof value === 'string') return [[value, name]];
    if (typeof value === 'object' && value !== null) return Object.entries(value).map(([key, text]) => [String(text), `${name}.${key}`]);
    return [];
  }),
);
const AUDIT_TYPES = new Set<string>(Object.values(AuditType));
const EVENT_TYPES = new Set(['AUTH_LOGIN', 'AUTH_FAILED', 'AUTH_LOCKED', 'AUTH_LOGOUT', 'AUTH_EXPIRED']);

/** What a statement is called on the timeline; null for one that only the round-trip count names. */
function nameOf(query: unknown, values: unknown): string | null {
  const text = typeof query === 'string' ? query : (query as { text: string }).text;
  const parameters = (Array.isArray(values) ? values : ((query as { values?: unknown[] }).values ?? [])) as unknown[];
  const known = NAMES.get(text);
  if (known !== undefined) return known;
  if (text.startsWith('BEGIN')) return 'BEGIN';
  if (text === 'COMMIT' || text === 'ROLLBACK') return text;
  const typeIn = (types: ReadonlySet<string>): string => String(parameters.find((parameter) => typeof parameter === 'string' && types.has(parameter)));
  if (text.startsWith('insert into "audit_log"')) return `INSERT audit_log ${typeIn(AUDIT_TYPES)}`;
  if (text.startsWith('insert into "events"')) return `INSERT events ${typeIn(EVENT_TYPES)}`;
  if (text.startsWith('UPDATE public.engine_counters')) return 'event number';
  return null;
}

function record(where: 'pool' | 'unit', query: unknown, values: unknown): void {
  roundTrips += 1;
  const name = nameOf(query, values);
  if (name !== null) timeline.push(`${where}  ${name}`);
}

/** The runtime pool, recording. A unit's connection is handed out behind a proxy, so the pooled client itself is not changed. */
const recordingPool: PoolFactory = (connection) => {
  const pool = createRuntimePool(connection);
  const query = pool.query.bind(pool) as (...args: unknown[]) => unknown;
  const connect = pool.connect.bind(pool) as (...args: unknown[]) => unknown;
  Object.assign(pool, {
    query(text: unknown, values?: unknown) {
      record('pool', text, values);
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
                  record('unit', text, values);
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
  bio = await biometricApp(db, { createPool: recordingPool });
  const { lockout } = bio.control;
  for (const method of ['take', 'fail', 'succeed'] as const) {
    const original = lockout[method].bind(lockout) as (...args: unknown[]) => unknown;
    vi.spyOn(lockout, method).mockImplementation(((...args: unknown[]) => {
      timeline.push(`lockout.${method}`);
      return original(...args);
    }) as never);
  }
  const budget = bio.app.denialBudget;
  const consume = budget.consume.bind(budget);
  vi.spyOn(budget, 'consume').mockImplementation((request) => {
    timeline.push('denialBudget.consume');
    return consume(request);
  });
  const cookie = await supervisorCookie(bio);
  tablet = await pairDevice(bio, cookie, 'Interview tablet 01');
  phone = await pairDevice(bio, cookie, 'Second tablet');
});

beforeEach(async () => {
  await bio.app.pipeline.drain();
  await clearTokens(db.ownerPool());
  await closeOpenSessions(db.ownerPool());
  forgetLimits(bio);
  bio.clock.advance(10 * MINUTE);
});

interface Recorded {
  readonly steps: string[];
  /** Statements that reached the database, the opening and closing of each unit included. */
  readonly roundTrips: number;
}

/**
 * Runs `work` and returns what it left on the timeline. Before it, each device is seen once: the
 * device registry records at most once a minute that a device called (a unit of the pairing
 * module at stage 4), and that is no part of an operation of this folder.
 */
async function recorded(work: () => Promise<unknown>): Promise<Recorded> {
  for (const device of [tablet, phone]) await deviceGet(bio.app, STATUS, device.credential);
  await bio.app.pipeline.drain();
  timeline.length = 0;
  roundTrips = 0;
  await work();
  await bio.app.pipeline.drain();
  return { steps: [...timeline], roundTrips };
}

const print = (title: string, run: Recorded): void => console.info(`[w41] ${title} (${run.roundTrips} round trips):\n  ${run.steps.join('\n  ')}`);

/** What every refused token that is no reuse does, step for step. */
const REFUSED = [
  'pool  FIND_DEVICE_BY_CREDENTIAL',
  'lockout.take',
  'unit  BEGIN',
  'unit  CLAIM_TOKEN',
  'unit  READ_TOKEN_STATE',
  'lockout.fail',
  'denialBudget.consume',
  'unit  INSERT audit_log AUTH_FAILED',
  'unit  event number',
  'unit  INSERT events AUTH_FAILED',
  'unit  COMMIT',
];

describe('signInWithBiometric: ONE unit, the attempt taken first, the claim before anything else is read (ENG-23 to ENG-25)', () => {
  it('a success: the lockout, then one transaction: CLAIM, the device, the operator, the permissions, the next token, the session, the row, the event; then the count is cleared', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const run = await recorded(() => biometricSignIn(bio.app, tablet.credential, enrolled.token));
    expect(run.steps).toEqual([
      'pool  FIND_DEVICE_BY_CREDENTIAL',
      'lockout.take',
      'unit  BEGIN',
      'unit  CLAIM_TOKEN',
      'unit  READ_DEVICE_STATE',
      'unit  MARK_SIGNED_IN',
      'unit  READ_ROLE_PERMISSIONS',
      'unit  INSERT_TOKEN',
      'unit  INSERT_SESSION',
      'unit  INSERT audit_log AUTH_SUCCESS',
      'unit  event number',
      'unit  INSERT events AUTH_LOGIN',
      'unit  COMMIT',
      'lockout.succeed',
    ]);
    // Outside the unit the database is asked one thing: who the credential of the request is (stage 4).
    expect(run.steps.filter((step) => step.startsWith('pool'))).toEqual(['pool  FIND_DEVICE_BY_CREDENTIAL']);
    print('signInWithBiometric, a live token', run);
  });

  // Finding F77, decision D118: operation 8 needs the device's own credential. Before the decision
  // this request ran the unit of a success with `END_SESSION` (the presented session, ROTATED).
  it('a session token of the device instead of the device credential: stage 4 resolves it with its two lookups, stage 6 refuses; no attempt is taken, no unit is opened, no place in the budget is asked for', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const run = await recorded(() => biometricSignIn(bio.app, enrolled.sessionToken, enrolled.token));
    expect(run).toEqual({ steps: ['pool  FIND_SESSION_BY_TRANSPORT.BEARER', 'pool  FIND_DEVICE'], roundTrips: 2 });
    print('signInWithBiometric, a session token of the device (refused by stage 6)', run);

    // The same token with the device's own credential: the unit of a success, and no session is ended in it.
    const own = await recorded(() => biometricSignIn(bio.app, tablet.credential, enrolled.token));
    expect(own.steps.at(-1)).toBe('lockout.succeed');
    expect(own.steps).toContain('unit  INSERT_TOKEN');
    expect(own.steps.filter((step) => /END_SESSION|END_BIOMETRIC_SESSIONS/.test(step))).toEqual([]);
  });

  it('an unknown token, a dead token of another device, a revoked one and an expired one: the same work, step for step, and the place in the denial budget is taken before the row', async () => {
    const unknown = await recorded(() => biometricSignIn(bio.app, tablet.credential, madeUpToken('s')));
    expect(unknown.steps).toEqual(REFUSED);

    // Another device's token that was turned off: dead already, so a plain refusal (a LIVE one is a reuse, below).
    const elsewhere = await enrolledOperator(bio.app, phone, INVESTIGATOR.username);
    await setEnrolment(bio.app, elsewhere.sessionToken, { enabled: false });
    forgetLimits(bio);
    const otherDevice = await recorded(() => biometricSignIn(bio.app, tablet.credential, elsewhere.token));

    const off = await enrolledOperator(bio.app, tablet, TECHNICIAN.username);
    await setEnrolment(bio.app, off.sessionToken, { enabled: false });
    forgetLimits(bio);
    const revoked = await recorded(() => biometricSignIn(bio.app, tablet.credential, off.token));

    const old = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    bio.clock.advance(THIRTY_DAYS);
    forgetLimits(bio);
    const expired = await recorded(() => biometricSignIn(bio.app, tablet.credential, old.token));

    const notAToken = await recorded(async () => {
      forgetLimits(bio);
      return biometricSignIn(bio.app, tablet.credential, 'not-a-token');
    });

    for (const run of [otherDevice, revoked, expired, notAToken]) expect(run).toEqual(unknown);
    print('signInWithBiometric, a token that is not accepted (unknown, a dead one of another device, revoked, expired alike)', unknown);
  });

  it('a LIVE token of another device (security checkpoint CPS1-7): step for step the work of a reuse, in the one unit', async () => {
    // The reuse of a used token on its own device, to hold the other against.
    const own = await enrolledOperator(bio.app, tablet, TECHNICIAN.username);
    await signInWithToken(bio.app, tablet.credential, own.token);
    const reuse = await recorded(() => biometricSignIn(bio.app, tablet.credential, own.token));

    const elsewhere = await enrolledOperator(bio.app, phone, INVESTIGATOR.username);
    const signedIn = await signInWithToken(bio.app, phone.credential, elsewhere.token);
    forgetLimits(bio);
    const run = await recorded(() => biometricSignIn(bio.app, tablet.credential, signedIn.biometricToken));

    expect(run.steps).toEqual([
      'pool  FIND_DEVICE_BY_CREDENTIAL',
      'lockout.take',
      'unit  BEGIN',
      'unit  CLAIM_TOKEN',
      'unit  READ_TOKEN_STATE',
      'unit  REVOKE_TOKENS.FAMILY',
      'unit  END_BIOMETRIC_SESSIONS',
      'lockout.fail',
      'denialBudget.consume',
      'unit  INSERT audit_log AUTH_FAILED',
      'unit  event number',
      'unit  INSERT events AUTH_FAILED',
      'unit  COMMIT',
    ]);
    expect(run).toEqual(reuse);
    // The claim came first and changed nothing: the token was never this device's to use.
    expect(run.steps.filter((step) => !['unit  REVOKE_TOKENS.FAMILY', 'unit  END_BIOMETRIC_SESSIONS'].includes(step))).toEqual(REFUSED);
    print('signInWithBiometric, a live token of another device', run);
  });

  it('a REUSE: the same up to the read, then the family and the sessions, both before the failure is counted and audited', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    await signInWithToken(bio.app, tablet.credential, enrolled.token);
    const run = await recorded(() => biometricSignIn(bio.app, tablet.credential, enrolled.token));
    expect(run.steps).toEqual([
      'pool  FIND_DEVICE_BY_CREDENTIAL',
      'lockout.take',
      'unit  BEGIN',
      'unit  CLAIM_TOKEN',
      'unit  READ_TOKEN_STATE',
      'unit  REVOKE_TOKENS.FAMILY',
      'unit  END_BIOMETRIC_SESSIONS',
      'lockout.fail',
      'denialBudget.consume',
      'unit  INSERT audit_log AUTH_FAILED',
      'unit  event number',
      'unit  INSERT events AUTH_FAILED',
      'unit  COMMIT',
    ]);
    // Two statements more than any other refusal, and nothing else differs.
    expect(run.steps.filter((step) => !['unit  REVOKE_TOKENS.FAMILY', 'unit  END_BIOMETRIC_SESSIONS'].includes(step))).toEqual(REFUSED);
    print('signInWithBiometric, a token that was used before', run);
  });

  it('an attempt during the lock: no statement names a token; the place in the budget, then one row', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    for (let attempt = 0; attempt < 5; attempt += 1) await biometricSignIn(bio.app, tablet.credential, madeUpToken('t'));
    const run = await recorded(() => biometricSignIn(bio.app, tablet.credential, enrolled.token));
    expect(run.steps).toEqual([
      'pool  FIND_DEVICE_BY_CREDENTIAL',
      'lockout.take',
      'denialBudget.consume',
      'unit  BEGIN',
      'unit  INSERT audit_log AUTH_LOCKED',
      'unit  event number',
      'unit  INSERT events AUTH_LOCKED',
      'unit  COMMIT',
    ]);
    print('signInWithBiometric, during the lock', run);
  });

  it('a token whose operator is disabled while it is live: the claim, the device, the operator (no row), the family; then counted and audited', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, TECHNICIAN.username);
    await db.ownerPool().query('UPDATE public.operators SET enabled = false WHERE id = $1', [TECHNICIAN.id]);
    try {
      const run = await recorded(() => biometricSignIn(bio.app, tablet.credential, enrolled.token));
      expect(run.steps).toEqual([
        'pool  FIND_DEVICE_BY_CREDENTIAL',
        'lockout.take',
        'unit  BEGIN',
        'unit  CLAIM_TOKEN',
        'unit  READ_DEVICE_STATE',
        'unit  MARK_SIGNED_IN',
        'unit  REVOKE_TOKENS.FAMILY',
        'lockout.fail',
        'denialBudget.consume',
        'unit  INSERT audit_log AUTH_FAILED',
        'unit  event number',
        'unit  INSERT events AUTH_FAILED',
        'unit  COMMIT',
      ]);
    } finally {
      await db.ownerPool().query('UPDATE public.operators SET enabled = true WHERE id = $1', [TECHNICIAN.id]);
    }
  });

  it('a body that does not validate, and a caller without a credential: nothing is taken and nothing is asked of the database', async () => {
    expect(await recorded(() => devicePost(bio.app, BIOMETRIC_SIGN_IN, null, { token: madeUpToken('v') }))).toEqual({ steps: [], roundTrips: 0 });
    const invalid = await recorded(() => devicePost(bio.app, BIOMETRIC_SIGN_IN, tablet.credential, { token: '' }));
    // Stage 4 resolved the credential; stage 7 refused the body; no unit was opened.
    expect(invalid.steps).toEqual(['pool  FIND_DEVICE_BY_CREDENTIAL']);
  });
});

describe('setBiometricEnrollment: one unit; the issue is one statement', () => {
  it('on: the session lookup of stage 4, then: revoke what stood, ENROL (the insert that states the session), the row', async () => {
    const sessionToken = await passwordSession(bio.app, tablet, INVESTIGATOR.username);
    const run = await recorded(() => enrol(bio.app, sessionToken));
    expect(run.steps).toEqual([
      'pool  FIND_SESSION_BY_TRANSPORT.BEARER',
      'pool  FIND_DEVICE',
      'unit  BEGIN',
      'unit  REVOKE_TOKENS.ENROLMENT',
      'unit  ENROL_TOKEN',
      'unit  INSERT audit_log BIOMETRIC_ENROLLMENT_CHANGED',
      'unit  COMMIT',
    ]);
    print('setBiometricEnrollment, enabled: true', run);
  });

  it('on, in a session that was created with a token: the same two statements, the read that says why, and a ROLLBACK', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const signedIn = await signInWithToken(bio.app, tablet.credential, enrolled.token);
    const run = await recorded(() => setEnrolment(bio.app, signedIn.sessionToken, { enabled: true }));
    expect(run.steps).toEqual([
      'pool  FIND_SESSION_BY_TRANSPORT.BEARER',
      'pool  FIND_DEVICE',
      'unit  BEGIN',
      'unit  REVOKE_TOKENS.ENROLMENT',
      'unit  ENROL_TOKEN',
      'unit  READ_ENROLMENT_SESSION',
      'unit  ROLLBACK',
    ]);
    print('setBiometricEnrollment, enabled: true, refused', run);
  });

  it('off: one statement and the row; off again: the one statement and no row', async () => {
    const enrolled = await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const off = await recorded(() => setEnrolment(bio.app, enrolled.sessionToken, { enabled: false }));
    expect(off.steps).toEqual([
      'pool  FIND_SESSION_BY_TRANSPORT.BEARER',
      'pool  FIND_DEVICE',
      'unit  BEGIN',
      'unit  REVOKE_TOKENS.ENROLMENT',
      'unit  INSERT audit_log BIOMETRIC_ENROLLMENT_CHANGED',
      'unit  COMMIT',
    ]);
    const again = await recorded(() => setEnrolment(bio.app, enrolled.sessionToken, { enabled: false }));
    expect(again.steps).toEqual(['pool  FIND_SESSION_BY_TRANSPORT.BEARER', 'pool  FIND_DEVICE', 'unit  BEGIN', 'unit  REVOKE_TOKENS.ENROLMENT', 'unit  COMMIT']);
    print('setBiometricEnrollment, enabled: false', off);
  });
});

describe('reportBiometricFailure: one unit; counted before anything is read', () => {
  it('an enrolled operator, one who is not and no operator: the same work, step for step', async () => {
    await enrolledOperator(bio.app, tablet, INVESTIGATOR.username);
    const runs: Recorded[] = [];
    for (const believed of [INVESTIGATOR.id, TECHNICIAN.id, 'OPR-999', null]) {
      forgetLimits(bio);
      runs.push(await recorded(() => reportFailure(bio.app, tablet.credential, believed)));
    }
    expect(runs[0]?.steps).toEqual([
      'pool  FIND_DEVICE_BY_CREDENTIAL',
      'lockout.take',
      'lockout.fail',
      'unit  BEGIN',
      'unit  FIND_ENROLMENT',
      'denialBudget.consume',
      'unit  INSERT audit_log AUTH_FAILED',
      'unit  event number',
      'unit  INSERT events AUTH_FAILED',
      'unit  COMMIT',
    ]);
    for (const run of runs.slice(1)) expect(run).toEqual(runs[0]);
    print('reportBiometricFailure', runs[0]!);
  });

  it('while the device is locked: nothing is counted; the same lookup, the place in the budget, the row', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) await reportFailure(bio.app, tablet.credential, null);
    const run = await recorded(() => reportFailure(bio.app, tablet.credential, INVESTIGATOR.id));
    expect(run.steps).toEqual([
      'pool  FIND_DEVICE_BY_CREDENTIAL',
      'lockout.take',
      'unit  BEGIN',
      'unit  FIND_ENROLMENT',
      'denialBudget.consume',
      'unit  INSERT audit_log AUTH_LOCKED',
      'unit  event number',
      'unit  INSERT events AUTH_LOCKED',
      'unit  COMMIT',
    ]);
    print('reportBiometricFailure, during the lock', run);
  });
});
