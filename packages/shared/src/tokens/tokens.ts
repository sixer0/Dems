/**
 * THE SINGLE TOKEN SOURCE (masterplan/01_specs.md §2.7; D16).
 *
 * Authority: ui_design/DEMS-DesignSystem.png (panels §02 colour, §03 typography, §06 badges,
 * §07 cards, §11 spacing/radius/stroke/elevation). Motion tokens are Claude-owned (D15).
 *
 * Every colour is sRGB hex (`#RRGGBB`, or `#RRGGBBAA` where alpha is needed), which works in
 * CSS, React Native, Skia, Recharts and Motion alike. Both kit themes are GENERATED from this
 * file by `scripts/gen-theme.ts`; never edit the CSS in `theme/` by hand.
 */

// ---------------------------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------------------------

/** Hex legend of the design (§02) plus two sampled values (designer to confirm, V36). */
export const palette = {
  /** Brand, primary actions, highlights. */
  gold: '#FFC86B',
  /** Secondary actions, accents, icons. */
  bronze: '#FF9F3D',
  /** Success states, online, ready. */
  success: '#22C55E',
  /** Warnings, attention. */
  warning: '#F59E0B',
  /** Errors, critical alerts (also the REC red). */
  danger: '#EF4444',
  /** Information, links, updates. */
  info: '#3B82F6',
  /** Muted text, icons, placeholders. */
  gray: '#9CA3AF',
  /** Rev 3 (D28/Q6): overlays only (L5: menus, popovers, tooltips, dialogs); panels are warm. */
  charcoal: '#1F262E',
  /** App background, main canvas. */
  black: '#0B0D0F',
  /** Sampled from the Sealed badge (hue ≈258°, Tailwind violet-500). Designer to confirm (Q-D1). */
  sealed: '#8B5CF6',
  /** Sampled heading text (≈#F8F8F8, Tailwind gray-50). Designer to confirm (Q-D2). */
  foreground: '#F9FAFB',
} as const;

/** Values derived or measured for kit slots the design does not name (rev 3: V40, V46). */
export const derived = {
  /** Rev 3, measured (V40): median fill of six Dashboard/Session Monitor panels; the warm L2 panel. */
  surface: '#191008',
  /** Rev 3, measured (V40): inset tile interior (L3), darker than the panel. */
  surfaceSecondary: '#150E07',
  /** Rev 3: panel + 5% white (hover and nested emphasis). */
  surfaceTertiary: '#251C14',
  /** Rev 3: panel + 8% white (neutral component fill). */
  default: '#2B231C',
  /** Rev 3: equal to surface-secondary (the mockup inputs are insets). */
  fieldBackground: '#150E07',
  /** Rev 3, measured (V40): bronze at 35% (panel edge hue ≈25°). */
  border: '#FF9F3D59',
  /** Rev 3, measured (V40): warm secondary text on panels. */
  foreground2: '#D8CEC6',
  /** white at 8% (table row dividers) */
  separator: '#FFFFFF14',
  /** gray at 25% (neutral form-field outlines) */
  fieldBorder: '#9CA3AF40',
  /** white labels on red fills ("Stop Session") — AA-large only (3.76:1), see Q-D5 */
  dangerForeground: '#FFFFFF',
} as const;

/** Status TEXT tones: the 400 step, which reaches AA for small text on charcoal (V39). */
export const statusText = {
  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',
  info: '#60A5FA',
  sealed: '#A78BFA',
  accent: palette.gold,
} as const;

/** Status SOFT fills: base colour at 15% alpha (HeroUI Native's own soft recipe, V38). */
export const statusSoft = {
  success: '#22C55E26',
  warning: '#F59E0B26',
  danger: '#EF444426',
  info: '#3B82F626',
  sealed: '#8B5CF626',
  accent: '#FFC86B26',
} as const;

/**
 * Kit colour variables shared by HeroUI v3 (web) and HeroUI Native (V6: 44 common names).
 * Key = CSS variable name without the leading `--`.
 */
