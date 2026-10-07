/**
 * The access rules of the Core server, compiled from the contract registry (plan row W28;
 * hand-built element HB-7; spec §4.2, §4.6 RB-1, RB-5, §7.1 API-8; SR-43; decision D11 TD-07).
 *
 * The registry (`CORE_API_OPERATIONS` of `@dems/shared/api`) is the only source of a rule. A
 * route gets the rule of the operation it IS: same method, same path, and `config.operationId`
 * naming it. Nothing a route says about itself can widen its access: a route cannot declare a
 * rule, and a route that names a registry operation on another path or method is refused.
 *
 * Deny by default (RB-1, SR-43). A route gets a rule in exactly two ways:
 *
 *   1. it is an operation of the registry, and that entry carries one access rule and one
 *      audit rule that this file can compile;
 *   2. it is the realtime channel, `GET /ws` (`WS_PATH`): the contract's one socket. It is no
 *      REST operation, so the registry has no entry for it. Its rule is fixed here: the
 *      handshake is open to every caller that passed stages 3 to 5, and the channel itself
 *      decides what a socket may see and closes an unknown or retired credential with 4401 or
 *      4403 (spec §9.2, §14.2 upgrade table). The guard writes no row for an upgrade.
 *
 * Every other route has no rule: `resolve` answers with a problem instead, the boot check stops
 * the start with it, and a request that reaches such a route all the same is refused.
 *
 * Pure: no Fastify instance, no database, no clock.
 */
import {
  ApiErrorCode,
  CORE_API_OPERATIONS,
  CoreApiAccessCondition,
  CoreApiAccessKind,
  CoreApiAuditNone,
  WS_PATH,
  describeCoreApiAccess,
  type CoreApiAccess,
  type CoreApiOperation,
} from '@dems/shared/api';
import { AuditType, Permission } from '@dems/shared/sim';
import type { RegistryOperationId } from '../../core';

// ── Problems ───────────────────────────────────────────────────────────────────────────────────

/** Why a route, or the stored matrix, stops the boot. The code goes into the log line. */
export const AccessRuleErrorCode = {
  /** The route is no operation of the registry: it has no access rule and no audit rule. */
  ROUTE_WITHOUT_RULES: 'ROUTE_WITHOUT_RULES',
  /** The route names a registry operation, and its method or its path is another. */
  ROUTE_NOT_THE_OPERATION: 'ROUTE_NOT_THE_OPERATION',
  /** The route is a registry operation by method and path, and `config.operationId` does not name it. */
  OPERATION_ID_MISMATCH: 'OPERATION_ID_MISMATCH',
  ACCESS_RULE_MISSING: 'ACCESS_RULE_MISSING',
  /** An unknown kind or condition, an any-of with fewer than two permissions. */
  ACCESS_RULE_INVALID: 'ACCESS_RULE_INVALID',
  AUDIT_RULE_MISSING: 'AUDIT_RULE_MISSING',
  /** A success rule that is no audit type and no marker, or a denial type the guard cannot write. */
  AUDIT_RULE_INVALID: 'AUDIT_RULE_INVALID',
  /** The access rule names a permission that the shared vocabulary does not hold. */
  PERMISSION_NOT_IN_VOCABULARY: 'PERMISSION_NOT_IN_VOCABULARY',
  /** The access rule names a permission that the stored matrix does not hold. */
  PERMISSION_NOT_STORED: 'PERMISSION_NOT_STORED',
  /** The stored roles or permissions are not exactly the shared vocabulary. */
  STORED_MATRIX_MISMATCH: 'STORED_MATRIX_MISMATCH',
  /** A stored grant that the shared role table lacks, or a grant of that table that is not stored. */
  STORED_GRANTS_MISMATCH: 'STORED_GRANTS_MISMATCH',
} as const;
export type AccessRuleErrorCode = (typeof AccessRuleErrorCode)[keyof typeof AccessRuleErrorCode];

export interface AccessRuleProblem {
  readonly code: AccessRuleErrorCode;
  /** The registry operation the problem is about; null when the route names none. */
  readonly operationId: string | null;
  /** `GET /api/v1/…`: the route as it was registered; null for a problem of the stored matrix. */
  readonly route: string | null;
  /** What is wrong, in words. Names operations, permissions and roles only; never request data. */
  readonly detail: string;
}

