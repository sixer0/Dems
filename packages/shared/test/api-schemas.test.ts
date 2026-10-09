// Backend task 2026-10-04, plan row W19 (contract A): the schemas of areas 1, 2, 3 and 13
// (01_specs §7.18). They restate shapes of the simulator where the Live source maps an answer
// straight into a slice, so the compile-time proofs below hold the two together.
import { describe, expect, it } from 'vitest';
import {
  ADMIN_REASON_MAX_LENGTH,
  ActivePairingCodeSchema,
  AdminUserSchema,
  AuthSessionInfoSchema,
  BiometricEnrollmentRequestSchema,
  BiometricEnrollmentSchema,
  BiometricFailureRequestSchema,
  BiometricSignInRequestSchema,
  CORE_API_EXAMPLES,
  DEVICE_ID_PATTERN,
  DemoFaultRequestSchema,
  DemoStatusSchema,
  DeviceRevokeRequestSchema,
  PAIRING_CODE_ID_PATTERN,
  PAIRING_INPUT_LIMITS,
  PairedDeviceSchema,
  PairedDeviceState,
  PairingCodeIssuedSchema,
  PairingRedeemRequestSchema,
  PairingRedeemedSchema,
  RoleMatrixSchema,
  ScenarioLoadRequestSchema,
  SignInResponseSchema,
  SignInStatusSchema,
  SignOutRequestSchema,
  UserRoleRequestSchema,
  UserStatusRequestSchema,
  type AuthSessionInfo,
  type DemoStatus,
  type FaultTargetBody,
  type OperatorBody,
  type PairedDevice,
  type SignInStatus,
} from '../src/api';
import { EXAMPLE_PLACEHOLDERS } from '../src/api/example-parts';
import {
  FaultKind,
  ScenarioName,
  type AuthMethod,
  type EpochMs,
  type FaultTarget,
  type FaultsSlice,
  type LockoutStatus,
  type Permission,
  type SimOperator,
} from '../src/sim';

// ── Compile-time proofs: the schema output is the simulator's type ───────────────────────────────
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const operatorIsSimOperator: Exact<OperatorBody, SimOperator> = true;
const statusIsLockoutStatus: Exact<SignInStatus, LockoutStatus & { serverTime: EpochMs }> = true;
const targetIsFaultTarget: Exact<FaultTargetBody, FaultTarget> = true;
const faultsAreTheSlice: Exact<DemoStatus['activeFaults'], FaultsSlice['active']> = true;
const permissionsAreTheVocabulary: Exact<AuthSessionInfo['permissions'][number], Permission> = true;
// A Live session is created by password or by the biometric token, never by the simulated security key.
const methodIsLive: Exact<AuthSessionInfo['method'], Exclude<AuthMethod, 'SECURITY_KEY'>> = true;
void [operatorIsSimOperator, statusIsLockoutStatus, targetIsFaultTarget, faultsAreTheSlice, permissionsAreTheVocabulary, methodIsLive];

function example<T>(operationId: string, status: number): T {
  const first = Object.values(CORE_API_EXAMPLES[operationId]?.responses[status] ?? {})[0];
  if (!first) throw new Error(`no example for ${operationId} ${status}`);
  return structuredClone(first.value) as T;
}

