/**
 * Topographic texture generator (masterplan/01_specs.md rev 3 §14.10; research/04 §7; SCR-06;
 * blueprint step 35).
 *
 * Pipeline: seeded value noise (mulberry32 → lattice noise → fBm) perturbs two height fields;
 * marching squares traces their iso-lines; the segments are chained into polylines and simplified
 * (Ramer-Douglas-Peucker); the result is one lightweight SVG of 1 px bronze/gold contour strokes at
 * 15-40 % stroke opacity, with a soft peak glow and a bottom-up radial glow.
 *
 * Mood (Dashboard and Session Monitor sidebar foot, D1 (0-200, 575-810)): a lit mountain peak with
 * nested ridge contours below it, and faint horizon strata that the massif occludes.
 *   massif field   y - k·|x - ridge(y)| + noise   → nested "Λ" contours (index + intermediate lines)
 *   strata field   y - k'·|x - x'| + noise        → shallow horizon lines, kept only above the massif
 *
 * Writes the SAME SVG text to two committed files:
 *   apps/core-web/src/assets/brand/topo.svg   web: CSS background, `?raw` import or inline
 *   packages/shared/src/brand/topo.ts         `TOPO_SVG` for react-native-svg `SvgXml` and the web
 *
 * Deterministic: no Date, no Math.random, no Intl, fixed iteration order. The same seed gives
 * byte-identical files. The element set is limited to what react-native-svg 15 `SvgXml` renders:
 * svg, defs, radialGradient, stop, rect, g, path, circle, ellipse, one XML comment. No style, filter,
 * mask, image or text elements.
 *
 * Run: `npm run gen:topo -w @dems/shared`. Inside the Claude sandbox the tsx CLI fails with
 * listen EPERM; run `node --import tsx scripts/gen-topo.ts` from packages/shared instead (D49).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMBLEM_GRADIENT } from '../src/brand/emblem';
import { palette } from '../src/tokens/tokens';

// ---------------------------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------------------------

/** Default seed: the canonical demo seed (01_specs §14.7, AC-51), reused so every asset agrees. */
export const TOPO_DEFAULT_SEED = 20261001;

/** viewBox 0 0 240 280: the sidebar foot is about 200×235 at mockup scale (04 §7), same aspect. */
export const TOPO_WIDTH = 240;
export const TOPO_HEIGHT = 280;

/** Apex of the outermost massif contour, in viewBox units (about 40 % across, 18 % down). */
export const TOPO_PEAK = { x: 96, y: 50 } as const;

/** Stroke opacity range of every contour (01_specs §14.10: 15-40 % alpha). */
export const TOPO_STROKE_OPACITY = { min: 0.15, max: 0.4 } as const;

/** Every id in the SVG starts with this prefix (see `topoSvgWithIdPrefix`). */
export const TOPO_ID_PREFIX = 'topo-';

/** Colour ramp of the contour strokes, from the peak outward: light gold → gold → bronze → deep bronze. */
const LIGHT_GOLD = EMBLEM_GRADIENT.stops[0].color; // #FFE2A6
const DEEP_BRONZE = EMBLEM_GRADIENT.stops[2].color; // #C9802F

const MASSIF = {
  /** Flank slopes (rise over run): steep at the peak, easing toward the foot (mockup ≈ 0.8 → 0.6). */
  slopeLeft: { top: 0.9, foot: 0.62 },
  slopeRight: { top: 0.74, foot: 0.52 },
  /** Distance below the peak over which the slopes ease from `top` to `foot`. */
  slopeEase: 170,
  /** Lower apexes drift right, which reads as a lit ridge crease (the mockup's bright spine). */
  ridgeDrift: 0.1,
  /** Apex rounding in user units (smooth |u| = sqrt(u² + r²) - r). */
  apexRounding: 1.2,
  noise: { amplitude: 3.4, scale: 42, octaves: 3 },
  /** Noise fades in over this distance from the peak, so the lit apex stays crisp. */
  noiseRamp: 44,
  /** Index contours: first level at the peak; spacing grows downward (a hint of perspective). */
  firstSpacing: 25,
  spacingGrowth: 4,
  /** The spine joins the apexes of this many index contours, from the peak down. */
  spineContours: 3,
};

