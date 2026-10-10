import { Alert, AlertDialog, Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { localSourceNoticeKey, localSourceNoticeTextKeys, type LocalSourceGate } from './local-source-gate'

/**
 * "Turn on a local device" (fix pass F-M4, R69-01; D178): the confirm step before a pre-check that
 * opens this Mac's camera or microphone. It names the device(s) by the id the Core sent. Nothing is
 * sent to the Core before "Turn on and run the check"; "Not now" (or closing) sends nothing.
 * The kit's confirmation dialog, as `session-new/cancel-dialog.tsx`. Draws nothing for a selector
 * without a local device and outside real capture (`gate.sources` is `null` there).
 *
 * ONE dialog, two kinds (`gate.kind`): `PRECHECK` (the device check opens the device) and `START`
 * (D181: "Start Recording" turns the device on and keeps it on until the recording ends; confirm
 * "Turn on and start recording"). The kind is on `data-kind`.
 */
export function LocalSourceNotice({ gate }: { gate: LocalSourceGate }) {
  const { t } = useTranslation()
  const { sources } = gate
  if (sources === null) return null
  const text = localSourceNoticeTextKeys(gate.kind)
  return (
    <AlertDialog.Backdrop
      isOpen={gate.open}
      onOpenChange={(next) => {
        if (!next) gate.cancel()
      }}
    >
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog aria-label={t(text.title)} data-testid="local-source-notice" data-kind={gate.kind}>
          <AlertDialog.Header>
            <AlertDialog.Icon status="warning" />
            <AlertDialog.Heading>{t(text.title)}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p data-testid="local-source-notice-devices">
              {t(localSourceNoticeKey(sources, gate.kind), { camera: sources.camera ?? '', microphone: sources.microphone ?? '' })}
            </p>
            <p>{t(text.body)}</p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="ghost" onPress={gate.cancel} data-testid="local-source-notice-cancel">
              {t(text.cancel)}
            </Button>
            <Button variant="primary" onPress={gate.confirm} data-testid="local-source-notice-confirm">
              {t(text.confirm)}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}

/**
 * The state of a session left in CREATE whose selector names a local device (a reload, a
 * reconnect): the console did NOT start the device check again by itself. The sentence says so and
 * the button opens the notice. `sessionId` is the session in CREATE that step 2 shows, else `null`.
 */
export function LocalSourceNotStarted({ gate, sessionId }: { gate: LocalSourceGate; sessionId: string | null }) {
  const { t } = useTranslation()
  if (!gate.waitingFor(sessionId)) return null
  return (
    <Alert status="warning" data-testid="local-source-not-started">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t('common.localSourceNotice.notStarted')}</Alert.Title>
      </Alert.Content>
      <Button size="sm" variant="outline" onPress={gate.requestResume} data-testid="local-source-run-check">
        {t('common.localSourceNotice.runCheck')}
      </Button>
    </Alert>
  )
}
