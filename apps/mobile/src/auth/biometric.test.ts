// T-M05 (04_mobile_specs §6.3, §10.1; MA-07 unit part): the biometric sign-in branches — success,
// user_cancel, lockout, not_enrolled, authentication_failed — against the expo-local-authentication
// jest mock (jest.setup.ts) and the real simulator auth (audit rows, §6.1 lockout).
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as LocalAuthentication from 'expo-local-authentication';
import type { LocalAuthenticationError } from 'expo-local-authentication';
import type { Sim } from '@dems/shared/sim';
import { createTestSim } from '@/runtime/testing/test-sim';
import {
  applyBiometricOutcome,
  biometricPromptOptions,
  biometricSignIn,
  getBiometricAvailability,
  promptOutcomeFor,
  type BiometricPromptText,
} from './biometric';

const TEXT: BiometricPromptText = {
  promptMessage: 'Sign in to DEMS',
  promptSubtitle: 'AKP Budi Santoso',
  cancelLabel: 'Use password',
};

const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);
const hasHardware = jest.mocked(LocalAuthentication.hasHardwareAsync);
const isEnrolled = jest.mocked(LocalAuthentication.isEnrolledAsync);

function newSim(): Sim {
  return createTestSim().sim;
}
const auditTotal = (sim: Sim) => sim.store.getState().audit.total;
const lastAudit = (sim: Sim) => sim.store.getState().audit.rows.at(-1)!;
const failWith = (error: LocalAuthenticationError) => authenticate.mockResolvedValueOnce({ success: false, error });

beforeEach(() => {
  authenticate.mockClear();
  hasHardware.mockClear();
  isEnrolled.mockClear();
});

