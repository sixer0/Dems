import { Skeleton } from '@heroui/react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StoragePanel } from './panel'

export interface ChartSkeletonPanelProps {
  id: 'usage' | 'sealed'
  icon: LucideIcon
  titleKey: 'storage.charts.usage24h' | 'storage.charts.sealedPerHour'
}

/**
 * The chart panel while its lazy chunk (Recharts) loads: the same panel frame and test ID, with a
 * kit Skeleton in the chart area (M-C-24: skeletons only during the first load; the kit shimmer
 * stops under reduced motion).
 */
export function ChartSkeletonPanel({ id, icon, titleKey }: ChartSkeletonPanelProps) {
  const { t } = useTranslation()
  return (
    <StoragePanel id={id} icon={icon} title={t(titleKey)}>
      <Skeleton className="stor-chart stor-chart-skeleton rounded-lg" />
    </StoragePanel>
  )
}
