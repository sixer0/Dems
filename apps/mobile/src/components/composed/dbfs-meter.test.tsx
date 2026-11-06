// T-M09 (04_mobile_specs §10.1, MA-16): segment maths; 40 fake audio frames → one meter render.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, render } from '@testing-library/react-native';
import { HeroUINativeProvider } from 'heroui-native';
import { Profiler } from 'react';
import { makeMutable, type SharedValue } from 'react-native-reanimated';
import { resetSkiaCalls, skiaCalls } from '@/components/media/testing/skia-mock';
import { DbfsMeter } from './dbfs-meter';
import {
  DBFS_FLOOR,
  DBFS_THRESHOLDS,
  PEAK_FALL_DB_PER_S,
  PEAK_HOLD_MS,
  UNLIT_OPACITY,
  formatDbfs,
  initialPeakState,
  isDue,
  levelToFraction,
  litSegmentCount,
  meterLayout,
  segmentOpacity,
  segmentTone,
  stepPeakHold,
} from './dbfs-meter.math';

jest.mock('@shopify/react-native-skia', () =>
  jest
    .requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock')
    .createSkiaMock(),
);

describe('DbfsMeter maths', () => {
  it('uses the ten 01_specs §14.6 thresholds with green, amber and red tones', () => {
    expect([...DBFS_THRESHOLDS]).toEqual([-60, -48, -40, -32, -26, -20, -14, -9, -5, -2]);
    expect(DBFS_THRESHOLDS.map((_, i) => segmentTone(i))).toEqual([
      'success', 'success', 'success', 'success', 'success', 'success',
      'warning', 'warning', 'danger', 'danger',
    ]);
  });

  it('interpolates segment opacity over [t − 1, t] → [0.12, 1], clamped', () => {
    // -20 is segment 5.
    expect(segmentOpacity(-30, 5)).toBe(UNLIT_OPACITY);
    expect(segmentOpacity(-21, 5)).toBe(UNLIT_OPACITY);
    expect(segmentOpacity(-20.5, 5)).toBeCloseTo(0.56, 5);
    expect(segmentOpacity(-20, 5)).toBe(1);
    expect(segmentOpacity(0, 5)).toBe(1);
    expect(segmentOpacity(-18, 6)).toBe(UNLIT_OPACITY);
  });

  it('lights the MB 4 reading of -18 dBFS up to the -20 segment', () => {
    expect(litSegmentCount(-18)).toBe(6);
    expect(litSegmentCount(DBFS_FLOOR)).toBe(0);
    expect(litSegmentCount(0)).toBe(10);
  });

  it('maps levels monotonically onto the segment axis', () => {
    expect(levelToFraction(-90)).toBe(0);
    expect(levelToFraction(-60)).toBeCloseTo(0.1, 5);
    expect(levelToFraction(-20)).toBeCloseTo(0.6, 5);
    expect(levelToFraction(-2)).toBe(1);
    let last = -1;
    for (let db = -70; db <= 0; db += 0.5) {
      const f = levelToFraction(db);
      expect(f).toBeGreaterThanOrEqual(last);
      last = f;
    }
  });

  it('holds a peak for 1.5 s, then falls at 20 dB/s down to the live input', () => {
    let s = stepPeakHold(initialPeakState(), -12, 1000);
    expect(s.peak).toBe(-12);
    s = stepPeakHold(s, -30, 1000 + PEAK_HOLD_MS); // still held at the end of the window
    expect(s.peak).toBe(-12);
    s = stepPeakHold(s, -30, 1000 + PEAK_HOLD_MS + 500); // 0.5 s of fall
    expect(s.peak).toBeCloseTo(-12 - PEAK_FALL_DB_PER_S * 0.5, 5);
    s = stepPeakHold(s, -30, 1000 + PEAK_HOLD_MS + 5000); // long after: meets the input
    expect(s.peak).toBe(-30);
    s = stepPeakHold(s, -6, 9000); // a new maximum restarts the hold
    expect(s).toEqual({ peak: -6, heldUntil: 9000 + PEAK_HOLD_MS, updatedAt: 9000 });
  });

  it('throttles text to 4 Hz and formats the readout', () => {
    expect(isDue(0, 249, 4)).toBe(false);
    expect(isDue(0, 250, 4)).toBe(true);
    expect(formatDbfs(-18.4)).toBe('-18 dBFS');
    expect(formatDbfs(-0.2)).toBe('0 dBFS');
    expect(formatDbfs(-120)).toBe('-90 dBFS');
  });

  it('lays out ten bars inside the canvas, ramping upward on the card variant', () => {
    const l = meterLayout(200, 64, 'card', 'horizontal');
    expect(l.segments).toHaveLength(10);
    const last = l.segments[9];
    expect(last.x + last.width).toBeCloseTo(200, 5);
    expect(l.segments[0].height).toBeLessThan(last.height);
    expect(l.readout).not.toBeNull();
    const v = meterLayout(24, 200, 'compact', 'vertical');
    expect(v.readout).toBeNull();
    expect(v.segments[0].y).toBeGreaterThan(v.segments[9].y); // bottom-up
  });
});

describe('DbfsMeter component (MA-16)', () => {
  let level: SharedValue<number>;
  let peak: SharedValue<number>;
  let clip: SharedValue<number>;

  beforeEach(() => {
    jest.useFakeTimers();
    resetSkiaCalls(jest.requireMock('@shopify/react-native-skia'));
    level = makeMutable(DBFS_FLOOR);
    peak = makeMutable(DBFS_FLOOR);
    clip = makeMutable(0);
  });
  afterEach(() => {
    // Unmount and flush queued UI-runtime work under this test's fake clock (frame callbacks
    // register and unregister through it), then return to real timers.
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders once while 40 audio frames stream through its shared values', () => {
    let commits = 0;
    render(
      <HeroUINativeProvider>
        <Profiler id="meter" onRender={() => (commits += 1)}>
          <DbfsMeter level={level} peak={peak} clip={clip} motion="full" testID="meter" />
        </Profiler>
      </HeroUINativeProvider>,
    );
    expect(commits).toBe(1);

    act(() => {
      for (let frame = 0; frame < 40; frame += 1) {
        const db = -30 + 12 * Math.sin(frame / 3);
        level.set(db);
        peak.set(db + 3);
        jest.advanceTimersByTime(50); // 20 Hz
      }
    });

    expect(commits).toBe(1);
  });

  it('drives segment opacity from the level on the animation side, not through React', () => {
    const skia = jest.requireMock('@shopify/react-native-skia');
    render(
      <HeroUINativeProvider>
        <DbfsMeter level={level} motion="full" />
      </HeroUINativeProvider>,
    );
    // Group 0 is the dim layer; groups 1..10 are the segments.
    const groups = skiaCalls(skia, 'Group');
    const segment = (i: number) => groups[i + 1].opacity as SharedValue<number>;
    expect(segment(0).value).toBeCloseTo(UNLIT_OPACITY, 5);

    act(() => {
      level.set(-10);
      jest.advanceTimersByTime(1500); // the meter spring settles
    });

    expect(segment(0).value).toBeCloseTo(1, 2); // -60 lit
    expect(segment(6).value).toBeCloseTo(1, 2); // -14 lit
    expect(segment(7).value).toBeCloseTo(UNLIT_OPACITY, 2); // -9 unlit
    expect(skiaCalls(skia, 'Group')).toHaveLength(groups.length); // still no re-render
  });
});
