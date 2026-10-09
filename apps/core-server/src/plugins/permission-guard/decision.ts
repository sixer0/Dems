/**
 * The decision of stage 6 (plan row W28; hand-built element HB-7; spec §2.3 stage 6, §4.1, §4.2,
 * §4.6 RB-2 to RB-6, §6.6, §7.3 lines 6 and 7, §12.1 DC-1 and DC-2; SR-13, SR-44 to SR-46).
 *
 * One pure function: the rule of the operation and what stages 3 and 4 found about the caller
 * go in, "allow" or one refusal comes out. No database, no clock, no request: it reads nothing
 * of a body, a query string or a path, so a refusal never depends on request data.
 *
 * WHERE THE PERMISSIONS COME FROM. An OPERATOR's role and the permissions of that role are read
 * from PostgreSQL by stage 4 with the session lookup of THIS request (RB-3) and stand on the
 * principal. They are the one truth of the decision. Nothing here keeps a matrix, and nothing is
 * remembered between two requests (RB-2): a committed role change, or a changed grant, decides
 * the very next request of the same session.
 *
 *   access kind      ANONYMOUS      retired device     DEVICE         OPERATOR, web        OPERATOR, device
 *   PUBLIC           allow          403 REVOKED *      allow          allow                allow
 *   DEVICE           401            403 REVOKED *      allow          403 NOT_PAIRED       allow †
 *   AUTHENTICATED    401            403 REVOKED *      401            allow                allow
 *   a permission     401            403 REVOKED *      401            holds it: allow; else 403 NOT_PERMITTED *
 *   any-of           401            403 REVOKED *      401            holds one: allow; else 403 NOT_PERMITTED *
 *
 *   * audited: exactly one row, inside the denial budget. Every other refusal writes none.
 *     A retired device is let through on what it may still call (health, the pairing redeem,
 *     the socket handshake): it is then an ANONYMOUS caller.
 *   † unless the rule carries the condition `DEVICE_CREDENTIAL`: then 403 NOT_PAIRED with the
 *     reason `DEVICE_CREDENTIAL_REQUIRED`, and no row. The DEVICE itself is allowed.
 *
 * Then, for a caller the table allows, the conditions of the rule, in this order (spec §7.3
 * line 7): `CONSOLE_IDENTITY`, `DEVICE_SESSION` and `DEVICE_CREDENTIAL` answer 403
 * `DEVICE_NOT_PAIRED`, `DEMO_FLAG` answers 403 `DEMO_DISABLED`. None of those four writes a row.
 * The permission comes before the demo flag, so a caller without `DEMO_CONTROL` gets
 * `NOT_PERMITTED` whatever the flag (DC-1).
 *
 * `SESSION_HOLDER` (task 3 M2-W7; SEC35-18; D4 OD-09; C3 §2.2/§5.3) is the fifth condition and
 * the first one whose refusal IS audited: it holds when the caller is the operator who created the
 * open session or holds SUPERVISOR; otherwise the refusal is 403 `NOT_PERMITTED` with one
 * `ACCESS_DENIED` row whose `details.reason` names the condition. It never replaces the permission
 * check: the marker's permission comes first, exactly like the demo flag.
 *
 * `DEVICE_CREDENTIAL` (finding CPS1-3 of the security checkpoint; decisions D113, D118): the
 * request presented the device credential itself, so the caller is the DEVICE principal. The
 * session of an operator who is signed in on the device does not hold it: a session ends by
 * itself, and it must not be able to leave behind something that does not end. Nothing here
 * names an operation: whichever rule of the registry carries the condition gets this decision.
 *
 * A condition that has no case here is never passed over: the request is refused (it throws),
 * and the type check of this file fails when the vocabulary gains a member without a case.
 */
import { CoreApiAccessCondition, CoreApiAccessKind } from '@dems/shared/api';
// The value AND the type: `@dems/shared/sim` exports both meanings of the name (vocabulary.ts).
import { OperatorRole } from '@dems/shared/sim';
import type { Principal } from '../authenticate';
import type { AccessRule, PermissionDenial } from './access-rules';

/** `details.reason` of the ACCESS_DENIED row a failed `SESSION_HOLDER` condition writes (C3 §5.3). */
export const SESSION_HOLDER_REASON = CoreApiAccessCondition.SESSION_HOLDER;

