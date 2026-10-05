import { useCallback, useMemo, type Key, type ReactNode } from 'react'
import { Button, Description, Dropdown, Label, Spinner, toast } from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { Activity, Cpu, EllipsisVertical, Info, Mic, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AudioTrackId, VideoTrackId } from '@dems/shared/domain'
import { CoreMode, settle, useCoreActions, useCoreMode } from '@dems/shared/live'
import { DeviceCommand, Permission, selectCan, useSim, type SimState } from '@dems/shared/sim'
import { motion as tokens, type StatusTone } from '@dems/shared/tokens'
import { DbfsMeter } from '@/components/composed'
import { CameraFeed } from '@/components/media'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { usePendingControl } from '@/lib/pending-control'
import { useMotionPolicy } from '@/motion'
import { DashPanel, PanelLink } from './dash-panel'
import { requiredRoleFor, TONE_TEXT_CLASS } from './dashboard-model'
import { DASH_BEATS, useBeatDelay } from './dashboard-motion'
import { reportDashboardError } from './report'
import { StatusDot } from './status-bits'

const CAMERAS: readonly VideoTrackId[] = ['VIDEO-01', 'VIDEO-02']
const MICS: readonly AudioTrackId[] = ['AUDIO-01', 'AUDIO-02']
const CAMERA_NAME_KEY = { 'VIDEO-01': 'common.devices.camera1', 'VIDEO-02': 'common.devices.camera2' } as const
const MIC_NAME_KEY = { 'AUDIO-01': 'common.devices.mic1', 'AUDIO-02': 'common.devices.mic2' } as const

const selectCamera = (id: VideoTrackId) => (s: SimState) => {
  const camera = s.cameras.find((entry) => entry.id === id)
  if (!camera) return null
  return {
    deviceId: camera.deviceId,
    online: camera.online,
    lens: camera.lens,
    resolution: camera.resolution,
    fps: camera.fps,
    recording: camera.recState === 'REC',
  }
}
const selectMic = (id: AudioTrackId) => (s: SimState) => {
  const mic = s.mics.find((entry) => entry.id === id)
  if (!mic) return null
  return { deviceId: mic.deviceId, state: mic.state, clipLatched: mic.clipLatched }
}
const selectCanManage = (s: SimState) => selectCan(s, Permission.DEVICE_MANAGE)

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
 */
function useDeviceCommand(deviceId: string, name: string): DeviceCommandControl {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const actions = useCoreActions()
  const presentCoreError = useCoreErrorPresenter()
  const words = COMMAND_WORDS[useCoreMode()]
  // LB-1: the shared pending control (`@/lib/pending-control`, plan row W0) ignores the next press at
  // once and reveals the spinner late; a command that settles in the press changes nothing.
  const { busy, pending: showPending, run } = usePendingControl()

  const onAction = useCallback(
    (key: Key) => {
      if (key === 'details') {
        void navigate({ to: '/devices' })
        return
      }
      const command = key === 'test' ? DeviceCommand.TEST_SIGNAL : DeviceCommand.RESTART
      run((release) => {
        settle(() => actions.deviceCommand(deviceId, command), {
          ok: () => {
            toast.success(t(words[command], { name }))
          },
          fail: (error) => {
            if (presentCoreError(error) !== null) return
            reportDashboardError('features/dashboard.DeviceMenu', error, COMMAND_FAILED_RECORD, { deviceId, command })
            toast.danger(t('dashboard.devices.commandFailed'))
          },
          done: release,
        })
      })
    },
    [actions, deviceId, name, navigate, presentCoreError, run, t, words],
  )
  return { busy, showPending, onAction }
}

/**
 * The tile kebab (01_specs §14.5.1 E). The commands are device management, so they follow
 * DEVICE_MANAGE (S20): a role without it sees them disabled with the required role. Every outcome
 * is a toast (`useDeviceCommand`). The words of the two commands follow the data mode (§3.2).
 */
