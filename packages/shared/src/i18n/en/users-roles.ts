/**
 * `usersRoles.*`: the Users & Roles page, `/admin/users` (backend task 04_client_integration_spec
 * §10.1 PG-10, §10.2). Live mode only. Plan row W54 wrote the words of the page stub; the page row
 * (W77) adds the key families of §10.2: `summary`, `users.*`, `actions.*`, `roleDialog.*`,
 * `disableDialog.*`, `enableDialog.*`, `lastAdmin`, `matrix.*`, `toasts.*` and the other `states.*`.
 * The vendor-only account actions (RB-9 as amended 02-11-2026) add `fields.*`, `createDialog.*`,
 * `editDialog.*` and `deleteDialog.*`, and the `toasts.*` of create, update and delete.
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
    system: 'System',
    systemHint: 'System account used by the capture auto-attach. It cannot sign in and cannot be edited, deleted or given a password.',
    systemNoActions: 'No actions',
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
    /** RB-9 as amended: these three are offered to the vendor `root` account only. */
    createUser: 'Add user',
    edit: 'Edit profile…',
    delete: 'Delete user…',
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

  /**
   * The field words of the create and edit dialogs (RB-9 as amended: the vendor `root` account
   * alone). The bounds repeat the contract's (`OPERATOR_NAME_MAX_LENGTH`,
   * `OPERATOR_INITIALS_MAX_LENGTH`, `OPERATOR_USERNAME_PATTERN`, the 24 of `rank`) and are passed as
   * `{{max}}` by the dialogs, so a page never carries a number of its own.
   */
  fields: {
    usernameLabel: 'Username',
    usernameHint: 'The sign-in name, unique. Lowercase letters, digits, dot, underscore or dash; at most {{max}} characters.',
    nameLabel: 'Full name',
    nameHint: 'As written on the card; 1 to {{max}} characters.',
    displayNameLabel: 'Display name',
    displayNameHint: 'Shown to clients. Left empty, the full name is used.',
    displayNameKeepHint: 'Shown to clients. Left empty, the current name is kept.',
    initialsLabel: 'Initials',
    initialsHint: 'Shown in the avatar; 1 to {{max}} characters.',
    rankLabel: 'Rank (optional)',
    rankHint: 'For example AKP; at most {{max}} characters. Cleared here, the operator has no rank.',
    roleLabel: 'Role',
    passwordLabel: 'Initial password (optional)',
    passwordHint: 'Left empty, the account exists but cannot sign in until a password is set.',
    reasonLabel: 'Reason (optional)',
    reasonHint: 'Kept in the audit log. At most {{max}} characters.',
    errors: {
      required: 'Enter {{label}}.',
      username: 'A username is 1 to {{max}} characters: lowercase letters, digits, dot, underscore or dash, starting with a letter or a digit.',
      name: '{{label}} is 1 to {{max}} characters.',
      initials: 'The initials are 1 to {{max}} characters.',
      rank: 'The rank is at most {{max}} characters.',
      usernameTaken: 'An operator already signs in with this username.',
      confirmMismatch: 'This is not the username of the account.',
    },
  },

  createDialog: {
    title: 'Add user',
    intro: 'The account is created on the Core server and appears in the list at once.',
    confirm: 'Create user',
    invalid: 'The Core server did not accept this account. Check the values and try again.',
  },

  editDialog: {
    title: 'Edit profile',
    target: '{{name}} ({{username}})',
    /** The role is `assignUserRole`, the enabled state is enable and disable: neither is offered here. */
    note: 'The role and the enabled state are changed from their own actions. A password is never carried here.',
    confirm: 'Save changes',
    untouched: 'Change at least one field to save.',
    invalid: 'The Core server did not accept this change. Check the values and try again.',
  },

  deleteDialog: {
    title: 'Delete user',
    body: 'Delete {{name}} ({{username}})? The account and its password are removed and their open sessions end. The audit rows this operator wrote stay.',
    ownRow: 'You are deleting your own account. You will be signed out.',
    confirmLabel: 'Type the username to confirm',
    confirmHint: 'Must be exactly {{username}}.',
    confirm: 'Delete user',
    invalid: 'The Core server did not accept this delete. Nothing was removed.',
    /** 409 `INVALID_STATE`: the account is still named by a row the database points at. */
    invalidState: 'This account is still named by an open session or a live custody row, so it cannot be removed. Nothing was deleted.',
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
    created: '{{name}} is created',
    createdWithPassword: 'They can sign in with the initial password.',
    createdNoPassword: 'The account cannot sign in until a password is set.',
    updated: 'The profile of {{name}} is saved',
    deleted: '{{username}} is deleted',
    deletedBody: 'Their open sessions ended and the password was removed.',
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
