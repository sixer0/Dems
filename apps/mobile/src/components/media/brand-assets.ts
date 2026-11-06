/**
 * Brand data and stills for the mobile asset renderers (step 72, 05 M-05; 04_mobile_specs §8.1,
 * §8.2). One source for web and mobile:
 *
 * - `EMBLEM_SHARED`: the step-35 emblem module (`@dems/shared/brand`, SCR-03) through the step-71
 *   adapter: viewBox 128, the two-rim shield path, six ridge arcs, stroke widths 3.2 / 2.6 (D48)
 *   and the user-space gradient vector y 6 → 122, so all seven paths share one vertical ramp.
 * - `TOPO_XML`: the step-35 generated topographic texture (SCR-06, D53) for react-native-svg
 *   `SvgXml`. Its lines carry their own alpha (0.15–0.40) and 1 px non-scaling strokes.
 * - `HERO_STILL`: the W-05 room still, 1600 px mobile variant (step 29, Pexels 3906592, D46), a
 *   byte copy in `assets/images/hero/` (MA-24 compares the SHA-256 with the shared original). The
 *   licence row in THIRD_PARTY_NOTICES.md already names this mobile use (D46), so it is not edited.
 *   `HERO_FOCUS` is D46's object position (62 % 45 %).
 *
 * The MB 1 officer photo is never used, cropped or traced (D28).
 */
import { TOPO_STROKE_OPACITY, TOPO_SVG, emblem } from '@dems/shared/brand';
import type { EmblemPathData } from './emblem-paths';

export const EMBLEM_SHARED: EmblemPathData = {
  viewBox: { width: emblem.size, height: emblem.size },
  shield: { outer: emblem.shield },
  arcs: emblem.arcs,
  stops: emblem.gradient.stops,
  strokeWidth: emblem.strokeWidth,
  gradient: { x1: emblem.gradient.x1, y1: emblem.gradient.y1, x2: emblem.gradient.x2, y2: emblem.gradient.y2 },
  source: 'shared',
};

/** Shared topographic texture markup (SCR-06). */
export const TOPO_XML: string = TOPO_SVG;

/** Alpha of the brightest line inside `TOPO_XML` (the layer opacity is scaled against it). */
export const TOPO_XML_MAX_LINE_ALPHA: number = TOPO_STROKE_OPACITY.max;

/** The W-05 room still, 1600 × 1066 JPEG (Metro asset id). */
export const HERO_STILL: number = require('../../../assets/images/hero/room-1600.jpg');

/** D46 object position of the room still (the table and chairs sit right of centre). */
export const HERO_FOCUS = { left: '62%', top: '45%' } as const;
