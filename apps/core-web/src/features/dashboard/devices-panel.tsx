import { useCallback, useMemo, useState, type Key, type ReactNode } from 'react'
import { AlertDialog, Button, Chip, Description, Dropdown, Label, Spinner, toast } from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { Activity, Cpu, EllipsisVertical, Info, Mic, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AUDIO_TRACK_IDS, VIDEO_TRACK_IDS, type AudioTrackId, type VideoTrackId } from '@dems/shared/domain' // D61 (2026-11-04): four audio tracks
import { CoreMode, settle, useCoreActions, useCoreMode } from '@dems/shared/live'
import { captureMicLines, DeviceCommand, meterInputOfChannel, micChannelOfTrack, noLiveLevelsOf, useSim, type SimState } from '@dems/shared/sim'
import { motion as tokens, type StatusTone } from '@dems/shared/tokens'
import { DbfsMeter } from '@/components/composed'
import { micPairLabel } from '@/features/devices/capture-selector' // Row W3T (R157-1; N-40): the pair label of a meter track, "Mic N (Camera N)"
import { ReachGatedCameraPreview } from '@/features/devices/reach-gated-preview'
import { useDocumentVisible } from '@/features/devices/idle-meter-lease'
import { useTrackReach } from '@/features/devices/track-reach'
import { trackStatus, type DeviceStatusCode } from '@/features/devices/model' // Row 129 (U-05): the one track status of both pages
import { MicSourceMarks, TrackSourceMarks } from '@/features/devices/source-badge'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { useDeviceCommandGate } from '@/lib/device-command-gate'
import { usePendingControl } from '@/lib/pending-control'
import { useMotionPolicy } from '@/motion'
import { DashPanel, PanelLink } from './dash-panel'
import { TONE_TEXT_CLASS } from './dashboard-model'
import { DASH_BEATS, useBeatDelay } from './dashboard-motion'
import { reportDashboardError } from './report'
import { StatusDot } from './status-bits'

// D60 (2026-11-04): the panel iterates the four video tracks from the shared truth.
const CAMERAS: readonly VideoTrackId[] = VIDEO_TRACK_IDS
// D61 (2026-11-04): four simultaneous microphone channels — the list derives from the shared audio-track truth.
const MICS: readonly AudioTrackId[] = AUDIO_TRACK_IDS
const CAMERA_NAME_KEY = {
  'VIDEO-01': 'common.devices.camera1',
  'VIDEO-02': 'common.devices.camera2',
  'VIDEO-03': 'common.devices.camera3', // D60
  'VIDEO-04': 'common.devices.camera4', // D60
} as const satisfies Record<VideoTrackId, string>
// D61 (2026-11-04): the four-channel microphone plane; the names come from the shared catalog.
const MIC_NAME_KEY = { 'AUDIO-01': 'common.devices.mic1', 'AUDIO-02': 'common.devices.mic2', 'AUDIO-03': 'common.devices.mic3', 'AUDIO-04': 'common.devices.mic4' } as const satisfies Record<AudioTrackId, string>

const selectCamera = (id: VideoTrackId) => (s: SimState) => {
  const camera = s.cameras.find((entry) => entry.id === id)
  if (!camera) return null
  return {
    deviceId: camera.deviceId,
    // Row 129 (DF-11 web, U-05): the Devices page's own reader - the track and the source it holds now.
    status: trackStatus(s, id),
    resolution: camera.resolution,
    fps: camera.fps,
    recording: camera.recState === 'REC',
  }
}
const selectMic = (id: AudioTrackId) => (s: SimState) => {
  const mic = s.mics.find((entry) => entry.id === id)
  if (!mic) return null
  // Task 3 M4 (blueprint row 67; WB-02; D61 of 2026-11-04): the CHANNEL of the tile in the capture configuration (slice 29).
  // Row 108 (DF-17, U-03): the channel is the one of the TRACK (`MIC-0N` feeds `AUDIO-0N`), present when a line in force
  // holds it - never found by the snapshot's device id, which can name the input of another channel (DF-31: AUDIO-03
  // carried MIC-03, the input of channel 1, so MIC 3 read "Channel 1 (transcribed)").
  const inputId = meterInputOfChannel(captureMicLines(s), id)
  const channel = inputId === null ? null : micChannelOfTrack(id)
  // Audit row W3T (R157-1; D5, S5 §6, N-40): the Active / Standby role words are gone. Operation 81 is retired and the
  // microphone of each track is fixed by its camera-microphone pair, so the tile names its pair slot (`MicTile`).
  // Row 129 (U-05): the status is the Devices page's (`trackStatus`: the channel's row, then the input it holds and
  // its reach), and the marks follow that input - not the snapshot's device id.
  return { deviceId: mic.deviceId, inputId, status: trackStatus(s, id), channel }
}

