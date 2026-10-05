// ONE time base per process, against PostgreSQL as `dems_app` (fix round B2a, finding F74 = the
// acceptance row's W53-F1 and W53-F2; decision D110; security finding CPS1-1, guarantees G1 to
// G8; ENG-13, ENG-14; spec §8.6).
//
// THE DEFECT. The engine held its own clock at or above the last committed instant; every module
// read the raw server clock. A process that started with the system time set BACK therefore ran
// on two time bases: nothing issued after the instant the raw clock showed could be ended. A
// sign-out, a disable, a revoke and the rotation at sign-in answered 500 (CHECK
// `auth_sessions_times_check`), a pairing code could not be cancelled or redeemed
// (`pairing_codes_times_check`), a biometric token could not be used
// (`biometric_tokens_times_check`), and a row of a server-native module was stamped before its
// predecessor in the one chain.
//
// THE RULE. The engine's start reads the newest instant ANY stored row was written with and
// raises the floor of the SERVER clock to it, inside its unit, before anything of the start reads
// the time. `app.clock` is the one time base: the engine, the pipeline and the modules read it.
// From the floor, time runs on at the real rate.
//
// A restart here is what it is in production, without the listener: the app is closed and a NEW
// app is built by the real factory on the same database and booted through
// `app.readiness.boot()`. Every request is `app.inject` through the real stages and handlers.
//
// Secrets (P19). A cookie, a session token, a device credential, a pairing code and a biometric
// token are taken from an answer and handed on. None is printed, logged, put into a test name or
// compared in an assertion whose failure message would show it.
import { AUTH_IDLE_TIMEOUT_MS, AUTH_LOCKOUT_MS, AUTH_MAX_FAILURES, OPERATORS, type AuditRow, type OperatorRole, type SimOperator } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { useTestDatabase, type TestDatabase } from '../../../test/helpers/db';
import { disableUrl } from '../../../test/support/admin';
import { readHead, readTrail, verifyTrail } from '../../../test/support/core';
import { SESSION, SIGN_OUT, bearer, cookieValue, deviceSignIn, get, webPost, webSignIn, type Headers } from '../../../test/support/identity';
import { CODE, CODE_CANCEL, devicePost, portalPost, redeem, revokeUrl } from '../../../test/support/pairing';
import { BEYOND_DOUBLE, SEED_NOW, plantKeptRows } from '../../../test/support/reset';
import { tableChecksums } from '../../../test/support/seed';
import { createSystemClock, type FloorClock } from '../../core';
import { BULK_TEMPLATE_NOW } from '../../db/fixtures/__tests__/template-hook.bulk';
import { BootError } from '../../plugins/readiness';
import { EngineError } from '../errors';
import { readNewestStoredInstant } from '../rehydrate';
import { FIXED_NOW, engineApp, type EngineApp } from './support';

const db = useTestDatabase({ template: 'seed' });

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const STORAGE_POLICY = '/api/v1/storage/policy';
const BIOMETRIC = '/api/v1/auth/biometric';
const BIOMETRIC_SIGN_IN = `${BIOMETRIC}/sign-in`;
/** ID-P15, stated here on its own: a pairing code lives 300 s. */
const CODE_LIFETIME_MS = 300 * SECOND;

const rel = (at: number): string => `+${((at - FIXED_NOW) / SECOND).toFixed(2)} s`;
const rowLine = (row: AuditRow): string => `${row.seq} ${row.type} (${rel(row.at)})`;

// ── The server ─────────────────────────────────────────────────────────────────────────────────

/** A process start: the real factory on the database, the manual clock at `at`, booted as the entry point boots it. */
async function startServer(target: TestDatabase, at: number): Promise<EngineApp> {
  const host = await engineApp(target, db.run.dataDir, { startAt: at, logLevel: 'info' });
  await host.app.readiness.boot();
  await host.engine.idle();
  await host.app.pipeline.drain();
  return host;
}

/**
 * The server's own clock (`createSystemClock`) on the test's manual clock as its system time AND
 * its timer, behind the seam: a clock that can take a floor. `host.clock` stays the test's handle:
 * advancing it is time passing.
 */
function withServerClock(host: EngineApp): FloorClock {
  const read = (): number => host.clock.now();
  const clock = createSystemClock(read, read);
  host.app.seams.replace('clock', clock);
  return clock;
}

/** A process start with the system time at `at`, which may be BEHIND the stored state. */
async function startBehind(target: TestDatabase, at: number): Promise<EngineApp> {
  const host = await engineApp(target, db.run.dataDir, { startAt: at, logLevel: 'info' });
  withServerClock(host);
  await host.app.readiness.boot();
  await host.engine.idle();
  await host.app.pipeline.drain();
  return host;
}

interface Caller {
  readonly operator: SimOperator;
  /** `{ cookie: 'dems_session_<port>=…' }`. Handed on, never printed. */
  readonly cookie: Headers;
}

function seeded(role: OperatorRole): SimOperator {
  const operator = OPERATORS.find((candidate) => candidate.role === role);
  if (operator === undefined) throw new Error(`no seeded operator with role ${role}`);
  return operator;
}

