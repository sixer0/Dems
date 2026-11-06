/**
 * The stored role and permission matrix (plan row W28; spec §4.3, §4.4, §4.6 RB-3, RB-9;
 * database contract §4.1 to §4.3: `roles`, `permissions`, `role_permissions`, which the runtime
 * role may only read).
 *
 * Two uses, and neither is the per-request decision:
 *   - the boot step `rbac.matrix` (and `reloadMatrix()` after a database swap): every
 *     permission that the access rule of a registered route names must be stored, the stored
 *     vocabulary must be exactly the shared one, and the stored grants must be exactly the
 *     shared role table (decision D88);
 *   - operation 10 `getRoleMatrix`, which answers what is stored at the moment of the call.
 *
 * The decision of stage 6 does NOT read this: it uses the permissions that stage 4 read from
 * the same three tables with the session lookup of the request (`decision.ts`). So nothing that
 * is loaded here can grow stale under a request.
 *
 * Pure functions over a pool; no Fastify instance.
 */
import type { RoleMatrix } from '@dems/shared/api';
import { OperatorRole, Permission, ROLE_PERMISSIONS } from '@dems/shared/sim';
import { AccessRuleErrorCode, type AccessRule, type AccessRuleProblem } from './access-rules';

/** What reads the matrix: the runtime pool, or a unit's connection. */
export interface MatrixReader {
  query<Row>(text: string): Promise<{ rows: Row[] }>;
}

export interface StoredGrant {
  readonly role: string;
  readonly permission: string;
}

/** The three tables as stored: names as text, in the stored order. */
export interface StoredMatrix {
  /** In `sort_order`. */
  readonly roles: readonly string[];
  /** In `sort_order`. */
  readonly permissions: readonly string[];
  /** By role, then by permission, each in its `sort_order`. */
  readonly grants: readonly StoredGrant[];
}

interface MatrixRow {
  roles: unknown;
  permissions: unknown;
  grants: unknown;
}

/**
 * One statement, so the three lists are one snapshot: a role that a concurrent seed or reset
 * writes is never seen without its grants.
 */
export const READ_STORED_MATRIX =
  'SELECT ' +
  "(SELECT COALESCE(json_agg(r.id ORDER BY r.sort_order), '[]'::json) FROM public.roles r) AS roles, " +
  "(SELECT COALESCE(json_agg(p.id ORDER BY p.sort_order), '[]'::json) FROM public.permissions p) AS permissions, " +
  "(SELECT COALESCE(json_agg(json_build_object('role', rp.role_id, 'permission', rp.permission_id) ORDER BY r.sort_order, p.sort_order), '[]'::json) " +
  'FROM public.role_permissions rp JOIN public.roles r ON r.id = rp.role_id JOIN public.permissions p ON p.id = rp.permission_id) AS grants';

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function grantList(value: unknown): StoredGrant[] {
  if (!Array.isArray(value)) return [];
  const grants: StoredGrant[] = [];
  for (const item of value as unknown[]) {
    if (typeof item !== 'object' || item === null) continue;
    const { role, permission } = item as { role?: unknown; permission?: unknown };
    if (typeof role === 'string' && typeof permission === 'string') grants.push({ role, permission });
  }
  return grants;
}

/** Reads the three tables. An unseeded database, or a stand-in that answers no row, gives three empty lists. */
export async function readStoredMatrix(reader: MatrixReader): Promise<StoredMatrix> {
  const { rows } = await reader.query<MatrixRow>(READ_STORED_MATRIX);
  const row = rows[0];
  return { roles: textList(row?.roles), permissions: textList(row?.permissions), grants: grantList(row?.grants) };
}

const SHARED_ROLES: readonly string[] = Object.values(OperatorRole);
const SHARED_PERMISSIONS: readonly string[] = Object.values(Permission);

function difference(stored: readonly string[], shared: readonly string[]): string | null {
  const missing = shared.filter((name) => !stored.includes(name));
  const extra = stored.filter((name) => !shared.includes(name));
  if (missing.length === 0 && extra.length === 0) return null;
  return [missing.length > 0 ? `not stored: ${missing.join(', ')}` : '', extra.length > 0 ? `stored and unknown to the server: ${extra.join(', ')}` : '']
    .filter((part) => part !== '')
    .join('; ');
}

/** How a stored grant differs from the shared role table. */
export interface GrantDifference {
  /** `missing`: the shared table has the grant and it is not stored. `extra`: it is stored and the shared table lacks it. */
  readonly direction: 'missing' | 'extra';
  readonly role: string;
  readonly permission: string;
}

