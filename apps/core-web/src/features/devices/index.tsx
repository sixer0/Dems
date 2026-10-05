/**
 * Devices & Inputs page (step 48; masterplan/01_specs.md §14.5.4; research/04 §5.2 and MB 7;
 * 03_motion_spec M-PG-DEV). Replaces the step-38 stub: the export name `DevicesPage` and the
 * root `data-testid="page-devices"` are the route contract (implementation/19_app_shell.md §2).
 *
 * Layout (research/04 §5.2, 12 columns at ≥ 1280 px):
 *   [Camera Devices 8] [Summary 4]
 *   [Audio Inputs 8]   [Other Devices 4]
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
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@heroui/react'
import { AudioLines, Cable, Camera, Cpu, LayoutGrid, MonitorCog, Video } from 'lucide-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { settle, useCoreActions } from '@dems/shared/live'
import { DeviceCommand } from '@dems/shared/sim'
import { PageHeader } from '@/components/shell/page-header'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { useMotionPolicy } from '@/motion'
import { AudioInputCard } from './audio-input-card'
import { CameraTile } from './camera-tile'
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
import { PANEL_BEAT_MS, ROW_STAGGER_MS, useHeroBloomDelayMs, useStaggerVariants } from './motion'
import { OtherDevices } from './other-devices'
import { DevicesPanel } from './panel'
import { PortMap } from './port-map'
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

  const run = useCallback(
    (deviceId: DeviceId, action: DeviceAction) => {
      if (action === 'details') {
        setDrawerId(deviceId)
        return
      }
      // LB-1: one command per device at a time; a press while one is out sends nothing.
      if (inFlight.current.has(deviceId)) return
      const name = labels.name(deviceId)
      const command = DEVICE_COMMAND_OF[action]
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
          }
        },
        fail: (error) => {
          // Rule 2 of the page rows: the presenter first (a 403, an outage, a time-out, a 429).
          if (presentCoreError(error) !== null) return
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
  const deviceActions = useMemo(() => ({ open: setDrawerId, run, pending }), [run, pending])
  const camerasStagger = useStaggerVariants(PANEL_BEAT_MS.cameras, ROW_STAGGER_MS)
  const audioStagger = useStaggerVariants(PANEL_BEAT_MS.audio, ROW_STAGGER_MS)

  return (
    <DeviceActionsContext value={deviceActions}>
      <IdentifyContext value={identify}>
        <MicSamplerContext value={sampler}>
          <div className="dems-page dev-page" data-testid="page-devices">
            <PageHeader icon={Camera} title={t('devices.title')} subtitle={t('devices.subtitle')} status={<DevicesBanner />} />

            <div className="dev-grid">
              <DevicesPanel id="cameras" icon={Video} title={t('devices.cameras.title')} subtitle={t('devices.cameras.subtitle')}>
                <motion.div className="dev-cams" variants={camerasStagger} initial="hidden" animate="visible">
                  <CameraTile cameraId="VIDEO-01" lens={1} />
                  <CameraTile cameraId="VIDEO-02" lens={2} />
                </motion.div>
              </DevicesPanel>

              <DevicesPanel id="summary" icon={LayoutGrid} title={t('devices.summary.title')}>
                <SummaryCards />
              </DevicesPanel>

              <DevicesPanel
                id="audio"
                icon={AudioLines}
                title={t('devices.audio.title')}
                subtitle={t('devices.audio.subtitle')}
                glowPulseKey={bloom}
              >
                <motion.div className="dev-audios" variants={audioStagger} initial="hidden" animate="visible">
                  <AudioInputCard channel="AUDIO-01" />
                  <AudioInputCard channel="AUDIO-02" />
                </motion.div>
              </DevicesPanel>

              <DevicesPanel id="other" icon={Cpu} title={t('devices.other.title')}>
                <OtherDevices />
              </DevicesPanel>

              <DevicesPanel id="front" icon={MonitorCog} title={t('devices.front.title')} subtitle={t('devices.front.subtitle')}>
                <FrontPanel />
              </DevicesPanel>

              <DevicesPanel id="ports" icon={Cable} title={t('devices.ports.title')} subtitle={t('devices.ports.subtitle')}>
                <PortMap />
              </DevicesPanel>
            </div>
          </div>
          <DeviceDrawer deviceId={drawerId} onClose={() => setDrawerId(null)} />
        </MicSamplerContext>
      </IdentifyContext>
    </DeviceActionsContext>
  )
}
