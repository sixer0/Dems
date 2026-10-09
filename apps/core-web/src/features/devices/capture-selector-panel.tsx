import { useEffect, useState } from 'react'
import { Alert, AlertDialog, Button, Chip, EmptyState, Label, ListBox, Select, Skeleton, Spinner, toast } from '@heroui/react'
import { Camera, Mic, Power, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { VideoTrackId } from '@dems/shared/domain'
import { useRetryCooldown } from '@dems/shared/realtime'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { usePendingControl } from '@/lib/pending-control'
import {
  CAPTURE_SELECTOR_ANCHOR,
  poeCycleGate,
  selectorEditGate,
  selectorRefusal,
  useCaptureSelector,
  useCaptureSelectorCommands,
  type CaptureCameraLine,
  type CaptureDevice,
  type CaptureMicLine,
  type CaptureSelectorCommands,
  type CaptureSelectorView,
  type PoeCycleGate,
  type SelectorAnswer,
  type SelectorEditBlock,
  type SelectorFailure,
} from './capture-selector'
import { SearchCamerasButton } from './camera-search-context'
import { DevicesPanel } from './panel'
import { reportDevicesError } from './report'
import { DeviceSourceBadge } from './source-badge'
import { isDevelopmentSource, useRealCapture } from './source-class'

/** The fixed sentence of the page's own record when a selector command fails for a reason the presenter left to the page. */
const COMMAND_FAILED_RECORD = 'A command of the capture device selector was not carried out.'

/** The sentence under a blocked edit control (ux §2.4): Checking, the role, or the open session. */
function useBlockReason(): (block: SelectorEditBlock | null) => string | null {
  const { t } = useTranslation()
  return (block) => {
    if (block === null) return null
    if (block.kind === 'CHECKING') return t('devices.selector.checking')
    if (block.kind === 'LOCKED') return t('devices.selector.locked')
    return t('common.rbac.requiresRole', { role: block.roles.map((role) => t(`common.roles.${role}`).toUpperCase()).join(` ${t('devices.selector.rolesJoin')} `) })
  }
}

/**
 * What a refused or unanswered command says (ux §2.2 step 6, §2.5). Returns the sentence that stays
 * with the field, or `null` when the notice was a toast (the presenter's, or the page's own).
 */
function useFailureNotice(): (failure: SelectorFailure) => string | null {
  const { t } = useTranslation()
  const presentCoreError = useCoreErrorPresenter()
  return (failure) => {
    switch (selectorRefusal(failure)) {
      case 'LOCKED':
        // OD-10: an explained state, never an error toast; the Core wrote no audit row.
        return t('devices.selector.locked')
      case 'DEVELOPMENT_ONLY':
        return t('devices.selector.developmentOnly')
      case 'INVALID':
        return t('devices.selector.invalid')
      case 'UNKNOWN_DEVICE':
        return t('devices.selector.unknownDevice')
      case 'NOT_LOST':
        return t('devices.selector.poe.notLost')
      case 'RECORDING':
        return t('devices.actions.restartWhileRecording')
      case 'OTHER':
        break
    }
    // Rule 2 of the page rows: the presenter first (a 403, an outage, a time-out, a 429, a 503).
    if (failure.failure !== null && presentCoreError(failure.failure) !== null) return null
    if (failure.status === 403) {
      toast.danger(t('common.rbac.deniedTitle'))
      return null
    }
    reportDevicesError('features/devices.captureSelector', null, COMMAND_FAILED_RECORD, {
      operationId: failure.operationId,
      status: failure.status,
      code: failure.code,
    })
    toast.danger(t('devices.selector.failed'))
    return null
  }
}

function StateChips({ online, streamState }: { online: boolean; streamState?: 'LIVE' | 'LOST' | null }) {
  const { t } = useTranslation()
  return (
    <span className="dev-sel-chips">
      <Chip size="sm" variant="soft" color={online ? 'success' : 'danger'}>
        <Chip.Label>{t(online ? 'devices.selector.online' : 'devices.selector.offline')}</Chip.Label>
      </Chip>
      {streamState ? (
        <Chip size="sm" variant="soft" color={streamState === 'LIVE' ? 'success' : 'danger'}>
          <Chip.Label>{t(`devices.selector.stream.${streamState}`)}</Chip.Label>
        </Chip>
      ) : null}
    </span>
  )
}

const deviceText = (device: Pick<CaptureDevice, 'id' | 'model'>): string => (device.model ? `${device.id} · ${device.model}` : device.id)

interface RowShared {
  block: SelectorEditBlock | null
  commands: CaptureSelectorCommands
}

function CameraSourceRow({ line, cameras, block, commands, poe }: RowShared & { line: CaptureCameraLine; cameras: readonly CaptureDevice[]; poe: (busy: boolean) => PoeCycleGate }) {
  const { t } = useTranslation()
  const reasonOf = useBlockReason()
  const notice = useFailureNotice()
  const save = usePendingControl()
  const cycle = usePendingControl()
  // The element refs, taken apart from the controls (the pressed button carries `aria-busy`).
  const { ref: saveRef } = save
  const { ref: cycleRef } = cycle
  // `null`: the control follows the Core's line. Nothing is optimistic (ux §2.2 step 4).
  const [choice, setChoice] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const trackId = line.trackId as VideoTrackId
  const track = t(`common.tracks.${trackId}`)
  const selected = choice ?? line.deviceId
  const realCapture = useRealCapture()
  // An option of a development source says so in its own text (ux §8f.2 "each option of the source selects").
  const optionText = (device: CaptureDevice): string =>
    realCapture && isDevelopmentSource(device) ? `${deviceText(device)} · ${t('common.sourceClass.badge')}` : deviceText(device)
  const current = cameras.find((device) => device.id === line.deviceId)
  const name = current ? deviceText(current) : line.deviceId
  const reason = reasonOf(block)
  const dirty = selected !== line.deviceId
  const poeGate = poe(cycle.busy)

  const settled = (answer: SelectorAnswer, ok: string) => {
    if (answer.ok) {
      setChoice(null)
      setMessage(null)
      toast.success(ok)
      return
    }
    setMessage(notice(answer))
  }

  const onSave = () => {
    save.run((release) => {
      void commands
        .setCameraSource(selected, trackId)
        .then((answer) => settled(answer, t('devices.selector.saved')))
        .finally(release)
    })
  }

  const onCycle = () => {
    setConfirmOpen(false)
    cycle.run((release) => {
      void commands
        .poeCycle(line.deviceId)
        .then((answer) => settled(answer, t('devices.selector.poe.requested', { name })))
        .finally(release)
    })
  }

  const poeReason =
    poeGate.offered && poeGate.block !== null
      ? poeGate.block.kind === 'CHECKING'
        ? t('devices.selector.checking')
        : poeGate.block.kind === 'RECORDING'
          ? t('devices.actions.restartWhileRecording')
          : poeGate.block.kind === 'ROLE'
            ? t('common.rbac.requiresRole', { role: poeGate.block.role ? t(`common.roles.${poeGate.block.role}`) : '' })
            : null
      : null

  return (
    <li className="dev-sel-row" data-testid={`selector-camera-${trackId}`} data-device={line.deviceId} data-stream={line.streamState} aria-busy={save.busy || cycle.busy || undefined}>
      <div className="dev-sel-head">
        <Camera className="dev-sel-icon" aria-hidden="true" strokeWidth={1.75} />
        <div className="dev-sel-titles">
          <span className="dev-tile-name">{track}</span>
          <span className="dev-tile-sub">
            {trackId} · {name} · {t('devices.selector.profile', { profile: line.profile })}
          </span>
        </div>
        <StateChips online={line.online} streamState={line.streamState} />
        {/* Flow 12 (R-11): the one badge, from the `sourceClass` the Core sent for the device of this line. */}
        <DeviceSourceBadge device={current} testId={`selector-badge-${trackId}`} />
      </div>
      <div className="dev-sel-edit">
        <Select
          value={selected}
          onChange={(key) => {
            if (typeof key === 'string') setChoice(key === line.deviceId ? null : key)
          }}
          isDisabled={block !== null || save.busy}
          className="dev-sel-select"
          data-testid={`selector-source-${trackId}`}
        >
          <Label>{t('devices.selector.sourceLabel', { track })}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {cameras.map((device) => (
                <ListBox.Item key={device.id} id={device.id} textValue={optionText(device)}>
                  {optionText(device)}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Button ref={saveRef} size="sm" variant="primary" isDisabled={block !== null || !dirty} isPending={save.pending} onPress={onSave} data-testid={`selector-save-${trackId}`}>
          {save.pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
          {t('devices.selector.save')}
        </Button>
        {poeGate.offered ? (
          <Button
            ref={cycleRef}
            size="sm"
            variant="outline"
            isDisabled={poeGate.block !== null}
            isPending={cycle.pending}
            onPress={() => setConfirmOpen(true)}
            data-testid={`selector-poe-${trackId}`}
          >
            <Power aria-hidden="true" size={14} />
            {t('common.deviceMenu.poeCycle')}
          </Button>
        ) : null}
      </div>
      {reason ? (
        <p className="dev-sel-reason" data-testid={`selector-reason-${trackId}`} data-block={block?.kind}>
          {reason}
        </p>
      ) : null}
      {poeReason ? (
        <p className="dev-sel-reason" data-testid={`selector-poe-reason-${trackId}`}>
          {poeReason}
        </p>
      ) : null}
      {message ? (
        <p className="dev-sel-message" role="alert" data-testid={`selector-message-${trackId}`}>
          {message}
        </p>
      ) : null}
      <AlertDialog.Backdrop isOpen={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialog.Container size="sm">
          <AlertDialog.Dialog aria-label={t('devices.selector.poe.confirmTitle', { name })} data-testid={`selector-poe-dialog-${trackId}`}>
            <AlertDialog.Header>
              <AlertDialog.Icon status="warning" />
              <AlertDialog.Heading>{t('devices.selector.poe.confirmTitle', { name })}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>{t('devices.selector.poe.confirmBody')}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="ghost" onPress={() => setConfirmOpen(false)}>
                {t('common.actions.cancel')}
              </Button>
              <Button variant="danger" onPress={onCycle} data-testid={`selector-poe-confirm-${trackId}`}>
                {t('devices.selector.poe.confirm')}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </li>
  )
}

function MicRow({ line, device, block, commands }: RowShared & { line: CaptureMicLine; device: CaptureDevice | undefined }) {
  const { t } = useTranslation()
  const reasonOf = useBlockReason()
  const notice = useFailureNotice()
  const control = usePendingControl()
  const { ref: controlRef } = control
  const [message, setMessage] = useState<string | null>(null)
  const primary = line.role === 'PRIMARY'
  const reason = primary ? null : reasonOf(block)

  const onMakePrimary = () => {
    control.run((release) => {
      void commands
        .setPrimaryMic(line.inputId)
        .then((answer) => {
          if (answer.ok) {
            setMessage(null)
            toast.success(t('devices.selector.saved'))
          } else setMessage(notice(answer))
        })
        .finally(release)
    })
  }

  return (
    <li className="dev-sel-row" data-testid={`selector-mic-${line.inputId}`} data-role={line.role} aria-busy={control.busy || undefined}>
      <div className="dev-sel-head">
        <Mic className="dev-sel-icon" aria-hidden="true" strokeWidth={1.75} />
        <div className="dev-sel-titles">
          <span className="dev-tile-name">{line.inputId}</span>
          <span className="dev-tile-sub">
            {deviceText(device ?? { id: line.deviceId, model: null })} · {t('devices.selector.transport', { transport: line.transport })}
          </span>
        </div>
        <span className="dev-sel-chips">
          <Chip size="sm" variant="soft" color={primary ? 'accent' : 'default'} data-testid={`selector-role-${line.inputId}`}>
            <Chip.Label>{t(`devices.selector.role.${line.role}`)}</Chip.Label>
          </Chip>
        </span>
        <StateChips online={line.online} />
        <DeviceSourceBadge device={device} testId={`selector-badge-${line.inputId}`} />
      </div>
      {primary ? null : (
        <div className="dev-sel-edit">
          <Button
            ref={controlRef}
            size="sm"
            variant="outline"
            isDisabled={block !== null}
            isPending={control.pending}
            onPress={onMakePrimary}
            data-testid={`selector-primary-${line.inputId}`}
          >
            {control.pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
            {t('devices.selector.makePrimary')}
          </Button>
        </div>
      )}
      {reason ? (
        <p className="dev-sel-reason" data-testid={`selector-reason-${line.inputId}`} data-block={block?.kind}>
          {reason}
        </p>
      ) : null}
      {message ? (
        <p className="dev-sel-message" role="alert" data-testid={`selector-message-${line.inputId}`}>
          {message}
        </p>
      ) : null}
    </li>
  )
}

function ReadFailed({ kind, onRetry }: { kind: 'NOT_READY' | 'FAILED'; onRetry: () => void }) {
  const { t } = useTranslation()
  const { retry, cooldown, exhausted, canRetry } = useRetryCooldown(onRetry)
  return (
    <Alert status="danger" data-testid="selector-error" data-kind={kind}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t(kind === 'NOT_READY' ? 'devices.selector.notReady' : 'devices.selector.readFailed')}</Alert.Title>
      </Alert.Content>
      <Button size="sm" variant="outline" onPress={retry} isDisabled={!canRetry} data-testid="selector-retry">
        {exhausted ? t('common.errors.maxRetries') : cooldown > 0 ? t('common.actions.retryIn', { seconds: cooldown }) : t('common.actions.retry')}
      </Button>
    </Alert>
  )
}

function SelectorBody({ view, commands }: { view: CaptureSelectorView; commands: CaptureSelectorCommands }) {
  const { t } = useTranslation()
  const { read } = view

  if (read.kind === 'WAITING' || read.kind === 'LOADING') {
    // ux §2.2 step 1, §2.5: a skeleton on the panel, and the gated controls say they are being checked.
    return (
      <div className="dev-sel-pending" data-testid="selector-pending" data-read={read.kind} aria-busy="true">
        <Skeleton className="dev-sel-skeleton" />
        <Skeleton className="dev-sel-skeleton" />
        <p className="dev-sel-reason" data-testid="selector-checking">
          {t('devices.selector.checking')}
        </p>
        <p className="dev-sel-reason" data-testid="selector-read-state">
          {t(read.kind === 'WAITING' ? 'devices.selector.waitingLink' : 'devices.selector.loading')}
        </p>
      </div>
    )
  }
  if (read.kind === 'FORBIDDEN') {
    return (
      <Alert status="warning" data-testid="selector-forbidden">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t('devices.selector.forbidden')}</Alert.Title>
        </Alert.Content>
      </Alert>
    )
  }
  if (read.kind === 'NOT_READY' || read.kind === 'FAILED') return <ReadFailed kind={read.kind} onRetry={view.retry} />

  const { config, devices } = read
  const cameras = devices.devices.filter((device) => device.kind === 'CAMERA')
  const block = selectorEditGate({ resolved: view.resolved, can: view.canConfigure, locked: config.locked })
  const empty = devices.devices.length === 0 && config.cameras.length === 0 && config.mics.length === 0

  if (empty) {
    return (
      <EmptyState className="dev-sel-empty" data-testid="selector-empty">
        <Camera className="size-8 text-foreground-2" aria-hidden="true" />
        <p className="dev-tile-name">{t('devices.selector.empty')}</p>
        {/* The slot of blueprint row 137 (ux §2.5 "Empty device list", §8c.1; G13): the page's one camera search. */}
        <div data-slot="camera-search-entry" data-testid="selector-search-slot">
          <SearchCamerasButton place="selector-empty" variant="primary" reveal />
        </div>
      </EmptyState>
    )
  }

  return (
    <div className="dev-sel" data-testid="selector-ready" data-locked={config.locked ? 'true' : 'false'}>
      {config.locked ? (
        <Alert status="warning" data-testid="selector-locked">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('devices.selector.locked')}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
      <section aria-label={t('devices.selector.cameras')}>
        <h3 className="dev-sel-group">{t('devices.selector.cameras')}</h3>
        <ul className="dev-sel-list">
          {config.cameras.map((line) => (
            <CameraSourceRow
              key={line.trackId}
              line={line}
              cameras={cameras}
              block={block}
              commands={commands}
              poe={(busy) =>
                poeCycleGate({ lost: line.streamState === 'LOST', resolved: view.resolved, canManage: view.canManageDevices, recording: view.recording, busy })
              }
            />
          ))}
        </ul>
        {/* OD-12: state is text only; no decoded frame of a real camera in this phase. */}
        <p className="dev-sel-reason" data-testid="selector-no-preview">
          {t('devices.selector.noPreview')}
        </p>
      </section>
      <section aria-label={t('devices.selector.mics')}>
        <h3 className="dev-sel-group">{t('devices.selector.mics')}</h3>
        <ul className="dev-sel-list">
          {config.mics.map((line) => (
            <MicRow key={line.inputId} line={line} device={devices.devices.find((device) => device.id === line.deviceId)} block={block} commands={commands} />
          ))}
        </ul>
      </section>
    </div>
  )
}

/**
 * The capture device selector (ux §2 flow 1; WB-05): which registered camera feeds `VIDEO-01` and
 * `VIDEO-02`, and which microphone input is PRIMARY. Reads are open to every role; the edit controls
 * need `CAPTURE_CONFIG` and no open session, and show "Checking your permissions..." until the role,
 * the link and the read are resolved (E-16) — a control is disabled with its reason, never hidden.
 * Inline selects with one Save per field (operation 79) and "Make primary" (operation 80); a LOST
 * camera stream offers the confirmed PoE cycle (G9, operation 48).
 */
export function CaptureSelectorPanel() {
  const { t } = useTranslation()
  const view = useCaptureSelector()
  const commands = useCaptureSelectorCommands()

  // The System entry links here (`/devices#capture-selector`, WB-07): the page is a lazy chunk, so the
  // browser's own jump to the fragment has nothing to land on yet.
  useEffect(() => {
    if (window.location.hash !== `#${CAPTURE_SELECTOR_ANCHOR}`) return
    document.getElementById(CAPTURE_SELECTOR_ANCHOR)?.scrollIntoView?.({ block: 'start' })
  }, [])

  return (
    <DevicesPanel id="selector" anchorId={CAPTURE_SELECTOR_ANCHOR} icon={SlidersHorizontal} title={t('devices.selector.title')} subtitle={t('devices.selector.subtitle')}>
      <SelectorBody view={view} commands={commands} />
    </DevicesPanel>
  )
}
