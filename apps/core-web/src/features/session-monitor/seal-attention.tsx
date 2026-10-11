import { Alert } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { SealRetryControl } from './seal-retry'
import { SEAL_BLOCKED_DETAIL_SENTENCE, SEAL_RECORDING_KEPT_SENTENCE, type SealAttention } from '@dems/shared/sim'

/**
 * A SEAL THAT IS BLOCKED OR RETRIED, ON THE WEB SESSION SURFACES (fix wave I, driver B; finding
 * G75b-02 of re-gate 75; contract note `delegation_progress/contract_wave_i.md`, driver A1).
 *
 * At the re-gate the seal dialog of a session whose seal was blocked read "Finalizing evidence / 0%
 * complete / Resumed after restart", gave no reason and could not be left; the Monitor banner and
 * the Dashboard row kept the running "step 1 of 6".
 *
 * THE ONE READING is the shared `sealAttentionOf`, through `@/lib/seal-attention` (no member is read
 * here by name):
 *
 *   BLOCKED   the Core's retries are used up; the session stays FINALIZING and the Core records no
 *             new session. Shown: the headline, the sentence of the failed step, the sentence of
 *             the detail code, the alert's message (with what restores the seal), "The recording is
 *             kept on the Core.", what the operator can do, and that the window can be closed.
 *   RETRYING  the Core runs the seal again by itself. Shown: the Core's own sentence ("retry n of
 *             N, in s s") and that the recording is kept.
 *
 * The sentences of the cause are the Core's (English constants of the shared module, as the
 * unsealable and the capture-fault sentences are); only the headline, the next step and the note on
 * closing are worded by this console (`web.sealBlocked.*`).
 */
/** The notice of the seal dialog (the dialog offers Close while it is drawn, so the note on closing is said). */
export function SealAttentionNotice({ attention }: { attention: SealAttention }) {
  const { t } = useTranslation()
  if (attention.kind === 'RETRYING') {
    return (
      <Alert status="warning" role="status" data-testid="sm-seal-attention" data-kind="RETRYING" data-attempt={attention.attempt}>
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t('web.sealBlocked.retryTitle')}</Alert.Title>
          <Alert.Description>{attention.sentence ?? t('web.sealBlocked.retryNoSentence')}</Alert.Description>
          <Alert.Description>{SEAL_RECORDING_KEPT_SENTENCE}</Alert.Description>
          <Alert.Description>{t('web.sealBlocked.closeNote')}</Alert.Description>
        </Alert.Content>
      </Alert>
    )
  }
  const detail = attention.detail === null ? null : SEAL_BLOCKED_DETAIL_SENTENCE[attention.detail]
  return (
    <Alert status="danger" role="alert" data-testid="sm-seal-attention" data-kind="BLOCKED" data-cause={attention.cause} data-detail={attention.detail ?? undefined}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t('web.sealBlocked.title')}</Alert.Title>
        {/* The reason: the sentence the Core wrote on the failed step, then what it knows of the cause. */}
        {attention.sentence !== attention.message ? <Alert.Description>{attention.sentence}</Alert.Description> : null}
        {detail !== null ? <Alert.Description>{detail}</Alert.Description> : null}
        {/* The alert's whole message: with what restores the seal and what it costs meanwhile. */}
        <Alert.Description>{attention.message}</Alert.Description>
        <Alert.Description>{SEAL_RECORDING_KEPT_SENTENCE}</Alert.Description>
        <Alert.Description>{t('web.sealBlocked.action')}</Alert.Description>
        {/* Fix wave L (G75d-02): the retry the sentences name - operation 33 for the role that may send it; the others read who can. */}
        <Alert.Description>
          <SealRetryControl place="dialog" />
        </Alert.Description>
        <Alert.Description>{t('web.sealBlocked.closeNote')}</Alert.Description>
      </Alert.Content>
    </Alert>
  )
}
