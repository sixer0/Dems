// A statement of an administration unit FAILS in PostgreSQL (plan row W33; spec §8.2 ENG-23;
// database contract §5.6 AT-1; SR-48, SR-50, SR-54; standing rules M5, M8 and M14).
//
// Two things are shown on a clone of the seed, with a real failure of the database:
//
//   ATOMICITY   a unit is one transaction: when a LATER statement of a disable fails, the flag
//               that was already set and the sessions that were already ended are as before.
//   NO LEAK     the server's error for a refused row quotes the whole row in its DETAIL (here:
//               an operator's row with the username, and a biometric token's row with its hash),
//               and the driver's error carries it. None of that, nothing of the statement, and
//               nothing of the reason the administrator typed reaches the answer, the log or the
//               error log.
//
// The failure is made by the test, as `dems_owner`, with a CHECK constraint that refuses exactly
// the row the unit is about to write; it is dropped again before the test ends.
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readEvents, readTrail } from '../../../../test/support/core';
import type { ErrorLogEntry } from '../../../plugins/logger';
import { SESSION, insertPairedDevice, storedSessions, type Headers } from '../../../../test/support/identity';
import { INVESTIGATOR, SUPERVISOR, TECHNICIAN, adminApp, disableUrl, forgetCounters, outcome, roleUrl, signInWeb, storedOperators, web, type AdminApp } from './support';

const db = useTestDatabase({ template: 'seed' });

// Under the load of several rows' runs a clone, a boot or a sign-in takes many times its usual
// time (seen: a 0.2 s test past the default 5 s). The limits of this file are wide enough for
// that; a real hang still fails, later.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });
let admin: AdminApp;
let owner: Pool;
let supervisor: Headers;
let persisted: MockInstance<(entry: ErrorLogEntry) => void>;

const DEVICE = 'DEV-0001';
const REASON = 'MARK-w33-failure reason typed by the administrator';
/** The fixture token's hash: 32 bytes of 0x2b. In the server's DETAIL it reads `\x2b2b…`. */
const TOKEN_HASH = Buffer.alloc(32, 0x2b);
const TOKEN_HASH_HEX = TOKEN_HASH.toString('hex');

async function everything() {
  return {
    operators: await storedOperators(owner),
    sessions: (await storedSessions(owner)).map(({ lastSeenAt: _activity, ...session }) => session),
    tokens: (await owner.query('SELECT operator_id, revoked_at, revoke_reason FROM public.biometric_tokens ORDER BY operator_id')).rows,
    trail: (await readTrail(owner)).length,
    events: (await readEvents(owner)).length,
    revision: admin.app.engine.revision,
  };
}

/** Everything the server wrote about the failure: the answer, the log, the error log. */
function written(response: LightMyRequestResponse): string[] {
  return [response.body, JSON.stringify(response.headers), admin.log.text(), JSON.stringify(persisted.mock.calls)];
}

/** What must be in none of them. */
function expectNoLeak(texts: readonly string[], more: readonly string[] = []): void {
  for (const text of texts) {
    for (const secret of ['MARK-w33-failure', 'Failing row', 'violates check', 'UPDATE public.', 'role_changed_at', 'revoke_reason', ...more]) {
      expect(text.includes(secret), `"${secret.slice(0, 12)}…" was written`).toBe(false);
    }
  }
}

beforeAll(async () => {
  owner = db.ownerPool();
  admin = await adminApp(db);
  persisted = vi.spyOn(admin.app.errorLog, 'append');
  await insertPairedDevice(owner, DEVICE, SUPERVISOR.id, admin.clock.now());
  supervisor = await signInWeb(admin, SUPERVISOR.username);
  await admin.app.pipeline.drain();
});

beforeEach(() => {
  forgetCounters(admin);
  admin.published.length = 0;
  persisted.mockClear();
});

afterEach(async () => {
  await owner.query('ALTER TABLE public.operators DROP CONSTRAINT IF EXISTS w33_refuse_role_change');
  await owner.query('ALTER TABLE public.biometric_tokens DROP CONSTRAINT IF EXISTS w33_refuse_revoke');
});