/**
 * The words of the two device commands. Simulated mode keeps its words, which say "simulated"
 * (`common.deviceMenu.*`, `dashboard.devices.*Sent`); in Live mode the Core server carries the
 * command out, so the words say nothing of a simulation (04_client_integration_spec §3.2).
 */
const COMMAND_WORDS = {
  [CoreMode.SIMULATED]: {
    test: 'common.deviceMenu.testSignal',
    restart: 'common.deviceMenu.restart',
    [DeviceCommand.TEST_SIGNAL]: 'dashboard.devices.testSignalSent',
    [DeviceCommand.RESTART]: 'dashboard.devices.restartSent',
  },
  [CoreMode.LIVE]: {
    test: 'dashboard.devices.live.testSignal',
    restart: 'dashboard.devices.live.restart',
    [DeviceCommand.TEST_SIGNAL]: 'dashboard.devices.live.testSignalSent',
    [DeviceCommand.RESTART]: 'dashboard.devices.live.restartSent',
  },
} as const

/** The fixed sentence of the page's own record when a command fails for a reason the presenter left to the page. */
const COMMAND_FAILED_RECORD = 'A device command of the Dashboard was not carried out.'

interface DeviceCommandControl {
  /** True from the press until the command settled (LB-1: further presses are ignored meanwhile). */
  readonly busy: boolean
  /** True once the command has been out for `LIVE_PENDING_REVEAL_MS`: the trigger shows its spinner. */
  readonly showPending: boolean
  readonly onAction: (key: Key) => void
  /** D100 (2): the confirmation of a camera's power cycle is open (Live mode only). */
  readonly cycleOpen: boolean
  readonly cancelCycle: () => void
  /** The operator confirmed: sends `POE_CYCLE` (operation 48 with `{ confirm: true }`). */
  readonly confirmCycle: () => void
}

/**
 * The tile kebab's actions (01_specs §14.5.1 E): Details opens Devices & Inputs; Test signal and
 * Restart are device commands.
 *
 * Live mode (backend task, plan row W63; 04_client_integration_spec §8.3 site B-7, §8.1 LB-1 to
 * LB-7, LB-10): the command goes through `useCoreActions()` and `settle`, so it reads the same in
 * both modes. The success toast shows only after the Core server answered (the Live source settles
 * in the turn of CL-16, so the tile already shows the Core's state). While the command is out the
 * two command items are disabled and the tile head is `aria-busy`, so a second press cannot send a
 * second command; after `LIVE_PENDING_REVEAL_MS` the trigger shows the kit's in-button spinner in
 * place of its icon. Every failure goes to the refusal presenter first (a 403 names the role; an
 * outage, a time-out and a 429 have the presenter's own words); what it leaves to the page (409
 * `RECORDING_ACTIVE` or `COMMAND_UNSUPPORTED`, rebuilt as `SimTransitionError`) keeps the existing
 * friendly toast and one record in the page's own log. In Simulated mode the command settles
 * before the press returns, so the look never changes and the outcome is the predecessor's.
 *
 * Integration pass D2 (decision D100 (2); C3 §3 op 48), as on the Devices page: on a Core server a
 * camera is not restarted by a plain `RESTART` (the Core refuses it). "Restart" of a camera tile
 * asks for a confirmation first and then sends `POE_CYCLE`, which the shared Live binding carries as
 * operation 48 with `{ confirm: true }`. A camera whose stream is not lost is not cycled: the Core's
 * `CAMERA_NOT_LOST` is said as what it is. Simulated mode and the microphone tiles are unchanged.
 */
