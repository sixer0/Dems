import { useId } from 'react'
import { Chip, ProgressCircle } from '@heroui/react'
import { motion } from 'motion/react'
import { Database } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GB, selectEvidenceStats, selectStorage, TB, useSim } from '@dems/shared/sim'
import { toneChipProps, type StatusTone } from '@dems/shared/tokens'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { GlowLayer, useMotionPolicy, type GlowTone } from '@/motion'
import {
  COLOUR_MS,
  DATA_AFTER_ENTER_MS,
  LEGEND_STEP_MS,
  PANEL_BEAT_MS,
  RING_AFTER_ENTER_MS,
  RING_SWEEP_MS,
  useBeatDelayMs,
  useDataReady,
} from './choreography'
import {
  fixed,
  ringDashOffset,
  ringTick,
  STORAGE_CHIP_TONE,
  STORAGE_LEVEL_TONE,
  THRESHOLDS,
  type StorageLevel,
} from './model'
import { StoragePanel } from './panel'
import { useEscalationKey } from './use-storage-alerts'

/** Static scale ticks every 2.5 % (major every 25 %), drawn just outside the ring. */
const SCALE_TICKS = Array.from({ length: 40 }, (_, i) => i * 2.5)

const GLOW_TONE: Record<StorageLevel, GlowTone> = { READY: 'brand', LOW: 'warning', FULL: 'danger' }

/**
 * Capacity ring plus legend (01_specs §14.5.5; D28/Q1: the ring shows USED %, AC-75).
 *
 * - Kit `ProgressCircle` (large): its value and `valueLabel` carry the accessible truth at once;
 *   the drawn arc sweeps from 0 (M-C-03: 900 ms `luxe` on `stroke-dashoffset`, the hero moment).
 * - A gold gradient arc (amber at LOW, red at FULL; stop colours transition 400 ms) with static
 *   threshold ticks at the simulator's LOW (85 %) and FULL (98 %) levels.
 * - The centre % and the legend values tick after the held beat (AnimatedNumber, M-C-02).
 * - An escalation pulses the ring glow once (R8); the toast comes from the page hook.
 */
export function CapacityPanel() {
  const { t } = useTranslation()
  const summary = useSim(selectStorage)
  const counts = useSim((s) => {
    const stats = selectEvidenceStats(s)
    return { sealedToday: stats.sealedToday, pending: stats.pending }
  })
  const state = summary.state as StorageLevel
  const tone = STORAGE_CHIP_TONE[state]

  return (
    <StoragePanel
      id="capacity"
      icon={Database}
      title={t('storage.capacity.title')}
      action={
        <Chip size="sm" variant="soft" {...toneChipProps(tone)} data-testid="storage-state-chip">
          {t(`common.enums.storageState.${state}`)}
        </Chip>
      }
      bodyClassName="stor-capacity"
    >
      <CapacityRing state={state} percent={summary.usedPercent} ratio={summary.usedRatioPercent} />
      <div className="stor-capacity-side">
        <FreeHeadline freeBytes={summary.freeBytes} totalBytes={summary.totalBytes} />
        <Legend
          usedBytes={summary.usedBytes}
          freeBytes={summary.freeBytes}
          sealedToday={counts.sealedToday}
          pending={counts.pending}
        />
      </div>
    </StoragePanel>
  )
}

function CapacityRing({ state, percent, ratio }: { state: StorageLevel; percent: number; ratio: number }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const gradientId = `stor-ring-${useId().replace(/:/g, '')}`
  const ready = useDataReady(PANEL_BEAT_MS.capacity, RING_AFTER_ENTER_MS)
  const escalation = useEscalationKey(state)
  const shown = ready ? ratio : 0
  const sweep = m.flags.animateNumbers
    ? `stroke-dashoffset ${RING_SWEEP_MS * m.timeScale}ms cubic-bezier(0.22, 1, 0.36, 1)`
    : 'none'
  const low = ringTick(THRESHOLDS.low, 18.5, 20.9)
  const full = ringTick(THRESHOLDS.full, 18.5, 20.9)

  return (
    <div
      className="stor-ring"
      data-state={state}
      data-tone={STORAGE_LEVEL_TONE[state]}
      data-testid="storage-ring-wrap"
      style={{ ['--stor-colour-ms' as string]: `${COLOUR_MS * m.timeScale}ms` }}
    >
      <span className="stor-ring-halo" aria-hidden="true">
        <GlowLayer level={state === 'READY' ? 1 : 2} tone={GLOW_TONE[state]} pulseKey={escalation} />
      </span>
      <ProgressCircle
        aria-label={t('storage.capacity.ringLabel')}
        value={ratio}
        valueLabel={t('common.storage.usedPercent', { percent })}
        className="stor-ring-root"
        data-testid="storage-ring"
        data-value={percent}
      >
        <ProgressCircle.Track className="stor-ring-svg" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" className="stor-ring-stop-a" />
              <stop offset="100%" className="stor-ring-stop-b" />
            </linearGradient>
          </defs>
          <g className="stor-ring-scale" aria-hidden="true">
            {SCALE_TICKS.map((p) => {
              const major = p % 25 === 0
              const tick = ringTick(p, major ? 19.1 : 19.3, major ? 20.3 : 19.9)
              return <line key={p} {...tick} className={major ? 'stor-ring-tick-major' : 'stor-ring-tick'} />
            })}
          </g>
          <ProgressCircle.TrackCircle className="stor-ring-track" />
          <ProgressCircle.FillCircle
            className="stor-ring-fill"
            data-testid="storage-ring-fill"
            style={{ stroke: `url(#${gradientId})`, strokeDashoffset: ringDashOffset(shown), transition: sweep }}
          />
          <g aria-hidden="true">
            <line {...low} className="stor-ring-threshold" data-threshold="LOW" />
            <line {...full} className="stor-ring-threshold" data-threshold="FULL" />
          </g>
        </ProgressCircle.Track>
      </ProgressCircle>
      <div className="stor-ring-center" aria-hidden="true">
        <span className="stor-ring-percent" data-testid="storage-ring-percent">
          <AnimatedNumber value={ready ? percent : 0} />%
        </span>
        <span className="stor-ring-label" data-testid="storage-ring-label">
          {t('common.storage.usedLabel')}
        </span>
      </div>
    </div>
  )
}

