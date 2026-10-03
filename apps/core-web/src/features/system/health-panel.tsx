import { Chip } from '@heroui/react'
import { Activity, Cpu, Fan, Thermometer, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSim, type HealthPoint, type SimState } from '@dems/shared/sim'
import { HEALTH_SCALES, sparklinePath } from './model'
import { SystemPanel } from './panel'

const W = 240
const H = 44

const selectSeries = (s: SimState): HealthPoint[] => s.health.series
const selectNow = (s: SimState) => ({
  cpuPercent: s.health.cpuPercent,
  cpuTempC: s.health.cpuTempC,
  storageTempC: s.health.storageTempC,
  ambientTempC: s.health.ambientTempC,
  fanRpm: s.health.fanRpm,
  fanOk: s.health.fanOk,
})

interface Line {
  key: string
  values: number[]
  className: string
}

/** Plain-SVG streaming sparkline (03 M-PG-SYS: "health sparklines, streaming, no animation"). */
function Sparkline({ lines, min, max, warn, label }: { lines: Line[]; min: number; max: number; warn?: number; label: string }) {
  const warnY = warn === undefined ? null : H - ((warn - min) / (max - min)) * H
  return (
    <svg className="sys-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {warnY !== null ? <line x1={0} x2={W} y1={warnY} y2={warnY} className="sys-spark-warn" vectorEffect="non-scaling-stroke" /> : null}
      {lines.map((line) => (
        <path key={line.key} d={sparklinePath(line.values, W, H, min, max)} className={line.className} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}

function MiniCard({ icon: Icon, title, value, chip, children, testId }: { icon: LucideIcon; title: string; value: ReactNode; chip?: ReactNode; children: ReactNode; testId: string }) {
  return (
    <div className="sys-mini" data-testid={testId}>
      <div className="sys-mini-head">
        <Icon className="sys-mini-icon" aria-hidden="true" strokeWidth={1.75} />
        <span className="sys-mini-title">{title}</span>
        {chip ? <span className="sys-mini-chip">{chip}</span> : null}
      </div>
      <div className="sys-mini-value">{value}</div>
      {children}
    </div>
  )
}

/**
 * Health (01_specs §14.5.8; design book §6.1 Health Monitor): CPU load, zone temperatures (CPU,
 * HDD, ambient) and fan speed, 120 points at 1 Hz from `health.series`. FAN_STALL turns the fan
 * line red with a chip escalation (03 §7), while the temperatures climb.
 */
export function HealthPanel() {
  const { t } = useTranslation()
  const series = useSim(selectSeries)
  const now = useSim(selectNow)
  const cpu = series.map((point) => point.cpuPercent)
  const temps = HEALTH_SCALES.temperatureC
  return (
    <SystemPanel id="health" icon={Activity} title={t('system.health.title')} action={<span className="sys-muted sys-small">{t('system.health.window')}</span>} bodyClassName="sys-health-body">
      <MiniCard
        icon={Cpu}
        testId="system-health-cpu"
        title={t('system.health.cpu')}
        value={
          <>
            <span className="sys-figure">{now.cpuPercent.toFixed(0)}</span>
            <span className="sys-unit">%</span>
            <span className="sys-muted sys-small">{t('system.health.load')}</span>
          </>
        }
      >
        <Sparkline
          lines={[{ key: 'cpu', values: cpu, className: 'sys-spark-line' }]}
          min={HEALTH_SCALES.cpuPercent.min}
          max={HEALTH_SCALES.cpuPercent.max}
          warn={HEALTH_SCALES.cpuPercent.warn}
          label={t('system.health.chartLabel', { metric: t('system.health.cpu') })}
        />
      </MiniCard>

      <MiniCard
        icon={Thermometer}
        testId="system-health-temperature"
        title={t('system.health.temperature')}
        value={
          <span className="sys-zones">
            <span><i className="sys-zone-dot" data-zone="cpu" aria-hidden="true" />{t('system.health.zones.cpu')} <b className="sys-mono">{now.cpuTempC.toFixed(1)}</b></span>
            <span><i className="sys-zone-dot" data-zone="storage" aria-hidden="true" />{t('system.health.zones.storage')} <b className="sys-mono">{now.storageTempC.toFixed(1)}</b></span>
            <span><i className="sys-zone-dot" data-zone="ambient" aria-hidden="true" />{t('system.health.zones.ambient')} <b className="sys-mono">{now.ambientTempC.toFixed(1)}</b></span>
            <span className="sys-muted sys-small">°C</span>
          </span>
        }
      >
        <Sparkline
          lines={[
            { key: 'cpu', values: series.map((p) => p.cpuTempC), className: 'sys-spark-line' },
            { key: 'storage', values: series.map((p) => p.storageTempC), className: 'sys-spark-line sys-spark-line--b' },
            { key: 'ambient', values: series.map((p) => p.ambientTempC), className: 'sys-spark-line sys-spark-line--c' },
          ]}
          min={temps.min}
          max={temps.max}
          warn={temps.warn}
          label={t('system.health.chartLabel', { metric: t('system.health.temperature') })}
        />
      </MiniCard>

      <MiniCard
        icon={Fan}
        testId="system-health-fan"
        title={t('system.health.fan')}
        chip={
          <Chip size="sm" variant="soft" color={now.fanOk ? 'success' : 'danger'} className="sys-status-chip" data-testid="system-fan-chip">
            <Chip.Label>{now.fanOk ? t('system.health.fanNormal') : t('system.health.fanStalled')}</Chip.Label>
          </Chip>
        }
        value={
          <>
            <span className="sys-figure" data-tone={now.fanOk ? undefined : 'danger'}>{now.fanRpm.toLocaleString('en-US')}</span>
            <span className="sys-unit">RPM</span>
          </>
        }
      >
        <Sparkline
          lines={[{ key: 'fan', values: series.map((p) => p.fanRpm), className: now.fanOk ? 'sys-spark-line' : 'sys-spark-line sys-spark-line--danger' }]}
          min={HEALTH_SCALES.fanRpm.min}
          max={HEALTH_SCALES.fanRpm.max}
          label={t('system.health.chartLabel', { metric: t('system.health.fan') })}
        />
      </MiniCard>
    </SystemPanel>
  )
}