const STRATA = {
  centerX: 176,
  slope: 0.09,
  noise: { amplitude: 2.2, scale: 30, octaves: 3 },
  /** Horizon lines sit at shoulder height, below the peak (mockup y ≈ 18-45 %). */
  levels: { from: 60, to: 130, step: 10 },
  /** Keep strata only this far (in field units) above the massif silhouette. */
  occlusionMargin: 2,
};

const GRID_STEP = 2;
const GRID_MARGIN = 6;
/** Larger than the grid noise, so ridges read as faceted straight runs (the mockup's low-poly look). */
const SIMPLIFY_EPSILON = 0.45;
const MIN_POLYLINE_LENGTH = 8;

// ---------------------------------------------------------------------------------------------
// Seeded noise
// ---------------------------------------------------------------------------------------------

/** mulberry32: a tiny, well-mixed 32-bit PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Noise2D = (x: number, y: number) => number;

const LATTICE = 64;

/** Periodic value noise on a 64×64 lattice with quintic interpolation. Output in about [-1, 1]. */
export function createValueNoise(rand: () => number): Noise2D {
  const lattice = new Float64Array(LATTICE * LATTICE);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand() * 2 - 1;
  const wrap = (n: number): number => ((n % LATTICE) + LATTICE) % LATTICE;
  const at = (ix: number, iy: number): number => lattice[wrap(iy) * LATTICE + wrap(ix)] ?? 0;
  const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = fade(x - ix);
    const fy = fade(y - iy);
    const a = at(ix, iy);
    const b = at(ix + 1, iy);
    const c = at(ix, iy + 1);
    const d = at(ix + 1, iy + 1);
    const top = a + (b - a) * fx;
    const bottom = c + (d - c) * fx;
    return top + (bottom - top) * fy;
  };
}

/** Fractal sum of octaves (gain 0.5, lacunarity 2), normalised to about [-1, 1]. */
function fbm(noise: Noise2D, x: number, y: number, octaves: number): number {
  let sum = 0;
  let amplitude = 1;
  let frequency = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * noise(x * frequency + o * 17.31, y * frequency + o * 31.77);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------------------------
// Height fields
// ---------------------------------------------------------------------------------------------

type Field = (x: number, y: number) => number;

function smoothAbs(u: number, r: number): number {
  return Math.sqrt(u * u + r * r) - r;
}

function massifField(noise: Noise2D): Field {
  const m = MASSIF;
  return (x, y) => {
    const ridgeX = TOPO_PEAK.x + m.ridgeDrift * (y - TOPO_PEAK.y);
    const u = x - ridgeX;
    // Slope eases with depth; apart from the small noise term f keeps increasing in y, so the
    // contours stay single-valued "Λ" lines instead of folding back.
    const ease = Math.min(1, Math.max(0, (y - TOPO_PEAK.y) / m.slopeEase));
    const side = u < 0 ? m.slopeLeft : m.slopeRight;
    const slope = side.top + (side.foot - side.top) * ease;
    const dx = x - TOPO_PEAK.x;
    const dy = y - TOPO_PEAK.y;
    const ramp = Math.min(1, Math.sqrt(dx * dx + dy * dy) / m.noiseRamp);
    const n = m.noise.amplitude * ramp * fbm(noise, x / m.noise.scale, y / m.noise.scale, m.noise.octaves);
    return y - slope * smoothAbs(u, m.apexRounding) + n;
  };
}

function strataField(noise: Noise2D): Field {
  const s = STRATA;
  return (x, y) =>
    y - s.slope * Math.abs(x - s.centerX) + s.noise.amplitude * fbm(noise, x / s.noise.scale, y / s.noise.scale, s.noise.octaves);
}

/** Index levels from the peak down, with growing spacing; intermediate levels half-way between. */
function massifLevels(): { index: number[]; intermediate: number[] } {
  const index: number[] = [];
  let level: number = TOPO_PEAK.y;
  let spacing = MASSIF.firstSpacing;
  while (level < TOPO_HEIGHT) {
    index.push(level);
    level += spacing;
    spacing += MASSIF.spacingGrowth;
  }
  const intermediate: number[] = [];
  for (let i = 0; i + 1 < index.length; i++) intermediate.push(((index[i] ?? 0) + (index[i + 1] ?? 0)) / 2);
  return { index, intermediate };
}

function strataLevels(): number[] {
  const out: number[] = [];
  for (let level = STRATA.levels.from; level <= STRATA.levels.to; level += STRATA.levels.step) out.push(level);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Marching squares
// ---------------------------------------------------------------------------------------------

type Point = readonly [number, number];

interface Grid {
  readonly x0: number;
  readonly y0: number;
  readonly step: number;
  readonly nx: number;
  readonly ny: number;
  readonly values: Float64Array;
}

function sampleGrid(field: Field): Grid {
  const x0 = -GRID_MARGIN;
  const y0 = -GRID_MARGIN;
  const nx = Math.round((TOPO_WIDTH + 2 * GRID_MARGIN) / GRID_STEP) + 1;
  const ny = Math.round((TOPO_HEIGHT + 2 * GRID_MARGIN) / GRID_STEP) + 1;
  const values = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) values[j * nx + i] = field(x0 + i * GRID_STEP, y0 + j * GRID_STEP);
  }
  return { x0, y0, step: GRID_STEP, nx, ny, values };
}

