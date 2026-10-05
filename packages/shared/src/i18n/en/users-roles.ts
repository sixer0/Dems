/**
 * `usersRoles.*`: the Users & Roles page, `/admin/users` (backend task 04_client_integration_spec
 * §10.1 PG-10, §10.2). Live mode only. Plan row W54 wrote the words of the page stub; the page row
 * (W77) adds the key families of §10.2: `summary`, `users.*`, `actions.*`, `roleDialog.*`,
 * `disableDialog.*`, `enableDialog.*`, `lastAdmin`, `matrix.*`, `toasts.*` and the other `states.*`.
 * Role labels are `common.roles.*`; the labels of the three newer permissions are
 * `common.rbac.permissions.*`. The navigation label is `shell.nav.usersRoles`.
 */
import type { ResourceTree } from '../resource-tree';

export const usersRoles = {
  title: 'Users & Roles',
  subtitle: 'Operators, their roles and what each role may do',

  states: {
    /** Under the heading `shell.liveOnly.title`. */
    liveOnly: 'Simulated mode has no user list and assigns no role. Users and roles are kept by the Core server.',
  },
} as const satisfies ResourceTree;
