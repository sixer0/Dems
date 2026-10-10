import { useTranslation } from 'react-i18next'
import { interruptedSealCauseSentence, interruptedSealOfSession, useSim } from '@dems/shared/sim'

/** The words of an interrupted seal for one surface. */
export interface InterruptedSealWords {
  /** "Sealed — recording was interrupted": shown IN PLACE of the plain sealed state. */
  title: string
  /** The sentence of the cause, from the shared capture wording. */
  cause: string
  /** What the evidence holds. */
  kept: string
}

/** No interrupted seal: a value no fault kind can be (the selector returns a primitive). */
const NONE = '\u0000'

/**
 * THE INTERRUPTED SEAL OF A SESSION (wave H driver B; gates 75 / 89: G75-03, B-3; ruling D197).
 * A recording that a fault ended and the Core sealed is named on every session surface - the
 * banner, the feed card, the seal dialog - with `title` and the sentence of its cause, never as an
 * ordinary seal. The fact is the Core's: the custody entry `RECORDING_INTERRUPTED` of the session's
 * item, or the session's own `fault` while it is still being sealed (`interruptedSealOfSession`).
 * Null for every other session.
 */
export function useInterruptedSeal(sessionId: string | null): InterruptedSealWords | null {
  const { t } = useTranslation()
  const kind = useSim((s) => {
    const seal = interruptedSealOfSession(s, sessionId)
    return seal === null ? NONE : (seal.faultKind ?? '')
  })
  if (kind === NONE) return null
  return { title: t('common.interruptedSeal.title'), cause: interruptedSealCauseSentence(kind === '' ? null : kind), kept: t('common.interruptedSeal.kept') }
}
