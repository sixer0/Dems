// What the commands of the system module do OVER TIME, on the booted server against PostgreSQL
// (plan row W40, rule 2 of the row; spec §7.14, §8.1, §8.7).
//
// A command's effect over time is the simulator's, on the engine's ticks: the module answers and
// nothing more. Here the engine is driven with a manual clock and a manual timer, and each
// effect is held against the shared simulator in two ways:
//
//   the reference simulator   a headless `Sim` of the shared core on a manual clock, with the
//                             same seed and, for its random streams, the server's epoch, given
//                             the SAME sequence of commands and ticks: what its state and its
//                             audit trail do is what the server's must do;
//   the pure transition       the shared transition of each command, and the shared step of each
//                             tick (`advanceDiagnostics`, `advanceUpdate`), applied to the
//                             server's own committed state: the row it builds is the row the
//                             server stored, field for field and hash for hash.
//
// The random streams. The schedule of a diagnostics run and of an update is drawn from the
// engine's streams `diagnostics` and `update`, which the engine host derives from the stored
// seed and its epoch. No command of this file has drawn from them before its first use, so a
// fresh set of streams with that seed and epoch gives the same draws.
//
// Three states are told apart at every tick:
//
//   the engine's own   the state of the hosted simulator after the tick (the host's test control
//                      `simulator()`; no module reads it);
//   the committed      `app.engine.state()`: what the tables hold, what was published and what
//                      operation 64 answers. Records (audit rows, events) are committed by the
//                      tick that made them. The hardware snapshot, which holds `diagnostics`,
//                      `update` and `services`, is committed by a tick at most once per second
//                      of the server clock (engine host, decision D77 DN-2), so it can be up to
//                      one second behind the engine's own, and never ahead;
//   the reference      the reference simulator at the same instant.
import { validateCoreApiResponse } from '@dems/shared/api';
import {
  DIAGNOSTIC_CHECKS,
  DIAGNOSTIC_CHECK_MAX_MS,
  DIAGNOSTIC_CHECK_MIN_MS,
  UPDATE_REBOOT_MS,
  UPDATE_STEP_MAX_MS,
  UPDATE_STEP_MIN_MS,
  advanceDiagnostics,
  advanceUpdate,
  createRngStreams,
  restartServicesTransition,
  runDiagnosticsTransition,
  startSoftwareUpdateTransition,
  type AuditRow,
  type SimState,
} from '@dems/shared/sim';
import { isDeepStrictEqual } from 'node:util';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readEvents, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { createHost, withoutNegativeZeros, type Host } from '../../../../test/support/seed';
import { actorAuth } from '../../../engine';
import { storedSlices } from '../../../../test/support/engine';
import { DIAGNOSTICS, SERVICES_RESTART, SYSTEM_STATUS, TICK_MS, UPDATE, bodyOf, bootedServer, content, servicesAsRead, whole, type BootedServer } from './support';

// On a loaded host a database test can pass the runner's default limit: a cap, not a wait.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const db = useTestDatabase({ template: 'seed' });
let server: BootedServer;
/** The shared simulator, headless, at the server's instant, drawing as the server's engine draws. */
let reference: Host;
let referenceRowsAtStart = 0;

beforeAll(async () => {
  server = await bootedServer(db);
  // One second of ticks first: the engine has made its first steps.
  await server.drive(1_000);
  reference = await createHost({ scenario: 'idle', startAt: server.clock.now() - 1_000 });
  reference.drive(1_000);
  expect(reference.now()).toBe(server.clock.now());
  reference.sim.rng.reseed(server.engine.epoch);
  referenceRowsAtStart = reference.state().audit.total;
});

const wire = <Value>(value: Value): Value => JSON.parse(JSON.stringify(value)) as Value;
/** The engine's random streams as they stood at its start: the stored seed and the epoch. */
const freshStreams = () => createRngStreams(server.engine.slice('meta').seed, server.engine.epoch);
/** The rows of a state's ring above a sequence number. */
const rowsAbove = (state: Pick<SimState, 'audit'>, seq: number): AuditRow[] => state.audit.rows.filter((row) => row.seq > seq);
/** The rows the reference simulator appended since a total. */
const referenceRowsSince = (total: number): AuditRow[] => reference.state().audit.rows.slice(total - reference.state().audit.dropped);

