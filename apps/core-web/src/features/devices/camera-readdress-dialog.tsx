import { useState } from 'react'
import { Alert, AlertDialog, Button, Spinner, toast } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { CAPTURE_READDRESS_ADDRESS_NOT_ALLOWED_SENTENCE, CAPTURE_READDRESS_REFUSAL_SENTENCES } from '@dems/shared/api'
import { useSimInstance } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { usePendingControl } from '@/lib/pending-control'
import { useWebLive } from '@/runtime'
import { confirmDeviceAddress, readdressMayRepeat, readdressRefusal, useRegisteredCameraAddress, type ReaddressFailure, type ReaddressOffer, type ReaddressRefusal } from './camera-readdress'
import { reportDevicesError } from './report'

/** The fixed sentences of the page's own record. */
const CONFIRM_THREW_RECORD = 'The confirmation of a camera address could not be sent.'
const CONFIRM_FAILED_RECORD = 'The confirmation of a camera address was not carried out.'

export interface CameraReaddressDialogProps {
  /** The offer the operator opened, as it was when the dialog opened; `null` closes the dialog. */
  offer: ReaddressOffer | null
  /** The words of a registered device (`CAM-01 · Camera 1`). */
  deviceLabel: (deviceId: string) => string
  /** The dialog was left without a stored change: Cancel, or Close after a refusal. Nothing was sent by leaving. */
  onClose: () => void
  /** The Core stored the address. */
  onDone: () => void
  /** "Search again" after a refusal that needs a new search. */
  onSearchAgain: () => void
}

/**
 * The confirmation dialog of a camera RE-ADDRESS (task 4, blueprint row 198; operation 100).
 *
 * | Rule | How it is kept |
 * |------|----------------|
 * | Offered only for a registered camera found at another address | the caller opens it with a `ReaddressOffer` (`readdressOffer`) |
 * | Both addresses are stated | the registered one from the Core's device list, the found one from the candidate - drawn as text |
 * | The request leaves only on the operator's explicit answer | ONE call site of `confirmDeviceAddress`: the press of the confirming button. Opening and Cancel send nothing |
 * | Every refusal with its sentence | `readdressRefusal`; the six reasons read the contract's own sentences; nothing is retried by itself |
 *
 * The kit's `AlertDialog` (`@heroui/react`) is the dialog, with its own defaults: it traps focus and
 * is NOT closed by the Escape key or a press outside it - an alert dialog asks for one of its two
 * answers. `onOpenChange` is wired all the same, so any close the kit makes is a dismissal.
 */