interface Segment {
  readonly edgeA: number;
  readonly edgeB: number;
  readonly a: Point;
  readonly b: Point;
}

/** Edge ids: horizontal edge from (i, j) to (i+1, j) is even, vertical edge (i, j)-(i, j+1) is odd. */
const hEdge = (grid: Grid, i: number, j: number): number => (j * grid.nx + i) * 2;
const vEdge = (grid: Grid, i: number, j: number): number => (j * grid.nx + i) * 2 + 1;

/**
 * Iso-line segments of `grid` at `level`. `keep` (optional) filters segments by midpoint; the
 * chaining step then yields open pieces where segments were dropped (used for occlusion).
 */
function contourSegments(grid: Grid, level: number, keep?: (x: number, y: number) => boolean): Segment[] {
  const { nx, ny, values, step, x0, y0 } = grid;
  const v = (i: number, j: number): number => values[j * nx + i] ?? 0;
  const px = (i: number): number => x0 + i * step;
  const py = (j: number): number => y0 + j * step;
  const lerp = (a: number, b: number): number => (level - a) / (b - a);
  const out: Segment[] = [];

  for (let j = 0; j + 1 < ny; j++) {
    for (let i = 0; i + 1 < nx; i++) {
      const tl = v(i, j);
      const tr = v(i + 1, j);
      const br = v(i + 1, j + 1);
      const bl = v(i, j + 1);
      const code = (tl >= level ? 8 : 0) | (tr >= level ? 4 : 0) | (br >= level ? 2 : 0) | (bl >= level ? 1 : 0);
      if (code === 0 || code === 15) continue;

      // Edge crossing points (computed lazily; only crossed edges are ever requested).
      const top = (): Point => [px(i) + lerp(tl, tr) * step, py(j)];
      const bottom = (): Point => [px(i) + lerp(bl, br) * step, py(j + 1)];
      const left = (): Point => [px(i), py(j) + lerp(tl, bl) * step];
      const right = (): Point => [px(i + 1), py(j) + lerp(tr, br) * step];
      const T = hEdge(grid, i, j);
      const B = hEdge(grid, i, j + 1);
      const L = vEdge(grid, i, j);
      const R = vEdge(grid, i + 1, j);

      const push = (edgeA: number, a: Point, edgeB: number, b: Point): void => {
        if (keep && !keep((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) return;
        out.push({ edgeA, a, edgeB, b });
      };

      const centerAbove = (tl + tr + br + bl) / 4 >= level;
      switch (code) {
        case 1:
        case 14:
          push(L, left(), B, bottom());
          break;
        case 2:
        case 13:
          push(B, bottom(), R, right());
          break;
        case 3:
        case 12:
          push(L, left(), R, right());
          break;
        case 4:
        case 11:
          push(T, top(), R, right());
          break;
        case 6:
        case 9:
          push(T, top(), B, bottom());
          break;
        case 7:
        case 8:
          push(L, left(), T, top());
          break;
        case 5: // tr and bl above (saddle)
          if (centerAbove) {
            push(L, left(), T, top());
            push(B, bottom(), R, right());
          } else {
            push(L, left(), B, bottom());
            push(T, top(), R, right());
          }
          break;
        case 10: // tl and br above (saddle)
          if (centerAbove) {
            push(T, top(), R, right());
            push(L, left(), B, bottom());
          } else {
            push(L, left(), T, top());
            push(B, bottom(), R, right());
          }
          break;
        default:
          break;
      }
    }
  }
  return out;
}

/** Joins segments that share a grid edge into polylines: open chains first, then closed loops. */
function chainSegments(segments: readonly Segment[]): Point[][] {
  const byEdge = new Map<number, number[]>();
  const link = (edge: number, index: number): void => {
    const list = byEdge.get(edge);
    if (list) list.push(index);
    else byEdge.set(edge, [index]);
  };
  segments.forEach((s, index) => {
    link(s.edgeA, index);
    link(s.edgeB, index);
  });
  const used = new Uint8Array(segments.length);
  const degree = (edge: number): number => byEdge.get(edge)?.length ?? 0;

  const walk = (start: number, fromEdge: number): Point[] => {
    const first = segments[start];
    if (!first) return [];
    const points: Point[] = [first.edgeA === fromEdge ? first.a : first.b];
    let index = start;
    let edge = fromEdge;
    for (;;) {
      used[index] = 1;
      const s = segments[index];
      if (!s) break;
      const forward = s.edgeA === edge;
      const nextEdge = forward ? s.edgeB : s.edgeA;
      points.push(forward ? s.b : s.a);
      const next = (byEdge.get(nextEdge) ?? []).find((k) => used[k] === 0);
      if (next === undefined) break;
      index = next;
      edge = nextEdge;
    }
    return points;
  };

  const lines: Point[][] = [];
  segments.forEach((s, index) => {
    if (used[index]) return;
    if (degree(s.edgeA) === 1) lines.push(walk(index, s.edgeA));
    else if (degree(s.edgeB) === 1) lines.push(walk(index, s.edgeB));
  });
  segments.forEach((s, index) => {
    if (!used[index]) lines.push(walk(index, s.edgeA));
  });
  return lines;
}

// ---------------------------------------------------------------------------------------------
// Simplification and serialisation
// ---------------------------------------------------------------------------------------------

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Ramer-Douglas-Peucker, iterative. Keeps both end points. */
function simplify(points: readonly Point[], epsilon: number): Point[] {
  if (points.length < 3) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const range = stack.pop();
    if (!range) break;
    const [first, last] = range;
    const a = points[first];
    const b = points[last];
    if (!a || !b) continue;
    let maxDistance = 0;
    let maxIndex = -1;
    for (let k = first + 1; k < last; k++) {
      const p = points[k];
      if (!p) continue;
      const d = distanceToSegment(p, a, b);
      if (d > maxDistance) {
        maxDistance = d;
        maxIndex = k;
      }
    }
    if (maxIndex !== -1 && maxDistance > epsilon) {
      keep[maxIndex] = 1;
      stack.push([first, maxIndex], [maxIndex, last]);
    }
  }
  return points.filter((_, k) => keep[k] === 1);
}

function polylineLength(points: readonly Point[]): number {
  let length = 0;
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1];
    const b = points[k];
    if (a && b) length += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return length;
}

