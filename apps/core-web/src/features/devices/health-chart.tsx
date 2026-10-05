import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import { useTranslation } from 'react-i18next'
import { formatClock } from '@dems/shared/realtime'
import { useSimInstance } from '@dems/shared/sim'
import { palette, statusText } from '@dems/shared/tokens'
import { useSimSecond } from '@/components/media'
import { useMotionPolicy } from '@/motion'
import { useMicPoints } from './context'
import { useDeviceWords } from './live'
import { DEVICE_MIC, healthSeries, type DeviceId, type HealthSeries } from './sim-adapter'

/** M-PG-DEV: the Health chart draws once when the tab opens (Recharts), then streams without animation (§9.3). */
const FIRST_DRAW_MS = 700

const METRIC_KEY = {
  linkQuality: 'devices.drawer.health.linkQuality',
  signal: 'devices.drawer.health.signal',
  poeDraw: 'devices.drawer.health.poeDraw',
  relay: 'devices.drawer.health.relay',
  offset: 'devices.drawer.health.offset',
  attestation: 'devices.drawer.health.attestation',
  temperature: 'devices.drawer.health.temperature',
} as const satisfies Record<HealthSeries['metric'], string>

export interface HealthChartProps {
  deviceId: DeviceId
}

/**
 * The drawer's Health tab (01_specs §14.5.4 "Device Drawer: Health", Recharts `LineChart`;
 * research/04 §5.2 "signal or link quality"). Data come from the simulator's own series through
 * `healthSeries()` (the simulator's per-device series), recomputed once per simulator second (R8). The line draws on
 * first view (700 ms) and then updates without animation; reduced motion draws it at once.
 */
export function HealthChart({ deviceId }: HealthChartProps) {
  const { t } = useTranslation()
  // §3.2 (plan row W70): the caption says "Simulated" in Simulated mode only.
  const words = useDeviceWords()
  const m = useMotionPolicy()
  const sim = useSimInstance()
  const second = useSimSecond()
  const micPoints = useMicPoints(DEVICE_MIC[deviceId] ?? null)
  // Recomputed once per simulator second (`second` is the trigger), never at the 20 Hz store rate.
  const series = useMemo(() => {
    void second
    return healthSeries(sim.store.getState(), deviceId, micPoints)
  }, [sim, deviceId, micPoints, second])
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setDrawn(true), m.seconds(FIRST_DRAW_MS + 200) * 1000)
    return () => clearTimeout(timer)
  }, [m])

  const metric = t(METRIC_KEY[series.metric])
  const last = series.points.at(-1)
  const format = (value: number): string => {
    switch (series.unit) {
      case 'percent':
        return t('common.units.percent', { value: value.toFixed(1) })
      case 'dbfs':
        return t('common.units.dbfs', { value: value <= -90 ? '−∞' : value.toFixed(1) })
      case 'watt':
        return `${value.toFixed(1)} W`
      case 'ms':
        return t('common.units.ms', { value: value.toFixed(1) })
      case 'celsius':
        return t('common.units.celsius', { value: value.toFixed(1) })
      case 'none':
        return value >= 1 ? t('devices.front.lcd.on') : t('devices.front.lcd.off')
    }
  }
  const stroke = series.metric === 'temperature' && last && last.v >= 70 ? statusText.danger : palette.gold

  return (
    <div className="dev-health" data-testid="device-health" data-metric={series.metric} data-points={series.points.length}>
      <div className="dev-health-head">
        <span className="dev-health-metric">{metric}</span>
        <span className="dev-health-now">
          <span className="dev-health-now-label">{t('devices.drawer.health.now')}</span>
          <span className="dev-health-now-value font-mono tabular-nums">{last ? format(last.v) : '—'}</span>
        </span>
      </div>
      {series.points.length < 2 ? (
        <p className="dev-health-empty">{t('devices.drawer.health.collecting')}</p>
      ) : (
        <div className="dev-health-chart" role="img" aria-label={t('devices.drawer.health.chartLabel', { metric })}>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={series.points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`dev-health-${deviceId}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor={palette.bronze} />
                  <stop offset="1" stopColor={stroke} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(value: number) => formatClock(value).slice(3)}
                stroke="rgba(255,255,255,0.25)"
                tick={{ fill: palette.gray, fontSize: 11 }}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={series.domain}
                width={40}
                stroke="rgba(255,255,255,0.25)"
                tick={{ fill: palette.gray, fontSize: 11 }}
                tickLine={false}
                allowDecimals={series.unit !== 'none'}
              />
              <ChartTooltip
                cursor={{ stroke: 'rgba(255,200,107,0.35)' }}
                contentStyle={{ background: '#1F262E', border: '1px solid rgba(255,159,61,0.35)', borderRadius: 8, color: '#F9FAFB' }}
                labelFormatter={(value) => formatClock(Number(value))}
                formatter={(value) => [format(Number(value)), metric]}
              />
              <Line
                type={series.metric === 'relay' || series.metric === 'attestation' ? 'stepAfter' : 'monotone'}
                dataKey="v"
                stroke={`url(#dev-health-${deviceId})`}
                strokeWidth={2}
                dot={false}
                isAnimationActive={m.flags.chartAnimation && !drawn}
                animationDuration={FIRST_DRAW_MS}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="dev-health-source">{t(words.samples, { count: series.points.length })}</p>
    </div>
  )
}
