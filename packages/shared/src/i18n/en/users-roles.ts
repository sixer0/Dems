/**
 * `usersRoles.*`: the Users & Roles page, `/admin/users` (backend task 04_client_integration_spec
 * §10.1 PG-10, §10.2). Live mode only. Plan row W54 wrote the words of the page stub; the page row
 * (W77) adds the key families of §10.2: `summary`, `users.*`, `actions.*`, `roleDialog.*`,
 * `disableDialog.*`, `enableDialog.*`, `lastAdmin`, `matrix.*`, `toasts.*` and the other `states.*`.
 * Role labels are `common.roles.*`; permission labels are `securityAudit.rbac.permissions.*`, which
 * holds all twelve (the three newer ones were added there and in `common.rbac.permissions.*` by
 * W16). The navigation label is `shell.nav.usersRoles`.
 */
import type { ResourceTree } from '../resource-tree';

export const usersRoles = {
  title: 'Users & Roles',
  subtitle: 'Operators, their roles and what each role may do',

  /** The header chip: "n users · m enabled" (the numbers are rendered apart, as counters). */
  summary: {
    label: '{{users}} users, {{enabled}} enabled',
    users_one: 'user',
    users_other: 'users',
    enabled: 'enabled',
  },

  users: {
    title: 'Operators',
    subtitle: 'Every operator of this Core, with the role and whether the account is enabled',
    tableLabel: 'Operators',
    columns: {
      operator: 'Operator',
      role: 'Role',
      status: 'Status',
      activeSessions: 'Active sessions',
      lastSignIn: 'Last sign-in',
      roleChanged: 'Role changed',
      actions: 'Actions',
    },
    you: 'You',
    enabled: 'Enabled',
    disabled: 'Disabled',
    neverSignedIn: 'Never signed in',
    roleNeverChanged: 'Not changed',
  },

  actions: {
    menu: 'Actions for {{name}}',
    menuLabel: 'Operator actions',
    changeRole: 'Change role…',
    disable: 'Disable user…',
    enable: 'Enable user',
  },

  roleDialog: {
    title: 'Change role',
    target: '{{name}} ({{username}})',
    roleLabel: 'Role',
    current: 'Current role',
    diffTitle: 'What changes',
    gains: 'Gains',
    loses: 'Loses',
    nothing: 'Nothing',
    sameRole: 'Choose another role to see what changes.',
    note: 'The operator stays signed in. The change applies at once on the web console and on paired devices.',
    ownRow: 'You are changing your own role. You may lose access to this page.',
    reasonLabel: 'Reason (optional)',
    reasonHint: 'Kept in the audit log. At most {{max}} characters.',
    confirm: 'Change role',
    invalid: 'The Core server did not accept this change. Check the reason and try again.',
  },

  disableDialog: {
    title: 'Disable user',
    body: 'Disable {{name}}? Their sessions end at once on every client, and they cannot sign in until enabled again.',
    ownRow: 'You will be signed out.',
    reasonLabel: 'Reason (optional)',
    reasonHint: 'Kept in the audit log. At most {{max}} characters.',
    confirm: 'Disable user',
    invalid: 'The Core server did not accept this change. Check the reason and try again.',
  },

  enableDialog: {
    title: 'Enable user',
    body: 'Enable {{name}}? They can sign in again.',
    confirm: 'Enable user',
  },

  /** Shown as the hint on the options and menu item, and as the inline Alert of the server's 409 `LAST_ADMIN`. */
  lastAdmin: 'At least one enabled user must keep user administration.',

  matrix: {
    title: 'Roles and permissions',
    subtitle: 'What each role may do, as the Core server enforces it',
    readOnly: 'Read-only',
    tableLabel: 'Role and permission matrix',
    permission: 'Permission',
    granted: 'Granted',
    notGranted: 'Not granted',
  },

  toasts: {
    roleChanged: 'Role of {{name}} is now {{role}}',
    disabled: '{{name}} is disabled',
    disabledBody: 'Their sessions have ended.',
    enabled: '{{name}} is enabled',
    enabledBody: 'They can sign in again.',
    notFound: 'This operator no longer exists on the Core server.',
    notFoundBody: 'The list has been read again.',
    failed: 'The change was not carried out.',
  },

  states: {
    /** Under the heading `shell.liveOnly.title`. */
    liveOnly: 'Simulated mode has no user list and assigns no role. Users and roles are kept by the Core server.',
    empty: 'No operators',
    emptyBody: 'The Core server holds no operator.',
    error: 'The list could not be read.',
    matrixError: 'The role matrix could not be read.',
    forbidden: 'Your role does not include this page.',
    forbiddenLink: 'Go to the Dashboard',
  },
} as const satisfies ResourceTree;
