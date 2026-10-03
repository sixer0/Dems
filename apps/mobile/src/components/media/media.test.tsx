// Asset renderers (04_mobile_specs §8): CameraFeed, Emblem and HeroBackdrop maths plus render smoke.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import { HeroUINativeProvider } from 'heroui-native';
import type { ReactNode } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { emblem } from '@dems/shared/brand';
import { palette } from '@dems/shared/tokens';
import { CameraFeed } from './camera-feed';
import {
  CAM2_PHASE_MS,
  KEN_BURNS_MAX,
  KEN_BURNS_MS,
  SCANLINE_BAND,
  SCANLINE_SWEEP_MS,
  cameraFraming,
  coverScale,
  formatFeedTimestamp,
  grainSeed,
  kenBurnsScale,
  scanlineY,
} from './camera-feed.math';
import { mixHex, withAlpha } from './color';
import { EMBLEM_SHARED, HERO_FOCUS, HERO_STILL, TOPO_XML } from './brand-assets';
import { Emblem, EmblemDraw } from './emblem';
import { EMBLEM_PLACEHOLDER, emblemArcDelay, emblemDrawTotalMs, type EmblemPathData } from './emblem-paths';
import { Image as ExpoImage } from 'expo-image';
import { SvgXml } from 'react-native-svg';
import { HeroBackdrop } from './hero-backdrop';
import { seededRandom, topoContours } from './hero-backdrop.math';
import { resetSkiaCalls, skiaCalls } from './testing/skia-mock';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('./testing/skia-mock')>('./testing/skia-mock').createSkiaMock(),
);

