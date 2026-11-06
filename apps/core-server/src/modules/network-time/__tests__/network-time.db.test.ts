// The network-time module against PostgreSQL and the REAL engine host (plan row W37; spec §7.12,
// §8.4 (Q15, ENG-13 to ENG-16), §6.8; module gate MODG; AC-B-68; rule 3 of the row: "every time
// value follows the INJECTED clock").
//
// The real app factory on clones of the seed, as `dems_app`, with EVERY stage as the server has
// it; no route is a stand-in. The app is BOOTED as the entry point boots it. The server clock is
// a manual clock (`app.clock`, injected through the seam) and the engine's timer is a manual one:
// the engine ticks only when a test fires it, at the instant the test set.
//
// Three kinds of instant can be in an answer, and the tests tell them apart:
//   the seed's      at or before `SEED_TEMPLATE_NOW` (2026-10-01 10:00 WIB): the history points the
//                   seed wrote, stored data;
//   the server's    at or after `CLOCK_START` (2031-01-01) and never later than the manual clock:
//                   what this server stamped;
//   anything else   between the two, where this machine's own clock stands: there must be none.
import { REVISION_HEADER_NAME, validateCoreApiResponse, type NetworkStatus, type TimeStatus } from '@dems/shared/api';
import type { OperatorRole } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readTrail } from '../../../../test/support/core';
import { SEED_TEMPLATE_NOW } from '../../../db/seed/__tests__/template-hook.seed';
import { deviceOperator, webOperator, type GuardTarget } from '../../../../test/support/guard';
import { throttleControl } from '../../../plugins/throttle';
import { identityControl } from '../../identity';
import { bearer, insertPairedDevice, type Headers } from '../../../../test/support/identity';
import { CLOCK_START, HOUR, INVESTIGATOR, ROLES, SECOND, SUPERVISOR, TECHNICIAN, WEB_ORIGIN, YEAR, bootedApp, outcome, type BootedApp } from '../../storage/__tests__/support';

const db = useTestDatabase({ template: 'seed' });
let booted: BootedApp;
let owner: Pool;
let sessions: Record<OperatorRole, Headers>;

const NETWORK = '/api/v1/network/status';
const TIME = '/api/v1/time/status';

const network = async (app: BootedApp, session: Headers): Promise<NetworkStatus> => (await app.app.inject({ method: 'GET', url: NETWORK, headers: session })).json() as NetworkStatus;
const time = async (app: BootedApp, session: Headers): Promise<TimeStatus> => (await app.app.inject({ method: 'GET', url: TIME, headers: session })).json() as TimeStatus;

/** Every instant the two answers hold. */
function instantsOf(answers: { network: NetworkStatus; time: TimeStatus }): number[] {
  return [
    answers.network.tabletLink.changedAt,
    ...answers.network.network.bandwidth.history.map((point) => point.at),
    answers.time.time.lastSyncAt,
    ...answers.time.time.history.map((point) => point.at),
  ];
}

/** The instants that are neither the seed's nor on the manual clock up to `now`: none may exist. */
const foreign = (instants: readonly number[], now: number): number[] => instants.filter((at) => at > SEED_TEMPLATE_NOW && (at < CLOCK_START || at > now));
/** The instants this server stamped. */
const stamped = (instants: readonly number[]): number[] => instants.filter((at) => at >= CLOCK_START);

/** The test's own guard: this machine's clock stands after the seed's instant and before the manual clock's start. */
function expectSystemClockBetween(): void {
  const system = Date.now();
  expect(system).toBeGreaterThan(SEED_TEMPLATE_NOW);
  expect(system).toBeLessThan(CLOCK_START);
}

async function signInAll(app: BootedApp): Promise<Record<OperatorRole, Headers>> {
  return {
    INVESTIGATOR: await webOperator(app, INVESTIGATOR.username),
    SUPERVISOR: await webOperator(app, SUPERVISOR.username),
    TECHNICIAN: await webOperator(app, TECHNICIAN.username),
  };
}

const trailLength = async (pool: Pick<Pool, 'query'> = owner): Promise<number> => (await readTrail(pool)).length;

/** Another untouched clone of the seed, as a target for an app of its own. */
async function clone(slug: string): Promise<{ target: GuardTarget; pool: Pool }> {
  const database = await db.another({ slug });
  return { target: { runtime: database.runtime, run: db.run, onCleanup: (close) => database.onCleanup(close) }, pool: database.ownerPool() };
}

