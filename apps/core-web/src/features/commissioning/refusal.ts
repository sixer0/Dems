/**
 * How the commissioning screen words and records a refused request (task 4, blueprint rows 112,
 * 113 and 118): the hooks every panel of the folder shares. Moved out of `index.tsx` by row 113,
 * unchanged in behaviour, so that the set-IP panel and the acceptance panel use the same ones. A
 * `.ts` module: the component files export only components.
 *
 * | Export | What it is |
 * |--------|------------|
 * | `useRefusalSentence` | The sentence of a refusal of operations 101 to 105: the contract's own for its thirteen reasons, this console's for the rest. Never the answer's text |
 * | `usePresentUnworded` | What no panel words (an outage, a time-out, a 5xx): the shared presenter first; what it leaves is one record of codes |
 * | `useRefused` | Classes a failed command of operations 101 to 105 and hands the unworded ones on |
 */
import { useTranslation } from 'react-i18next'
import { CAPTURE_COMMISSIONING_REFUSAL_SENTENCES } from '@dems/shared/api'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { commissioningRefusal, type CommissioningFailure, type CommissioningRefusal } from './model'
import { COMMISSIONING_RECORD, reportCommissioningError } from './report'

/** The sentence of a refusal: the contract's own for its thirteen reasons, this console's for the rest. Never the answer's text. */
export function useRefusalSentence(): (refusal: CommissioningRefusal) => string {
  const { t } = useTranslation()
  return (refusal) => {
    switch (refusal.kind) {
      case 'REASON': {
        const sentence = CAPTURE_COMMISSIONING_REFUSAL_SENTENCES[refusal.reason]
        return refusal.cause === null ? sentence : `${sentence} ${t('web.commissioning.refusal.cause', { code: refusal.cause })}`
      }
      case 'LOCKED':
        return t('web.commissioning.refusal.LOCKED')
      case 'REVISION_CONFLICT':
        return t('web.commissioning.refusal.REVISION_CONFLICT')
      case 'ROLE':
        return t('web.commissioning.refusal.ROLE')
      case 'INVALID_INPUT':
        return t('web.commissioning.refusal.INVALID_INPUT')
      case 'OTHER':
        return t('web.commissioning.refusal.OTHER')
    }
  }
}

/**
 * A failure no panel has a sentence for: the shared presenter says it (an outage, a time-out, a
 * 403); what the presenter leaves is ONE record of the page's log - the operation, the status and
 * the code. A failure holds no request body, so nothing typed can reach the record.
 */
export function usePresentUnworded(): (failure: CommissioningFailure) => void {
  const presentCoreError = useCoreErrorPresenter()
  return (failure) => {
    if (failure.failure === null || presentCoreError(failure.failure) === null) {
      reportCommissioningError('features/commissioning', null, COMMISSIONING_RECORD.failed, { operationId: failure.operationId, status: failure.status, code: failure.code })
    }
  }
}

/** Classes a failed command, hands what no panel words to the shared presenter, and writes the page's record for what the presenter leaves. */
export function useRefused(): (failure: CommissioningFailure) => CommissioningRefusal {
  const presentUnworded = usePresentUnworded()
  return (failure) => {
    const refusal = commissioningRefusal(failure)
    if (refusal.kind === 'OTHER') presentUnworded(failure)
    return refusal
  }
}
