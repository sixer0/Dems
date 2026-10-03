import { useId, useMemo } from 'react'
import { ChartArea } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import { useSim } from '@dems/shared/sim'
import { palette } from '@dems/shared/tokens'
import { AREA_DRAW_MS, PANEL_BEAT_MS, useChartMotion } from './choreography'
import { fixed, usageSeries, type UsagePoint } from './model'
import { StoragePanel } from './panel'

const AXIS_TICK = { fill: palette.gray, fontSize: 11, fontFamily: 'var(--font-mono)' }
const GRID_STROKE = 'rgb(255 255 255 / 0.06)'
const AXIS_STROKE = 'rgb(255 255 255 / 0.12)'

/**
 * Usage over 24 h (01_specs §14.5.5: Recharts `AreaChart` over `storage.history`, 24 hourly points).
 * The area is the evidence written since the start of the window, so its baseline is an honest
 * zero; the tooltip also gives the used capacity at that hour. It draws once on mount (900 ms,
 * M-PG-STOR) and then follows the simulator's 1 Hz updates without animating (§9.3 streaming).
 */
export function UsageChartPanel() {
  const { t } = useTranslation()
  const history = useSim((s) => s.storage.history)
  const data = useMemo(() => usageSeries(history), [history])
  const motion = useChartMotion(PANEL_BEAT_MS.usage, AREA_DRAW_MS)
  const gradientId = `stor-usage-${useId().replace(/:/g, '')}`
  const last = data[data.length - 1]
  const first = data[0]
  const written = last ? fixed(last.writtenGb, 1) : '0.0'
  const used = last ? fixed(last.usedGb, 1) : '0.0'

  return (
    <StoragePanel
      id="usage"
      icon={ChartArea}
      title={t('storage.charts.usage24h')}
      action={
        <span className="stor-headline" data-testid="storage-usage-headline">
          <span className="stor-headline-strong">{t('storage.charts.writtenIn24h', { value: written })}</span>
          <span className="stor-headline-muted">{t('storage.charts.usedNow', { value: used })}</span>
        </span>
      }
    >
      <figure
        className="stor-chart"
        role="img"
        aria-label={t('storage.charts.usageAria', { value: written, used })}
        data-testid="storage-usage-chart"
        data-points={data.length}
      >
        <AreaChart responsive data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.gold} stopOpacity={0.34} />
              <stop offset="100%" stopColor={palette.bronze} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis
            dataKey="label"
            interval={3}
            tickLine={false}
            axisLine={{ stroke: AXIS_STROKE }}
            tick={AXIS_TICK}
            tickMargin={6}
          />
          <YAxis
            width={56}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            allowDecimals={false}
            domain={[0, 'auto']}
            tickFormatter={(value: number) => `${value}`}
            unit={` ${t('storage.units.gb')}`}
          />
          <Tooltip
            cursor={{ stroke: palette.gold, strokeOpacity: 0.35, strokeWidth: 1 }}
            content={(props) => <UsageTooltip {...props} since={first?.label ?? ''} />}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="writtenGb"
            stroke={palette.gold}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, fill: palette.gold, stroke: '#191008', strokeWidth: 2 }}
            isAnimationActive={motion.active}
            animationBegin={motion.begin}
            animationDuration={motion.duration}
            animationEasing="ease-out"
          />
        </AreaChart>
      </figure>
    </StoragePanel>
  )
}

function UsageTooltip({ active, payload, since }: TooltipContentProps & { since: string }) {
  const { t } = useTranslation()
  const point = payload?.[0]?.payload as UsagePoint | undefined
  if (!active || !point) return null
  return (
    <div className="stor-tooltip">
      <p className="stor-tooltip-title">{t('storage.charts.tooltipAt', { time: point.label })}</p>
      <p className="stor-tooltip-row">{t('storage.charts.tooltipUsed', { value: fixed(point.usedGb, 1) })}</p>
      <p className="stor-tooltip-row stor-tooltip-accent">
        {t('storage.charts.tooltipWritten', { value: fixed(point.writtenGb, 1), since })}
      </p>
    </div>
  )
}
