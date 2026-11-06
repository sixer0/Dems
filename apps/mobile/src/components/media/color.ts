/**
 * Paint helpers for the Skia and SVG renderers (step 71). Every colour starts as a token from
 * `@dems/shared/tokens`; these helpers only derive alpha and mixed variants, so no colour literal
 * lives in `src/components` (MA-22). Worklet-safe: they also run on the UI thread.
 */

function channel(hex: string, index: number): number {
  'worklet';
  return parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
}

function toHex2(value: number): string {
  'worklet';
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  const text = clamped.toString(16);
  return text.length === 1 ? `0${text}` : text;
}

/** `#RRGGBB` or `#RRGGBBAA` → `#RRGGBBAA` with the given alpha (0..1); an existing alpha multiplies. */
export function withAlpha(hex: string, alpha: number): string {
  'worklet';
  const base = hex.slice(0, 7);
  const existing = hex.length === 9 ? channel(hex, 3) / 255 : 1;
  const a = Math.max(0, Math.min(1, alpha)) * existing;
  return `${base}${toHex2(a * 255)}`;
}

/** Linear sRGB mix of two opaque token colours: t = 0 gives `a`, t = 1 gives `b`. */
export function mixHex(a: string, b: string, t: number): string {
  'worklet';
  const k = Math.max(0, Math.min(1, t));
  let out = '#';
  for (let i = 0; i < 3; i += 1) {
    out += toHex2(channel(a, i) + (channel(b, i) - channel(a, i)) * k);
  }
  return out;
}