function callerOf(host: EngineApp, operator: SimOperator, response: LightMyRequestResponse): Caller {
  const cookieName = host.app.config.sessionCookieName;
  const token = response.statusCode === 200 ? cookieValue(response, cookieName) : null;
  if (token === null) throw new Error(`the web sign-in of the ${operator.role} answered ${response.statusCode}`);
  return { operator, cookie: { cookie: `${cookieName}=${token}` } };
}

async function signIn(host: EngineApp, role: OperatorRole): Promise<Caller> {
  const operator = seeded(role);
  return callerOf(host, operator, await webSignIn(host.app, operator.username));
}

/** Operation 15: the code is held by the test only. */
async function issueCode(host: EngineApp, supervisor: Caller): Promise<{ codeId: string; code: string; issuedAt: number; expiresAt: number }> {
  const issued = await portalPost(host.app, CODE, supervisor.cookie);
  if (issued.statusCode !== 201) throw new Error(`issuePairingCode answered ${issued.statusCode}`);
  return issued.json() as { codeId: string; code: string; issuedAt: number; expiresAt: number };
}

interface PairedTablet {
  readonly deviceId: string;
  /** Held by the test only. */
  readonly credential: string;
}

/** A real paired device: a code the server issued, redeemed by a device without a credential. */
async function pairTablet(host: EngineApp, supervisor: Caller): Promise<PairedTablet> {
  const redeemed = await redeem(host.app, (await issueCode(host, supervisor)).code, { deviceName: 'Interview tablet 01' });
  if (redeemed.statusCode !== 201) throw new Error(`redeemPairingCode answered ${redeemed.statusCode}`);
  const body = redeemed.json() as { deviceId: string; deviceCredential: string };
  return { deviceId: body.deviceId, credential: body.deviceCredential };
}

/** An operator's password sign-in on a paired device: the session token. Held by the test only. */
async function signInOnDevice(host: EngineApp, tablet: PairedTablet, role: OperatorRole): Promise<string> {
  const response = await deviceSignIn(host.app, tablet.credential, seeded(role).username);
  const token = response.statusCode === 200 ? (response.json() as { sessionToken?: string }).sessionToken : undefined;
  if (token === undefined) throw new Error(`the device sign-in answered ${response.statusCode}`);
  return token;
}

/** Operation 7 in a password session of the device: the biometric token the server issued. Held by the test only. */
async function enrol(host: EngineApp, sessionToken: string): Promise<string> {
  const response = await devicePost(host.app, BIOMETRIC, sessionToken, { enabled: true });
  const token = response.statusCode === 200 ? (response.json() as { token?: string }).token : undefined;
  if (token === undefined) throw new Error(`setBiometricEnrollment answered ${response.statusCode}`);
  return token;
}

// ── What the database holds (SELECT only, as `dems_owner`) ─────────────────────────────────────

/**
 * The newest instant of the PAST any stored row was written with, asked by the test in its own
 * words (guarantee G2): not the statement of the code under test.
 */
async function newestStored(owner: Pool): Promise<number> {
  const { rows } = await owner.query<{ at: string | null }>(
    `SELECT max(at)::text AS at FROM (
       SELECT at FROM public.audit_log UNION ALL SELECT at FROM public.events
       UNION ALL SELECT written_at FROM public.hardware_snapshot UNION ALL SELECT updated_at FROM public.active_session
       UNION ALL SELECT issued_at FROM public.auth_sessions UNION ALL SELECT last_seen_at FROM public.auth_sessions UNION ALL SELECT ended_at FROM public.auth_sessions
       UNION ALL SELECT issued_at FROM public.pairing_codes UNION ALL SELECT closed_at FROM public.pairing_codes
       UNION ALL SELECT paired_at FROM public.paired_devices UNION ALL SELECT last_seen_at FROM public.paired_devices
       UNION ALL SELECT issued_at FROM public.biometric_tokens UNION ALL SELECT used_at FROM public.biometric_tokens
     ) AS instants`,
  );
  return Number(rows[0]?.at);
}

interface SessionTimes {
  readonly issuedAt: number;
  readonly lastSeenAt: number;
  readonly endedAt: number | null;
  readonly endReason: string | null;
}

/** The times of every operator session, oldest first. Never a token. */
async function sessionTimes(owner: Pool): Promise<SessionTimes[]> {
  const { rows } = await owner.query<{ issued: string; seen: string; ended: string | null; reason: string | null }>(
    `SELECT issued_at::text AS issued, last_seen_at::text AS seen, ended_at::text AS ended, end_reason AS reason
       FROM public.auth_sessions ORDER BY issued_at, id`,
  );
  return rows.map((row) => ({ issuedAt: Number(row.issued), lastSeenAt: Number(row.seen), endedAt: row.ended === null ? null : Number(row.ended), endReason: row.reason }));
}

/** State and times of every pairing code, oldest first. Never a hash. */
async function codeTimes(owner: Pool): Promise<Array<{ id: string; state: string; issuedAt: number; closedAt: number | null }>> {
  const { rows } = await owner.query<{ id: string; state: string; issued: string; closed: string | null }>(
    'SELECT id, state, issued_at::text AS issued, closed_at::text AS closed FROM public.pairing_codes ORDER BY id',
  );
  return rows.map((row) => ({ id: row.id, state: row.state, issuedAt: Number(row.issued), closedAt: row.closed === null ? null : Number(row.closed) }));
}