function useDeviceCommand(deviceId: string, name: string, camera = false): DeviceCommandControl {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const actions = useCoreActions()
  const presentCoreError = useCoreErrorPresenter()
  const mode = useCoreMode()
  const words = COMMAND_WORDS[mode]
  const confirmedCycle = camera && mode === CoreMode.LIVE
  const [cycleOpen, setCycleOpen] = useState(false)
  // LB-1: the shared pending control (`@/lib/pending-control`, plan row W0) ignores the next press at
  // once and reveals the spinner late; a command that settles in the press changes nothing.
  const { busy, pending: showPending, run } = usePendingControl()

  const send = useCallback(
    (command: DeviceCommand) => {
      run((release) => {
        settle(() => actions.deviceCommand(deviceId, command), {
          ok: () => {
            if (command === DeviceCommand.POE_CYCLE) toast.success(t('devices.selector.poe.requested', { name }))
            else if (command === DeviceCommand.TEST_SIGNAL || command === DeviceCommand.RESTART) toast.success(t(words[command], { name }))
          },
          fail: (error) => {
            if (presentCoreError(error) !== null) return
            // C3 §3 operation 48: a camera whose stream is not lost is not cycled. Nothing was changed.
            if (command === DeviceCommand.POE_CYCLE && (error as { readonly code?: unknown } | null)?.code === 'CAMERA_NOT_LOST') {
              toast.info(t('devices.selector.poe.notLost'))
              return
            }
            reportDashboardError('features/dashboard.DeviceMenu', error, COMMAND_FAILED_RECORD, { deviceId, command })
            toast.danger(t('dashboard.devices.commandFailed'))
          },
          done: release,
        })
      })
    },
    [actions, deviceId, name, presentCoreError, run, t, words],
  )

  const onAction = useCallback(
    (key: Key) => {
      if (key === 'details') {
        void navigate({ to: '/devices' })
        return
      }
      // D100 (2): a camera's restart on a Core server is the confirmed PoE cycle; nothing is sent before the confirmation.
      if (key === 'restart' && confirmedCycle) {
        if (!busy) setCycleOpen(true)
        return
      }
      send(key === 'test' ? DeviceCommand.TEST_SIGNAL : DeviceCommand.RESTART)
    },
    [busy, confirmedCycle, navigate, send],
  )
  const cancelCycle = useCallback(() => setCycleOpen(false), [])
  const confirmCycle = useCallback(() => {
    setCycleOpen(false)
    send(DeviceCommand.POE_CYCLE)
  }, [send])
  return { busy, showPending, onAction, cycleOpen, cancelCycle, confirmCycle }
}

/**
 * The tile kebab (01_specs §14.5.1 E). Each command follows the permission the Core server checks
 * for it, as the Devices page does: Test signal (operation 49 `testDeviceSignal`) DIAGNOSTICS_RUN,
 * Restart (operation 48 `restartDevice`) DEVICE_MANAGE. A role without one sees that command
 * disabled with the first role that holds it. Ruling R3 (D201, E-fix FX-W, E2E-W1-2 = E2E-W2-1)
 * amends F63-1 (D152), which had kept Test signal under DEVICE_MANAGE (S20's grouping). Restart is
 * also disabled while a recording runs, as on the Devices page (FXR-W W92-14: one gate model for both
 * menus, `lib/device-command-gate.ts`). Every outcome is a toast (`useDeviceCommand`). The words of the two commands follow the data mode (§3.2).
 */
