import { useId, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, ChartColumn } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, Rectangle, Tooltip, XAxis, type BarShapeProps, type TooltipContentProps } from 'recharts'
import { selectSealedHourly, useSim, wibDateParts } from '@dems/shared/sim'
import { palette } from '@dems/shared/tokens'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { BAR_GROW_MS, PANEL_BEAT_MS, useChartMotion, useDataReady } from './choreography'
import { hourlyBuckets, hourRange, type HourBucket } from './model'
import { StoragePanel } from './panel'

const AXIS_TICK = { fill: palette.gray, fontSize: 11, fontFamily: 'var(--font-mono)' }
const AXIS_STROKE = 'rgb(255 255 255 / 0.12)'
const HOUR_TICKS = ['00', '04', '08', '12', '16', '20']

/**
 * Sealed per hour (01_specs §14.5.5: Recharts `BarChart` over `sealedHourly`, the Dashboard H chart
 * enlarged). One series, so no legend: bars run bronze → gold with rounded tops, the current WIB
 * hour is brighter, and there is no Y axis (the count sits in the header and the tooltip). The bars
 * grow once on mount (700 ms); a new seal later bumps its hour without replaying the draw.
 */
export function SealedChartPanel() {
  const { t } = useTranslation()
  const counts = useSim(selectSealedHourly)
  // Whole hours only (R8): the chart re-renders when the WIB hour turns, not on the 100 ms clock.
  const nowAt = useSim((s) => Math.floor(s.clock.now / 3_600_000) * 3_600_000)
  const hour = wibDateParts(nowAt).hour
  const data = useMemo(() => hourlyBuckets(counts, nowAt), [counts, nowAt])
  const total = counts.reduce((sum, value) => sum + value, 0)
  const motion = useChartMotion(PANEL_BEAT_MS.sealed, BAR_GROW_MS)
  const ready = useDataReady(PANEL_BEAT_MS.sealed)
  const gradientId = `stor-sealed-${useId().replace(/:/g, '')}`

  return (
    <StoragePanel
      id="sealed"
      icon={ChartColumn}
      title={t('storage.charts.sealedPerHour')}
      action={
        <span className="stor-headline">
          <span className="stor-headline-strong" data-testid="storage-sealed-total">
            <AnimatedNumber value={ready ? total : 0} />
          </span>
          <span className="stor-headline-muted">{t('storage.capacity.today')}</span>
          <Link to="/evidence" search={{ status: 'SEALED' }} className="stor-link">
            {t('storage.charts.viewSealed')}
            <ArrowRight aria-hidden="true" strokeWidth={1.75} />
          </Link>
        </span>
      }
    >
      <figure
        className="stor-chart"
        role="img"
        aria-label={t('storage.charts.sealedAria', { count: total })}
        data-testid="storage-sealed-chart"
        data-current-hour={hour}
      >
        <BarChart
          responsive
          data={data}
          margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
          barCategoryGap="22%"
          style={{ width: '100%', height: '100%' }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={palette.bronze} stopOpacity={0.7} />
              <stop offset="100%" stopColor={palette.gold} stopOpacity={0.95} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            ticks={HOUR_TICKS}
            tickLine={false}
            axisLine={{ stroke: AXIS_STROKE }}
            tick={AXIS_TICK}
            tickMargin={6}
          />
          <Tooltip
            cursor={{ fill: palette.gold, fillOpacity: 0.06 }}
            content={(props) => <SealedTooltip {...props} />}
            isAnimationActive={false}
          />
          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
            minPointSize={0}
            isAnimationActive={motion.active}
            animationBegin={motion.begin}
            animationDuration={motion.duration}
            animationEasing="ease-out"
            shape={(props: BarShapeProps) => (
              <Rectangle
                {...props}
                fill={(props.payload as HourBucket | undefined)?.current ? palette.gold : `url(#${gradientId})`}
              />
            )}
          />
        </BarChart>
      </figure>
    </StoragePanel>
  )
}

function SealedTooltip({ active, payload }: TooltipContentProps) {
  const { t } = useTranslation()
  const bucket = payload?.[0]?.payload as HourBucket | undefined
  if (!active || !bucket) return null
  return (
    <div className="stor-tooltip">
      <p className="stor-tooltip-title">{t('storage.charts.tooltipHour', hourRange(bucket.hour))}</p>
      <p className="stor-tooltip-row stor-tooltip-accent">
        {t('storage.charts.tooltipSealed', { count: bucket.count })}
      </p>
    </div>
  )
}
