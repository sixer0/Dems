/** i18n labels that are computed from IDs (kept out of component files: oxlint only-export-components). */
import type { TFunction } from 'i18next'
import type { DemoCheckId } from '@dems/shared/demo-data'

/** i18n label of a check ID. */
export function checkLabel(t: TFunction, id: DemoCheckId): string {
  if (id.startsWith('track:')) {
    const track = id.slice('track:'.length) as 'VIDEO-01' | 'VIDEO-02' | 'AUDIO-01' | 'AUDIO-02'
    return t('evidence.verify.checks.track', { track: t(`common.tracks.${track}`), id: track })
  }
  return t(`evidence.verify.checks.${id as Exclude<DemoCheckId, `track:${string}`>}`)
}

