/**
 * What a refusal of stage 6 answers and what it writes (plan row W28; spec §4.6 RB-4 to RB-6,
 * §7.2, §13.1; SR-45; decisions D13 DEPARTURE-3, D64 DN-12, D78 DN-9). Pure builders: the
 * plugin takes the place in the denial budget, runs the unit of work and throws the answer.
 *
 * THE ROWS. Exactly one per audited refusal, and none for any other refusal:
 *
 *   refusal                          type            actor      device               details
 *   a missing permission             ACCESS_DENIED   operator   the session's, or    operationId, permission, role
 *                                                               null on the web
 *   the same, on the three exports   EXPORT_DENIED   operator   the same             operationId, permission, role,
 *     (RB-5), with the event                                                         eventKind, scope (audit, logs);
 *     EXPORT_DENIED                                                                  the row's evidenceId (package)
 *   a retired device                 ACCESS_DENIED   null       the device           operationId, reason: DEVICE_REVOKED
 *
 * `details.permission` of the any-of is its alternatives joined with `_OR_`
 * (`EVIDENCE_REVIEW_OR_MAINTENANCE`). The answer carries the same `operationId`, `permission`
 * and `role` in `error.details`.
 *
 * THE ANSWERS OF `DEVICE_NOT_PAIRED`, none of which writes a row or takes a place in the denial
 * budget: the sign-in text for a caller without a console identity; "available on a paired
 * device only" for a web console session on a device operation and for a session that is not
 * bound to a device; and, for the condition `DEVICE_CREDENTIAL` (finding CPS1-3, decisions D113
 * and D118), "needs the device's own credential" with `details.reason`
 * `DEVICE_CREDENTIAL_REQUIRED`: that caller's device IS paired, so the reason tells the two apart.
 *
 * WHAT A ROW NEVER HOLDS: a request body, a query string, a header, a token, a credential. The
 * one value taken from the request is the evidence ID in the path of `exportEvidence`, and only
 * when it has the form of an evidence ID (the registry's own pattern); otherwise the row names
 * no evidence. It is what the simulator's `EXPORT_DENIED` row names, and what the custody view
 * of both clients reads.
 */
import { ApiErrorCode, CoreApiAccessCondition, DEVICE_CREDENTIAL_REQUIRED_REASON } from '@dems/shared/api';
import { AuditEventKind } from '@dems/shared/domain';
import { AuditType, Severity, SimEventType } from '@dems/shared/sim';
import type { AuditEntry, EventEntry } from '../../core';
import { deviceNotPaired, deviceRevoked, notSignedIn } from '../authenticate';
import { ApiFailure } from '../error-envelope';
import { permissionsOfDenialCode, type AccessRule } from './access-rules';
import { AccessRefusalKind, type AccessRefusal } from './decision';

/** `details.reason` of the row of a retired device (RB-6). */
export const RETIRED_DEVICE_REASON = ApiErrorCode.DEVICE_REVOKED;

const NOT_PERMITTED_TEXT = 'Your role does not allow this action. The attempt was audited.';
const EXPORT_FORBIDDEN_TEXT = 'Your role cannot export evidence (RBAC). The attempt was audited.';
const DEVICE_CREDENTIAL_TEXT = 'This operation needs the credential of a paired device.';
const DEVICE_ONLY_TEXT = 'This operation is available on a paired device only.';
/** The text of the contract's example for this refusal (`ERROR_EXAMPLES.deviceCredentialRequired`). */
const OWN_CREDENTIAL_TEXT = "This operation needs the device's own credential.";
const DEMO_DISABLED_TEXT = 'Demo controls are not enabled on this server.';

/** The answer of a refusal. Every text is fixed: none repeats anything the caller sent. */
export function refusalAnswer(rule: AccessRule, refusal: AccessRefusal): ApiFailure {
  switch (refusal.kind) {
    case AccessRefusalKind.NOT_SIGNED_IN:
      return refusal.needs === 'DEVICE' ? new ApiFailure(401, ApiErrorCode.NOT_SIGNED_IN, DEVICE_CREDENTIAL_TEXT) : notSignedIn();
    case AccessRefusalKind.DEVICE_REVOKED:
      return deviceRevoked();
    case AccessRefusalKind.NOT_PERMITTED:
      return new ApiFailure(
        403,
        refusal.denial.errorCode,
        refusal.denial.errorCode === ApiErrorCode.FORBIDDEN ? EXPORT_FORBIDDEN_TEXT : NOT_PERMITTED_TEXT,
        {
          details: {
            operationId: rule.operationId,
            permission: refusal.denial.permission,
            role: refusal.role,
            // C3 §5.3: the condition of the rule that refused (SESSION_HOLDER), when not the permission.
            ...(refusal.reason === undefined ? {} : { reason: refusal.reason }),
          },
        },
      );
    case AccessRefusalKind.DEVICE_NOT_PAIRED:
      if (refusal.cause === CoreApiAccessCondition.CONSOLE_IDENTITY) return deviceNotPaired();
      if (refusal.cause === CoreApiAccessCondition.DEVICE_CREDENTIAL) {
        return new ApiFailure(403, ApiErrorCode.DEVICE_NOT_PAIRED, OWN_CREDENTIAL_TEXT, { details: { reason: DEVICE_CREDENTIAL_REQUIRED_REASON } });
      }
      return new ApiFailure(403, ApiErrorCode.DEVICE_NOT_PAIRED, DEVICE_ONLY_TEXT);
    case AccessRefusalKind.DEMO_DISABLED:
      return new ApiFailure(403, ApiErrorCode.DEMO_DISABLED, DEMO_DISABLED_TEXT);
  }
}

