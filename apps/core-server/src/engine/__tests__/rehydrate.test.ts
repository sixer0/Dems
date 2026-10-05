// Rehydration and what a process start does to the stored state (plan row W26; spec §8.6, §12.3;
// decisions D28 D-1, D62). Database-free: the rows of the one mapping module, as PostgreSQL gives
// them back, and a headless simulator.
import {
  DEFAULT_SEED,
  RECORDING_BYTES_PER_HOUR,
  buildScenarioState,
  createIdleState,
  createManualClock,
  verifyAuditChain,
  type ScenarioName,
  type SimErrorReport,
  type SimState,
} from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { DURABLE_SLICE_KEYS, pickDurable, toRows, type StoredRows } from '../../db/mapping';
import { FIXED_NOW, asStored, createHost, withoutNegativeZeros, type Host } from '../../../test/support/seed';
import { createSystemClock, type FloorClock } from '../../core';
import { EngineError } from '../errors';
import { createHeadlessSim, engineClock } from '../headless-sim';
import {
  adoptStoredState,
  applyProcessStart,
  assertValidSlices,
  carryTabletLink,
  clearTamperOverlay,
  lastCommittedInstant,
  rejectedSlices,
  storedStateOf,
  type StoredState,
} from '../rehydrate';

/** The rows a database holds for `state`, written at `at` (the JSON round trip and a scrambled order included). */
function rowsOf(state: SimState, at: number): StoredRows {
  return asStored(toRows(state, { at, seededAt: FIXED_NOW, lastResetAt: null }));
}

const scenario = (name: ScenarioName): SimState => buildScenarioState(name, createIdleState({ now: FIXED_NOW, seed: DEFAULT_SEED }));

/** The server's own clock on a manual clock as its system time and its timer: it can take a floor. */
function serverClockOn(clock: { now(): number }, floor = 0): FloorClock {
  const read = (): number => clock.now();
  const server = createSystemClock(read, read);
  server.raiseFloor(floor);
  return server;
}

/**
 * A fresh headless simulator on a manual clock, as a start of the host builds it: the floor (the
 * newest stored instant) is raised on the SERVER clock, and the engine clock reads that one
 * (decision D110).
 */
async function freshSim(now: number, floor = 0) {
  const errors: SimErrorReport[] = [];
  const clock = createManualClock(now);
  const sim = await createHeadlessSim({ seed: DEFAULT_SEED, clock: engineClock(serverClockOn(clock, floor)), onError: (report) => errors.push(report) });
  return { sim, clock, errors };
}

describe('the headless simulator', () => {
  it('is created with every adapter injected: it hydrates nothing, schedules nothing and starts signed out', async () => {
    const timers = (): number => process.getActiveResourcesInfo().filter((name) => name === 'Timeout').length;
    const timersBefore = timers();
    const { sim, errors } = await freshSim(FIXED_NOW);
    expect(sim.isReady()).toBe(true);
    expect(sim.wasRestored()).toBe(false);
    expect(sim.store.getState().auth).toMatchObject({ status: 'SIGNED_OUT', operatorId: null });
    // start() hands the tick to the host's inert scheduler: nothing runs by itself.
    sim.start();
    expect(sim.isRunning()).toBe(true);
    sim.stop();
    expect(errors).toEqual([]);
    sim.store.setState({ settings: { ...sim.store.getState().settings } });
    expect(timers()).toBe(timersBefore);
  });

  it('the engine clock is the server clock: the floor at the last committed instant is the server clock\'s, not the engine\'s (decision D110)', () => {
    const clock = createManualClock(1_000);
    expect(engineClock(clock).now()).toBe(1_000);
    const held = engineClock(serverClockOn(clock, 5_000));
    expect(held.now()).toBe(5_000);
    // Time runs on from the floor: the floor plus what passed on the server clock since.
    clock.advance(2_500);
    expect(held.now()).toBe(7_500);
    expect(held).toMatchObject({ tz: '+07:00', tzOffsetMinutes: 420 });
    expect(held).not.toHaveProperty('floor');
  });
});

