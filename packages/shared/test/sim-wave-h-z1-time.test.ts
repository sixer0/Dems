// Fix wave H, closing pass Z1, items 1 and 2 (rulings D203 (1) and D203 (4)).
//
// Item 1 - TRUTHFUL TIME: where the capture is the Core's own (`CreateSimOptions.capture:
// 'external'`) the `time` slice says what the Core has: the host system clock. Never GNSS, never
// locked. `RECORDING_STARTED.timeSource`, the session's `startTimeSource` and the START node follow
// the slice. The pre-check TIME item is a NOTE: WARN level, "Time source: host system clock (no
// GNSS)", and it neither blocks the start, nor asks for an acknowledgement, nor counts as a warning.
//
// Item 2 - the idle `HEALTH_CHECK_OK` event is not written there either.
//
// Every claim has its control: the SAME run in `'simulated'` capture keeps the demo values.
import { describe, expect, it } from 'vitest';
import {
  HOST_CLOCK_PRECHECK_REASON,
  createManualClock,
  createSim,
  isHostClockTime,
  isPrecheckNote,
  systemStatus,
  type SessionCreateInput,
  type SimState,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);
const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0009', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };

function bed(capture: 'simulated' | 'external') {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, capture });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  const state = (): SimState => sim.store.getState();
  const run = (ms: number, step = 250): void => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  return { sim, state, run };
}

function armed(capture: 'simulated' | 'external') {
  const h = bed(capture);
  h.run(2_000);
  h.sim.actions.createSession(INPUT);
  h.sim.actions.beginPrecheck();
  h.run(5_000, 50);
  return h;
}

describe('item 1: the time slice of a Core in its own capture is the host system clock', () => {
  it('external capture: the slice says host clock - source RTC, not locked, no GNSS lock, no satellites, no NTP - from the first state on', () => {
    const h = bed('external');
    // BEFORE any tick: no state of this Core ever says GNSS.
    expect(h.state().time.source).toBe('RTC');
    h.run(60_000, 1_000);
    const time = h.state().time;
    expect(isHostClockTime(time)).toBe(true);
    expect(time).toMatchObject({ hostClock: true, source: 'RTC', locked: false, gnss: { locked: false, satellites: 0 }, ntp: { reachable: false } });
    // Nothing is measured: no offset drifts and no history point is invented.
    expect(time.offsetMs).toBe(0);
    expect(time.history).toEqual([]);
  });

  it('external capture: the host clock is no fallback - systemStatus raises no TIME_FALLBACK flag', () => {
    const h = bed('external');
    h.run(5_000, 1_000);
    expect(systemStatus(h.state()).flags.map((flag) => flag.id)).not.toContain('TIME_FALLBACK');
  });

  it('external capture: the pre-check TIME item is a NOTE - WARN level, the truthful sentence, outcome PASS, ARMED without an acknowledgement', () => {
    const h = armed('external');
    const session = h.state().session;
    const item = session?.precheck.items.find((candidate) => candidate.id === 'TIME');
    expect(item).toMatchObject({ status: 'WARN', value: 'HOST_SYSTEM_CLOCK', reason: HOST_CLOCK_PRECHECK_REASON, reasonCode: null, params: { rule: 'TIME_HOST_CLOCK', source: 'RTC' } });
    expect(HOST_CLOCK_PRECHECK_REASON).toBe('Time source: host system clock (no GNSS)');
    expect(item !== undefined && isPrecheckNote(item)).toBe(true);
    // It does not block, it is not a failed pre-check, and nobody has to acknowledge it.
    expect(session?.precheck.outcome).toBe('PASS');
    expect(session?.precheck.warningsAcknowledged).toBe(false);
    expect(session?.state).toBe('ARMED');
    const passed = h.state().audit.rows.filter((row) => row.type === 'PRECHECK_PASSED' && row.sessionId === session?.id);
    expect(passed).toHaveLength(1);
    expect(passed[0]?.details).toMatchObject({ warnings: 0, acknowledged: false });
  });

  it('external capture: RECORDING_STARTED, the session and the START node say RTC - never GNSS', () => {
    const h = armed('external');
    h.sim.actions.startRecording();
    const state = h.state();
    const row = state.audit.rows.find((candidate) => candidate.type === 'RECORDING_STARTED' && candidate.sessionId === state.session?.id);
    expect(row?.details).toEqual({ timeSource: 'RTC' });
    expect(state.session?.startTimeSource).toBe('RTC');
    expect(state.session?.timeline.find((node) => node.kind === 'START')?.params).toMatchObject({ timeSource: 'RTC' });
    expect(JSON.stringify(state.audit.rows.filter((candidate) => candidate.sessionId === state.session?.id))).not.toContain('GNSS');
  });

  it('CONTROL - simulated capture keeps its demo time: GNSS locked, TIME passes with GNSS, RECORDING_STARTED says GNSS', () => {
    const h = armed('simulated');
    expect(isHostClockTime(h.state().time)).toBe(false);
    expect(h.state().time).toMatchObject({ source: 'GNSS', locked: true });
    expect(h.state().time.history.length).toBeGreaterThan(0);
    const item = h.state().session?.precheck.items.find((candidate) => candidate.id === 'TIME');
    expect(item).toMatchObject({ status: 'PASS', value: 'GNSS' });
    expect(item !== undefined && isPrecheckNote(item)).toBe(false);
    h.sim.actions.startRecording();
    const state = h.state();
    expect(state.audit.rows.find((candidate) => candidate.type === 'RECORDING_STARTED' && candidate.sessionId === state.session?.id)?.details).toEqual({ timeSource: 'GNSS' });
  });

  it('CONTROL - a real warning beside the note still asks for its acknowledgement, and the note is not counted with it', () => {
    const h = bed('external');
    h.run(2_000);
    h.sim.actions.inject('STORAGE_LOW');
    h.sim.actions.createSession(INPUT);
    h.sim.actions.beginPrecheck();
    h.run(5_000, 50);
    expect(h.state().session?.precheck.outcome).toBe('WARN');
    expect(h.state().session?.state).toBe('PRECHECK');
    h.sim.actions.acknowledgePrecheckWarnings();
    const state = h.state();
    expect(state.session?.state).toBe('ARMED');
    expect(state.audit.rows.find((row) => row.type === 'PRECHECK_PASSED' && row.sessionId === state.session?.id)?.details).toMatchObject({ warnings: 1, acknowledged: true });
  });
});

describe('item 2: the idle HEALTH_CHECK_OK event is not the generator\'s to write in the Core\'s own capture', () => {
  const idleEvents = (capture: 'simulated' | 'external'): string[] => {
    const h = bed(capture);
    const seed = new Set(h.state().events.map((row) => row.id));
    h.run(30 * 60_000, 1_000);
    return h.state().events.filter((row) => !seed.has(row.id)).map((row) => row.type);
  };

  it('external capture: thirty idle minutes write no HEALTH_CHECK_OK (and still no storage / time statement)', () => {
    const types = idleEvents('external');
    expect(types.filter((type) => ['HEALTH_CHECK_OK', 'STORAGE_WRITE_VERIFIED', 'TIME_SYNC'].includes(type))).toEqual([]);
  });

  it('CONTROL - simulated capture keeps its idle stream, the health check among it', () => {
    const types = idleEvents('simulated');
    expect(types).toContain('HEALTH_CHECK_OK');
    expect(types).toContain('TIME_SYNC');
  });
});
