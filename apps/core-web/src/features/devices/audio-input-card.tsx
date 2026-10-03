import { useCallback, useRef } from 'react'
import { Button, Chip, Tooltip, toast } from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { Lock, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AudioTrackId } from '@dems/shared/domain'
import { EMPTY_DATE_TEXT } from '@dems/shared/realtime'
import { selectMicById, useAudioChannel, useSim, useSimActions, type AudioFrame } from '@dems/shared/sim'
import { DbfsMeter, formatDbfsValue, METER_THRESHOLDS } from '@/components/composed'
import { useMotionPolicy } from '@/motion'
import { DeviceMenu, IdentifyRing } from './device-menu'
import { useDeviceLabels } from './labels'
import { deviceStatus, STATUS_SEVERITY, STATUS_TONE } from './model'
import { logDevicesError } from './motion'
import { MIC_DEVICE, type RearPortId } from './sim-adapter'
import { StatusChip, StatusDot } from './status-chip'

const MIC_PORT: Record<AudioTrackId, RearPortId> = { 'AUDIO-01': 'MIC_IN_1', 'AUDIO-02': 'MIC_IN_2' }
/** P8: fast-changing number text updates at most 4 times per second. */
const PEAK_TEXT_INTERVAL_MS = 250

export interface AudioInputCardProps {
  channel: AudioTrackId
}

/**
 * One audio input (01_specs §14.5.4 "Audio Inputs"; research/04 §5.2; BOM A.14–A.21; ICD-04/05;
 * §22.1): the **large DbfsMeter** (the page's hero, M-C-04: 20 Hz transient updates, peak hold,
 * CLIP latch, NO SIGNAL) beside a dBFS scale, and the channel facts: peak hold readout (4 Hz),
 * read-only gain and 48 V phantom (G13, `Tooltip`), the clip latch with a reset, the recording
 * track state and the ADC format. A NO SIGNAL input shows a calm hint (P7), not an alarm.
 */