/** The state of the hosted simulator itself: for assertions only (the modules never read it). */
function engineOwn(): SimState {
  const simulator = server.engine.simulator();
  if (simulator === null) throw new Error('the engine holds no simulator: it is not running');
  return simulator.store.getState();
}

type Committed = ReturnType<BootedServer['engine']['state']>;

interface Tick {
  /** The engine's own state before and after the tick. */
  readonly ownBefore: SimState;
  readonly own: SimState;
  /** The committed state before and after the tick. */
  readonly before: Committed;
  readonly after: Committed;
  readonly now: number;
}

/** One tick on both, at the same instant. */
async function tickBoth(): Promise<Tick> {
  const ownBefore = engineOwn();
  const before = server.engine.state();
  await server.drive(TICK_MS);
  reference.drive(TICK_MS);
  return { ownBefore, own: engineOwn(), before, after: server.engine.state(), now: server.clock.now() };
}

/** How far the committed snapshot may be behind the engine's own state: less than one second of the server clock. */
const SNAPSHOT_SECOND_MS = 1_000;

/**
 * The pacing of one snapshot slice over a run of ticks: after each tick the committed slice is
 * the engine's own, or it is still the committed slice of the tick before (the write waits for
 * the next second of the clock) and has been waiting for less than a second.
 */
function snapshotPacing<Key extends 'diagnostics' | 'update' | 'services'>(slice: Key) {
  let behindSince: number | null = null;
  let longest = 0;
  let waitingTicks = 0;
  return {
    check(tick: Tick): void {
      if (isDeepStrictEqual(tick.after[slice], tick.own[slice])) {
        behindSince = null;
        return;
      }
      behindSince ??= tick.now;
      waitingTicks += 1;
      // Waiting: exactly what was committed before, never a state of its own.
      expect(tick.after[slice], `${slice} at ${tick.now}: committed is neither the engine's own nor the one before`).toBe(tick.before[slice]);
      expect(tick.now - behindSince, `${slice} at ${tick.now}: behind for a second or more`).toBeLessThan(SNAPSHOT_SECOND_MS);
      longest = Math.max(longest, tick.now - behindSince + TICK_MS);
    },
    /** True when the committed slice is the engine's own right now. */
    caughtUp: (): boolean => behindSince === null,
    report: (): string => `committed ${slice} behind the engine's own on ${waitingTicks} ticks, at most ${longest} ms`,
  };
}

