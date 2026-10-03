import { useMemo, type ReactNode } from 'react'
import { Card } from '@heroui/react'
import { motion } from 'motion/react'
import { CalendarClock, Gauge, HardDriveDownload, Hourglass, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  GB,
  RECORDING_BYTES_PER_HOUR,
  selectIsRecording,
  selectStorage,
  selectStoragePolicy,
  useSim,
} from '@dems/shared/sim'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { useMotionPolicy } from '@/motion'
import { KPI_STEP_MS, PANEL_BEAT_MS, panelVariants, useDataReady } from './choreography'
import { fixed, MB } from './model'
import { useRouteEnterDelay } from '@/components/shell'

/** 8.2 GB/h, the rate the simulator writes at (AC-54). */
const RATE_GB_PER_HOUR = fixed(RECORDING_BYTES_PER_HOUR / GB, 1)

/**
 * The four KPI cards (01_specs §14.5.5: `Card variant="secondary"` × 4, MP AnimatedNumber):
 * write speed, session size, estimated remaining (computed from free space at 8.2 GB/h, 04 §9 #17)
 * and retention days. They land 60 ms apart after the ring, and their numbers tick after the held
 * beat. Session size and remaining time follow the simulator's 1 Hz storage step while recording.
 */
export function KpiCards() {
  const { t } = useTranslation()
  const writeBps = useSim((s) => s.storage.writeBytesPerSec)
  const recording = useSim(selectIsRecording)
  const session = useSim((s) =>
    s.session ? { id: s.session.id, state: s.session.state, bytes: s.session.bytesWritten } : null,
  )
  const remainingMinutes = useSim((s) => Math.floor(selectStorage(s).estimatedRemainingMs / 60_000))
  const policy = useSim(selectStoragePolicy)
  const ready = useDataReady(PANEL_BEAT_MS.kpis)

  // The counter spring settles on the whole-minute target; round so a settling 23384.99 reads 45 m.
  const hm = (value: number) => {
    const minutes = Math.max(0, Math.round(value))
    return t('common.units.hoursMinutes', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
  }
  const continuousDays = Math.floor(remainingMinutes / 60 / 24)

  return (
    <div
      className="stor-kpis stor-area-kpis"
      role="group"
      aria-label={t('storage.kpi.groupLabel')}
      data-testid="storage-panel-kpis"
    >
      <KpiCard
        index={0}
        id="writeSpeed"
        icon={Gauge}
        label={t('common.storage.writeSpeed')}
        value={<AnimatedNumber value={ready ? writeBps / MB : 0} format={(v) => fixed(v, 1)} />}
        unit={t('storage.units.mbPerSecond')}
        caption={
          recording
            ? t('storage.kpi.writeSpeedRecording', { rate: RATE_GB_PER_HOUR })
            : t('storage.kpi.writeSpeedIdle')
        }
        live={recording}
      />
      <KpiCard
        index={1}
        id="sessionSize"
        icon={HardDriveDownload}
        label={t('common.storage.sessionSize')}
        value={
          session ? (
            <AnimatedNumber value={ready ? session.bytes / GB : 0} format={(v) => fixed(v, 2)} />
          ) : (
            <span aria-label={t('storage.kpi.noSession')}>—</span>
          )
        }
        unit={session ? t('storage.units.gb') : undefined}
        caption={
          session
            ? session.state === 'RECORDING'
              ? t('storage.kpi.sessionLive', { sessionId: session.id })
              : t('storage.kpi.sessionState', {
                  sessionId: session.id,
                  state: t(`common.enums.sessionState.${session.state}`),
                })
            : t('storage.kpi.noSession')
        }
        live={recording}
      />
      <KpiCard
        index={2}
        id="estRemaining"
        icon={Hourglass}
        label={t('common.storage.estRemaining')}
        value={<AnimatedNumber value={ready ? remainingMinutes : 0} format={hm} />}
        caption={t('storage.kpi.estRemainingHint', { rate: `${RATE_GB_PER_HOUR} ${t('storage.units.gb')}` })}
        secondary={
          continuousDays < 1
            ? t('storage.kpi.lessThanDay')
            : t('storage.kpi.continuousDays', { count: continuousDays })
        }
      />
      <KpiCard
        index={3}
        id="retentionDays"
        icon={CalendarClock}
        label={t('storage.kpi.retentionDays')}
        value={<AnimatedNumber value={ready ? policy.retentionDays : 0} />}
        unit={t('storage.units.days')}
        caption={t('storage.kpi.retentionPolicy', {
          policy: t(`storage.manage.policies.${policy.retentionPolicy}`),
          autoArchive: policy.autoArchive ? t('storage.kpi.on') : t('storage.kpi.off'),
        })}
      />
    </div>
  )
}

interface KpiCardProps {
  index: number
  id: string
  icon: LucideIcon
  label: string
  value: ReactNode
  unit?: string
  caption: string
  secondary?: string
  /** Marks a value that follows the live recording (a small REC-red tick on the label). */
  live?: boolean
}

function KpiCard({ index, id, icon: Icon, label, value, unit, caption, secondary, live = false }: KpiCardProps) {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  const variants = useMemo(
    () => panelVariants(m, m.reduced ? 0 : routeDelay + PANEL_BEAT_MS.kpis + index * KPI_STEP_MS),
    [m, routeDelay, index],
  )
  return (
    <motion.div className="stor-kpi-cell" variants={variants} initial="hidden" animate="visible">
      <Card variant="secondary" className="stor-kpi" data-testid={`storage-kpi-${id}`} data-live={live ? 'true' : 'false'}>
        <div className="stor-kpi-head">
          <span className="stor-kpi-icon" aria-hidden="true">
            <Icon strokeWidth={1.75} />
          </span>
          <span className="stor-kpi-label">{label}</span>
          {live ? <span className="stor-kpi-live" aria-hidden="true" /> : null}
        </div>
        <p className="stor-kpi-value">
          {value}
          {unit ? <span className="stor-kpi-unit">{unit}</span> : null}
        </p>
        <p className="stor-kpi-caption">{caption}</p>
        {secondary ? <p className="stor-kpi-secondary">{secondary}</p> : null}
      </Card>
    </motion.div>
  )
}
