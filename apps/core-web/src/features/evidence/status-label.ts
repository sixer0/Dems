import type { TFunction } from 'i18next'
import { verificationOfRecordFailed, type EvidenceStatus } from '@dems/shared/sim'

/** The one word of an item's status: its status, with the failed verification of record said on it. Pure. */
export function evidenceStatusLabel(t: TFunction, status: EvidenceStatus, item?: unknown): string {
  const label = t(`common.evidenceStatus.${status}`)
  return verificationOfRecordFailed(item) && status !== 'RECORDED' ? t('web.waveJ.evidence.verificationFailedStatus', { status: label }) : label
}

