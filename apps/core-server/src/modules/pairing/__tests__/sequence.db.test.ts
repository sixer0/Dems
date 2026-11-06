// The order of work of each pairing operation, statement by statement (plan row W32; spec §6.4
// step 3, §8.2 ENG-23 to ENG-25; SR-29, SR-72; database contract §5.6 AT-1 to AT-5, AT-C2, AT-C3;
// module rule M13 "measured round trips for one command"). A clone of the seed template; the
// pool of the app records every statement it is asked to run, on the pool ("pool") and on a
// unit's connection ("unit"), and the redeem lock and the denial budget add their own marks, so
// each operation leaves one timeline.
//
// What the timelines pin is THIS module's order of work: the attempt is taken before anything
// is read; the consuming statement runs before the comparison and before the redeeming one; a
// wrong and an absent code do exactly the same work; a locked attempt touches no code; a read
// costs what it says. How a unit opens and closes is the core's concern: the statements between
// BEGIN and the first statement of the module are counted as round trips and not named here.
import { AuditType } from '@dems/shared/sim';
import type { Pool, PoolClient } from 'pg';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { createRuntimePool, type PoolFactory } from '../../../plugins/db';
import { MINUTE, SESSION, deviceSignIn, get, type Headers } from '../../../../test/support/identity';
import * as biometric from '../../identity/biometric/store';
import * as sessions from '../../identity/session-store';
import * as store from '../store';
import {
  CODE,
  CODE_CANCEL,
  DEVICE,
  DEVICES,
  INVESTIGATOR,
  ROTATE,
  UNPAIR,
  deviceGet,
  devicePost,
  forgetLimits,
  issueCode,
  pairDevice,
  pairingApp,
  portalPost,
  redeem,
  revokeUrl,
  supervisorCookie,
  wrongCodeFor,
  type PairingApp,
} from '../../../../test/support/pairing';

const db = useTestDatabase({ template: 'seed' });
let pairing: PairingApp;
let cookie: Headers;
const timeline: string[] = [];
/** Every statement that reached the database since the last reset, named or not. */
let roundTrips = 0;

/** The name of a statement: a constant of this module's store or of the identity module's (its sessions, its biometric tokens). */
const NAMES = new Map<string, string>(
  [...Object.entries(sessions), ...Object.entries(biometric), ...Object.entries(store)].flatMap(([name, value]): Array<[string, string]> => {
    if (typeof value === 'string') return [[value, name]];
    if (typeof value === 'object' && value !== null) return Object.entries(value).map(([key, text]) => [String(text), `${name}.${key}`]);
    return [];
  }),
);
const AUDIT_TYPES = new Set<string>(Object.values(AuditType));
const EVENT_TYPES = new Set(['PAIRED', 'UNPAIRED', 'PAIRING_FAILED', 'AUTH_LOGIN', 'AUTH_FAILED', 'AUTH_LOCKED', 'AUTH_LOGOUT', 'AUTH_EXPIRED']);

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
  pairing = await pairingApp(db, { createPool: recordingPool });
  const { lock } = pairing.pairing;
  for (const method of ['take', 'fail', 'succeed'] as const) {
    const original = lock[method].bind(lock) as (...args: unknown[]) => unknown;
    vi.spyOn(lock, method).mockImplementation(((...args: unknown[]) => {
      timeline.push(`lock.${method}`);
      return original(...args);
    }) as never);
  }
  const budget = pairing.app.denialBudget;
  const consume = budget.consume.bind(budget);
  vi.spyOn(budget, 'consume').mockImplementation((request) => {
    timeline.push('denialBudget.consume');
    return consume(request);
  });
});

beforeEach(async () => {
  await db.ownerPool().query("UPDATE public.pairing_codes SET state = 'CANCELLED', closed_at = issued_at WHERE state = 'ACTIVE'");
  forgetLimits(pairing);
  pairing.clock.advance(10 * MINUTE);
  cookie = await supervisorCookie(pairing);
});