export const kitColors = {
  background: palette.black,
  foreground: palette.foreground,

  surface: derived.surface,
  'surface-foreground': palette.foreground,
  'surface-secondary': derived.surfaceSecondary,
  'surface-secondary-foreground': palette.foreground,
  'surface-tertiary': derived.surfaceTertiary,
  'surface-tertiary-foreground': palette.foreground,

  overlay: palette.charcoal,
  'overlay-foreground': palette.foreground,

  default: derived.default,
  'default-foreground': palette.foreground,
  segment: derived.surfaceTertiary,
  'segment-foreground': palette.foreground,

  accent: palette.gold,
  'accent-foreground': palette.black,
  focus: palette.gold,
  link: palette.gold,

  success: palette.success,
  'success-foreground': palette.black,
  warning: palette.warning,
  'warning-foreground': palette.black,
  danger: palette.danger,
  'danger-foreground': derived.dangerForeground,

  muted: palette.gray,
  border: derived.border,
  separator: derived.separator,

  'field-background': derived.fieldBackground,
  'field-foreground': palette.foreground,
  'field-border': derived.fieldBorder,
  'field-placeholder': palette.gray,
} as const;

/** Soft variants; web sets `--<name>-soft(-foreground)`, native overrides `--color-<name>-soft(-foreground)`. */
export const kitSoft = {
  accent: { soft: statusSoft.accent, foreground: statusText.accent },
  success: { soft: statusSoft.success, foreground: statusText.success },
  warning: { soft: statusSoft.warning, foreground: statusText.warning },
  danger: { soft: statusSoft.danger, foreground: statusText.danger },
} as const;

/** Colours the kits have no variable for; exposed as Tailwind `@theme` colours (§2.10). */
export const extraColors = {
  bronze: palette.bronze,
  info: palette.info,
  'info-soft': statusSoft.info,
  'info-text': statusText.info,
  sealed: palette.sealed,
  'sealed-soft': statusSoft.sealed,
  'sealed-text': statusText.sealed,
  /** Rev 3: warm secondary text. */
  'foreground-2': derived.foreground2,
  /** Rev 3: Charcoal as a utility colour (overlay-level surfaces built by hand-composition). */
  charcoal: palette.charcoal,
} as const;

// ---------------------------------------------------------------------------------------------
// Typography (design §03)
// ---------------------------------------------------------------------------------------------

export const fontFamily = {
  web: {
    /** Free stand-in for "Eurostile Bold" (Q-D6). */
    display: '"Orbitron Variable", ui-sans-serif, system-ui, sans-serif',
    sans: '"Inter Variable", ui-sans-serif, system-ui, sans-serif',
    mono: '"JetBrains Mono Variable", ui-monospace, monospace',
  },
  /** React Native: each weight is its own family (the `useFonts` keys). */
  native: {
    display: 'Orbitron_700Bold',
    normal: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    mono: 'JetBrainsMono_400Regular',
    monoMedium: 'JetBrainsMono_500Medium',
  },
} as const;

export interface TypeStyle {
  /** px */
  size: number;
  /** px */
  lineHeight: number;
  weight: 400 | 500 | 600 | 700;
  /** em */
  letterSpacing: number;
  uppercase: boolean;
  face: 'display' | 'sans' | 'mono';
}

export const typography = {
  display: { size: 32, lineHeight: 40, weight: 700, letterSpacing: 0.01, uppercase: true, face: 'display' },
  h1: { size: 24, lineHeight: 32, weight: 700, letterSpacing: 0, uppercase: false, face: 'sans' },
  h2: { size: 20, lineHeight: 28, weight: 600, letterSpacing: 0, uppercase: false, face: 'sans' },
  h3: { size: 16, lineHeight: 24, weight: 600, letterSpacing: 0, uppercase: false, face: 'sans' },
  body: { size: 14, lineHeight: 20, weight: 400, letterSpacing: 0, uppercase: false, face: 'sans' },
  caption: { size: 12, lineHeight: 16, weight: 400, letterSpacing: 0, uppercase: false, face: 'sans' },
  label: { size: 11, lineHeight: 16, weight: 500, letterSpacing: 0.05, uppercase: true, face: 'sans' },
  data: { size: 12, lineHeight: 16, weight: 400, letterSpacing: 0.02, uppercase: false, face: 'mono' },
} as const satisfies Record<string, TypeStyle>;
export type TypographyToken = keyof typeof typography;

