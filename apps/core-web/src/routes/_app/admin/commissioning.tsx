import { createFileRoute } from '@tanstack/react-router'
import { Permission } from '@dems/shared/sim'
import { CommissioningPage } from '@/features/commissioning'
import { requireCorePermission } from './-guard'

/**
 * `/admin/commissioning`: the commissioning screen of the camera network (task 4, blueprint row
 * 112; decision U10: TECHNICIAN only). RBAC as the two other administration routes: in Live mode an
 * operator without `CAPTURE_COMMISSION` is sent to the Dashboard, where the shell says which page
 * was refused and which role opens it. In Simulated mode the page itself reads the simulator's role
 * table: another role sees the role sentence and no control.
 */
export const Route = createFileRoute('/_app/admin/commissioning')({
  beforeLoad: ({ context }) => requireCorePermission(context.sim, Permission.CAPTURE_COMMISSION),
  component: CommissioningPage,
})
