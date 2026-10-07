/**
 * The registry model of the Core API contract: what one entry of the operation table says
 * (backend task: 2026-10-04 01_specs §4.2, §4.6 RB-1, §7.1 API-8, §7.19; 04_client_integration_spec
 * §11 AR-1; decisions D11 TD-09 and D36).
 *
 * | Member     | Says | Values |
 * |------------|------|--------|
 * | `mode`     | Whether a client can call the operation without the Core server | `simulated`: the in-app simulator can answer it (the nine design-book operations). `live`: only a service answers it |
 * | `services` | Which services answer it over the network | `dems-mock-core` and `dems-core-server` for the health operation; `dems-core-server` for every other one |
 * | `access`   | Who may call it (exactly one rule, RB-1) | `PUBLIC`, `DEVICE`, `AUTHENTICATED`, one permission, or the one any-of |
 * | `audit`    | Which audit row it writes (exactly one rule, API-8) | On success one audit type, or `NONE-R` (a read) or `NONE-P` (parity with the simulator, which writes none). On a refusal `ACCESS_DENIED`, or `EXPORT_DENIED` for the three exports (RB-5) |
 * | `query`    | Query parameters of a GET, as one object schema (D36, contract gap 2) | A `CORE_API_SCHEMAS` name |
 * | `coreServerDescription` | What the `all` scope says where `description` speaks of the simulator or of mock-core | Markdown; the ten existing operations only |
 * | `responses[status].services` | Which services send that status, when not every answerer of the operation does | Omitted for an answer the in-app simulator gives too |
 * | `responses[status].coreServerDescription` | What the `all` scope says of that status where the Core server sends more codes than `description` names | The ten existing operations only (W83) |
 *
 * Two types, on purpose:
 * - `CoreApiOperation` is what a transport needs (the typed client, the route matcher, the OpenAPI
 *   builder). `access`, `audit` and `services` are optional there, so a table written by hand for
 *   a test stays valid.
 * - `CoreApiRegistryOperation` is an entry of the registry itself: the three are mandatory. The
 *   registry's table is declared `as const satisfies readonly CoreApiRegistryOperation[]`, so an
 *   entry without an access rule or an audit rule does not compile; test/api-registry.test.ts
 *   checks the same at run time for every entry.
 *
 * A leaf module: it imports type names only, so the per-area modules can use it without a cycle.
 */
import type { AuditType, OperatorRole, Permission } from '../sim/vocabulary';
import { CORE_SERVER_SERVICE_NAME, SERVICE_NAME } from './constants';
import type { CoreApiSchemaName } from './core-api';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Tags, modes, answering services
// ═══════════════════════════════════════════════════════════════════════════════════════

export const CoreApiTag = {
  SERVICE: 'Service',
  SESSION: 'Session',
  DEVICE: 'Device',
  STORAGE: 'Storage',
  EVIDENCE: 'Evidence',
  REALTIME: 'Realtime',
  // Backend task (01_specs §7.5 to §7.7, §7.16): answered by the Core server only.
  IDENTITY: 'Identity',
  ADMINISTRATION: 'Administration',
  PAIRING: 'Pairing',
  DEMO: 'Demo',
  // Backend task (01_specs §7.12 to §7.15): areas 8 to 11, answered by the Core server only. Areas 4
  // to 7 extend the Session, Evidence, Device and Storage tags.
  NETWORK: 'Network',
  SECURITY: 'Security',
  SYSTEM: 'System',
  ALERTS: 'Alerts',
} as const;
export type CoreApiTag = (typeof CoreApiTag)[keyof typeof CoreApiTag];

/**
 * SIMULATED: the in-app simulator can answer the operation, so a client can call it without the
 * Core server. LIVE: only a service answers it, over the network; `services` names which.
 */
export const CoreApiMode = { LIVE: 'live', SIMULATED: 'simulated' } as const;
export type CoreApiMode = (typeof CoreApiMode)[keyof typeof CoreApiMode];

/** The services that answer over the network, by the `service` value of their health answer. */
export const CoreApiService = { MOCK_CORE: SERVICE_NAME, CORE_SERVER: CORE_SERVER_SERVICE_NAME } as const;
export type CoreApiService = (typeof CoreApiService)[keyof typeof CoreApiService];

export type CoreApiMethod = 'get' | 'post';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Access rule (01_specs §4.2)
// ═══════════════════════════════════════════════════════════════════════════════════════

export const CoreApiAccessKind = {
  /** Any caller on loopback: health, and the entry points that create a credential. */
  PUBLIC: 'PUBLIC',
  /** A DEVICE principal, or an OPERATOR whose session is bound to a device. */
  DEVICE: 'DEVICE',
  /** Any OPERATOR. */
  AUTHENTICATED: 'AUTHENTICATED',
  /** An OPERATOR whose role holds `permission`. */
  PERMISSION: 'PERMISSION',
  /** An OPERATOR whose role holds one of `permissions` (exactly one operation, `setStoragePolicy`). */
  ANY_OF: 'ANY_OF',
} as const;
export type CoreApiAccessKind = (typeof CoreApiAccessKind)[keyof typeof CoreApiAccessKind];

