/**
 * Area 2 of the Core API: RBAC and user administration (backend task: 2026-10-04 01_specs §4,
 * §7.6, §7.18).
 *
 * Five operations, answered by the Core server only. None has a simulator action: no action edits
 * an operator or a role. No operation creates or deletes a user, and the role matrix cannot be
 * changed through the API (RB-9).
 *
 * | # | operationId | Access | Audit on success |
 * |--:|-------------|--------|------------------|
 * | 10 | `getRoleMatrix` | AUTHENTICATED | NONE-R |
 * | 11 | `listUsers` | USER_ADMIN | NONE-R |
 * | 12 | `assignUserRole` | USER_ADMIN | ROLE_CHANGED (none when the role is unchanged) |
 * | 13 | `enableUser` | USER_ADMIN | USER_ENABLED (none when already enabled) |
 * | 14 | `disableUser` | USER_ADMIN | USER_DISABLED (none when already disabled) |
 *
 * `{id}` is an operator ID (`OPR-NNN`).
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

/** The named schemas of this area, by their `components.schemas` name. */
export const ADMINISTRATION_SCHEMAS = {
  RoleMatrix: RoleMatrixSchema,
  AdminUser: AdminUserSchema,
  AdminUserList: AdminUserListSchema,
  UserRoleRequest: UserRoleRequestSchema,
  UserStatusRequest: UserStatusRequestSchema,
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
};
