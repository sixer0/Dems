import { useState } from 'react'
import { Button, Chip } from '@heroui/react'
import { Layers, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { selectStorage, selectStoragePolicy, useSim } from '@dems/shared/sim'
import { toneChipProps } from '@dems/shared/tokens'
import { useMotionPolicy } from '@/motion'
import { PANEL_BEAT_MS, useDataReady, VOLUME_FILL_MS } from './choreography'
import { ManageStorageDrawer } from './manage-drawer'
import { STORAGE_LEVEL_TONE, THRESHOLDS, type StorageLevel } from './model'
import { StoragePanel } from './panel'

/**
 * Storage Policy (research/04 §5.3 "Manage Storage" plus the brief's policy block): the evidence
 * volume's fill on a 0–100 % scale with the simulator's LOW (85 %) and FULL (98 %) thresholds
 * marked, the retention policy and what each threshold does, and the "Manage Storage" button that
 * opens the kit Drawer (01_specs §14.5.5: `Select` retention policy, `Switch` auto-archive).
 */
export function PolicyPanel() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const [open, setOpen] = useState(false)
  const policy = useSim(selectStoragePolicy)
  const level = useSim((s) => selectStorage(s).state) as StorageLevel
  const ratio = useSim((s) => Math.round(selectStorage(s).usedRatioPercent * 10) / 10)
  const ready = useDataReady(PANEL_BEAT_MS.policy)
  const scale = m.flags.animateNumbers ? (ready ? ratio / 100 : 0) : ratio / 100
  const transition = m.flags.animateNumbers
    ? `transform ${VOLUME_FILL_MS * m.timeScale}ms cubic-bezier(0.22, 1, 0.36, 1)`
    : 'none'

  return (
    <StoragePanel id="policy" icon={ShieldCheck} title={t('storage.policy.title')} bodyClassName="stor-policy">
      <div className="stor-policy-inner">
        <div
          className="stor-scale"
          role="img"
          aria-label={`${t('storage.policy.scaleLabel')}: ${t('storage.policy.now', { percent: Math.round(ratio) })}`}
          data-testid="storage-threshold-scale"
          data-tone={STORAGE_LEVEL_TONE[level]}
          style={{
            ['--stor-fill' as string]: String(scale),
            ['--stor-fill-transition' as string]: transition,
            ['--stor-low' as string]: `${THRESHOLDS.low}%`,
            ['--stor-full' as string]: `${THRESHOLDS.full}%`,
          }}
        >
          <div className="stor-scale-track">
            <span className="stor-scale-band-low" aria-hidden="true" />
            <span className="stor-scale-band-full" aria-hidden="true" />
            <span className="stor-scale-fill" aria-hidden="true" />
          </div>
          <div className="stor-scale-legend" aria-hidden="true">
            <span className="stor-scale-now">{t('storage.policy.now', { percent: Math.round(ratio) })}</span>
            <span className="stor-scale-key" data-tone="warning">
              {t('storage.policy.low', { percent: THRESHOLDS.low })}
            </span>
            <span className="stor-scale-key" data-tone="danger">
              {t('storage.policy.full', { percent: THRESHOLDS.full })}
            </span>
          </div>
        </div>

        <dl className="stor-policy-list">
          <div>
            <dt>{t('storage.policy.retention')}</dt>
            <dd data-testid="storage-policy-retention">{t(`storage.manage.policies.${policy.retentionPolicy}`)}</dd>
          </div>
          <div>
            <dt>{t('storage.policy.autoArchive')}</dt>
            <dd>{policy.autoArchive ? t('common.status.enabled') : t('common.status.disabled')}</dd>
          </div>
          <div>
            <dt>{t('storage.policy.sealed')}</dt>
            <dd>
              <Chip size="sm" variant="soft" {...toneChipProps('sealed')}>
                {t('storage.policy.sealedValue')}
              </Chip>
            </dd>
          </div>
          <div>
            <dt>{t('storage.policy.whenLow')}</dt>
            <dd className="stor-policy-warn">{t('storage.policy.whenLowValue')}</dd>
          </div>
          <div>
            <dt>{t('storage.policy.whenFull')}</dt>
            <dd className="stor-policy-danger">{t('storage.policy.whenFullValue')}</dd>
          </div>
        </dl>

        <div className="stor-policy-actions">
          <Button variant="outline" fullWidth className="stor-manage-button" onPress={() => setOpen(true)} data-testid="storage-manage-open">
            <Layers aria-hidden="true" strokeWidth={1.75} />
            {t('storage.manage.button')}
          </Button>
        </div>
      </div>
      <ManageStorageDrawer isOpen={open} onOpenChange={setOpen} />
    </StoragePanel>
  )
}