export function AudioInputCard({ channel }: AudioInputCardProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const labels = useDeviceLabels()
  const actions = useSimActions()
  const deviceId = MIC_DEVICE[channel]
  const mic = useSim((s) => selectMicById(s, channel))
  const status = useSim((s) => deviceStatus(s, deviceId))
  const fullName = labels.fullName(deviceId)
  const name = labels.name(deviceId)
  const port = labels.port(MIC_PORT[channel])
  const tone = STATUS_TONE[status]
  const latched = mic?.clipLatched ?? false
  const noSignal = status === 'NO_SIGNAL'

  const resetClip = () => {
    try {
      actions.resetClip(channel)
      toast.success(t('devices.actions.clipReset', { name }))
    } catch (error) {
      logDevicesError('AudioInputCard.resetClip', error, { channel })
      toast.danger(t('devices.actions.failed'))
    }
  }

  return (
    <motion.article
      className="dev-audio"
      data-testid={`audio-input-${channel}`}
      data-status={status}
      data-tone={tone}
      variants={m.variants.row}
    >
      <header className="dev-tile-head">
        <StatusDot tone={tone} />
        <div className="dev-tile-titles">
          <span className="dev-tile-name">{fullName}</span>
          <span className="dev-tile-sub">
            {port} · {channel}
          </span>
        </div>
        <div className="dev-tile-chips">
          {mic?.recState ? (
            <Chip size="sm" variant="soft" color={mic.recState === 'REC' ? 'danger' : 'warning'} className="dev-rec-chip font-mono">
              <Chip.Label>{t(`common.enums.trackRecState.${mic.recState}`)}</Chip.Label>
            </Chip>
          ) : null}
          <StatusChip tone={tone} label={t(`devices.status.${status}`)} severity={STATUS_SEVERITY[status]} testId={`audio-status-${channel}`} />
        </div>
        <DeviceMenu deviceId={deviceId} name={name} />
      </header>

      <div className="dev-audio-body">
        <div className="dev-audio-meter">
          <ol className="dev-audio-scale" aria-hidden="true" title={t('devices.audio.scaleLabel')}>
            {METER_THRESHOLDS.map((threshold) => (
              <li key={threshold} data-zone={threshold <= -20 ? 'green' : threshold <= -9 ? 'amber' : 'red'}>
                {threshold}
              </li>
            ))}
          </ol>
          <DbfsMeter channel={channel} variant="large" orientation="vertical" label={fullName} />
        </div>

        <dl className="dev-audio-facts">
          <div className="dev-fact" data-fact="peak">
            <dt>{t('devices.audio.peakHold')}</dt>
            <dd className="font-mono tabular-nums">
              <PeakReadout channel={channel} />
            </dd>
          </div>
          <div className="dev-fact" data-fact="gain">
            <dt>{t('devices.audio.gain')}</dt>
            <dd>
              <Tooltip delay={250}>
                <Tooltip.Trigger className="dev-readonly" aria-label={`${t('devices.audio.gain')}: ${t('devices.audio.gainValue', { value: mic?.gainDb ?? 0 })}. ${t('devices.audio.readOnly')}`}>
                  <span className="font-mono tabular-nums">{t('devices.audio.gainValue', { value: mic?.gainDb ?? 0 })}</span>
                  <Lock aria-hidden="true" size={12} />
                </Tooltip.Trigger>
                <Tooltip.Content placement="top" offset={6}>
                  {t('devices.audio.readOnly')}
                </Tooltip.Content>
              </Tooltip>
            </dd>
          </div>
          <div className="dev-fact" data-fact="phantom">
            <dt>{t('devices.audio.phantom')}</dt>
            <dd>
              <Chip size="sm" variant="soft" color={mic?.phantom ? 'accent' : 'default'} className="font-mono">
                <Chip.Label>{mic?.phantom ? t('devices.audio.phantomOn') : t('devices.audio.phantomOff')}</Chip.Label>
              </Chip>
            </dd>
          </div>
          <div className="dev-fact" data-fact="clip">
            <dt>{t('devices.audio.clip')}</dt>
            <dd>
              {latched ? (
                <Button size="sm" variant="danger-soft" onPress={resetClip} data-testid={`clip-reset-${channel}`}>
                  <RotateCcw aria-hidden="true" size={14} />
                  {t('devices.audio.resetClip')}
                </Button>
              ) : (
                <span className="text-foreground-2">{t('devices.audio.clipClear')}</span>
              )}
            </dd>
          </div>
          <div className="dev-fact" data-fact="track">
            <dt>{t('devices.audio.recTrack')}</dt>
            <dd className="font-mono">{mic?.recState ? t(`common.enums.trackRecState.${mic.recState}`) : EMPTY_DATE_TEXT}</dd>
          </div>
          <div className="dev-fact" data-fact="adc">
            <dt>{t('devices.drawer.field.adc')}</dt>
            <dd className="font-mono">{t('devices.drawer.value.adc')}</dd>
          </div>
        </dl>
      </div>

      <AnimatePresence initial={false}>
        {noSignal ? (
          <motion.p
            key="no-signal"
            className="dev-audio-hint"
            data-testid={`audio-hint-${channel}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={m.transitions.crossFade}
          >
            {t('devices.audio.noSignalHelp', { port })}
          </motion.p>
        ) : latched ? (
          <motion.p
            key="clip"
            className="dev-audio-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={m.transitions.crossFade}
          >
            {t('devices.audio.clipHelp')}
          </motion.p>
        ) : null}
      </AnimatePresence>
      <IdentifyRing deviceId={deviceId} />
    </motion.article>
  )
}

/**
 * The peak-hold level as text, written straight into the DOM at ≤ 4 Hz from the transient audio
 * channel (P8; §9.3: no React render per audio frame).
 */
function PeakReadout({ channel }: { channel: AudioTrackId }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLSpanElement>(null)
  const last = useRef(Number.NEGATIVE_INFINITY)
  const onFrame = useCallback(
    (frame: AudioFrame) => {
      if (frame.at - last.current < PEAK_TEXT_INTERVAL_MS) return
      last.current = frame.at
      const node = ref.current
      if (!node) return
      node.textContent = frame.noSignal || frame.peak <= -90 ? EMPTY_DATE_TEXT : t('common.units.dbfs', { value: formatDbfsValue(frame.peak) })
    },
    [t],
  )
  useAudioChannel(channel, onFrame)
  return (
    <span ref={ref} data-testid={`peak-${channel}`}>
      {EMPTY_DATE_TEXT}
    </span>
  )
}
