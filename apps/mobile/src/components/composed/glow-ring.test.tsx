// C-1 GlowRing: ring sweep maths (05_mobile_plan M-04) and the full / reduced motion contract.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { palette } from '@dems/shared/tokens';
import { resetSkiaCalls, skiaCalls } from '@/components/media/testing/skia-mock';
import { GlowRing } from './glow-ring';
import {
  BRACKET_ARCS,
  GLOW_RING_SIZE,
  RING_ROTATE_MS,
  arcDelay,
  arcIntervals,
  isEscalation,
  pointOnCircle,
  resolveRingSize,
  ringGeometry,
  ringStateColor,
  sweepTotalMs,
  tickSegments,
} from './glow-ring.math';

jest.mock('@shopify/react-native-skia', () =>
  jest
    .requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock')
    .createSkiaMock(),
);

describe('GlowRing maths', () => {
  it('clamps sizes to the 04 §4.0 mode ranges', () => {
    expect(resolveRingSize('login')).toBe(200);
    expect(resolveRingSize('login', 400)).toBe(340);
    expect(resolveRingSize('hero')).toBe(280);
    expect(resolveRingSize('mini', 40)).toBe(72);
    expect(resolveRingSize('mini', 120)).toBe(GLOW_RING_SIZE.mini.max);
  });

  it('nests the radii inside the canvas, outer to inner', () => {
    for (const size of [72, 120, 200, 280, 340]) {
      const g = ringGeometry(size);
      expect(g.tickOuter).toBeLessThan(g.c);
      expect(g.tickShort).toBeLessThan(g.tickOuter);
      expect(g.tickLong).toBeLessThan(g.tickShort);
      expect(g.bracketRadius + g.bracketStroke / 2).toBeLessThan(g.tickLong);
      expect(g.innerRadius + g.innerStroke / 2).toBeLessThan(g.bracketRadius - g.bracketStroke / 2);
      expect(g.bracketStroke).toBeGreaterThanOrEqual(2);
    }
  });

  it('draws 72 ticks with a long one every 30 degrees', () => {
    const ticks = tickSegments(ringGeometry(280));
    expect(ticks).toHaveLength(72);
    expect(ticks.filter((t) => t.long)).toHaveLength(12);
  });

  it('keeps the bracket arcs apart, with bright brackets at 9 and 3 o’clock', () => {
    const spans = arcIntervals(BRACKET_ARCS);
    for (let i = 1; i < spans.length; i += 1) expect(spans[i][0]).toBeGreaterThanOrEqual(spans[i - 1][1]);
    expect(spans[spans.length - 1][1] - 360).toBeLessThanOrEqual(spans[0][0]);
    const bright = BRACKET_ARCS.filter((a) => a.tone === 'bright').map((a) => (a.start + a.sweep / 2) % 360);
    expect(bright.sort((a, b) => a - b)).toEqual([0, 180]);
  });

  it('sweeps the arcs 120 ms apart and lands the whole mount by 1.5 s', () => {
    expect(arcDelay(0)).toBe(0);
    expect(arcDelay(3, 900)).toBe(1260);
    expect(sweepTotalMs(BRACKET_ARCS.length)).toBeLessThanOrEqual(1500);
    expect(RING_ROTATE_MS).toBe(60_000);
  });

  it('maps states to token tones and flags escalations only', () => {
    expect(ringStateColor('ready')).toBe(palette.gold);
    expect(ringStateColor('attention')).toBe(palette.warning);
    expect(ringStateColor('critical')).toBe(palette.danger);
    expect(ringStateColor('offline')).toBe(palette.gray);
    expect(isEscalation('ready', 'attention')).toBe(true);
    expect(isEscalation('attention', 'critical')).toBe(true);
    expect(isEscalation('critical', 'ready')).toBe(false);
    expect(isEscalation('ready', 'recording')).toBe(false);
  });

  it('places points clockwise from 3 o’clock', () => {
    const top = pointOnCircle(50, 10, -90);
    expect(top.x).toBeCloseTo(50, 5);
    expect(top.y).toBeCloseTo(40, 5);
  });
});

describe('GlowRing component', () => {
  const skia = () => jest.requireMock('@shopify/react-native-skia');
  const pathEnds = () =>
    skiaCalls(skia(), 'Path')
      .map((p) => p.end as SharedValue<number> | undefined)
      .filter((e): e is SharedValue<number> => typeof e === 'object' && e !== null);

  beforeEach(() => {
    jest.useFakeTimers();
    resetSkiaCalls(skia());
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

  it('sweeps every arc and the inner ring open from 0 to 1 in full motion', () => {
    render(
      <GlowRing mode="hero" motion="full" accessibilityLabel="System ready">
        <Text>READY</Text>
      </GlowRing>,
    );
    expect(screen.getByLabelText('System ready')).toBeTruthy();
    const ends = pathEnds();
    expect(ends.length).toBeGreaterThanOrEqual(BRACKET_ARCS.length + 1);
    expect(ends.every((e) => e.value === 0)).toBe(true);

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(ends.every((e) => Math.abs(e.value - 1) < 1e-6)).toBe(true);
  });

  it('renders the static final frame with reduced motion (D43 test switch)', () => {
    render(<GlowRing mode="mini" motion="reduced" />);
    const ends = pathEnds();
    expect(ends.length).toBeGreaterThan(0);
    expect(ends.every((e) => e.value === 1)).toBe(true);
  });
});
