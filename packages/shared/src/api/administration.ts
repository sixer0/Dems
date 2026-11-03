/**
 * Area 2 of the Core API: RBAC and user administration (backend task: 2026-10-04 01_specs §4,
 * §7.6, §7.18).
 *
 * Eight operations, answered by the Core server only. None has a simulator action: no action edits
 * an operator or a role. The role matrix still cannot be changed through the API (RB-9).
 *
 * | # | operationId | Access | Audit on success |
 * |--:|-------------|--------|------------------|
 * | 10 | `getRoleMatrix` | AUTHENTICATED | NONE-R |
 * | 11 | `listUsers` | USER_ADMIN | NONE-R |
 * | 12 | `assignUserRole` | USER_ADMIN | ROLE_CHANGED (none when the role is unchanged) |
 * | 13 | `enableUser` | USER_ADMIN | USER_ENABLED (none when already enabled) |
 * | 14 | `disableUser` | USER_ADMIN | USER_DISABLED (none when already disabled) |
 * | 15 | `createUser` | USER_ADMIN + the vendor `root` account | USER_CREATED, then OPERATOR_PASSWORD_SET when a password came with it |
 * | 16 | `updateUser` | USER_ADMIN + the vendor `root` account | USER_UPDATED (none when nothing changed) |
 * | 17 | `deleteUser` | USER_ADMIN + the vendor `root` account | USER_DELETED |
 *
 * `{id}` is an operator ID (`OPR-NNN`).
 *
 * RB-9 AMENDED (principal PT GSP, 02-11-2026): the rule read "no operation creates or deletes a
 * user". It is lifted for the vendor `root` account alone, which is why operations 15 to 17 carry
 * a second gate beyond the `USER_ADMIN` permission: the caller's own username must be `root`
 * (`src/modules/admin/rule.ts`, `isVendorRoot`). A client supervisor therefore still cannot
 * create, edit or delete an account, and the matrix stays read-only.
 */
import { z } from 'zod';
import { AuditType, OperatorRole, Permission } from '../sim/vocabulary';
import { API_BASE_PATH } from './constants';
import {
  AUTHENTICATED_ACCESS,
  CORE_SERVER_ONLY,
  CoreApiAuditNone,
  CoreApiMode,
  CoreApiTag,
  permissionAccess,
  type CoreApiRegistryOperation,
} from './contract-model';
import { ERROR_EXAMPLES, apiErrorExample, exampleTime, notPermittedExample } from './example-parts';
import type { OperationExamples } from './examples';
import { EXAMPLE_INVESTIGATOR, EXAMPLE_SUPERVISOR, OperatorSchema, type OperatorBody } from './identity';
import {
  CORE_SERVER_NOTE,
  INVALID_INPUT,
  INVALID_JSON,
  NOT_SIGNED_IN,
  backendSource,
  forbidden,
  notPermitted,
} from './operation-parts';
import { OPERATOR_ID_PATTERN } from './patterns';
import { count, nullableEpochMs } from './schema-parts';
import { apiText } from './text';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Longest reason an administrator may give for a role change, an enable or a disable. */
export const ADMIN_REASON_MAX_LENGTH = 500;

const optionalReason = () =>
  apiText()
    .overwrite((value) => value.trim())
    .max(ADMIN_REASON_MAX_LENGTH)
    .optional()
    .describe(`Optional free text for the audit row, at most ${ADMIN_REASON_MAX_LENGTH} characters after trimming. Empty means none.`);

export const RoleMatrixSchema = z
  .strictObject({
    roles: z.array(z.enum(OperatorRole)),
    permissions: z.array(z.enum(Permission)),
    grants: z
      .array(z.object({ role: z.enum(OperatorRole), permission: z.enum(Permission) }))
      .describe('One entry per role that holds a permission: 18 in the seeded matrix. A set: the order of the entries is not significant.'),
    editable: z.literal(false).describe('The matrix cannot be changed through the API in this release (RB-9).'),
  })
  .describe('The role and permission matrix the server enforces, read from PostgreSQL.');
export type RoleMatrix = z.output<typeof RoleMatrixSchema>;