interface Recorded {
  readonly steps: string[];
  /** Statements that reached the database, the opening and closing of each unit included. */
  readonly roundTrips: number;
}

/** Runs `work` and returns what it left on the timeline. */
async function recorded(work: () => Promise<unknown>): Promise<Recorded> {
  timeline.length = 0;
  roundTrips = 0;
  await work();
  await pairing.app.pipeline.drain();
  return { steps: [...timeline], roundTrips };
}

const print = (title: string, run: Recorded): void => console.info(`[w32] ${title} (${run.roundTrips} round trips):\n  ${run.steps.join('\n  ')}`);

describe('redeemPairingCode: ONE unit, the attempt taken first, the consuming statement before the comparison (ENG-23 to ENG-25)', () => {
  it('a success: the lock, then one transaction: expire, CONSUME, REDEEM, the Core, the device number, the device, its credential, the row, the event', async () => {
    const issued = await issueCode(pairing, cookie);
    const run = await recorded(() => redeem(pairing.app, issued.code));
    expect(run.steps).toEqual([
      'lock.take',
      'unit  BEGIN',
      'unit  EXPIRE_ACTIVE_CODE',
      'unit  CONSUME_REDEEM_ATTEMPT',
      'unit  REDEEM_CODE',
      'unit  READ_CORE_IDENTITY',
      'unit  NEXT_REGISTRY_NUMBER',
      'unit  INSERT_DEVICE',
      'unit  INSERT_DEVICE_CREDENTIAL',
      'unit  INSERT audit_log PAIRING_SUCCESS',
      'unit  event number',
      'unit  INSERT events PAIRED',
      'unit  COMMIT',
      'lock.succeed',
    ]);
    // Nothing is asked of the database outside the unit: no statement on the pool.
    expect(run.steps.filter((step) => step.startsWith('pool'))).toEqual([]);
    print('redeemPairingCode, the right code', run);
  });

  it('a wrong code and an absent code: the same work, step for step (SR-29), and the place in the denial budget is taken before the row', async () => {
    const issued = await issueCode(pairing, cookie);
    const wrong = await recorded(() => redeem(pairing.app, wrongCodeFor(issued.code)));
    await portalPost(pairing.app, CODE_CANCEL, cookie);
    const absent = await recorded(() => redeem(pairing.app, issued.code));
    expect(wrong.steps).toEqual([
      'lock.take',
      'unit  BEGIN',
      'unit  EXPIRE_ACTIVE_CODE',
      'unit  CONSUME_REDEEM_ATTEMPT',
      'lock.fail',
      'denialBudget.consume',
      'unit  INSERT audit_log PAIRING_FAILED',
      'unit  event number',
      'unit  INSERT events PAIRING_FAILED',
      'unit  COMMIT',
    ]);
    expect(absent).toEqual(wrong);
    print('redeemPairingCode, a wrong code (an absent, used, cancelled or expired code alike)', wrong);
  });

  it('the fifth failed attempt of a code: the closing statement after the consuming one, and its row after the failure\'s', async () => {
    const issued = await issueCode(pairing, cookie);
    const wrong = wrongCodeFor(issued.code);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      forgetLimits(pairing);
      await redeem(pairing.app, wrong);
    }
    forgetLimits(pairing);
    const run = await recorded(() => redeem(pairing.app, wrong));
    expect(run.steps).toEqual([
      'lock.take',
      'unit  BEGIN',
      'unit  EXPIRE_ACTIVE_CODE',
      'unit  CONSUME_REDEEM_ATTEMPT',
      'unit  EXHAUST_CODE',
      'lock.fail',
      'denialBudget.consume',
      'unit  INSERT audit_log PAIRING_FAILED',
      'unit  event number',
      'unit  INSERT events PAIRING_FAILED',
      'unit  INSERT audit_log PAIRING_CODE_CLOSED',
      'unit  COMMIT',
    ]);
    print('redeemPairingCode, the fifth failure of a code', run);
  });

  it('an attempt during the lock: no statement names a code; the place in the budget, then one row', async () => {
    const issued = await issueCode(pairing, cookie);
    for (let attempt = 0; attempt < 3; attempt += 1) await redeem(pairing.app, wrongCodeFor(issued.code));
    const run = await recorded(() => redeem(pairing.app, issued.code));
    expect(run.steps).toEqual(['lock.take', 'denialBudget.consume', 'unit  BEGIN', 'unit  INSERT audit_log PAIRING_LOCKED', 'unit  COMMIT']);
    print('redeemPairingCode, during the lock', run);
  });

  it('a code past its time: closed first, with its row, in the same unit', async () => {
    const issued = await issueCode(pairing, cookie);
    pairing.clock.advance(5 * MINUTE);
    const run = await recorded(() => redeem(pairing.app, issued.code));
    expect(run.steps).toEqual([
      'lock.take',
      'unit  BEGIN',
      'unit  EXPIRE_ACTIVE_CODE',
      'unit  INSERT audit_log PAIRING_CODE_CLOSED',
      'unit  CONSUME_REDEEM_ATTEMPT',
      'lock.fail',
      'denialBudget.consume',
      'unit  INSERT audit_log PAIRING_FAILED',
      'unit  event number',
      'unit  INSERT events PAIRING_FAILED',
      'unit  COMMIT',
    ]);
  });

  it('a body that does not validate: nothing is taken and nothing is asked of the database', async () => {
    const run = await recorded(() => devicePost(pairing.app, '/api/v1/pairing/redeem', null, { code: 'nope' }));
    expect(run).toEqual({ steps: [], roundTrips: 0 });
  });
});