/** What an operation needs on top of its marker. Each one answers 403 when it does not hold. */
export const CoreApiAccessCondition = {
  /** ID-1: a web console origin, or a paired device's credential. Otherwise `DEVICE_NOT_PAIRED`. */
  CONSOLE_IDENTITY: 'CONSOLE_IDENTITY',
  /** The caller's session must be bound to a device. Otherwise `DEVICE_NOT_PAIRED`. */
  DEVICE_SESSION: 'DEVICE_SESSION',
  /**
   * The request presented the device credential itself: the caller is the DEVICE principal.
   * On the marker `DEVICE` it takes away the second half of that marker: the session of an
   * operator who is signed in on the device does not hold it. It belongs on an operation whose
   * effect outlives the session that would call it (decision D113, finding CPS1-3): a session
   * token ends when it is idle and at its absolute limit, and such a token must not be able to
   * leave behind something that does not end.
   *
   * Otherwise `DEVICE_NOT_PAIRED` with `details.reason` `DEVICE_CREDENTIAL_REQUIRED`
   * (`DEVICE_CREDENTIAL_REQUIRED_REASON`). No new error code: it is the code a web console
   * session already gets from the marker `DEVICE` itself, before any condition is looked at,
   * and like that refusal it writes no audit row. The reason tells the two apart, because the
   * device of this caller IS paired.
   */
  DEVICE_CREDENTIAL: 'DEVICE_CREDENTIAL',
  /** The server-side demo flag must be on (DC-2). Otherwise `DEMO_DISABLED`, after the permission check. */
  DEMO_FLAG: 'DEMO_FLAG',
} as const;
export type CoreApiAccessCondition = (typeof CoreApiAccessCondition)[keyof typeof CoreApiAccessCondition];

/** `details.reason` of the `403 DEVICE_NOT_PAIRED` that the condition `DEVICE_CREDENTIAL` answers. */
export const DEVICE_CREDENTIAL_REQUIRED_REASON = 'DEVICE_CREDENTIAL_REQUIRED';

/**
 * `details.reason` of the `403 DEVICE_NOT_PAIRED` of `setBiometricEnrollment` when `enabled: true` is
 * sent on a session that was not created by password (W83, gap W41-2).
 */
export const PASSWORD_SESSION_REQUIRED_REASON = 'PASSWORD_SESSION_REQUIRED';

export type CoreApiAccess = { readonly conditions?: readonly CoreApiAccessCondition[] } & (
  | { readonly kind: typeof CoreApiAccessKind.PUBLIC }
  | { readonly kind: typeof CoreApiAccessKind.DEVICE }
  | { readonly kind: typeof CoreApiAccessKind.AUTHENTICATED }
  | { readonly kind: typeof CoreApiAccessKind.PERMISSION; readonly permission: Permission }
  | { readonly kind: typeof CoreApiAccessKind.ANY_OF; readonly permissions: readonly [Permission, Permission, ...Permission[]] }
);

export const PUBLIC_ACCESS = { kind: CoreApiAccessKind.PUBLIC } as const;
export const DEVICE_ACCESS = { kind: CoreApiAccessKind.DEVICE } as const;
export const AUTHENTICATED_ACCESS = { kind: CoreApiAccessKind.AUTHENTICATED } as const;

/** The access rule "an OPERATOR whose role holds `permission`". */
export function permissionAccess<P extends Permission>(permission: P) {
  return { kind: CoreApiAccessKind.PERMISSION, permission } as const;
}

/** The access rule "an OPERATOR whose role holds `first` or `second`" (`ANY-OF(first, second)`). */
export function anyOfAccess<A extends Permission, B extends Permission>(first: A, second: B) {
  return { kind: CoreApiAccessKind.ANY_OF, permissions: [first, second] } as const;
}

/** The permissions an access rule names: none, one, or the alternatives of an any-of. */
export function coreApiAccessPermissions(access: CoreApiAccess): readonly Permission[] {
  if (access.kind === CoreApiAccessKind.PERMISSION) return [access.permission];
  if (access.kind === CoreApiAccessKind.ANY_OF) return access.permissions;
  return [];
}

/**
 * Joins the alternatives of the any-of in `details.permission` of a refusal and of its ACCESS_DENIED
 * row (decision D83 DN-1): one SCREAMING_SNAKE_CASE code, which the audit writer accepts. No
 * permission name holds it (W83, gap 5 and finding F64).
 */
export const ANY_OF_DENIAL_SEPARATOR = '_OR_';

/** `details.permission` of a refusal by `access`: its permission, or the any-of's alternatives joined with `_OR_`; null for a rule that names none. */
export function denialPermissionOf(access: CoreApiAccess): string | null {
  const permissions = coreApiAccessPermissions(access);
  return permissions.length === 0 ? null : permissions.join(ANY_OF_DENIAL_SEPARATOR);
}

/**
 * The permissions a refusal's `details.permission` names, whichever of its three spellings arrives
 * (W83, gap 5 and finding F64): the Core server's `EVIDENCE_REVIEW_OR_MAINTENANCE`, the simulator's
 * label `EVIDENCE_REVIEW | MAINTENANCE`, or the registry's marker `ANY-OF(EVIDENCE_REVIEW, MAINTENANCE)`.
 * One permission is a list of one; an empty text is an empty list. This is the one mapping for clients.
 */