// Strict at the top level, like every answer of the Core server (W83, finding W52-F2; decision D184 DQ-3).
// Only the top level: nested Core-only objects (`OperatorSchema`, the `grants` items) still accept
// unknown members, as `test/api-closeout.test.ts` names it (FXR-W W92-23).
export const AdminUserSchema = z.strictObject({
  ...OperatorSchema.shape,
  enabled: z.boolean().describe('A disabled operator cannot sign in; disabling ends the open sessions.'),
  lastSignInAt: nullableEpochMs(),
  activeSessions: count().describe('Open sessions of the operator, on the web console and on devices.'),
  roleChangedAt: nullableEpochMs(),
}).describe('An operator as user administration sees it.');
export type AdminUser = z.output<typeof AdminUserSchema>;

export const AdminUserListSchema = z
  .strictObject({ users: z.array(AdminUserSchema) })
  .describe('Response of `GET /api/v1/admin/users`: every operator, in operator ID order.');
export type AdminUserList = z.output<typeof AdminUserListSchema>;

export const UserRoleRequestSchema = z
  .object({
    role: z.enum(OperatorRole).describe('The role to assign. One role per operator.'),
    reason: optionalReason(),
  })
  .describe('Request body of `POST /api/v1/admin/users/{id}/role`.');
export type UserRoleRequest = z.output<typeof UserRoleRequestSchema>;

export const UserStatusRequestSchema = z
  .object({ reason: optionalReason() })
  .describe('Optional request body of `POST /api/v1/admin/users/{id}/enable` and `.../disable`.');
export type UserStatusRequest = z.output<typeof UserStatusRequestSchema>;

/**
 * The username rule of `operators` (the CHECK of migration 0001, re-declared here so the answer to
 * a bad username is a validation refusal and not a database error): lowercase, starting with an
 * alphanumeric, then alphanumerics, dot, underscore or dash, at most 64 characters.
 */
export const OPERATOR_USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** The bounds PostgreSQL puts on the name and the initials of an operator (the CHECKs of `operators`). */
export const OPERATOR_NAME_MAX_LENGTH = 120;
export const OPERATOR_INITIALS_MAX_LENGTH = 4;

const usernameField = () =>
  apiText()
    .overwrite((value) => value.trim().toLowerCase())
    .regex(OPERATOR_USERNAME_PATTERN, 'A username is 1 to 64 characters: lowercase letters, digits, dot, underscore or dash, starting with a letter or a digit.')
    .describe('The sign-in name, unique. Lower-cased and trimmed by the server.');

const nameField = (label: string) =>
  apiText()
    .overwrite((value) => value.trim())
    .min(1)
    .max(OPERATOR_NAME_MAX_LENGTH)
    .describe(`${label}, 1 to ${OPERATOR_NAME_MAX_LENGTH} characters.`);

const initialsField = () =>
  apiText()
    .overwrite((value) => value.trim().toUpperCase())
    .min(1)
    .max(OPERATOR_INITIALS_MAX_LENGTH)
    .describe(`At most ${OPERATOR_INITIALS_MAX_LENGTH} characters, upper-cased by the server.`);

export const CreateUserRequestSchema = z
  .object({
    username: usernameField(),
    name: nameField('The name of the operator'),
    displayName: nameField('The name shown to clients').optional(),
    initials: initialsField(),
    rank: apiText().overwrite((value) => value.trim()).max(24).nullable().optional().describe('e.g. `AKP`; null or absent when the operator has no rank.'),
    role: z.enum(OperatorRole).describe('The one role of the operator.'),
    reason: optionalReason(),
  })
  .describe('Request body of `POST /api/v1/admin/users`. Needs the vendor `root` account.');
export type CreateUserRequest = z.output<typeof CreateUserRequestSchema>;

export const UpdateUserRequestSchema = z
  .object({
    name: nameField('The new name').optional(),
    displayName: nameField('The new display name').optional(),
    initials: initialsField().optional(),
    rank: apiText().overwrite((value) => value.trim()).max(24).nullable().optional(),
    reason: optionalReason(),
  })
  .refine(
    (body) => body.name !== undefined || body.displayName !== undefined || body.initials !== undefined || body.rank !== undefined,
    { error: 'Name at least one field to change.' },
  )
  .describe('Request body of `POST /api/v1/admin/users/{id}/profile`: the profile only. The role is `assignUserRole`, the state is enable and disable, the password is never changed here.');