function DeviceMenu({ name, control }: { name: string; control: DeviceCommandControl }) {
  const { t } = useTranslation()
  const words = COMMAND_WORDS[useCoreMode()]
  const canManage = useSim(selectCanManage)
  const role = requiredRoleFor(Permission.DEVICE_MANAGE)
  const needsRole = t('common.rbac.requiresRole', { role: role ? t(`common.roles.${role}`) : '' })
  const { busy, showPending, onAction } = control

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
          disabledKeys={canManage && !busy ? [] : ['test', 'restart']}
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
              {canManage ? null : <Description>{needsRole}</Description>}
            </div>
          </Dropdown.Item>
          <Dropdown.Item id="restart" textValue={t(words.restart)}>
            <RotateCw aria-hidden="true" size={16} />
            <div className="flex flex-col">
              <Label>{t(words.restart)}</Label>
              {canManage ? null : <Description>{needsRole}</Description>}
            </div>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}

function TileHead({ tone, name, state, deviceId }: { tone: StatusTone; name: string; state: string; deviceId: string }) {
  const control = useDeviceCommand(deviceId, name)
  // LB-1: the kit's Button does not pass `aria-busy` on, so the head of the tile carries it: the
  // region whose state the command changes. It is set only while a Live command is out.
  return (
    <div className="dems-tile-head" aria-busy={control.busy || undefined}>
      <StatusDot tone={tone} className="mt-1" />
      <div className="min-w-0 flex-1">
        <div className="dems-tile-name">{name}</div>
        <div className={`dems-tile-state ${TONE_TEXT_CLASS[tone]}`} data-testid={`tile-state-${deviceId}`}>
          {state}
        </div>
      </div>
      <DeviceMenu name={name} control={control} />
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
  if (!camera) return null
  const fault = !camera.online || camera.lens === 'FAULT'
  // REC is a state here (red dot, "REC"); the elapsed timer lives on the ring and in panel D.
  const tone: StatusTone = fault || camera.recording ? 'danger' : 'success'
  const state = fault
    ? t('common.status.noSignal')
    : camera.recording
      ? t('common.enums.trackRecState.REC')
      : t('common.enums.lensState.READY')
  const name = t(CAMERA_NAME_KEY[cameraId])
  return (
    <Tile index={index} beatMs={beatMs} testId={`device-tile-${cameraId}`}>
      <TileHead tone={tone} name={name} state={state} deviceId={camera.deviceId} />
      {/* The format chip sits top-left: bottom-left would cover the DEMO OSD line of the loop (N-39-3, P13). */}
      <CameraFeed
        cameraId={cameraId}
        variant="tile"
        label={t('common.devices.cameraFormat', { resolution: camera.resolution, fps: camera.fps })}
        noSignal={fault}
        ariaLabel={`${name} · ${state}`}
        className="aspect-auto min-h-0 flex-1"
      />
    </Tile>
  )
}

function MicTile({ channel, index, beatMs }: { channel: AudioTrackId; index: number; beatMs: number }) {
  const { t } = useTranslation()
  const mic = useSim(useMemo(() => selectMic(channel), [channel]))
  if (!mic) return null
  const clip = mic.state === 'CLIP' || mic.clipLatched
  const tone: StatusTone = clip ? 'danger' : mic.state === 'NO_SIGNAL' ? 'warning' : 'success'
  const state = t(`common.enums.micState.${clip ? 'CLIP' : mic.state}`)
  const name = t(MIC_NAME_KEY[channel])
  return (
    <Tile index={index} beatMs={beatMs} testId={`device-tile-${channel}`}>
      <TileHead tone={tone} name={name} state={state} deviceId={mic.deviceId} />
      <div className="dems-mic-body">
        <span className="dems-mic-ring" aria-hidden="true">
          <Mic strokeWidth={1.6} />
        </span>
        <DbfsMeter channel={channel} variant="tile" label={t(`common.tracks.${channel}`)} />
      </div>
    </Tile>
  )
}

/**
 * Panel E, Devices & Inputs (01_specs §14.5.1 E; research/04 §3.1 E): Camera 1 and Camera 2 play
 * the step-92 live-feed loops through CameraFeed (D50; muted, looped, procedural fallback), and
 * MIC 1 and MIC 2 show the tile DbfsMeter (20 Hz, zero React renders per frame). Tiles enter 60 ms
 * apart on the row-2 beat; meters are live from the first frame (M-PG-DASH t = 450).
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
