/** i18n labels that are computed from IDs (kept out of component files: oxlint only-export-components). */
import type { TFunction } from 'i18next'
import type { DemoCheckId } from '@dems/shared/demo-data'
import type { TrackId } from '@dems/shared/domain'

/** i18n label of a check ID. */
export function checkLabel(t: TFunction, id: DemoCheckId): string {
  if (id.startsWith('track:')) {
    const track = id.slice('track:'.length) as TrackId // D60 (2026-11-04): six tracks, four video
    return t('evidence.verify.checks.track', { track: t(`common.tracks.${track}`), id: track })
  }
  return t(`evidence.verify.checks.${id as Exclude<DemoCheckId, `track:${string}`>}`)
}