describe('paint helpers', () => {
  it('derives alpha and mixed variants from token colours', () => {
    expect(withAlpha(palette.gold, 1)).toBe(`${palette.gold}ff`);
    expect(withAlpha(palette.gold, 0)).toBe(`${palette.gold}00`);
    expect(withAlpha(`${palette.gold}80`, 0.5)).toBe(`${palette.gold}40`);
    expect(mixHex(palette.black, palette.foreground, 0)).toBe(palette.black.toLowerCase());
    expect(mixHex(palette.black, palette.foreground, 1)).toBe(palette.foreground.toLowerCase());
    // Midpoint, channel by channel (no colour literals in src/components, MA-22).
    const mid = mixHex(palette.black, palette.foreground, 0.5);
    const ch = (hex: string, i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
    for (let i = 0; i < 3; i += 1) {
      expect(ch(mid, i)).toBe(Math.round((ch(palette.black, i) + ch(palette.foreground, i)) / 2));
    }
  });
});

describe('CameraFeed maths', () => {
  it('frames Cam 2 as the mirrored reverse angle, 11 s out of phase', () => {
    expect(cameraFraming('CAM-1')).toMatchObject({ index: 1, mirror: false, phaseMs: 0 });
    expect(cameraFraming('CAM-2')).toMatchObject({ index: 2, mirror: true, phaseMs: CAM2_PHASE_MS });
  });

  it('pushes in 1.00 → 1.06 over 30 s and back', () => {
    expect(kenBurnsScale(0, 0)).toBeCloseTo(1, 6);
    expect(kenBurnsScale(KEN_BURNS_MS, 0)).toBeCloseTo(KEN_BURNS_MAX, 6);
    expect(kenBurnsScale(KEN_BURNS_MS * 2, 0)).toBeCloseTo(1, 6);
    expect(kenBurnsScale(0, CAM2_PHASE_MS)).toBeGreaterThan(1);
  });

  it('re-seeds grain at 25 fps and sweeps the scanline once every 6 s', () => {
    expect(grainSeed(0, 25)).toBe(0);
    expect(grainSeed(39, 25)).toBe(0);
    expect(grainSeed(40, 25)).toBe(1);
    expect(grainSeed(80, 12.5)).toBe(1);
    expect(scanlineY(0)).toBe(-SCANLINE_BAND);
    expect(scanlineY(SCANLINE_SWEEP_MS / 2)).toBeGreaterThan(0);
    expect(scanlineY(3000)).toBeLessThan(-SCANLINE_BAND); // parked between sweeps
  });

  it('covers any canvas with the 16:9 virtual feed', () => {
    expect(coverScale(320, 180)).toBe(1);
    expect(coverScale(640, 180)).toBe(2);
    expect(coverScale(320, 360)).toBe(2);
  });

  it('burns in a UTC+07:00 timestamp by arithmetic, across month and year ends', () => {
    expect(formatFeedTimestamp(Date.parse('2026-10-01T07:27:32Z'))).toBe('2026-10-01 14:27:32');
    expect(formatFeedTimestamp(Date.parse('2026-12-31T20:00:00Z'))).toBe('2027-01-01 03:00:00');
    expect(formatFeedTimestamp(Date.parse('2028-02-28T18:30:05Z'))).toBe('2028-02-29 01:30:05');
  });
});

describe('Emblem data and draw timing', () => {
  it('provides a double-stroke shield and six arcs in the SCR-03 shape', () => {
    expect(EMBLEM_PLACEHOLDER.source).toBe('placeholder');
    expect(EMBLEM_PLACEHOLDER.arcs).toHaveLength(6);
    const { outer, inner } = EMBLEM_PLACEHOLDER.shield;
    for (const d of [outer, inner ?? '', ...EMBLEM_PLACEHOLDER.arcs]) {
      expect(d.startsWith('M')).toBe(true);
    }
    expect(EMBLEM_PLACEHOLDER.stops.map((s) => s.offset)).toEqual([0, 0.5, 1]);
    expect(EMBLEM_PLACEHOLDER.stops[1].color).toBe(palette.gold);
  });

  it('accepts the shared brand module (step 35) through the documented step-72 adapter', () => {
    const shared: EmblemPathData = {
      viewBox: { width: emblem.size, height: emblem.size },
      shield: { outer: emblem.shield },
      arcs: emblem.arcs,
      stops: emblem.gradient.stops,
      strokeWidth: emblem.strokeWidth,
      source: 'shared',
    };
    const { gradient: sharedVector, ...sharedData } = EMBLEM_SHARED;
    expect(sharedData).toEqual(shared);
    expect(sharedVector).toEqual({ x1: 0, y1: 6, x2: 0, y2: 122 });
    render(
      <HeroUINativeProvider>
        <Emblem data={shared} size={48} accessibilityLabel="Shared emblem" />
        <EmblemDraw data={shared} size={96} motion="reduced" accessibilityLabel="Shared emblem draw" />
      </HeroUINativeProvider>,
    );
    expect(screen.getByLabelText('Shared emblem')).toBeTruthy();
    expect(screen.getByLabelText('Shared emblem draw')).toBeTruthy();
  });

  it('draws the shield, then the arcs 70 ms apart, within the 1.4 s boot budget', () => {
    expect(emblemArcDelay(0)).toBe(500);
    expect(emblemArcDelay(5)).toBe(850);
    expect(emblemDrawTotalMs()).toBeLessThanOrEqual(1400);
  });
});

describe('HeroBackdrop topographic placeholder', () => {
  it('is deterministic and stays near the 1000 × 1000 space', () => {
    const a = topoContours();
    expect(a).toEqual(topoContours());
    expect(a).toHaveLength(18);
    expect(topoContours({ seed: 7 })).not.toEqual(a);
    const numbers = a.join(' ').match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    expect(Math.min(...numbers)).toBeGreaterThan(-400);
    expect(Math.max(...numbers)).toBeLessThan(1400);
    const r = seededRandom(1);
    expect(r()).toBeGreaterThanOrEqual(0);
  });
});

describe('asset renderers render', () => {
  const wrap = (node: ReactNode) => <HeroUINativeProvider>{node}</HeroUINativeProvider>;
  const skia = () => jest.requireMock('@shopify/react-native-skia');

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

  it('CameraFeed (procedural) shows its label, fades to no signal, and keeps a 1 Hz timestamp when reduced', () => {
    const { rerender } = render(wrap(<CameraFeed cameraId="CAM-2" motion="reduced" source={null} testID="feed" />));
    expect(screen.getByLabelText('CAM 2 feed')).toBeTruthy();
    const texts = () => skiaCalls(skia(), 'Text');
    const stamp = texts().find((p) => typeof p.text === 'object')?.text as SharedValue<string>;
    expect(stamp.value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    rerender(wrap(<CameraFeed cameraId="CAM-2" motion="reduced" source={null} noSignal testID="feed" />));
    expect(screen.getByText('NO SIGNAL')).toBeTruthy();
    expect(screen.getByLabelText('CAM 2 feed, no signal')).toBeTruthy();
  });

  it('the procedural feed draws the W-05 still by default and the placeholder room on request', () => {
    const { rerender } = render(wrap(<CameraFeed cameraId="CAM-1" motion="full" source={null} />));
    const useImage = jest.spyOn(skia() as { useImage: (source: unknown) => null }, 'useImage');
    rerender(wrap(<CameraFeed cameraId="CAM-1" motion="full" source={null} grainFps={12.5} />));
    expect(useImage).toHaveBeenLastCalledWith(HERO_STILL);
    rerender(wrap(<CameraFeed cameraId="CAM-1" motion="full" source={null} image={null} />));
    expect(useImage).toHaveBeenLastCalledWith(null);
    useImage.mockRestore();
  });

  it('Emblem and EmblemDraw default to the shared brand paths with one user-space gradient', () => {
    render(wrap(<EmblemDraw size={96} motion="reduced" />));
    const paths = skiaCalls(skia(), 'Path').map((p) => p.path);
    expect(paths).toContain(emblem.shield);
    for (const arc of emblem.arcs) expect(paths).toContain(arc);
    const gradient = skiaCalls(skia(), 'LinearGradient')[0];
    expect(gradient).toMatchObject({ start: { x: 0, y: 6 }, end: { x: 0, y: 122 } });
  });

  it('Emblem and EmblemDraw render; the draw completes and notifies once', () => {
    const onDrawn = jest.fn();
    render(
      wrap(
        <>
          <Emblem size={32} />
          <EmblemDraw size={96} motion="full" onDrawn={onDrawn} testID="draw" />
        </>,
      ),
    );
    expect(screen.getAllByLabelText('DEMS emblem')).toHaveLength(2);
    act(() => {
      jest.advanceTimersByTime(emblemDrawTotalMs() + 50);
    });
    expect(onDrawn).toHaveBeenCalledTimes(1);
  });

  it('HeroBackdrop renders the W-05 still at D46 framing and the shared texture by default', () => {
    render(
      wrap(
        <HeroBackdrop motion="full" testID="hero">
          <></>
        </HeroBackdrop>,
      ),
    );
    expect(screen.getByTestId('hero')).toBeTruthy();
    const still = screen.UNSAFE_getByType(ExpoImage);
    expect(still.props).toMatchObject({ source: HERO_STILL, contentPosition: HERO_FOCUS, contentFit: 'cover' });
    const topo = screen.UNSAFE_getByType(SvgXml);
    expect(topo.props.xml).toBe(TOPO_XML);
    // The texture's brightest line (0.40 in the SVG) lands at the default 0.22 (04 §4.1 L1: 15–30 %).
    const layer = (topo.parent?.parent?.props.style as { opacity?: number }[]).find((st) => st.opacity !== undefined);
    expect(layer?.opacity).toBeCloseTo(0.55, 6);
  });

  it('HeroBackdrop renders its children over the placeholders on request', () => {
    render(
      wrap(
        <HeroBackdrop motion="full" source={null} topoXml={null} testID="hero">
          <></>
        </HeroBackdrop>,
      ),
    );
    expect(screen.getByTestId('hero')).toBeTruthy();
    expect(screen.UNSAFE_queryByType(ExpoImage)).toBeNull();
    expect(screen.UNSAFE_queryByType(SvgXml)).toBeNull();
  });
});