describe('a role change whose UPDATE the database refuses', () => {
  it('answers 500 INTERNAL_ERROR with no detail; the unit rolled back; nothing of the refused row, of the statement or of the reason is written anywhere; the next unit runs', async () => {
    await owner.query('ALTER TABLE public.operators ADD CONSTRAINT w33_refuse_role_change CHECK (role_changed_at IS NULL) NOT VALID');
    const before = await everything();
    const linesBefore = admin.log.lines().length;

    const response = await web(admin.app, supervisor, 'POST', roleUrl(TECHNICIAN.id), { role: 'INVESTIGATOR', reason: REASON });
    expect(outcome(response)).toEqual([500, 'INTERNAL_ERROR']);
    const body = response.json() as { error: { code: string; message: string; details?: unknown; requestId?: string } };
    expect(Object.keys(body.error).sort()).toEqual(['code', 'message', 'requestId']);
    expect(body.error.message).toBe('The server could not complete the request.');
    expect(response.headers['x-dems-revision']).toBeUndefined();

    // AT-1: nothing of the unit is stored, nothing is published, and the engine was not asked to mirror.
    expect(await everything()).toEqual(before);
    expect(admin.published).toEqual([]);

    // The failure is in the log and in the error log, by its name and its SQLSTATE.
    const lines = admin.log.lines().slice(linesBefore);
    const failure = lines.filter((line) => Number(line['level']) >= 50);
    expect(failure.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(failure)).toContain('23514');
    expect(persisted.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(persisted.mock.calls.some(([entry]) => entry.code === '23514')).toBe(true);
    // M14, SR-48: and nothing more. The row the server quoted holds the operator's username and name.
    expectNoLeak(written(response), [TECHNICIAN.username, TECHNICIAN.name]);

    // The pipeline goes on: once the database accepts the row, the same request is a change.
    await owner.query('ALTER TABLE public.operators DROP CONSTRAINT w33_refuse_role_change');
    const again = await web(admin.app, supervisor, 'POST', roleUrl(TECHNICIAN.id), { role: 'INVESTIGATOR', reason: REASON });
    expect(again.statusCode).toBe(200);
    expect((await readTrail(owner)).slice(before.trail).map((row) => row.type)).toEqual(['ROLE_CHANGED']);
  });
});

describe('a disable whose LAST statement before the row the database refuses', () => {
  it('ONE unit: the flag that was set and the sessions that were ended are taken back with it; the token hash the server quoted is written nowhere', async () => {
    const session = await signInWeb(admin, INVESTIGATOR.username);
    await owner.query(
      'INSERT INTO public.biometric_tokens (token_hash, family_id, device_id, operator_id, issued_at, expires_at) VALUES ($1, gen_random_uuid(), $2, $3, $4, $5)',
      [TOKEN_HASH, DEVICE, INVESTIGATOR.id, admin.clock.now(), admin.clock.now() + 86_400_000],
    );
    // Refuses the revocation, which the unit sends AFTER it disabled the operator and ended the sessions.
    await owner.query("ALTER TABLE public.biometric_tokens ADD CONSTRAINT w33_refuse_revoke CHECK (revoke_reason IS DISTINCT FROM 'USER_DISABLED') NOT VALID");
    const before = await everything();
    expect(before.sessions.filter((entry) => entry.operatorId === INVESTIGATOR.id && entry.endedAt === null)).toHaveLength(1);
    // The sign-in above was published; from here on only the disable can publish.
    await admin.app.pipeline.drain();
    admin.published.length = 0;

    const response = await web(admin.app, supervisor, 'POST', disableUrl(INVESTIGATOR.id), { reason: REASON });
    expect(outcome(response)).toEqual([500, 'INTERNAL_ERROR']);

    // Nothing of the unit is stored: the operator is enabled, the session is open, the token is live, no row.
    expect(await everything()).toEqual(before);
    expect(admin.published).toEqual([]);
    expect((await web(admin.app, session, 'GET', SESSION)).statusCode).toBe(200);
    // The DETAIL of this failure holds the token's hash. It is in no answer, no log line, no error-log entry.
    expect(persisted.mock.calls.some(([entry]) => entry.code === '23514')).toBe(true);
    expectNoLeak(written(response), [TOKEN_HASH_HEX, TOKEN_HASH_HEX.slice(0, 16), TOKEN_HASH.toString('base64')]);

    // Without the refusal the same request is the whole change, in one unit.
    await owner.query('ALTER TABLE public.biometric_tokens DROP CONSTRAINT w33_refuse_revoke');
    const again = await web(admin.app, supervisor, 'POST', disableUrl(INVESTIGATOR.id), { reason: 'on leave' });
    expect(again.statusCode).toBe(200);
    expect(outcome(await web(admin.app, session, 'GET', SESSION))).toEqual([401, 'NOT_SIGNED_IN']);
    expect((await readTrail(owner)).slice(before.trail).map((row) => [row.type, row.details['sessionsEnded']])).toEqual([['USER_DISABLED', 1]]);
    expect((await owner.query<{ revoke_reason: string | null }>('SELECT revoke_reason FROM public.biometric_tokens WHERE operator_id = $1', [INVESTIGATOR.id])).rows).toEqual([{ revoke_reason: 'USER_DISABLED' }]);
  });
});