describe('the pairing code', () => {
  it('issue: the session lookup of stage 4, then one unit: expire, cancel, the code number, the insert, the row', async () => {
    const run = await recorded(() => portalPost(pairing.app, CODE, cookie));
    expect(run.steps).toEqual([
      'pool  FIND_SESSION_BY_TRANSPORT.COOKIE',
      'unit  BEGIN',
      'unit  EXPIRE_ACTIVE_CODE',
      'unit  CANCEL_ACTIVE_CODE',
      'unit  NEXT_REGISTRY_NUMBER',
      'unit  INSERT_CODE',
      'unit  INSERT audit_log PAIRING_CODE_ISSUED',
      'unit  COMMIT',
    ]);
    print('issuePairingCode', run);

    // With a code standing: the cancelled code's row comes before the insert.
    const again = await recorded(() => portalPost(pairing.app, CODE, cookie));
    expect(again.steps.slice(2)).toEqual([
      'unit  EXPIRE_ACTIVE_CODE',
      'unit  CANCEL_ACTIVE_CODE',
      'unit  INSERT audit_log PAIRING_CODE_CLOSED',
      'unit  NEXT_REGISTRY_NUMBER',
      'unit  INSERT_CODE',
      'unit  INSERT audit_log PAIRING_CODE_ISSUED',
      'unit  COMMIT',
    ]);
  });

  it('status: the lookup and one read; cancel: one unit with two statements and a row; the sweep: one read, and a unit only when a code is past its time', async () => {
    await issueCode(pairing, cookie);
    const status = await recorded(() => get(pairing.app, CODE, cookie));
    expect(status).toEqual({ steps: ['pool  FIND_SESSION_BY_TRANSPORT.COOKIE', 'pool  READ_ACTIVE_CODE'], roundTrips: 2 });
    const cancel = await recorded(() => portalPost(pairing.app, CODE_CANCEL, cookie));
    expect(cancel.steps).toEqual([
      'pool  FIND_SESSION_BY_TRANSPORT.COOKIE',
      'unit  BEGIN',
      'unit  EXPIRE_ACTIVE_CODE',
      'unit  CANCEL_ACTIVE_CODE',
      'unit  INSERT audit_log PAIRING_CODE_CLOSED',
      'unit  COMMIT',
    ]);

    expect(await recorded(() => pairing.pairing.sweepCodes())).toEqual({ steps: ['pool  ANY_EXPIRED_CODE'], roundTrips: 1 });
    await issueCode(pairing, cookie);
    pairing.clock.advance(5 * MINUTE);
    const sweep = await recorded(() => pairing.pairing.sweepCodes());
    expect(sweep.steps).toEqual(['pool  ANY_EXPIRED_CODE', 'unit  BEGIN', 'unit  EXPIRE_ACTIVE_CODE', 'unit  INSERT audit_log PAIRING_CODE_CLOSED', 'unit  COMMIT']);
    print('getPairingCodeStatus', status);
    print('cancelPairingCode', cancel);
  });
});

