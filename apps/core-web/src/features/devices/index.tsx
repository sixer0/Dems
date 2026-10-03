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
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from '@heroui/react'
import { AudioLines, Cable, Camera, Cpu, LayoutGrid, MonitorCog, Video } from 'lucide-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useSimActions } from '@dems/shared/sim'
import { PageHeader } from '@/components/shell/page-header'
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
import { logDevicesError, PANEL_BEAT_MS, ROW_STAGGER_MS, useHeroBloomDelayMs, useStaggerVariants } from './motion'
import { OtherDevices } from './other-devices'
import { DevicesPanel } from './panel'
import { PortMap } from './port-map'
import { IDENTIFY_BLINKS, IDENTIFY_PERIOD_MS, type DeviceId } from './sim-adapter'
import { SummaryCards } from './summary-cards'
import './devices.css'

export function DevicesPage() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const labels = useDeviceLabels()
  const actions = useSimActions()
  const sampler = usePageMicSampler()
  const [drawerId, setDrawerId] = useState<DeviceId | null>(null)
  const [identify, setIdentify] = useState<IdentifyValue>({ deviceId: null, key: 0 })

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
      const name = labels.name(deviceId)
      try {
        switch (action) {
          case 'details':
            setDrawerId(deviceId)
            break
          case 'identify':
            actions.deviceCommand(deviceId, 'IDENTIFY')
            setIdentify((current) => ({ deviceId, key: current.key + 1 }))
            toast.info(t('devices.actions.identifying', { name }))
            break
          case 'testSignal':
            actions.deviceCommand(deviceId, 'TEST_SIGNAL')
            toast.success(t('devices.actions.testSignalSent', { name }))
            break
          case 'restart':
            actions.deviceCommand(deviceId, 'RESTART')
            toast.success(t('devices.actions.restarted', { name }))
            break
        }
      } catch (error) {
        // Layer 1: a friendly toast; layer 2: the structured record; layer 3: the page keeps working.
        logDevicesError('run', error, { deviceId, action })
        toast.danger(t('devices.actions.failed'))
      }
    },
    [actions, labels, t],
  )
  const deviceActions = useMemo(() => ({ open: setDrawerId, run }), [run])
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