/** What the decision needs to know about the caller. Facts of stages 3 and 4, and the demo flag. */
export interface AccessCaller {
  readonly principal: Principal;
  /**
   * ID-1: the caller is a web console (a web console `Origin`, no `Authorization` header) or
   * speaks for a paired device. Read only for a rule with the condition `CONSOLE_IDENTITY`.
   */
  readonly consoleIdentity: boolean;
  /** The server's demo flag (DC-2). Read only for a rule with the condition `DEMO_FLAG`. */
  readonly demoControls: boolean;
  /**
   * Task 3 M2-W7 (SEC35-18; D4 OD-09; C3 §0/§2.2): the operator who CREATED the open session, or
   * null when no session is open. Read only for a rule with the condition `SESSION_HOLDER`.
   */
  readonly sessionCreatorId: string | null;
}

export const AccessRefusalKind = {
  /** 401: the rule needs a principal and the request has none. No row: no actor can be named (RB-6). */
  NOT_SIGNED_IN: 'NOT_SIGNED_IN',
  /** 403 with one `ACCESS_DENIED` row that names the device (RB-6). */
  DEVICE_REVOKED: 'DEVICE_REVOKED',
  /** 403 with one row that names actor, operation, permission and role (RB-4, RB-5). */
  NOT_PERMITTED: 'NOT_PERMITTED',
  /**
   * 403, no row: no console identity, a device-only operation called by a web session, or an
   * operation that needs the device's own credential called with a session of the device.
   */
  DEVICE_NOT_PAIRED: 'DEVICE_NOT_PAIRED',
  /** 403, no row: a demo operation while the demo flag is off (DC-2). */
  DEMO_DISABLED: 'DEMO_DISABLED',
} as const;
export type AccessRefusalKind = (typeof AccessRefusalKind)[keyof typeof AccessRefusalKind];

export type AccessRefusal =
  | {
      readonly kind: typeof AccessRefusalKind.NOT_SIGNED_IN;
      /** What the rule asks for: an operator's session, or a paired device. */
      readonly needs: 'OPERATOR' | 'DEVICE';
    }
  | { readonly kind: typeof AccessRefusalKind.DEVICE_REVOKED; readonly deviceId: string }
  | {
      readonly kind: typeof AccessRefusalKind.NOT_PERMITTED;
      readonly operatorId: string;
      readonly role: OperatorRole;
      /** The device the operator's session is bound to; null for a web console session. */
      readonly deviceId: string | null;
      readonly denial: PermissionDenial;
      /**
       * Task 3 M2-W7 (C3 §5.3): the condition of the same rule that did not hold, when the refusal
       * is not about the permission itself — `SESSION_HOLDER` today, the SCREAMING_SNAKE name of
       * the condition. It joins the row's details and the answer's details as `reason`.
       */
      readonly reason?: string;
    }
  | {
      readonly kind: typeof AccessRefusalKind.DEVICE_NOT_PAIRED;
      /**
       * The condition that does not hold, or `DEVICE_OPERATION`: an operation of access kind
       * DEVICE called by a web console session (the marker itself, before any condition).
       */
      readonly cause:
        | typeof CoreApiAccessCondition.CONSOLE_IDENTITY
        | typeof CoreApiAccessCondition.DEVICE_SESSION
        | typeof CoreApiAccessCondition.DEVICE_CREDENTIAL
        | 'DEVICE_OPERATION';
    }
  | { readonly kind: typeof AccessRefusalKind.DEMO_DISABLED };

export type AccessDecision = { readonly allowed: true } | { readonly allowed: false; readonly refusal: AccessRefusal };

const ALLOW: AccessDecision = Object.freeze({ allowed: true });
const refuse = (refusal: AccessRefusal): AccessDecision => ({ allowed: false, refusal });

/** True for the two refusals that write a row and take a place in the denial budget. */
export function isAudited(refusal: AccessRefusal): boolean {
  return refusal.kind === AccessRefusalKind.DEVICE_REVOKED || refusal.kind === AccessRefusalKind.NOT_PERMITTED;
}

