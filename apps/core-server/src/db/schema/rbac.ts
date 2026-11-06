/**
 * Typed schema, group `rbac`: T-01 `roles`, T-02 `permissions`, T-03 `role_permissions`,
 * T-04 `operators`, T-05 `operator_credentials` (database contract §4.1 to §4.5).
 *
 * Every constraint and index carries the explicit name of the contract (N-4), every foreign key
 * is `ON UPDATE NO ACTION ON DELETE RESTRICT` (K-2), and every time column is `bigint` epoch
 * milliseconds read as a JavaScript number (TY-1).
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  unique,
} from 'drizzle-orm/pg-core';
import { bytea } from './bytea';
import { code, matches, oneOf, operatorId } from './checks';
import { ROLE, type RoleId } from './value-sets';

/** T-01. Written by the seed only; read-only for the runtime role. */
export const roles = pgTable(
  'roles',
  {
    id: text('id').$type<RoleId>().primaryKey(),
    sortOrder: smallint('sort_order').notNull(),
  },
  (t) => [
    check('roles_id_check', oneOf(t.id, ROLE)),
    unique('roles_sort_order_key').on(t.sortOrder),
  ],
);

/** T-02. Written by the seed only; the identifier is an open set checked by format. */
export const permissions = pgTable(
  'permissions',
  {
    id: text('id').primaryKey(),
    sortOrder: smallint('sort_order').notNull(),
  },
  (t) => [
    check('permissions_id_check', code(t.id)),
    unique('permissions_sort_order_key').on(t.sortOrder),
  ],
);

/** T-03. Written by the seed only: "the matrix cannot be changed through the API" is a database rule. */
export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: text('role_id').$type<RoleId>().notNull(),
    permissionId: text('permission_id').notNull(),
  },
  (t) => [
    primaryKey({ name: 'role_permissions_pkey', columns: [t.roleId, t.permissionId] }),
    foreignKey({ name: 'role_permissions_role_id_fkey', columns: [t.roleId], foreignColumns: [roles.id] })
      .onDelete('restrict')
      .onUpdate('no action'),
    foreignKey({
      name: 'role_permissions_permission_id_fkey',
      columns: [t.permissionId],
      foreignColumns: [permissions.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    index('role_permissions_permission_id_idx').on(t.permissionId),
  ],
);

/** T-04. The runtime role has no INSERT and no DELETE here: no operation creates or deletes a user. */
export const operators = pgTable(
  'operators',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull(),
    rank: text('rank'),
    name: text('name').notNull(),
    displayName: text('display_name').notNull(),
    initials: text('initials').notNull(),
    roleId: text('role_id').$type<RoleId>().notNull(),
    enabled: boolean('enabled').notNull().default(true),
    lastSignInAt: bigint('last_sign_in_at', { mode: 'number' }),
    roleChangedAt: bigint('role_changed_at', { mode: 'number' }),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    unique('operators_username_key').on(t.username),
    foreignKey({ name: 'operators_role_id_fkey', columns: [t.roleId], foreignColumns: [roles.id] })
      .onDelete('restrict')
      .onUpdate('no action'),
    index('operators_role_id_idx').on(t.roleId),
    check('operators_id_check', operatorId(t.id)),
    check('operators_username_check', matches(t.username, '^[a-z0-9][a-z0-9._-]{0,63}$')),
    check(
      'operators_name_check',
      sql`char_length(${t.name}) BETWEEN 1 AND 120 AND char_length(${t.initials}) BETWEEN 1 AND 4`,
    ),
  ],
);

/**
 * T-05. One row per operator: the Argon2id hash set of SR-06, each part in its own column.
 * NO COLUMN OF THIS TABLE MAY BE LOGGED OR RETURNED (NL-1).
 */
export const operatorCredentials = pgTable(
  'operator_credentials',
  {
    operatorId: text('operator_id').primaryKey(),
    algorithm: text('algorithm').$type<'argon2id'>().notNull(),
    memoryKib: integer('memory_kib').notNull(),
    passes: integer('passes').notNull(),
    parallelism: integer('parallelism').notNull(),
    salt: bytea('salt').notNull(),
    hash: bytea('hash').notNull(),
    hashedAt: bigint('hashed_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    foreignKey({
      name: 'operator_credentials_operator_id_fkey',
      columns: [t.operatorId],
      foreignColumns: [operators.id],
    })
      .onDelete('restrict')
      .onUpdate('no action'),
    check('operator_credentials_algorithm_check', sql`${t.algorithm} = 'argon2id'`),
    check(
      'operator_credentials_params_check',
      sql`${t.memoryKib} >= 19456 AND ${t.passes} >= 2 AND ${t.parallelism} >= 1`,
    ),
    check(
      'operator_credentials_lengths_check',
      sql`octet_length(${t.salt}) >= 16 AND octet_length(${t.hash}) = 32`,
    ),
  ],
);

export type RoleRow = typeof roles.$inferSelect;
export type NewRoleRow = typeof roles.$inferInsert;
export type PermissionRow = typeof permissions.$inferSelect;
export type NewPermissionRow = typeof permissions.$inferInsert;
export type RolePermissionRow = typeof rolePermissions.$inferSelect;
export type NewRolePermissionRow = typeof rolePermissions.$inferInsert;
export type OperatorRow = typeof operators.$inferSelect;
export type NewOperatorRow = typeof operators.$inferInsert;
export type OperatorCredentialRow = typeof operatorCredentials.$inferSelect;
export type NewOperatorCredentialRow = typeof operatorCredentials.$inferInsert;
