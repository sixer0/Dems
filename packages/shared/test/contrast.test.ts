// AC-69 (masterplan/01_specs.md §2.7 "Contrast (WCAG 2.x, V39)", §14.13): every §2.7 text pair meets
// its listed ratio (±0.05) and rating. Step 30 adds the Scalar renderer pairs generated into
// theme/scalar.css (§14.9), which must reach AA for normal text (4.5:1).
import { describe, expect, it } from 'vitest';
import { scalarModeVariables as scalar } from '../scripts/gen-theme';
import { derived, kitColors, palette, statusSoft, statusText } from '../src/tokens/tokens';

/** WCAG 2.x thresholds. */
const AAA = 7;
const AA = 4.5;
const AA_LARGE = 3;

type Rating = 'AAA' | 'AA' | 'AA-large';

function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** `#RRGGBBAA` composited over an opaque backdrop (sRGB, as browsers blend); `#RRGGBB` unchanged. */
function over(hex: string, backdrop: string): string {
  const h = hex.replace('#', '');
  if (h.length === 6) return `#${h}`;
  const alpha = Number.parseInt(h.slice(6, 8), 16) / 255;
  const fg = channels(h.slice(0, 6));
  const bg = channels(backdrop);
  return `#${fg
    .map((c, i) => Math.round(alpha * c + (1 - alpha) * bg[i]!).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** WCAG 2.x relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function rating(ratio: number): Rating | 'fail' {
  if (ratio >= AAA) return 'AAA';
  if (ratio >= AA) return 'AA';
  if (ratio >= AA_LARGE) return 'AA-large';
  return 'fail';
}

const panel = derived.surface;

/** The §2.7 contrast table, row for row: [pair, foreground, background, listed ratio, listed rating]. */
const SPEC_PAIRS: ReadonlyArray<readonly [string, string, string, number, Rating]> = [
  ['foreground / background', palette.foreground, palette.black, 18.63, 'AAA'],
  ['foreground / panel', palette.foreground, panel, 17.96, 'AAA'],
  ['foreground-2 / panel', derived.foreground2, panel, 12.12, 'AAA'],
  ['gray / background', palette.gray, palette.black, 7.67, 'AAA'],
  ['gray / panel', palette.gray, panel, 7.39, 'AAA'],
  ['gray / surface-tertiary', palette.gray, derived.surfaceTertiary, 6.59, 'AA'],
  ['gold / panel', palette.gold, panel, 12.27, 'AAA'],
  ['black label on gold', kitColors['accent-foreground'], kitColors.accent, 12.72, 'AAA'],
  ['bronze / panel', palette.bronze, panel, 9.19, 'AAA'],
  ['success-400 / panel', statusText.success, panel, 10.77, 'AAA'],
  ['warning-400 / panel', statusText.warning, panel, 11.24, 'AAA'],
  ['danger (500) / panel', palette.danger, panel, 4.99, 'AA'],
  ['danger-400 / panel (text step)', statusText.danger, panel, 6.78, 'AA'],
  ['info-400 / panel', statusText.info, panel, 7.38, 'AAA'],
  ['sealed-400 / panel', statusText.sealed, panel, 6.9, 'AA'],
  ['black on success', kitColors['success-foreground'], kitColors.success, 8.54, 'AAA'],
  ['black on warning', kitColors['warning-foreground'], kitColors.warning, 9.06, 'AAA'],
  ['white on danger (the design choice)', kitColors['danger-foreground'], kitColors.danger, 3.76, 'AA-large'],
  ['black on danger (the alternative)', palette.black, palette.danger, 5.17, 'AA'],
  ['white on info', '#FFFFFF', palette.info, 3.68, 'AA-large'],
];

describe('AC-69: §2.7 contrast table', () => {
  it.each(SPEC_PAIRS)('%s meets its listed ratio and rating', (_pair, fg, bg, listed, listedRating) => {
    const ratio = contrastRatio(fg, bg);
    expect(Math.abs(ratio - listed)).toBeLessThanOrEqual(0.05);
    expect(rating(ratio)).toBe(listedRating);
  });

  it('covers every row of the §2.7 table (20 pairs)', () => {
    expect(SPEC_PAIRS).toHaveLength(20);
  });

  it('keeps white labels on red and blue fills AA-large only, so the ≥ 18.66 px bold rule stays in force', () => {
    for (const fill of [palette.danger, palette.info]) {
      const ratio = contrastRatio('#FFFFFF', fill);
      expect(ratio).toBeGreaterThanOrEqual(AA_LARGE);
      expect(ratio).toBeLessThan(AA);
    }
  });
});

describe('AC-69 extension: Scalar renderer text pairs (theme/scalar.css) reach AA', () => {
  const bg1 = scalar['--scalar-background-1'];
  const bg2 = scalar['--scalar-background-2'];
  const bg3 = scalar['--scalar-background-3'];
  const surfaces = { 'background-1': bg1, 'background-2': bg2, 'background-3': bg3 } as const;
  const textColours = {
    'color-1': scalar['--scalar-color-1'],
    'color-2': scalar['--scalar-color-2'],
    'color-3': scalar['--scalar-color-3'],
    'color-accent': scalar['--scalar-color-accent'],
    'link-color': scalar['--scalar-link-color'],
  } as const;
  const methodAndStatusColours = {
    'color-blue (GET, 1xx)': scalar['--scalar-color-blue'],
    'color-green (POST, 2xx)': scalar['--scalar-color-green'],
    'color-orange (PUT)': scalar['--scalar-color-orange'],
    'color-yellow (PATCH, 3xx)': scalar['--scalar-color-yellow'],
    'color-red (DELETE, 4xx, 5xx)': scalar['--scalar-color-red'],
    'color-purple (OPTIONS)': scalar['--scalar-color-purple'],
  } as const;

  const pairs: Array<[string, string, string]> = [];
  for (const [surface, bg] of Object.entries(surfaces)) {
    for (const [text, fg] of Object.entries(textColours)) pairs.push([`${text} / ${surface}`, fg, bg]);
  }
  // Operations, responses and code samples sit on background-1 and background-2.
  for (const surface of ['background-1', 'background-2'] as const) {
    for (const [method, fg] of Object.entries(methodAndStatusColours)) {
      pairs.push([`${method} / ${surface}`, fg, surfaces[surface]]);
    }
  }
  // The DEMS document uses GET and POST only; their sidebar labels also sit on hover and active items.
  for (const surface of ['--scalar-sidebar-item-hover-background', '--scalar-sidebar-item-active-background'] as const) {
    pairs.push([`GET label / ${surface}`, scalar['--scalar-color-blue'], scalar[surface]]);
    pairs.push([`POST label / ${surface}`, scalar['--scalar-color-green'], scalar[surface]]);
  }
  pairs.push(
    ['sidebar-color-1 / sidebar-background-1', scalar['--scalar-sidebar-color-1'], scalar['--scalar-sidebar-background-1']],
    ['sidebar-color-2 / sidebar-background-1', scalar['--scalar-sidebar-color-2'], scalar['--scalar-sidebar-background-1']],
    [
      'sidebar-item-hover-color / sidebar-item-hover-background',
      scalar['--scalar-sidebar-item-hover-color'],
      scalar['--scalar-sidebar-item-hover-background'],
    ],
    [
      'sidebar-color-active / sidebar-item-active-background',
      scalar['--scalar-sidebar-color-active'],
      scalar['--scalar-sidebar-item-active-background'],
    ],
    [
      'sidebar-search-color / sidebar-search-background',
      scalar['--scalar-sidebar-search-color'],
      scalar['--scalar-sidebar-search-background'],
    ],
    ['button-1-color / button-1', scalar['--scalar-button-1-color'], scalar['--scalar-button-1']],
    ['button-1-color / button-1-hover', scalar['--scalar-button-1-color'], scalar['--scalar-button-1-hover']],
    ['tooltip-color / tooltip-background', scalar['--scalar-tooltip-color'], scalar['--scalar-tooltip-background']],
    ['color-danger / background-danger', scalar['--scalar-color-danger'], over(scalar['--scalar-background-danger'], bg1)],
    ['color-alert / background-alert', scalar['--scalar-color-alert'], over(scalar['--scalar-background-alert'], bg1)],
    ['color-1 / background-accent', scalar['--scalar-color-1'], over(scalar['--scalar-background-accent'], bg1)],
    ['color-accent / background-accent', scalar['--scalar-color-accent'], over(scalar['--scalar-background-accent'], bg1)],
  );

  it.each(pairs)('%s ≥ 4.5:1', (_pair, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA);
  });

  it('the renderer surfaces are the rev-3 panel family', () => {
    expect([bg1, bg2, bg3]).toEqual([derived.surface, derived.surfaceSecondary, derived.surfaceTertiary]);
    expect(scalar['--scalar-background-accent']).toBe(statusSoft.accent);
  });
});
