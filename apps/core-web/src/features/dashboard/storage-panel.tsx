import { ProgressCircle } from '@heroui/react'
import { Database } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { selectEvidenceStats, storageSummary, useSim, type SimState } from '@dems/shared/sim'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { cn } from '@/lib/utils'
import { DashPanel, PanelLink } from './dash-panel'
import { formatOneDecimal, toGb, toTb } from './dashboard-model'
import { DASH_BEATS, useHeldBeat } from './dashboard-motion'

/** Displayed values only (TB to one decimal, whole GB): bytes grow at 1 Hz while recording (§9.3). */
const selectStorageView = (s: SimState) => {
  const summary = storageSummary(s)
  return {
    totalTb: toTb(summary.totalBytes),
    usedGb: toGb(summary.usedBytes),
    freeTb: toTb(summary.freeBytes),
    usedPercent: summary.usedPercent,
    state: summary.state,
  }
}
/** Sealed today and pending (the legend reads "Sealed Evidence 7 · Pending 1", D61 / S32-1). */
const selectEvidenceCounts = (s: SimState) => {
  const stats = selectEvidenceStats(s)
  return { sealedToday: stats.sealedToday, pending: stats.pending }
}

const RING_COLOR = { READY: 'accent', LOW: 'warning', FULL: 'danger' } as const

/**
 * Panel F, Storage & Evidence (01_specs §14.5.1 F; research/04 §3.1 F): the kit ProgressCircle
 * shows the evidence volume's **USED %** (D28/Q1; the mockup's "80%" was the free share, 04 §9
 * #4), "3.2 TB Free / of 4.0 TB", and a legend (Used, Free, Sealed Evidence, Pending).
 * AC-75 unit form: the ring's value text is "20% used, 3.2 TB free of 4.0 TB".
 *
 * Motion (M-C-03, R4): the ring mounts at 0 and sweeps to its value after the row-3 panel lands
 * and the held beat passes (stroke-dashoffset 900 ms `luxe`, from dashboard.css); the numbers
 * count up with AnimatedNumber; a READY → LOW → FULL change moves the colour in 400 ms. Reduced
 * motion: drawn at the value, numbers final (§8).
 */
export function StoragePanel() {
  const { t } = useTranslation()
  const storage = useSim(selectStorageView)
  const counts = useSim(selectEvidenceCounts)
  const ready = useHeldBeat(DASH_BEATS.row3)

  const freeTb = storage.freeTb
  const totalText = t('common.units.tb', { value: formatOneDecimal(storage.totalTb) })
  const freeText = t('common.units.tb', { value: formatOneDecimal(freeTb) })
  const freeOf = t('common.storage.freeOf', { free: freeText, total: totalText })
  const ringValue = t('dashboard.storage.ringValue', { percent: storage.usedPercent, freeOf })

  const legend = [
    { key: 'used', label: t('common.storage.used'), value: t('common.units.gb', { value: storage.usedGb }), dot: 'bg-accent' },
    { key: 'free', label: t('common.storage.free'), value: freeText, dot: 'bg-[#8a6a48]' },
    { key: 'sealed', /* Fix wave J (JT-21 / JW-28): the figure counts TODAY's seals; the label said "Sealed Evidence" beside 43 sealed items. */ label: t('web.waveJ.dashboard.sealedToday'), value: String(counts.sealedToday), dot: 'bg-success' },
    { key: 'pending', label: t('common.storage.pending'), value: String(counts.pending), dot: 'bg-warning' },
  ]

  return (
    <DashPanel
      id="f"
      beatMs={DASH_BEATS.row3}
      title={t('dashboard.storage.title')}
      icon={Database}
      action={<PanelLink to="/storage">{t('dashboard.storage.viewStorage')}</PanelLink>}
    >
      <div className="flex h-full min-h-0 items-center gap-[clamp(10px,1.2vw,20px)]">
        <ProgressCircle
          className="dems-dash-donut"
          data-testid="storage-ring"
          data-state={storage.state}
          color={RING_COLOR[storage.state]}
          value={ready ? storage.usedPercent : 0}
          aria-label={t('dashboard.storage.ringLabel')}
          valueLabel={ringValue}
        >
          <ProgressCircle.Track className="size-[clamp(72px,5.2vw,100px)]">
            <ProgressCircle.TrackCircle />
            <ProgressCircle.FillCircle />
          </ProgressCircle.Track>
          <span className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
            <span className="text-h2 font-bold leading-none text-foreground" data-testid="storage-used-percent">
              <AnimatedNumber value={ready ? storage.usedPercent : 0} from={0} />%
            </span>
            <span className="mt-0.5 text-[0.625rem] font-semibold tracking-[0.14em] text-foreground-2">
              {t('common.storage.usedLabel')}
            </span>
          </span>
        </ProgressCircle>

        <div className="flex min-w-0 shrink-0 flex-col" data-testid="storage-free" aria-hidden="true">
          <span className="dems-storage-free whitespace-nowrap font-semibold text-foreground">
            <AnimatedNumber value={ready ? freeTb : 0} from={0} format={formatOneDecimal} />
            {` TB ${t('dashboard.storage.free')}`}
          </span>
          <span className="text-caption text-foreground-2">{t('dashboard.storage.ofTotal', { total: totalText })}</span>
        </div>

        <dl className="dems-legend min-w-0 flex-1" aria-label={t('dashboard.storage.legendLabel')}>
          {legend.map((row) => (
            <div key={row.key}>
              <dt className="flex min-w-0 items-center gap-2 text-foreground-2">
                <span className={cn('dems-dot', row.dot)} aria-hidden="true" />
                <span className="min-w-0 break-words">{row.label}</span>
              </dt>
              <dd data-testid={`storage-legend-${row.key}`}>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </DashPanel>
  )
}
