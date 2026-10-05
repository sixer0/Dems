// API-7 on the real server, against PostgreSQL as `dems_app` (plan row W26, fix round B2a;
// decisions D78 DN-8, D87; spec API-7, RT-5).
//
// The real app factory with every module, the real request stages and the booted engine. Two
// kinds of REAL operation are called (the table of every POST operation with stand-in handlers
// is `api-headers.test.ts`):
//
//   server-native   the POST operations of the identity module and of pairing: no hosted command
//                   runs; their effect is a row of the trail, which the engine takes into its
//                   state when the unit commits;
//   hosted          a command of the simulator through `app.engine.command`.
//
// A handler that sets no header at all, and the OUTCOME of the command its request ran, are in
// `api-headers.outcome.db.test.ts` (an app without the domain modules, with stand-in handlers).
//
// Secrets (P19). A cookie, a session token, a device credential, a pairing code and a biometric
// token are taken from an answer and handed on; none is printed or put into an assertion's text.
import { EPOCH_HEADER_NAME, REVISION_HEADER_NAME } from '@dems/shared/api';
import { OPERATORS, type OperatorRole, type SimOperator } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { SESSION, SIGN_OUT, TOUCH, cookieValue, deviceSignIn, get, webPost, webSignIn, type Headers } from '../../../test/support/identity';
import { CODE, devicePost, portalPost, redeem } from '../../../test/support/pairing';
import { engineApp, stateChanges, type EngineApp } from './support';

const db = useTestDatabase({ template: 'seed' });

const STORAGE_POLICY = '/api/v1/storage/policy';
const BIOMETRIC = '/api/v1/auth/biometric';
const BIOMETRIC_SIGN_IN = `${BIOMETRIC}/sign-in`;
const BIOMETRIC_FAILURE = `${BIOMETRIC}/failure`;

/** `[x-dems-epoch, x-dems-revision]` of an answer; null for a header that is not there. */
function headersOf(response: LightMyRequestResponse): [number | null, number | null] {
  const read = (name: string): number | null => {
    const value = response.headers[name];
    return value === undefined ? null : Number(value);
  };
  return [read(EPOCH_HEADER_NAME), read(REVISION_HEADER_NAME)];
}

function seeded(role: OperatorRole): SimOperator {
  const operator = OPERATORS.find((candidate) => candidate.role === role);
  if (operator === undefined) throw new Error(`no seeded operator with role ${role}`);
  return operator;
}

function cookieOf(host: { app: FastifyInstance }, response: LightMyRequestResponse): Headers {
  const name = host.app.config.sessionCookieName;
  const token = response.statusCode === 200 ? cookieValue(response, name) : null;
  if (token === null) throw new Error(`the web sign-in answered ${response.statusCode}`);
  return { cookie: `${name}=${token}` };
}

