import { memo, useEffect, useState } from 'react'
import { ProgressCircle } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Database } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import useMeasure from 'react-use-measure'
import { Area, AreaChart, YAxis } from 'recharts'
import { useSim } from '@dems/shared/sim'
import { toneHex } from '@dems/shared/tokens'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { useRouteEnterDelay } from '@/components/shell'
import { useOwnCapture } from '@/lib/own-capture'
import { HELD_BEAT_MS, useMotionPolicy } from '@/motion'
import { PANEL_BEAT_MS } from './choreography'
import { selectStorage, storageTone } from './model'
import { Panel } from './panel'
import { useWriteRateSeries, type WriteRatePoint } from './sim-adapter'

/** The panel's own enter takes about this long to settle before the ring sweeps (R4). */
const CARD_SETTLE_MS = 360

/**
 * S: STORAGE DURING SESSION (01_specs §14.5.2 S; research/04 §3.2 S; M-C-02, M-C-03; D28/Q1).
 * Kit ProgressCircle showing USED % (20% at load) that sweeps from 0 after the held beat, the
 * centre % as AnimatedNumber, "3.2 TB Free of 4.0 TB", Write Speed, Session Size and Est.
 * Remaining (free ÷ 8.2 GB/h, AC-54), and a Recharts write-rate sparkline (no animation; it streams
 * at 1 Hz, §9.3). Threshold colours: gold READY, amber LOW, red FULL.
 *
 * A RECORDING OF THE CORE'S OWN CAPTURE (wave H closing pass Z2; driver A's line of 10:20:55Z): the
 * write speed and its curve are the simulator's nominal rate (`health.ts`: 8.2 GB/h with a
 * deterministic ripple), not a measurement of the Core. Beside such a session neither is drawn. The
 * volume figures (used, free, total) and the estimate stay: the estimate is labelled as one.
 */
export function StoragePanel() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const storage = useSim(selectStorage)
  const routeDelay = useRouteEnterDelay()
  const series = useWriteRateSeries()
  const ownCapture = useOwnCapture()
  const [armed, setArmed] = useState(m.reduced)
  useEffect(() => {
    if (armed) return undefined
    const id = setTimeout(() => setArmed(true), (routeDelay + PANEL_BEAT_MS.S + CARD_SETTLE_MS + HELD_BEAT_MS) * m.timeScale)
    return () => clearTimeout(id)
  }, [armed, routeDelay, m.timeScale])

  const tone = storageTone(storage.state)
  const writeMbps = storage.writeMbps
  const shown = armed ? storage.usedPercent : 0

  return (
    <Panel
      id="S"
      icon={Database}
      title={t('session.storage.title')}
      className="sm-area-storage"
      bodyClassName="sm-storage-body"
      action={
        <Link to="/storage" className="sm-card-link">
          {t('session.storage.viewStorage')}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      }
    >
      <div className="sm-storage-ring" data-tone={tone} data-testid="sm-storage-ring">
        <ProgressCircle
          aria-label={t('common.storage.usedPercent', { percent: storage.usedPercent })}
          value={shown}
          color={tone}
          size="lg"
          className="sm-ring"
        >
          <ProgressCircle.Track className="sm-ring-track">
            <ProgressCircle.TrackCircle />
            <ProgressCircle.FillCircle />
          </ProgressCircle.Track>
        </ProgressCircle>
        <span className="sm-ring-center" aria-hidden="true">
          <span className="sm-ring-value">
            <AnimatedNumber value={shown} from={0} />
            <span>%</span>
          </span>
          <span className="sm-ring-label">{t('common.storage.usedLabel')}</span>
        </span>
      </div>

      <div className="sm-storage-free">
        <p className="sm-storage-free-value" data-testid="sm-storage-free">
          <span className="sm-storage-free-main">
            {t('session.storage.free', { free: t(`common.units.${storage.freeUnit}`, { value: storage.freeValue }) })}
          </span>
          <span className="sm-storage-free-total">
            {t('session.storage.ofTotal', { total: t(`common.units.${storage.totalUnit}`, { value: storage.totalValue }) })}
          </span>
        </p>
        {ownCapture ? null : (
          <div className="sm-write-rate">
            <span className="sm-write-rate-label" aria-hidden="true">
              {t('session.storage.writeRate')}
            </span>
            <WriteRateSparkline
              points={series}
              label={t('session.storage.writeRateAria', { value: t('common.units.mbPerSecond', { value: writeMbps }) })}
            />
          </div>
        )}
      </div>

      <dl className="sm-storage-kv">
        {ownCapture ? null : (
          <div data-testid="sm-write-speed">
            <dt>{t('common.storage.writeSpeed')}</dt>
            <dd>{t('common.units.mbPerSecond', { value: writeMbps })}</dd>
          </div>
        )}
        <div>
          <dt>{t('common.storage.sessionSize')}</dt>
          <dd data-testid="sm-session-size">
            {storage.sessionValue !== null ? t(`common.units.${storage.sessionUnit}`, { value: storage.sessionValue }) : '—'}
          </dd>
        </div>
        <div>
          <dt>{t('common.storage.estRemaining')}</dt>
          <dd>{t('common.units.hoursMinutes', { hours: storage.remainingHours, minutes: storage.remainingMinutes })}</dd>
        </div>
      </dl>
    </Panel>
  )
}

const WriteRateSparkline = memo(function WriteRateSparkline({ points, label }: { points: readonly WriteRatePoint[]; label: string }) {
  const [ref, bounds] = useMeasure()
  const width = Math.floor(bounds.width)
  const height = Math.floor(bounds.height)
  return (
    <div ref={ref} className="sm-sparkline" role="img" aria-label={label} data-testid="sm-write-sparkline">
      {width > 0 && height > 0 ? (
        <AreaChart width={width} height={height} data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="sm-write-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={toneHex.accent} stopOpacity={0.45} />
              <stop offset="100%" stopColor={toneHex.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={[0, (max: number) => Math.max(3, max * 1.3)]} />
          <Area
            type="stepAfter"
            dataKey="mbps"
            stroke={toneHex.accent}
            strokeWidth={1.5}
            fill="url(#sm-write-fill)"
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      ) : null}
    </div>
  )
})
