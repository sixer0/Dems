/**
 * Devices & Inputs page (step 48; masterplan/01_specs.md §14.5.4; research/04 §5.2 and MB 7;
 * 03_motion_spec M-PG-DEV). Replaces the step-38 stub: the export name `DevicesPage` and the
 * root `data-testid="page-devices"` are the route contract (implementation/19_app_shell.md §2).
 *
 * Layout (research/04 §5.2, 12 columns at ≥ 1280 px):
 *   [Camera Devices 8] [Summary 4]
 *   [Audio Inputs 8]   [Other Devices 4]
 *   [Camera Search 12]             (task 3 R-9 / R-10, blueprint row 137)
 *   [Capture Device Selector 12]   (task 3 M4, blueprint row 67)
 *   [Front Panel 5]    [Port Map 7]
 * plus the device Drawer (Overview, Health, Log). Simulator gaps are handled locally in
 * `sim-adapter.ts` (the simulator's device views, W48-1..5, step 54).
 *
 * Live mode (backend task, plan row W70; 04_client_integration_spec §8.3 B-7, §8.4 D-5, §8.1 LB-1
 * to LB-7, LB-10): the kebab commands go through `useCoreActions()` and `settle`, so one call site
 * serves both modes. The menu closes at the press (the kit's `Dropdown`). The outcome follows the
 * Core's answer: the success toast and, for Identify, the local blink (D-5) run in `ok`. While a
 * command is out its device is in `pending`: the device's command items are disabled and its tile
 * head is `aria-busy`, so a second press cannot send a second command, and after
 * `LIVE_PENDING_REVEAL_MS` the kebab shows the kit's spinner in place of its icon (LB-1). Every
 * failure goes to the refusal presenter first (a 403 names the role, an outage, a time-out and a
 * 429 have the presenter's words); what it leaves to the page (409 `RECORDING_ACTIVE` or
 * `COMMAND_UNSUPPORTED`, rebuilt as `SimTransitionError`) keeps the existing friendly toast and one
 * record in the page's own log. In Simulated mode the command settles before the press returns:
 * nothing is ever pending and the outcome is the predecessor's.
 *
 * Restart of a CAMERA in Live mode (task 3, decision D100 (2); C3 §3 operation 48; OD-22): for a
 * camera the Core's restart is a PoE power cycle that needs `{ confirm: true }` and a LOST stream. The
 * kebab's Restart of a camera therefore asks for the confirmation here and then sends the device
 * command `POE_CYCLE`, which the shared Live source sends as operation 48 with `{ confirm: true }` —
 * through the same command path as every other device command (LB-1, CL-22, the presenter). A camera
 * whose stream is not lost is refused by the Core (`409 CAMERA_NOT_LOST`) and said so.
 * Microphones and the other devices keep the plain restart, and Simulated mode is unchanged.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertDialog, Button, toast } from '@heroui/react'
import { AudioLines, Cable, Camera, Cpu, LayoutGrid, MonitorCog, Video } from 'lucide-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { settle, useCoreActions } from '@dems/shared/live'
import { DeviceCommand } from '@dems/shared/sim'
import { useRealCaptureCore } from './source-class'
import { PageHeader } from '@/components/shell/page-header'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { useMotionPolicy } from '@/motion'
import { useWebLive } from '@/runtime'
import { AudioCards } from './audio-cards-panel'
import { AudioInputCard } from './audio-input-card'
import { CameraSearchProvider, SearchCamerasButton } from './camera-search-context'
import { CameraSearchPanel } from './camera-search-panel'
import { CameraTile } from './camera-tile'
import { CaptureNoticesStrip } from './capture-notices'
import { CAPTURE_SELECTOR_ANCHOR } from './capture-selector'
import { CaptureSelectorPanel } from './capture-selector-panel'
import {
  DeviceActionsContext,
  IdentifyContext,
  MicSamplerContext,
  usePageMicSampler,
  type DeviceAction,
  type IdentifyValue,
} from './context'
import { DeviceDrawer } from './device-drawer'
import { DevicesBanner } from './devices-banner'
import { FrontPanel } from './front-panel'
import { useDeviceLabels } from './labels'
import { DEVICE_COMMAND_OF, useDeviceWords } from './live'
import { MicRescan } from './mic-rescan'
import { PANEL_BEAT_MS, ROW_STAGGER_MS, useHeroBloomDelayMs, useStaggerVariants } from './motion'
import { COUNTED_DEVICES } from './model'
import { OtherDevices } from './other-devices'
import { DevicesPanel } from './panel'
import { PortMap } from './port-map'
import { RegisteredDeviceDrawer } from './registered-device-drawer'
import { RegisteredDevices } from './registered-devices'
import { BUILT_IN_SOURCE_IDS } from './registered-devices-model'
import { reportDevicesError } from './report'
import { IDENTIFY_BLINKS, IDENTIFY_PERIOD_MS, type DeviceId } from './sim-adapter'
import { SummaryCards } from './summary-cards'
import './devices.css'

/** The fixed sentence of the page's own record when a command fails for a reason the presenter left to the page. */
const COMMAND_FAILED_RECORD = 'A device command of Devices & Inputs was not carried out.'
const NO_DEVICE: ReadonlySet<DeviceId> = new Set()