describe('runDiagnostics: the eight checks resolve on the engine\'s ticks, as the simulator\'s do', () => {
  it('the schedule is the shared transition\'s; every tick is the shared step on the server\'s own state; the run ends when the reference simulator\'s ends, with the same verdicts', async () => {
    const t0 = server.clock.now();
    const principal = server.principal('SUPERVISOR');
    const committed = server.engine.state();
    const built = runDiagnosticsTransition({ ...committed, auth: actorAuth(principal.operatorId, t0) } as SimState, t0, freshStreams());
    const expectedRow = built.state.audit.rows.at(-1);
    if (expectedRow === undefined) throw new Error('the transition appended no row');
    const trail = await server.trailLength();
    const events = (await readEvents(server.owner)).length;

    const response = await server.post('SUPERVISOR', DIAGNOSTICS);
    expect(response.statusCode).toBe(202);
    const referenceRunId = reference.runAs(reference.operator('SUPERVISOR'), () => reference.sim.actions.runDiagnostics());
    expect(response.json()).toEqual({ runId: built.runId });
    expect(referenceRunId).toBe(built.runId);

    // The run as scheduled: eight checks, the first RUNNING, each 300 to 600 ms after the one before.
    const scheduled = server.engine.slice('diagnostics');
    expect(scheduled).toEqual(built.state.diagnostics);
    expect(scheduled).toEqual(reference.state().diagnostics);
    expect(scheduled?.checks.map((check) => [check.id, check.status])).toEqual(DIAGNOSTIC_CHECKS.map((check, index) => [check.id, index === 0 ? 'RUNNING' : 'PENDING']));
    const instants = [t0, ...(scheduled?.checks.map((check) => check.resolvesAt ?? 0) ?? [])];
    for (let index = 1; index < instants.length; index += 1) {
      const gap = (instants[index] ?? 0) - (instants[index - 1] ?? 0);
      expect(gap).toBeGreaterThanOrEqual(DIAGNOSTIC_CHECK_MIN_MS);
      expect(gap).toBeLessThanOrEqual(DIAGNOSTIC_CHECK_MAX_MS);
    }
    await server.app.pipeline.drain();
    expect((await server.since(trail)).map(whole)).toEqual([whole(expectedRow)]);

    // Tick by tick until the last check has resolved, and a second and a half beyond.
    const end = (instants.at(-1) ?? t0) + 1_500;
    const pacing = snapshotPacing('diagnostics');
    let ticks = 0;
    let resolvingTicks = 0;
    const progress: string[] = [];
    while (server.clock.now() < end) {
      const tick = await tickBoth();
      const { ownBefore, own, now } = tick;
      ticks += 1;
      // The shared step on the engine's own state: the run as it was before the tick, the hardware as this tick left it.
      const stepped = advanceDiagnostics({ ...own, diagnostics: ownBefore.diagnostics, events: ownBefore.events, meta: ownBefore.meta }, now);
      expect(own.diagnostics, `tick at +${now - t0} ms`).toEqual(stepped.diagnostics);
      expect(own.events, `tick at +${now - t0} ms`).toEqual(stepped.events);
      // As the reference simulator at the same instant: the same checks have resolved, with the same verdict.
      const referenceRun = reference.state().diagnostics;
      expect(own.diagnostics?.checks.map((check) => [check.id, check.status, check.resolvesAt]), `tick at +${now - t0} ms`).toEqual(referenceRun?.checks.map((check) => [check.id, check.status, check.resolvesAt]));
      expect(own.diagnostics?.completedAt).toBe(referenceRun?.completedAt);
      // What is committed (and what operation 64 answers) is that run, at most a second late.
      pacing.check(tick);
      // Records are committed by the tick that made them: the events of the committed state are the engine's own.
      expect(tick.after.events).toBe(own.events);
      if (own.diagnostics !== ownBefore.diagnostics) {
        resolvingTicks += 1;
        progress.push(`+${now - t0}: ${own.diagnostics?.checks.filter((check) => check.status === 'PASS' || check.status === 'WARN' || check.status === 'FAIL').length}`);
      }
    }
    expect(pacing.caughtUp()).toBe(true);

    const run = server.engine.slice('diagnostics');
    expect(run?.completedAt).toBe(instants.at(-1));
    expect(run?.checks.map((check) => check.status)).toEqual(Array.from({ length: 8 }, () => 'PASS'));
    expect(run?.checks.every((check) => typeof check.detail === 'string' && check.detail.length > 0)).toBe(true);
    // Durable: the run in the tables is the committed run; one audit row (the start) and one event more (the completion).
    await server.app.pipeline.drain();
    expect((await storedSlices(server.owner)).diagnostics).toEqual(withoutNegativeZeros(server.engine.state()).diagnostics);
    expect((await server.since(trail)).map((row) => row.type)).toEqual(['DIAGNOSTICS_RUN']);
    const newEvents = (await readEvents(server.owner)).slice(events);
    expect(newEvents.map((event) => event.type)).toEqual(['DIAGNOSTICS_STARTED', 'DIAGNOSTICS_COMPLETED']);
    expect(newEvents[1]).toMatchObject({ at: run?.completedAt, severity: 'SUCCESS', params: { runId: built.runId, pass: 8, warn: 0, fail: 0 } });
    expect(reference.state().events.slice(-2).map((event) => [event.type, event.at, event.severity, event.params])).toEqual(newEvents.map((event) => [event.type, event.at, event.severity, event.params]));

    // The read shows the completed run in the contract's shape.
    const read = await server.get('INVESTIGATOR', SYSTEM_STATUS);
    expect((read.json() as { diagnostics: unknown }).diagnostics).toEqual(wire(run));
    expect(validateCoreApiResponse('getSystemStatus', 200, read.json())).toEqual({ ok: true });
    console.info(
      `[w40] runDiagnostics ${built.runId} over ${ticks} ticks (${(server.clock.now() - t0) / 1_000} s): checks resolved at +ms ${instants.slice(1).map((instant) => instant - t0).join(', ')}; ` +
        `ticks that changed the run: ${resolvingTicks} (${progress.join(' | ')}); every tick = advanceDiagnostics on the engine's state = the reference simulator; ${pacing.report()}; completedAt +${(run?.completedAt ?? 0) - t0} ms; audit rows 1, events 2`,
    );
  });
});

