// Post-review fix FXR-M, finding W93-28 (code review W93 §6; RF2-2 of D237): no fix, the diagnostics W98
// needs to tell a blocked JS thread from dropped deltas. One quiet `runtime.diag.sessionWindow` record per
// session-state transition: the JS-lag summary of the window and (LIVE) the socket counters. It is kept in the
// runtime log and NOT printed to the console.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup } from '@testing-library/react-native';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { createRuntimeLog, runtimeLog, toRuntimeLogRecord } from './log';
import { JS_LAG_SAMPLE_MS, SessionDiagnostics, createJsLagSampler, socketDiagnosticsOf } from './session-diagnostics';
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