/** What an audited refusal writes in its unit of work. */
export interface DenialRecord {
  readonly audit: AuditEntry;
  /** Only the three exports have one (RB-5): the simulator's event beside its row. */
  readonly event: EventEntry | null;
}

/** "lacks A", or "holds none of A, B" for the any-of. */
function lacking(permission: string): string {
  const permissions = permissionsOfDenialCode(permission);
  return permissions.length === 1 ? `lacks ${permission}` : `holds none of ${permissions.join(', ')}`;
}

/**
 * The row (and for an export the event) of an audited refusal; null for a refusal that writes
 * none. `pathId` is the `{id}` of the request path when it matches the registry's pattern for
 * that operation, else null.
 */
export function denialRecordOf(rule: AccessRule, refusal: AccessRefusal, pathId: string | null): DenialRecord | null {
  if (refusal.kind === AccessRefusalKind.DEVICE_REVOKED) {
    return {
      audit: {
        type: AuditType.ACCESS_DENIED,
        severity: Severity.WARNING,
        message: `Access denied: device ${refusal.deviceId} is no longer paired (${rule.operationId})`,
        actorId: null,
        deviceId: refusal.deviceId,
        details: { operationId: rule.operationId, reason: RETIRED_DEVICE_REASON },
      },
      event: null,
    };
  }
  if (refusal.kind !== AccessRefusalKind.NOT_PERMITTED) return null;

  const { denial, role, operatorId, deviceId } = refusal;
  // C3 §5.1: a camera-credential-style refusal audits the FACT with `details.reason` only. The
  // SESSION_HOLDER refusal (C3 §5.3) names the condition as reason; the permission and role stay
  // in the row because the rule's permission was held — the CONDITION refused, not the permission.
  const named = { operationId: rule.operationId, permission: denial.permission, role };

  if (denial.export === null) {
    return {
      audit: {
        type: AuditType.ACCESS_DENIED,
        severity: Severity.WARNING,
        message:
          refusal.reason === undefined
            ? `Access denied: role ${role} ${lacking(denial.permission)} (${rule.operationId})`
            : `Access denied: the ${refusal.reason} condition does not hold (${rule.operationId})`,
        actorId: operatorId,
        deviceId,
        details: refusal.reason === undefined ? named : { ...named, reason: refusal.reason },
      },
      event: null,
    };
  }

  // RB-5: the simulator's row and event, with the three names of RB-4 added to the details.
  const { scope, label } = denial.export;
  if (scope === null) {
    return {
      audit: {
        type: AuditType.EXPORT_DENIED,
        severity: Severity.WARNING,
        message: `${label} of ${pathId ?? 'an evidence package'} denied: role ${role} ${lacking(denial.permission)}`,
        actorId: operatorId,
        deviceId,
        evidenceId: pathId,
        details: { ...named, eventKind: AuditEventKind.UNAUTHORIZED_EXPORT },
      },
      event: {
        type: SimEventType.EXPORT_DENIED,
        severity: Severity.WARNING,
        message: pathId === null ? `${label} denied` : `${label} denied · ${pathId}`,
        params: pathId === null ? { role } : { evidenceId: pathId, role },
        deviceId,
      },
    };
  }
  return {
    audit: {
      type: AuditType.EXPORT_DENIED,
      severity: Severity.WARNING,
      message: `${label} denied: role ${role} ${lacking(denial.permission)}`,
      actorId: operatorId,
      deviceId,
      details: { ...named, scope, eventKind: AuditEventKind.UNAUTHORIZED_EXPORT },
    },
    event: {
      type: SimEventType.EXPORT_DENIED,
      severity: Severity.WARNING,
      message: `${label} denied`,
      params: { role, scope },
      deviceId,
    },
  };
}
