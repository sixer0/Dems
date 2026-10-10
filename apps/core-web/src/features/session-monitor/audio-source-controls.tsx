import { Alert, AlertDialog, Button, Chip, Spinner } from '@heroui/react'
import { ArrowLeftRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MIC_SILENCE_DBFS, MIC_SILENCE_DURATION_MS } from '@dems/shared/api'
import { useRetryCooldown } from '@dems/shared/realtime'
import { useSim } from '@dems/shared/sim'
import { AudioSourceBand } from '@/components/composed'
import { useMicInputName } from '@/features/devices/source-class'
import type { AudioSourceIntervalsView, AudioSourceSwitchControl, AudioSourceToggleBlock, AudioSourceView } from './audio-source'

/** The band's end moves in steps of this many ms of media time: the panel renders at most at 0.2 Hz (§9.3). */
const BAND_STEP_MS = 5_000

/** The sentence of a blocked toggle (ux §3.4): Checking, no recording, the role, or the session holder. */
function useBlockReason(): (block: AudioSourceToggleBlock | null) => string | null {
  const { t } = useTranslation()
  return (block) => {
    if (block === null) return null
    if (block.kind === 'CHECKING') return t('session.audioSource.checking')
    if (block.kind === 'NOT_RECORDING') return t('session.audioSource.block.NOT_RECORDING')
    if (block.kind === 'HOLDER') return t('session.audioSource.block.HOLDER')
    return t('common.rbac.requiresRole', {
      role: block.roles.map((role) => t(`common.roles.${role}`).toUpperCase()).join(` ${t('session.audioSource.rolesJoin')} `),
    })
  }
}

/** The chip of one input: Active (inside `AUDIO-01` now) or Standby, as the Core holds the pair. */
export function AudioSourceRoleChip({ inputId, view }: { inputId: string; view: AudioSourceView }) {
  const { t } = useTranslation()
  const active = view.activeInputId === inputId
  return (
    <Chip
      size="sm"
      variant="soft"
      color={active ? 'accent' : 'default'}
      className="sm-audio-role"
      data-testid={`sm-audio-role-${inputId}`}
      data-role={active ? 'ACTIVE' : 'STANDBY'}
    >
      <Chip.Label>{t(`session.audioSource.role.${active ? 'ACTIVE' : 'STANDBY'}`)}</Chip.Label>
    </Chip>
  )
}

/**
 * G4, the mic toggle in the panel header (ux §3.2 steps 2-3, §3.4, §3.5). Checking, the role and the
 * session holder draw it disabled (the reason is the line of `AudioSourceFooter`); without a
 * recording it is not drawn at all ("hidden with its reason"). A press only opens the confirmation.
 */
export function AudioSourceToggle({ view, control }: { view: AudioSourceView; control: AudioSourceSwitchControl }) {
  const { t } = useTranslation()
  const micName = useMicInputName()
  if (view.block?.kind === 'NOT_RECORDING') return null
  return (
    <Button
      size="sm"
      variant="outline"
      onPress={control.ask}
      isDisabled={view.block !== null}
      isPending={control.pending}
      data-busy={control.busy || undefined}
      data-block={view.block?.kind}
      data-testid="sm-audio-switch"
    >
      {control.pending ? <Spinner size="sm" color="current" /> : <ArrowLeftRight className="size-3.5" aria-hidden="true" />}
      {t('session.audioSource.switchTo', { mic: micName(view.standbyInputId) })}
    </Button>
  )
}

/**
 * The `MIC_SILENT` warning (ux §3.2 step 8; OD-11): it names the silent input and, when that input
 * is the active one, offers "Switch to standby" (G5, the same gate and the same confirmation as the
 * toggle). It never switches: the only effect of this component is `control.ask`, on a press.
 */
export function AudioSilentWarning({ view, control }: { view: AudioSourceView; control: AudioSourceSwitchControl }) {
  const { t } = useTranslation()
  const micName = useMicInputName()
  const reasonOf = useBlockReason()
  if (view.silentInputId === null) return null
  const offered = view.silentInputId === view.activeInputId
  return (
    <Alert status="warning" className="sm-audio-warning" data-testid="sm-audio-silent" data-input={view.silentInputId}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t('session.audioSource.silent.title', { mic: micName(view.silentInputId) })}</Alert.Title>
        <Alert.Description>
          {t('session.audioSource.silent.body', { dbfs: MIC_SILENCE_DBFS, seconds: MIC_SILENCE_DURATION_MS / 1000 })}
        </Alert.Description>
        {offered && view.block !== null ? (
          <Alert.Description data-testid="sm-audio-silent-reason" data-block={view.block.kind}>
            {reasonOf(view.block)}
          </Alert.Description>
        ) : null}
      </Alert.Content>
      {offered ? (
        <Button
          size="sm"
          variant="outline"
          onPress={control.ask}
          isDisabled={view.block !== null}
          data-busy={control.busy || undefined}
          data-block={view.block?.kind}
          data-testid="sm-audio-silent-switch"
        >
          {t('session.audioSource.silent.action')}
        </Button>
      ) : null}
    </Alert>
  )
}

