import { sealCauseLine } from '@/lib/event-words'
import { useTranslation } from 'react-i18next'
import { SEAL_UNSEALABLE_PLAIN_SENTENCE, useSim } from '@dems/shared/sim'
import { selectUnsealableCause } from './unsealable-cause'

/**
 * The terminal sentence of a session the Core could not seal (task 3 fix pass F-M7b; fix wave L,
 * G75d-04): ONE clear sentence without a code in brackets (`SEAL_UNSEALABLE_PLAIN_SENTENCE`), and
 * the code of the cause as a detail of its own. Nothing is drawn for any other session.
 */
export function UnsealableNotice({ sessionId }: { sessionId: string | null }) {
  const { t } = useTranslation()
  const cause = useSim(selectUnsealableCause(sessionId))
  if (cause === null) return null
  return (
    <div className="sm-final-incomplete" role="status" data-testid="sm-unsealable" data-cause={cause === '' ? undefined : cause}>
      <p data-testid="sm-unsealable-sentence">{SEAL_UNSEALABLE_PLAIN_SENTENCE}</p>
      {cause === '' ? null : (
        <p className="sm-final-package-note" data-testid="sm-unsealable-cause">
          {sealCauseLine(t, cause)}
        </p>
      )}
    </div>
  )
}