/** One decimal, no trailing ".0", no "-0". Deterministic (toFixed is exact-rounding in V8). */
function num(n: number): string {
  let s = n.toFixed(1);
  if (s.endsWith('.0')) s = s.slice(0, -2);
  return s === '-0' ? '0' : s;
}

function pathData(lines: readonly (readonly Point[])[]): string {
  const parts: string[] = [];
  for (const line of lines) {
    let previous = '';
    let d = '';
    for (const [x, y] of line) {
      const xy = `${num(x)} ${num(y)}`;
      if (xy === previous) continue;
      d += (d === '' ? 'M' : 'L') + xy;
      previous = xy;
    }
    if (d.includes('L')) parts.push(d);
  }
  return parts.join('');
}

function traceLevel(grid: Grid, level: number, keep?: (x: number, y: number) => boolean): Point[][] {
  return chainSegments(contourSegments(grid, level, keep))
    .map((line) => simplify(line, SIMPLIFY_EPSILON))
    .filter((line) => line.length >= 2 && polylineLength(line) >= MIN_POLYLINE_LENGTH);
}

/** Highest point (smallest y) of a traced level: the apex of a "Λ" contour. */
function apexOf(lines: readonly (readonly Point[])[]): Point | null {
  let best: Point | null = null;
  for (const line of lines) {
    for (const p of line) {
      if (best === null || p[1] < best[1]) best = p;
    }
  }
  return best;
}

