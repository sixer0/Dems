import { useRef, type ReactNode } from 'react'
import { Alert, ListBox } from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, Lightbulb, MapPinned, Network, ShieldCheck, TabletSmartphone, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SessionState } from '@dems/shared/domain'
import { useSim, type SimState } from '@dems/shared/sim'
import { useOwnCaptureCore, usePlatformNotReported, useSelfCaptureCore } from '@/lib/own-capture'
import { useAmbientLoop, useMotionPolicy } from '@/motion'
import { useDeviceActions } from './context'
import { IdentifyRing } from './device-menu'
import { useDeviceLabels } from './labels'
import { deviceStatus, STATUS_SEVERITY, STATUS_TONE, type DeviceStatusCode, type OtherDeviceId } from './model'
import { PANEL_BEAT_MS, ROW_STAGGER_MS, useStaggerVariants } from './motion'
import { bookPoe, isDeviceId } from './sim-adapter'
import { StatusChip } from './status-chip'

interface OtherModel {
  poe: DeviceStatusCode
  poeActive: number
  poeSpare: number
  rec: DeviceStatusCode
  tablet: DeviceStatusCode
  gnss: DeviceStatusCode
  satellites: number
  timeSource: SimState['time']['source']
  tpm: DeviceStatusCode
  /** DF-22 (register S13): a session is RECORDING on the Core right now. */
  recording: boolean
}

function selectOther(state: SimState): OtherModel {
  const poe = bookPoe(state)
  return {
    poe: deviceStatus(state, 'POE-SWITCH'),
    poeActive: poe.active,
    poeSpare: poe.spare,
    rec: deviceStatus(state, 'REC-INDICATOR'),
    tablet: deviceStatus(state, 'TABLET'),
    gnss: deviceStatus(state, 'GNSS'),
    satellites: state.time.gnss.satellites,
    timeSource: state.time.source,
    tpm: deviceStatus(state, 'TPM'),
    recording: state.session?.state === SessionState.RECORDING,
  }
}

/**
 * DF-22 / U-11 (register S10, S13): the operator-device-offline body says "Recording continues on the Core" only while
 * a session is RECORDING. With nothing recording it says so instead of claiming a recording that does not exist.
 */
export function tabletOfflineBodyKey(recording: boolean): 'devices.other.tabletOfflineBody' | 'devices.other.tabletOfflineIdleBody' {
  return recording ? 'devices.other.tabletOfflineBody' : 'devices.other.tabletOfflineIdleBody'
}

const ICONS: Record<OtherDeviceId, LucideIcon> = {
  'POE-SWITCH': Network,
  'REC-INDICATOR': Lightbulb,
  TABLET: TabletSmartphone,
  GNSS: MapPinned,
  TPM: ShieldCheck,
}

/**
 * Other Devices (01_specs §14.5.4; research/04 §5.2 and MB 7; BOM A.22–A.31): a read-only kit
 * `ListBox` of the PoE switch (book view: PoE CAM 1 active, CAM 2/AUX spare; the simulator's 2-port model, D79), the
 * recording indicator relay with its "SEDANG MEREKAM" lamp, the tablet control link, the GNSS
 * receiver and the TPM / Secure Element (the simulator's platform devices). Choosing a row opens the drawer. When the
 * tablet goes OFFLINE, its chip escalates once and the operator-device-offline `Alert` slides in
 * (S9, M-PG-DEV data moment); its body claims "recording continues" only while a session is RECORDING (DF-22, S13).
 */