function DeviceMenu({ name, control }: { name: string; control: DeviceCommandControl }) {
  const { t } = useTranslation()
  const words = COMMAND_WORDS[useCoreMode()]
  const { busy, showPending, onAction } = control
  // W92-14: the one gate of both device menus (`lib/device-command-gate.ts`): each command by the
  // permission the Core checks, Restart also not while recording (409 RECORDING_ACTIVE), and LB-1
  // (while a command is out both commands are disabled).
  const gate = useDeviceCommandGate(busy)
  const disabledKeys = [...(gate.blocks.testSignal ? ['test'] : []), ...(gate.blocks.restart ? ['restart'] : [])]
  const testReason = gate.reasonOf('testSignal')
  const restartReason = gate.reasonOf('restart')

  return (
    <Dropdown>
      <Button
        isIconOnly
        variant="ghost"
        size="sm"
        className="-mr-1 -mt-1 size-7 min-w-7"
        aria-label={t('dashboard.devices.tileMenu', { name })}
        isPending={showPending}
        data-pending={showPending ? 'true' : undefined}
      >
        {showPending ? <Spinner size="sm" color="current" aria-hidden="true" /> : <EllipsisVertical aria-hidden="true" size={16} />}
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-[220px]">
        <Dropdown.Menu
          aria-label={t('common.deviceMenu.label')}
          disabledKeys={disabledKeys}
          onAction={onAction}
        >
          <Dropdown.Item id="details" textValue={t('common.deviceMenu.details')}>
            <Info aria-hidden="true" size={16} />
            <Label>{t('common.deviceMenu.details')}</Label>
          </Dropdown.Item>
          <Dropdown.Item id="test" textValue={t(words.test)}>
            <Activity aria-hidden="true" size={16} />
            <div className="flex flex-col">
              <Label>{t(words.test)}</Label>
              {testReason ? <Description>{testReason}</Description> : null}
            </div>
          </Dropdown.Item>
          <Dropdown.Item id="restart" textValue={t(words.restart)}>
            <RotateCw aria-hidden="true" size={16} />
            <div className="flex flex-col">
              <Label>{t(words.restart)}</Label>
              {restartReason ? <Description>{restartReason}</Description> : null}
            </div>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}

function TileHead({ tone, name, state, status, deviceId, camera = false }: { tone: StatusTone; name: string; state: string; status: DeviceStatusCode; deviceId: string; camera?: boolean }) {
  const { t } = useTranslation()
  const control = useDeviceCommand(deviceId, name, camera)
  // LB-1: the kit's Button does not pass `aria-busy` on, so the head of the tile carries it: the
  // region whose state the command changes. It is set only while a Live command is out.
  return (
    <div className="dems-tile-head" aria-busy={control.busy || undefined}>
      <StatusDot tone={tone} className="mt-1" />
      <div className="min-w-0 flex-1">
        <div className="dems-tile-name">{name}</div>
        {/* Row 129 (U-05): `data-status` is the Devices page's code for the same track (its tile / card `data-status`). */}
        <div className={`dems-tile-state ${TONE_TEXT_CLASS[tone]}`} data-testid={`tile-state-${deviceId}`} data-status={status}>
          {state}
        </div>
      </div>
      <DeviceMenu name={name} control={control} />
      {/* D100 (2): the confirmation of a camera's power cycle; the same words as the Devices page. Mounted only for a camera tile. */}
      {camera ? (
        <AlertDialog.Backdrop isOpen={control.cycleOpen} onOpenChange={(open) => (open ? undefined : control.cancelCycle())}>
          <AlertDialog.Container size="sm">
            <AlertDialog.Dialog aria-label={t('devices.selector.poe.confirmTitle', { name })} data-testid={`dashboard-camera-restart-dialog-${deviceId}`}>
              <AlertDialog.Header>
                <AlertDialog.Icon status="warning" />
                <AlertDialog.Heading>{t('devices.selector.poe.confirmTitle', { name })}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>{t('devices.selector.poe.confirmBody')}</p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="ghost" onPress={control.cancelCycle}>
                  {t('common.actions.cancel')}
                </Button>
                <Button variant="danger" onPress={control.confirmCycle} data-testid={`dashboard-camera-restart-confirm-${deviceId}`}>
                  {t('devices.selector.poe.confirm')}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      ) : null}
    </div>
  )
}

/** Tile enter: R1 panel motion on the row-2 beat, tiles 60 ms apart; reduced: opacity only. */
function Tile({ index, beatMs, testId, children }: { index: number; beatMs: number; testId: string; children: ReactNode }) {
  const m = useMotionPolicy()
  return (
    <motion.div
      data-testid={testId}
      className="dems-tile dems-dash-inset"
      initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: tokens.distance.rise, scale: tokens.scale.enterFrom }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...m.transitions.enter, delay: m.reduced ? 0 : m.seconds(beatMs + index * DASH_BEATS.stagger) }}
    >
      {children}
    </motion.div>
  )
}