function opacity(value: number): string {
  const clamped = Math.min(TOPO_STROKE_OPACITY.max, Math.max(TOPO_STROKE_OPACITY.min, value));
  return String(Math.round(clamped * 100) / 100);
}

/** Linear ramp from `from` (k = 0) to `to` (k = count - 1). */
function ramp(from: number, to: number, k: number, count: number): number {
  return count <= 1 ? from : from + ((to - from) * k) / (count - 1);
}

// ---------------------------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------------------------

export interface TopoOptions {
  /** PRNG seed. Default `TOPO_DEFAULT_SEED`. */
  readonly seed?: number;
}

export interface TopoResult {
  readonly seed: number;
  readonly svg: string;
  /** Number of line `<path>` elements: strata, intermediate and index contours, plus the ridge spine. */
  readonly contourCount: number;
}

export function generateTopo(options: TopoOptions = {}): TopoResult {
  const seed = options.seed ?? TOPO_DEFAULT_SEED;
  const rand = mulberry32(seed);
  const massif = massifField(createValueNoise(rand));
  const strata = strataField(createValueNoise(rand));
  const massifGrid = sampleGrid(massif);
  const strataGrid = sampleGrid(strata);
  const { index, intermediate } = massifLevels();
  const strataSet = strataLevels();

  const contour = (lines: readonly (readonly Point[])[], alpha: number): string | null => {
    const d = pathData(lines);
    return d === '' ? null : `<path vector-effect="non-scaling-stroke" stroke-opacity="${opacity(alpha)}" d="${d}"/>`;
  };

  // Painter's order: horizon strata (back), intermediate contours, index contours, spine (front).
  const visibleAboveMassif = (x: number, y: number): boolean => massif(x, y) < TOPO_PEAK.y - STRATA.occlusionMargin;
  const strataPaths = strataSet.map((level, k) =>
    contour(traceLevel(strataGrid, level, visibleAboveMassif), ramp(0.15, 0.2, k, strataSet.length)),
  );
  const intermediatePaths = intermediate.map((level, k) =>
    contour(traceLevel(massifGrid, level), ramp(0.18, 0.15, k, intermediate.length)),
  );
  const indexLines = index.map((level) => traceLevel(massifGrid, level));
  const indexPaths = indexLines.map((lines, k) => contour(lines, ramp(0.4, 0.22, k, indexLines.length)));

  // The lit ridge crease: a polyline through the apexes of the first index contours.
  const spinePoints = indexLines
    .slice(0, MASSIF.spineContours)
    .map(apexOf)
    .filter((p): p is Point => p !== null);
  const spinePath = spinePoints.length >= 2 ? contour([spinePoints], TOPO_STROKE_OPACITY.max) : null;

  const contours = [...strataPaths, ...intermediatePaths, ...indexPaths, spinePath].filter(
    (p): p is string => p !== null,
  );

  const { x: px, y: py } = TOPO_PEAK;
  const comment =
    `<!-- GENERATED by packages/shared/scripts/gen-topo.ts (seed ${seed}). Do not edit: run npm run gen:topo -w @dems/shared. ` +
    `DEMS topographic texture, original work (01_specs §14.10). -->`;
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TOPO_WIDTH} ${TOPO_HEIGHT}" width="${TOPO_WIDTH}" height="${TOPO_HEIGHT}" fill="none">`,
    comment,
    '<defs>',
    `<radialGradient id="topo-stroke" gradientUnits="userSpaceOnUse" cx="${px}" cy="${py}" r="250">` +
      `<stop offset="0" stop-color="${LIGHT_GOLD}"/><stop offset="0.2" stop-color="${palette.gold}"/>` +
      `<stop offset="0.6" stop-color="${palette.bronze}"/><stop offset="1" stop-color="${DEEP_BRONZE}"/></radialGradient>`,
    `<radialGradient id="topo-rise" cx="0.5" cy="1" r="0.85">` +
      `<stop offset="0" stop-color="${palette.bronze}" stop-opacity="0.1"/><stop offset="1" stop-color="${palette.bronze}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="topo-peak">` +
      `<stop offset="0" stop-color="${LIGHT_GOLD}" stop-opacity="0.7"/><stop offset="0.1" stop-color="${palette.gold}" stop-opacity="0.45"/>` +
      `<stop offset="0.4" stop-color="${palette.bronze}" stop-opacity="0.12"/><stop offset="1" stop-color="${palette.bronze}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="topo-halo">` +
      `<stop offset="0" stop-color="${palette.bronze}" stop-opacity="0.12"/><stop offset="1" stop-color="${palette.bronze}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="topo-flare">` +
      `<stop offset="0" stop-color="${LIGHT_GOLD}" stop-opacity="0.55"/><stop offset="1" stop-color="${palette.gold}" stop-opacity="0"/></radialGradient>`,
    '</defs>',
    `<rect width="${TOPO_WIDTH}" height="${TOPO_HEIGHT}" fill="url(#topo-rise)"/>`,
    // Halo stays inside the viewBox (top at y ≈ 16) so no clipped edge shows at the texture's top.
    `<ellipse cx="${px}" cy="${py + 22}" rx="96" ry="56" fill="url(#topo-halo)"/>`,
    `<g stroke="url(#topo-stroke)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">`,
    ...contours,
    '</g>',
    `<circle cx="${px}" cy="${py}" r="36" fill="url(#topo-peak)"/>`,
    `<ellipse cx="${px}" cy="${py}" rx="22" ry="1.2" fill="url(#topo-flare)"/>`,
    `<ellipse cx="${px}" cy="${py}" rx="1" ry="12" fill="url(#topo-flare)"/>`,
    '</svg>',
    '',
  ];
  const svg = lines.join('\n');
  assertEmbeddable(svg);
  return { seed, svg, contourCount: contours.length };
}

