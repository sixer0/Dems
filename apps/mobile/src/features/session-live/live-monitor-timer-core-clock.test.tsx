// Closing-fix row CF2-A, defect RF-PH-1 (= RF-T-3; final phone and tablet re-tests, decisions D227, D234).
//
// On the phones under host load 9-14 the monitor timer held one value for 5-21 s while the Core recorded
// (00:00:00 for 21 s, 00:00:14 for 17.5 s; lag above 2.5 s in 12 of 14 recordings), then jumped to the true
// time; it never went backwards. Two causes are modelled in Jest:
// - the Live clock holds whenever a heartbeat was HANDLED late: its sample lowers the offset and the clock
//   never moves back, so it stands still until local time catches up (modelled here: every heartbeat is
//   handled 8 s after the Core sent it, as a starved JS queue does);
// - the store clock is published by a stall-tolerant 100 ms timer whose yields compounded on the starved
//   thread (`runtime/stall-tolerant-timers.test.ts`, the starvation cases).
// The timer must follow the Core's elapsed time (session start against the Core clock) within about a
// second, and never step back.
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { screen } from '@testing-library/react-native';
import { resetFinalizingHandoverForTests } from '@/features/session-finalizing/handover';
import { resetMotionStateForTests } from '@/motion';
import { renderLiveMonitor, resetLiveMonitorBed, type LiveMonitorBed } from './testing/live-monitor-bed';
import { coreInstantOnDeviceClock } from '@/runtime';
import { DEVICE_CLOCK_LAYER } from './rec-indicator';
import { REACT_LATE_GRACE_MS, TimerReadout, clockLayerText, clockSecondsAt } from './timer-readout';

let bed: LiveMonitorBed | null = null;

beforeEach(async () => {
  await resetLiveMonitorBed();
  resetFinalizingHandoverForTests();
});

afterEach(() => {
  bed?.stop();
  bed = null;
  jest.restoreAllMocks();
  resetMotionStateForTests();
});

/** The seconds the monitor's own timer draws (its accessibility label is the drawn text, HH:MM:SS). */
function drawnSeconds(): number {
  const label = String(screen.getAllByTestId('monitor-timer')[0]!.props.accessibilityLabel);
  const [h, m, s] = label.split(':').map(Number);
  return (h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0);
}

function coreElapsed(b: LiveMonitorBed): number {
  const startedAt = b.state().session?.startedAt;
  if (typeof startedAt !== 'number') throw new Error('no recording in the replica');
  return Math.floor((b.fake.clock.now() - startedAt) / 1000);
}

/**
 * From now on every heartbeat of the signed-in socket (the fake Core's own 1 s beat included) is handled
 * `lateMs` after the Core sent it, as on the starved phone: its `serverTime` is that much behind the
 * instant the Live source takes it in. `0` hands them on on time again.
 */
function handleHeartbeatsLate(b: LiveMonitorBed, lateMs: number): void {
  const connection = b.connection() as unknown as { heartbeat: (overrides?: Record<string, unknown>) => unknown };
  const proto = Object.getPrototypeOf(connection) as { heartbeat: (this: unknown, overrides?: Record<string, unknown>) => unknown };
  connection.heartbeat = (overrides = {}) =>
    proto.heartbeat.call(connection, { serverTime: new Date(b.fake.clock.now() - lateMs).toISOString(), ...overrides });
}

/** `ms` of Core time in 100 ms steps, the drawn value read after each. */
async function run(b: LiveMonitorBed, ms: number, seen: number[]): Promise<void> {
  for (let done = 0; done < ms; done += 100) {
    await b.elapse(100, 100);
    seen.push(drawnSeconds());
  }
}

describe('RF-PH-1: the monitor timer follows the Core while heartbeats are handled late', () => {
  it('every heartbeat handled 8 s late for 6 s: the timer keeps within a second of the Core (it held still before)', async () => {
    bed = await renderLiveMonitor();
    await bed.openMonitor();
    await bed.elapse(2_000, 100);
    const before = drawnSeconds();
    expect(Math.abs(coreElapsed(bed) - before)).toBeLessThanOrEqual(1);

    const seen: number[] = [];
    handleHeartbeatsLate(bed, 8_000);
    await run(bed, 6_000, seen);

    expect(drawnSeconds() - before).toBeGreaterThanOrEqual(5);
    expect(coreElapsed(bed) - drawnSeconds()).toBeLessThanOrEqual(1);
  });

  it('never backwards: late heartbeats, then timely ones again, the drawn value only grows', async () => {
    bed = await renderLiveMonitor();
    await bed.openMonitor();
    await bed.elapse(1_000, 100);
    const seen: number[] = [drawnSeconds()];
    handleHeartbeatsLate(bed, 8_000);
    await run(bed, 3_000, seen);
    handleHeartbeatsLate(bed, 0);
    await run(bed, 3_000, seen);
    for (let i = 1; i < seen.length; i += 1) expect(seen[i]!).toBeGreaterThanOrEqual(seen[i - 1]!);
    expect(coreElapsed(bed) - drawnSeconds()).toBeLessThanOrEqual(1);
    expect(drawnSeconds() - coreElapsed(bed)).toBeLessThanOrEqual(0);
  });
});

