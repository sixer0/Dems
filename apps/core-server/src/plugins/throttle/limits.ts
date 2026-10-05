/**
 * Keys, limits and buckets of the request throttle and the denial budget (plan row W23; spec
 * §5.1 ID-P12, ID-P13; SR-24, SR-71, SR-75). Constants and pure functions only.
 *
 * The numbers are the specification's (assumption SA-11): they are not configuration, and no
 * environment variable reaches them.
 *
 *   key                   counted at 30 per 60 s                      counted at 600 per 60 s
 *   class:web             every request and upgrade except health     getServiceHealth
 *   class:local           the same                                    getServiceHealth
 *   device:<device ID>    operations 2, 3, 8 and 9                    every other request and upgrade
 *   operator:<operator>   (none)                                      every request and upgrade
 */
import type { Principal } from '../authenticate';
import { OriginCategory } from '../origin-guard';

/** Both limits are counted over this window (ID-P12). */
export const THROTTLE_WINDOW_MS = 60_000;
/** The class buckets, and a device's sign-in entry points. */
export const THROTTLE_STRICT_MAX = 30;
/** Health for a class, and every other request of a principal. */
export const THROTTLE_WIDE_MAX = 600;

/** At most this many audited refusals per key within the window (ID-P13). */
export const DENIAL_BUDGET_MAX = 20;
export const DENIAL_BUDGET_WINDOW_MS = 60_000;

/** The two fixed classes of a request without a resolved principal. */
export const ThrottleClass = {
  /** The `Origin` is a web console origin: the POSTs and the upgrades of a signed-out console. */
  WEB: 'class:web',
  /**
   * The `Origin` is absent or one of the instance's own: the pre-authentication bucket. An
   * unpaired device, a credential that does not resolve and a retired device credential all
   * count here (RB-6).
   */
  LOCAL: 'class:local',
} as const;
export type ThrottleClass = (typeof ThrottleClass)[keyof typeof ThrottleClass];

/** Never a value the caller supplies: an ID that stage 4 resolved, or a fixed class (SR-75). */
export type ThrottleKey = `operator:${string}` | `device:${string}` | ThrottleClass;

export const ThrottleBucket = {
  STRICT: 'STRICT',
  WIDE: 'WIDE',
} as const;
export type ThrottleBucket = (typeof ThrottleBucket)[keyof typeof ThrottleBucket];

export const THROTTLE_BUCKET_MAX: Readonly<Record<ThrottleBucket, number>> = {
  STRICT: THROTTLE_STRICT_MAX,
  WIDE: THROTTLE_WIDE_MAX,
};

/** Operation 1 of the registry: counted apart for a class, and never blocked by the denial budget. */
export const HEALTH_OPERATION = 'getServiceHealth';

/** Operations 2, 3, 8 and 9 of the registry: the sign-in entry points of a paired device. */
export const DEVICE_SIGN_IN_OPERATIONS: readonly string[] = [
  'signIn',
  'getSignInStatus',
  'signInWithBiometric',
  'reportBiometricFailure',
];

/**
 * The key of a resolved principal; null for ANONYMOUS. All sessions of one operator share a
 * key, on the web and on a device. A retired device is not a principal (spec §4.1).
 */
export function principalKeyOf(principal: Principal): ThrottleKey | null {
  if (principal.kind === 'OPERATOR') return `operator:${principal.operatorId}`;
  if (principal.kind === 'DEVICE') return `device:${principal.deviceId}`;
  return null;
}

/** The class of a request without a principal, from the Origin category that stage 3 found. */
export function classKeyOf(category: OriginCategory): ThrottleClass {
  return category === OriginCategory.WEB_CONSOLE ? ThrottleClass.WEB : ThrottleClass.LOCAL;
}

function isClass(key: ThrottleKey): key is ThrottleClass {
  return key === ThrottleClass.WEB || key === ThrottleClass.LOCAL;
}

/** Which of a key's two counters a request counts in (the table at the top of this file). */
export function bucketOf(key: ThrottleKey, operationId: string | undefined): ThrottleBucket {
  if (isClass(key)) return operationId === HEALTH_OPERATION ? ThrottleBucket.WIDE : ThrottleBucket.STRICT;
  if (key.startsWith('device:') && operationId !== undefined && DEVICE_SIGN_IN_OPERATIONS.includes(operationId)) {
    return ThrottleBucket.STRICT;
  }
  return ThrottleBucket.WIDE;
}
