import { createFileRoute } from '@tanstack/react-router'
import { Permission } from '@dems/shared/sim'
import { PairedDevicesPage } from '@/features/paired-devices'
import { requireCorePermission } from './-guard'

/**
 * `/admin/devices`: Paired Devices (backend task 04_client_integration_spec §10.1 PG-1, PG-3;
 * §10.3). RBAC: in Live mode an operator without `PAIRING_MANAGE` is sent to the Dashboard. In
 * Simulated mode the page shows its "Live mode only" state.
 */
export const Route = createFileRoute('/_app/admin/devices')({
  beforeLoad: ({ context }) => requireCorePermission(context.sim, Permission.PAIRING_MANAGE),
  component: PairedDevicesPage,
})
