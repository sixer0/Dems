/**
 * Pure helpers of the session timeline (01_specs §14.6 SessionTimeline; research/04 §3.2 Q).
 */
import type { TimelineKind } from '@dems/shared/sim'

/** Node looks (§14.6): filled green = system OK; hollow amber = note; filled amber = peak; red = fault. */
export type TimelineNodeStyle = 'ok' | 'note' | 'peak' | 'fault'

/** NOTE and MARKER are operator notes (hollow amber); AUDIO_PEAK a peak; FAULT red; the rest system OK. */
export function timelineNodeStyle(kind: TimelineKind): TimelineNodeStyle {
  switch (kind) {
    case 'NOTE':
    case 'MARKER':
      return 'note'
    case 'AUDIO_PEAK':
      return 'peak'
    case 'FAULT':
      return 'fault'
    default:
      return 'ok'
  }
}
