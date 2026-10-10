import { useTranslation } from 'react-i18next'
import { unsealableNoticeOf, useSim } from '@dems/shared/sim'

/**
 * THE UNSEALABLE STATE OF A RECORDING (task 3 fix pass F-M7b; review R88-02 (c); rulings D178 (2),
 * D183). The Core could not seal the session: it ended it as INCOMPLETE and moved its files to its
 * quarantine folder. Shown as a STATE (a status line), in the Core's own sentence
 * (`common.sealUnsealable.notice`) with the code of the cause - never as an operator error, and
 * with no control: nothing an operator presses here seals it. Read from the Core's alert
 * (`unsealableNoticeOf`), so it is drawn for exactly the session the overlay follows and for no
 * other. Draws nothing when the session has no such state.
 */
export function UnsealableNotice({ sessionId }: { sessionId: string | null }) {
  const { t } = useTranslation()
  const cause = useSim((state) => (sessionId === null ? null : (unsealableNoticeOf(state, sessionId)?.cause ?? null)))
  if (cause === null) return null
  return (
    <p className="sm-final-incomplete" role="status" data-testid="sm-unsealable">
      {t('common.sealUnsealable.notice', { cause })}
    </p>
  )
}