/**
 * Thrown by the boot check of the routes (`app.ready()`) and by the boot step of the stored
 * matrix. `code` is the first problem's; `problems` holds every one that was found.
 */
export class AccessRuleError extends Error {
  readonly code: AccessRuleErrorCode;
  readonly problems: readonly AccessRuleProblem[];

  constructor(problems: readonly [AccessRuleProblem, ...AccessRuleProblem[]]) {
    super(
      `the access rules are incomplete: ${problems
        .map((problem) => `${problem.code} ${problem.operationId ?? problem.route ?? ''}: ${problem.detail}`)
        .join('; ')}`,
    );
    this.name = 'AccessRuleError';
    this.code = problems[0].code;
    this.problems = problems;
  }
}

/** Throws an `AccessRuleError` when `problems` holds one. */
export function refuseProblems(problems: readonly AccessRuleProblem[]): void {
  const [first, ...rest] = problems;
  if (first !== undefined) throw new AccessRuleError([first, ...rest]);
}

// ── Rules ──────────────────────────────────────────────────────────────────────────────────────

export type RouteMethod = 'GET' | 'POST';

/** How an export refusal is written (RB-5): the simulator's `EXPORT_DENIED` row and event. */
export interface ExportDenialShape {
  /** `details.scope` of the audit export and the log export; null for an evidence package. */
  readonly scope: 'AUDIT' | 'LOGS' | null;
  /** The words the simulator's message starts with. */
  readonly label: string;
}

/** What a refusal for a missing permission answers and writes. */
export interface PermissionDenial {
  readonly auditType: typeof AuditType.ACCESS_DENIED | typeof AuditType.EXPORT_DENIED;
  /** `error.code` of the answer: `NOT_PERMITTED`; `FORBIDDEN` for `exportEvidence` (RB-5). */
  readonly errorCode: typeof ApiErrorCode.NOT_PERMITTED | typeof ApiErrorCode.FORBIDDEN;
  /**
   * `details.permission` of the audit row and of the answer: the permission; for the any-of
   * its alternatives in registry order, joined with `_OR_` (`denialPermissionCode`).
   */
  readonly permission: string;
  /** Set for the three exports. */
  readonly export: ExportDenialShape | null;
}

export interface AccessRule {
  /** The registry operation; `REALTIME_CHANNEL_ID` for the socket route. */
  readonly operationId: string;
  readonly method: RouteMethod;
  /** The route pattern as Fastify holds it: `/api/v1/session/:id/start`. */
  readonly url: string;
  readonly kind: CoreApiAccessKind;
  /** The marker of spec §4.2, for log lines: `PUBLIC`, a permission, `ANY-OF(A, B)`. */
  readonly marker: string;
  /** The permissions the rule names: none, one, or the alternatives of the any-of. */
  readonly permissions: readonly Permission[];
  readonly conditions: readonly CoreApiAccessCondition[];
  /** Null when the rule names no permission. */
  readonly denial: PermissionDenial | null;
  /**
   * False for what a retired device may still call (spec §6.6): health, the pairing redeem and
   * the socket handshake. True everywhere else: 403 `DEVICE_REVOKED` with its audit row (RB-6).
   */
  readonly refusesRetiredDevice: boolean;
  /** The pattern of the `{id}` path parameter, for the evidence ID of an export refusal. */
  readonly idPattern: RegExp | null;
}

/** `operationId` of the rule of the socket route in log lines. It is no registry operation. */
export const REALTIME_CHANNEL_ID = 'realtimeChannel';

/**
 * What a device whose credential is retired may still call (spec §6.6, the row "Credential of
 * a REVOKED device"): health, and the pairing redeem with which it pairs again. Both are
 * `PUBLIC`. Every other operation answers it 403 `DEVICE_REVOKED`, the two other `PUBLIC` ones
 * included (`signIn`, `getSignInStatus`; decision D78 DN-9).
 */
export const RETIRED_DEVICE_OPERATIONS: readonly string[] = ['getServiceHealth', 'redeemPairingCode'] satisfies RegistryOperationId[];

