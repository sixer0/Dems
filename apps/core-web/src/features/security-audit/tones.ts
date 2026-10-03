/**
 * Status → tone maps for the page (01_specs §2.8 tones; kit Chip colours via `toneChipProps`).
 * The `sa-tone-*` classes set `--sa-tone` / `--sa-tone-text` for page-owned glyphs and dots.
 */
import type { AuditCategory, Severity } from '@dems/shared/sim'
import type { StatusTone } from '@dems/shared/tokens'
import type { ChainLinkStatus, ControlStatus, ExpiryTone, PostureState } from './model'

export const POSTURE_TONE: Record<PostureState, StatusTone> = {
  SECURE: 'success',
  ATTENTION: 'warning',
  CRITICAL: 'danger',
  UNKNOWN: 'default',
}

export const CONTROL_TONE: Record<ControlStatus, StatusTone> = {
  OK: 'success',
  ATTENTION: 'warning',
  FAIL: 'danger',
  UNKNOWN: 'default',
}

export const SEVERITY_TONE: Record<Severity, StatusTone> = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  CRITICAL: 'danger',
}

/** Category chips carry no severity meaning: neutral except identity, evidence and security. */
export const CATEGORY_TONE: Record<AuditCategory, StatusTone> = {
  AUTH: 'info',
  SESSION: 'default',
  EVIDENCE: 'sealed',
  DEVICE: 'default',
  SECURITY: 'accent',
  STORAGE: 'default',
  PAIRING: 'info',
  SYSTEM: 'default',
}

export const CHAIN_TONE: Record<ChainLinkStatus, StatusTone> = {
  LINKED: 'success',
  ANCHOR: 'accent',
  BROKEN: 'danger',
}

export const EXPIRY_TONE: Record<ExpiryTone, StatusTone> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
}

/** The `sa-tone-*` class for a tone (`sealed` shares the info styling for glyphs). */
export function toneClass(tone: StatusTone): string {
  return `sa-tone-${tone === 'sealed' ? 'info' : tone}`
}