/** Times of every biometric token, oldest first. Never a hash. */
async function tokenTimes(owner: Pool): Promise<Array<{ issuedAt: number; usedAt: number | null; revokedAt: number | null }>> {
  const { rows } = await owner.query<{ issued: string; used: string | null; revoked: string | null }>(
    'SELECT issued_at::text AS issued, used_at::text AS used, revoked_at::text AS revoked FROM public.biometric_tokens ORDER BY issued_at, used_at NULLS LAST',
  );
  return rows.map((row) => ({ issuedAt: Number(row.issued), usedAt: row.used === null ? null : Number(row.used), revokedAt: row.revoked === null ? null : Number(row.revoked) }));
}

/** `core_state.updated_at`: the instant the last start stamped its own write with (the epoch). */
async function startStamp(owner: Pool): Promise<number> {
  const { rows } = await owner.query<{ at: string }>('SELECT updated_at::text AS at FROM public.core_state');
  return Number(rows[0]?.at);
}

const errorLines = (host: EngineApp) => host.log.lines().filter((line) => Number(line['level']) >= 50);
const behindLines = (host: EngineApp) => host.log.lines().filter((line) => line['code'] === 'ENGINE_CLOCK_BEHIND');
const outOfOrder = (trail: readonly AuditRow[]): string[] => trail.filter((row, index) => index > 0 && row.at < (trail[index - 1]?.at ?? 0)).map(rowLine);
const is2xx = (response: LightMyRequestResponse): boolean => response.statusCode >= 200 && response.statusCode < 300;

/**
 * A server that ran, and stopped holding what a later statement compares its time with: three web
 * sessions, a paired tablet with an operator session and a live biometric token, and an ACTIVE
 * pairing code. All issued at one instant, ten seconds before the stop.
 */
async function stoppedServer(slug: string) {
  const target = await db.another({ slug });
  const owner = target.ownerPool();
  const first = await startServer(target, FIXED_NOW);
  await first.drive(5 * SECOND);
  const supervisor = await signIn(first, 'SUPERVISOR');
  const investigator = await signIn(first, 'INVESTIGATOR');
  const technician = await signIn(first, 'TECHNICIAN');
  const tablet = await pairTablet(first, supervisor);
  const tabletSession = await signInOnDevice(first, tablet, 'INVESTIGATOR');
  const biometricToken = await enrol(first, tabletSession);
  const code = await issueCode(first, supervisor);
  const issuedAt = first.clock.now();
  await first.drive(10 * SECOND);
  const stoppedAt = first.clock.now();
  await first.app.close();
  const floor = await newestStored(owner);
  return { target, owner, supervisor, investigator, technician, tablet, tabletSession, biometricToken, code, issuedAt, stoppedAt, floor, head: await readHead(owner) };
}