function FreeHeadline({ freeBytes, totalBytes }: { freeBytes: number; totalBytes: number }) {
  const { t } = useTranslation()
  const ready = useDataReady(PANEL_BEAT_MS.capacity)
  const total = `${fixed(totalBytes / TB, 1)} ${t('storage.units.tb')}`
  // TB with one decimal (the D1 / MB 8 "3.2 TB"); whole GB once less than 1 TB is left.
  const inTb = freeBytes >= TB
  const free = inTb ? freeBytes / TB : freeBytes / GB
  return (
    <div className="stor-free-block">
      <p className="stor-free" data-testid="storage-free">
        <span className="stor-free-value">
          <AnimatedNumber value={ready ? free : 0} format={(v) => fixed(v, inTb ? 1 : 0)} />{' '}
          {inTb ? t('storage.units.tb') : t('storage.units.gb')}
        </span>{' '}
        <span className="stor-free-word">{t('storage.capacity.free')}</span>{' '}
        <span className="stor-free-of">{t('storage.capacity.ofTotal', { total })}</span>
      </p>
      <p className="stor-free-caption">{t('storage.capacity.volume', { total })}</p>
    </div>
  )
}

interface LegendProps {
  usedBytes: number
  freeBytes: number
  sealedToday: number
  pending: number
}

function Legend({ usedBytes, freeBytes, sealedToday, pending }: LegendProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const ready = useDataReady(PANEL_BEAT_MS.capacity)
  const startMs = useBeatDelayMs(PANEL_BEAT_MS.capacity, DATA_AFTER_ENTER_MS)
  const capacityText = (gbValue: number) =>
    gbValue >= 1_000
      ? `${fixed(gbValue / 1_000, 1)} ${t('storage.units.tb')}`
      : `${fixed(gbValue, 0)} ${t('storage.units.gb')}`

  const rows: { id: string; tone: StatusTone | 'track'; label: string; value: number; format?: (v: number) => string; suffix?: string }[] = [
    { id: 'used', tone: 'accent', label: t('common.storage.used'), value: usedBytes / GB, format: capacityText },
    { id: 'free', tone: 'track', label: t('common.storage.free'), value: freeBytes / GB, format: capacityText },
    { id: 'sealed', tone: 'sealed', label: t('common.storage.sealedEvidence'), value: sealedToday, suffix: t('storage.capacity.today') },
    { id: 'pending', tone: 'warning', label: t('common.storage.pending'), value: pending },
  ]

  return (
    <ul className="stor-legend" aria-label={t('storage.capacity.legendLabel')}>
      {rows.map((row, index) => (
        <motion.li
          key={row.id}
          className="stor-legend-row"
          data-testid={`storage-legend-${row.id}`}
          initial={m.reduced ? false : { opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...m.transitions.row, delay: m.reduced ? 0 : (startMs + index * LEGEND_STEP_MS * m.timeScale) / 1000 }}
        >
          <span className="stor-legend-dot" data-tone={row.tone} aria-hidden="true" />
          <span className="stor-legend-label">{row.label}</span>
          <span className="stor-legend-value">
            <AnimatedNumber value={ready ? row.value : 0} format={row.format} />
            {row.suffix ? <span className="stor-legend-suffix"> {row.suffix}</span> : null}
          </span>
        </motion.li>
      ))}
    </ul>
  )
}
