// Brand sync (SCR-03, SCR-06; blueprint step 35).
// 1. src/brand/emblem.ts mirrors apps/core-web/src/assets/brand/emblem.svg (step 28) path for path,
//    including stroke widths and gradient stops (D48).
// 2. src/brand/topo.ts and apps/core-web/src/assets/brand/topo.svg are the committed, deterministic
//    output of scripts/gen-topo.ts, and the SVG stays lightweight and react-native-svg friendly.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as brand from '../src/brand';
import {
  EMBLEM_ARC_PATHS,
  EMBLEM_GRADIENT,
  EMBLEM_GRADIENT_ID,
  EMBLEM_PATH_IDS,
  EMBLEM_SHIELD_PATH,
  EMBLEM_STROKE_LINECAP,
  EMBLEM_STROKE_LINEJOIN,
  EMBLEM_STROKE_WIDTH,
  EMBLEM_VIEWBOX,
  emblem,
  emblemGradientId,
  emblemSvg,
} from '../src/brand/emblem';
import {
  TOPO_CONTOUR_COUNT,
  TOPO_ID_PREFIX,
  TOPO_SEED,
  TOPO_STROKE_OPACITY,
  TOPO_SVG,
  TOPO_VIEWBOX,
  topoSvgWithIdPrefix,
} from '../src/brand/topo';
import { palette } from '../src/tokens/tokens';
import {
  TOPO_DEFAULT_SEED,
  TOPO_MODULE_PATH,
  TOPO_SVG_PATH,
  generateTopo,
  renderTopoModule,
} from '../scripts/gen-topo';

const EMBLEM_SVG_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'apps',
  'core-web',
  'src',
  'assets',
  'brand',
  'emblem.svg',
);

interface Tag {
  readonly name: string;
  readonly attrs: Readonly<Record<string, string>>;
}