describe('the real operations', () => {
  /**
   * Sends one request and checks its answer against API-7 and RT-5: a 2xx POST carries both
   * headers; the epoch is the engine's; the revision is the engine's when the answer left, and
   * the change that holds the request's effect (if it made one) has at most that revision.
   */
  async function call(host: EngineApp, name: string, send: () => Promise<LightMyRequestResponse>, expected: number): Promise<LightMyRequestResponse> {
    const before = host.engine.revision;
    const published = stateChanges(host.publications).length;
    const response = await send();
    expect(response.statusCode, name).toBe(expected);
    const [epoch, revision] = headersOf(response);
    expect(epoch, `${name}: x-dems-epoch`).toBe(host.engine.epoch);
    expect(revision, `${name}: x-dems-revision`).toBe(host.engine.revision);
    expect(revision ?? -1, name).toBeGreaterThanOrEqual(before);
    // RT-5: every change the request caused was published with a revision of at most the header's.
    for (const change of stateChanges(host.publications).slice(published)) expect(change.revision, name).toBeLessThanOrEqual(revision ?? -1);
    return response;
  }

  it('server-native POST operations (identity, biometric, pairing): every 2xx answer carries the epoch and a revision that holds the effect', async () => {
    const target = await db.another({ slug: 'b2a_headers_native' });
    const host = await engineApp(target, db.run.dataDir, { logLevel: 'info' });
    await host.app.readiness.boot();
    const supervisor = seeded('SUPERVISOR');
    const investigator = seeded('INVESTIGATOR');
    const start = host.engine.revision;

    // signIn: its AUTH row is taken into the engine's trail when its unit commits; the answer says a revision at or past it.
    const signedIn = await call(host, 'signIn', () => webSignIn(host.app, supervisor.username), 200);
    const cookie = cookieOf(host, signedIn);
    expect(headersOf(signedIn)[1]).toBeGreaterThan(start);
    host.clock.advance(5_000);
    await call(host, 'touchSession', () => webPost(host.app, TOUCH, cookie), 200);

    // Pairing: the code (201), the redeem by a device without a credential (201).
    const issued = await call(host, 'issuePairingCode', () => portalPost(host.app, CODE, cookie), 201);
    const redeemed = await call(host, 'redeemPairingCode', () => redeem(host.app, (issued.json() as { code: string }).code), 201);
    const credential = (redeemed.json() as { deviceCredential: string }).deviceCredential;

    // The device: a password sign-in, the enrolment, the biometric sign-in, a failure report.
    const onDevice = await call(host, 'signIn (device)', () => deviceSignIn(host.app, credential, investigator.username), 200);
    const sessionToken = (onDevice.json() as { sessionToken: string }).sessionToken;
    const enrolled = await call(host, 'setBiometricEnrollment', () => devicePost(host.app, BIOMETRIC, sessionToken, { enabled: true }), 200);
    const token = (enrolled.json() as { token: string }).token;
    await call(host, 'signInWithBiometric', () => devicePost(host.app, BIOMETRIC_SIGN_IN, credential, { token }), 200);
    await call(host, 'reportBiometricFailure', () => devicePost(host.app, BIOMETRIC_FAILURE, credential, { operatorId: investigator.id }), 200);

    await call(host, 'signOut', () => webPost(host.app, SIGN_OUT, cookie), 204);
    expect(host.log.lines().filter((line) => Number(line['level']) >= 50)).toEqual([]);
  });

  it('a hosted command: the answer carries the revision of the change that holds its effect; a refusal, a failed validation and a GET carry no header', async () => {
    const target = await db.another({ slug: 'b2a_headers_hosted' });
    const host = await engineApp(target, db.run.dataDir, { logLevel: 'info' });
    await host.app.readiness.boot();
    const supervisor = cookieOf(host, await webSignIn(host.app, seeded('SUPERVISOR').username));
    const investigator = cookieOf(host, await webSignIn(host.app, seeded('INVESTIGATOR').username));

    const published = stateChanges(host.publications).length;
    const response = await call(host, 'setStoragePolicy', () => webPost(host.app, STORAGE_POLICY, supervisor, { retentionDays: 123 }), 200);
    const effect = stateChanges(host.publications)
      .slice(published)
      .filter((change) => change.cause === 'command');
    expect(effect).toHaveLength(1);
    expect(headersOf(response)).toEqual([host.engine.epoch, effect[0]?.revision]);

    // 403 by stage 6 (no permission), 422 by the validation, 401 without a session: nothing a client waits for.
    const refused = await webPost(host.app, STORAGE_POLICY, investigator, { retentionDays: 123 });
    expect([refused.statusCode, headersOf(refused)]).toEqual([403, [null, null]]);
    const invalid = await webPost(host.app, STORAGE_POLICY, supervisor, { retentionDays: 'many' });
    expect([invalid.statusCode, headersOf(invalid)]).toEqual([422, [null, null]]);
    const anonymous = await webPost(host.app, STORAGE_POLICY, {}, { retentionDays: 123 });
    expect([anonymous.statusCode, headersOf(anonymous)]).toEqual([401, [null, null]]);
    // A GET, also one that answers 200.
    const read = await get(host.app, SESSION, supervisor);
    expect([read.statusCode, headersOf(read)]).toEqual([200, [null, null]]);
  });
});