describe('restartServices: the restart is complete with its row', () => {
  it('every service starts at the instant of the command, as the shared transition and the reference simulator say; the ticks afterwards change no service and write no row', async () => {
    const at = server.clock.now();
    const principal = server.principal('TECHNICIAN');
    const committed = server.engine.state();
    const built = restartServicesTransition({ ...committed, auth: actorAuth(principal.operatorId, at) } as SimState, at);
    const expectedRow = built.state.audit.rows.at(-1);
    if (expectedRow === undefined) throw new Error('the transition appended no row');
    const trail = await server.trailLength();
    const referenceTotal = reference.state().audit.total;

    const response = await server.post('TECHNICIAN', SERVICES_RESTART);
    expect(response.statusCode).toBe(200);
    const referenceCount = reference.runAs(reference.operator('TECHNICIAN'), () => reference.sim.actions.restartServices());
    expect(response.json()).toEqual({ restarted: referenceCount });
    expect(response.json()).toEqual({ restarted: built.result });
    await server.app.pipeline.drain();

    const stored = await server.since(trail);
    expect(stored.map(whole)).toEqual([whole(expectedRow)]);
    expect(stored.map(content)).toEqual(referenceRowsSince(referenceTotal).map(content));
    const services = server.engine.slice('services');
    expect(services).toEqual(built.state.services);
    expect(services).toEqual(reference.state().services);
    expect(services.map((service) => [service.status, service.startedAt])).toEqual(Array.from({ length: 17 }, () => ['RUNNING', at]));

    // Five seconds of ticks: no service goes down or comes up, nothing else is written.
    for (let elapsed = 0; elapsed < 5_000; elapsed += TICK_MS) await tickBoth();
    expect(server.engine.slice('services')).toEqual(services);
    expect(reference.state().services).toEqual(services);
    await server.app.pipeline.drain();
    expect(await server.trailLength()).toBe(trail + 1);
    expect((await storedSlices(server.owner)).services).toEqual(services);
    console.info(`[w40] restartServices: 200 { restarted: 17 }; all 17 services started at the command's instant; stored row = the shared transition's (hash ${expectedRow.hash.slice(0, 12)}…) = the reference simulator's content; 100 ticks afterwards: no service changed, no row`);
  });
});

