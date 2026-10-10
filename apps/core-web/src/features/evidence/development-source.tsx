import type { EvidenceItem } from '@dems/shared/sim'
import { DevelopmentSourceBadge } from '@/features/devices/source-badge'
import { useWebLive } from '@/runtime'
import { itemDevelopmentBadge, readItemV2 } from './item-v2'

/**
 * The development-source marks of the Evidence page (blueprint row 92; UX spec §6.6 "Development-
 * source label", §8f.2; R-11; decisions D83, D91 ruling R-2, D131). They draw the ONE badge of the
 * console (`features/devices/source-badge.tsx`), never a variant of it.
 *
 * | Mark | Drawn from | Never from |
 * |------|-----------|------------|
 * | On an evidence row and on the item header | `developmentSources === true` of the item, as the Core recorded it at the seal (operations 39 / 40) | the current device list |
 * | On a camera file and in the band legend | the class a VERIFY RESULT states (`sources` of operation 41) | the current device list |
 *
 * `false`, `null` and an absent member draw nothing — and nothing here ever says "production".
 * Simulated client mode draws no badge at all: the mode banner already says what the data is, and
 * the verify result still reports the mark.
 */
export function ItemDevelopmentBadge({ item, testId }: { item: EvidenceItem; testId?: string }) {
  const live = useWebLive() !== null
  if (!itemDevelopmentBadge(readItemV2(item), live)) return null
  return <DevelopmentSourceBadge adapter={null} kind="CAMERA" testId={testId ?? `evidence-development-${item.id}`} />
}

/** The badge of one verified source: `LOCAL_DEVICE` and `FAKE` are the adapter kinds the badge words. */
export function VerifiedSourceBadge({ sourceClass, kind, testId }: { sourceClass: string; kind: 'CAMERA' | 'MIC'; testId: string }) {
  if (sourceClass !== 'LOCAL_DEVICE' && sourceClass !== 'FAKE') return null
  return <DevelopmentSourceBadge adapter={sourceClass} kind={kind} testId={testId} />
}
