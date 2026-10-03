/**
 * The page's two Recharts views, loaded as their own chunk (the storage page's DR-49-6 pattern), so
 * the header, clock and tiers paint without waiting for the chart library. Both are streaming
 * series: `isAnimationActive={false}` always (03_motion_spec §9.3), so a 1 Hz update is one redraw
 * with no tween, in every motion policy.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime'
import type { BandwidthPoint, TimeHistoryPoint } from '@dems/shared/sim'
import { palette } from '@dems/shared/tokens'
import { bandwidthSeries, formatOffset, offsetSeries, type OffsetPoint } from './model'

const AXIS_TICK = { fill: palette.gray, fontSize: 11, fontFamily: 'var(--font-mono)' }
const GRID_STROKE = 'rgb(255 255 255 / 0.06)'
const AXIS_STROKE = 'rgb(255 255 255 / 0.12)'

/** Series colours: GNSS in the brand gold, NTP in the warning amber, RTC in the danger red. */
const SOURCE_COLOUR = { GNSS: palette.gold, NTP: palette.warning, RTC: palette.danger } as const

export interface BandwidthSparklineProps {
  history: readonly BandwidthPoint[]
  label: string
}

/** Down (gold) and up (bronze) over the last 120 s, no axes (MB 9 bandwidth sparkline). */
export function BandwidthSparkline({ history, label }: BandwidthSparklineProps) {
  const data = useMemo(() => bandwidthSeries(history), [history])
  return (
    <figure className="nt-spark" role="img" aria-label={label} data-testid="network-time-bandwidth-chart" data-points={data.length}>
      <LineChart responsive data={data} margin={{ top: 4, right: 2, bottom: 4, left: 2 }} style={{ width: '100%', height: '100%' }}>
        {/* Sparkline scale (not zero-based) so the 1 Hz stream is visible; the exact values sit beside it. */}
        <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
        <Line type="monotone" dataKey="down" stroke={palette.gold} strokeWidth={1.75} dot={false} isAnimationActive={false} />
        <Line
          type="monotone"
          dataKey="up"
          stroke={palette.bronze}
          strokeOpacity={0.75}
          strokeWidth={1.25}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </figure>
  )
}

export interface OffsetChartProps {
  history: readonly TimeHistoryPoint[]
  label: string
}

/**
 * Clock offset per 10 s sample (`time.history`), one coloured series per source so a fallback reads
 * as a colour change on the line itself. The GNSS ±4 ms band and the zero line give the scale.
 */
export function OffsetChart({ history, label }: OffsetChartProps) {
  const { t } = useTranslation()
  const data = useMemo(() => offsetSeries(history), [history])
  return (
    <figure className="nt-chart" role="img" aria-label={label} data-testid="network-time-offset-chart" data-points={data.length}>
      <LineChart responsive data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} style={{ width: '100%', height: '100%' }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <ReferenceArea y1={-4} y2={4} fill={palette.gold} fillOpacity={0.05} stroke="none" ifOverflow="extendDomain" />
        <ReferenceLine y={0} stroke={AXIS_STROKE} />
        <XAxis
          dataKey="at"
          type="number"
          domain={['dataMin', 'dataMax']}
          scale="time"
          tickLine={false}
          axisLine={{ stroke: AXIS_STROKE }}
          tick={AXIS_TICK}
          tickMargin={6}
          minTickGap={64}
          tickFormatter={(at: number) => formatDate(at, DATE_PATTERNS.time)}
        />
        <YAxis
          width={52}
          tickLine={false}
          axisLine={false}
          tick={AXIS_TICK}
          allowDecimals={false}
          domain={['auto', 'auto']}
          unit={` ${t('networkTime.history.unit')}`}
        />
        <Tooltip
          cursor={{ stroke: palette.gold, strokeOpacity: 0.35, strokeWidth: 1 }}
          content={(props) => <OffsetTooltip {...props} />}
          isAnimationActive={false}
        />
        {(['GNSS', 'NTP', 'RTC'] as const).map((source) => (
          <Line
            key={source}
            type="monotone"
            dataKey={source}
            stroke={SOURCE_COLOUR[source]}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            activeDot={{ r: 4, fill: SOURCE_COLOUR[source], stroke: '#191008', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </figure>
  )
}

function OffsetTooltip({ active, payload }: TooltipContentProps) {
  const { t } = useTranslation()
  const point = payload?.[0]?.payload as OffsetPoint | undefined
  if (!active || !point) return null
  return (
    <div className="nt-tooltip">
      <p className="nt-tooltip-title">{t('networkTime.history.tooltipAt', { time: formatDate(point.at, DATE_PATTERNS.time) })}</p>
      <p className="nt-tooltip-row" style={{ color: SOURCE_COLOUR[point.source] }}>
        {t('networkTime.history.tooltipValue', { value: formatOffset(point.offsetMs), source: point.source })}
      </p>
    </div>
  )
}