export function OtherDevices() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const labels = useDeviceLabels()
  const { open } = useDeviceActions()
  const model = useSim(selectOther)
  const container = useStaggerVariants(PANEL_BEAT_MS.other, ROW_STAGGER_MS)
  // Fix wave K (C-2 / G75c-04): a Core in its own capture reads no TPM (no "Attestation OK · sealing enabled")
  // and has no GNSS receiver (no "No fix · time from RTC"). A TPM row that shows a fault keeps it.
  const tpmNotReported = usePlatformNotReported() && model.tpm === 'OK'
  const gnssNotConfigured = useOwnCaptureCore()
  // Audit fix rows 104/107 (DF-21, U-10, register S7): a Core in its own capture has no producer for the PoE switch
  // book view or the relay lamp - those rows read "Not reported" instead of the appliance model's values.
  const noProducer = useSelfCaptureCore() // the one rule row 104's NoProducerGate also reads
  const notReported: Partial<Record<OtherDeviceId, string>> = {
    ...(noProducer ? { 'POE-SWITCH': t('system.noProducer'), 'REC-INDICATOR': t('system.noProducer') } : {}),
    ...(tpmNotReported ? { TPM: t('common.platformNotReported.note') } : {}),
    ...(gnssNotConfigured ? { GNSS: t('web.realCore.devices.gnssNotConfigured') } : {}),
  }

  const detail: Record<OtherDeviceId, string> = {
    'POE-SWITCH': t('devices.other.poeSummary', { active: model.poeActive, spare: model.poeSpare }),
    'REC-INDICATOR': t('devices.other.relay'),
    TABLET: t('devices.other.tabletLink'),
    GNSS:
      model.gnss === 'LOCKED'
        ? t('devices.other.gnssLocked', { count: model.satellites })
        : t('devices.other.gnssLost', { source: t(`common.enums.timeSource.${model.timeSource}`) }),
    TPM: model.tpm === 'OK' ? t('devices.other.tpmOk') : t('devices.other.tpmFail'),
  }
  const codes: Record<OtherDeviceId, DeviceStatusCode> = {
    'POE-SWITCH': model.poe,
    'REC-INDICATOR': model.rec,
    TABLET: model.tablet,
    GNSS: model.gnss,
    TPM: model.tpm,
  }
  const rows: OtherDeviceId[] = ['POE-SWITCH', 'REC-INDICATOR', 'TABLET', 'GNSS', 'TPM']

  return (
    <div className="dev-other">
      <motion.div variants={container} initial="hidden" animate="visible">
        <ListBox
          aria-label={t('devices.other.title')}
          selectionMode="none"
          className="dev-other-list"
          onAction={(key) => {
            const id = String(key)
            if (isDeviceId(id)) open(id)
          }}
        >
          {rows.map((id) => {
            const code = codes[id]
            const Icon = ICONS[id]
            let trailing: ReactNode
            if (noProducer && (id === 'POE-SWITCH' || id === 'REC-INDICATOR'))
              trailing = <StatusChip tone="default" label={t('system.noProducer')} severity={STATUS_SEVERITY.OK} testId={`other-status-${id}`} />
            else if (id === 'REC-INDICATOR') trailing = <RecordingLamp lit={code === 'LAMP_ON'} />
            else if (notReported[id] !== undefined)
              trailing = <StatusChip tone="default" label={t(id === 'GNSS' ? 'web.ownCore.time.notConfigured' : 'common.platformNotReported.value')} severity={STATUS_SEVERITY.OK} testId={`other-status-${id}`} />
            else
              trailing = (
                <StatusChip tone={STATUS_TONE[code]} label={t(`devices.status.${code}`)} severity={STATUS_SEVERITY[code]} testId={`other-status-${id}`} />
              )
            return (
              <ListBox.Item key={id} id={id} textValue={labels.name(id)} className="dev-other-item" data-testid={`other-${id}`} data-status={code} data-reported={notReported[id] !== undefined ? 'false' : undefined}>
                <motion.div className="dev-other-row" variants={m.variants.row}>
                  <span className="dev-other-icon" data-tone={notReported[id] !== undefined ? 'default' : STATUS_TONE[code]}>
                    <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
                  </span>
                  <span className="dev-other-text">
                    <span className="dev-other-name">{labels.name(id)}</span>
                    <span className="dev-other-detail">{notReported[id] ?? detail[id]}</span>
                  </span>
                  <span className="dev-other-trailing">{trailing}</span>
                  <ChevronRight className="dev-other-chevron" aria-hidden="true" size={16} />
                  <IdentifyRing deviceId={id} />
                </motion.div>
              </ListBox.Item>
            )
          })}
        </ListBox>
      </motion.div>

      <AnimatePresence initial={false}>
        {model.tablet === 'OFFLINE' ? (
          <motion.div
            key="tablet-offline"
            className="dev-other-alert"
            initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={m.reduced ? m.transitions.crossFade : { duration: m.seconds(240), ease: [0.2, 0, 0, 1] }}
          >
            <Alert status="warning" data-testid="tablet-offline-alert" data-recording={model.recording ? 'true' : 'false'}>
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t('devices.other.tabletOfflineTitle')}</Alert.Title>
                <Alert.Description>{t(tabletOfflineBodyKey(model.recording))}</Alert.Description>
              </Alert.Content>
            </Alert>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

/**
 * The room's "SEDANG MEREKAM" lamp (BOM A.31; M-C-23): lit red and breathing over `glowBreath`
 * while recording (ambient loop `rec-lamp`, shared with the front panel's RECORD LED), dark
 * otherwise. Reduced motion: steady on or off. The Indonesian label stays verbatim (D28/Q3).
 */
function RecordingLamp({ lit }: { lit: boolean }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLSpanElement>(null)
  const loop = useAmbientLoop('rec-lamp', { ref, group: 'rec-lamp', enabled: lit })
  return (
    <span ref={ref} className="dev-lamp" data-lit={lit ? 'true' : 'false'} data-testid="recording-lamp" {...loop.attrs}>
      <span className="dev-lamp-glow" aria-hidden="true" />
      <span className="dev-lamp-text" aria-hidden="true">
        {t('devices.other.recordingLamp')}
      </span>
      <span className="sr-only">
        {lit ? `${t('devices.other.recordingLamp')}: ${t('devices.other.recordingLampGloss')}` : t('devices.status.STANDBY')}
      </span>
    </span>
  )
}
