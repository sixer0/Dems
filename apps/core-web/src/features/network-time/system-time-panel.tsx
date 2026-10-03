import { memo } from 'react'
import { Chip } from '@heroui/react'
import { LayoutGroup } from 'motion/react'
import { AudioWaveform, Clock3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DATE_PATTERNS, formatDate, formatUtcOffset } from '@dems/shared/realtime'
import { selectClockSecond, useSim } from '@dems/shared/sim'
import { toneChipProps } from '@dems/shared/tokens'
import { SlidingNumber } from '@/components/ui/sliding-number'
import { GlowLayer } from '@/motion'
import { useMotionPolicy } from '@/motion'
import { secondTicks, timeLevel, TIME_TONE } from './model'
import { NetworkTimePanel } from './panel'
import { selectAvSync } from './sim-adapter'
import { useTimeEscalationKey } from './use-network-time-alerts'

/**
 * System time hero (01_specs §14.5.6 row 1; MB 9 "System Time"; 04 §5.4): the sim clock in large
 * mono digits at UTC+07:00 (D28/Q2), the WIB date, the zone and sync chips, a 60-tick second
 * track, the §2.2 timestamp chain, and the derived A/V-sync strip (§22.2, the simulator's `selectAvSync`).
 *
 * Motion (M-C-02): the digits slide per group with MP **SlidingNumber** (only changed digits
 * move); reduced motion shows plain digits (§8). The clock re-renders at 1 Hz from
 * `selectClockSecond` (R8), never at the 10 Hz sim clock.
 */
export function SystemTimePanel() {
  const { t } = useTranslation()
  const view = useSim((s) => ({ source: s.time.source, stratum: s.time.stratum }))
  const level = timeLevel(view.source)
  const pulse = useTimeEscalationKey(level)
  return (
    <NetworkTimePanel
      id="system-time"
      icon={Clock3}
      title={t('networkTime.systemTime.title')}
      action={
        <Chip size="sm" variant="soft" {...toneChipProps(TIME_TONE[level])} data-testid="network-time-sync-chip">
          {t(`networkTime.bannerState.time.${level}`)}
        </Chip>
      }
      bodyClassName="nt-time-body"
    >
      <div className="nt-clock-stage">
        <GlowLayer level={1} tone={level === 'LOCKED' ? 'brand' : 'warning'} pulseKey={pulse} />
        <ClockFace />
      </div>
      <dl className="nt-kv nt-kv-2">
        <div className="nt-kv-item">
          <dt>{t('networkTime.systemTime.source')}</dt>
          <dd data-testid="network-time-source">
            {t(`networkTime.systemTime.sourceValue.${view.source}`, { stratum: view.stratum })}
          </dd>
        </div>
        <div className="nt-kv-item">
          <dt>{t('networkTime.systemTime.chain')}</dt>
          <dd>{t('networkTime.systemTime.chainValue', { source: view.source })}</dd>
        </div>
      </dl>
      <AvSyncStrip />
    </NetworkTimePanel>
  )
}

const ClockFace = memo(function ClockFace() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const second = useSim(selectClockSecond)
  const at = second * 1_000
  const text = formatDate(at, DATE_PATTERNS.time)
  const [hh = '00', mm = '00', ss = '00'] = text.split(':')
  const slide = m.flags.animateNumbers
  const offset = formatUtcOffset()
  const ticks = secondTicks(Number(ss))
  return (
    <div className="nt-clock">
      <p className="nt-clock-date" data-testid="network-time-date">
        {formatDate(at, DATE_PATTERNS.weekdayDate)}
      </p>
      <time
        className="sr-only"
        dateTime={new Date(at).toISOString()}
        aria-label={t('networkTime.systemTime.clockLabel', { time: text, offset })}
        data-testid="network-time-clock"
      >
        {text}
      </time>
      <div className="nt-clock-digits" aria-hidden="true" data-sliding={slide ? 'true' : 'false'}>
        <LayoutGroup id="nt-clock" inherit={false}>
          <ClockGroup digits={hh} slide={slide} />
          <span className="nt-clock-colon">:</span>
          <ClockGroup digits={mm} slide={slide} />
          <span className="nt-clock-colon">:</span>
          <ClockGroup digits={ss} slide={slide} />
        </LayoutGroup>
      </div>
      <div className="nt-ticks" role="img" aria-label={t('networkTime.systemTime.secondsLabel', { second: Number(ss) })}>
        {ticks.map((lit, i) => (
          <span
            key={i}
            className="nt-tick"
            data-lit={lit ? 'true' : 'false'}
            data-now={i === Number(ss) ? 'true' : undefined}
            data-major={i % 15 === 0 ? 'true' : undefined}
          />
        ))}
      </div>
      <div className="nt-clock-zone">
        <Chip size="sm" variant="soft" {...toneChipProps('accent')} data-testid="network-time-zone">
          {t('networkTime.systemTime.zone', { offset })}
        </Chip>
        <span className="nt-clock-zone-name">{t('networkTime.systemTime.zoneName')}</span>
      </div>
    </div>
  )
})

function ClockGroup({ digits, slide }: { digits: string; slide: boolean }) {
  return <div className="nt-clock-group">{slide ? <SlidingNumber value={Number(digits)} padStart /> : digits}</div>
}

function AvSyncStrip() {
  const { t } = useTranslation()
  const av = useSim(selectAvSync)
  const lock = av.locked ? t('networkTime.hierarchy.locked') : t('networkTime.hierarchy.unlocked')
  return (
    <div className="nt-av" data-testid="network-time-av-sync" data-state={av.state}>
      <div className="nt-av-head">
        <AudioWaveform className="nt-av-icon" aria-hidden="true" strokeWidth={1.75} />
        <span className="nt-av-title">{t('networkTime.systemTime.avSync.title')}</span>
        <Chip size="sm" variant="soft" {...toneChipProps(av.state === 'HEALTHY' ? 'success' : 'warning')}>
          {t(`networkTime.systemTime.avSync.state.${av.state}`)}
        </Chip>
      </div>
      <dl className="nt-kv nt-kv-3">
        <div className="nt-kv-item">
          <dt>{t('networkTime.systemTime.avSync.skew')}</dt>
          <dd>{t('networkTime.systemTime.avSync.skewValue')}</dd>
        </div>
        <div className="nt-kv-item">
          <dt>{t('networkTime.systemTime.avSync.trackStart')}</dt>
          <dd>{t('networkTime.systemTime.avSync.trackStartValue')}</dd>
        </div>
        <div className="nt-kv-item">
          <dt>{t('networkTime.systemTime.avSync.sourceMeta')}</dt>
          <dd>{t('networkTime.systemTime.avSync.sourceMetaValue', { source: av.source, lock })}</dd>
        </div>
      </dl>
      <p className="nt-footnote">{t('networkTime.systemTime.avSync.derived')}</p>
    </div>
  )
}