// Decision D247 item 5 (finding CT-01: the tablet's timer stood 8-11 s at moments of a recording while the
// Core recorded). The time React draws needs a JS timer and a render; the readout of a running recording
// also has a clock on the UI thread, anchored to the recording's start on the DEVICE clock, that draws the
// time itself whenever React's second is overdue. Jest has no UI thread: the rule the frame callback runs
// (`clockLayerText`) and its anchor are proven here. On the tablet the layer did not cure the standstill
// (note 178 section 5), so the monitor does not mount it: the last case pins that.
describe('D247 item 5: the device clock draws the recording time when React is late', () => {
  const ORIGIN = 1_760_000_000_000;

  it('React on time: the layer draws nothing (the readout is React\'s, as before)', () => {
    expect(clockLayerText(ORIGIN, ORIGIN + 41_000, 41)).toBe('');
    expect(clockLayerText(ORIGIN, ORIGIN + 41_999, 41)).toBe('');
    // The second just turned: React has the grace to draw it.
    expect(clockLayerText(ORIGIN, ORIGIN + 42_000 + REACT_LATE_GRACE_MS - 1, 41)).toBe('');
    // React ahead of this clock (the store's clock was): never drawn over.
    expect(clockLayerText(ORIGIN, ORIGIN + 41_500, 43)).toBe('');
  });

  it('React late by more than the grace: the device clock draws the current second, with no message and no render', () => {
    expect(clockLayerText(ORIGIN, ORIGIN + 42_000 + REACT_LATE_GRACE_MS, 41)).toBe('00:00:42');
    // The 11 s standstill of note 176 (rec 8): React still holds 00:00:35 while the clock runs on, second by second.
    const drawn = [35, 36, 37, 40, 46].map((second) => clockLayerText(ORIGIN, ORIGIN + second * 1000 + 500, 35));
    expect(drawn).toEqual(['', '00:00:36', '00:00:37', '00:00:40', '00:00:46']);
    expect(clockLayerText(ORIGIN, ORIGIN + 3_725_400, 35)).toBe('01:02:05');
  });

  it('whole seconds on the device clock; nothing before the start or without a finite anchor', () => {
    expect(clockSecondsAt(ORIGIN, ORIGIN + 59_999)).toBe(59);
    expect(clockSecondsAt(ORIGIN, ORIGIN - 5)).toBe(0);
    expect(clockSecondsAt(Number.NaN, ORIGIN)).toBe(0);
    expect(clockLayerText(Number.NaN, ORIGIN, 0)).toBe('');
  });

  it('the anchor: the Core instant of the start moved onto the device clock by the Core clock\'s offset', () => {
    // The Core is 2,500 ms ahead of this device; the recording started at Core time 1,000,000.
    expect(coreInstantOnDeviceClock({ now: () => 1_060_000 }, 1_000_000, 1_057_500)).toBe(997_500);
    // 57,500 ms later on the device clock the recording is 60 s old - with no reading of the Core in between.
    expect(clockSecondsAt(997_500, 1_057_500)).toBe(60);
    expect(Number.isNaN(coreInstantOnDeviceClock({ now: () => Number.NaN }, 1_000_000, 1_057_500))).toBe(true);
  });

  it('the monitor does NOT mount the layer today: the switch is off, and React\'s readout is the only one drawn', async () => {
    // Note 178 section 5: on the tablet the layer did not take over where the timer stands (the first 40 s of a
    // recording) and blanked one second. Until a release-build profile says otherwise it stays off - pinned here,
    // so switching it on is a decision with a device proof, not a side effect.
    expect(DEVICE_CLOCK_LAYER).toBe(false);
    bed = await renderLiveMonitor();
    await bed.openMonitor();
    await bed.elapse(2_000, 100);
    expect(screen.queryAllByTestId('monitor-timer-clocked')).toHaveLength(0);
    for (const readout of screen.UNSAFE_getAllByType(TimerReadout)) {
      expect((readout.props as { clockOriginMs?: number | null }).clockOriginMs ?? null).toBeNull();
    }
    expect(Math.abs(coreElapsed(bed) - drawnSeconds())).toBeLessThanOrEqual(1);
  });
});