describe('startSoftwareUpdate: the six steps resolve on the engine\'s ticks, as the simulator\'s do', () => {
  it('the schedule is the shared transition\'s; every tick is the shared step on the server\'s own state, hash for hash; the reboot restarts the services and the update ends on version 2.5.0 in slot B', async () => {
    const t0 = server.clock.now();
    const principal = server.principal('TECHNICIAN');
    const committed = server.engine.state();
    const built = startSoftwareUpdateTransition({ ...committed, auth: actorAuth(principal.operatorId, t0) } as SimState, t0, freshStreams());
    const expectedStart = built.audit.rows.at(-1);
    if (expectedStart === undefined) throw new Error('the transition appended no row');
    const trail = await server.trailLength();
    const referenceTotal = reference.state().audit.total;
    const servicesBefore = server.engine.slice('services').map((service) => service.startedAt);

    const response = await server.post('TECHNICIAN', UPDATE);
    expect(response.statusCode).toBe(202);
    expect(validateCoreApiResponse('startSoftwareUpdate', 202, bodyOf(response))).toEqual({ ok: true });
    reference.runAs(reference.operator('TECHNICIAN'), () => reference.sim.actions.startSoftwareUpdate());

    // The update as scheduled: six steps, the first active, five of 800 to 1,600 ms and the reboot of 3,000 ms.
    const scheduled = server.engine.slice('update');
    expect(scheduled).toEqual(built.update);
    expect(scheduled).toEqual(reference.state().update);
    expect(scheduled).toMatchObject({ state: 'RUNNING', startedAt: t0, completedAt: null, currentVersion: '2.4.1', availableVersion: '2.5.0', activeSlot: 'A' });
    expect(scheduled.steps.map((step) => step.status)).toEqual(['active', 'pending', 'pending', 'pending', 'pending', 'pending']);
    const instants = [t0, ...scheduled.steps.map((step) => step.resolvesAt ?? 0)];
    scheduled.steps.forEach((step, index) => {
      const gap = (instants[index + 1] ?? 0) - (instants[index] ?? 0);
      if (step.id === 'REBOOT') expect(gap).toBe(UPDATE_REBOOT_MS);
      else {
        expect(gap, step.id).toBeGreaterThanOrEqual(UPDATE_STEP_MIN_MS);
        expect(gap, step.id).toBeLessThanOrEqual(UPDATE_STEP_MAX_MS);
      }
    });
    const rebootAt = scheduled.steps.find((step) => step.id === 'REBOOT')?.resolvesAt ?? 0;
    // Operation 64 right after the command (a command commits the snapshot at once): the update is RUNNING in the answer.
    const whileRunning = (await server.get('SUPERVISOR', SYSTEM_STATUS)).json() as { update: unknown };
    expect(whileRunning.update).toEqual(wire(scheduled));
    expect(whileRunning.update).toMatchObject({ state: 'RUNNING', currentVersion: '2.4.1', availableVersion: '2.5.0' });
    const completesAt = instants.at(-1) ?? 0;

    // Tick by tick until the last step has resolved, and a second and a half beyond.
    const expectedRows: AuditRow[] = [expectedStart];
    const pacing = snapshotPacing('update');
    const servicesPacing = snapshotPacing('services');
    const mixedTicks: number[] = [];
    let ticks = 0;
    const progress: string[] = [];
    while (server.clock.now() < completesAt + 1_500) {
      const tick = await tickBoth();
      const { ownBefore, own, before, after, now } = tick;
      ticks += 1;
      // The shared step on the engine's own state before the tick.
      const stepped = advanceUpdate(ownBefore, now);
      expect(own.update, `tick at +${now - t0} ms`).toEqual(stepped.update);
      expect(own.services.map((service) => service.startedAt)).toEqual(stepped.services.map((service) => service.startedAt));
      expect(own.device).toEqual(stepped.device);
      expect(own.security.controls).toEqual(stepped.security.controls);
      // The rows of the tick are committed by the tick: hash for hash the shared step's.
      const made = rowsAbove(stepped, ownBefore.audit.total);
      expect(rowsAbove(after, before.audit.total).map(whole), `tick at +${now - t0} ms`).toEqual(made.map(whole));
      expect(after.audit.head).toBe(stepped.audit.head);
      expect(after.device).toEqual(stepped.device);
      expectedRows.push(...made);
      // As the reference simulator at the same instant.
      expect(own.update, `tick at +${now - t0} ms`).toEqual(reference.state().update);
      // What is committed (and what operation 64 answers) is that update, at most a second late.
      pacing.check(tick);
      servicesPacing.check(tick);
      if (own.update !== ownBefore.update) progress.push(`+${now - t0}: ${own.update.steps.filter((step) => step.status === 'done').length} done`);
      // A committed state whose `device` (a record, committed at once) already names the new
      // version while its `update` (the snapshot) still says RUNNING: counted, for the report.
      if (after.device.softwareVersion === '2.5.0' && after.update.state === 'RUNNING') mixedTicks.push(now - t0);
    }
    expect(pacing.caughtUp()).toBe(true);
    expect(servicesPacing.caughtUp()).toBe(true);

    // The end state.
    const update = server.engine.slice('update');
    expect(update).toMatchObject({ state: 'PASS', currentVersion: '2.5.0', availableVersion: null, activeSlot: 'B', startedAt: t0, completedAt: completesAt });
    expect(update.steps.map((step) => step.status)).toEqual(Array.from({ length: 6 }, () => 'done'));
    const state = server.engine.state();
    expect(state.device).toMatchObject({ softwareVersion: '2.5.0', identity: { coreSoftwareVersion: '2.5.0' } });
    expect(state.security.controls.find((control) => control.id === 'SIGNED_FIRMWARE')?.detail).toBe('v2.5.0');
    // The reboot step restarted every service at its own instant; before it they ran since the last restart.
    expect(new Set(servicesBefore).size).toBe(1);
    expect(state.services.map((service) => service.startedAt)).toEqual(Array.from({ length: 17 }, () => rebootAt));
    expect(state.services.map((service) => service.startedAt)).toEqual(reference.state().services.map((service) => service.startedAt));
    expect(state.device.softwareVersion).toBe(reference.state().device.softwareVersion);

    // The stored rows: the three of the update, each the shared code's row, hash for hash, and the reference simulator's content.
    await server.app.pipeline.drain();
    const stored = await server.since(trail);
    expect(stored.map(whole)).toEqual(expectedRows.map(whole));
    expect(stored.map((row) => [row.type, row.actorId, row.at - t0])).toEqual([
      ['UPDATE_STARTED', principal.operatorId, 0],
      ['SYSTEM_BOOT', null, rebootAt - t0],
      ['UPDATE_COMPLETED', null, completesAt - t0],
    ]);
    expect(stored.map(content)).toEqual(referenceRowsSince(referenceTotal).map(content));
    expect(stored[1]).toMatchObject({ details: { version: '2.5.0', slot: 'B' } });
    expect(stored[2]).toMatchObject({ details: { version: '2.5.0', slot: 'B', outcome: 'PASS' } });
    expect(await storedSlices(server.owner)).toStrictEqual(withoutNegativeZeros(server.engine.state()));

    // The read shows it; a further call starts nothing, because no version is available.
    const read = await server.get('SUPERVISOR', SYSTEM_STATUS);
    const committedNow = server.engine.state();
    expect(read.json()).toEqual(wire({ device: committedNow.device, services: servicesAsRead(committedNow.services, server.app), update: committedNow.update, diagnostics: committedNow.diagnostics, settings: committedNow.settings }));
    expect((read.json() as { update: unknown }).update).toMatchObject({ state: 'PASS', currentVersion: '2.5.0', availableVersion: null, activeSlot: 'B' });
    expect((read.json() as { device: unknown }).device).toMatchObject({ softwareVersion: '2.5.0' });
    expect(validateCoreApiResponse('getSystemStatus', 200, read.json())).toEqual({ ok: true });
    const again = await server.post('TECHNICIAN', UPDATE);
    expect(again.statusCode).toBe(202);
    await server.app.pipeline.drain();
    expect(await server.trailLength()).toBe(trail + 3);
    expect(server.engine.slice('update')).toBe(update);
    console.info(
      `[w40] startSoftwareUpdate over ${ticks} ticks (${(server.clock.now() - t0) / 1_000} s): steps resolved at +ms ${instants.slice(1).map((instant) => instant - t0).join(', ')} (${progress.join(' | ')}); ` +
        `stored rows UPDATE_STARTED, SYSTEM_BOOT (+${rebootAt - t0}), UPDATE_COMPLETED (+${completesAt - t0}) = the shared code's on the engine's state (seq, id, hash) = the reference simulator's content; ${pacing.report()}; committed states with device.softwareVersion 2.5.0 beside update.state RUNNING: ${mixedTicks.length} ticks${mixedTicks.length === 0 ? '' : ` (+${mixedTicks[0]} to +${mixedTicks.at(-1)} ms)`}; 16 services restarted at the reboot; version 2.5.0, slot B`,
    );
  });
});