function CameraTile({ cameraId, index, beatMs }: { cameraId: VideoTrackId; index: number; beatMs: number }) {
  const { t } = useTranslation()
  const camera = useSim(useMemo(() => selectCamera(cameraId), [cameraId]))
  // Fix wave J (JW-23 (4)): "READY" of a source the Core never checked (a camera on a dead port) reads "Not checked".
  const reach = useTrackReach(cameraId)
  // Row W4-1 (L8, D231): the tile shows the Core's live picture as Devices & Inputs does; a hidden tab closes the stream.
  const visible = useDocumentVisible()
  if (!camera) return null
  // Row 129 (DF-11 web, U-05): FAULT and OFFLINE are the Devices tile's words for the same track (`trackStatus`).
  const fault = camera.status === 'FAULT'
  const offline = camera.status === 'OFFLINE'
  const notChecked = reach === 'NOT_CHECKED' && !fault && !offline && !camera.recording
  // REC is a state here (red dot, "REC"); the elapsed timer lives on the ring and in panel D.
  const tone: StatusTone = fault || camera.recording ? 'danger' : offline ? 'warning' : notChecked ? 'default' : 'success'
  const state = fault
    ? t('common.status.noSignal')
    : offline
      ? t('devices.status.OFFLINE')
      : camera.recording
      ? t('common.enums.trackRecState.REC')
      : notChecked
        ? t('web.source.notChecked')
        : t('common.enums.lensState.READY')
  const name = t(CAMERA_NAME_KEY[cameraId])
  return (
    <Tile index={index} beatMs={beatMs} testId={`device-tile-${cameraId}`}>
      <TileHead tone={tone} name={name} state={state} status={camera.status} deviceId={camera.deviceId} camera />
      {/* Pass D2 (ux §8f.2, WB-02): the one badge of the camera that feeds this track; nothing unless the Core sent the development class. */}
      <TrackSourceMarks trackId={cameraId} place={`dashboard-${cameraId}`} />
      {/* The format chip sits top-left: bottom-left would cover the DEMO OSD line of the loop (N-39-3, P13). */}
      {/* Row W4-1 (L8, D231): the reach-gated live preview of Session New and the Session Monitor feed - no token while the
          Core states NOT_REACHABLE (the tile says "Not reachable"; the in-tile "Try again" is not drawn here, dashboard.css),
          one stream per tile while the tab is visible, closed on a hidden tab and on unmount. */}
      <ReachGatedCameraPreview
        cameraId={cameraId}
        variant="tile"
        livePreview={visible}
        // A stream that states no rate (`fps` null) reads its picture without one (task 4 row 54 / I-3, P12-F08): never nothing, never an empty rate.
        // Row V6 (S-01): a track with no stored stream statement (`resolution` null) reads "Not stated", never a default picture.
        label={camera.resolution === null ? t('common.devices.cameraFormatNotStated') : camera.fps === null ? t('common.devices.cameraFormatNoRate', { resolution: camera.resolution }) : t('common.devices.cameraFormat', { resolution: camera.resolution, fps: camera.fps })}
        noSignal={fault}
        ariaLabel={`${name} · ${state}`}
        className="aspect-auto min-h-0 flex-1"
      />
    </Tile>
  )
}

/** Row 129: the tone of a microphone tile per track status (CLIP stays red on the Dashboard, as before). */
const MIC_TILE_TONE: Partial<Record<DeviceStatusCode, StatusTone>> = {
  READY: 'success',
  NO_SIGNAL: 'warning',
  CLIP: 'danger',
  FAULT: 'danger',
  OFFLINE: 'warning',
}