export function permissionsOfDenialLabel(label: string): string[] {
  const text = label.trim();
  const inner = /^ANY-OF\((.*)\)$/.exec(text)?.[1] ?? text;
  return inner
    .split(/_OR_|\||,/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

/** The marker as 01_specs §4.2 writes it: `PUBLIC`, `DEVICE`, `AUTHENTICATED`, a permission, or `ANY-OF(A, B)`. */
export function describeCoreApiAccess(access: CoreApiAccess): string {
  if (access.kind === CoreApiAccessKind.PERMISSION) return access.permission;
  if (access.kind === CoreApiAccessKind.ANY_OF) return `ANY-OF(${access.permissions.join(', ')})`;
  return access.kind;
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Audit rule (01_specs §7.1 API-8)
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The two explicit "no audit row" markers of a success rule. */
export const CoreApiAuditNone = {
  /** A read: no state change. */
  READ: 'NONE-R',
  /** Parity: the hosted simulator action writes no audit row and Live keeps the same audit sequence. */
  PARITY: 'NONE-P',
} as const;
export type CoreApiAuditNone = (typeof CoreApiAuditNone)[keyof typeof CoreApiAuditNone];

export type CoreApiAuditSuccess = AuditType | CoreApiAuditNone;
/** `ACCESS_DENIED` (RB-4, RB-6), or `EXPORT_DENIED` for the three export operations (RB-5). */
export type CoreApiAuditDenial = Extract<AuditType, 'ACCESS_DENIED' | 'EXPORT_DENIED'>;

export interface CoreApiAudit {
  /** The row a call writes when it succeeds and changes something; a no-op repeat writes none. */
  success: CoreApiAuditSuccess;
  /** The row the access rule writes when it refuses the caller. */
  denial: CoreApiAuditDenial;
  /** Other row types the call can write: a failed attempt, a second outcome, a side effect. */
  also?: readonly AuditType[];
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface CoreApiResponseSpec {
  description: string;
  /**
   * Text of the `all` scope for a status of one of the ten existing operations whose `description`
   * (the `offline` scope, pinned to the baseline) names fewer codes than the Core server sends
   * (W83, gap W34-2 and gap W35-2). Omitted: `description` serves both scopes. A
   * reader of the codes a status may carry reads both texts.
   */
  coreServerDescription?: string;
  /** Body schema; omitted for a response without a body. */
  schema?: CoreApiSchemaName;
  /**
   * The services that send this status, when not every answerer of the operation does. Used for
   * the statuses that only the Core server sends on an operation the in-app simulator answers too
   * (01_specs §7.19): the 401 and the 403 of the five simulated reads, the 422 of `startSession`.
   * Omitted: every answerer sends it, the simulator included. The document of the `offline` scope
   * leaves a status out when this member is set (`isOfflineCoreApiResponse`).
   */
  services?: readonly CoreApiService[];
}

export interface CoreApiRbac {
  permission: Permission;
  /** Roles holding the permission (demo RBAC, 12_sim_contract §4). */
  roles: readonly OperatorRole[];
  /** Audit row types the call writes (success and denial). */
  audit: readonly string[];
}

export interface CoreApiOperation {
  operationId: string;
  method: CoreApiMethod;
  /** OpenAPI path template, e.g. `/api/v1/session/{id}/start`. */
  path: string;
  tag: CoreApiTag;
  mode: CoreApiMode;
  summary: string;
  /** Markdown. */
  description: string;
  /**
   * Markdown of the `all` scope, for an operation whose `description` speaks of the in-app
   * simulator or of mock-core: it describes the operation as the Core server answers it. The ten
   * existing operations carry it; `description` stays what the `offline` scope shows. Omitted:
   * `description` serves both scopes.
   */
  coreServerDescription?: string;
  /** Where the endpoint comes from: the design book section or this demo's spec. */
  source: string;
  /** The `{id}` path parameter, when the path has one. */
  pathParam?: { name: 'id'; description: string; pattern: RegExp };
  /** Query parameters of a GET: the names and types are the members of this object schema. */
  query?: { schema: CoreApiSchemaName };
  requestBody?: { schema: CoreApiSchemaName; required: boolean };
  /** Keyed by HTTP status. */
  responses: Readonly<Record<number, CoreApiResponseSpec>>;
  /** The four simulated commands only: what the simulator checks (`x-dems-rbac`). */
  rbac?: CoreApiRbac;
  access?: CoreApiAccess;
  audit?: CoreApiAudit;
  services?: readonly CoreApiService[];
}

/** An entry of the registry: an operation with its access rule, its audit rule and its services. */
export interface CoreApiRegistryOperation extends CoreApiOperation {
  access: CoreApiAccess;
  audit: CoreApiAudit;
  services: readonly [CoreApiService, ...CoreApiService[]];
}

/** Answered by the Core server only (every operation except health). */
export const CORE_SERVER_ONLY = [CoreApiService.CORE_SERVER] as const;
