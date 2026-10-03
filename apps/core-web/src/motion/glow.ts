/**
 * Glow shadows for `GlowLayer` (03_motion_spec §2.2, §9.2).
 *
 * Glow is never animated as a shadow. Each elevation level is a pre-rendered layer carrying a
 * static shadow, and only the layers' opacity moves. The brand tone uses the elevation tokens
 * as they are; a status tone (success, warning, danger, info, sealed) uses the same geometry and
 * alpha steps with the colour swapped, so every glow stays derived from the tokens.
 */
import { elevation, toneHex, type StatusTone } from '@dems/shared/tokens'

export type GlowLevel = 0 | 1 | 2 | 3
/** `brand` is the bronze and gold elevation glow; the others are status tones. */
export type GlowTone = 'brand' | Exclude<StatusTone, 'accent' | 'default'>

export const GLOW_LEVELS = [1, 2, 3] as const

/** A 6-digit hex colour immediately followed by a 2-digit alpha, as the elevation tokens write it. */
const COLOUR_WITH_ALPHA = /#[0-9a-f]{6}(?=[0-9a-f]{2}\b)/gi

export function glowShadow(tone: GlowTone, level: GlowLevel): string {
  const base: string = elevation[level]
  if (tone === 'brand' || level === 0) return base
  return base.replace(COLOUR_WITH_ALPHA, toneHex[tone])
}
