import { Chip } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useSelfCaptureCore } from '@/lib/own-capture'

/**
 * Fix wave L (G75d-07, ruling D224 (3) / D228 (3)): THE MARK OF A BLOCK THAT STILL SHOWS MODEL VALUES
 * on a Core in its own capture. Such a Core replicates the simulator's appliance model for the
 * blocks it has no reading for (PoE switch, relay lamp, port map, front panel, network interfaces,
 * volumes and SMART, services, health, update slots). Those values are not facts of this Core, so
 * every such block carries this chip - the same words as System > About. On the simulated lane the
 * chip is not drawn (`useSelfCaptureCore` is false): its pages are unchanged.
 */
export function SyntheticValuesChip({ block, className }: { block: string; className?: string }) {
  const { t } = useTranslation()
  const ownCore = useSelfCaptureCore()
  if (!ownCore) return null
  return (
    <Chip size="sm" variant="soft" color="warning" className={className} data-testid={`synthetic-values-${block}`} data-synthetic-block={block}>
      <Chip.Label title={t('web.waveL.syntheticHint')}>{t('web.waveL.syntheticChip')}</Chip.Label>
    </Chip>
  )
}