describe('the stored state', () => {
  it.each(['idle', 'recording', 'finalizing', 'fault-demo'] as const)('%s: the rows give back the durable slices, and every slice passes its schema', (name) => {
    const state = scenario(name);
    const stored = storedStateOf(rowsOf(state, FIXED_NOW));
    expect(stored.slices).toStrictEqual(withoutNegativeZeros(state));
    expect(rejectedSlices(stored.slices)).toEqual([]);
    expect(() => assertValidSlices(stored.slices)).not.toThrow();
    expect(stored.certificateFingerprint).toBe(state.pairing.certificateFingerprint);
  });

  it('rows that do not form a state are refused with a code and the rule, and the seed command is named', () => {
    const rows = rowsOf(scenario('idle'), FIXED_NOW);
    const withoutState = { ...rows, coreState: [] };
    let thrown: unknown;
    try {
      storedStateOf(withoutState);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(EngineError);
    expect(thrown).toMatchObject({ code: 'ENGINE_STATE_UNREADABLE', detail: { rule: 'ROW_SHAPE' } });
    expect((thrown as Error).message).toContain('npm run db:seed');

    const head = rows.auditChainHead[0];
    if (head === undefined) throw new Error('no head row');
    expect(() => storedStateOf({ ...rows, auditChainHead: [{ ...head, seq: head.seq + 1 }] })).toThrow(EngineError);
  });

  it('the last committed instant is the greatest stored write instant: snapshot, session, newest audit row, newest event', () => {
    const rows = rowsOf(scenario('recording'), FIXED_NOW);
    const snapshot = rows.hardwareSnapshot[0];
    const session = rows.activeSession[0];
    if (snapshot === undefined || session === undefined) throw new Error('the recording scenario has a snapshot and a session');
    const newestAudit = Math.max(...rows.auditLog.map((row) => row.at));
    const newestEvent = Math.max(...rows.events.map((row) => row.at));
    expect(lastCommittedInstant(rows)).toBe(Math.max(snapshot.writtenAt, session.updatedAt, newestAudit, newestEvent));

    const later = FIXED_NOW + 90_000;
    expect(lastCommittedInstant({ ...rows, hardwareSnapshot: [{ ...snapshot, writtenAt: later }] })).toBe(later);
    expect(lastCommittedInstant({ ...rows, activeSession: [{ ...session, updatedAt: later + 1 }] })).toBe(later + 1);
    expect(lastCommittedInstant({ hardwareSnapshot: [], activeSession: [], auditLog: [], events: [] })).toBe(0);
  });
});

describe('a stored state that is rejected', () => {
  const MARK = 'MARK-stored-value-91c2';

  it('a slice that breaks its schema is named with the rule and the path, never with the value', () => {
    const slices = storedStateOf(rowsOf(scenario('recording'), FIXED_NOW)).slices;
    const session = slices.session;
    if (session === null) throw new Error('the recording scenario has a session');
    const broken = {
      ...slices,
      session: { ...session, state: MARK as unknown as typeof session.state },
      settings: { ...slices.settings, timeFormat: MARK as unknown as '24' },
    };
    const rejected = rejectedSlices(broken);
    expect(rejected.map((entry) => entry.slice)).toEqual(['session', 'settings']);
    expect(rejected[0]).toMatchObject({ slice: 'session', path: 'state' });
    expect(rejected[0]?.issues).toBeGreaterThan(0);

    let thrown: unknown;
    try {
      assertValidSlices(broken);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(EngineError);
    expect(thrown).toMatchObject({
      code: 'ENGINE_SNAPSHOT_REJECTED',
      detail: { slices: 'session,settings', rejected: 2, firstSlice: 'session', firstPath: 'state' },
    });
    expect(JSON.stringify({ message: (thrown as Error).message, detail: (thrown as EngineError).detail, rejected })).not.toContain(MARK);
  });

  it('text that PostgreSQL could not have stored exactly is refused by the text rule of the contract (API-13)', () => {
    const slices = storedStateOf(rowsOf(scenario('idle'), FIXED_NOW)).slices;
    const first = slices.audit.rows[0];
    if (first === undefined) throw new Error('the dataset has audit rows');
    const lone = { ...slices, audit: { ...slices.audit, rows: [{ ...first, message: 'unpaired \ud800 surrogate' }, ...slices.audit.rows.slice(1)] } };
    expect(rejectedSlices(lone).map((entry) => entry.slice)).toEqual(['audit']);
  });

  it('the simulator\'s own acceptance test is applied, and its refusal is fatal instead of a silent fresh dataset', async () => {
    const stored = storedStateOf(rowsOf(scenario('recording'), FIXED_NOW));
    const { sim } = await freshSim(FIXED_NOW);
    const otherSeed: StoredState = { ...stored, slices: { ...stored.slices, meta: { ...stored.slices.meta, seed: DEFAULT_SEED + 1 } } };
    expect(() => adoptStoredState(sim, otherSeed, 1)).toThrow(EngineError);
    try {
      adoptStoredState(sim, otherSeed, 1);
    } catch (error) {
      expect(error).toMatchObject({ code: 'ENGINE_SNAPSHOT_REJECTED', detail: { rule: 'SIM_SNAPSHOT' } });
    }
    // Nothing of the rejected state reached the engine: it still holds its fresh idle state.
    expect(sim.store.getState().session).toBeNull();
    expect(sim.store.getState().meta.epoch).toBe(0);
  });
});

describe('adoptStoredState', () => {
  it('puts the 28 stored slices into the engine by reference, with the epoch of the start, and keeps the transient ones fresh', async () => {
    const stored = storedStateOf(rowsOf(scenario('recording'), FIXED_NOW));
    const later = FIXED_NOW + 90_000;
    const { sim } = await freshSim(later);
    const fresh = sim.store.getState();
    adoptStoredState(sim, stored, 5);
    const state = sim.store.getState();

    for (const key of DURABLE_SLICE_KEYS) {
      if (key === 'meta') continue;
      expect(state[key], key).toBe(stored.slices[key]);
    }
    expect(state.meta).toEqual({ ...stored.slices.meta, epoch: 5 });
    expect(state.auth).toMatchObject({ status: 'SIGNED_OUT', operatorId: null });
    expect(state.audio).toBe(fresh.audio);
    expect(state.clock).toBe(fresh.clock);
    expect(state.authLockout).toBe(fresh.authLockout);
    expect(state.pairing).toEqual({ ...fresh.pairing, certificateFingerprint: stored.certificateFingerprint });
    expect(state.session?.state).toBe('RECORDING');
    expect(verifyAuditChain(state.audit)).toMatchObject({ ok: true });
  });

  it('the random streams are re-derived from the seed and the epoch: the same epoch gives the simulator\'s own rows, another epoch other rows', async () => {
    const reference = await createHost({ scenario: 'recording' });
    reference.drive(60_000);
    const expected = reference.state().audit.rows.map((row) => [row.seq, row.at, row.type, row.hash]);

    const run = async (epoch: number) => {
      const stored = storedStateOf(rowsOf(scenario('recording'), FIXED_NOW));
      const { sim, clock, errors } = await freshSim(FIXED_NOW);
      adoptStoredState(sim, stored, epoch);
      for (let elapsed = 0; elapsed < 60_000; elapsed += 50) {
        clock.advance(50);
        sim.tick();
      }
      expect(errors).toEqual([]);
      return sim.store.getState().audit.rows.map((row) => [row.seq, row.at, row.type, row.hash]);
    };

    expect(await run(0)).toEqual(expected);
    const other = await run(1);
    expect(other).not.toEqual(expected);
    expect(other.slice(0, scenario('recording').audit.total)).toEqual(expected.slice(0, scenario('recording').audit.total));
  });
});

describe('applyProcessStart: what a process start does to the state it rehydrated', () => {
  const STOP_MS = 90_000;

  /** A recording that ran for a minute, was stored, and is rehydrated `STOP_MS` after the last write. */
  async function restarted(prepare: (host: Host) => void = () => undefined) {
    const host = await createHost({ scenario: 'recording' });
    host.drive(60_000);
    prepare(host);
    const stoppedAt = host.now();
    const before = host.state();
    const stored = storedStateOf(rowsOf(before, stoppedAt));
    const now = stoppedAt + STOP_MS;
    const { sim, clock, errors } = await freshSim(now, stored.lastCommittedAt);
    adoptStoredState(sim, stored, before.meta.epoch + 1);
    return { host, before, stored, stoppedAt, now, sim, clock, errors };
  }

  it('a session in RECORDING at the stop is in FAULT, with one FAULT_RAISED row without an actor, stamped at the last committed instant', async () => {
    const { before, stored, stoppedAt, now, sim } = await restarted();
    expect(stored.lastCommittedAt).toBe(stoppedAt);
    const effects = applyProcessStart(sim, stored.lastCommittedAt, now);
    const state = sim.store.getState();

    expect(effects.faultedFrom).toBe('RECORDING');
    expect(state.session).toMatchObject({ state: 'FAULT', fault: { kind: 'POWER_FAIL', fromState: 'RECORDING', at: stoppedAt } });
    const rows = state.audit.rows.filter((row) => row.seq > before.audit.total);
    const raised = rows.filter((row) => row.type === 'FAULT_RAISED');
    expect(raised).toHaveLength(1);
    expect(raised[0]).toMatchObject({ actorId: null, at: stoppedAt, sessionId: before.session?.id, details: { kind: 'POWER_FAIL', fromState: 'RECORDING' } });
    expect(state.faults.active.map((fault) => fault.kind)).toContain('POWER_FAIL');
    expect(state.alerts.some((alert) => alert.active && alert.severity === 'CRITICAL')).toBe(true);
    expect(verifyAuditChain(state.audit)).toMatchObject({ ok: true });
    expect(state.auth).toMatchObject({ status: 'SIGNED_OUT' });
  });

  it('the stop is not counted as recording: the bytes are those of the last committed instant, not of the restart (D28 D-1)', async () => {
    const { before, stored, stoppedAt, now, sim } = await restarted();
    applyProcessStart(sim, stored.lastCommittedAt, now);
    const session = sim.store.getState().session;
    const startedAt = before.session?.startedAt ?? 0;
    const atStop = Math.round((RECORDING_BYTES_PER_HOUR * (stoppedAt - startedAt)) / 3_600_000);
    const atRestart = Math.round((RECORDING_BYTES_PER_HOUR * (now - startedAt)) / 3_600_000);
    expect(atRestart - atStop).toBeGreaterThan(200_000_000);
    expect(Math.abs((session?.bytesWritten ?? 0) - atStop)).toBeLessThan(1_000);
    expect(session?.bytesWritten).toBeLessThan(atRestart - 200_000_000);
  });

  it.each([
    ['PRECHECK', 0],
    ['ARMED', 5_000],
  ] as const)('a session in %s at the stop is in FAULT too', async (expected, wait) => {
    const host = await createHost({ scenario: 'idle' });
    const investigator = host.operator('INVESTIGATOR');
    const created = host.runAs(investigator, () =>
      host.sim.actions.createSession({
        caseNumber: 'LP/2026/1001-0099',
        subjectType: 'SAKSI',
        subjectName: 'Test Subject',
        investigatorId: investigator.id,
        room: 'Interview Room 1',
        profileId: 'STANDARD_1080P25',
      }),
    );
    expect(created).toMatchObject({ ok: true });
    host.runAs(investigator, () => host.sim.actions.beginPrecheck());
    host.drive(wait);
    const before = host.state();
    expect(before.session?.state).toBe(expected);
    const stored = storedStateOf(rowsOf(before, host.now()));
    const now = host.now() + STOP_MS;
    const { sim } = await freshSim(now, stored.lastCommittedAt);
    adoptStoredState(sim, stored, 1);
    const effects = applyProcessStart(sim, stored.lastCommittedAt, now);
    expect(effects.faultedFrom).toBe(expected);
    expect(sim.store.getState().session).toMatchObject({ state: 'FAULT', fault: { kind: 'POWER_FAIL', fromState: expected } });
  });

  it.each([
    ['STOPPING', 0],
    ['FINALIZING', 1_600],
  ] as const)('a session in %s at the stop is in FAULT too', async (expected, wait) => {
    const { sim, stored, now } = await restarted((host) => {
      host.runAs(host.operator('INVESTIGATOR'), () => host.sim.actions.stopRecording('Interview completed'));
      host.drive(wait);
      expect(host.state().session?.state).toBe(expected);
    });
    const effects = applyProcessStart(sim, stored.lastCommittedAt, now);
    expect(effects.faultedFrom).toBe(expected);
    expect(sim.store.getState().session).toMatchObject({ state: 'FAULT', fault: { kind: 'POWER_FAIL', fromState: expected } });
  });

  it('a session that was already in FAULT stays as it was, and nothing is written for it', async () => {
    const { sim, stored, now, before } = await restarted((host) => host.sim.actions.inject('POWER_FAIL'));
    expect(before.session?.state).toBe('FAULT');
    const effects = applyProcessStart(sim, stored.lastCommittedAt, now);
    expect(effects.faultedFrom).toBeNull();
    expect(sim.store.getState().session).toBe(stored.slices.session);
    expect(sim.store.getState().audit.rows.filter((row) => row.seq > before.audit.total && row.type === 'FAULT_RAISED')).toEqual([]);
  });

  it('no session, CREATE and SEALED are left alone', async () => {
    for (const name of ['idle'] as const) {
      const state = scenario(name);
      const stored = storedStateOf(rowsOf(state, FIXED_NOW));
      const { sim } = await freshSim(FIXED_NOW + STOP_MS, stored.lastCommittedAt);
      adoptStoredState(sim, stored, 1);
      expect(applyProcessStart(sim, stored.lastCommittedAt, FIXED_NOW + STOP_MS).faultedFrom).toBeNull();
      expect(sim.store.getState().session).toBeNull();
    }
    const { sim, stored, now, before } = await restarted((host) => {
      host.runAs(host.operator('INVESTIGATOR'), () => host.sim.actions.stopRecording('Interview completed'));
      host.drive(20_000);
    });
    expect(before.session?.state).toBe('SEALED');
    expect(applyProcessStart(sim, stored.lastCommittedAt, now).faultedFrom).toBeNull();
    expect(sim.store.getState().session?.state).toBe('SEALED');
  });

  it('the tablet link is OFFLINE after a start: a stored CONNECTED writes the truthful row at the restart instant, with no actor', async () => {
    const { sim, stored, now, before } = await restarted();
    expect(before.tabletLink.state).toBe('CONNECTED');
    const effects = applyProcessStart(sim, stored.lastCommittedAt, now);
    const state = sim.store.getState();
    expect(effects.tabletLinkReset).toBe(true);
    expect(state.tabletLink).toEqual({ state: 'OFFLINE', changedAt: now });
    const row = state.audit.rows.at(-1);
    expect(row).toMatchObject({ type: 'TABLET_LINK_CHANGED', actorId: null, at: now, details: { state: 'OFFLINE' } });

    // A second start finds it OFFLINE: nothing is written again.
    const again = storedStateOf(rowsOf(state, now));
    const second = await freshSim(now + 1_000, again.lastCommittedAt);
    adoptStoredState(second.sim, again, 2);
    const total = second.sim.store.getState().audit.total;
    expect(applyProcessStart(second.sim, again.lastCommittedAt, now + 1_000).tabletLinkReset).toBe(false);
    expect(second.sim.store.getState().audit.total).toBe(total);
  });

  it('the AUDIT_TAMPER overlay does not survive a start: the ring is the table\'s, and the fault is cleared (spec §12.3)', async () => {
    const { host, before } = await restarted((running) => running.sim.actions.inject('AUDIT_TAMPER'));
    expect(verifyAuditChain(before.audit).ok).toBe(false);
    // The table never held the altered row: the stored rows are the chain as it was appended.
    const untampered = {
      ...before,
      audit: { ...before.audit, rows: before.audit.rows.map((row) => (row.message.endsWith(' [altered]') ? { ...row, message: row.message.slice(0, -' [altered]'.length) } : row)) },
    };
    const stored = storedStateOf(rowsOf(untampered, host.now()));
    const now = host.now() + STOP_MS;
    const { sim } = await freshSim(now, stored.lastCommittedAt);
    adoptStoredState(sim, stored, 1);
    expect(verifyAuditChain(sim.store.getState().audit).ok).toBe(true);

    const effects = applyProcessStart(sim, stored.lastCommittedAt, now);
    const state = sim.store.getState();
    expect(effects.tamperCleared).toBe(true);
    expect(state.faults.active.some((fault) => fault.kind === 'AUDIT_TAMPER')).toBe(false);
    expect(state.audit.rows.filter((row) => row.seq > before.audit.total).map((row) => row.type)).toContain('FAULT_CLEARED');
    expect(verifyAuditChain(state.audit)).toMatchObject({ ok: true });
  });

  it('carryTabletLink puts the link the engine held in place of the stored one: the slice whole, the tablet\'s entry derived, and no row, no event, no counter (finding F78)', async () => {
    const { stored, now, before } = await restarted();
    const { sim } = await freshSim(now, stored.lastCommittedAt);
    adoptStoredState(sim, stored, before.meta.epoch + 1);
    const adopted = sim.store.getState();
    expect(adopted.tabletLink.state).toBe('CONNECTED');
    expect(adopted.otherDevices.find((device) => device.id === 'TABLET')).toMatchObject({ online: true, status: 'CONNECTED' });

    // The same link: nothing changes, by reference.
    expect(carryTabletLink(sim, { ...adopted.tabletLink })).toBe(false);
    expect(sim.store.getState()).toBe(adopted);

    // The link the engine held: OFFLINE since an earlier instant.
    const held = { state: 'OFFLINE', changedAt: FIXED_NOW - 5_000 } as const;
    expect(carryTabletLink(sim, held)).toBe(true);
    const state = sim.store.getState();
    expect(state.tabletLink).toBe(held);
    expect(state.otherDevices.find((device) => device.id === 'TABLET')).toMatchObject({ online: false, status: 'OFFLINE' });
    // Nothing records a change: the trail, the events and the counters are the stored ones, by reference.
    expect(state.audit).toBe(adopted.audit);
    expect(state.events).toBe(adopted.events);
    expect(state.meta).toBe(adopted.meta);
    expect(state.session).toBe(adopted.session);
    // Every other durable slice is the object it was: only the link and the list that is derived from it moved.
    expect(DURABLE_SLICE_KEYS.filter((key) => state[key] !== adopted[key]).sort()).toEqual(['otherDevices', 'tabletLink']);

    // The same state, and the other instant it changed at: carried too.
    expect(carryTabletLink(sim, { state: 'OFFLINE', changedAt: FIXED_NOW })).toBe(true);
    expect(sim.store.getState().tabletLink).toEqual({ state: 'OFFLINE', changedAt: FIXED_NOW });
    expect(sim.store.getState().otherDevices).toBe(state.otherDevices);
  });

  it('applyProcessStart with a link the engine held (a start in the mode boot of a process that ran): the link is carried, the hosted action is not called, and no link row is appended', async () => {
    const { sim, stored, now, before } = await restarted();
    expect(sim.store.getState().tabletLink.state).toBe('CONNECTED');
    const held = sim.store.getState().tabletLink;
    const effects = applyProcessStart(sim, stored.lastCommittedAt, now, held);
    expect(effects).toMatchObject({ faultedFrom: 'RECORDING', tabletLinkReset: false, tabletLinkCarried: false });
    const state = sim.store.getState();
    expect(state.tabletLink).toBe(held);
    expect(state.audit.rows.filter((row) => row.seq > before.audit.total).map((row) => row.type)).toEqual(['FAULT_RAISED']);

    // Without one (a process start) the stored CONNECTED becomes OFFLINE through the hosted action, with its row.
    const fresh = await restarted();
    const first = applyProcessStart(fresh.sim, fresh.stored.lastCommittedAt, fresh.now);
    expect(first).toMatchObject({ tabletLinkReset: true, tabletLinkCarried: false });
    expect(fresh.sim.store.getState().tabletLink).toEqual({ state: 'OFFLINE', changedAt: fresh.now });
    expect(fresh.sim.store.getState().audit.rows.filter((row) => row.seq > fresh.before.audit.total).map((row) => row.type)).toEqual(['FAULT_RAISED', 'TABLET_LINK_CHANGED']);
  });

  it('clearTamperOverlay is what every start does: it clears that one fault and its alert, appends one row, and leaves a state without it untouched (finding F73)', async () => {
    const { host, before } = await restarted((running) => {
      running.sim.actions.inject('GNSS_LOSS');
      running.sim.actions.inject('AUDIT_TAMPER');
    });
    const untampered = {
      ...before,
      audit: { ...before.audit, rows: before.audit.rows.map((row) => (row.message.endsWith(' [altered]') ? { ...row, message: row.message.slice(0, -' [altered]'.length) } : row)) },
    };
    const stored = storedStateOf(rowsOf(untampered, host.now()));
    const now = host.now() + STOP_MS;
    const { sim } = await freshSim(now, stored.lastCommittedAt);
    adoptStoredState(sim, stored, 1);
    const adopted = sim.store.getState();
    expect(adopted.faults.active.map((fault) => fault.kind).sort()).toEqual(['AUDIT_TAMPER', 'GNSS_LOSS']);
    expect(adopted.alerts.filter((alert) => alert.kind === 'AUDIT_TAMPER' && alert.active)).toHaveLength(1);
    // The ring is the table's: it verifies while the list still says "tampered". That is the contradiction.
    expect(verifyAuditChain(adopted.audit).ok).toBe(true);

    expect(clearTamperOverlay(sim, now)).toBe(true);
    const state = sim.store.getState();
    expect(state.faults.active.map((fault) => fault.kind)).toEqual(['GNSS_LOSS']);
    expect(state.alerts.filter((alert) => alert.kind === 'AUDIT_TAMPER' && alert.active)).toEqual([]);
    expect(state.session).toBe(adopted.session);
    const rows = state.audit.rows.filter((row) => row.seq > adopted.audit.total);
    expect(rows.map((row) => [row.type, row.actorId, row.at, row.details['kind']])).toEqual([['FAULT_CLEARED', null, now, 'AUDIT_TAMPER']]);
    expect(verifyAuditChain(state.audit)).toMatchObject({ ok: true });

    // A second call, and a state that never held the fault: nothing changes, by reference.
    expect(clearTamperOverlay(sim, now + 1)).toBe(false);
    expect(sim.store.getState()).toBe(state);
  });

  it('after the restart fault the operator recovers the session as the design book says: INCOMPLETE, never sealed', async () => {
    const { sim, clock, stored, now, before, errors } = await restarted();
    applyProcessStart(sim, stored.lastCommittedAt, now);
    const total = sim.store.getState().audit.total;
    sim.actions.recover();
    for (let elapsed = 0; elapsed < 4_000; elapsed += 50) {
      clock.advance(50);
      sim.tick();
    }
    const state = sim.store.getState();
    expect(state.audit.rows.filter((row) => row.seq > total).map((row) => row.type)).toEqual(
      expect.arrayContaining(['SYSTEM_BOOT', 'RECOVERY_STARTED', 'FAULT_CLEARED', 'SESSION_INCOMPLETE', 'RECOVERY_COMPLETED']),
    );
    expect(state.session).toBeNull();
    expect(state.sessionHistory[0]).toMatchObject({ id: before.session?.id, outcome: 'INCOMPLETE' });
    const item = state.evidence.find((entry) => entry.sessionId === before.session?.id);
    expect(item).toMatchObject({ status: 'RECORDED', sealedAt: null });
    expect(errors).toEqual([]);
    // The durable state after the journey still maps to rows and back.
    expect(storedStateOf(rowsOf(state, clock.now())).slices).toStrictEqual(withoutNegativeZeros(pickDurable(state)));
  });
});
