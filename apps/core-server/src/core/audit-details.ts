/**
 * The allow-list of audit details for the nine server-written types (plan row W21; spec §13.1,
 * §4.6 RB-4 and RB-6, §6.2, §6.3; SR-54).
 *
 * The nine types of the backend task are written by server-native modules only (the permission
 * guard, pairing, user administration, identity). The specification names the details of each
 * one. For these types the audit writer accepts EXACTLY those keys, with the value form given
 * here, and refuses everything else before a statement is sent. So a module cannot put a code,
 * a token, a credential or a typed username into such a row by adding a key: no such key
 * exists.
 *
 * The other 44 types are the simulator's. Their details are whatever the shared code writes
 * (54 distinct key names); they get the general rules of `payload-rules.ts` and no list, so
 * the Live audit sequence stays equal to the simulator's (spec §13.2).
 *
 * "Device ID" in the specification's table is the row's own `deviceId`. A module may repeat it
 * in the details as `deviceId`; the list allows that for the three types that name a device.
 */
import { DEVICE_ID_PATTERN, OPERATOR_ID_PATTERN, PAIRING_CODE_ID_PATTERN } from '@dems/shared/api';
import { AuditType, OperatorRole, type DetailValue } from '@dems/shared/sim';
import { NATIVE_TEXT_MAX_LENGTH } from './limits';

export interface DetailRule {
  /** Without a `?` in the specification's table. */
  readonly required: boolean;
  /** The form of the value, in words, for the refusal message. */
  readonly form: string;
  accepts(value: DetailValue): boolean;
}

const ROLES: ReadonlySet<string> = new Set(Object.values(OperatorRole));
/** How a pairing code can close (spec §6.2 T3 to T5). */
export const PAIRING_CODE_CLOSE_REASONS = ['CANCELLED', 'EXPIRED', 'EXHAUSTED'] as const;
const CLOSE_REASONS: ReadonlySet<string> = new Set(PAIRING_CODE_CLOSE_REASONS);

const matching = (pattern: RegExp, form: string) => (required: boolean): DetailRule => ({
  required,
  form,
  accepts: (value) => typeof value === 'string' && pattern.test(value),
});

const operationId = matching(/^[a-z][A-Za-z0-9]{0,63}$/, 'an operation ID of the contract registry');
const code = matching(/^[A-Z][A-Z0-9_]{0,63}$/, 'a SCREAMING_SNAKE_CASE code');
const operatorId = matching(OPERATOR_ID_PATTERN, 'an operator ID');
const deviceId = matching(DEVICE_ID_PATTERN, 'a registry device ID');
const pairingCodeId = matching(PAIRING_CODE_ID_PATTERN, 'a pairing code ID (never the code)');

const role = (required: boolean): DetailRule => ({
  required,
  form: 'a role',
  accepts: (value) => typeof value === 'string' && ROLES.has(value),
});
const closeReason = (required: boolean): DetailRule => ({
  required,
  form: `one of ${PAIRING_CODE_CLOSE_REASONS.join(', ')}`,
  accepts: (value) => typeof value === 'string' && CLOSE_REASONS.has(value),
});
/** A reason an operator typed. Free text: the general rules still refuse a credential form. */
const reasonText = (required: boolean): DetailRule => ({
  required,
  form: `a text of 1 to ${NATIVE_TEXT_MAX_LENGTH} characters`,
  accepts: (value) => typeof value === 'string' && value.length >= 1 && value.length <= NATIVE_TEXT_MAX_LENGTH,
});
const count = (required: boolean): DetailRule => ({
  required,
  form: 'a whole number of 0 or more',
  accepts: (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0,
});
const flag = (required: boolean): DetailRule => ({
  required,
  form: 'true or false',
  accepts: (value) => typeof value === 'boolean',
});

const REQUIRED = true;
const OPTIONAL = false;

/**
 * Type, then key, then rule. The keys are those of spec §13.1; `reason` of `ACCESS_DENIED` is a
 * code such as `DEVICE_REVOKED` (RB-6), every other `reason` is what an operator typed, except
 * the close reason of a pairing code, which is one of three values.
 */
export const SERVER_AUDIT_DETAIL_RULES = {
  [AuditType.ACCESS_DENIED]: {
    operationId: operationId(REQUIRED),
    permission: code(OPTIONAL),
    role: role(OPTIONAL),
    reason: code(OPTIONAL),
  },
  [AuditType.PAIRING_CODE_ISSUED]: {
    codeId: pairingCodeId(REQUIRED),
    expiresAt: count(REQUIRED),
  },
  [AuditType.PAIRING_CODE_CLOSED]: {
    codeId: pairingCodeId(REQUIRED),
    reason: closeReason(REQUIRED),
  },
  [AuditType.DEVICE_REVOKED]: {
    reason: reasonText(REQUIRED),
    sessionsEnded: count(REQUIRED),
    deviceId: deviceId(OPTIONAL),
  },
  [AuditType.DEVICE_CREDENTIAL_ROTATED]: {
    deviceId: deviceId(OPTIONAL),
  },
  [AuditType.ROLE_CHANGED]: {
    targetOperatorId: operatorId(REQUIRED),
    from: role(REQUIRED),
    to: role(REQUIRED),
    reason: reasonText(OPTIONAL),
  },
  [AuditType.USER_ENABLED]: {
    targetOperatorId: operatorId(REQUIRED),
    reason: reasonText(OPTIONAL),
  },
  [AuditType.USER_DISABLED]: {
    targetOperatorId: operatorId(REQUIRED),
    sessionsEnded: count(REQUIRED),
    reason: reasonText(OPTIONAL),
  },
  [AuditType.BIOMETRIC_ENROLLMENT_CHANGED]: {
    enabled: flag(REQUIRED),
    deviceId: deviceId(OPTIONAL),
  },
} as const satisfies Partial<Record<AuditType, Readonly<Record<string, DetailRule>>>>;

/** The nine types that have a list. */
export type ServerAuditType = keyof typeof SERVER_AUDIT_DETAIL_RULES;

/** The list of `type`, or undefined for one of the simulator's 44 types. */
export function detailRulesOf(type: AuditType): Readonly<Record<string, DetailRule>> | undefined {
  return (SERVER_AUDIT_DETAIL_RULES as Partial<Record<AuditType, Readonly<Record<string, DetailRule>>>>)[type];
}