describe('the whole sequence of the file', () => {
  it('the stored trail since the start equals the reference simulator\'s for the same commands and ticks, row for row; the chain verifies; stored equals committed', async () => {
    await server.app.pipeline.drain();
    const stored = await server.since(server.rowsAtStart);
    const referenceRows = referenceRowsSince(referenceRowsAtStart);
    expect(stored.map(content)).toEqual(referenceRows.map(content));
    expect(stored.map((row) => row.type)).toEqual(['DIAGNOSTICS_RUN', 'DEVICE_COMMAND', 'UPDATE_STARTED', 'SYSTEM_BOOT', 'UPDATE_COMPLETED']);
    // The slices the three commands move, on both.
    expect(server.engine.slice('update')).toEqual(reference.state().update);
    expect(server.engine.slice('services')).toEqual(reference.state().services);
    expect(server.engine.slice('diagnostics')?.checks.map((check) => [check.id, check.status, check.resolvesAt])).toEqual(reference.state().diagnostics?.checks.map((check) => [check.id, check.status, check.resolvesAt]));
    expect(reference.errors).toEqual([]);

    const rows = await readTrail(server.owner);
    const head = await readHead(server.owner);
    expect(linkProblems(rows)).toEqual([]);
    expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
    expect(await storedSlices(server.owner)).toStrictEqual(withoutNegativeZeros(server.engine.state()));
    const lines = server.log.lines();
    expect(lines.filter((line) => line['msg'] === 'audit head diverged')).toEqual([]);
    expect(lines.filter((line) => Number(line['level']) >= 50)).toEqual([]);
    console.info(`[w40] the file's sequence: ${stored.length} stored audit rows = the reference simulator's ${referenceRows.length} (at, type, category, severity, actor, device, message, details): ${stored.map((row) => row.type).join(', ')}; chain ok over ${rows.length} rows`);
  });
});