/** The principal the access kind names (the table of this file's header). */
function decidePrincipal(rule: AccessRule, principal: Principal): AccessDecision {
  if (principal.kind === 'ANONYMOUS' && principal.retiredDeviceId !== null && rule.refusesRetiredDevice) {
    return refuse({ kind: AccessRefusalKind.DEVICE_REVOKED, deviceId: principal.retiredDeviceId });
  }

  switch (rule.kind) {
    case CoreApiAccessKind.PUBLIC:
      return ALLOW;

    case CoreApiAccessKind.DEVICE:
      if (principal.kind === 'DEVICE') return ALLOW;
      if (principal.kind === 'OPERATOR') {
        return principal.deviceId === null ? refuse({ kind: AccessRefusalKind.DEVICE_NOT_PAIRED, cause: 'DEVICE_OPERATION' }) : ALLOW;
      }
      return refuse({ kind: AccessRefusalKind.NOT_SIGNED_IN, needs: 'DEVICE' });

    case CoreApiAccessKind.AUTHENTICATED:
      return principal.kind === 'OPERATOR' ? ALLOW : refuse({ kind: AccessRefusalKind.NOT_SIGNED_IN, needs: 'OPERATOR' });

    case CoreApiAccessKind.PERMISSION:
    case CoreApiAccessKind.ANY_OF: {
      if (principal.kind !== 'OPERATOR') return refuse({ kind: AccessRefusalKind.NOT_SIGNED_IN, needs: 'OPERATOR' });
      // The rule book gives every rule of these two kinds its permissions and its denial. One
      // without them is a defect of the server, and nobody is let through on it.
      if (rule.denial === null || rule.permissions.length === 0) {
        throw new Error(`the access rule of ${rule.operationId} names a permission and has none to check`);
      }
      if (rule.permissions.some((permission) => principal.permissions.includes(permission))) return ALLOW;
      return refuse({
        kind: AccessRefusalKind.NOT_PERMITTED,
        operatorId: principal.operatorId,
        role: principal.role,
        deviceId: principal.deviceId,
        denial: rule.denial,
      });
    }
  }
}

/** The conditions of the rule, for a caller the access kind allows. */
function decideConditions(rule: AccessRule, caller: AccessCaller): AccessDecision {
  const { principal } = caller;
  for (const condition of rule.conditions) {
    switch (condition) {
      case CoreApiAccessCondition.CONSOLE_IDENTITY:
        if (!caller.consoleIdentity) return refuse({ kind: AccessRefusalKind.DEVICE_NOT_PAIRED, cause: condition });
        break;
      case CoreApiAccessCondition.DEVICE_SESSION:
        if (principal.kind !== 'OPERATOR' || principal.deviceId === null) {
          return refuse({ kind: AccessRefusalKind.DEVICE_NOT_PAIRED, cause: condition });
        }
        break;
      case CoreApiAccessCondition.DEVICE_CREDENTIAL:
        // The device itself, by its own credential, and nobody else: whoever else the access
        // kind let through (the session of an operator on a paired device) does not hold it.
        if (principal.kind !== 'DEVICE') return refuse({ kind: AccessRefusalKind.DEVICE_NOT_PAIRED, cause: condition });
        break;
      case CoreApiAccessCondition.DEMO_FLAG:
        if (!caller.demoControls) return refuse({ kind: AccessRefusalKind.DEMO_DISABLED });
        break;
      case CoreApiAccessCondition.SESSION_HOLDER: {
        // D4 OD-09; SEC35-18; C3 §2.2: the operator who created the open session, or a SUPERVISOR.
        // The permission of the marker has already been checked (the order of this loop); this
        // condition only adds the holder rule. Its refusal is audited NOT_PERMITTED with
        // `details.reason: SESSION_HOLDER` (C3 §5.3) — the one condition whose refusal writes.
        if (principal.kind !== 'OPERATOR') break; // the marker refused others before this loop
        const holds =
          principal.role === OperatorRole.SUPERVISOR || (caller.sessionCreatorId !== null && principal.operatorId === caller.sessionCreatorId);
        if (!holds) {
          if (rule.denial === null) {
            throw new Error(`the access rule of ${rule.operationId} carries SESSION_HOLDER without a permission to name in its refusal`);
          }
          return refuse({
            kind: AccessRefusalKind.NOT_PERMITTED,
            operatorId: principal.operatorId,
            role: principal.role,
            deviceId: principal.deviceId,
            denial: rule.denial,
            reason: SESSION_HOLDER_REASON,
          });
        }
        break;
      }
      default: {
        // A condition without a case above: nobody is let through on a rule that was not decided.
        const unevaluated: never = condition;
        throw new Error(`the access rule of ${rule.operationId} carries a condition that stage 6 does not evaluate: ${String(unevaluated)}`);
      }
    }
  }
  return ALLOW;
}

/**
 * Stage 6 for one request: the principal the rule names, the permission, then the conditions.
 * The same answer for the same arguments, every time: nothing is cached and nothing is kept.
 */
export function decideAccess(rule: AccessRule, caller: AccessCaller): AccessDecision {
  const byPrincipal = decidePrincipal(rule, caller.principal);
  return byPrincipal.allowed ? decideConditions(rule, caller) : byPrincipal;
}