export type UpdateUserRequest = z.output<typeof UpdateUserRequestSchema>;

export const DeleteUserRequestSchema = z
  .object({
    confirm: apiText().overwrite((value) => value.trim()).describe('The username of the operator, repeated. A delete that does not repeat it is refused: the account and its credential go, and the row leaves the operator list.'),
    reason: optionalReason(),
  })
  .describe('Request body of `POST /api/v1/admin/users/{id}/delete`. Needs the vendor `root` account.');
export type DeleteUserRequest = z.output<typeof DeleteUserRequestSchema>;

export const DeletedUserSchema = z
  .strictObject({
    operatorId: z.string().regex(OPERATOR_ID_PATTERN).describe('The operator that no longer exists.'),
    username: apiText().describe('The username that was deleted, for the caller\'s list.'),
    sessionsEnded: count().describe('Open sessions of that operator ended by this call.'),
    credentialsRemoved: count().describe('0 or 1: whether a password row went with the account.'),
  })
  .describe('Response of `POST /api/v1/admin/users/{id}/delete`.');
export type DeletedUser = z.output<typeof DeletedUserSchema>;

/** The named schemas of this area, by their `components.schemas` name. */
export const ADMINISTRATION_SCHEMAS = {
  RoleMatrix: RoleMatrixSchema,
  AdminUser: AdminUserSchema,
  AdminUserList: AdminUserListSchema,
  UserRoleRequest: UserRoleRequestSchema,
  UserStatusRequest: UserStatusRequestSchema,
  CreateUserRequest: CreateUserRequestSchema,
  UpdateUserRequest: UpdateUserRequestSchema,
  DeleteUserRequest: DeleteUserRequestSchema,
  DeletedUser: DeletedUserSchema,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

const SECTION = '§7.6';
const USERS_PATH = `${API_BASE_PATH}/admin/users`;
const USER_ADMIN = permissionAccess(Permission.USER_ADMIN);
const OPERATOR_PARAM = { name: 'id', description: 'Operator ID `OPR-NNN`.', pattern: OPERATOR_ID_PATTERN } as const;

const UNKNOWN_OPERATOR = { description: 'No operator has this ID (NOT_FOUND).', schema: 'ApiError' } as const;
const LAST_ADMIN = {
  description: 'The change would leave no enabled operator holding USER_ADMIN (LAST_ADMIN, RB-8). Nothing is changed.',
  schema: 'ApiError',
} as const;

export const ADMINISTRATION_OPERATIONS = [
  {
    operationId: 'getRoleMatrix',
    method: 'get',
    path: `${API_BASE_PATH}/rbac/matrix`,
    tag: CoreApiTag.ADMINISTRATION,
    mode: CoreApiMode.LIVE,
    summary: 'Role and permission matrix',
    description: [
      'The three roles, the twelve permissions and which role holds which, as the server enforces them. Every role may read it, as every role sees the role panel today.',
      'The matrix is read-only: `editable` is always `false` (RB-9).',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 10),
    responses: {
      200: { description: 'The matrix.', schema: 'RoleMatrix' },
      401: NOT_SIGNED_IN,
      403: forbidden(),
    },
    access: AUTHENTICATED_ACCESS,
    audit: { success: CoreApiAuditNone.READ, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'listUsers',
    method: 'get',
    path: USERS_PATH,
    tag: CoreApiTag.ADMINISTRATION,
    mode: CoreApiMode.LIVE,
    summary: 'List users',
    description: [
      'Every operator with the role, whether the account is enabled, the last sign-in and the number of open sessions. Needs USER_ADMIN.',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 11),
    responses: {
      200: { description: 'The users.', schema: 'AdminUserList' },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.USER_ADMIN),
    },
    access: USER_ADMIN,
    audit: { success: CoreApiAuditNone.READ, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'assignUserRole',
    method: 'post',
    path: `${USERS_PATH}/{id}/role`,
    tag: CoreApiTag.ADMINISTRATION,
    mode: CoreApiMode.LIVE,
    summary: 'Assign a role',
    description: [
      'Changes the role of an operator. The new permissions apply to that operator\'s next request (RB-3); the open sessions stay, and their sockets receive `session.updated` within 1 s.',
      'Writes ROLE_CHANGED with the old and the new role; assigning the role the operator already has writes nothing.',
      'Refused with `409 LAST_ADMIN` when it would leave no enabled operator holding USER_ADMIN (RB-8).',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 12),
    pathParam: OPERATOR_PARAM,
    requestBody: { schema: 'UserRoleRequest', required: true },
    responses: {
      200: { description: 'The operator after the change.', schema: 'AdminUser' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.USER_ADMIN),
      404: UNKNOWN_OPERATOR,
      409: LAST_ADMIN,
      422: INVALID_INPUT,
    },
    access: USER_ADMIN,
    audit: { success: AuditType.ROLE_CHANGED, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'enableUser',
    method: 'post',
    path: `${USERS_PATH}/{id}/enable`,
    tag: CoreApiTag.ADMINISTRATION,
    mode: CoreApiMode.LIVE,
    summary: 'Enable a user',
    description: [
      'Lets a disabled operator sign in again. Writes USER_ENABLED; enabling an operator who is already enabled writes nothing.',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 13),
    pathParam: OPERATOR_PARAM,
    requestBody: { schema: 'UserStatusRequest', required: false },
    responses: {
      200: { description: 'The operator after the change.', schema: 'AdminUser' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.USER_ADMIN),
      404: UNKNOWN_OPERATOR,
      422: INVALID_INPUT,
    },
    access: USER_ADMIN,
    audit: { success: AuditType.USER_ENABLED, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'disableUser',
    method: 'post',
    path: `${USERS_PATH}/{id}/disable`,
    tag: CoreApiTag.ADMINISTRATION,
    mode: CoreApiMode.LIVE,
    summary: 'Disable a user',
    description: [
      'Stops an operator from signing in. In the same transaction every open session of that operator is ended and the biometric tokens are revoked; the sockets receive `session.ended` and are closed within 1 s.',
      'Writes USER_DISABLED with the number of sessions ended; disabling an operator who is already disabled writes nothing.',
      'Refused with `409 LAST_ADMIN` when it would leave no enabled operator holding USER_ADMIN (RB-8).',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 14),
    pathParam: OPERATOR_PARAM,
    requestBody: { schema: 'UserStatusRequest', required: false },
    responses: {
      200: { description: 'The operator after the change.', schema: 'AdminUser' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.USER_ADMIN),
      404: UNKNOWN_OPERATOR,
      409: LAST_ADMIN,
      422: INVALID_INPUT,
    },
    access: USER_ADMIN,
    audit: { success: AuditType.USER_DISABLED, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },

  // ── The vendor-only trio (RB-9 as amended 02-11-2026) ─────────────────────────────────────
  //
  // `access` stays USER_ADMIN because that is what stage 6 of the guard checks and what a refusal
  // writes as ACCESS_DENIED. On top of it the module applies a second, narrower rule that the
  // registry cannot express: the caller's own username must be `root`. A caller who passes the
  // permission and fails the identity never reaches a unit of work and gets 403 NOT_PERMITTED.

  {
    operationId: 'createUser',
    method: 'post',
    path: USERS_PATH,
    tag: CoreApiTag.ADMINISTRATION,
    mode: CoreApiMode.LIVE,
    summary: 'Create a user',
    description: [
      'Creates an operator: the next free operator ID, the profile and one role. The account is ENABLED but holds no credential, so it cannot sign in until a password is set with the host command `operator:set-password`, which is the only writer of a password (decision U19): an API that carried one would put a secret in this module, and the module is built to hold none.',
      'Writes USER_CREATED.',
      'Needs USER_ADMIN and the vendor `root` account: an operator whose username is not `root` is refused with 403 NOT_PERMITTED and no row (RB-9 as amended).',
      'A username that is taken or malformed answers 422 INVALID_INPUT; nothing is created.',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 15),
    requestBody: { schema: 'CreateUserRequest', required: true },
    responses: {
      200: { description: 'The operator as created.', schema: 'AdminUser' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      // The vendor-only identity rule is spelled out in the description above; the 403 itself is
      // the one every USER_ADMIN operation shares, so the text stays with `notPermitted`.
      403: notPermitted(Permission.USER_ADMIN),
      422: INVALID_INPUT,
    },
    access: USER_ADMIN,
    audit: { success: AuditType.USER_CREATED, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'updateUser',
    method: 'post',
    path: `${USERS_PATH}/{id}/profile`,
    tag: CoreApiTag.ADMINISTRATION,
    mode: CoreApiMode.LIVE,
    summary: 'Edit a user profile',
    description: [
      'Changes the profile of an operator: name, display name, initials, rank. The role is `assignUserRole`, the enabled state is `enableUser` and `disableUser`, and a password is never carried by this operation.',
      'Writes USER_UPDATED with the fields that changed; a request that changes nothing writes no row.',
      'Needs USER_ADMIN and the vendor `root` account (RB-9 as amended).',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 16),
    pathParam: OPERATOR_PARAM,
    requestBody: { schema: 'UpdateUserRequest', required: true },
    responses: {
      200: { description: 'The operator after the change.', schema: 'AdminUser' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      // The vendor-only identity rule is spelled out in the description above; the 403 itself is
      // the one every USER_ADMIN operation shares, so the text stays with `notPermitted`.
      403: notPermitted(Permission.USER_ADMIN),
      404: UNKNOWN_OPERATOR,
      422: INVALID_INPUT,
    },
    access: USER_ADMIN,
    audit: { success: AuditType.USER_UPDATED, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'deleteUser',
    method: 'post',
    path: `${USERS_PATH}/{id}/delete`,
    tag: CoreApiTag.ADMINISTRATION,
    mode: CoreApiMode.LIVE,
    summary: 'Delete a user',
    description: [
      'Removes an operator and its credential from the unit, ending the open sessions of that operator in the same transaction. The account is purged: the audit rows it wrote, its sign-in rows, its credential and its biometric tokens are removed with it, and the hash chain is re-sealed over what survives (RB-9 as amended by the principal on 2026-11-02). Records of the UNIT are never removed by this — evidence, custody, session records, exports, transcript revisions, capture configuration and the installation acceptance keep their rows and lose their attribution instead. What the amendment costs is stated plainly: after a purge the chain no longer proves that the erased account never existed.',
      'Writes USER_DELETED with the number of sessions ended and whether a credential went with the account.',
      'Needs USER_ADMIN and the vendor `root` account, and the username repeated in `confirm`.',
      'Refused with `409 LAST_ADMIN` when it would leave no enabled operator holding USER_ADMIN (RB-8), and `409 INVALID_STATE` when the username repeated in `confirm` is not the operator of `{id}`.',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 17),
    pathParam: OPERATOR_PARAM,
    requestBody: { schema: 'DeleteUserRequest', required: true },
    responses: {
      200: { description: 'What was deleted.', schema: 'DeletedUser' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      // The vendor-only identity rule is spelled out in the description above; the 403 itself is
      // the one every USER_ADMIN operation shares, so the text stays with `notPermitted`.
      403: notPermitted(Permission.USER_ADMIN),
      404: UNKNOWN_OPERATOR,
      409: { description: 'RB-8: the delete would leave no enabled operator holding USER_ADMIN (LAST_ADMIN); or the username in `confirm` is not the operator of `{id}`; or records of the unit still point at that operator (INVALID_STATE), in which case the refusal text names how many and from which sources. Nothing is deleted in any of these cases.', schema: 'ApiError' },
      422: INVALID_INPUT,
    },
    access: USER_ADMIN,
    audit: { success: AuditType.USER_DELETED, denial: AuditType.ACCESS_DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * The seeded matrix (01_specs §4.4; task 3 M2-W6 SH-04; task 4 row 100): INVESTIGATOR 5,
 * SUPERVISOR 12, TECHNICIAN 6 = 23 grants over 15 permissions. Equal to `sim/auth.ts`
 * `ROLE_PERMISSIONS` by D88 (`specs C-N9`); the seed writes exactly these rows (`dbc-3 §E.3`).
 */
const SEEDED_GRANTS = {
  INVESTIGATOR: ['SESSION_START', 'SESSION_NOTE', 'EVIDENCE_VIEW', 'DIAGNOSTICS_RUN', 'TRANSCRIPT_REVISE'],
  SUPERVISOR: [
    'SESSION_START',
    'SESSION_NOTE',
    'EVIDENCE_VIEW',
    'DIAGNOSTICS_RUN',
    'TRANSCRIPT_REVISE',
    'EVIDENCE_REVIEW',
    'EVIDENCE_EXPORT',
    'AUDIT_EXPORT',
    'PAIRING_MANAGE',
    'USER_ADMIN',
    'DEMO_CONTROL',
    'CAPTURE_CONFIG',
  ],
  TECHNICIAN: ['EVIDENCE_VIEW', 'DEVICE_MANAGE', 'DIAGNOSTICS_RUN', 'MAINTENANCE', 'CAPTURE_CONFIG', 'CAPTURE_COMMISSION'],
} as const satisfies Record<OperatorRole, readonly Permission[]>;

const ROLE_MATRIX: RoleMatrix = {
  roles: ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'],
  permissions: [
    'SESSION_START',
    'SESSION_NOTE',
    'EVIDENCE_VIEW',
    'EVIDENCE_REVIEW',
    'EVIDENCE_EXPORT',
    'AUDIT_EXPORT',
    'DEVICE_MANAGE',
    'DIAGNOSTICS_RUN',
    'MAINTENANCE',
    'PAIRING_MANAGE',
    'USER_ADMIN',
    'DEMO_CONTROL',
    // Task 3 M2-W6 (SH-04; D4 OD-10/OD-15).
    'CAPTURE_CONFIG',
    'TRANSCRIPT_REVISE',
    // Task 4 row 100 (decision U10): the commissioning permission, held by TECHNICIAN only.
    'CAPTURE_COMMISSION',
  ],
  grants: (['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const).flatMap((role) =>
    SEEDED_GRANTS[role].map((permission) => ({ role, permission })),
  ),
  editable: false,
};

/** The TECHNICIAN of the canonical dataset. */
const EXAMPLE_TECHNICIAN: OperatorBody = {
  id: 'OPR-003',
  username: 'rina.wijaya',
  rank: null,
  name: 'Rina Wijaya',
  displayName: 'Rina Wijaya',
  initials: 'RW',
  role: 'TECHNICIAN',
};

const USER_INVESTIGATOR: AdminUser = {
  ...EXAMPLE_INVESTIGATOR,
  enabled: true,
  lastSignInAt: exampleTime(0),
  activeSessions: 1,
  roleChangedAt: null,
};
const USER_SUPERVISOR: AdminUser = {
  ...EXAMPLE_SUPERVISOR,
  enabled: true,
  lastSignInAt: exampleTime(-5),
  activeSessions: 1,
  roleChangedAt: null,
};
const USER_TECHNICIAN: AdminUser = {
  ...EXAMPLE_TECHNICIAN,
  enabled: true,
  lastSignInAt: null,
  activeSessions: 0,
  roleChangedAt: null,
};

const OPERATOR_PATH = { id: EXAMPLE_TECHNICIAN.id } as const;
const BASIC_403 = { deviceRevoked: ERROR_EXAMPLES.deviceRevoked, originNotAllowed: ERROR_EXAMPLES.originNotAllowed } as const;
const NOT_FOUND = { notFound: { summary: 'Unknown operator ID', value: apiErrorExample('NOT_FOUND', 'No operator has this ID.') } } as const;
const LAST_ADMIN_EXAMPLE = {
  lastAdmin: {
    summary: 'The only enabled operator holding USER_ADMIN',
    value: apiErrorExample('LAST_ADMIN', 'At least one enabled operator must keep user administration.'),
  },
} as const;
const denied = (operationId: string) => ({
  notPermitted: notPermittedExample(operationId, 'USER_ADMIN', 'INVESTIGATOR'),
  ...BASIC_403,
});

export const ADMINISTRATION_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  getRoleMatrix: {
    responses: {
      200: { seeded: { summary: 'The seeded matrix: 3 roles, 15 permissions, 23 grants', value: ROLE_MATRIX } },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: BASIC_403,
    },
  },
  listUsers: {
    responses: {
      200: {
        seeded: {
          summary: 'The three seeded operators',
          value: { users: [USER_INVESTIGATOR, USER_SUPERVISOR, USER_TECHNICIAN] } satisfies AdminUserList,
        },
      },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: denied('listUsers'),
    },
  },
  assignUserRole: {
    pathParams: OPERATOR_PATH,
    request: {
      promote: {
        summary: 'Make the technician an investigator',
        value: { role: 'INVESTIGATOR', reason: 'Covers the interview shift this week' } satisfies UserRoleRequest,
      },
    },
    responses: {
      200: {
        changed: {
          summary: 'The role is changed; the sessions stay',
          value: { ...USER_TECHNICIAN, role: 'INVESTIGATOR', roleChangedAt: exampleTime(0) } satisfies AdminUser,
        },
      },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: denied('assignUserRole'),
      404: NOT_FOUND,
      409: LAST_ADMIN_EXAMPLE,
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
  enableUser: {
    pathParams: OPERATOR_PATH,
    request: {
      back: { summary: 'Back from leave', value: { reason: 'Back from leave' } satisfies UserStatusRequest },
    },
    responses: {
      200: { enabled: { summary: 'Enabled', value: USER_TECHNICIAN } },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: denied('enableUser'),
      404: NOT_FOUND,
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
  disableUser: {
    pathParams: OPERATOR_PATH,
    request: {
      leave: { summary: 'On leave', value: { reason: 'On leave until further notice' } satisfies UserStatusRequest },
    },
    responses: {
      200: {
        disabled: {
          summary: 'Disabled; the open sessions are ended',
          value: { ...USER_TECHNICIAN, enabled: false } satisfies AdminUser,
        },
      },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: denied('disableUser'),
      404: NOT_FOUND,
      409: LAST_ADMIN_EXAMPLE,
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },

  // ── The vendor-only trio (RB-9 as amended 02-11-2026) ─────────────────────────────────────
  createUser: {
    request: {
      fieldOfficer: {
        summary: 'A new investigator with an initial password',
        value: {
          username: 'sari.officer',
          name: 'Sari Melati',
          displayName: 'Sari Melati',
          initials: 'SM',
          role: 'INVESTIGATOR',
          reason: 'Covers the night shift',
        } satisfies CreateUserRequest,
      },
      technician: {
        summary: 'A new technician account',
        value: { username: 'new.tech', name: 'New Technician', initials: 'NT', role: 'TECHNICIAN' } satisfies CreateUserRequest,
      },
    },
    responses: {
      200: {
        created: {
          summary: 'The operator as created, with the next free ID',
          value: {
            ...EXAMPLE_INVESTIGATOR,
            id: 'OPR-006',
            username: 'sari.officer',
            name: 'Sari Melati',
            displayName: 'Sari Melati',
            initials: 'SM',
            enabled: true,
            lastSignInAt: null,
            activeSessions: 0,
            roleChangedAt: null,
          } satisfies AdminUser,
        },
      },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: denied('createUser'),
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
  updateUser: {
    pathParams: OPERATOR_PATH,
    request: {
      rename: {
        summary: 'Correct the spelling of a name',
        value: { name: 'Sari M. Halim', initials: 'SH', reason: 'Name corrected on the card' } satisfies UpdateUserRequest,
      },
    },
    responses: {
      200: { updated: { summary: 'The operator after the change', value: USER_INVESTIGATOR } },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: denied('updateUser'),
      404: NOT_FOUND,
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
  deleteUser: {
    pathParams: OPERATOR_PATH,
    request: {
      gone: {
        summary: 'Delete the account of a left technician, username repeated',
        value: { confirm: 'rina.wijaya', reason: 'Left the unit; account removed' } satisfies DeleteUserRequest,
      },
    },
    responses: {
      200: {
        deleted: {
          summary: 'The account and its credential are gone; the audit rows stay',
          value: { operatorId: 'OPR-003', username: 'rina.wijaya', sessionsEnded: 0, credentialsRemoved: 1 } satisfies DeletedUser,
        },
      },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: { notSignedIn: ERROR_EXAMPLES.notSignedIn },
      403: denied('deleteUser'),
      404: NOT_FOUND,
      409: LAST_ADMIN_EXAMPLE,
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
};
