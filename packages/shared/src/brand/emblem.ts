/**
 * The DEMS brand emblem as data (SCR-03; masterplan/01_specs.md rev 3 §14.10; blueprint step 35).
 *
 * Source of truth for the geometry is the hand-authored `apps/core-web/src/assets/brand/emblem.svg`
 * (step 28). This module mirrors it path for path so web and mobile render one emblem:
 *   - web: an inline React `<svg>` built from these strings, or the asset file itself;
 *   - mobile: react-native-svg `Svg`/`Path`/`LinearGradient`, or a Skia `Path` for the draw-on.
 * `test/brand-sync.test.ts` fails on any drift between this file and emblem.svg.
 *
 * Framework-free and platform-neutral: plain strings and numbers, no DOM, no React.
 *
 * Geometry (viewBox 0 0 128 128, user units):
 *   shield  one path with two closed subpaths (outer rim + inner rim = the "double stroke").
 *           Both subpaths start at the top peak (64, y), so a pathLength draw runs from the top.
 *   arcs    six fingerprint ridges in scan order: arcs[0] is the core (id emblem-arc-1),
 *           arcs[5] is the peaked "roof" ridge (id emblem-arc-6). The draw-on and verification
 *           scans (03_motion_spec M-APP-03, M-PG-LOGIN, M-C-22) run from arcs[0] outward.
 * Stroke widths are part of the look (D48): shield 3.2, arcs 2.6, round caps and joins.
 * Colour is one vertical gradient in user space shared by all seven strokes. Glow is not part of
 * the emblem: web uses CSS `drop-shadow`, mobile a Skia blur or shadow layer.
 *
 * Gradient ids (D48, DEC-28-3): when two emblems are inlined in one document (the Login -> top
 * bar "emblem flight" shows two), each instance needs its own gradient id. Use
 * `emblemGradientId(useId())` or pass `gradientId` to `emblemSvg()`.
 */
import { palette } from '../tokens/tokens';

/** SVG viewBox of the emblem, in user units. */
export const EMBLEM_VIEWBOX = '0 0 128 128';

/** Intrinsic size (user units = CSS px at 1:1) of the viewBox square. */
export const EMBLEM_SIZE = 128;

/** `emblem-shield`: outer rim and inner rim as two closed subpaths of one path. */
export const EMBLEM_SHIELD_PATH =
  'M64 6Q41 16.5 14 19.5V58C14 88 37 109.5 64 121.5C91 109.5 114 88 114 58V19.5Q87 16.5 64 6ZM64 11.6Q43.5 21 19 23.9V58C19 85 39.5 104.3 64 115.9C88.5 104.3 109 85 109 58V23.9Q84.5 21 64 11.6Z';

/** `emblem-arc-1` … `emblem-arc-6`, in scan order (core outward to the roof ridge). */
export const EMBLEM_ARC_PATHS = [
  'M61.4 94V64A2.6 2.6 0 0 1 66.6 64V66',
  'M56.4 84V64A7.6 7.6 0 0 1 71.6 64A7.6 7.6 0 0 1 69.82 68.89',
  'M51.4 90V64A12.6 12.6 0 0 1 76.6 64A12.6 12.6 0 0 1 72.1 73.65',
  'M46.4 82V64A17.6 17.6 0 0 1 81.6 64A17.6 17.6 0 0 1 74.09 78.42',
  'M41.4 88V64A22.6 22.6 0 0 1 86.6 64A22.6 22.6 0 0 1 71.73 85.24',
  'M37 51.5C37 48 39.4 46.6 43.5 46C52 44.8 57.6 41.8 64 35.8C70.4 41.8 76 44.8 84.5 46C88.6 46.6 91 48 91 51.5',
] as const;

/** Stroke widths in user units at viewBox 128 (D48, DEC-28-4). Scale with the rendered size. */
export const EMBLEM_STROKE_WIDTH = { shield: 3.2, arc: 2.6 } as const;

export const EMBLEM_STROKE_LINECAP = 'round';
export const EMBLEM_STROKE_LINEJOIN = 'round';

/** Animation-target ids used by the asset file (AC-68: seven ids). */
export const EMBLEM_PATH_IDS = {
  shield: 'emblem-shield',
  arcs: ['emblem-arc-1', 'emblem-arc-2', 'emblem-arc-3', 'emblem-arc-4', 'emblem-arc-5', 'emblem-arc-6'],
} as const;

/** Gradient id used by the asset file. Inline copies should use `emblemGradientId()` instead. */
export const EMBLEM_GRADIENT_ID = 'emblem-gradient';

