// S-1 (masterplan/01_specs.md §8): generator output covers the §2.7 palette and matches the committed files.
// Step 30 adds the third output, theme/scalar.css (§14.9), and the typography class-list sync (D41(d)).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  GENERATED_HEADER,
  NATIVE_THEME_PATH,
  SCALAR_THEME_PATH,
  WEB_THEME_PATH,
  generateTheme,
  scalarModeVariables,
  scalarMotionVariables,
  scalarRootVariables,
} from '../scripts/gen-theme';
import {
  TYPOGRAPHY_FONT_SIZE_CLASSES,
  TYPOGRAPHY_TW_MERGE_CLASS_GROUPS,
  derived,
  palette,
  typography,
} from '../src/tokens/tokens';
import * as tokenBarrel from '../src/tokens';

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
    expect(readFileSync(SCALAR_THEME_PATH, 'utf8')).toBe(generateTheme().scalar);
  });
});

describe('generateTheme().scalar (01_specs §14.9)', () => {
  const { scalar } = generateTheme();

  it('starts with the generated header', () => {
    expect(scalar.startsWith(GENERATED_HEADER)).toBe(true);
  });

  it('maps the renderer surfaces, text and accent onto the rev-3 tokens', () => {
    expect(scalar).toContain(`--scalar-background-1: ${derived.surface};`);
    expect(scalar).toContain('--scalar-background-1: #191008;');
    expect(scalar).toContain('--scalar-background-2: #150E07;');
    expect(scalar).toContain('--scalar-background-3: #251C14;');
    expect(scalar).toContain(`--scalar-color-accent: ${palette.gold};`);
    expect(scalar).toContain('--scalar-color-1: #F9FAFB;');
    expect(scalar).toContain('--scalar-color-3: #9CA3AF;');
    expect(scalar).toContain('--scalar-border-color: #FF9F3D59;');
    expect(scalar).toContain('--scalar-button-1-color: #0B0D0F;');
  });

  it('uses the 04 §5.9 method colours through Scalar’s method variables', () => {
    expect(scalarModeVariables['--scalar-color-blue']).toBe('#3B82F6'); // GET
    expect(scalarModeVariables['--scalar-color-green']).toBe('#22C55E'); // POST
    expect(scalarModeVariables['--scalar-color-orange']).toBe('#F59E0B'); // PUT
    expect(scalarModeVariables['--scalar-color-yellow']).toBe('#F59E0B'); // PATCH
    expect(scalarModeVariables['--scalar-color-red']).toBe('#EF4444'); // DELETE
    expect(scalarModeVariables['--scalar-color-purple']).toBe('#9CA3AF'); // OPTIONS
  });

  it('declares the colours for both Scalar modes and dark colour-scheme only', () => {
    expect(scalar).toContain('.light-mode,\n.dark-mode {\n  color-scheme: dark;');
    expect(scalar).not.toContain('color-scheme: light');
  });

  it('uses Inter and JetBrains Mono, never Orbitron, and loads nothing remote', () => {
    const rules = scalar.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(scalarRootVariables['--scalar-font']).toContain('"Inter Variable"');
    expect(scalarRootVariables['--scalar-font-code']).toContain('"JetBrains Mono Variable"');
    expect(rules).not.toMatch(/orbitron/i);
    expect(rules).not.toMatch(/@import|url\(|https?:/i);
  });

  it('puts the radius scale on :root with the design steps (4 / 12 / 16 px)', () => {
    expect(scalar).toMatch(/:root \{\n {2}--scalar-font: /);
    expect(scalarRootVariables['--scalar-radius']).toBe('4px');
    expect(scalarRootVariables['--scalar-radius-xl']).toBe('12px');
    expect(scalarRootVariables['--scalar-radius-max']).toBe('16px');
    expect(scalarRootVariables['--scalar-border-width']).toBe('1px');
  });

  it('ships the 03_motion_spec §5.5 keyframes, token timings and a reduced-motion switch', () => {
    expect(scalar).toContain('@keyframes dems-pop {');
    expect(scalar).toContain('@keyframes dems-sheen {');
    expect(scalarMotionVariables['--dems-scalar-pop']).toBe(
      'dems-pop 240ms cubic-bezier(0.22, 1, 0.36, 1) 1 both',
    );
    expect(scalarMotionVariables['--dems-scalar-sheen']).toBe(
      'dems-sheen 1200ms cubic-bezier(0.2, 0, 0, 1) 1 both',
    );
    expect(scalarMotionVariables['--dems-scalar-chevron-transition']).toBe(
      'transform 160ms cubic-bezier(0.2, 0, 0, 1)',
    );
    const reduced = scalar.slice(scalar.indexOf('@media (prefers-reduced-motion: reduce)'));
    for (const name of Object.keys(scalarMotionVariables)) {
      expect(reduced).toContain(`${name}: none;`);
    }
  });
});

describe('typography class registration (D41(d))', () => {
  const { web, native } = generateTheme();

  it('lists exactly the typography tokens, in token order', () => {
    expect([...TYPOGRAPHY_FONT_SIZE_CLASSES]).toEqual(Object.keys(typography));
    expect(TYPOGRAPHY_FONT_SIZE_CLASSES).toEqual([
      'display',
      'h1',
      'h2',
      'h3',
      'body',
      'caption',
      'label',
      'data',
    ]);
  });

  it.each([
    ['web', web],
    ['native', native],
  ])('every registered text-* class has its --text-* variable in the %s theme', (_name, css) => {
    for (const name of TYPOGRAPHY_FONT_SIZE_CLASSES) {
      expect(css).toContain(`--text-${name}: `);
    }
  });

  it('offers a tailwind-merge font-size class group built from the same list', () => {
    expect(TYPOGRAPHY_TW_MERGE_CLASS_GROUPS['font-size']).toEqual([
      { text: TYPOGRAPHY_FONT_SIZE_CLASSES },
    ]);
  });

  it('is exported from the @dems/shared/tokens barrel', () => {
    expect(tokenBarrel.TYPOGRAPHY_FONT_SIZE_CLASSES).toBe(TYPOGRAPHY_FONT_SIZE_CLASSES);
    expect(tokenBarrel.TYPOGRAPHY_TW_MERGE_CLASS_GROUPS).toBe(TYPOGRAPHY_TW_MERGE_CLASS_GROUPS);
  });
});