/**
 * The FIRST difference between the stored grants and the shared role table, or null when they
 * are the same set. The shared table is `ROLE_PERMISSIONS` of `@dems/shared/sim`: the one the
 * hosted simulator's own checks read (`roleHas`). Order: every grant of the shared table that
 * is not stored, by role and then by permission in the order of the vocabulary; then every
 * stored grant the shared table lacks, in the stored order.
 */
export function firstGrantDifference(grants: readonly StoredGrant[]): GrantDifference | null {
  const stored = new Set(grants.map((grant) => `${grant.role} ${grant.permission}`));
  for (const role of Object.values(OperatorRole)) {
    const shared: readonly string[] = ROLE_PERMISSIONS[role];
    for (const permission of SHARED_PERMISSIONS) {
      if (shared.includes(permission) && !stored.has(`${role} ${permission}`)) return { direction: 'missing', role, permission };
    }
  }
  for (const grant of grants) {
    const shared: readonly string[] | undefined = Object.hasOwn(ROLE_PERMISSIONS, grant.role) ? ROLE_PERMISSIONS[grant.role as OperatorRole] : undefined;
    if (shared === undefined || !shared.includes(grant.permission)) return { direction: 'extra', role: grant.role, permission: grant.permission };
  }
  return null;
}

/**
 * What is wrong with a stored matrix, for the rules of the registered routes; an empty list
 * when nothing is.
 *
 *   - a permission that the access rule of a registered route names is not stored: no role can
 *     hold it, the operation could never be called, and the problem names the operation;
 *   - the stored roles, or the stored permissions, are not exactly the shared vocabulary;
 *   - the stored grants are not exactly the shared role table (decision D88). Stage 6 decides
 *     from PostgreSQL, the hosted simulator's own checks from the shared table: with a stored
 *     grant the shared table lacks, a call would pass the guard and be refused by the hosted
 *     action without an audit row. No operation of the server changes a grant, so a difference
 *     means a database that was edited by hand. Only the FIRST difference is named, by its
 *     direction, its role and its permission, and only once the vocabulary is the shared one
 *     (a missing role or permission is the cause then, and is what is reported).
 *
 * This is a check at boot and at a reload. It is not asked per request: the decision of a
 * request uses the grants stage 4 read with that request, whatever they are.
 */
export function checkStoredMatrix(matrix: StoredMatrix, rules: readonly AccessRule[]): AccessRuleProblem[] {
  const problems: AccessRuleProblem[] = [];
  for (const rule of rules) {
    for (const permission of rule.permissions) {
      if (matrix.permissions.includes(permission)) continue;
      problems.push({
        code: AccessRuleErrorCode.PERMISSION_NOT_STORED,
        operationId: rule.operationId,
        route: `${rule.method} ${rule.url}`,
        detail: `the access rule names ${permission}, which the stored matrix does not hold`,
      });
    }
  }
  const roles = difference(matrix.roles, SHARED_ROLES);
  if (roles !== null) {
    problems.push({ code: AccessRuleErrorCode.STORED_MATRIX_MISMATCH, operationId: null, route: null, detail: `roles ${roles}` });
  }
  const permissions = difference(matrix.permissions, SHARED_PERMISSIONS);
  if (permissions !== null) {
    problems.push({ code: AccessRuleErrorCode.STORED_MATRIX_MISMATCH, operationId: null, route: null, detail: `permissions ${permissions}` });
  }
  if (roles === null && permissions === null) {
    const grant = firstGrantDifference(matrix.grants);
    if (grant !== null) {
      problems.push({
        code: AccessRuleErrorCode.STORED_GRANTS_MISMATCH,
        operationId: null,
        route: null,
        detail: `${grant.direction} grant: ${grant.role} ${grant.permission}`,
      });
    }
  }
  return problems;
}

/**
 * The answer of operation 10 (`RoleMatrix` of the contract). The names are handed on as they
 * are stored; the response schema of the route refuses a name outside the shared vocabulary,
 * which the boot step has ruled out. `editable` is always false (RB-9).
 */
export function roleMatrixOf(matrix: StoredMatrix): RoleMatrix {
  return {
    roles: matrix.roles as RoleMatrix['roles'],
    permissions: matrix.permissions as RoleMatrix['permissions'],
    grants: matrix.grants as RoleMatrix['grants'],
    editable: false,
  };
}
