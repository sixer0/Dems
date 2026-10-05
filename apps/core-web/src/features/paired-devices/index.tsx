/**
 * Paired Devices page, `/admin/devices` (backend task 04_client_integration_spec §10.1, §10.3;
 * permission `PAIRING_MANAGE`; plan row W81, replacing the page stub of row W54). The export name
 * `PairedDevicesPage` (imported by `routes/_app/admin/devices.tsx`) and the root
 * `data-testid="page-paired-devices"` are W54's page contract.
 *
 * | Mode | What the page shows |
 * |------|---------------------|
 * | Simulated (a direct URL: the sidebar hides the entry) | The header and the "Live mode only" state, `pd-live-only`, inside the page's own grid (F76-12) |
 * | Live, with `PAIRING_MANAGE` (the route guard sends everybody else to the Dashboard) | The header with "n paired · m online"; "Pair a device" (the hero, 5 of 12 columns from 1280 px) and "Devices" (7 of 12) |
 * | Live, a read answered 403 (a stale hint) | The header and the Forbidden state, `pd-forbidden`, with a link to the Dashboard |
 *
 * The Live body's grid carries the test ID `paired-devices-page`: `test/live-shell-admin.test.tsx`
 * finds it inside the page root as "the Live branch is on screen". It replaced W54's stub ID `pd-stub`
 * in the closing web round (row W1, decision D179 DC-1).
 *
 * The pairing code is held in `code-memory.ts` only; see there for where it may and may not go.
 */
import { Card, Chip, EmptyState } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { ShieldX, TabletSmartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CoreMode, useCoreMode } from '@dems/shared/live'
import { LiveOnlyState } from '@/components/shell/live-only-state'
import { PageHeader } from '@/components/shell/page-header'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { DevicesPanel } from './devices-panel'
import { IssuePanel } from './issue-panel'
import { isForbidden, usePairingReads } from './live-data'
import { deviceSummary } from './model'
import './paired-devices.css'

export function PairedDevicesPage() {
  const { t } = useTranslation()
  const live = useCoreMode() === CoreMode.LIVE
  return (
    <div className="dems-page pd-page" data-testid="page-paired-devices">
      {live ? (
        <PairedDevicesLive />
      ) : (
        <>
          <PageHeader icon={TabletSmartphone} title={t('pairedDevices.title')} subtitle={t('pairedDevices.subtitle')} />
          <div className="pd-grid">
            <div className="pd-span-full pd-state-cell">
              <LiveOnlyState icon={TabletSmartphone} body={t('pairedDevices.states.liveOnly')} testId="pd-live-only" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function PairedDevicesLive() {
  const { t } = useTranslation()
  const reads = usePairingReads()
  const forbidden = isForbidden(reads.status.error) || isForbidden(reads.devices.error)
  const devices = reads.devices.data?.devices
  return (
    <>
      <PageHeader
        icon={TabletSmartphone}
        title={t('pairedDevices.title')}
        subtitle={t('pairedDevices.subtitle')}
        status={devices !== undefined && !forbidden ? <SummaryChip {...deviceSummary(devices)} /> : undefined}
      />
      {forbidden ? (
        <div className="pd-grid">
          <div className="pd-span-full pd-state-cell">
            <Card className="dems-live-only-card rounded-xl">
              <EmptyState className="dems-live-only" data-testid="pd-forbidden">
                <ShieldX className="dems-live-only-icon" aria-hidden="true" strokeWidth={1.5} />
                <p className="dems-live-only-title">{t('pairedDevices.states.forbidden')}</p>
                <Link to="/dashboard" className="pd-link" data-testid="pd-forbidden-dashboard">
                  {t('pairedDevices.states.toDashboard')}
                </Link>
              </EmptyState>
            </Card>
          </div>
        </div>
      ) : (
        <div className="pd-grid" data-testid="paired-devices-page">
          <IssuePanel reads={reads} />
          <DevicesPanel reads={reads} />
        </div>
      )}
    </>
  )
}

const PAIRED_SLOT = '{{paired}}'
const ONLINE_SLOT = '{{online}}'
const SLOTS = /(\{\{paired\}\}|\{\{online\}\})/

/** "n paired · m online" (§10.3), the numbers as `AnimatedNumber`, the whole sentence for assistive technology. */
function SummaryChip({ paired, online }: { paired: number; online: number }) {
  const { t } = useTranslation()
  // The translated sentence with its placeholders kept (i18next does not interpolate a value again),
  // split there, so the word order stays the translation's.
  const parts = t('pairedDevices.summary', { paired: PAIRED_SLOT, online: ONLINE_SLOT }).split(SLOTS)
  return (
    <Chip variant="soft" color="default" className="pd-summary" data-testid="pd-summary" data-paired={paired} data-online={online}>
      <Chip.Label>
        <span className="sr-only">{t('pairedDevices.summary', { paired, online })}</span>
        <span aria-hidden="true">
          {parts.map((part, index) =>
            part === PAIRED_SLOT ? (
              <AnimatedNumber key={index} value={paired} />
            ) : part === ONLINE_SLOT ? (
              <AnimatedNumber key={index} value={online} />
            ) : part === '' ? null : (
              <span key={index}>{part}</span>
            ),
          )}
        </span>
      </Chip.Label>
    </Chip>
  )
}
