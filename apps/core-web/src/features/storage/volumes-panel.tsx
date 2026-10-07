import { Chip, Label, ProgressBar } from '@heroui/react'
import { Archive, Cpu, Info, Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CoreMode, useCoreMode } from '@dems/shared/live'
import { formatWibTime, selectStorage, TB, useSim, type StorageVolume } from '@dems/shared/sim'
import { toneChipProps, type StatusTone } from '@dems/shared/tokens'
import { useMotionPolicy } from '@/motion'
import { PANEL_BEAT_MS, useDataReady, VOLUME_FILL_MS } from './choreography'
import { fixed, formatShortBytes, STORAGE_LEVEL_TONE, type StorageLevel } from './model'
import { StoragePanel } from './panel'
import { selectVolumeTemperatureSeries, volumeHealth, type SmartStatus, type TempLevel } from './sim-adapter'
import { Sparkline } from './sparkline'

const SMART_TONE: Record<SmartStatus, StatusTone> = { PASSED: 'success', WARNING: 'warning', FAILED: 'danger' }
const TEMP_TONE: Record<TempLevel, StatusTone> = { OK: 'success', WARM: 'warning', HOT: 'danger' }

/**
 * The footnote on the SMART values, by data mode. Live mode (plan row W71): the volumes and the
 * temperatures are the Core server's (`storage`, `health`), but the Core server reports no SMART
 * counters (RESIDUAL-W71-1, W83 ledger #47): the console derives them with the same `driveHealth`, and the
 * footnote says so without naming a simulator (04_client_integration_spec §3.2).
 */
const DERIVED_NOTE = {
  [CoreMode.SIMULATED]: 'storage.volumes.derivedNote',
  [CoreMode.LIVE]: 'storage.volumes.live.derivedNote',
} as const

/**
 * Volumes & Health (01_specs §14.5.5 "Volumes: NVMe (system), HDD (evidence)", `ProgressBar` × 2;
 * research/01_explore §10.1 roles). Each drive shows its role, its fill (kit ProgressBar whose fill
 * reveals with a 700 ms `scaleX`, never a width animation, §9.2), and SMART-like health with a
 * live temperature sparkline. Per-volume health is the simulator's `driveHealth` (step 54).
 */
export function VolumesPanel() {
  const { t } = useTranslation()
  const volumes = useSim((s) => s.storage.volumes)
  const level = useSim((s) => selectStorage(s).state) as StorageLevel
  const derivedNote = DERIVED_NOTE[useCoreMode()]
  return (
    <StoragePanel id="volumes" icon={Server} title={t('storage.volumes.panelTitle')} bodyClassName="stor-volumes">
      {volumes.map((volume) => (
        <VolumeCard key={volume.id} volume={volume} level={volume.kind === 'EVIDENCE' ? level : 'READY'} />
      ))}
      <p className="stor-footnote">
        <Info aria-hidden="true" strokeWidth={1.75} />
        <span>
          {t('storage.volumes.roleSource')} · {t(derivedNote)}
        </span>
      </p>
    </StoragePanel>
  )
}

