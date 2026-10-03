// Network & Time view maths (step 86; 04_mobile_specs §4.14; web parity with implementation/29).
import { describe, expect, it } from '@jest/globals';
import { formatClock } from '@dems/shared/realtime';
import {
  BANDWIDTH_BARS,
  bandwidthScaleMax,
  bandwidthWindow,
  displaySecondsOfDay,
  heldSecond,
  isTimeEscalation,
  lanLevel,
  poeLevel,
  secondsSince,
  tierIndex,
  tierState,
  timeLevel,
  TIME_TONE,
} from './network-time-model';

function hms(secondsOfDay: number): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(secondsOfDay / 3600))}:${p(Math.floor(secondsOfDay / 60) % 60)}:${p(secondsOfDay % 60)}`;
}

describe('time hierarchy (GNSS → NTP → RTC)', () => {
  it('maps sources to levels, tones (both fallbacks warning, P7) and escalations', () => {
    expect([timeLevel('GNSS'), timeLevel('NTP'), timeLevel('RTC')]).toEqual(['LOCKED', 'FALLBACK', 'HOLDOVER']);
    expect(TIME_TONE).toEqual({ LOCKED: 'success', FALLBACK: 'warning', HOLDOVER: 'warning' });
    expect(isTimeEscalation('LOCKED', 'FALLBACK')).toBe(true);
    expect(isTimeEscalation('FALLBACK', 'HOLDOVER')).toBe(true);
    expect(isTimeEscalation('HOLDOVER', 'LOCKED')).toBe(false);
    expect([tierIndex('GNSS'), tierIndex('NTP'), tierIndex('RTC')]).toEqual([0, 1, 2]);
  });

  it('derives each tier state from the active source and the receivers', () => {
    const locked = { source: 'GNSS' as const, gnssLocked: true, ntpReachable: true };
    expect(['GNSS', 'NTP', 'RTC'].map((tier) => tierState(locked, tier as 'GNSS'))).toEqual(['ACTIVE', 'STANDBY', 'STANDBY']);
    const ntp = { source: 'NTP' as const, gnssLocked: false, ntpReachable: true };
    expect(['GNSS', 'NTP', 'RTC'].map((tier) => tierState(ntp, tier as 'GNSS'))).toEqual(['LOST', 'ACTIVE', 'STANDBY']);
    const rtc = { source: 'RTC' as const, gnssLocked: false, ntpReachable: false };
    expect(['GNSS', 'NTP', 'RTC'].map((tier) => tierState(rtc, tier as 'GNSS'))).toEqual(['LOST', 'UNREACHABLE', 'ACTIVE']);
  });
});

describe('network levels', () => {
  it('LAN up/down and PoE degraded when a port drops', () => {
    expect([lanLevel(true), lanLevel(false)]).toEqual(['UP', 'DOWN']);
    expect([poeLevel(4, 4), poeLevel(3, 4)]).toEqual(['UP', 'DEGRADED']);
  });
});

describe('bandwidth window (12 bars)', () => {
  const points = Array.from({ length: 20 }, (_, i) => ({ at: 1_000 * (i + 1), downMbps: 10 + i, upMbps: 3 + i / 10 }));

  it('pads from the left while samples are collected and never invents points', () => {
    const empty = bandwidthWindow([], { downMbps: 12.4, upMbps: 3.1 }, null);
    expect(empty.bars).toEqual(Array.from({ length: BANDWIDTH_BARS }, () => 0));
    expect(empty).toMatchObject({ samples: 0, downMbps: 12.4, upMbps: 3.1 });
    const three = bandwidthWindow(points.slice(0, 3), { downMbps: 0, upMbps: 0 }, null);
    expect(three.bars).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 11, 12]);
    expect(three).toMatchObject({ samples: 3, downMbps: 12, upMbps: 3.2 });
  });

  it('follows the newest 12 samples, or holds at `endAt` (the D43 test switch)', () => {
    const live = bandwidthWindow(points, { downMbps: 0, upMbps: 0 }, null);
    expect(live.bars).toEqual([18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29]);
    expect(live.downMbps).toBe(29);
    const held = bandwidthWindow(points, { downMbps: 0, upMbps: 0 }, 10_000);
    expect(held.bars.slice(-3)).toEqual([17, 18, 19]);
    expect(held.samples).toBe(10);
    expect(held.downMbps).toBe(19);
  });

  it('scales with 15% headroom, never below 1 Mbps', () => {
    expect(bandwidthScaleMax([0, 0])).toBe(1);
    expect(bandwidthScaleMax([10, 12.4])).toBe(15);
  });
});

describe('UTC+07:00 clock arithmetic', () => {
  it('agrees with the shared formatClock and an independent UTC+7 computation', () => {
    const at = Date.UTC(2026, 9, 1, 3, 4, 5); // 10:04:05 WIB
    const second = Math.floor(at / 1000);
    expect(hms(displaySecondsOfDay(second))).toBe('10:04:05');
    expect(formatClock(at)).toBe('10:04:05');
    // Across the WIB midnight: 17:00:30 UTC is 00:00:30 the next day.
    expect(hms(displaySecondsOfDay(Math.floor(Date.UTC(2026, 9, 1, 17, 0, 30) / 1000)))).toBe('00:00:30');
  });

  it('holds the second to the minute under the test switch; secondsSince never goes negative', () => {
    expect(heldSecond(125, true)).toBe(120);
    expect(heldSecond(125, false)).toBe(125);
    expect(secondsSince(100, 90_000)).toBe(10);
    expect(secondsSince(100, 200_000)).toBe(0);
  });
});