/**
 * The three export operations (RB-5; DEPARTURE-3): their refusal keeps the simulator's
 * `EXPORT_DENIED` row and event. A registry entry whose denial type is `EXPORT_DENIED` and
 * that is not listed here cannot be compiled: the guard would not know what to write.
 */
export const EXPORT_DENIALS: Readonly<Record<string, ExportDenialShape>> = {
  exportEvidence: { scope: null, label: 'Export' },
  exportAudit: { scope: 'AUDIT', label: 'Audit export' },
  exportLogs: { scope: 'LOGS', label: 'Log export' },
};

/** The one operation whose refusal code is `FORBIDDEN`, as the existing contract has it (RB-5). A registry operation ID (W91-5). */
export const FORBIDDEN_OPERATION = 'exportEvidence' satisfies RegistryOperationId;

/** Joins the alternatives of the any-of in `details.permission`. No permission name holds it. */
export const ANY_OF_SEPARATOR = '_OR_';

/** The form of `details.permission` that the audit writer accepts for `ACCESS_DENIED`. */
const DENIAL_PERMISSION_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

/**
 * `details.permission` of a refusal: the permission of the rule; for the any-of the
 * alternatives in registry order joined with `_OR_`, for example
 * `EVIDENCE_REVIEW_OR_MAINTENANCE` (decision D64 DN-12, ruled by this row). It is one
 * SCREAMING_SNAKE_CASE code, as the audit writer's list for `ACCESS_DENIED` demands, and it
 * splits back into the permissions because no permission of the vocabulary holds `_OR_`.
 */
export function denialPermissionCode(permissions: readonly string[]): string {
  return permissions.join(ANY_OF_SEPARATOR);
}

/** The permissions a `details.permission` value names. */
export function permissionsOfDenialCode(code: string): string[] {
  return code.split(ANY_OF_SEPARATOR);
}

const ACCESS_KINDS: ReadonlySet<string> = new Set(Object.values(CoreApiAccessKind));
const ACCESS_CONDITIONS: ReadonlySet<string> = new Set(Object.values(CoreApiAccessCondition));
const PERMISSIONS: ReadonlySet<string> = new Set(Object.values(Permission));
const AUDIT_TYPES: ReadonlySet<string> = new Set(Object.values(AuditType));
const AUDIT_MARKERS: ReadonlySet<string> = new Set(Object.values(CoreApiAuditNone));

/** `/api/v1/session/{id}/start` of the registry as the router holds it: `/api/v1/session/:id/start`. */
export function routePatternOf(registryPath: string): string {
  return registryPath.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, ':$1');
}

function methodOf(operation: Pick<CoreApiOperation, 'method'>): RouteMethod {
  return operation.method === 'get' ? 'GET' : 'POST';
}

