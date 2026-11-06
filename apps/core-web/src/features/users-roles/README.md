# src/features/users-roles

Up: [src/features](../README.md)

## Purpose

The Users and Roles page of the web console (`/admin/users`, permission `USER_ADMIN`): the list of operators, the role and permission matrix, and the commands change role, disable and enable. The vendor `root` account additionally gets add user, edit profile and delete user. The page gates are cosmetic; the Core server checks every call. Live mode only; in Simulated mode the page shows its "Live mode only" state.

## Files

| File | Role |
|---|---|
| [`__tests__/`](__tests__/) | Tests and the test bed of this feature |
| [`account-dialogs.tsx`](account-dialogs.tsx) | `CreateUserDialog`, `EditUserDialog`, `DeleteUserDialog`: the vendor-only dialogs, shown only to the signed-in `root` account |
| [`account-form.ts`](account-form.ts) | Pure rules of the create, edit and delete dialogs: drafts, normalising, validation, the create body |
| [`choreography.ts`](choreography.ts) | Enter beats of the page |
| [`commands.ts`](commands.ts) | `sendAdminCommand`, `useAdminCommand`: the page's commands, their bodies and what the operator sees per answer; updates the cached list |
| [`index.tsx`](index.tsx) | `UsersRolesPage`: page layout with the operators and matrix panels and the dialogs |
| [`matrix-panel.tsx`](matrix-panel.tsx) | `MatrixPanel`: the read-only role and permission matrix |
| [`model.ts`](model.ts) | Pure rules: `isVendorRoot`, `isSystemAccount` (the system principal `OPR-000`), role order and tone, summary, role differences, administrators |
| [`panel.tsx`](panel.tsx) | `Panel` card frame and `PanelErrorBoundary` |
| [`queries.ts`](queries.ts) | `useUsersQuery` (operation 11 `listUsers`) and `useRoleMatrixQuery` (operation 10 `getRoleMatrix`) |
| [`report.ts`](report.ts) | `reportUsersError`: the page's own log reporter (prefix `usr`) |
| [`role-dialog.tsx`](role-dialog.tsx) | `RoleDialog`: change an operator's role with an optional reason |
| [`status-dialogs.tsx`](status-dialogs.tsx) | `DisableDialog`, `EnableDialog` |
| [`users-panel.tsx`](users-panel.tsx) | `UsersPanel`: operator rows with their actions |
| [`users-roles.css`](users-roles.css) | Page styles (`ur-*` classes) |

## Main exports

- `UsersRolesPage` (`index.tsx`), the route component.
- Panels and dialogs: `UsersPanel`, `MatrixPanel`, `RoleDialog`, `DisableDialog`, `EnableDialog`, `CreateUserDialog`, `EditUserDialog`, `DeleteUserDialog`.
- Model and hooks: `model.ts`, `account-form.ts`, `queries.ts`, `commands.ts` (`useAdminCommand`).

Routes: `/admin/users` (`src/routes/_app/admin/users.tsx`). The route guard `src/routes/_app/admin/-guard.ts` sends an operator without `USER_ADMIN` to `/dashboard` in Live mode.

## Core operations, state and shared modules

- Reads: 10 `getRoleMatrix` (`CORE_QUERY_KEYS.roleMatrix`, shared with Security and Audit), 11 `listUsers` (`CORE_QUERY_KEYS.users`).
- Commands as named in `commands.ts`: 12 `assignUserRole`, 13 `enableUser`, 14 `disableUser`, and the vendor trio 15 `createUser`, 16 `updateUser`, 17 `deleteUser`. A non-root caller with `USER_ADMIN` gets 403 `NOT_PERMITTED` from the Core.
- Shared modules: `@dems/shared/api`, `@dems/shared/client`, `@dems/shared/live`, `@dems/shared/realtime`, `@dems/shared/sim`.
- Console folders: [`src/lib`](../../lib/) (Core errors, page reporter), [`src/routes/_app/admin`](../../routes/_app/admin/), [`../security-audit`](../security-audit/README.md).

## Tests

- [`__tests__/`](__tests__/): `vendor-account-actions.test.tsx` and the test bed `users-roles-bed.tsx`.
- Page-level tests in [`src/test`](../../test/): `live-shell-admin.test.tsx`, `live-users-roles-page.test.tsx`, `live-users-roles-commands.test.tsx`, `live-users-roles-model.test.tsx`.

## Related decisions

- D93: the Core refuses operations 12, 14, 16 and 17 for the system principal `OPR-000` (409 `INVALID_STATE`, reason `SYSTEM_PRINCIPAL`).
