// The pure parts of the throttle (plan row W23; spec §5.1 ID-P12, ID-P13; SR-24, SR-75): the
// numbers, the key of a caller and the bucket of a request. The windows by the server clock are
// the core's now (`src/core/windows.ts`), and their tests moved with them
// (`src/core/__tests__/windows.test.ts`).
import { CORE_API_OPERATIONS, HEALTH_PATH } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { ANONYMOUS_PRINCIPAL } from '../../authenticate';
import { principalReference } from '../../logger';
import { OriginCategory } from '../../origin-guard';
import { devicePrincipal, operatorPrincipal, retiredDevice } from '../../origin-guard/__tests__/guard-test-app';
import { READINESS_EXEMPT_OPERATION } from '../../readiness';
import {
  DENIAL_BUDGET_MAX,
  DENIAL_BUDGET_WINDOW_MS,
  DEVICE_SIGN_IN_OPERATIONS,
  HEALTH_OPERATION,
  THROTTLE_BUCKET_MAX,
  THROTTLE_STRICT_MAX,
  THROTTLE_WIDE_MAX,
  THROTTLE_WINDOW_MS,
  ThrottleBucket,
  ThrottleClass,
  bucketOf,
  classKeyOf,
  principalKeyOf,
} from '../limits';

describe('the numbers of ID-P12 and ID-P13', () => {
  it('are 30 and 600 per 60 s for the throttle, 20 per 60 s for the denial budget', () => {
    expect(THROTTLE_STRICT_MAX).toBe(30);
    expect(THROTTLE_WIDE_MAX).toBe(600);
    expect(THROTTLE_WINDOW_MS).toBe(60_000);
    expect(THROTTLE_BUCKET_MAX).toEqual({ STRICT: 30, WIDE: 600 });
    expect(DENIAL_BUDGET_MAX).toBe(20);
    expect(DENIAL_BUDGET_WINDOW_MS).toBe(60_000);
  });
});

describe('the key of a caller (SR-75): the resolved principal, else a fixed class', () => {
  it('an operator: all sessions of one operator share the key, on the web and on a device', () => {
    expect(principalKeyOf(operatorPrincipal('OP-0001', 'AS-0001'))).toBe('operator:OP-0001');
    expect(principalKeyOf(operatorPrincipal('OP-0001', 'AS-0002', 'DEV-0001'))).toBe('operator:OP-0001');
    expect(principalKeyOf(operatorPrincipal('OP-0002'))).toBe('operator:OP-0002');
  });

  it('a device', () => {
    expect(principalKeyOf(devicePrincipal('DEV-0001'))).toBe('device:DEV-0001');
  });

  it('no principal: no key of its own, also for a retired device credential (RB-6)', () => {
    expect(principalKeyOf(ANONYMOUS_PRINCIPAL)).toBeNull();
    expect(principalKeyOf(retiredDevice('DEV-0009'))).toBeNull();
  });

  it('is the principal reference of the request log, so a log line and a counter name the same thing', () => {
    for (const principal of [operatorPrincipal('OP-0001'), devicePrincipal('DEV-0001'), ANONYMOUS_PRINCIPAL]) {
      expect(principalKeyOf(principal)).toBe(principalReference(principal));
    }
  });

  it('the class follows the Origin category of stage 3: web console, else local', () => {
    expect(classKeyOf(OriginCategory.WEB_CONSOLE)).toBe('class:web');
    expect(classKeyOf(OriginCategory.ABSENT)).toBe('class:local');
    expect(classKeyOf(OriginCategory.OWN)).toBe('class:local');
    // Stage 3 refuses this category; it would count in the pre-authentication bucket.
    expect(classKeyOf(OriginCategory.OTHER)).toBe('class:local');
    expect(ThrottleClass).toEqual({ WEB: 'class:web', LOCAL: 'class:local' });
  });
});

describe('the bucket of a request (the table of ID-P12)', () => {
  const { STRICT, WIDE } = ThrottleBucket;

  it.each([
    ['class:web', 'signIn', STRICT],
    ['class:web', 'getSignInStatus', STRICT],
    ['class:web', 'redeemPairingCode', STRICT],
    ['class:web', undefined, STRICT],
    ['class:web', 'getServiceHealth', WIDE],
    ['class:local', 'signIn', STRICT],
    ['class:local', 'redeemPairingCode', STRICT],
    ['class:local', undefined, STRICT],
    ['class:local', 'getServiceHealth', WIDE],
    ['device:DEV-0001', 'signIn', STRICT],
    ['device:DEV-0001', 'getSignInStatus', STRICT],
    ['device:DEV-0001', 'signInWithBiometric', STRICT],
    ['device:DEV-0001', 'reportBiometricFailure', STRICT],
    ['device:DEV-0001', 'getServiceHealth', WIDE],
    ['device:DEV-0001', 'unpairDevice', WIDE],
    ['device:DEV-0001', undefined, WIDE],
    ['operator:OP-0001', 'signIn', WIDE],
    ['operator:OP-0001', 'getServiceHealth', WIDE],
    ['operator:OP-0001', 'startSession', WIDE],
    ['operator:OP-0001', undefined, WIDE],
    // An operator whose ID looks like a device key is still an operator.
    ['operator:device:1', 'signIn', WIDE],
  ] as const)('%s calling %s counts in %s', (key, operationId, bucket) => {
    expect(bucketOf(key, operationId)).toBe(bucket);
  });

  it('operations 2, 3, 8 and 9 and operation 1 are operations of the shared registry', () => {
    const registry = new Map(CORE_API_OPERATIONS.map((operation) => [operation.operationId, operation]));
    expect([...DEVICE_SIGN_IN_OPERATIONS]).toEqual(['signIn', 'getSignInStatus', 'signInWithBiometric', 'reportBiometricFailure']);
    for (const operationId of DEVICE_SIGN_IN_OPERATIONS) expect(registry.has(operationId), operationId).toBe(true);
    expect(registry.get(HEALTH_OPERATION)?.path).toBe(HEALTH_PATH);
    expect(HEALTH_OPERATION).toBe(READINESS_EXEMPT_OPERATION);
  });
});