/** `GET /api/v1/health`: how a route is named in a problem and in a log line. */
export function routeName(method: string, url: string): string {
  return `${method.toUpperCase()} ${url}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The permissions an access rule names, read without trusting its type. */
function namedPermissions(access: Record<string, unknown>): unknown[] | null {
  if (access['kind'] === CoreApiAccessKind.PERMISSION) return [access['permission']];
  if (access['kind'] === CoreApiAccessKind.ANY_OF) {
    const list = access['permissions'];
    return Array.isArray(list) && list.length >= 2 ? list : null;
  }
  return [];
}

/**
 * The rule of one registry entry, or the first thing that is wrong with the entry. The entry is
 * read as data: the registry's own table is type-checked, a table handed in by a test or built
 * by a later row need not be.
 */
export function compileAccessRule(operation: CoreApiOperation): AccessRule | AccessRuleProblem {
  const method = methodOf(operation);
  const url = routePatternOf(operation.path);
  const problem = (code: AccessRuleErrorCode, detail: string): AccessRuleProblem => ({
    code,
    operationId: operation.operationId,
    route: routeName(method, url),
    detail,
  });

  const access: unknown = operation.access;
  if (!isObject(access)) return problem(AccessRuleErrorCode.ACCESS_RULE_MISSING, 'the registry entry carries no access rule');
  const kind = access['kind'];
  if (typeof kind !== 'string' || !ACCESS_KINDS.has(kind)) {
    return problem(AccessRuleErrorCode.ACCESS_RULE_INVALID, 'the access rule has no kind of spec §4.2');
  }
  const named = namedPermissions(access);
  if (named === null) return problem(AccessRuleErrorCode.ACCESS_RULE_INVALID, 'an any-of rule names at least two permissions');
  // By index: a missing permission is `undefined`, which `find` could not tell from "none found".
  const unknownAt = named.findIndex((permission) => typeof permission !== 'string' || !PERMISSIONS.has(permission));
  if (unknownAt !== -1) {
    const unknown: unknown = named[unknownAt];
    return problem(
      AccessRuleErrorCode.PERMISSION_NOT_IN_VOCABULARY,
      `the access rule names ${typeof unknown === 'string' ? unknown : 'a value that is no text'}, which is no permission of the shared vocabulary`,
    );
  }
  const permissions = named as Permission[];
  const conditions: unknown = access['conditions'] ?? [];
  if (!Array.isArray(conditions) || conditions.some((condition) => typeof condition !== 'string' || !ACCESS_CONDITIONS.has(condition))) {
    return problem(AccessRuleErrorCode.ACCESS_RULE_INVALID, 'the access rule carries a condition the guard does not know');
  }

  const audit: unknown = operation.audit;
  if (!isObject(audit)) return problem(AccessRuleErrorCode.AUDIT_RULE_MISSING, 'the registry entry carries no audit rule');
  const { success, denial } = audit;
  if (typeof success !== 'string' || !(AUDIT_TYPES.has(success) || AUDIT_MARKERS.has(success))) {
    return problem(AccessRuleErrorCode.AUDIT_RULE_INVALID, 'the success rule is neither an audit type nor NONE-R or NONE-P');
  }
  if (denial !== AuditType.ACCESS_DENIED && denial !== AuditType.EXPORT_DENIED) {
    return problem(AccessRuleErrorCode.AUDIT_RULE_INVALID, 'the denial type is neither ACCESS_DENIED nor EXPORT_DENIED');
  }
  const exportShape = denial === AuditType.EXPORT_DENIED ? EXPORT_DENIALS[operation.operationId] : undefined;
  if (denial === AuditType.EXPORT_DENIED && (exportShape === undefined || permissions.length !== 1)) {
    return problem(
      AccessRuleErrorCode.AUDIT_RULE_INVALID,
      'the denial type EXPORT_DENIED belongs to the three export operations, each with one permission (RB-5)',
    );
  }

  const permissionCode = denialPermissionCode(permissions);
  if (permissions.length > 0 && !DENIAL_PERMISSION_PATTERN.test(permissionCode)) {
    return problem(AccessRuleErrorCode.ACCESS_RULE_INVALID, 'the permissions of the rule do not fit into details.permission of the denial row');
  }

  const typedAccess = access as CoreApiAccess;
  return {
    operationId: operation.operationId,
    method,
    url,
    kind: typedAccess.kind,
    marker: describeCoreApiAccess(typedAccess),
    permissions,
    conditions: conditions as CoreApiAccessCondition[],
    denial:
      permissions.length === 0
        ? null
        : {
            auditType: denial,
            errorCode: operation.operationId === FORBIDDEN_OPERATION ? ApiErrorCode.FORBIDDEN : ApiErrorCode.NOT_PERMITTED,
            permission: permissionCode,
            export: exportShape ?? null,
          },
    refusesRetiredDevice: !(typedAccess.kind === CoreApiAccessKind.PUBLIC && RETIRED_DEVICE_OPERATIONS.includes(operation.operationId)),
    idPattern: operation.pathParam?.pattern ?? null,
  };
}

/** The rule of the socket route: no registry entry, no permission, no row (header of this file). */
export const REALTIME_CHANNEL_RULE: AccessRule = Object.freeze({
  operationId: REALTIME_CHANNEL_ID,
  method: 'GET',
  url: WS_PATH,
  kind: CoreApiAccessKind.PUBLIC,
  marker: CoreApiAccessKind.PUBLIC,
  permissions: [],
  conditions: [],
  denial: null,
  refusesRetiredDevice: false,
  idPattern: null,
});

export function isAccessRule(resolved: AccessRule | AccessRuleProblem): resolved is AccessRule {
  return 'kind' in resolved;
}

// ── The rule book ──────────────────────────────────────────────────────────────────────────────

/** A route as the router holds it. */
export interface RouteIdentity {
  readonly method: string;
  /** The pattern: `/api/v1/session/:id/start`. */
  readonly url: string;
  /** `config.operationId` of the route. */
  readonly operationId: string | undefined;
}

export interface RuleBook {
  /** The rule of a route, or why it has none. */
  resolve(route: RouteIdentity): AccessRule | AccessRuleProblem;
  /**
   * The rule of a route by its method and path alone, for a route whose configuration cannot be
   * read (one found in the router's printed table). It says nothing about `config.operationId`.
   */
  ruleAt(method: string, url: string): AccessRule | AccessRuleProblem;
  /** The rule of a registry operation by its ID, registered or not; a problem when it has none. */
  ruleOf(operationId: string): AccessRule | AccessRuleProblem;
  /** Every operation of the registry this book was built from, in registry order. */
  readonly operationIds: readonly string[];
}

/**
 * The rules of a registry. Each entry is compiled once, when the book is made; a route is
 * matched by method and path, never by what its configuration claims.
 */
export function createRuleBook(operations: readonly CoreApiOperation[] = CORE_API_OPERATIONS): RuleBook {
  const byRoute = new Map<string, AccessRule | AccessRuleProblem>();
  const byId = new Map<string, AccessRule | AccessRuleProblem>();
  for (const operation of operations) {
    const compiled = compileAccessRule(operation);
    byRoute.set(routeName(operation.method, routePatternOf(operation.path)), compiled);
    byId.set(operation.operationId, compiled);
  }

  const withoutRules = (name: string): AccessRuleProblem => ({
    code: AccessRuleErrorCode.ROUTE_WITHOUT_RULES,
    operationId: null,
    route: name,
    detail: 'the route is no operation of the contract registry: it has no access rule and no audit rule',
  });
  const isChannel = (method: string, url: string): boolean =>
    method.toUpperCase() === REALTIME_CHANNEL_RULE.method && url === REALTIME_CHANNEL_RULE.url;

  return {
    operationIds: operations.map((operation) => operation.operationId),

    ruleAt(method, url) {
      if (isChannel(method, url)) return REALTIME_CHANNEL_RULE;
      const name = routeName(method, url);
      return byRoute.get(name) ?? withoutRules(name);
    },

    resolve(route) {
      const name = routeName(route.method, route.url);
      if (isChannel(route.method, route.url)) return REALTIME_CHANNEL_RULE;
      const compiled = byRoute.get(name);
      if (compiled === undefined) {
        const claimed = route.operationId === undefined ? undefined : byId.get(route.operationId);
        if (claimed !== undefined) {
          const registered = isAccessRule(claimed) ? routeName(claimed.method, claimed.url) : (claimed.route ?? 'another route');
          return {
            code: AccessRuleErrorCode.ROUTE_NOT_THE_OPERATION,
            operationId: route.operationId ?? null,
            route: name,
            detail: `the route names the operation ${route.operationId}, which the registry has at ${registered}`,
          };
        }
        return withoutRules(name);
      }
      // A defective registry entry is the problem to report, whatever the route says of itself.
      if (!isAccessRule(compiled)) return compiled;
      if (route.operationId !== compiled.operationId) {
        return {
          code: AccessRuleErrorCode.OPERATION_ID_MISMATCH,
          operationId: compiled.operationId,
          route: name,
          detail: `the route is the operation ${compiled.operationId} and its config.operationId ${route.operationId === undefined ? 'is missing' : 'names another'}`,
        };
      }
      return compiled;
    },

    ruleOf(operationId) {
      return (
        byId.get(operationId) ?? {
          code: AccessRuleErrorCode.ROUTE_WITHOUT_RULES,
          operationId,
          route: null,
          detail: 'the contract registry has no such operation',
        }
      );
    },
  };
}
