import { createFileRoute } from '@tanstack/react-router'
import { Permission } from '@dems/shared/sim'
import { UsersRolesPage } from '@/features/users-roles'
import { requireCorePermission } from './-guard'

/**
 * `/admin/users`: Users & Roles (backend task 04_client_integration_spec §10.1 PG-1, PG-3; §10.2).
 * RBAC: in Live mode an operator without `USER_ADMIN` is sent to the Dashboard. In Simulated mode
 * the page shows its "Live mode only" state.
 */
export const Route = createFileRoute('/_app/admin/users')({
  beforeLoad: ({ context }) => requireCorePermission(context.sim, Permission.USER_ADMIN),
  component: UsersRolesPage,
})