// ---------------------------------------------------------------------------------------------
// Spacing, radius, stroke (design §11)
// ---------------------------------------------------------------------------------------------

/** px; equals Tailwind v4 default utilities 1, 2, 3, 4, 6, 8, 12. */
export const spacing = [4, 8, 12, 16, 24, 32, 48] as const;

export const radius = {
  /** Kit base; both kits derive sm/lg/xl/2xl as base × 0.5/1/1.5/2 → 4/8/12/16 px. */
  base: '0.5rem',
  /** Inputs (8 px) on both kits. */
  field: '0.5rem',
  px: { sm: 4, lg: 8, xl: 12, '2xl': 16, full: 9999 },
} as const;

/** px */
export const stroke = [1, 1.5, 2] as const;

// ---------------------------------------------------------------------------------------------
// Elevation (design §11: levels 0-3). Rev 3: bronze glow, because the Dashboard panel edges
// sample at hue ≈25° (V40); level 3 keeps a gold ring with a bronze bloom.
// ---------------------------------------------------------------------------------------------

export const elevation = {
  0: 'none',
  1: '0 0 0 1px #FF9F3D59, 0 0 14px 0 #FF9F3D1F',
  2: '0 0 0 1px #FF9F3D80, 0 0 20px 0 #FF9F3D38',
  3: '0 0 0 1.5px #FFC86BA6, 0 0 28px 2px #FF9F3D59',
} as const;

/** Kit shadow slots. */
export const kitShadows = {
  'surface-shadow': elevation[1],
  'overlay-shadow': elevation[3],
  'field-shadow': '0 0 0 0 transparent inset',
} as const;

// ---------------------------------------------------------------------------------------------
// Motion (Claude-owned per D15)
// ---------------------------------------------------------------------------------------------

export type CubicBezier = readonly [number, number, number, number];

export interface SpringToken {
  stiffness: number;
  damping: number;
  mass: number;
}

export const motion = {
  /** ms */
  duration: {
    instant: 90,
    fast: 160,
    base: 240,
    slow: 420,
    slower: 640,
    beatIn: 180,
    beatOut: 720,
    ambient: 1200,
  },
  easing: {
    standard: [0.2, 0, 0, 1],
    luxe: [0.22, 1, 0.36, 1],
    emphasized: [0.16, 1, 0.3, 1],
    exit: [0.4, 0, 1, 1],
  },
  spring: {
    /** ζ ≈ 1.00 — enter transitions */
    gentle: { stiffness: 170, damping: 26, mass: 1 },
    /** ζ ≈ 0.87 — press and toggle feedback */
    snappy: { stiffness: 420, damping: 34, mass: 0.9 },
    /** ζ ≈ 0.56 — success confirmations only */
    bouncy: { stiffness: 260, damping: 18, mass: 1 },
  },
  choreography: {
    /** ms */
    stagger: 60,
    /** ms */
    delayChildren: 80,
  },
  /** Motion proof mode (`?motion=slow`) multiplies durations and stagger by this factor. */
  proofSlowFactor: 10,
  ambient: {
    /** ms loop: elevation 2 ↔ 3 on "SYSTEM READY" and "SECURE" */
    glowBreath: 2400,
    /** ms loop: REC dot opacity 1 → 0.35 → 1 */
    recPulse: 1200,
    /** ms: 20 Hz audio-meter update target */
    meterFrameMs: 50,
  },
} as const satisfies {
  duration: Record<string, number>;
  easing: Record<string, CubicBezier>;
  spring: Record<string, SpringToken>;
  choreography: Record<string, number>;
  proofSlowFactor: number;
  ambient: Record<string, number>;
};

/** Everything, for consumers that want one import. */
export const tokens = {
  palette,
  derived,
  statusText,
  statusSoft,
  kitColors,
  kitSoft,
  extraColors,
  fontFamily,
  typography,
  spacing,
  radius,
  stroke,
  elevation,
  kitShadows,
  motion,
} as const;