describe('area 1: identity', () => {
  it('AuthSessionInfo: epoch milliseconds, a device ID or null, no security-key method', () => {
    const session = example<AuthSessionInfo>('getAuthSession', 200);
    expect(AuthSessionInfoSchema.parse(session)).toEqual(session);
    expect(AuthSessionInfoSchema.safeParse({ ...session, deviceId: 'DEV-0001' }).success).toBe(true);
    for (const bad of [
      { ...session, method: 'SECURITY_KEY' },
      { ...session, deviceId: 'DEMS-IR-01' },
      { ...session, issuedAt: '2026-10-01T10:00:00.000+07:00' },
      { ...session, issuedAt: -1 },
      { ...session, permissions: ['ROOT'] },
      { ...session, operator: { ...session.operator, id: 'andi.pratama' } },
      { ...session, demoControls: 'yes' },
    ]) {
      expect(AuthSessionInfoSchema.safeParse(bad).success, JSON.stringify(bad).slice(0, 80)).toBe(false);
    }
  });

  it('SignInResponse: a web answer has no token; a token has its prefix and 43 url-safe characters', () => {
    const session = example<AuthSessionInfo>('getAuthSession', 200);
    expect(Object.keys(SignInResponseSchema.parse({ session }))).toEqual(['session']);
    expect(SignInResponseSchema.safeParse({ session, sessionToken: EXAMPLE_PLACEHOLDERS.sessionToken }).success).toBe(true);
    for (const sessionToken of ['ses_short', EXAMPLE_PLACEHOLDERS.deviceCredential, `${EXAMPLE_PLACEHOLDERS.sessionToken}=`, 'token']) {
      expect(SignInResponseSchema.safeParse({ session, sessionToken }).success, sessionToken).toBe(false);
    }
    expect(SignInResponseSchema.safeParse({ session, biometricToken: EXAMPLE_PLACEHOLDERS.sessionToken }).success).toBe(false);
  });

  it('SignInStatus, the sign-out body and the biometric bodies', () => {
    expect(SignInStatusSchema.safeParse({ locked: false, lockedUntil: null, retryInMs: 0, attemptsRemaining: 5, serverTime: 1 }).success).toBe(true);
    expect(SignInStatusSchema.safeParse({ locked: false, lockedUntil: null, retryInMs: 0, attemptsRemaining: -1, serverTime: 1 }).success).toBe(false);
    expect(SignOutRequestSchema.parse({})).toEqual({});
    expect(SignOutRequestSchema.parse({ reason: 'LOCK' })).toEqual({ reason: 'LOCK' });
    expect(SignOutRequestSchema.safeParse({ reason: 'IDLE' }).success).toBe(false);
    expect(BiometricEnrollmentRequestSchema.safeParse({ enabled: 'true' }).success).toBe(false);
    expect(BiometricEnrollmentSchema.parse({ enabled: false })).toEqual({ enabled: false });
    expect(BiometricEnrollmentSchema.safeParse({ enabled: true, token: 'bio_x' }).success).toBe(false);
    // The request takes any non-empty text: every value that is sent is an attempt the server counts.
    expect(BiometricSignInRequestSchema.safeParse({ token: 'anything a caller sends' }).success).toBe(true);
    expect(BiometricSignInRequestSchema.safeParse({ token: '' }).success).toBe(false);
    expect(BiometricSignInRequestSchema.safeParse({ token: 'x'.repeat(257) }).success).toBe(false);
    expect(BiometricFailureRequestSchema.parse({ operatorId: null })).toEqual({ operatorId: null });
    expect(BiometricFailureRequestSchema.safeParse({ operatorId: 'budi.santoso' }).success).toBe(false);
    expect(BiometricFailureRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('area 2: administration', () => {
  it('RoleMatrix is read-only: `editable` is false and nothing else', () => {
    const matrix = { roles: ['SUPERVISOR'], permissions: ['USER_ADMIN'], grants: [{ role: 'SUPERVISOR', permission: 'USER_ADMIN' }], editable: false };
    expect(RoleMatrixSchema.safeParse(matrix).success).toBe(true);
    expect(RoleMatrixSchema.safeParse({ ...matrix, editable: true }).success).toBe(false);
    expect(RoleMatrixSchema.safeParse({ ...matrix, grants: [{ role: 'ADMIN', permission: 'USER_ADMIN' }] }).success).toBe(false);
  });

  it('AdminUser is an operator plus the administration members; the reason is optional, trimmed and bounded', () => {
    const user = example<{ users: unknown[] }>('listUsers', 200).users[0];
    expect(AdminUserSchema.parse(user)).toEqual(user);
    expect(AdminUserSchema.safeParse({ ...(user as object), enabled: undefined }).success).toBe(false);
    expect(UserRoleRequestSchema.parse({ role: 'TECHNICIAN', reason: '  shift change  ' })).toEqual({ role: 'TECHNICIAN', reason: 'shift change' });
    expect(UserRoleRequestSchema.parse({ role: 'TECHNICIAN' })).toEqual({ role: 'TECHNICIAN' });
    expect(UserRoleRequestSchema.safeParse({ role: 'ADMIN' }).success).toBe(false);
    expect(UserRoleRequestSchema.safeParse({ reason: 'no role' }).success).toBe(false);
    expect(UserStatusRequestSchema.parse({})).toEqual({});
    expect(UserStatusRequestSchema.safeParse({ reason: 'r'.repeat(ADMIN_REASON_MAX_LENGTH) }).success).toBe(true);
    expect(UserStatusRequestSchema.safeParse({ reason: 'r'.repeat(ADMIN_REASON_MAX_LENGTH + 1) }).success).toBe(false);
  });
});

describe('area 3: pairing and the device registry', () => {
  it('the identifiers: a device is DEV-NNNN, a code record PCD-NNNNNN, a code six digits', () => {
    for (const id of ['DEV-0001', 'DEV-12345']) expect(id).toMatch(DEVICE_ID_PATTERN);
    for (const id of ['DEV-001', 'dev-0001', 'DEV-0001 ', 'DEMS-IR-01']) expect(id).not.toMatch(DEVICE_ID_PATTERN);
    for (const id of ['PCD-000001', 'PCD-1234567']) expect(id).toMatch(PAIRING_CODE_ID_PATTERN);
    expect('PCD-00001').not.toMatch(PAIRING_CODE_ID_PATTERN);
    const redeem = { code: '000000', deviceName: 'Interview tablet 01', platform: 'android', appVersion: '0.2.0' };
    for (const code of ['00000', '0000000', '12345a', ' 123456', '']) {
      expect(PairingRedeemRequestSchema.safeParse({ ...redeem, code }).success, JSON.stringify(code)).toBe(false);
    }
  });

  it('PairingRedeemRequest: the device name is trimmed, 1 to 60 characters; platform and version 1 to 32', () => {
    const redeem = { code: '000000', deviceName: '  Interview tablet 01 ', platform: 'android', appVersion: '0.2.0' };
    expect(PairingRedeemRequestSchema.parse(redeem).deviceName).toBe('Interview tablet 01');
    const max = PAIRING_INPUT_LIMITS;
    expect(PairingRedeemRequestSchema.safeParse({ ...redeem, deviceName: 'n'.repeat(max.deviceNameMax) }).success).toBe(true);
    expect(PairingRedeemRequestSchema.safeParse({ ...redeem, deviceName: 'n'.repeat(max.deviceNameMax + 1) }).success).toBe(false);
    expect(PairingRedeemRequestSchema.safeParse({ ...redeem, deviceName: '   ' }).success).toBe(false);
    expect(PairingRedeemRequestSchema.safeParse({ ...redeem, platform: 'p'.repeat(max.platformMax + 1) }).success).toBe(false);
    expect(PairingRedeemRequestSchema.safeParse({ ...redeem, appVersion: '' }).success).toBe(false);
    // Unknown members are dropped (API-4).
    expect(PairingRedeemRequestSchema.parse({ ...redeem, hardwareId: 'abc' })).not.toHaveProperty('hardwareId');
  });

  it('the answers that hold a secret state its form: the code, the QR payload, the device credential', () => {
    const issued = example<Record<string, unknown>>('issuePairingCode', 201);
    expect(PairingCodeIssuedSchema.parse(issued)).toEqual(issued);
    expect(PairingCodeIssuedSchema.safeParse({ ...issued, qrPayload: 'https://example.invalid/pair?code=000000' }).success).toBe(false);
    expect(PairingCodeIssuedSchema.safeParse({ ...issued, attemptsAllowed: 0 }).success).toBe(false);
    const paired = example<Record<string, unknown>>('redeemPairingCode', 201);
    expect(PairingRedeemedSchema.parse(paired)).toEqual(paired);
    expect(PairingRedeemedSchema.safeParse({ ...paired, deviceCredential: EXAMPLE_PLACEHOLDERS.sessionToken }).success).toBe(false);
    // What an operator may read of a code never includes the code.
    const active = example<{ active: Record<string, unknown> }>('getPairingCodeStatus', 200);
    expect(Object.keys(active.active)).toEqual(['codeId', 'issuedBy', 'issuedAt', 'expiresAt', 'attemptsRemaining']);
    expect(ActivePairingCodeSchema.parse({ active: { ...active.active, code: '000000' } }).active).not.toHaveProperty('code');
    expect(ActivePairingCodeSchema.parse({ active: null })).toEqual({ active: null });
  });

  it('PairedDevice: three states, the registry fields of 01_specs §6.5, never a credential', () => {
    const device = example<{ devices: PairedDevice[] }>('listPairedDevices', 200).devices[0]!;
    expect(Object.keys(device)).toEqual([
      'id', 'name', 'platform', 'appVersion', 'state', 'pairedAt', 'pairedWithCodeId', 'codeIssuedBy', 'lastSeenAt', 'online',
      'signedInOperatorId', 'credentialRotatedAt', 'revokedAt', 'revokedBy', 'revokeReason', 'unpairedAt',
    ]);
    expect(PairedDeviceSchema.parse(device)).toEqual(device);
    expect(Object.values(PairedDeviceState)).toEqual(['PAIRED', 'REVOKED', 'UNPAIRED']);
    expect(PairedDeviceSchema.safeParse({ ...device, state: 'FAILED' }).success).toBe(false);
    expect(PairedDeviceSchema.safeParse({ ...device, lastSeenAt: null }).success).toBe(false);
    // Changed by design (W83, finding W52-F2; decision D184 DQ-3): the answer is strict, so a member it
    // does not have, a credential above all, is refused instead of dropped.
    expect(PairedDeviceSchema.safeParse({ ...device, deviceCredential: EXAMPLE_PLACEHOLDERS.deviceCredential }).success).toBe(false);
  });

  it('DeviceRevokeRequest: a reason of 5 to 500 characters after trimming', () => {
    expect(DeviceRevokeRequestSchema.safeParse({ reason: 'Lost' }).success).toBe(false);
    expect(DeviceRevokeRequestSchema.safeParse({ reason: '  Lost  ' }).success).toBe(false);
    expect(DeviceRevokeRequestSchema.safeParse({ reason: 'Lost!' }).success).toBe(true);
    expect(DeviceRevokeRequestSchema.safeParse({ reason: 'r'.repeat(PAIRING_INPUT_LIMITS.revokeReasonMax + 1) }).success).toBe(false);
    expect(DeviceRevokeRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('area 13: demo controls', () => {
  it('a scenario name and a fault kind are the shared ones', () => {
    for (const name of Object.values(ScenarioName)) expect(ScenarioLoadRequestSchema.safeParse({ name }).success, name).toBe(true);
    expect(ScenarioLoadRequestSchema.safeParse({ name: 'chaos' }).success).toBe(false);
    for (const kind of Object.values(FaultKind)) expect(DemoFaultRequestSchema.safeParse({ kind }).success, kind).toBe(true);
    expect(Object.values(FaultKind)).toHaveLength(14);
    expect(DemoFaultRequestSchema.safeParse({ kind: 'METEOR' }).success).toBe(false);
  });

  it('a fault target has the members of the simulator\'s FaultTarget', () => {
    const target = { channel: 'AUDIO-02', cameraId: 'VIDEO-01', auditIndex: 3, fallback: 'RTC', evidenceId: 'EV-20260930-0004', trackId: 'AUDIO-02' };
    expect(DemoFaultRequestSchema.parse({ kind: 'TAMPER', target })).toEqual({ kind: 'TAMPER', target });
    for (const bad of [{ channel: 'VIDEO-01' }, { cameraId: 'AUDIO-01' }, { auditIndex: -1 }, { fallback: 'GNSS' }, { evidenceId: 'EV-1' }, { trackId: 'MIC-01' }]) {
      expect(DemoFaultRequestSchema.safeParse({ kind: 'TAMPER', target: bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('DemoStatus: the epoch is an integer that never goes below zero', () => {
    const status = example<DemoStatus>('getDemoStatus', 200);
    expect(DemoStatusSchema.parse(status)).toEqual(status);
    expect(status.scenarios).toEqual(Object.values(ScenarioName));
    expect(DemoStatusSchema.safeParse({ ...status, epoch: 1.5 }).success).toBe(false);
    expect(DemoStatusSchema.safeParse({ ...status, epoch: -1 }).success).toBe(false);
    expect(DemoStatusSchema.safeParse({ ...status, epoch: '1' }).success).toBe(false);
  });
});