describe('a start with the system time set BACK (finding F74: W53-F1, W53-F2; CPS1-1)', () => {
  it('the server clock is raised to the newest stored instant: a session, a pairing code and a biometric token can be ended, and no row is stamped before its predecessor', async () => {
    const rest = await stoppedServer('b2a_clock_behind');
    const { owner, floor } = rest;
    // Everything was issued ten seconds before the stop; the stored state was committed after it.
    expect(floor).toBeGreaterThanOrEqual(rest.issuedAt);
    expect(floor).toBeLessThanOrEqual(rest.stoppedAt);

    // The reproduction of the acceptance row: the clock of the new process is two minutes before the stop.
    const startedAt = rest.stoppedAt - 2 * MINUTE;
    expect(startedAt).toBeLessThan(rest.issuedAt);
    const second = await engineApp(rest.target, db.run.dataDir, { startAt: startedAt, logLevel: 'info' });
    const serverClock = withServerClock(second);
    const persisted = vi.spyOn(second.app.errorLog, 'append');
    await second.app.readiness.boot();
    await second.engine.idle();
    await second.app.pipeline.drain();

    // ONE time base (G1, G4): the system time is where the test put it; what the SERVER reads is the floor. The
    // clock behind the seam is the object that was there before the boot: raised in place, not replaced.
    expect(second.clock.now()).toBe(startedAt);
    expect(second.app.clock.now()).toBe(floor);
    expect(second.app.clock).toBe(serverClock);
    // G6: said once, as a warning, with the skew in milliseconds; in the log and in the persistent error log.
    expect(behindLines(second)).toEqual([expect.objectContaining({ level: 40, behindMs: floor - startedAt })]);
    expect(persisted.mock.calls.map(([entry]) => entry).filter((entry) => entry.code === 'ENGINE_CLOCK_BEHIND')).toEqual([
      { level: 'warn', source: 'engine.host', message: expect.stringContaining('the system time is behind the stored state'), code: 'ENGINE_CLOCK_BEHIND', context: { mode: 'boot', behindMs: floor - startedAt } },
    ]);
    // What the start itself wrote (the epoch) is not stamped early (G5).
    expect(await startStamp(owner)).toBe(floor);

    // W53-F1. Each of these answered 500 (SQLSTATE 23514) before: the end would have been before the issue.
    const signedOut = await webPost(second.app, SIGN_OUT, rest.investigator.cookie);
    expect(signedOut.statusCode, 'signOut').toBe(204);
    expect((await get(second.app, SESSION, rest.investigator.cookie)).statusCode, 'the signed-out session').toBe(401);

    // A biometric token issued before the restart is used (`used_at >= issued_at`), and its successor is issued.
    const biometric = await devicePost(second.app, BIOMETRIC_SIGN_IN, rest.tablet.credential, { token: rest.biometricToken });
    expect(biometric.statusCode, 'signInWithBiometric').toBe(200);
    expect(await tokenTimes(owner)).toEqual([
      { issuedAt: rest.issuedAt, usedAt: floor, revokedAt: null },
      { issuedAt: floor, usedAt: null, revokedAt: null },
    ]);

    // A pairing code issued before the restart is cancelled (`closed_at >= issued_at`).
    const cancelled = await portalPost(second.app, CODE_CANCEL, rest.supervisor.cookie);
    expect(cancelled.statusCode, 'cancelPairingCode').toBe(204);
    expect((await codeTimes(owner)).at(-1)).toEqual({ id: rest.code.codeId, state: 'CANCELLED', issuedAt: rest.issuedAt, closedAt: floor });

    const disabled = await webPost(second.app, disableUrl(rest.technician.operator.id), rest.supervisor.cookie, { reason: 'Left the unit' });
    expect(is2xx(disabled), `disableUser answered ${disabled.statusCode}`).toBe(true);
    const enabled = await owner.query<{ enabled: boolean }>('SELECT enabled FROM public.operators WHERE id = $1', [rest.technician.operator.id]);
    expect(enabled.rows[0]?.enabled).toBe(false);
    expect((await get(second.app, SESSION, rest.technician.cookie)).statusCode, "the disabled operator's session").toBe(401);

    const revoked = await webPost(second.app, revokeUrl(rest.tablet.deviceId), rest.supervisor.cookie, { reason: 'Lost on site' });
    expect(is2xx(revoked), `revokeDevice answered ${revoked.statusCode}`).toBe(true);
    const device = await owner.query<{ state: string }>('SELECT state FROM public.paired_devices WHERE id = $1', [rest.tablet.deviceId]);
    expect(device.rows[0]?.state).toBe('REVOKED');
    expect((await get(second.app, SESSION, bearer(rest.tabletSession))).statusCode, "the revoked device's operator session").toBe(403);

    // The sign-in that presents an open session ends it and issues a new one (rotation, ID-6).
    const rotated = callerOf(second, rest.supervisor.operator, await webSignIn(second.app, rest.supervisor.operator.username, undefined, rest.supervisor.cookie));
    expect((await get(second.app, SESSION, rest.supervisor.cookie)).statusCode, 'the rotated session').toBe(401);
    expect((await get(second.app, SESSION, rotated.cookie)).statusCode, 'the new session').toBe(200);

    // Every session of the first process is ended, at the floor: at or after its issue, never before.
    const sessions = await sessionTimes(owner);
    const old = sessions.filter((session) => session.issuedAt === rest.issuedAt);
    expect(old).toHaveLength(4);
    for (const session of old) expect(session.endedAt, session.endReason ?? 'open').toBe(floor);
    expect(sessions.filter((session) => session.endedAt === null)).toEqual([{ issuedAt: floor, lastSeenAt: floor, endedAt: null, endReason: null }]);

    // W53-F2. A row of a server-native module (a sign-in) and a row of a hosted action (the storage policy) in the
    // same process: both on the one time base, none before its predecessor (G7: `at` never decreases over `seq`).
    const fresh = await signIn(second, 'INVESTIGATOR');
    const policy = await webPost(second.app, STORAGE_POLICY, rotated.cookie, { retentionDays: 123 });
    expect(policy.statusCode, 'setStoragePolicy').toBe(200);
    const trail = await readTrail(owner);
    const written = trail.filter((row) => row.seq > rest.head.seq);
    expect(written.length).toBeGreaterThanOrEqual(8);
    expect(new Set(written.map((row) => row.at))).toEqual(new Set([floor]));
    expect(outOfOrder(trail)).toEqual([]);
    expect(verifyTrail(trail, await readHead(owner))).toMatchObject({ ok: true, checked: trail.length });
    expect(errorLines(second).map((line) => line['msg'])).toEqual([]);

    // G3. TIME RUNS ON from the floor at the real rate, while the system time is still behind it.
    await second.drive(60 * SECOND);
    expect(second.clock.now()).toBe(startedAt + 60 * SECOND);
    expect(second.clock.now()).toBeLessThan(floor);
    expect(second.app.clock.now()).toBe(floor + 60 * SECOND);
    const later = await webPost(second.app, SIGN_OUT, fresh.cookie);
    expect(later.statusCode, 'signOut a minute later').toBe(204);
    const after = await readTrail(owner);
    expect(after.at(-1)).toMatchObject({ type: 'AUTH_SIGNED_OUT', at: floor + 60 * SECOND });
    expect(outOfOrder(after)).toEqual([]);
    // The engine ran on the same time: its snapshot row is a minute past the floor, not at it.
    const snapshot = await owner.query<{ at: string }>('SELECT written_at::text AS at FROM public.hardware_snapshot');
    expect(Number(snapshot.rows[0]?.at)).toBeGreaterThan(floor + 58 * SECOND);
    expect(Number(snapshot.rows[0]?.at)).toBeLessThanOrEqual(floor + 60 * SECOND);
    expect(behindLines(second)).toHaveLength(1);
    console.info(
      `[b2a] start two minutes before the stop: the floor ${rel(floor)} (issue ${rel(rest.issuedAt)}, stop ${rel(rest.stoppedAt)}, start ${rel(startedAt)}, behind ${floor - startedAt} ms); ` +
        `signOut ${signedOut.statusCode}, signInWithBiometric ${biometric.statusCode}, cancelPairingCode ${cancelled.statusCode}, disableUser ${disabled.statusCode}, revokeDevice ${revoked.statusCode}, rotation 200; ` +
        `rows written at the floor: ${written.map(rowLine).join(', ')}; rows before their predecessor: ${outOfOrder(after).length}`,
    );
  });

  it('a 60 s lock ends 60 s later, although the system time is still behind the floor (G3, G7)', async () => {
    const rest = await stoppedServer('b2a_clock_lockout');
    const { floor } = rest;
    const second = await startBehind(rest.target, rest.stoppedAt - 2 * MINUTE);
    const username = rest.investigator.operator.username;
    const wrong = (): Promise<number> => webSignIn(second.app, username, 'not-the-password-of-anybody').then((response) => response.statusCode);

    const statuses: number[] = [];
    for (let attempt = 0; attempt < AUTH_MAX_FAILURES; attempt += 1) statuses.push(await wrong());
    // The failure that locks the console answers 423, as every attempt during the lock (ID-P1, ID-P2).
    expect(statuses).toEqual([...Array.from({ length: AUTH_MAX_FAILURES - 1 }, () => 401), 423]);
    // Locked, on the server clock, from the floor: the right password too.
    expect((await webSignIn(second.app, username)).statusCode).toBe(423);
    second.clock.advance(AUTH_LOCKOUT_MS - 1);
    expect(second.app.clock.now()).toBe(floor + AUTH_LOCKOUT_MS - 1);
    expect((await webSignIn(second.app, username)).statusCode).toBe(423);
    // Sixty seconds of real time after the lock began it ends. The system time has not reached the floor.
    second.clock.advance(1);
    expect(second.clock.now()).toBeLessThan(floor);
    expect((await webSignIn(second.app, username)).statusCode).toBe(200);
    expect(outOfOrder(await readTrail(rest.owner))).toEqual([]);
    expect(errorLines(second)).toEqual([]);
  });

  it('idle expiry counts from the real activity, on the one time base: fifteen minutes after it, not a second later', async () => {
    const rest = await stoppedServer('b2a_clock_idle');
    const { floor } = rest;
    const second = await startBehind(rest.target, rest.stoppedAt - 2 * MINUTE);
    const lastActivity = rest.issuedAt;
    const expiresAt = lastActivity + AUTH_IDLE_TIMEOUT_MS;
    const open = (): Promise<number> => get(second.app, SESSION, rest.investigator.cookie).then((response) => response.statusCode);

    // The idle time at the start is the one the stored state knows (floor - activity): never a negative one.
    expect(await open()).toBe(200);
    second.clock.advance(expiresAt - floor - 1);
    expect(second.app.clock.now()).toBe(expiresAt - 1);
    expect(await open()).toBe(200);
    second.clock.advance(1);
    expect(await open()).toBe(401);
    const ended = (await sessionTimes(rest.owner)).filter((session) => session.endReason === 'IDLE_EXPIRED');
    expect(ended).toEqual([{ issuedAt: lastActivity, lastSeenAt: lastActivity, endedAt: expiresAt, endReason: 'IDLE_EXPIRED' }]);
    // The system time is still behind the server clock by what it was behind at the start.
    expect(second.app.clock.now() - second.clock.now()).toBe(floor - (rest.stoppedAt - 2 * MINUTE));
    console.info(`[b2a] idle expiry after a start ${floor - (rest.stoppedAt - 2 * MINUTE)} ms behind: the session of ${rel(lastActivity)} expired at ${rel(expiresAt)} on the server clock, ${expiresAt - floor} ms of real time after the start`);
  });

  it('a pairing code issued before the restart lives its 300 s and no longer: redeemable to the last millisecond, refused after it', async () => {
    const rest = await stoppedServer('b2a_clock_code');
    const { owner, floor } = rest;
    // An hour behind: the system time stays behind the server clock for the whole test.
    const second = await startBehind(rest.target, rest.stoppedAt - HOUR);
    expect(rest.code.expiresAt).toBe(rest.issuedAt + CODE_LIFETIME_MS);

    second.clock.advance(rest.code.expiresAt - floor - 1);
    expect(second.app.clock.now()).toBe(rest.code.expiresAt - 1);
    const paired = await redeem(second.app, rest.code.code, { deviceName: 'Interview tablet 02' });
    expect(paired.statusCode, 'redeemPairingCode in its last millisecond').toBe(201);
    expect((await codeTimes(owner)).at(-1)).toEqual({ id: rest.code.codeId, state: 'REDEEMED', issuedAt: rest.issuedAt, closedAt: rest.code.expiresAt - 1 });

    // A code issued by this process: 300 s of real time later it redeems nothing and is closed as expired.
    const supervisor = await signIn(second, 'SUPERVISOR');
    const next = await issueCode(second, supervisor);
    expect(next.issuedAt).toBe(second.app.clock.now());
    second.clock.advance(CODE_LIFETIME_MS);
    const late = await redeem(second.app, next.code, { deviceName: 'Interview tablet 03' });
    expect(late.statusCode, 'redeemPairingCode after its lifetime').toBe(401);
    expect((await codeTimes(owner)).at(-1)).toEqual({ id: next.codeId, state: 'EXPIRED', issuedAt: next.issuedAt, closedAt: next.expiresAt });
    expect(second.clock.now()).toBeLessThan(floor);
    expect(outOfOrder(await readTrail(owner))).toEqual([]);
    expect(errorLines(second)).toEqual([]);
  });

  it('the production clock is raised IN PLACE: the object behind the seam stays, runs on from the floor, and is the system time again once that is corrected', async () => {
    const rest = await stoppedServer('b2a_clock_system');
    const { floor } = rest;
    const startedAt = rest.stoppedAt - 2 * MINUTE;
    // The server's own clock (`createSystemClock`) on a system time and a timer the test moves.
    let systemTime = startedAt;
    let timer = 4_242.5;
    const pass = (ms: number): void => {
      systemTime += ms;
      timer += ms;
    };
    const second = await engineApp(rest.target, db.run.dataDir, { logLevel: 'info' });
    const clock = createSystemClock(
      () => systemTime,
      () => timer,
    );
    second.app.seams.replace('clock', clock);
    await second.app.readiness.boot();

    expect(second.app.clock).toBe(clock);
    expect(clock.now()).toBe(floor);
    expect(behindLines(second)).toEqual([expect.objectContaining({ level: 40, behindMs: floor - startedAt })]);
    expect((await webPost(second.app, SIGN_OUT, rest.investigator.cookie)).statusCode).toBe(204);
    pass(30 * SECOND);
    expect(clock.now()).toBe(floor + 30 * SECOND);
    // The operator corrects the system time (the true time is five minutes past the stop): the server clock is the
    // system time, exactly, with no offset left.
    const corrected = rest.stoppedAt + 5 * MINUTE;
    systemTime = corrected;
    expect(clock.now()).toBe(corrected);
    pass(SECOND);
    expect(clock.now()).toBe(corrected + SECOND);
    const technician = await webPost(second.app, SIGN_OUT, rest.technician.cookie);
    expect(technician.statusCode).toBe(204);
    const trail = await readTrail(rest.owner);
    expect(trail.at(-1)).toMatchObject({ type: 'AUTH_SIGNED_OUT', at: corrected + SECOND });
    expect(outOfOrder(trail)).toEqual([]);
    // And set back again while the process runs: neither a step back nor a standstill.
    systemTime = startedAt;
    pass(5 * SECOND);
    expect(clock.now()).toBe(corrected + 6 * SECOND);
    expect((await webPost(second.app, SIGN_OUT, rest.supervisor.cookie)).statusCode).toBe(204);
    expect(outOfOrder(await readTrail(rest.owner))).toEqual([]);
    expect(errorLines(second)).toEqual([]);
  });
});

