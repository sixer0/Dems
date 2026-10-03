import { Card } from '@heroui/react'
import { motion } from 'motion/react'
import { Cable, Camera, Cpu, Mic, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSim } from '@dems/shared/sim'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { useMotionPolicy } from '@/motion'
import { selectSummary, type DeviceTone } from './model'
import { PANEL_BEAT_MS, ROW_STAGGER_MS, useStaggerVariants } from './motion'
import { StatusDot } from './status-chip'

interface MetricItem {
  key: 'cameras' | 'microphones' | 'other' | 'ports'
  icon: LucideIcon
  label: string
  ok: number
  total: number
  tone: DeviceTone
  state: string
  detail: string
}

/**
 * Summary metric cards (01_specs §14.5.4; research/04 §4.1 #7 "metric cards"): four kit
 * `Card variant="secondary"` with a gold icon, a label, an MP **AnimatedNumber** count that ticks
 * after the held beat (R4, M-C-02) and a dot with the state word. They stagger 60 ms after the
 * panel settles (R1).
 */
export function SummaryCards() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const summary = useSim(selectSummary)
  const container = useStaggerVariants(PANEL_BEAT_MS.summary, ROW_STAGGER_MS)
  const state = (ok: number, total: number, word: 'ready' | 'online' | 'linked') =>
    ok === total ? t(`devices.summary.state.${word}`) : t('devices.summary.state.issue', { count: total - ok })

  const items: MetricItem[] = [
    {
      key: 'cameras',
      icon: Camera,
      label: t('devices.summary.cameras'),
      ok: summary.camsOk,
      total: summary.camsTotal,
      tone: summary.camsTone,
      state: state(summary.camsOk, summary.camsTotal, 'ready'),
      detail: t('devices.summary.detail.cameras'),
    },
    {
      key: 'microphones',
      icon: Mic,
      label: t('devices.summary.microphones'),
      ok: summary.micsOk,
      total: summary.micsTotal,
      tone: summary.micsTone,
      state: state(summary.micsOk, summary.micsTotal, 'ready'),
      detail: t('devices.summary.detail.microphones'),
    },
    {
      key: 'other',
      icon: Cpu,
      label: t('devices.summary.otherDevices'),
      ok: summary.otherOk,
      total: summary.otherTotal,
      tone: summary.otherTone,
      state: state(summary.otherOk, summary.otherTotal, 'online'),
      detail: t('devices.summary.detail.other'),
    },
    {
      key: 'ports',
      icon: Cable,
      label: t('devices.summary.portsLinked'),
      ok: summary.portsUp,
      total: summary.portsTotal,
      tone: summary.portsTone,
      state: state(summary.portsUp, summary.portsTotal, 'linked'),
      detail: t('devices.summary.detail.ports', { spare: summary.portsSpare, disabled: summary.portsDisabled }),
    },
  ]

  return (
    <motion.div className="dev-summary" variants={container} initial="hidden" animate="visible">
      {items.map(({ key, icon: Icon, label, ok, total, tone, state: word, detail }) => (
        <motion.div key={key} variants={m.variants.row} className="dev-metric-cell">
          <Card
            variant="secondary"
            className="dev-metric"
            data-testid={`summary-${key}`}
            data-value={ok}
            data-total={total}
            data-tone={tone}
          >
            <span className="dev-metric-head">
              <Icon className="dev-metric-icon" aria-hidden="true" strokeWidth={1.6} />
              <span className="dev-metric-label">{label}</span>
            </span>
            <span className="dev-metric-value">
              <span className="sr-only">{`${ok}/${total}`}</span>
              <span aria-hidden="true" className="inline-flex items-baseline">
                <AnimatedNumber value={ok} from={0} className="tabular-nums" />
                <span className="dev-metric-total">/{total}</span>
              </span>
            </span>
            <span className="dev-metric-state">
              <StatusDot tone={tone} />
              <span>{word}</span>
            </span>
            <span className="dev-metric-detail">{detail}</span>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  )
}
