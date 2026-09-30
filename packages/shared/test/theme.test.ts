// S-1 (masterplan/01_specs.md §8): generator output covers the §2.7 palette and matches the committed files.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  GENERATED_HEADER,
  NATIVE_THEME_PATH,
  WEB_THEME_PATH,
  generateTheme,
} from '../scripts/gen-theme';
import { derived, palette } from '../src/tokens/tokens';

const PALETTE_VARIABLES: ReadonlyArray<readonly [string, string]> = [
  ['--background', palette.black],
  ['--foreground', palette.foreground],
  // Token rev 3 (D31): warm panels, Charcoal for overlays only, bronze border.
  ['--surface', derived.surface],
  ['--surface-secondary', '#150E07'],
  ['--surface-tertiary', '#251C14'],
  ['--default', '#2B231C'],
  ['--overlay', palette.charcoal],
  ['--border', '#FF9F3D59'],
  ['--surface-shadow', '0 0 0 1px #FF9F3D59, 0 0 14px 0 #FF9F3D1F'],
  ['--color-foreground-2', '#D8CEC6'],
  ['--color-charcoal', '#1F262E'],
  ['--shadow-glow-3', '0 0 0 1.5px #FFC86BA6, 0 0 28px 2px #FF9F3D59'],
  ['--accent', palette.gold],
  ['--success', palette.success],
  ['--warning', palette.warning],
  ['--danger', palette.danger],
  ['--muted', palette.gray],
  ['--color-bronze', palette.bronze],
  ['--color-info', palette.info],
  ['--color-sealed', palette.sealed],
];

describe('generateTheme()', () => {
  const { web, native } = generateTheme();

  it.each([
    ['web', web],
    ['native', native],
  ])('%s theme declares every palette variable and --radius', (_name, css) => {
    expect(css.startsWith(GENERATED_HEADER)).toBe(true);
    for (const [variable, hex] of PALETTE_VARIABLES) {
      expect(css).toContain(`${variable}: ${hex};`);
    }
    expect(css).toContain('--radius: 0.5rem;');
    expect(css).toContain('--field-radius: 0.5rem;');
  });

  it('web theme targets the HeroUI dark selectors', () => {
    expect(web).toContain('.dark,\n[data-theme="dark"]');
    expect(web).toContain('color-scheme: dark;');
  });

  it('native theme defines both Uniwind variants with the vendor font variables', () => {
    expect(native).toContain('@variant dark');
    expect(native).toContain('@variant light');
    expect(native).toContain("--font-bold: 'Inter_700Bold';");
    expect(native).toContain("--font-display: 'Orbitron_700Bold';");
  });

  it('committed theme files equal the generator output (no drift)', () => {
    expect(readFileSync(WEB_THEME_PATH, 'utf8')).toBe(web);
    expect(readFileSync(NATIVE_THEME_PATH, 'utf8')).toBe(native);
  });
});
