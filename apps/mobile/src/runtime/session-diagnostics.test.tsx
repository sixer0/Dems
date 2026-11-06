// Post-review fix FXR-M, finding W93-28 (code review W93 §6; RF2-2 of D237): no fix, the diagnostics W98
// needs to tell a blocked JS thread from dropped deltas. One quiet `runtime.diag.sessionWindow` record per
// session-state transition: the JS-lag summary of the window and (LIVE) the socket counters. It is kept in the
// runtime log and NOT printed to the console.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup } from '@testing-library/react-native';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { createRuntimeLog, runtimeLog, toRuntimeLogRecord } from './log';
import { JS_LAG_SAMPLE_MS, LATE_STOP_MS, SessionDiagnostics, createJsLagSampler, lateStopRecordOf, socketDiagnosticsOf, type LateStopInput } from './session-diagnostics';
import { resetCoreLinkPrefsForTests } from './core-link';
import { createTestSim, flushAsync, renderWithRuntime } from './testing/test-sim';

describe('createJsLagSampler: the drift of a plain 250 ms interval', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('on time: samples, no lag; a 1.5 s block shows as one late tick (worst lag, over 500, over 1000)', () => {
    const sampler = createJsLagSampler();
    sampler.start();
    jest.advanceTimersByTime(JS_LAG_SAMPLE_MS * 4);
    const calm = sampler.take();
    expect(calm).toMatchObject({ samples: 4, lagMaxMs: 0, lagOver500: 0, lagOver1000: 0 });
    // The thread is blocked for 1.5 s: the clock moves on, the next tick runs 1.5 s late.
    jest.setSystemTime(Date.now() + 1_500);
    jest.advanceTimersByTime(JS_LAG_SAMPLE_MS);
    const blocked = sampler.take();
    expect(blocked.samples).toBe(1);
    expect(blocked.lagMaxMs).toBe(1_500);
    expect(blocked).toMatchObject({ lagOver500: 1, lagOver1000: 1 });
    expect(blocked.lagMaxAtMs).not.toBeNull();
    sampler.stop();
    expect(sampler.running).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('socketDiagnosticsOf: the counters W98 reads, or "no Live source"', () => {
    expect(socketDiagnosticsOf(null)).toEqual({ live: false });
    const counters = { deltas: 12, deltasDropped: 2, deltasStale: 1, resyncs: 1, reconnects: 0 };
    const status = { link: 'ONLINE', synced: false, resync: 'GAP', revision: 41, counters } as unknown;
    expect(socketDiagnosticsOf({ socketStatus: () => status } as never)).toEqual({
      live: true,
      link: 'ONLINE',
      synced: false,
      resyncPending: 'GAP',
      revision: 41,
      ...counters,
    });
  });
});

describe('SessionDiagnostics: one quiet record per session-state transition', () => {
  let info: jest.SpiedFunction<typeof console.info>;
  let warn: jest.SpiedFunction<typeof console.warn>;
  let error: jest.SpiedFunction<typeof console.error>;
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetCoreLinkPrefsForTests();
    info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    info.mockRestore();
    warn.mockRestore();
    error.mockRestore();
  });

  it('a recording stopped: the RECORDING -> STOPPING/FINALIZING transitions are recorded with the lag summary, nothing printed', async () => {
    const test = createTestSim({ scenario: 'recording' });
    expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    const before = runtimeLog.records().length;
    renderWithRuntime(<SessionDiagnostics />, { sim: test.sim });
    await flushAsync();
    act(() => {
      test.sim.actions.stopRecording('Stopped for the diagnostics test');
      test.advance(500, 100);
    });
    await flushAsync();
    const records = runtimeLog.records().slice(before).filter((r) => r.source === 'runtime.diag.sessionWindow');
    expect(records.length).toBeGreaterThan(0);
    expect(records[0]).toMatchObject({ level: 'info', context: expect.objectContaining({ from: 'RECORDING', live: false }) });
    for (const record of records) {
      expect(record.context).toEqual(expect.objectContaining({ samples: expect.any(Number), lagMaxMs: expect.any(Number), lagOver500: expect.any(Number), lagOver1000: expect.any(Number) }));
    }
    const printed = [...info.mock.calls, ...warn.mock.calls, ...error.mock.calls].filter((args) => JSON.stringify(args).includes('runtime.diag.sessionWindow'));
    expect(printed).toEqual([]);
  });
});