describe('the registry and a device\'s own operations', () => {
  it('a request without a credential asks the database nothing', async () => {
    for (const url of [DEVICE, DEVICES, CODE]) expect(await recorded(() => deviceGet(pairing.app, url, null))).toEqual({ steps: [], roundTrips: 0 });
    expect(await recorded(() => deviceGet(pairing.app, DEVICE, 'dvc_not-a-credential'))).toEqual({ steps: [], roundTrips: 0 });
  });

  it('list: the session lookup and one read. Registration: the credential lookup and two reads', async () => {
    const device = await pairDevice(pairing, cookie);
    const list = await recorded(() => get(pairing.app, DEVICES, cookie));
    expect(list).toEqual({ steps: ['pool  FIND_SESSION_BY_TRANSPORT.COOKIE', 'pool  READ_REGISTRY'], roundTrips: 2 });
    const registration = await recorded(() => deviceGet(pairing.app, DEVICE, device.credential));
    expect(registration).toEqual({ steps: ['pool  FIND_DEVICE_BY_CREDENTIAL', 'pool  READ_REGISTRATION', 'pool  READ_CORE_IDENTITY'], roundTrips: 3 });
    print('listPairedDevices', list);
    print('getDeviceRegistration', registration);
  });

  it('a session of a device: the session lookup, then the device\'s state; once a minute, the unit that records that it was seen', async () => {
    const device = await pairDevice(pairing, cookie);
    const token = ((await deviceSignIn(pairing.app, device.credential, INVESTIGATOR.username)).json() as { sessionToken: string }).sessionToken;
    expect((await recorded(() => deviceGet(pairing.app, SESSION, token))).steps).toEqual(['pool  FIND_SESSION_BY_TRANSPORT.BEARER', 'pool  FIND_DEVICE']);
    // Within the minute: no unit is taken at all, by a session or by the credential.
    pairing.clock.advance(MINUTE - 1);
    expect(await recorded(() => deviceGet(pairing.app, SESSION, token))).toEqual({ steps: ['pool  FIND_SESSION_BY_TRANSPORT.BEARER', 'pool  FIND_DEVICE'], roundTrips: 2 });
    expect(await recorded(() => deviceGet(pairing.app, DEVICE, device.credential))).toEqual({
      steps: ['pool  FIND_DEVICE_BY_CREDENTIAL', 'pool  READ_REGISTRATION', 'pool  READ_CORE_IDENTITY'],
      roundTrips: 3,
    });
    pairing.clock.advance(1);
    expect((await recorded(() => deviceGet(pairing.app, SESSION, token))).steps).toEqual([
      'pool  FIND_SESSION_BY_TRANSPORT.BEARER',
      'pool  FIND_DEVICE',
      'unit  BEGIN',
      'unit  MARK_DEVICE_SEEN',
      'unit  COMMIT',
    ]);
  });

  it('rotate: one unit with the statement that stores the next hash, and the row. The first use of the new credential: the lookup, the promoting unit, the lookup again', async () => {
    const device = await pairDevice(pairing, cookie);
    const rotate = await recorded(() => devicePost(pairing.app, ROTATE, device.credential));
    expect(rotate.steps).toEqual([
      'pool  FIND_DEVICE_BY_CREDENTIAL',
      'unit  BEGIN',
      'unit  SET_NEXT_CREDENTIAL',
      'unit  INSERT audit_log DEVICE_CREDENTIAL_ROTATED',
      'unit  COMMIT',
    ]);
    print('rotateDeviceCredential', rotate);

    timeline.length = 0;
    const next = ((await devicePost(pairing.app, ROTATE, device.credential)).json() as { deviceCredential: string }).deviceCredential;
    const firstUse = await recorded(() => deviceGet(pairing.app, DEVICE, next));
    expect(firstUse.steps).toEqual([
      'pool  FIND_DEVICE_BY_CREDENTIAL',
      'unit  BEGIN',
      'unit  PROMOTE_CREDENTIAL',
      'unit  COMMIT',
      'pool  FIND_DEVICE_BY_CREDENTIAL',
      'pool  READ_REGISTRATION',
      'pool  READ_CORE_IDENTITY',
    ]);
    // From the second use on it is the current credential: one lookup.
    expect((await recorded(() => deviceGet(pairing.app, DEVICE, next))).steps).toEqual(['pool  FIND_DEVICE_BY_CREDENTIAL', 'pool  READ_REGISTRATION', 'pool  READ_CORE_IDENTITY']);
    print('the first use of a rotated credential (getDeviceRegistration)', firstUse);
  });

  it('revoke: one unit: the compare-and-set, the device\'s sessions, its biometric tokens, the row, the event, the answer. Unpair: the same without the read', async () => {
    const device = await pairDevice(pairing, cookie);
    const other = await pairDevice(pairing, cookie, 'Tablet to unpair');
    const revoke = await recorded(() => portalPost(pairing.app, revokeUrl(device.deviceId), cookie, { reason: 'Revoked for the sequence test' }));
    expect(revoke.steps).toEqual([
      'pool  FIND_SESSION_BY_TRANSPORT.COOKIE',
      'unit  BEGIN',
      'unit  REVOKE_DEVICE',
      'unit  END_SESSIONS_OF_DEVICE',
      'unit  REVOKE_TOKENS.DEVICE',
      'unit  INSERT audit_log DEVICE_REVOKED',
      'unit  event number',
      'unit  INSERT events UNPAIRED',
      'unit  READ_REGISTRY_DEVICE',
      'unit  COMMIT',
    ]);
    const unpair = await recorded(() => devicePost(pairing.app, UNPAIR, other.credential));
    expect(unpair.steps).toEqual([
      'pool  FIND_DEVICE_BY_CREDENTIAL',
      'unit  BEGIN',
      'unit  UNPAIR_DEVICE',
      'unit  END_SESSIONS_OF_DEVICE',
      'unit  REVOKE_TOKENS.DEVICE',
      'unit  INSERT audit_log UNPAIRED',
      'unit  event number',
      'unit  INSERT events UNPAIRED',
      'unit  COMMIT',
    ]);
    print('revokeDevice', revoke);
    print('unpairDevice', unpair);

    // A revoke that changes nothing reads why, and rolls back: 404 and 409.
    const unknown = await recorded(() => portalPost(pairing.app, revokeUrl('DEV-9999'), cookie, { reason: 'No such device at all' }));
    expect(unknown.steps).toEqual(['pool  FIND_SESSION_BY_TRANSPORT.COOKIE', 'unit  BEGIN', 'unit  REVOKE_DEVICE', 'unit  READ_DEVICE_STATE', 'unit  ROLLBACK']);
    // A reason that is too short changes nothing either: one read on the pool, no unit.
    const short = await recorded(() => portalPost(pairing.app, revokeUrl(other.deviceId), cookie, { reason: 'no' }));
    expect(short.steps).toEqual(['pool  FIND_SESSION_BY_TRANSPORT.COOKIE', 'pool  READ_DEVICE_STATE']);
  });
});