/** Minimal tag scanner for the two generated/hand-authored SVGs (attributes are double-quoted). */
function parseTags(svg: string): Tag[] {
  const withoutComments = svg.replace(/<!--[\s\S]*?-->/g, '');
  const tags: Tag[] = [];
  for (const match of withoutComments.matchAll(/<([A-Za-z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*\/?>/g)) {
    const attrs: Record<string, string> = {};
    for (const attr of (match[2] ?? '').matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[attr[1] ?? ''] = attr[2] ?? '';
    tags.push({ name: match[1] ?? '', attrs });
  }
  return tags;
}

const byName = (tags: readonly Tag[], name: string): Tag[] => tags.filter((t) => t.name === name);

function pathById(tags: readonly Tag[], id: string): Tag {
  const found = byName(tags, 'path').filter((t) => t.attrs.id === id);
  expect(found, `exactly one <path id="${id}">`).toHaveLength(1);
  return found[0] as Tag;
}

/** Every url(#…) reference in `svg`, and every id it defines. */
function references(svg: string): { refs: string[]; ids: string[] } {
  const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1] ?? '');
  const ids = parseTags(svg)
    .map((t) => t.attrs.id)
    .filter((id): id is string => id !== undefined);
  return { refs, ids };
}

describe('emblem.ts mirrors emblem.svg (SCR-03)', () => {
  const svgText = readFileSync(EMBLEM_SVG_PATH, 'utf8');
  const tags = parseTags(svgText);

  it('every emblem.ts path equals the matching d attribute in emblem.svg', () => {
    expect(byName(tags, 'path')).toHaveLength(1 + EMBLEM_ARC_PATHS.length);
    expect(pathById(tags, EMBLEM_PATH_IDS.shield).attrs.d).toBe(EMBLEM_SHIELD_PATH);
    expect(EMBLEM_ARC_PATHS).toHaveLength(6);
    EMBLEM_ARC_PATHS.forEach((d, i) => {
      expect(pathById(tags, `emblem-arc-${i + 1}`).attrs.d, `emblem-arc-${i + 1}`).toBe(d);
    });
  });

  it('stroke widths match (D48: shield 3.2, arcs 2.6)', () => {
    expect(EMBLEM_STROKE_WIDTH).toEqual({ shield: 3.2, arc: 2.6 });
    expect(Number(pathById(tags, 'emblem-shield').attrs['stroke-width'])).toBe(EMBLEM_STROKE_WIDTH.shield);
    for (const id of EMBLEM_PATH_IDS.arcs) {
      expect(Number(pathById(tags, id).attrs['stroke-width']), id).toBe(EMBLEM_STROKE_WIDTH.arc);
    }
  });

  it('viewBox, gradient vector, gradient stops and line caps match', () => {
    const root = byName(tags, 'svg')[0];
    expect(root?.attrs.viewBox).toBe(EMBLEM_VIEWBOX);

    const gradients = byName(tags, 'linearGradient');
    expect(gradients).toHaveLength(1);
    const g = gradients[0]?.attrs ?? {};
    expect(g.id).toBe(EMBLEM_GRADIENT_ID);
    expect(g.gradientUnits).toBe(EMBLEM_GRADIENT.gradientUnits);
    expect([g.x1, g.y1, g.x2, g.y2].map(Number)).toEqual([
      EMBLEM_GRADIENT.x1,
      EMBLEM_GRADIENT.y1,
      EMBLEM_GRADIENT.x2,
      EMBLEM_GRADIENT.y2,
    ]);

    const stops = byName(tags, 'stop').map((s) => ({ offset: Number(s.attrs.offset), color: s.attrs['stop-color'] }));
    expect(stops).toEqual(EMBLEM_GRADIENT.stops.map((s) => ({ offset: s.offset, color: s.color })));
    expect(EMBLEM_GRADIENT.stops.map((s) => s.color)).toEqual(['#FFE2A6', palette.gold, '#C9802F']);

    const group = byName(tags, 'g')[0]?.attrs ?? {};
    expect(group.stroke).toBe(`url(#${EMBLEM_GRADIENT_ID})`);
    expect(group['stroke-linecap']).toBe(EMBLEM_STROKE_LINECAP);
    expect(group['stroke-linejoin']).toBe(EMBLEM_STROKE_LINEJOIN);
  });

  it('the aggregate `emblem` object carries the same data', () => {
    expect(emblem.shield).toBe(EMBLEM_SHIELD_PATH);
    expect(emblem.arcs).toBe(EMBLEM_ARC_PATHS);
    expect(emblem.viewBox).toBe(EMBLEM_VIEWBOX);
    expect(emblem.strokeWidth).toBe(EMBLEM_STROKE_WIDTH);
    expect(emblem.gradient).toBe(EMBLEM_GRADIENT);
    expect(emblem.ids).toBe(EMBLEM_PATH_IDS);
  });

  it('emblemSvg() rebuilds the asset geometry from the module data', () => {
    const rebuilt = parseTags(emblemSvg());
    expect(byName(rebuilt, 'path').map((p) => [p.attrs.id, p.attrs.d, p.attrs['stroke-width']])).toEqual(
      byName(tags, 'path').map((p) => [p.attrs.id, p.attrs.d, p.attrs['stroke-width']]),
    );
    expect(byName(rebuilt, 'stop').map((s) => s.attrs)).toEqual(byName(tags, 'stop').map((s) => s.attrs));
    expect(byName(rebuilt, 'linearGradient')[0]?.attrs).toEqual(byName(tags, 'linearGradient')[0]?.attrs);
    expect(byName(rebuilt, 'svg')[0]?.attrs.viewBox).toBe(EMBLEM_VIEWBOX);
  });

  it('each inline instance can use its own gradient id (D48)', () => {
    const idA = emblemGradientId(':r1:');
    const idB = emblemGradientId('«r2»');
    expect(idA).toBe('emblem-gradient-_r1_');
    expect(idB).not.toBe(idA);
    expect(emblemGradientId('')).toBe(EMBLEM_GRADIENT_ID);

    const second = emblemSvg({ gradientId: idB, pathIds: false, size: 44 });
    const t = parseTags(second);
    expect(byName(t, 'linearGradient')[0]?.attrs.id).toBe(idB);
    expect(byName(t, 'g')[0]?.attrs.stroke).toBe(`url(#${idB})`);
    expect(byName(t, 'path').every((p) => p.attrs.id === undefined)).toBe(true);
    expect(byName(t, 'svg')[0]?.attrs.width).toBe('44');
    expect(second).not.toContain(`"${EMBLEM_GRADIENT_ID}"`);

    const hostile = emblemSvg({ gradientId: '"><script>alert(1)</script>' });
    expect(hostile).not.toContain('<script');
    const { refs, ids } = references(hostile);
    expect(refs.every((r) => ids.includes(r))).toBe(true);
  });
});

describe('topographic texture (SCR-06)', () => {
  const svgFile = readFileSync(TOPO_SVG_PATH, 'utf8');
  const moduleFile = readFileSync(TOPO_MODULE_PATH, 'utf8');
  const tags = parseTags(TOPO_SVG);
  const lines = byName(tags, 'path');

  it('topo.ts exports exactly the text of topo.svg', () => {
    expect(TOPO_SVG).toBe(svgFile);
  });

  it('both committed files equal the generator output for the committed seed (no drift)', () => {
    expect(TOPO_SEED).toBe(TOPO_DEFAULT_SEED);
    const result = generateTopo({ seed: TOPO_SEED });
    expect(result.svg).toBe(svgFile);
    expect(renderTopoModule(result)).toBe(moduleFile);
  });

  it('is deterministic per seed and varies across seeds', () => {
    expect(generateTopo({ seed: 7 }).svg).toBe(generateTopo({ seed: 7 }).svg);
    expect(generateTopo({ seed: 7 }).svg).not.toBe(TOPO_SVG);
  });

  it('draws 1 px non-scaling contour lines at 15-40 % stroke opacity', () => {
    expect(lines).toHaveLength(TOPO_CONTOUR_COUNT);
    expect(lines.length).toBeGreaterThanOrEqual(12);
    const group = byName(tags, 'g')[0]?.attrs ?? {};
    expect(group['stroke-width']).toBe('1');
    expect(group.stroke).toBe('url(#topo-stroke)');
    for (const line of lines) {
      const alpha = Number(line.attrs['stroke-opacity']);
      expect(alpha).toBeGreaterThanOrEqual(TOPO_STROKE_OPACITY.min);
      expect(alpha).toBeLessThanOrEqual(TOPO_STROKE_OPACITY.max);
      expect(line.attrs['vector-effect']).toBe('non-scaling-stroke');
      expect(line.attrs.d).toMatch(/^M-?\d/);
    }
    expect(Math.max(...lines.map((l) => Number(l.attrs['stroke-opacity'])))).toBe(TOPO_STROKE_OPACITY.max);
  });

  it('uses the bronze and gold palette tokens for the strokes', () => {
    const strokeGradient = tags.findIndex((t) => t.attrs.id === 'topo-stroke');
    const stops = tags.slice(strokeGradient + 1, strokeGradient + 5).map((t) => t.attrs['stop-color']);
    expect(stops).toEqual(expect.arrayContaining([palette.gold, palette.bronze]));
  });

  it('is lightweight and limited to elements react-native-svg SvgXml renders', () => {
    expect(Buffer.byteLength(TOPO_SVG, 'utf8')).toBeLessThan(16 * 1024);
    const allowed = new Set(['svg', 'defs', 'radialGradient', 'stop', 'rect', 'ellipse', 'circle', 'g', 'path']);
    expect(tags.filter((t) => !allowed.has(t.name)).map((t) => t.name)).toEqual([]);
    expect(tags.some((t) => 'style' in t.attrs || 'class' in t.attrs || 'filter' in t.attrs)).toBe(false);
    expect(byName(tags, 'svg')[0]?.attrs.viewBox).toBe(TOPO_VIEWBOX);
    expect(TOPO_SVG.startsWith('<svg ')).toBe(true);
    expect(TOPO_SVG.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('every url(#…) resolves inside the SVG and every id carries the topo- prefix', () => {
    const { refs, ids } = references(TOPO_SVG);
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.every((r) => ids.includes(r))).toBe(true);
    expect(ids.every((id) => id.startsWith(TOPO_ID_PREFIX))).toBe(true);
  });

  it('topoSvgWithIdPrefix() renames every id and reference for a second inline copy', () => {
    const copy = topoSvgWithIdPrefix('«r2»');
    const { refs, ids } = references(copy);
    expect(copy).not.toContain(`id="${TOPO_ID_PREFIX}`);
    expect(copy).not.toContain(`url(#${TOPO_ID_PREFIX}`);
    expect(ids.every((id) => id.startsWith(`_r2_-${TOPO_ID_PREFIX}`))).toBe(true);
    expect(refs.every((r) => ids.includes(r))).toBe(true);
    expect(topoSvgWithIdPrefix('')).toBe(TOPO_SVG);
  });
});

describe('@dems/shared/brand barrel (D45)', () => {
  it('re-exports the emblem and topo modules', () => {
    expect(brand.EMBLEM_SHIELD_PATH).toBe(EMBLEM_SHIELD_PATH);
    expect(brand.emblemSvg).toBe(emblemSvg);
    expect(brand.TOPO_SVG).toBe(TOPO_SVG);
    expect(brand.topoSvgWithIdPrefix).toBe(topoSvgWithIdPrefix);
  });
});
