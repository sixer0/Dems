/**
 * Emblem path-data contract, the step-71 PLACEHOLDER shape and the boot draw timing.
 *
 * Since step 72 the renderers default to the shared brand module from step 35
 * (`@dems/shared/brand`, SCR-03) through `EMBLEM_SHARED` in `brand-assets.ts`, one source for web
 * and mobile. The placeholder stays for tests and as an explicit fallback (`data={EMBLEM_PLACEHOLDER}`).
 *
 * Shape per 01_specs §14.10: a double-stroke shield plus six fingerprint arcs (ids `emblem-shield`,
 * `emblem-arc-1` … `emblem-arc-6`), vertical gradient light gold → gold → deep bronze. The
 * placeholder stops are derived from tokens, so no colour literal lives in `src/components` (MA-22).
 */
import { palette } from '@dems/shared/tokens';
import { mixHex } from './color';

export interface EmblemGradientStop {
  offset: number;
  color: string;
}

export interface EmblemPathData {
  /** User-space size of the paths. */
  viewBox: { width: number; height: number };
  /**
   * `emblem-shield`: the outer outline, plus the inner rim when it is a separate path (the shared
   * module from step 35 draws both rims as two subpaths of `outer`, so `inner` is absent there).
   */
  shield: { outer: string; inner?: string };
  /** Stroke widths in viewBox units (they scale with the rendered size). */
  strokeWidth: { shield: number; inner?: number; arc: number };
  /** `emblem-arc-1` … `emblem-arc-6`, in draw order (centre outward, then the crown). */
  arcs: readonly [string, string, string, string, string, string];
  stops: readonly EmblemGradientStop[];
  /**
   * Gradient vector in viewBox units (`userSpaceOnUse`), so every path shares one continuous ramp
   * (the shared module: y 6 → 122). Absent: top to bottom of the viewBox.
   */
  gradient?: { x1: number; y1: number; x2: number; y2: number };
  /** Where the data came from; the UI shows nothing different, the logs and tests do. */
  source: 'placeholder' | 'shared';
}

export const EMBLEM_PLACEHOLDER: EmblemPathData = {
  viewBox: { width: 64, height: 72 },
  shield: {
    outer: 'M32 3L58 12.5V33.5C58 51 46.5 62.5 32 69C17.5 62.5 6 51 6 33.5V12.5Z',
    inner: 'M32 8.6L52.8 16.2V33.6C52.8 48.2 43.4 57.9 32 63.3C20.6 57.9 11.2 48.2 11.2 33.6V16.2Z',
  },
  arcs: [
    'M29.2 55V41.5a2.8 2.8 0 0 1 5.6 0V55M32 45V51',
    'M25.6 52V41a6.4 6.4 0 0 1 12.8 0V51',
    'M21.8 50.5V40.8a10.2 10.2 0 0 1 20.4 0V48.5',
    'M18 47V40.5a14 14 0 0 1 28 0V45',
    'M20.5 26.5Q32 18.5 43.5 26.5',
    'M30.6 20.6a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0',
  ],
  stops: [
    { offset: 0, color: mixHex(palette.gold, palette.foreground, 0.5) },
    { offset: 0.5, color: palette.gold },
    { offset: 1, color: mixHex(palette.bronze, palette.black, 0.22) },
  ],
  strokeWidth: { shield: 2.6, inner: 1.1, arc: 1.9 },
  source: 'placeholder',
};

/** Boot draw timing (04_mobile_specs §7.2 M-APP-03: shield 500 ms, then 6 arcs 70 ms apart; ≤ 1,400 ms). */
export const EMBLEM_DRAW = {
  shield: { delay: 0, duration: 500 },
  inner: { delay: 80, duration: 460 },
  fill: { delay: 200, duration: 500 },
  arcs: { delay: 500, stagger: 70, duration: 380 },
  bloom: { up: 260, down: 700 },
} as const;

export function emblemArcDelay(index: number): number {
  return EMBLEM_DRAW.arcs.delay + index * EMBLEM_DRAW.arcs.stagger;
}

/** End of the stroke draw (the bloom follows). */
export function emblemDrawTotalMs(arcCount = 6): number {
  return emblemArcDelay(arcCount - 1) + EMBLEM_DRAW.arcs.duration;
}