function BandRetry({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  const { retry, cooldown, exhausted, canRetry } = useRetryCooldown(onRetry)
  return (
    <span className="sm-audio-band-failed" data-testid="sm-audio-band-failed">
      <span>{t('session.audioSource.band.unavailable')}</span>
      <Button size="sm" variant="ghost" onPress={retry} isDisabled={!canRetry} data-testid="sm-audio-band-retry">
        {exhausted ? t('common.errors.maxRetries') : cooldown > 0 ? t('common.actions.retryIn', { seconds: cooldown }) : t('common.actions.retry')}
      </Button>
    </span>
  )
}

/**
 * Under the meters: the audio-source band of the open session (WB-10, operation 82), the reason of a
 * blocked toggle, and a refusal that stays (ux §3.5: the fixed conflict sentence, "not recording",
 * "not the open session").
 */
export function AudioSourceFooter({
  view,
  control,
  intervals,
}: {
  view: AudioSourceView
  control: AudioSourceSwitchControl
  intervals: AudioSourceIntervalsView
}) {
  const { t } = useTranslation()
  const micName = useMicInputName()
  const reasonOf = useBlockReason()
  const reason = reasonOf(view.block)
  // Media time of "now", in coarse steps; 0 without a started session.
  const elapsedMs = useSim((s) => {
    const startedAt = s.session?.startedAt ?? null
    if (startedAt === null) return 0
    const end = s.session?.stoppedAt ?? s.clock.now
    return Math.max(0, Math.floor((end - startedAt) / BAND_STEP_MS) * BAND_STEP_MS)
  })
  const { read } = intervals
  return (
    <div className="sm-audio-footer" data-testid="sm-audio-footer">
      {read.kind === 'READY' && read.items.length > 0 ? (
        <div className="sm-audio-band">
          <span className="sm-audio-band-caption">{t('session.audioSource.band.caption')}</span>
          <AudioSourceBand intervals={read.items} endMs={elapsedMs} inputLabel={micName} className="flex-1" />
        </div>
      ) : null}
      {read.kind === 'FAILED' ? <BandRetry onRetry={intervals.retry} /> : null}
      {control.refusal !== null ? (
        <p className="sm-audio-reason" role="alert" data-testid="sm-audio-refusal" data-refusal={control.refusal}>
          {t(`session.audioSource.refusal.${control.refusal}`)}
        </p>
      ) : null}
      {reason !== null ? (
        <p className="sm-audio-reason" data-testid="sm-audio-switch-reason" data-block={view.block?.kind} title={reason}>
          {reason}
        </p>
      ) : null}
    </div>
  )
}

/** The confirmation of a switch (ux §3.2 step 2): an explicit second press; the confirm is busy until the Core answered. */
export function AudioSourceConfirm({ view, control }: { view: AudioSourceView; control: AudioSourceSwitchControl }) {
  const { t } = useTranslation()
  const micName = useMicInputName()
  const to = micName(view.standbyInputId)
  const from = micName(view.activeInputId)
  const title = t('session.audioSource.confirm.title', { mic: to })
  const { ref: confirmRef } = control
  return (
    <AlertDialog.Backdrop isOpen={control.confirmOpen} onOpenChange={(open) => (open ? undefined : control.cancel())}>
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog aria-label={title} data-testid="sm-audio-switch-dialog">
          <AlertDialog.Header>
            <AlertDialog.Icon status="warning" />
            <AlertDialog.Heading>{title}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>{t('session.audioSource.confirm.body', { from })}</p>
          </AlertDialog.Body>
          <AlertDialog.Footer aria-busy={control.busy || undefined}>
            <Button variant="ghost" onPress={control.cancel} data-testid="sm-audio-switch-cancel">
              {t('common.actions.cancel')}
            </Button>
            <Button
              ref={confirmRef}
              variant="primary"
              onPress={control.confirm}
              isPending={control.pending}
              data-busy={control.busy || undefined}
              data-testid="sm-audio-switch-confirm"
            >
              {control.pending ? <Spinner size="sm" color="current" /> : null}
              {t('session.audioSource.confirm.action')}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}