function withDevice(set: ReadonlySet<DeviceId>, deviceId: DeviceId): ReadonlySet<DeviceId> {
  return set.has(deviceId) ? set : new Set([...set, deviceId])
}

function withoutDevice(set: ReadonlySet<DeviceId>, deviceId: DeviceId): ReadonlySet<DeviceId> {
  if (!set.has(deviceId)) return set
  const next = new Set(set)
  next.delete(deviceId)
  return next
}

export function DevicesPage() {
  const { t } = useTranslation()
  // Fix wave K (C-2, ruling D222 (2)): the Cameras panel names no camera model of the simulator on a Core in real capture.
  const realCaptureCore = useRealCaptureCore()
  const m = useMotionPolicy()
  const labels = useDeviceLabels()
  const actions = useCoreActions()
  const presentCoreError = useCoreErrorPresenter()
  const words = useDeviceWords()
  const sampler = usePageMicSampler()
  const [drawerId, setDrawerId] = useState<DeviceId | null>(null)
  const [identify, setIdentify] = useState<IdentifyValue>({ deviceId: null, key: 0 })
  // LB-1: the ref answers the next press at once; the state drives the look (Live mode only).
  const inFlight = useRef(new Set<DeviceId>())
  const [pending, setPending] = useState<ReadonlySet<DeviceId>>(NO_DEVICE)
  // D100 (2): the camera whose PoE cycle waits for the operator's confirmation (Live mode only).
  const live = useWebLive()
  const [cycleFor, setCycleFor] = useState<DeviceId | null>(null)
  // Row 140 (D137 (2)): the registered device beyond the built-in ids whose details are open ("View device").
  const [registeredId, setRegisteredId] = useState<string | null>(null)

  // R3: the hero (the two large meters) finishes last with one glow bloom on its panel.
  const bloomDelayMs = useHeroBloomDelayMs()
  const [bloom, setBloom] = useState(0)
  useEffect(() => {
    if (bloomDelayMs === null) return undefined
    const timer = setTimeout(() => setBloom(1), bloomDelayMs)
    return () => clearTimeout(timer)
  }, [bloomDelayMs])

  // Identify ends after its three blinks (the sim audits it as a DEVICE_COMMAND, step 54).
  useEffect(() => {
    if (identify.deviceId === null) return undefined
    const timer = setTimeout(
      () => setIdentify((current) => (current.key === identify.key ? { ...current, deviceId: null } : current)),
      m.seconds(IDENTIFY_BLINKS * IDENTIFY_PERIOD_MS) * 1000 + 120,
    )
    return () => clearTimeout(timer)
  }, [identify, m])

  /** Sends one device command and follows the Core's answer (LB-1, rule 2). One command per device at a time. */
  const send = useCallback(
    (deviceId: DeviceId, command: DeviceCommand) => {
      // LB-1: one command per device at a time; a press while one is out sends nothing.
      if (inFlight.current.has(deviceId)) return
      const name = labels.name(deviceId)
      inFlight.current.add(deviceId)
      let settled = false
      settle(() => actions.deviceCommand(deviceId, command), {
        ok: () => {
          switch (command) {
            case DeviceCommand.IDENTIFY:
              // D-5: the local blink starts when the Core accepted the command.
              setIdentify((current) => ({ deviceId, key: current.key + 1 }))
              toast.info(t('devices.actions.identifying', { name }))
              break
            case DeviceCommand.TEST_SIGNAL:
              toast.success(t(words.testSignalSent, { name }))
              break
            case DeviceCommand.RESTART:
              toast.success(t(words.restarted, { name }))
              break
            case DeviceCommand.POE_CYCLE:
              toast.success(t('devices.selector.poe.requested', { name }))
              break
          }
        },
        fail: (error) => {
          // Rule 2 of the page rows: the presenter first (a 403, an outage, a time-out, a 429).
          if (presentCoreError(error) !== null) return
          // C3 §3 operation 48: a camera whose stream is not lost is not cycled. Said as what it is; nothing was changed.
          if ((error as { readonly code?: unknown } | null)?.code === 'CAMERA_NOT_LOST') {
            toast.info(t('devices.selector.poe.notLost'))
            return
          }
          // Layer 1: a friendly toast; layer 2: the structured record; layer 3: the page keeps working.
          reportDevicesError('features/devices.run', error, COMMAND_FAILED_RECORD, { deviceId, command })
          toast.danger(t('devices.actions.failed'))
        },
        done: () => {
          settled = true
          inFlight.current.delete(deviceId)
          setPending((current) => withoutDevice(current, deviceId))
        },
      })
      // A Live command is out: show it. A Simulated one has settled already, so nothing changes.
      if (!settled) setPending((current) => withDevice(current, deviceId))
    },
    [actions, labels, presentCoreError, t, words],
  )

  const run = useCallback(
    (deviceId: DeviceId, action: DeviceAction) => {
      if (action === 'details') {
        setDrawerId(deviceId)
        return
      }
      if (inFlight.current.has(deviceId)) return
      // D100 (2): a camera's restart on a Core server is the confirmed PoE cycle; the confirmation is asked for first.
      if (action === 'restart' && live !== null && (deviceId === 'CAM-01' || deviceId === 'CAM-02')) {
        setCycleFor(deviceId)
        return
      }
      send(deviceId, DEVICE_COMMAND_OF[action])
    },
    [live, send],
  )

  /** The confirmed PoE cycle of a camera: the same command path as every other device command, with `POE_CYCLE`. */
  const confirmCycle = useCallback(() => {
    const deviceId = cycleFor
    setCycleFor(null)
    if (deviceId !== null) send(deviceId, DeviceCommand.POE_CYCLE)
  }, [cycleFor, send])
  const deviceActions = useMemo(() => ({ open: setDrawerId, run, pending }), [run, pending])
  // "View device" of a found camera that is already registered: the drawer for a device this page
  // draws (CAM-01, CAM-02). Row 140: an added or local device (`CAM-03`, `MIC-03`) opens its own
  // details, built from the Core's device list; the drawer shows nothing for an id that list does
  // not hold, so the selector (where a registered camera is an option) is scrolled to as before.
  const viewDevice = useCallback((deviceId: string) => {
    if ((COUNTED_DEVICES as readonly string[]).includes(deviceId)) {
      setDrawerId(deviceId as DeviceId)
      return
    }
    if (!BUILT_IN_SOURCE_IDS.includes(deviceId)) setRegisteredId(deviceId)
    document.getElementById(CAPTURE_SELECTOR_ANCHOR)?.scrollIntoView?.({ block: 'start' })
  }, [])
  const camerasStagger = useStaggerVariants(PANEL_BEAT_MS.cameras, ROW_STAGGER_MS)
  const audioStagger = useStaggerVariants(PANEL_BEAT_MS.audio, ROW_STAGGER_MS)

  return (
    <DeviceActionsContext value={deviceActions}>
      <IdentifyContext value={identify}>
        <MicSamplerContext value={sampler}>
          {/* Task 3 R-9 / R-10 (blueprint row 137): ONE camera search and ONE microphone re-read for the page (G13, G17). */}
          <CameraSearchProvider>
          <div className="dems-page dev-page" data-testid="page-devices">
            <PageHeader
              icon={Camera}
              title={t('devices.title')}
              subtitle={t('devices.subtitle')}
              status={
                <span className="dev-header-status">
                  <SearchCamerasButton place="header" reveal />
                  <DevicesBanner />
                </span>
              }
            />

            {/* Flow 11 (R-10): what the Core could not find, for everyone, each with "Search again". */}
            <CaptureNoticesStrip />

            <div className="dev-grid">
              <DevicesPanel id="cameras" icon={Video} title={t('devices.cameras.title')} subtitle={realCaptureCore ? t('web.realCore.devices.camerasSubtitle') : t('devices.cameras.subtitle')}>
                <motion.div className="dev-cams" variants={camerasStagger} initial="hidden" animate="visible">
                  <CameraTile cameraId="VIDEO-01" lens={1} />
                  <CameraTile cameraId="VIDEO-02" lens={2} />
                </motion.div>
                {/* Row 140 (D137 (2); ux §8f.3): the cameras the Core registered beyond the two built-in ids; nothing when there is none. */}
                <RegisteredDevices kind="CAMERA" onView={setRegisteredId} />
              </DevicesPanel>

              <DevicesPanel id="summary" icon={LayoutGrid} title={t('devices.summary.title')}>
                <SummaryCards />
              </DevicesPanel>

              <DevicesPanel
                id="audio"
                icon={AudioLines}
                title={t('devices.audio.title')}
                subtitle={realCaptureCore ? t('web.waveL.summary.audioSubtitle') : t('devices.audio.subtitle')}
                glowPulseKey={bloom}
              >
                <motion.div className="dev-audios" variants={audioStagger} initial="hidden" animate="visible">
                  <AudioInputCard channel="AUDIO-01" />
                  <AudioInputCard channel="AUDIO-02" />
                </motion.div>
                {/* Row 140: the microphones the Core registered beyond the two built-in ids (this Mac's microphone, `MIC-03`). */}
                <RegisteredDevices kind="MIC" onView={setRegisteredId} />
                {/* Flow 13 (R-10 AC-2): "Search again" re-reads the microphones connected to the Core (operation 97). */}
                <MicRescan />
                {/* Task 4 row 72 (WP-07d): the sound cards of the Core's host and the registration of ONE input as a microphone (operations 98, 99). */}
                <AudioCards />
              </DevicesPanel>

              <DevicesPanel id="other" icon={Cpu} title={t('devices.other.title')}>
                <OtherDevices />
              </DevicesPanel>

              {/* Task 3 R-9 (blueprint row 137; ux §8c, §8d): the camera search, its list and the connect flow (operations 93-96). */}
              <CameraSearchPanel onViewDevice={viewDevice} />

              {/* Task 3 M4 (blueprint row 67; ux §2 flow 1): the capture device selector (operations 76-80). */}
              <CaptureSelectorPanel />

              <DevicesPanel id="front" icon={MonitorCog} title={t('devices.front.title')} subtitle={t('devices.front.subtitle')}>
                <FrontPanel />
              </DevicesPanel>

              <DevicesPanel id="ports" icon={Cable} title={t('devices.ports.title')} subtitle={t('devices.ports.subtitle')}>
                <PortMap />
              </DevicesPanel>
            </div>
          </div>
          </CameraSearchProvider>
          <DeviceDrawer deviceId={drawerId} onClose={() => setDrawerId(null)} />
          <RegisteredDeviceDrawer deviceId={registeredId} onClose={() => setRegisteredId(null)} />
          <AlertDialog.Backdrop isOpen={cycleFor !== null} onOpenChange={(open) => (open ? undefined : setCycleFor(null))}>
            <AlertDialog.Container size="sm">
              <AlertDialog.Dialog aria-label={t('devices.selector.poe.confirmTitle', { name: cycleFor === null ? '' : labels.name(cycleFor) })} data-testid="camera-restart-dialog">
                <AlertDialog.Header>
                  <AlertDialog.Icon status="warning" />
                  <AlertDialog.Heading>{t('devices.selector.poe.confirmTitle', { name: cycleFor === null ? '' : labels.name(cycleFor) })}</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>{t('devices.selector.poe.confirmBody')}</p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button variant="ghost" onPress={() => setCycleFor(null)}>
                    {t('common.actions.cancel')}
                  </Button>
                  <Button variant="danger" onPress={confirmCycle} data-testid="camera-restart-confirm">
                    {t('devices.selector.poe.confirm')}
                  </Button>
                </AlertDialog.Footer>
              </AlertDialog.Dialog>
            </AlertDialog.Container>
          </AlertDialog.Backdrop>
        </MicSamplerContext>
      </IdentifyContext>
    </DeviceActionsContext>
  )
}