describe('T-M05 biometric branches', () => {
  it('success → signed in as the bound operator; audit AUTH_SUCCESS with method BIOMETRIC', async () => {
    const sim = newSim();
    const result = await biometricSignIn({ operatorId: 'OPR-001', text: TEXT, auth: sim.actions });
    expect(result).toEqual({ kind: 'signed-in', operatorId: 'OPR-001' });
    expect(sim.store.getState().auth).toMatchObject({ status: 'SIGNED_IN', operatorId: 'OPR-001', method: 'BIOMETRIC' });
    expect(lastAudit(sim)).toMatchObject({ type: 'AUTH_SUCCESS', actorId: 'OPR-001', details: { method: 'BIOMETRIC' } });
    // §6.3 prompt options, exactly.
    expect(authenticate).toHaveBeenCalledWith({
      promptMessage: 'Sign in to DEMS',
      promptSubtitle: 'AKP Budi Santoso',
      cancelLabel: 'Use password',
      disableDeviceFallback: true,
      biometricsSecurityLevel: 'strong',
    });
  });

  it('user_cancel → stay on Login; no audit row, still signed out', async () => {
    const sim = newSim();
    const before = auditTotal(sim);
    failWith('user_cancel');
    await expect(biometricSignIn({ operatorId: 'OPR-001', text: TEXT, auth: sim.actions })).resolves.toEqual({ kind: 'cancelled' });
    expect(auditTotal(sim)).toBe(before);
    expect(sim.store.getState().auth.status).toBe('SIGNED_OUT');
  });

  it('lockout → the "Biometrics locked — use your password" alert; no audit row', async () => {
    const sim = newSim();
    const before = auditTotal(sim);
    failWith('lockout');
    await expect(biometricSignIn({ operatorId: 'OPR-001', text: TEXT, auth: sim.actions })).resolves.toEqual({ kind: 'lockout' });
    expect(auditTotal(sim)).toBe(before);
  });

  it('not_enrolled → the caption, whether the device says so up front or the prompt does', async () => {
    const sim = newSim();
    isEnrolled.mockResolvedValueOnce(false);
    await expect(biometricSignIn({ operatorId: 'OPR-001', text: TEXT, auth: sim.actions })).resolves.toEqual({ kind: 'not-enrolled' });
    expect(authenticate).not.toHaveBeenCalled();

    failWith('not_enrolled');
    await expect(biometricSignIn({ operatorId: 'OPR-001', text: TEXT, auth: sim.actions })).resolves.toEqual({ kind: 'not-enrolled' });
    failWith('passcode_not_set');
    await expect(biometricSignIn({ operatorId: 'OPR-001', text: TEXT, auth: sim.actions })).resolves.toEqual({ kind: 'not-enrolled' });
    expect(sim.store.getState().auth.status).toBe('SIGNED_OUT');
  });

  it('authentication_failed → one failure toward the §6.1 lockout; the fifth locks the console', async () => {
    const sim = newSim();
    failWith('authentication_failed');
    await expect(biometricSignIn({ operatorId: 'OPR-001', text: TEXT, auth: sim.actions })).resolves.toEqual({
      kind: 'failed',
      attemptsRemaining: 4,
    });
    expect(lastAudit(sim)).toMatchObject({ type: 'AUTH_FAILED', details: { method: 'BIOMETRIC', attemptsRemaining: 4 } });

    for (let i = 0; i < 3; i += 1) {
      failWith('authentication_failed');
      await biometricSignIn({ operatorId: 'OPR-001', text: TEXT, auth: sim.actions });
    }
    failWith('authentication_failed');
    const fifth = await biometricSignIn({ operatorId: 'OPR-001', text: TEXT, auth: sim.actions });
    expect(fifth).toMatchObject({ kind: 'locked' });
    // Even a good fingerprint is refused during the lockout (AUTH_LOCKED).
    const during = await biometricSignIn({ operatorId: 'OPR-001', text: TEXT, auth: sim.actions });
    expect(during).toMatchObject({ kind: 'locked' });
    expect(lastAudit(sim).type).toBe('AUTH_LOCKED');
    expect(sim.store.getState().auth.status).toBe('SIGNED_OUT');
  });

  it('no hardware → the button is hidden (unavailable); no prompt', async () => {
    const sim = newSim();
    hasHardware.mockResolvedValueOnce(false);
    await expect(biometricSignIn({ operatorId: 'OPR-001', text: TEXT, auth: sim.actions })).resolves.toEqual({ kind: 'unavailable' });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('a thrown OS error is contained (error), and so is a failing availability query (unavailable)', async () => {
    const sim = newSim();
    authenticate.mockRejectedValueOnce(new Error('native module crashed'));
    await expect(biometricSignIn({ operatorId: 'OPR-001', text: TEXT, auth: sim.actions })).resolves.toEqual({ kind: 'error' });
    hasHardware.mockRejectedValueOnce(new Error('no module'));
    await expect(getBiometricAvailability()).resolves.toBe('unavailable');
  });
});

describe('the §6.3 result table', () => {
  it.each<[LocalAuthenticationError | 'success', string]>([
    ['success', 'success'],
    ['user_cancel', 'cancel'],
    ['system_cancel', 'cancel'],
    ['app_cancel', 'cancel'],
    ['user_fallback', 'cancel'],
    ['lockout', 'lockout'],
    ['not_enrolled', 'not-enrolled'],
    ['passcode_not_set', 'not-enrolled'],
    ['authentication_failed', 'failed'],
    ['not_available', 'unavailable'],
    ['timeout', 'error'],
    ['unknown', 'error'],
  ])('%s → %s', (error, outcome) => {
    expect(promptOutcomeFor(error === 'success' ? { success: true } : { success: false, error })).toBe(outcome);
  });

  it('cancel and lockout never call the simulator', () => {
    const auth = { signInWithBiometric: jest.fn(), recordBiometricFailure: jest.fn() };
    applyBiometricOutcome('cancel', 'OPR-001', auth as never);
    applyBiometricOutcome('lockout', 'OPR-001', auth as never);
    applyBiometricOutcome('not-enrolled', 'OPR-001', auth as never);
    expect(auth.signInWithBiometric).not.toHaveBeenCalled();
    expect(auth.recordBiometricFailure).not.toHaveBeenCalled();
  });

  it('omits an empty subtitle', () => {
    expect(biometricPromptOptions({ promptMessage: 'm', cancelLabel: 'c' })).not.toHaveProperty('promptSubtitle');
  });
});
