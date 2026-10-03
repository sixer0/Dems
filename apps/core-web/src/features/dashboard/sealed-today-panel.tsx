import { useEffect, useId, useMemo, useRef } from 'react'
import { toast } from '@heroui/react'
import { Bar, BarChart, XAxis, YAxis } from 'recharts'
import { Database, Layers } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { selectSealedHourly, selectSealedToday, startOfWibDay, useSim, type SimState } from '@dems/shared/sim'
import { palette } from '@dems/shared/tokens'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { useMotionPolicy } from '@/motion'
import { DashPanel, PanelLink } from './dash-panel'
import { busiestHour, hourlyBars } from './dashboard-model'
import { BAR_GROW_MS, DASH_BEATS, useHeldBeat } from './dashboard-motion'

const TICKS = ['00', '04', '08', '12', '16', '20']
const ZERO_BUCKETS: readonly number[] = Array.from({ length: 24 }, () => 0)

/** The evidence item sealed most recently today (for the "Evidence … sealed" toast), or null. */
const selectNewestSealedToday = (s: SimState): string | null => {
  const dayStart = startOfWibDay(s.clock.now)
  let newest: { id: string; at: number } | null = null
  for (const item of s.evidence) {
    if (item.sealedAt === null || item.sealedAt < dayStart) continue
    if (!newest || item.sealedAt > newest.at) newest = { id: item.id, at: item.sealedAt }
  }
  return newest?.id ?? null
}

/**
 * Panel H, Sealed Evidence Today (01_specs §14.5.1 H; research/04 §3.1 H): the count (AnimatedNumber)
 * and a Recharts BarChart of the 24 WIB hours, bronze → gold, no Y axis, ticks 00–20. Empty hours
 * keep a faint slot so the day reads as a timeline.
 *
 * Motion (M-PG-DASH t = 650 + 120): after the held beat the count ticks up and the bars grow
 * (`animationDuration` 700). Data moment (§7 FINALIZING → SEALED): a new seal bumps its hour's
 * bar, the count ticks +1 and a success toast names the evidence. Reduced motion: no chart
 * animation, the count is final (§8).
 */
export function SealedTodayPanel() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const beat = DASH_BEATS.row3 + 2 * DASH_BEATS.stagger
  const ready = useHeldBeat(beat)
  const hourly = useSim(selectSealedHourly)
  const sealedToday = useSim(selectSealedToday)
  const newestId = useSim(selectNewestSealedToday)
  const gradientId = `dash-sealed-${useId().replace(/[^A-Za-z0-9_-]/g, '_')}`

  const bars = useMemo(() => hourlyBars(ready ? hourly : ZERO_BUCKETS), [ready, hourly])
  const maxCount = Math.max(0, ...hourly)
  const busiest = busiestHour(hourly)

  // New seal → one success toast (not on the first render, not when the count only drops at midnight).
  const previous = useRef({ count: sealedToday, id: newestId })
  useEffect(() => {
    const before = previous.current
    if (sealedToday > before.count && newestId !== null && newestId !== before.id) {
      toast.success(t('dashboard.sealedToday.newSeal', { evidenceId: newestId }))
    }
    previous.current = { count: sealedToday, id: newestId }
  }, [sealedToday, newestId, t])

  return (
    <DashPanel
      id="h"
      beatMs={beat}
      title={t('dashboard.sealedToday.title')}
      icon={Layers}
      action={<PanelLink to="/evidence">{t('dashboard.sealedToday.viewAll')}</PanelLink>}
    >
      <div className="flex h-full min-h-0 items-center gap-3">
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="dems-mic-ring dems-sealed-icon" aria-hidden="true">
            <Database strokeWidth={1.6} />
          </span>
          <div className="flex flex-col">
            <span className="text-[2rem] font-semibold leading-none text-foreground tabular-nums" data-testid="sealed-today-count">
              <AnimatedNumber value={ready ? sealedToday : 0} from={0} />
            </span>
            {/* One line, as in the mockup (F45-08). */}
            <span className="mt-1 whitespace-nowrap text-caption leading-tight text-foreground-2" data-testid="sealed-today-caption">
              {t('dashboard.sealedToday.caption', { count: sealedToday })}
            </span>
          </div>
        </div>
        <div className="relative h-full min-h-0 min-w-0 flex-1" data-testid="sealed-hourly-chart" aria-hidden="true">
          <BarChart
            responsive
            style={{ width: '100%', height: '100%' }}
            data={bars}
            margin={{ top: 6, right: 6, bottom: 0, left: 6 }}
            barCategoryGap="20%"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={palette.bronze} stopOpacity={0.8} />
                <stop offset="100%" stopColor={palette.gold} stopOpacity={1} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="hour"
              ticks={TICKS}
              interval={0}
              tickLine={false}
              axisLine={{ stroke: 'rgb(255 159 61 / 0.25)' }}
              tick={{ fill: palette.gray, fontSize: 10 }}
              height={16}
            />
            <YAxis hide domain={[0, Math.max(4, maxCount + 1)]} />
            <Bar
              dataKey="count"
              fill={`url(#${gradientId})`}
              radius={[2, 2, 0, 0]}
              background={{ fill: 'rgb(255 200 107 / 0.05)', radius: 2 }}
              isAnimationActive={m.flags.chartAnimation}
              animationBegin={0}
              animationDuration={BAR_GROW_MS * m.timeScale}
              animationEasing="ease-out"
            />
          </BarChart>
        </div>
        <p className="sr-only">
          {busiest === null
            ? t('dashboard.sealedToday.chartEmpty')
            : t('dashboard.sealedToday.chartSummary', { count: sealedToday, hour: busiest })}
        </p>
      </div>
    </DashPanel>
  )
}
