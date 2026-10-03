/**
 * Maths of the Login ambient accents (04_mobile_specs §7.3 Login, §7.4 M-C-23; 03M M-C-23):
 * - gold dust: at most 24 Skia points drifting up through the backdrop, one seamless loop;
 * - border beam: one lap of a light segment around the auth card (6 s), then gone.
 *
 * Pure and deterministic (seeded), so the dust looks the same on every launch and in tests. The
 * position functions are worklets; per D58 they take no default parameters.
 */

/** 03M M-C-23 Particles `quantity 24` (the mobile cap, §7.3 "≤ 24"). */
export const DUST_COUNT = 24;
/** One full drift loop. Integer speeds and sway cycles keep the loop seamless at the wrap. */
export const DUST_PERIOD_MS = 24_000;
/** Three depth layers: point size (dp) and alpha (≈ 30 % effective alpha of the gold token, 03M M-C-23). */
export const DUST_LAYERS = [
  { size: 1.6, alpha: 0.22 },
  { size: 2.4, alpha: 0.3 },
  { size: 3.4, alpha: 0.38 },
] as const;

export interface DustSeed {
  /** Start position as a fraction of the canvas (0–1). */
  readonly x: number;
  readonly y: number;
  /** Canvas heights travelled per loop: 1 or 2 (integers keep the loop seamless). */
  readonly speed: number;
  /** Horizontal sway amplitude as a fraction of the width. */
  readonly sway: number;
  /** Sway cycles per loop: 1, 2 or 3. */
  readonly cycles: number;
  readonly phase: number;
  readonly layer: 0 | 1 | 2;
}

/** Park–Miller LCG in [0, 1), deterministic across platforms. */
function lcg(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/** The dust field: `count` seeds (clamped to 0–24) from a fixed seed. */
export function dustSeeds(count: number, seed: number): DustSeed[] {
  const random = lcg(seed);
  const n = Math.max(0, Math.min(DUST_COUNT, Math.floor(count)));
  const seeds: DustSeed[] = [];
  for (let i = 0; i < n; i += 1) {
    seeds.push({
      x: random(),
      y: random(),
      speed: random() < 0.7 ? 1 : 2,
      sway: 0.01 + random() * 0.03,
      cycles: 1 + Math.floor(random() * 3),
      phase: random(),
      layer: (i % 3) as 0 | 1 | 2,
    });
  }
  return seeds;
}

function frac(value: number): number {
  'worklet';
  return value - Math.floor(value);
}

/** Position of one particle at loop time `t` (0–1) on a `width` × `height` canvas. */
export function dustPosition(seed: DustSeed, t: number, width: number, height: number): { x: number; y: number } {
  'worklet';
  const angle = 2 * Math.PI * (t * seed.cycles + seed.phase);
  return {
    x: (seed.x + seed.sway * Math.sin(angle)) * width,
    y: frac(seed.y - t * seed.speed) * height,
  };
}

/** One border-beam lap (03M M-C-23 BorderBeam `duration 6`, one lap). */
export const BEAM_LAP_MS = 6_000;
/** Length of the light segment as a fraction of the perimeter (03M `size 220` on a ~1,700 px card). */
export const BEAM_LENGTH = 0.13;

/**
 * The visible part(s) of the beam at lap progress `p` (0–1) as trim windows on the card outline.
 * Past the end of the path the segment continues from the start (two windows), so it never jumps.
 */
export function beamWindows(p: number): { head: [number, number]; tail: [number, number] } {
  'worklet';
  const start = Math.max(0, Math.min(1, p));
  const end = start + BEAM_LENGTH;
  if (end <= 1) return { head: [start, end], tail: [0, 0] };
  return { head: [start, 1], tail: [0, end - 1] };
}

/** Beam opacity: fades in over the first 6 % of the lap and out over the last 10 %. */
export function beamOpacity(p: number): number {
  'worklet';
  if (p <= 0 || p >= 1) return 0;
  return Math.min(1, p / 0.06, (1 - p) / 0.1);
}