beforeAll(async () => {
  owner = db.ownerPool();
  booted = await bootedApp(db);
  sessions = await signInAll(booted);
  await booted.app.pipeline.drain();
});

beforeEach(() => {
  throttleControl(booted.app).reset();
  identityControl(booted.app).lockout.reset();
});

describe('operations 56 and 57: the reads', () => {
  it.each(ROLES)('%s reads the network status and the time status: 200, valid against the contract, equal to the committed state; no row is written', async (role) => {
    const before = await trailLength();
    const networkAnswer = await booted.app.inject({ method: 'GET', url: NETWORK, headers: sessions[role] });
    expect(networkAnswer.statusCode).toBe(200);
    expect(validateCoreApiResponse('getNetworkStatus', 200, networkAnswer.json())).toEqual({ ok: true });
    const state = booted.engine.state();
    expect(networkAnswer.json()).toEqual(JSON.parse(JSON.stringify({ network: state.network, tabletLink: state.tabletLink })));

    const timeAnswer = await booted.app.inject({ method: 'GET', url: TIME, headers: sessions[role] });
    expect(timeAnswer.statusCode).toBe(200);
    expect(validateCoreApiResponse('getTimeStatus', 200, timeAnswer.json())).toEqual({ ok: true });
    expect(timeAnswer.json()).toEqual(JSON.parse(JSON.stringify({ time: booted.engine.slice('time') })));

    await booted.app.pipeline.drain();
    expect(await trailLength()).toBe(before);
    for (const response of [networkAnswer, timeAnswer]) {
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
    }
  });

  it('an operator on a paired device reads both with the bearer session', async () => {
    await insertPairedDevice(owner, 'DEV-0001', SUPERVISOR.id, booted.clock.now());
    const onDevice = await deviceOperator(booted, booted.devices.pair('DEV-0001'), INVESTIGATOR.username);
    expect((await booted.app.inject({ method: 'GET', url: NETWORK, headers: onDevice })).statusCode).toBe(200);
    expect((await booted.app.inject({ method: 'GET', url: TIME, headers: onDevice })).statusCode).toBe(200);
  });

  it('the refusals are the guard\'s: nobody without a session (401, no row), a foreign Origin (403, no row), a retired device (403 with its one row)', async () => {
    const before = await trailLength();
    for (const url of [NETWORK, TIME]) {
      expect(outcome(await booted.app.inject({ method: 'GET', url }))).toEqual([401, 'NOT_SIGNED_IN']);
      expect(outcome(await booted.app.inject({ method: 'GET', url, headers: { ...sessions.TECHNICIAN, origin: 'http://evil.example' } }))).toEqual([403, 'ORIGIN_NOT_ALLOWED']);
      // The area has no command.
      expect(outcome(await booted.app.inject({ method: 'POST', url, headers: { ...sessions.SUPERVISOR, origin: WEB_ORIGIN }, payload: {} }))).toEqual([405, 'METHOD_NOT_ALLOWED']);
    }
    expect(await trailLength()).toBe(before);

    await insertPairedDevice(owner, 'DEV-0008', SUPERVISOR.id, booted.clock.now());
    const credential = bearer(booted.devices.pair('DEV-0008'));
    booted.devices.retire('DEV-0008');
    for (const [operationId, url] of [
      ['getNetworkStatus', NETWORK],
      ['getTimeStatus', TIME],
    ] as const) {
      const retired = await booted.app.inject({ method: 'GET', url, headers: credential });
      expect([operationId, ...outcome(retired)]).toEqual([operationId, 403, 'DEVICE_REVOKED']);
      expect(validateCoreApiResponse(operationId, 403, retired.json())).toEqual({ ok: true });
    }
    await booted.app.pipeline.drain();
    expect((await readTrail(owner)).slice(before).map((row) => [row.type, row.deviceId, row.details])).toEqual([
      ['ACCESS_DENIED', 'DEV-0008', { operationId: 'getNetworkStatus', reason: 'DEVICE_REVOKED' }],
      ['ACCESS_DENIED', 'DEV-0008', { operationId: 'getTimeStatus', reason: 'DEVICE_REVOKED' }],
    ]);
  });
});