export interface EmblemGradientStop {
  /** 0 … 1 along the gradient vector. */
  readonly offset: number;
  /** sRGB hex. */
  readonly color: string;
}

/**
 * Vertical gradient in user space (y 6 → 122), shared by every stroke.
 * Stops: #FFE2A6 → #FFC86B (token `palette.gold`) → #C9802F. The two outer stops are emblem-only
 * literals per 01_specs §14.10 (DEC-28-5); they are not palette tokens.
 */
export const EMBLEM_GRADIENT = {
  gradientUnits: 'userSpaceOnUse',
  x1: 0,
  y1: 6,
  x2: 0,
  y2: 122,
  stops: [
    { offset: 0, color: '#FFE2A6' },
    { offset: 0.5, color: palette.gold },
    { offset: 1, color: '#C9802F' },
  ],
} as const satisfies {
  gradientUnits: 'userSpaceOnUse';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: readonly EmblemGradientStop[];
};

/** Everything a renderer needs, in one object. */
export const emblem = {
  viewBox: EMBLEM_VIEWBOX,
  size: EMBLEM_SIZE,
  shield: EMBLEM_SHIELD_PATH,
  arcs: EMBLEM_ARC_PATHS,
  strokeWidth: EMBLEM_STROKE_WIDTH,
  strokeLinecap: EMBLEM_STROKE_LINECAP,
  strokeLinejoin: EMBLEM_STROKE_LINEJOIN,
  gradient: EMBLEM_GRADIENT,
  ids: EMBLEM_PATH_IDS,
} as const;

export type Emblem = typeof emblem;

/** Characters outside this set are replaced so the result is safe in `id="…"` and `url(#…)`. */
const UNSAFE_ID_CHARS = /[^A-Za-z0-9_-]/g;

/**
 * A per-instance gradient id, e.g. `emblemGradientId(useId())`.
 * React ids such as `:r1:`, `«r1»` or `_r_1_` become `emblem-gradient-_r1_`-style tokens;
 * distinct keys from one React version stay distinct.
 */
export function emblemGradientId(instanceKey: string): string {
  const token = instanceKey.replace(UNSAFE_ID_CHARS, '_');
  return token.length > 0 ? `${EMBLEM_GRADIENT_ID}-${token}` : EMBLEM_GRADIENT_ID;
}

export interface EmblemSvgOptions {
  /**
   * Gradient id for this instance. Default `emblem-gradient` (the asset file's id). Any character
   * outside `[A-Za-z0-9_-]` is replaced with `_`.
   */
  readonly gradientId?: string;
  /**
   * Emit the seven animation ids (`emblem-shield`, `emblem-arc-1..6`). Default `true`.
   * Set `false` for a second inline copy in the same document, so ids stay unique.
   */
  readonly pathIds?: boolean;
  /** Width and height attributes in px. Default 128 (the viewBox size). */
  readonly size?: number;
}

/**
 * The emblem as standalone SVG markup, built from this module's data: for react-native-svg
 * `SvgXml`, a CSS `url("data:image/svg+xml,…")`, or tests. No comments, no glow.
 */
export function emblemSvg(options: EmblemSvgOptions = {}): string {
  const gradientId = (options.gradientId ?? EMBLEM_GRADIENT_ID).replace(UNSAFE_ID_CHARS, '_') || EMBLEM_GRADIENT_ID;
  const withIds = options.pathIds ?? true;
  const size = options.size !== undefined && Number.isFinite(options.size) && options.size > 0 ? options.size : EMBLEM_SIZE;
  const idAttr = (id: string): string => (withIds ? ` id="${id}"` : '');
  const g = EMBLEM_GRADIENT;
  const stops = g.stops.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join('');
  const arcs = EMBLEM_ARC_PATHS.map(
    (d, i) => `<path${idAttr(EMBLEM_PATH_IDS.arcs[i] ?? '')} stroke-width="${EMBLEM_STROKE_WIDTH.arc}" d="${d}"/>`,
  ).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${EMBLEM_VIEWBOX}" width="${size}" height="${size}" fill="none">` +
    `<defs><linearGradient id="${gradientId}" gradientUnits="${g.gradientUnits}" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}">${stops}</linearGradient></defs>` +
    `<g stroke="url(#${gradientId})" stroke-linecap="${EMBLEM_STROKE_LINECAP}" stroke-linejoin="${EMBLEM_STROKE_LINEJOIN}">` +
    `<path${idAttr(EMBLEM_PATH_IDS.shield)} stroke-width="${EMBLEM_STROKE_WIDTH.shield}" d="${EMBLEM_SHIELD_PATH}"/>` +
    arcs +
    `</g></svg>`
  );
}