function VolumeCard({ volume, level }: { volume: StorageVolume; level: StorageLevel }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const ready = useDataReady(PANEL_BEAT_MS.volumes)
  const health = useSim((s) => volumeHealth(s, volume))
  const series = useSim((s) => selectVolumeTemperatureSeries(s, volume.kind))
  const lastVerifiedAt = useSim((s) => (volume.kind === 'EVIDENCE' ? s.storage.lastWriteVerifiedAt : null))
  const percent = volume.totalBytes > 0 ? (volume.usedBytes / volume.totalBytes) * 100 : 0
  const Icon = volume.kind === 'SYSTEM' ? Cpu : Archive
  const barTone = volume.kind === 'SYSTEM' ? 'bronze' : STORAGE_LEVEL_TONE[level]
  const total = `${fixed(volume.totalBytes / TB, 1)} ${t('storage.units.tb')}`
  const fill = m.flags.animateNumbers ? (ready ? percent / 100 : 0) : percent / 100
  const fillTransition = m.flags.animateNumbers
    ? `transform ${VOLUME_FILL_MS * m.timeScale}ms cubic-bezier(0.22, 1, 0.36, 1)`
    : 'none'

  return (
    <article className="stor-volume" data-testid={`storage-volume-${volume.id}`} data-kind={volume.kind}>
      <div className="stor-volume-head">
        <span className="stor-volume-icon" aria-hidden="true">
          <Icon strokeWidth={1.75} />
        </span>
        <div className="stor-volume-title">
          <h3>{t(`storage.volumes.kind.${volume.kind}`)}</h3>
          <p>
            {volume.id} · {total}
          </p>
        </div>
        <div className="stor-volume-chips">
          <Chip size="sm" variant="soft" {...toneChipProps(volume.kind === 'SYSTEM' ? 'default' : 'accent')}>
            {t(`storage.volumes.role.${volume.kind}`)}
          </Chip>
          <Chip size="sm" variant="soft" {...toneChipProps(SMART_TONE[health.smart])} data-testid={`storage-smart-${volume.id}`}>
            {t(`storage.volumes.smart.${health.smart}`)}
          </Chip>
        </div>
      </div>
      <p className="stor-volume-role">{t(`storage.volumes.roleText.${volume.kind}`)}</p>
      <ProgressBar
        value={percent}
        className="stor-bar"
        data-tone={barTone}
        style={{ ['--stor-fill' as string]: String(fill), ['--stor-fill-transition' as string]: fillTransition }}
        valueLabel={t('storage.volumes.percentUsed', { percent: Math.round(percent) })}
      >
        <Label className="stor-bar-label">
          {t('storage.volumes.usedOf', { used: formatShortBytes(volume.usedBytes), total })}
        </Label>
        <ProgressBar.Output className="stor-bar-output" />
        <ProgressBar.Track className="stor-bar-track">
          <ProgressBar.Fill className="stor-bar-fill" />
        </ProgressBar.Track>
      </ProgressBar>
      <dl className="stor-health">
        <div className="stor-health-cell stor-health-temp" data-level={health.tempLevel}>
          <dt>{t('storage.volumes.temperature')}</dt>
          <dd>
            <span className="stor-health-value" data-testid={`storage-temp-${volume.id}`}>
              {fixed(health.temperatureC, 1)}
              <span className="stor-health-unit">{t('storage.units.celsius')}</span>
            </span>
            <Chip size="sm" variant="soft" {...toneChipProps(TEMP_TONE[health.tempLevel])}>
              {t(`storage.volumes.tempLevel.${health.tempLevel}`)}
            </Chip>
            <Sparkline className="stor-spark" values={series} label={t('storage.volumes.tempTrend')} />
          </dd>
        </div>
        {volume.kind === 'SYSTEM' ? (
          <>
            <HealthCell label={t('storage.volumes.wear')} value={`${health.wearPercent ?? 0}%`} />
            <HealthCell label={t('storage.volumes.mediaErrors')} value={String(health.mediaErrors ?? 0)} />
          </>
        ) : (
          <>
            <HealthCell label={t('storage.volumes.reallocated')} value={String(health.reallocatedSectors ?? 0)} />
            <HealthCell
              label={t('storage.volumes.lastVerified')}
              value={lastVerifiedAt === null ? t('storage.volumes.notYet') : formatWibTime(lastVerifiedAt)}
            />
          </>
        )}
        <HealthCell
          label={t('storage.volumes.powerOn')}
          value={`${health.powerOnHours.toLocaleString('en-US')} ${t('storage.units.hours')}`}
        />
      </dl>
    </article>
  )
}

function HealthCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="stor-health-cell">
      <dt>{label}</dt>
      <dd>
        <span className="stor-health-value">{value}</span>
      </dd>
    </div>
  )
}
