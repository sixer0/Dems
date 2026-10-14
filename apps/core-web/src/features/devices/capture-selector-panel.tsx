import { useEffect, useState } from 'react'
import { Alert, AlertDialog, Button, Chip, EmptyState, Label, ListBox, Select, Skeleton, Spinner, toast } from '@heroui/react'
import { Camera, Mic, Power, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { VideoTrackId } from '@dems/shared/domain'
import { useRetryCooldown } from '@dems/shared/realtime'
import { selectIsRecording, useSim } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { usePendingControl } from '@/lib/pending-control'
import {
  CAPTURE_SELECTOR_ANCHOR,
  micPairFor,
  poeCycleGate,
  selectorEditGate,
  selectorRefusal,
  selectorSlotRows,
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
import { AdoptedCameraTest } from './adopted-camera-test-control'
import { cameraAssignmentOf, profileWords, storedProfilesOf } from './camera-profile'
import { SearchCamerasButton } from './camera-search-context'
import { DevicesPanel } from './panel'
import { reportDevicesError } from './report'
import { slotRefusalWording, type SlotSourceKind } from './slot-refusal'
import { DeviceSourceBadge, LocalMicrophoneLimit } from './source-badge'
import { micTransportShown, sourceDeviceText } from './own-core-words'
import { isDevelopmentSource, LOCAL_DEVICE_ADAPTER, useRealCapture, useRealCaptureCore } from './source-class'
import { checkedAtOf, sourceLineState } from './source-state'
import { SourceStateChips } from './source-state-chips'

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
function useFailureNotice(kind: SlotSourceKind): (failure: SelectorFailure) => string | null {
  const { t } = useTranslation()
  const presentCoreError = useCoreErrorPresenter()
  return (failure) => {
    switch (selectorRefusal(failure)) {
      case 'LOCKED':
        // OD-10: an explained state, never an error toast; the Core wrote no audit row.
        return t('devices.selector.locked')
      case 'DEVELOPMENT_ONLY':
      case 'INVALID': {
        // Task 4 row 234: every `422` says its reason (`slot-refusal.ts`), by the word of `details.reason`.
        const wording = slotRefusalWording(failure.reason)
        if (wording.kind === 'DEVELOPMENT_ONLY') return t('devices.selector.developmentOnly')
        // ONE SOURCE (decision C80): the shared group, with the noun of the refused row; a sentence without `{{source}}` ignores it.
        if (wording.kind === 'SHARED') return t(`common.captureSlotRefusal.${wording.reason}`, { source: t(`common.captureSlotSource.${kind}`) })
        if (wording.kind === 'CODE') return `${t('devices.selector.invalid')} ${t('web.captureSlotRefusal.code', { code: wording.code })}`
        return t('devices.selector.invalid')
      }
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

/**
 * The state chips of a selector line. Fix wave I (G70b-06; `source-state.ts`): on a Core in real
 * capture "Stream live" is said only while a session is recording, and a device the Core has not
 * read since it started is "Not checked". A simulated Core is drawn as before.
 */
function StateChips({ online, streamState, device }: { online: boolean; streamState?: 'LIVE' | 'LOST' | null; device?: CaptureDevice | undefined }) {
  const realCapture = useRealCaptureCore()
  const recording = useSim(selectIsRecording)
  return <SourceStateChips state={sourceLineState({ realCapture, recording, online, streamState, checkedAt: checkedAtOf(device) })} />
}

/** Fix wave L (G75d-06): the id and what may be said after it - on a Core in real capture a generated source is named as generated (`own-core-words.ts`). */
function useDeviceText(): (device: Pick<CaptureDevice, 'id' | 'model'> & { readonly adapter?: string | null | undefined }) => string {
  const { t } = useTranslation()
  const realCaptureCore = useRealCaptureCore()
  return (device) => sourceDeviceText(t, device, realCaptureCore)
}

interface RowShared {
  block: SelectorEditBlock | null
  commands: CaptureSelectorCommands
}

/**
 * The key of the option "Not assigned" in a source select (task 4 row 31; decision C18 (3)). It is
 * the value of a row whose slot holds no line, and the choice that clears a held slot (operation
 * 78, member `unassign`). Not a device id: the registry's ids carry no colon.
 */
const NOT_ASSIGNED_KEY = 'slot:not-assigned'

/**
 * One VIDEO slot of the selector (task 4 row 31, site W1). `line: null` is the slot not assigned:
 * the row is drawn all the same, says so, and offers the registered cameras with "Assign" - the
 * camera command of an assigned row (operation 79). A held slot offers "Not assigned" among its
 * sources; saving that choice is `unassign`.
 */
function CameraSourceRow({
  slot: trackId,
  line,
  cameras,
  block,
  commands,
  poe,
}: RowShared & { slot: VideoTrackId; line: CaptureCameraLine | null; cameras: readonly CaptureDevice[]; poe: (busy: boolean) => PoeCycleGate }) {
  const { t } = useTranslation()
  const reasonOf = useBlockReason()
  const notice = useFailureNotice('CAMERA')
  const save = usePendingControl()
  const cycle = usePendingControl()
  // The element refs, taken apart from the controls (the pressed button carries `aria-busy`).
  const { ref: saveRef } = save
  const { ref: cycleRef } = cycle
  // `null`: the control follows the Core's line. Nothing is optimistic (ux §2.2 step 4).
  const [choice, setChoice] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const track = t(`common.tracks.${trackId}`)
  const held = line?.deviceId ?? NOT_ASSIGNED_KEY
  const selected = choice ?? held
  const realCapture = useRealCapture()
  const deviceText = useDeviceText()
  // An option of a development source says so in its own text (ux §8f.2 "each option of the source selects").
  const optionText = (device: CaptureDevice): string =>
    realCapture && isDevelopmentSource(device) ? `${deviceText(device)} · ${t('common.sourceClass.badge')}` : deviceText(device)
  const current = line === null ? undefined : cameras.find((device) => device.id === line.deviceId)
  const name = current ? deviceText(current) : (line?.deviceId ?? '')
  const reason = reasonOf(block)
  // Task 4 row W5 (review 060d Q-02; decision C36; `camera-profile.ts`): a PRODUCTION camera on a Core in real
  // capture is assigned with one of its STORED stream profiles - offered with what each is, chosen by the
  // operator, sent with the assignment. Any other camera (`PLAIN`) is assigned exactly as before.
  const realCaptureCore = useRealCaptureCore()
  const chosenDevice = selected === NOT_ASSIGNED_KEY ? undefined : cameras.find((device) => device.id === selected)
  const assignment = cameraAssignmentOf({
    realCapture: realCaptureCore,
    device: chosenDevice,
    profiles: storedProfilesOf(chosenDevice),
    heldProfile: line !== null && line.deviceId === selected ? line.profile : null,
  })
  // The operator's own choice of a profile, for the camera it was made for; another camera starts from its own preselection.
  const [profileChoice, setProfileChoice] = useState<{ readonly deviceId: string; readonly profile: string } | null>(null)
  const profile =
    assignment.kind !== 'CHOOSE'
      ? null
      : profileChoice !== null && profileChoice.deviceId === selected && assignment.profiles.includes(profileChoice.profile)
        ? profileChoice.profile
        : assignment.preselected
  // The same camera with another of its profiles is an edit too.
  const profileDirty = assignment.kind === 'CHOOSE' && line !== null && line.deviceId === selected && profile !== null && profile !== line.profile
  const dirty = selected !== held || profileDirty
  // Nothing is sent for a production camera without a chosen profile: the Core would refuse it (C36).
  const assignable = assignment.kind === 'PLAIN' || selected === NOT_ASSIGNED_KEY || (assignment.kind === 'CHOOSE' && profile !== null)
  const profileHint =
    selected === NOT_ASSIGNED_KEY || assignment.kind === 'PLAIN'
      ? null
      : assignment.kind === 'NO_PROFILE'
        ? t('web.cameraProfile.none')
        : assignment.profiles.length === 1
          ? t('web.cameraProfile.one')
          : t('web.cameraProfile.choose', { count: assignment.profiles.length })
  const poeGate = poe(cycle.busy)

  const settled = (answer: SelectorAnswer, ok: string) => {
    if (answer.ok) {
      setChoice(null)
      setProfileChoice(null)
      setMessage(null)
      toast.success(ok)
      return
    }
    setMessage(notice(answer))
  }

  const onSave = () => {
    if (!assignable) return
    save.run((release) => {
      void (selected === NOT_ASSIGNED_KEY
        ? commands.unassign(trackId)
        : assignment.kind === 'CHOOSE' && profile !== null
          ? commands.setCameraSource(selected, trackId, profile)
          : commands.setCameraSource(selected, trackId)
      )
        .then((answer) => settled(answer, t('devices.selector.saved')))
        .finally(release)
    })
  }

  const onCycle = () => {
    if (line === null) return
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
    <li
      className="dev-sel-row"
      data-testid={`selector-camera-${trackId}`}
      data-selector-slot={trackId}
      data-state={line === null ? 'NOT_ASSIGNED' : 'ASSIGNED'}
      data-device={line?.deviceId}
      data-stream={line?.streamState}
      aria-busy={save.busy || cycle.busy || undefined}
    >
      <div className="dev-sel-head">
        <Camera className="dev-sel-icon" aria-hidden="true" strokeWidth={1.75} />
        <div className="dev-sel-titles">
          <span className="dev-tile-name">{track}</span>
          {line === null ? (
            <span className="dev-tile-sub" data-testid={`selector-not-assigned-${trackId}`}>
              {trackId} · {t('common.captureSlot.notAssigned')}
            </span>
          ) : (
            <span className="dev-tile-sub">
              {trackId} · {name} · {t('devices.selector.profile', { profile: line.profile })}
            </span>
          )}
        </div>
        {/* An empty slot has no device: no state is said of it and no badge is drawn. */}
        {line === null ? null : <StateChips online={line.online} streamState={line.streamState} device={current} />}
        {/* Flow 12 (R-11): the one badge, from the `sourceClass` the Core sent for the device of this line. */}
        {line === null ? null : <DeviceSourceBadge device={current} testId={`selector-badge-${trackId}`} />}
      </div>
      <div className="dev-sel-edit">
        <Select
          value={selected}
          onChange={(key) => {
            if (typeof key === 'string') setChoice(key === held ? null : key)
          }}
          isDisabled={block !== null || save.busy}
          className="dev-sel-select"
          data-testid={`selector-source-${trackId}`}
        >
          <Label>{line === null ? t('common.captureSlot.assignLabel', { slot: t(`common.captureSlot.${trackId}`) }) : t('devices.selector.sourceLabel', { track })}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item key={NOT_ASSIGNED_KEY} id={NOT_ASSIGNED_KEY} textValue={t('common.captureSlot.notAssigned')}>
                {t('common.captureSlot.notAssigned')}
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {cameras.map((device) => (
                <ListBox.Item key={device.id} id={device.id} textValue={optionText(device)}>
                  {optionText(device)}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        {/* Row W5 (Q-02): the stored stream profiles of a production camera, each by what it is. ONE stored profile is
            preselected and still shown; nothing is offered for a camera the Core holds no profile for (the hint says why). */}
        {assignment.kind === 'CHOOSE' && selected !== NOT_ASSIGNED_KEY ? (
          <Select
            value={profile}
            onChange={(key) => {
              if (typeof key === 'string') setProfileChoice({ deviceId: selected, profile: key })
            }}
            placeholder={t('web.cameraProfile.placeholder')}
            isDisabled={block !== null || save.busy}
            className="dev-sel-select"
            data-testid={`selector-profile-${trackId}`}
            data-profile={profile ?? undefined}
          >
            <Label>{t('web.cameraProfile.label', { track })}</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {assignment.profiles.map((code) => (
                  <ListBox.Item key={code} id={code} textValue={profileWords(t, code)}>
                    {profileWords(t, code)}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        ) : null}
        <Button ref={saveRef} size="sm" variant="primary" isDisabled={block !== null || !dirty || !assignable} isPending={save.pending} onPress={onSave} data-testid={`selector-save-${trackId}`}>
          {save.pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
          {line === null ? t('common.captureSlot.assign') : t('devices.selector.save')}
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
      {profileHint ? (
        <p className="dev-sel-reason" data-testid={`selector-profile-hint-${trackId}`} data-profile-state={assignment.kind}>
          {profileHint}
        </p>
      ) : null}
      {/* Row W6 (operation 108; C117): the remedy the sentence names - the connection test of the adopted camera stores what its stream states. */}
      {assignment.kind === 'NO_PROFILE' && chosenDevice !== undefined ? <AdoptedCameraTest deviceId={chosenDevice.id} place={`selector-${trackId}`} isDisabled={block !== null || save.busy} /> : null}
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

/**
 * One microphone line of the selector. Wave H (G70-02, ruling D196): the line offers EVERY
 * registered microphone (`mics`) for its role - PRIMARY and STANDBY alike - with one Save, which is
 * operation 78 in its pair-replacement form (`micPairFor`). The other line's microphone is a
 * disabled option that says where it is (the contract refuses one microphone on both lines).
 * "Make primary" (operation 80) stays as it was. Both controls keep the selector's gates.
 *
 * Task 4 row 31 (sites W1, W2; rule MIC-ASSIGN, ruling C21 (8)): the row is a SLOT (a role).
 * `line: null` is the role not assigned: the row is drawn, says so, and its Save is "Assign" - one
 * line by role when the other role is empty too, the pair when it is held (`micPairFor`). A held
 * slot offers "Not assigned" among its microphones; saving that choice is `unassign`.
 */
function MicRow({
  slot: role,
  line,
  device,
  mics,
  lines,
  block,
  commands,
}: RowShared & { slot: CaptureMicLine['role']; line: CaptureMicLine | null; device: CaptureDevice | undefined; mics: readonly CaptureDevice[]; lines: readonly CaptureMicLine[] }) {
  const { t } = useTranslation()
  const reasonOf = useBlockReason()
  const notice = useFailureNotice('MIC')
  const control = usePendingControl()
  const { ref: controlRef } = control
  const save = usePendingControl()
  const { ref: saveRef } = save
  const realCapture = useRealCapture()
  const [message, setMessage] = useState<string | null>(null)
  // `null`: the control follows the Core's line. Nothing is optimistic (ux §2.2 step 4).
  const [choice, setChoice] = useState<string | null>(null)
  const [pairMessage, setPairMessage] = useState<string | null>(null)
  const primary = role === 'PRIMARY'
  const reason = reasonOf(block)
  const other = lines.find((entry) => entry.role !== role)
  const held = line?.deviceId ?? NOT_ASSIGNED_KEY
  const selected = choice ?? held
  const clears = choice === NOT_ASSIGNED_KEY
  const pair = choice === null || clears ? null : micPairFor(lines, role, choice)
  // The id of the row's marks: the input of the line, or the role of an empty slot.
  const rowId = line?.inputId ?? role
  const lineLabel = line === null ? t('common.captureSlot.assignLabel', { slot: t(`common.captureSlot.${role}`) }) : t(`devices.micLines.label.${role}`)
  const deviceText = useDeviceText()
  const transportShown = micTransportShown(useRealCaptureCore(), device)
  // An option says what the Core says of the microphone (the development class, this Mac's microphone) and where it already is.
  const optionText = (entry: CaptureDevice): string => {
    const parts = [deviceText(entry)]
    if (realCapture && isDevelopmentSource(entry)) {
      if (entry.adapter === LOCAL_DEVICE_ADAPTER) parts.push(t('common.sourceClass.kind.localMicrophone'))
      parts.push(t('common.sourceClass.badge'))
    }
    if (other !== undefined && entry.id === other.deviceId) parts.push(t(`devices.micLines.onOtherLine.${other.role}`))
    return parts.join(' · ')
  }

  const onSavePair = () => {
    if (pair === null && !clears) return
    save.run((release) => {
      void (pair === null ? commands.unassign(role) : commands.setMicPair(pair))
        .then((answer) => {
          if (answer.ok) {
            setChoice(null)
            setPairMessage(null)
            toast.success(t('devices.selector.saved'))
          } else setPairMessage(notice(answer))
        })
        .finally(release)
    })
  }

  const onMakePrimary = () => {
    if (line === null) return
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
    <li
      className="dev-sel-row"
      data-testid={`selector-mic-${rowId}`}
      data-selector-slot={role}
      data-state={line === null ? 'NOT_ASSIGNED' : 'ASSIGNED'}
      data-role={role}
      aria-busy={control.busy || save.busy || undefined}
    >
      <div className="dev-sel-head">
        <Mic className="dev-sel-icon" aria-hidden="true" strokeWidth={1.75} />
        {line === null ? (
          <div className="dev-sel-titles">
            <span className="dev-tile-name">{t(`common.captureSlot.${role}`)}</span>
            <span className="dev-tile-sub" data-testid={`selector-not-assigned-${role}`}>
              {t('common.captureSlot.notAssigned')}
            </span>
          </div>
        ) : (
          <div className="dev-sel-titles">
            <span className="dev-tile-name">{line.inputId}</span>
            <span className="dev-tile-sub">
              {deviceText(device ?? { id: line.deviceId, model: null })}
              {/* Closing pass L-Z (the ONE RULE; remainder R-4 of note 154): "USB input" is the dataset's word for the built-in
                  microphones - a GENERATED source of a Core in real capture has no USB input, so the word is not drawn (as on the devices). */}
              {transportShown ? ` · ${t('devices.selector.transport', { transport: line.transport })}` : null}
            </span>
          </div>
        )}
        <span className="dev-sel-chips">
          <Chip size="sm" variant="soft" color={primary ? 'accent' : 'default'} data-testid={`selector-role-${rowId}`}>
            <Chip.Label>{t(`devices.selector.role.${role}`)}</Chip.Label>
          </Chip>
        </span>
        {/* An empty slot has no device: no state is said of it and no badge is drawn. */}
        {line === null ? null : <StateChips online={line.online} device={device} />}
        {line === null ? null : <DeviceSourceBadge device={device} testId={`selector-badge-${line.inputId}`} />}
      </div>
      {/* R69-07 (D161): the limit of this Mac's microphone, on the line where it is chosen. */}
      {line === null ? null : <LocalMicrophoneLimit device={device} place={`selector-${line.inputId}`} className="dev-sel-reason" />}
      <div className="dev-sel-edit">
        <Select
          value={selected}
          onChange={(key) => {
            if (typeof key === 'string') setChoice(key === held ? null : key)
          }}
          isDisabled={block !== null || save.busy}
          className="dev-sel-select"
          data-testid={`selector-mic-source-${role}`}
        >
          <Label>{lineLabel}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item key={NOT_ASSIGNED_KEY} id={NOT_ASSIGNED_KEY} textValue={t('common.captureSlot.notAssigned')}>
                {t('common.captureSlot.notAssigned')}
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {mics.map((entry) => (
                <ListBox.Item key={entry.id} id={entry.id} textValue={optionText(entry)} isDisabled={other !== undefined && entry.id === other.deviceId}>
                  {optionText(entry)}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Button ref={saveRef} size="sm" variant="primary" isDisabled={block !== null || (pair === null && !clears)} isPending={save.pending} onPress={onSavePair} data-testid={`selector-mic-save-${role}`}>
          {save.pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
          {line === null ? t('common.captureSlot.assign') : t('devices.selector.save')}
        </Button>
        {primary || line === null ? null : (
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
        )}
      </div>
      {/* The limit of this Mac's microphone at the moment it is chosen, before the Save (R69-07, D161). */}
      {choice === null ? null : <LocalMicrophoneLimit device={mics.find((entry) => entry.id === choice)} place={`choice-${role}`} className="dev-sel-reason" />}
      {reason ? (
        <p className="dev-sel-reason" data-testid={`selector-reason-${rowId}`} data-block={block?.kind}>
          {reason}
        </p>
      ) : null}
      {message ? (
        <p className="dev-sel-message" role="alert" data-testid={`selector-message-${rowId}`}>
          {message}
        </p>
      ) : null}
      {pairMessage ? (
        <p className="dev-sel-message" role="alert" data-testid={`selector-mic-message-${role}`}>
          {pairMessage}
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
  const microphones = devices.devices.filter((device) => device.kind === 'MIC')
  const block = selectorEditGate({ resolved: view.resolved, can: view.canConfigure, locked: config.locked })
  const empty = devices.devices.length === 0 && config.cameras.length === 0 && config.mics.length === 0
  // Task 4 row 31 (decision C18 (3)): one row per SLOT - a slot no line names is drawn too.
  const rows = selectorSlotRows(config)

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
          {rows.cameras.map(({ slot, line }) => (
            <CameraSourceRow
              key={slot}
              slot={slot}
              line={line}
              cameras={cameras}
              block={block}
              commands={commands}
              poe={(busy) =>
                poeCycleGate({ lost: line?.streamState === 'LOST', resolved: view.resolved, canManage: view.canManageDevices, recording: view.recording, busy })
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
          {rows.mics.map(({ slot, line }) => (
            <MicRow
              key={line?.inputId ?? slot}
              slot={slot}
              line={line}
              device={line === null ? undefined : devices.devices.find((device) => device.id === line.deviceId)}
              mics={microphones}
              lines={config.mics}
              block={block}
              commands={commands}
            />
          ))}
        </ul>
      </section>
    </div>
  )
}

/**
 * The capture device selector (ux §2 flow 1; WB-05): which registered camera feeds `VIDEO-01` and
 * `VIDEO-02`, which registered microphone is on the PRIMARY and on the STANDBY line (wave H, G70-02:
 * operation 78, pair replacement), and which microphone input is PRIMARY. Reads are open to every role; the edit controls
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
