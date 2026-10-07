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
