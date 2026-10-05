/**
 * Paired Devices page, `/admin/devices` (backend task 04_client_integration_spec §10.1 PG-1, PG-2,
 * PG-3; §10.3). STUB of plan row W54: the page contract only. The export name `PairedDevicesPage`
 * (imported by `routes/_app/admin/devices.tsx`) and the root `data-testid="page-paired-devices"`
 * are kept by the page row (W81), which replaces the Live body with the two panels of §10.3.
 *
 * | Mode | What the stub shows |
 * |------|---------------------|
 * | Simulated (a direct URL: the sidebar hides the entry) | The header and the "Live mode only" state, `pd-live-only` |
 * | Live, with `PAIRING_MANAGE` (the route guard sends everybody else to the Dashboard) | The header and an empty body, `pd-stub` |
 */
import { Card, EmptyState } from '@heroui/react'
import { TabletSmartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CoreMode, useCoreMode } from '@dems/shared/live'
import { LiveOnlyState } from '@/components/shell/live-only-state'
import { PageHeader } from '@/components/shell/page-header'

export function PairedDevicesPage() {
  const { t } = useTranslation()
  const live = useCoreMode() === CoreMode.LIVE
  return (
    <div className="dems-page" data-testid="page-paired-devices">
      <PageHeader icon={TabletSmartphone} title={t('pairedDevices.title')} subtitle={t('pairedDevices.subtitle')} />
      {live ? (
        <Card className="dems-live-only-card rounded-xl">
          <EmptyState className="dems-live-only" data-testid="pd-stub">
            {t('common.states.empty')}
          </EmptyState>
        </Card>
      ) : (
        <LiveOnlyState icon={TabletSmartphone} body={t('pairedDevices.states.liveOnly')} testId="pd-live-only" />
      )}
    </div>
  )
}