// Blueprint row 62 (B11, RK-5): the late-stop wait points. `runtime.diag.lateStop` names WHERE a stop waited
// on this device: before the replica's store held it, or between the store and the React commit.
describe('lateStopRecordOf: citable instants, the two waits and the named wait point (pure)', () => {
  const T = Date.UTC(2026, 9, 9, 3, 0, 0);
  const lag = { samples: 8, lagMaxMs: 40, lagOver500: 0, lagOver1000: 0, lagMaxAtMs: 500 };
  const socket = (over: Record<string, string | number | boolean | null> = {}) => ({
    live: true,
    link: 'ONLINE',
    synced: true,
    resyncPending: null,
    revision: 40,
    deltas: 10,
    deltasDropped: 0,
    deltasStale: 0,
    resyncs: 0,
    reconnects: 0,
    ...over,
  });
  const input = (over: Partial<LateStopInput> = {}): LateStopInput => ({
    sessionId: 'SES-0024',
    to: 'STOPPING',
    store: { atMs: T + 300, atCoreMs: T + 300, state: 'STOPPING', coreStoppedAtMs: T, socket: socket({ revision: 41, deltas: 11, clockSampleAgeMs: 900 }) },
    commitAtMs: T + 350,
    commitAtCoreMs: T + 350,
    coreStoppedAtCommitMs: T,
    armedSocket: socket(),
    lag,
    ...over,
  });

  it('a stop learnt in time: ISO instants on both clocks, the waits in ms, wait point NONE', () => {
    expect(lateStopRecordOf(input())).toEqual(
      expect.objectContaining({
        sessionId: 'SES-0024',
        to: 'STOPPING',
        storeState: 'STOPPING',
        coreStoppedAt: '2026-10-09T03:00:00.000Z',
        storeAt: '2026-10-09T03:00:00.300Z',
        storeAtCore: '2026-10-09T03:00:00.300Z',
        commitAt: '2026-10-09T03:00:00.350Z',
        commitAtCore: '2026-10-09T03:00:00.350Z',
        coreToStoreMs: 300,
        storeToCommitMs: 50,
        coreToCommitMs: 350,
        waitPoint: 'NONE',
        lateStopMs: LATE_STOP_MS,
        droppedSinceArm: 0,
        resyncsSinceArm: 0,
        revisionAtStore: 41,
        clockSampleAgeMs: 900,
        live: true,
        samples: 8,
        lagMaxMs: 40,
      }),
    );
  });

  it('the RF2-2 shape (store 6.7 s after the Core stop): BEFORE_STORE, with the dropped deltas and the resync in between', () => {
    const record = lateStopRecordOf(
      input({
        store: { atMs: T + 6_730, atCoreMs: T + 6_730, state: 'FINALIZING', coreStoppedAtMs: T, socket: socket({ deltasDropped: 3, resyncs: 1, resyncPending: 'GAP' }) },
        commitAtMs: T + 6_800,
        commitAtCoreMs: T + 6_800,
        to: 'FINALIZING',
      }),
    );
    expect(record).toMatchObject({ waitPoint: 'BEFORE_STORE', coreToStoreMs: 6_730, storeToCommitMs: 70, droppedSinceArm: 3, resyncsSinceArm: 1, resyncPendingAtStore: 'GAP' });
  });

  it('the store held the stop at once and React committed it 3 s later: STORE_TO_COMMIT', () => {
    const record = lateStopRecordOf(input({ commitAtMs: T + 3_300, commitAtCoreMs: T + 3_300, lag: { ...lag, lagMaxMs: 2_900, lagOver500: 1, lagOver1000: 1 } }));
    expect(record).toMatchObject({ waitPoint: 'STORE_TO_COMMIT', coreToStoreMs: 300, storeToCommitMs: 3_000, coreToCommitMs: 3_300, lagMaxMs: 2_900 });
  });

  it('the boundary: 1 ms under the threshold is NONE, the threshold itself is named', () => {
    expect(lateStopRecordOf(input({ commitAtMs: T + LATE_STOP_MS - 1, commitAtCoreMs: T + LATE_STOP_MS - 1 }))['waitPoint']).toBe('NONE');
    expect(lateStopRecordOf(input({ commitAtMs: T + LATE_STOP_MS, commitAtCoreMs: T + LATE_STOP_MS }))['waitPoint']).toBe('STORE_TO_COMMIT');
  });

  it('no Core clock (a simulator): the Core waits are null, not invented; the device wait alone still names a late commit', () => {
    const sim = input({ store: { atMs: T + 10, atCoreMs: null, state: 'STOPPING', coreStoppedAtMs: T, socket: { live: false } }, commitAtCoreMs: null, armedSocket: { live: false } });
    expect(lateStopRecordOf(sim)).toMatchObject({ coreToStoreMs: null, coreToCommitMs: null, storeAtCore: null, commitAtCore: null, storeToCommitMs: 340, waitPoint: 'UNKNOWN', droppedSinceArm: null, live: false });
    expect(lateStopRecordOf({ ...sim, commitAtMs: T + 2_010 })['waitPoint']).toBe('STORE_TO_COMMIT');
  });

  it('no store mark: nothing is claimed about the store; `stoppedAt` comes from the commit read', () => {
    const record = lateStopRecordOf(input({ store: null, commitAtMs: T + 4_000, commitAtCoreMs: T + 4_000 }));
    expect(record).toMatchObject({ storeAt: null, storeState: null, coreToStoreMs: null, storeToCommitMs: null, coreToCommitMs: 4_000, coreToFirstKnownMs: 4_000, waitPoint: 'UNKNOWN', coreStoppedAt: '2026-10-09T03:00:00.000Z' });
  });

  it('`stoppedAt` not in the store yet at the store instant: the commit read fills it in', () => {
    const record = lateStopRecordOf(input({ store: { atMs: T + 300, atCoreMs: T + 300, state: 'STOPPING', coreStoppedAtMs: null, socket: socket() } }));
    expect(record).toMatchObject({ coreStoppedAt: '2026-10-09T03:00:00.000Z', coreToStoreMs: 300 });
  });
});