export function CameraReaddressDialog({ offer, deviceLabel, onClose, onDone, onSearchAgain }: CameraReaddressDialogProps) {
  return (
    <AlertDialog.Backdrop
      isOpen={offer !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <AlertDialog.Container size="md">
        {offer === null ? null : (
          // Keyed by the candidate: a dialog opened for another row starts without the last refusal.
          <ReaddressBody key={offer.candidateId} offer={offer} deviceLabel={deviceLabel} onClose={onClose} onDone={onDone} onSearchAgain={onSearchAgain} />
        )}
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}

function useRefusalSentence(): (refusal: ReaddressRefusal) => string {
  const { t } = useTranslation()
  return (refusal) => {
    const unchanged = t('web.readdress.nothingChanged')
    switch (refusal.kind) {
      case 'REASON':
        // The contract's own sentence of the reason (`CAPTURE_READDRESS_REFUSAL_SENTENCES`); it quotes no address.
        return `${CAPTURE_READDRESS_REFUSAL_SENTENCES[refusal.reason]} ${unchanged}`
      case 'ADDRESS_NOT_ALLOWED':
        return `${CAPTURE_READDRESS_ADDRESS_NOT_ALLOWED_SENTENCE} ${unchanged}`
      case 'LOCKED':
        return t('web.readdress.refusal.LOCKED')
      case 'RESULT_GONE':
        return t('web.readdress.refusal.RESULT_GONE')
      case 'SEARCH_NOT_READY':
        return t('web.readdress.refusal.SEARCH_NOT_READY')
      case 'ROLE':
        return t('web.readdress.refusal.ROLE')
      case 'INVALID_INPUT':
        return t('web.readdress.refusal.INVALID_INPUT')
      case 'OTHER':
        return t('web.readdress.refusal.OTHER')
    }
  }
}

function ReaddressBody({ offer, deviceLabel, onClose, onDone, onSearchAgain }: CameraReaddressDialogProps & { offer: ReaddressOffer }) {
  const { t } = useTranslation()
  const live = useWebLive()
  const sim = useSimInstance()
  const presentCoreError = useCoreErrorPresenter()
  const sentenceOf = useRefusalSentence()
  const control = usePendingControl()
  const { ref: confirmRef } = control
  const registered = useRegisteredCameraAddress(offer.deviceId)
  const [refusal, setRefusal] = useState<ReaddressRefusal | null>(null)
  const device = deviceLabel(offer.deviceId)
  const title = t('web.readdress.title', { device })
  const mayConfirm = refusal === null || readdressMayRepeat(refusal)

  const refused = (failure: ReaddressFailure) => {
    const kind = readdressRefusal(failure)
    if (kind.kind === 'OTHER') {
      // The presenter first (an outage, a time-out, a 429, a 5xx); what it leaves is one record of the page.
      if (failure.failure === null || presentCoreError(failure.failure) === null) {
        reportDevicesError('features/devices.cameraReaddress', null, CONFIRM_FAILED_RECORD, { operationId: 'confirmCaptureDeviceAddress', status: failure.status, code: failure.code })
      }
    }
    setRefusal(kind)
  }

  // THE ONE PLACE the request is sent from: the operator's explicit answer.
  const onConfirm = () => {
    if (!mayConfirm) return
    control.run((release) => {
      void confirmDeviceAddress({ live, sim }, offer)
        .then((answer) => {
          if (answer.ok) {
            toast.success(t('web.readdress.done', { device, address: offer.foundAddress }))
            onDone()
          } else refused(answer)
        })
        .catch((error: unknown) => {
          reportDevicesError('features/devices.cameraReaddress', error, CONFIRM_THREW_RECORD, { operationId: 'confirmCaptureDeviceAddress' })
          setRefusal({ kind: 'OTHER' })
        })
        .finally(release)
    })
  }

  return (
    <AlertDialog.Dialog aria-label={title} data-testid="camera-readdress-dialog" data-device={offer.deviceId} data-candidate={offer.candidateId} aria-busy={control.busy || undefined}>
      <AlertDialog.Header>
        <AlertDialog.Icon status="warning" />
        <AlertDialog.Heading>{title}</AlertDialog.Heading>
      </AlertDialog.Header>
      <AlertDialog.Body className="dev-connect-body">
        <p>{t('web.readdress.intro')}</p>
        {/* The two addresses as plain text, never a link (the grid of the connect dialog's target). */}
        <dl className="dev-connect-target" data-testid="camera-readdress-addresses">
          <div>
            <dt>{t('web.readdress.registered')}</dt>
            <dd className="font-mono" data-testid="camera-readdress-registered" data-known={registered === null ? 'false' : 'true'}>
              {registered ?? t('web.readdress.registeredUnknown')}
            </dd>
          </div>
          <div>
            <dt>{t('web.readdress.found')}</dt>
            <dd className="font-mono" data-testid="camera-readdress-found">
              {offer.foundAddress}
            </dd>
          </div>
        </dl>
        <p className="dev-sel-reason" data-testid="camera-readdress-consequence">
          {t('web.readdress.consequence')}
        </p>
        {refusal === null ? null : (
          <Alert status={refusal.kind === 'OTHER' ? 'danger' : 'warning'} role="alert" data-testid="camera-readdress-refusal" data-refusal={refusal.kind} data-reason={refusal.kind === 'REASON' ? refusal.reason : undefined}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{sentenceOf(refusal)}</Alert.Title>
            </Alert.Content>
          </Alert>
        )}
      </AlertDialog.Body>
      <AlertDialog.Footer>
        <Button variant="ghost" onPress={onClose} isDisabled={control.busy} data-testid="camera-readdress-cancel">
          {refusal === null ? t('common.actions.cancel') : t('web.readdress.close')}
        </Button>
        {refusal !== null && !mayConfirm ? (
          <Button variant="outline" onPress={onSearchAgain} data-testid="camera-readdress-search-again">
            {t('web.readdress.searchAgain')}
          </Button>
        ) : (
          <Button ref={confirmRef} variant="primary" onPress={onConfirm} isPending={control.pending} data-testid="camera-readdress-confirm">
            {control.pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
            {t('web.readdress.confirm')}
          </Button>
        )}
      </AlertDialog.Footer>
    </AlertDialog.Dialog>
  )
}