describe('where the floor is taken from (CPS1-1: G1, G2, G5, G8)', () => {
  /** The newest stored instant as the engine's start reads it: its own statement, in a unit, as `dems_app`. */
  const asked = (host: EngineApp): Promise<number> => host.app.pipeline.run('test.newestStoredInstant', (unit) => readNewestStoredInstant(unit));

  it('each written instant of the past raises it; no deadline does; it changes no row and is one SELECT of the runtime role', async () => {
    const target = await db.another({ slug: 'b2a_floor_sources' });
    const owner = target.ownerPool();
    const host = await engineApp(target, db.run.dataDir);
    // A fresh seed: every row was written at the seed instant or before it.
    expect(await asked(host)).toBe(SEED_NOW);
    expect(await newestStored(owner)).toBe(SEED_NOW);

    // What a used Core holds: sessions, codes, devices and tokens up to 55 minutes after the seed, and deadlines far
    // beyond (twelve hours, thirty days, and one `bigint` that a JavaScript number cannot hold).
    await plantKeptRows(owner);
    expect(await asked(host)).toBe(SEED_NOW + 55 * MINUTE);
    expect(await newestStored(owner)).toBe(SEED_NOW + 55 * MINUTE);

    // One column at a time, each an hour past the last: the answer is that column's value.
    const PAST: ReadonlyArray<readonly [column: string, statement: string]> = [
      ['hardware_snapshot.written_at', 'UPDATE public.hardware_snapshot SET written_at = $1::bigint'],
      ['auth_sessions.last_seen_at', "UPDATE public.auth_sessions SET last_seen_at = $1::bigint WHERE operator_id = 'OPR-002' AND ended_at IS NULL"],
      ['auth_sessions.ended_at', 'UPDATE public.auth_sessions SET ended_at = $1::bigint WHERE ended_at IS NOT NULL'],
      ['auth_sessions.issued_at', "UPDATE public.auth_sessions SET issued_at = $1::bigint, last_seen_at = $1::bigint WHERE method = 'BIOMETRIC'"],
      ['pairing_codes.closed_at', "UPDATE public.pairing_codes SET closed_at = $1::bigint WHERE id = 'PCD-000004'"],
      ['pairing_codes.issued_at', "UPDATE public.pairing_codes SET issued_at = $1::bigint, expires_at = $1::bigint + 300000 WHERE state = 'ACTIVE'"],
      ['paired_devices.last_seen_at', "UPDATE public.paired_devices SET last_seen_at = $1::bigint WHERE id = 'DEV-0001'"],
      ['paired_devices.paired_at', "UPDATE public.paired_devices SET paired_at = $1::bigint WHERE id = 'DEV-0002'"],
      ['biometric_tokens.used_at', 'UPDATE public.biometric_tokens SET used_at = $1::bigint WHERE used_at IS NOT NULL'],
      ['biometric_tokens.issued_at', 'UPDATE public.biometric_tokens SET issued_at = $1::bigint WHERE used_at IS NULL AND revoked_at IS NULL'],
    ];
    let instant = SEED_NOW + 55 * MINUTE;
    for (const [column, statement] of PAST) {
      instant += HOUR;
      const changed = await owner.query(statement, [instant]);
      expect(changed.rowCount, column).toBe(1);
      expect(await asked(host), column).toBe(instant);
      expect(await newestStored(owner), column).toBe(instant);
    }

    // Deadlines, each a day past every written instant: the answer does not move (G2).
    const DEADLINES: ReadonlyArray<readonly [column: string, statement: string]> = [
      ['auth_sessions.absolute_expires_at', 'UPDATE public.auth_sessions SET absolute_expires_at = $1::bigint WHERE ended_at IS NULL'],
      ['pairing_codes.expires_at', 'UPDATE public.pairing_codes SET expires_at = $1::bigint'],
      ['biometric_tokens.expires_at', 'UPDATE public.biometric_tokens SET expires_at = $1::bigint'],
    ];
    for (const [column, statement] of DEADLINES) {
      const changed = await owner.query(statement, [instant + 24 * HOUR]);
      expect(changed.rowCount, column).toBeGreaterThan(0);
      expect(await asked(host), column).toBe(instant);
    }
    const beyond = await owner.query<{ count: string }>('SELECT count(*)::text AS count FROM public.auth_sessions WHERE absolute_expires_at = $1', [BEYOND_DOUBLE]);
    expect(beyond.rows[0]?.count).toBe('1');

    // G8: one SELECT, of time columns of the past; no hash, no deadline; and no row of any table changed by asking.
    const before = await tableChecksums(owner);
    host.database.statements.length = 0;
    expect(await asked(host)).toBe(instant);
    const sent = host.database.statements.filter((text) => text.includes('greatest('));
    expect(sent).toHaveLength(1);
    const statement = sent[0] ?? '';
    expect(statement).toMatch(/^SELECT greatest\(/);
    expect(statement).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|MERGE)\b/i);
    for (const table of ['audit_log', 'events', 'hardware_snapshot', 'active_session', 'auth_sessions', 'pairing_codes', 'paired_devices', 'biometric_tokens']) {
      expect(statement, table).toContain(`FROM "${table}"`);
    }
    for (const never of ['expires_at', '_hash', 'revoked_at', 'credential']) expect(statement, never).not.toContain(never);
    expect(await tableChecksums(owner)).toEqual(before);
    console.info(`[b2a] the statement of the clock floor (${statement.length} characters): ${statement}`);
  });

  it('a start on a used Core whose newest instant is an UNAUDITED one (a session seen, a device seen) raises the clock to it', async () => {
    const target = await db.another({ slug: 'b2a_floor_unaudited' });
    const owner = target.ownerPool();
    await plantKeptRows(owner);
    // No audit row, no event and no write of the engine is newer than the seed instant: only the planted activity is.
    const newestAudited = Math.max(...(await readTrail(owner)).map((row) => row.at));
    expect(newestAudited).toBeLessThanOrEqual(SEED_NOW);
    const host = await startBehind(target, SEED_NOW + MINUTE);
    expect(host.app.clock.now()).toBe(SEED_NOW + 55 * MINUTE);
    expect(behindLines(host)).toEqual([expect.objectContaining({ level: 40, behindMs: 54 * MINUTE })]);
    expect((await readTrail(owner)).at(-1)).toMatchObject({ type: 'TABLET_LINK_CHANGED', at: SEED_NOW + 55 * MINUTE });
  });

  it('G5: when the newest instant cannot be read, the start stops: the server is not ready and its clock is untouched', async () => {
    const target = await db.another({ slug: 'b2a_floor_unread' });
    const host = await engineApp(target, db.run.dataDir, { startAt: FIXED_NOW - HOUR });
    const left = host.database.failNext(/^SELECT greatest\(/);
    const error = await host.app.readiness.boot().then(
      () => undefined,
      (thrown: unknown) => thrown,
    );
    expect(left()).toBe(0);
    expect(error).toBeInstanceOf(BootError);
    expect((error as BootError).stepId).toBe('engine.rehydrate');
    expect(host.app.readiness.snapshot()).toMatchObject({ engine: false });
    expect(host.engine.running).toBe(false);
    expect(host.app.clock).toBe(host.clock);
    expect(host.app.clock.now()).toBe(FIXED_NOW - HOUR);
    // Nothing was written by the start that failed.
    expect((await readTrail(target.ownerPool())).map((row) => row.at).every((at) => at <= FIXED_NOW)).toBe(true);
  });

  it('a clock WITHOUT a floor that is behind the stored state stops the start: the server never runs on two time bases', async () => {
    const rest = await stoppedServer('b2a_clock_no_floor');
    const { owner, floor } = rest;
    const startedAt = rest.stoppedAt - 2 * MINUTE;
    const before = await tableChecksums(owner);
    // A manual clock of a test, put behind the seam as it is: it reads; nothing can hold it at a floor.
    const second = await engineApp(rest.target, db.run.dataDir, { startAt: startedAt, logLevel: 'info' });
    const error = await second.app.readiness.boot().then(
      () => undefined,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(BootError);
    expect((error as BootError).stepId).toBe('engine.rehydrate');
    expect((error as BootError).cause).toMatchObject({ name: 'EngineError', code: 'ENGINE_CLOCK_WITHOUT_FLOOR', detail: { behindMs: floor - startedAt } });
    expect(second.engine.running).toBe(false);
    expect(second.app.readiness.snapshot()).toMatchObject({ engine: false });
    // The seam holds what the test put there, the start wrote nothing, and the log names the step, the code and the skew.
    expect(second.app.clock).toBe(second.clock);
    expect(await tableChecksums(owner)).toEqual(before);
    expect(second.log.lines().filter((line) => line['msg'] === 'engine not started')).toEqual([
      expect.objectContaining({ level: 50, step: 'engine.rehydrate', mode: 'boot', code: 'ENGINE_CLOCK_WITHOUT_FLOOR', behindMs: floor - startedAt }),
    ]);
    await second.app.close();

    // The same database, the same system time, a clock that can take the floor: the server starts.
    const third = await startBehind(rest.target, startedAt);
    expect(third.app.clock.now()).toBe(floor);
    expect((await webPost(third.app, SIGN_OUT, rest.investigator.cookie)).statusCode).toBe(204);
  });

  it('G5: a stored instant that no row could be stamped with stops the start, with a code and no value', async () => {
    const target = await db.another({ slug: 'b2a_floor_unsafe' });
    const owner = target.ownerPool();
    await plantKeptRows(owner);
    await owner.query("UPDATE public.auth_sessions SET last_seen_at = $1 WHERE operator_id = 'OPR-002' AND ended_at IS NULL", [BEYOND_DOUBLE]);
    const host = await engineApp(target, db.run.dataDir);
    const error = await host.app.readiness.boot().then(
      () => undefined,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(BootError);
    const cause = (error as BootError).cause;
    expect(cause).toBeInstanceOf(EngineError);
    expect(cause).toMatchObject({ code: 'ENGINE_STATE_UNREADABLE', detail: { rule: 'CLOCK_FLOOR' } });
    expect(host.engine.running).toBe(false);
    expect(host.app.clock).toBe(host.clock);
    expect(JSON.stringify(host.log.lines())).not.toContain(BEYOND_DOUBLE);
  });

  it('the two standard templates are not ahead of their seed instant: a test server at that instant is not behind', async () => {
    const seed = await db.another({ slug: 'b2a_floor_seed' });
    expect(await newestStored(seed.ownerPool())).toBe(FIXED_NOW);
    const bulk = await db.another({ template: 'bulk', slug: 'b2a_floor_bulk' });
    expect(await newestStored(bulk.ownerPool())).toBeLessThanOrEqual(BULK_TEMPLATE_NOW);
    const host = await startServer(bulk, BULK_TEMPLATE_NOW);
    expect(host.app.clock).toBe(host.clock);
    expect(behindLines(host)).toEqual([]);
  }, 120_000);
});

describe('a start with the system time ahead of the stored state: as before', () => {
  it('the clock behind the seam is untouched, nothing is logged, and what the start writes is stamped at the start instant', async () => {
    const rest = await stoppedServer('b2a_clock_ahead');
    const startedAt = rest.stoppedAt + 90 * SECOND;
    const second = await startServer(rest.target, startedAt);
    expect(second.app.clock).toBe(second.clock);
    expect(second.app.clock.now()).toBe(startedAt);
    expect(behindLines(second)).toEqual([]);
    expect(await startStamp(rest.owner)).toBe(startedAt);
    // The sessions of the first process are open and can be ended, as always.
    expect((await webPost(second.app, SIGN_OUT, rest.investigator.cookie)).statusCode).toBe(204);
    expect(errorLines(second)).toEqual([]);
  });

  it('a start at exactly the newest stored instant is not behind', async () => {
    const rest = await stoppedServer('b2a_clock_equal');
    const second = await startServer(rest.target, rest.floor);
    expect(second.app.clock).toBe(second.clock);
    expect(behindLines(second)).toEqual([]);
    expect((await webPost(second.app, SIGN_OUT, rest.investigator.cookie)).statusCode).toBe(204);
  });
});