/** The SVG is embedded verbatim in a TS template literal and parsed by react-native-svg. */
function assertEmbeddable(svg: string): void {
  if (/[`\\]|\$\{/.test(svg)) throw new Error('gen-topo: SVG contains a backtick, backslash or ${');
  const comment = /<!--([\s\S]*?)-->/.exec(svg)?.[1] ?? '';
  if (comment.includes('--')) throw new Error('gen-topo: XML comment contains "--"');
}

// ---------------------------------------------------------------------------------------------
// TS module
// ---------------------------------------------------------------------------------------------

export const TOPO_MODULE_HEADER =
  '// GENERATED by packages/shared/scripts/gen-topo.ts. Do not edit: run `npm run gen:topo -w @dems/shared`.';

export function renderTopoModule(result: TopoResult): string {
  return `${TOPO_MODULE_HEADER}
/**
 * The DEMS topographic brand texture (SCR-06; 01_specs rev 3 §14.10; research/04 §7): 1 px
 * bronze/gold contour lines at ${Math.round(TOPO_STROKE_OPACITY.min * 100)}-${Math.round(TOPO_STROKE_OPACITY.max * 100)} % stroke opacity, a peak glow and a bottom-up glow.
 * \`TOPO_SVG\` is byte-identical to apps/core-web/src/assets/brand/topo.svg.
 *
 * Use:
 *   web     CSS \`background-image: url(topo.svg)\` (import the asset URL), or inline markup.
 *   mobile  react-native-svg \`<SvgXml xml={TOPO_SVG} width=… height=… />\`.
 * Contours use \`vector-effect="non-scaling-stroke"\`, so they stay 1 px at any rendered size.
 *
 * Motion (03_motion_spec M-SH-07): the contours already carry their own opacity. For the
 * "contour opacity 0.25 <-> 0.4" shimmer, animate the layer opacity 0.625 <-> 1 (the brightest
 * contour then spans 0.25 <-> 0.4) together with the translateY 0 <-> -12 px drift.
 */

/** PRNG seed of the committed texture. */
export const TOPO_SEED = ${result.seed};

export const TOPO_VIEWBOX = '0 0 ${TOPO_WIDTH} ${TOPO_HEIGHT}';
export const TOPO_WIDTH = ${TOPO_WIDTH};
export const TOPO_HEIGHT = ${TOPO_HEIGHT};

/** Apex of the lit peak in viewBox units, for aligning any extra flare or glow. */
export const TOPO_PEAK = { x: ${TOPO_PEAK.x}, y: ${TOPO_PEAK.y} } as const;

/** Stroke-opacity range of the contour lines. */
export const TOPO_STROKE_OPACITY = { min: ${TOPO_STROKE_OPACITY.min}, max: ${TOPO_STROKE_OPACITY.max} } as const;

/** Number of line paths in \`TOPO_SVG\` (contours plus the ridge spine). */
export const TOPO_CONTOUR_COUNT = ${result.contourCount};

/** Every id (and \`url(#…)\` reference) in \`TOPO_SVG\` starts with this prefix. */
export const TOPO_ID_PREFIX = '${TOPO_ID_PREFIX}';

export const TOPO_SVG = \`${result.svg}\`;

/**
 * \`TOPO_SVG\` with every id and \`url(#…)\` reference prefixed, for a second inline copy in one
 * HTML document (ids must be unique per document). Characters outside [A-Za-z0-9_-] become "_".
 * Not needed for CSS backgrounds, <img> or react-native-svg, which scope ids per image.
 */
export function topoSvgWithIdPrefix(prefix: string): string {
  const token = prefix.replace(/[^A-Za-z0-9_-]/g, '_');
  if (token.length === 0) return TOPO_SVG;
  return TOPO_SVG.replaceAll('id="${TOPO_ID_PREFIX}', \`id="\${token}-${TOPO_ID_PREFIX}\`).replaceAll(
    'url(#${TOPO_ID_PREFIX}',
    \`url(#\${token}-${TOPO_ID_PREFIX}\`,
  );
}
`;
}

// ---------------------------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------------------------

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const TOPO_SVG_PATH = resolve(PACKAGE_DIR, '..', '..', 'apps', 'core-web', 'src', 'assets', 'brand', 'topo.svg');
export const TOPO_MODULE_PATH = resolve(PACKAGE_DIR, 'src', 'brand', 'topo.ts');

function main(): void {
  const result = generateTopo();
  const moduleText = renderTopoModule(result);
  mkdirSync(dirname(TOPO_SVG_PATH), { recursive: true });
  mkdirSync(dirname(TOPO_MODULE_PATH), { recursive: true });
  writeFileSync(TOPO_SVG_PATH, result.svg);
  writeFileSync(TOPO_MODULE_PATH, moduleText);
  console.log(`wrote ${TOPO_SVG_PATH} (${result.svg.length} bytes, ${result.contourCount} contours, seed ${result.seed})`);
  console.log(`wrote ${TOPO_MODULE_PATH} (${moduleText.length} bytes)`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