describe('SessionDiagnostics: one quiet `runtime.diag.lateStop` record per stop (row 62)', () => {
  let spies: jest.SpiedFunction<typeof console.info>[] = [];
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetCoreLinkPrefsForTests();
    spies = (['info', 'warn', 'error'] as const).map((level) => jest.spyOn(console, level).mockImplementation(() => undefined));
  });
  afterEach(() => {
    cleanup();
    for (const spy of spies) spy.mockRestore();
  });

  it('a recording stopped: exactly one record, the store instant not after the commit, the store state named, nothing printed', async () => {
    const test = createTestSim({ scenario: 'recording' });
    expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    const sessionId = test.sim.store.getState().session?.id ?? null;
    const before = runtimeLog.records().length;
    renderWithRuntime(<SessionDiagnostics />, { sim: test.sim });
    await flushAsync();
    // Store writes that leave the session RECORDING are not a stop: no mark, no record.
    act(() => {
      test.advance(1_000, 100);
    });
    await flushAsync();
    expect(runtimeLog.records().slice(before).filter((r) => r.source === 'runtime.diag.lateStop')).toEqual([]);
    act(() => {
      test.sim.actions.stopRecording('Stopped for the late-stop test');
      test.advance(500, 100);
    });
    await flushAsync();
    const records = runtimeLog.records().slice(before).filter((r) => r.source === 'runtime.diag.lateStop');
    expect(records).toHaveLength(1);
    const context = records[0]?.context ?? {};
    expect(records[0]).toMatchObject({ level: 'info' });
    expect(context).toMatchObject({ sessionId, live: false, storeToCommitMs: expect.any(Number), samples: expect.any(Number), lagMaxMs: expect.any(Number) });
    expect(['STOPPING', 'FINALIZING']).toContain(context['storeState']);
    expect(typeof context['storeAt']).toBe('string');
    expect(typeof context['commitAt']).toBe('string');
    expect(Date.parse(String(context['storeAt']))).toBeLessThanOrEqual(Date.parse(String(context['commitAt'])));
    expect(context['storeToCommitMs']).toBeGreaterThanOrEqual(0);
    // A simulator has no Core clock: the Core-clock instants are null, never the device clock under another name.
    expect(context).toMatchObject({ storeAtCore: null, commitAtCore: null, coreToStoreMs: null });
    const printed = spies.flatMap((spy) => spy.mock.calls).filter((args) => JSON.stringify(args).includes('runtime.diag.lateStop'));
    expect(printed).toEqual([]);
  });

  it('negative control: a session that was never RECORDING under this component writes no late-stop record', async () => {
    const test = createTestSim({ scenario: 'recording' });
    expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    act(() => {
      test.sim.actions.stopRecording('Stopped before the component mounted');
      test.advance(300, 100);
    });
    const before = runtimeLog.records().length;
    renderWithRuntime(<SessionDiagnostics />, { sim: test.sim });
    await flushAsync();
    act(() => {
      test.advance(2_000, 100);
    });
    await flushAsync();
    expect(runtimeLog.records().slice(before).filter((r) => r.source === 'runtime.diag.lateStop')).toEqual([]);
  });
});

describe('the quiet write of the runtime log (what keeps the diagnostics off the console)', () => {
  it('a record written with { console: false } is kept and not mirrored; the same record without it is mirrored', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const storage = { getItem: async () => null, setItem: async () => undefined };
      const log = createRuntimeLog({ storage, flushMs: 60_000 });
      // An error-level record: Jest mirrors only those, so it shows the switch at work.
      const record = toRuntimeLogRecord({ level: 'error', source: 'runtime.diag.test', error: 'quiet (test)' });
      log.write(record, { console: false });
      expect(log.records()).toHaveLength(1);
      expect(error).not.toHaveBeenCalled();
      log.write(record);
      expect(error).toHaveBeenCalledTimes(1);
    } finally {
      error.mockRestore();
    }
  });
});