describe('Q15, ENG-13: every time value of the two reads follows the injected clock', () => {
  it('at the boot: the tablet link went OFFLINE at the injected instant; every other instant is the seed\'s; none lies where this machine\'s clock stands', async () => {
    expectSystemClockBetween();
    const answers = { network: await network(booted, sessions.TECHNICIAN), time: await time(booted, sessions.TECHNICIAN) };
    // The first start on a fresh seed sets the link OFFLINE, stamped by the server clock.
    expect(answers.network.tabletLink).toEqual({ state: 'OFFLINE', changedAt: CLOCK_START });
    const instants = instantsOf(answers);
    expect(foreign(instants, booted.clock.now())).toEqual([]);
    // No tick has run: the one instant this server stamped is the link's.
    expect(stamped(instants)).toEqual([CLOCK_START]);
    expect(instants.length).toBeGreaterThan(100);
  });

  it('second by second: 20 s of the manual clock give one bandwidth point per second of that clock, a time sync and a history point, none later than the clock', async () => {
    expectSystemClockBetween();
    const start = booted.clock.now();
    expect(start % SECOND).toBe(0);
    const before = { network: await network(booted, sessions.INVESTIGATOR), time: await time(booted, sessions.INVESTIGATOR) };

    await booted.drive(20 * SECOND);
    const now = booted.clock.now();
    expect(now).toBe(start + 20 * SECOND);
    const after = { network: await network(booted, sessions.INVESTIGATOR), time: await time(booted, sessions.INVESTIGATOR) };
    expect(validateCoreApiResponse('getNetworkStatus', 200, after.network)).toEqual({ ok: true });
    expect(validateCoreApiResponse('getTimeStatus', 200, after.time)).toEqual({ ok: true });

    // The points the engine added: the whole seconds of the manual clock, one each, in order, up to
    // now. The first is the second the first tick fell in (the simulator's 1 Hz step runs at its
    // first tick), so 20 s give 21 points.
    const known = new Set(before.network.network.bandwidth.history.map((point) => point.at));
    const added = after.network.network.bandwidth.history.map((point) => point.at).filter((at) => !known.has(at));
    expect(added).toEqual(Array.from({ length: 21 }, (_unused, index) => start + index * SECOND));
    expect(after.network.network.bandwidth.history.at(-1)?.at).toBe(now);

    // The time service synchronised (every 16 s) and logged a point: both on the manual clock, on a whole second.
    expect(after.time.time.lastSyncAt).toBeGreaterThanOrEqual(start);
    expect(after.time.time.lastSyncAt).toBeLessThanOrEqual(now);
    expect(after.time.time.lastSyncAt % SECOND).toBe(0);
    expect(after.time.time.lastSyncAt).not.toBe(before.time.time.lastSyncAt);
    expect(after.time.time.history.at(-1)?.at).toBeGreaterThanOrEqual(start);
    expect(after.time.time.history.at(-1)?.at).toBeLessThanOrEqual(now);

    const instants = instantsOf(after);
    expect(foreign(instants, now)).toEqual([]);
    expect(stamped(instants).length).toBeGreaterThanOrEqual(23);
  });

  it('a jump: the clock is moved three hours ahead in one step, and the next tick stamps every new value at that instant', async () => {
    expectSystemClockBetween();
    const before = { network: await network(booted, sessions.SUPERVISOR), time: await time(booted, sessions.SUPERVISOR) };
    booted.clock.advance(3 * HOUR);
    booted.timer.fire();
    await booted.engine.idle();
    const now = booted.clock.now();
    // The same clock ends an idle session: after three hours the old cookie is refused. New sessions, at the new instant.
    expect(outcome(await booted.app.inject({ method: 'GET', url: TIME, headers: sessions.SUPERVISOR }))).toEqual([401, 'NOT_SIGNED_IN']);
    sessions = await signInAll(booted);

    const after = { network: await network(booted, sessions.SUPERVISOR), time: await time(booted, sessions.SUPERVISOR) };
    expect(after.network.network.bandwidth.history.at(-1)?.at).toBe(now);
    expect(after.time.time.history.at(-1)?.at).toBe(now);
    expect(after.time.time.lastSyncAt).toBe(now);
    // What was stamped before the jump kept its instant: one new point, the old ones behind it.
    expect(after.network.network.bandwidth.history.at(-2)?.at).toBe(before.network.network.bandwidth.history.at(-1)?.at);
    expect(now - (after.network.network.bandwidth.history.at(-2)?.at ?? 0)).toBe(3 * HOUR);
    expect(after.network.tabletLink).toEqual(before.network.tabletLink);
    expect(foreign(instantsOf(after), now)).toEqual([]);
  });

  it('a clock that stands still: ticks and real time change no value', async () => {
    const first = { network: await network(booted, sessions.TECHNICIAN), time: await time(booted, sessions.TECHNICIAN) };
    expect(first.time.time.source).toBe('GNSS');
    for (let fired = 0; fired < 5; fired += 1) {
      booted.timer.fire();
      await booted.engine.idle();
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect({ network: await network(booted, sessions.TECHNICIAN), time: await time(booted, sessions.TECHNICIAN) }).toEqual(first);
  });

  it('the tablet link is set by the server and stamped by the same clock: what `app.engine.setTabletLink` committed is what a client reads', async () => {
    booted.clock.advance(7 * SECOND);
    const connectedAt = booted.clock.now();
    await booted.app.engine.setTabletLink('CONNECTED');
    expect((await network(booted, sessions.INVESTIGATOR)).tabletLink).toEqual({ state: 'CONNECTED', changedAt: connectedAt });
    booted.clock.advance(11 * SECOND);
    await booted.app.engine.setTabletLink('OFFLINE');
    expect((await network(booted, sessions.INVESTIGATOR)).tabletLink).toEqual({ state: 'OFFLINE', changedAt: connectedAt + 11 * SECOND });
  });
});

describe('two servers, two clocks: the values are each server\'s own clock, on the same seed', () => {
  it('a server whose clock stands a year later answers instants a year later; after its stop a new server on the same database answers what was stored', async () => {
    const { target, pool } = await clone('network_time_clock');
    const startAt = CLOCK_START + YEAR;
    const first = await bootedApp(target, { startAt });
    const technician = await webOperator(first, TECHNICIAN.username);
    await first.drive(30 * SECOND);
    const last = { network: await network(first, technician), time: await time(first, technician) };
    expect(last.network.tabletLink).toEqual({ state: 'OFFLINE', changedAt: startAt });
    expect(last.network.network.bandwidth.history.at(-1)?.at).toBe(startAt + 30 * SECOND);
    expect(last.time.time.lastSyncAt).toBeGreaterThan(startAt);
    // The other server of this file ran at the same real time, a year earlier on its clock.
    expect(last.network.network.bandwidth.history.at(-1)?.at).toBeGreaterThan(booted.clock.now());

    // The process ends: the stop writes the hardware snapshot.
    await first.engine.stop();
    expect(outcome(await first.app.inject({ method: 'GET', url: NETWORK, headers: technician }))).toEqual([503, 'NOT_READY']);
    expect(outcome(await first.app.inject({ method: 'GET', url: TIME, headers: technician }))).toEqual([503, 'NOT_READY']);
    await first.app.close();
    const rows = await readTrail(pool);

    // A new app on the same database, ten minutes later on its own clock. No tick has run yet.
    const restartedAt = first.clock.now() + 10 * 60 * SECOND;
    const second = await bootedApp(target, { startAt: restartedAt });
    const supervisor = await webOperator(second, SUPERVISOR.username);
    const restored = { network: await network(second, supervisor), time: await time(second, supervisor) };
    expect(restored).toEqual(last);
    // The link was already OFFLINE: the restart wrote no row for it, and it keeps its instant.
    expect((await readTrail(pool)).slice(rows.length).map((row) => row.type)).toEqual(['AUTH_SUCCESS']);

    // The ticks of the new process stamp at the new clock (the second of its first tick, then the
    // next one); nothing is invented for the ten minutes the server was down.
    await second.drive(SECOND);
    const next = { network: await network(second, supervisor), time: await time(second, supervisor) };
    const points = next.network.network.bandwidth.history.map((point) => point.at);
    expect(points.slice(-3)).toEqual([startAt + 30 * SECOND, restartedAt, restartedAt + SECOND]);
    expect(points.filter((at) => at > startAt + 30 * SECOND && at < restartedAt)).toEqual([]);
    expect(foreign(instantsOf(next), second.clock.now())).toEqual([]);
    expect(second.log.lines().filter((line) => Number(line['level']) >= 50)).toEqual([]);
  });
});