function MicTile({ channel, index, beatMs }: { channel: AudioTrackId; index: number; beatMs: number }) {
  const { t } = useTranslation()
  const mic = useSim(useMemo(() => selectMic(channel), [channel]))
  // Wave H driver B (G75-04; ux §8e.2 "no meters"): no live level while the cameras connect or for a failed start.
  const noLevels = useSim((s) => noLiveLevelsOf(s.session))
  // Row W4-1 (D226 domino, routing D238): the one reader of /devices (`trackReachOf`, row W4-2) - "READY" of a microphone
  // the Core never checked reads "Not checked", as the camera tile beside it does.
  const reach = useTrackReach(channel)
  if (!mic) return null
  const notChecked = reach === 'NOT_CHECKED' && mic.status === 'READY'
  // Row 129 (U-05): the Devices card's status of this channel; a meter state keeps the meter's own words.
  const tone: StatusTone = notChecked ? 'default' : (MIC_TILE_TONE[mic.status] ?? 'warning')
  const state = notChecked
    ? t('web.source.notChecked')
    : mic.status === 'READY' || mic.status === 'NO_SIGNAL' || mic.status === 'CLIP'
      ? t(`common.enums.micState.${mic.status}`)
      : t(`devices.status.${mic.status}`)
  const name = t(MIC_NAME_KEY[channel])
  // Row W3T (R157-1; N-40): the pair slot of the tile - fixed by number, so it is named with or without an input (as the
  // Session Monitor halves, row 157). Only Pair 1 is transcribed.
  const pairLabel = micPairLabel(micChannelOfTrack(channel))
  const transcribed = pairLabel.values.n === 1
  return (
    <Tile index={index} beatMs={beatMs} testId={`device-tile-${channel}`}>
      <TileHead tone={tone} name={name} state={state} status={mic.status} deviceId={mic.deviceId} />
      {/* Pass D2 (ux §8f.2, WB-02): the one badge of the microphone behind this tile. */}
      {mic.inputId === null ? null : <MicSourceMarks inputId={mic.inputId} place={`dashboard-${channel}`} />}
      <div className="dems-mic-body" data-channel={mic.channel ?? undefined}>
        <span className="flex flex-col items-start gap-1">
          <Chip size="sm" variant="soft" color="default" className="dems-mic-role" data-testid={`device-tile-pair-${channel}`} data-channel={micChannelOfTrack(channel)} data-pair={pairLabel.values.n}>
            <Chip.Label>{t(pairLabel.key, pairLabel.values)}</Chip.Label>
          </Chip>
          {transcribed ? (
            <Chip size="sm" variant="soft" color="accent" className="dems-mic-role" data-testid={`device-tile-transcribed-${channel}`}>
              <Chip.Label>{t('devices.pairs.transcribed')}</Chip.Label>
            </Chip>
          ) : null}
        </span>
        <span className="dems-mic-ring" aria-hidden="true">
          <Mic strokeWidth={1.6} />
        </span>
        {noLevels !== null ? (
          <p className="font-mono text-caption uppercase tracking-[0.08em] text-foreground-2" role="status" data-testid={`device-tile-no-level-${channel}`}>
            {noLevels === 'CONNECTING' ? t('common.session.trackConnecting') : t('common.session.failedStart.title')}
          </p>
        ) : (
          <DbfsMeter channel={channel} variant="tile" label={t(`common.tracks.${channel}`)} />
        )}
      </div>
    </Tile>
  )
}

/**
 * Panel E, Devices & Inputs (01_specs §14.5.1 E; research/04 §3.1 E): the four video tracks (D60,
 * 2026-11-04) play the step-92 live-feed loops through CameraFeed (D50; muted, looped, procedural
 * fallback), and MIC 1 and MIC 2 show the tile DbfsMeter (20 Hz, zero React renders per frame).
 * Tiles enter 60 ms apart on the row-2 beat; meters are live from the first frame (M-PG-DASH t = 450).
 */
export function DevicesPanel() {
  const { t } = useTranslation()
  const beatMs = useBeatDelay(DASH_BEATS.row2 + DASH_BEATS.stagger)
  return (
    <DashPanel
      id="e"
      beatMs={DASH_BEATS.row2 + DASH_BEATS.stagger}
      title={t('dashboard.devices.title')}
      icon={Cpu}
      action={<PanelLink to="/devices">{t('dashboard.devices.viewAll')}</PanelLink>}
    >
      <div className="dems-dash-tiles">
        {CAMERAS.map((id, index) => (
          <CameraTile key={id} cameraId={id} index={index} beatMs={beatMs} />
        ))}
        {MICS.map((id, index) => (
          <MicTile key={id} channel={id} index={CAMERAS.length + index} beatMs={beatMs} />
        ))}
      </div>
    </DashPanel>
  )
}
