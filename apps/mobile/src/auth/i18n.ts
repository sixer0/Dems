import type { ResourceTree } from '@/i18n/resources';

/**
 * English copy of the auth layer in LIVE mode (backend task W56), mounted at `features.auth.*`
 * (`./i18n-bundle.ts`). Every sentence is the client specification's own
 * (04_client_integration_spec §5.6 WS-14, §6.4, §6.5, §9.3 MB-1, MB-3, MB-6a).
 *
 * MB-6a (3), AC-C-105: no sentence here says or implies that the biometric token is protected by
 * the device's hardware. A test of this folder reads every value of this tree for that.
 */
export const authEn = {
  // The Alerts of the Login screen (`useAuthSession().notice`), each one sentence, as the Login
  // screen's other notices are.
  notice: {
    // §6.5: `session.ended` with `TOKEN_REUSE`.
    tokenReuse: 'Biometric sign-in was turned off on this device because its token was used a second time. Sign in with your password.',
    // MB-3: the Core refused the stored token for good; MB-6a: the token could not be read or kept.
    biometricInvalid: 'Biometric sign-in is no longer valid on this device. Sign in with your password to enable it again.',
    // §6.4: `session.ended` with `USER_DISABLED`.
    userDisabled: 'This account was disabled by an administrator.',
    // WS-14: `session.ended` with `ABSOLUTE_EXPIRED`.
    absoluteExpired: 'Your session reached its 8-hour limit. Sign in again.',
  },
  biometric: {
    // MB-6a (3): what biometric sign-in is, in words that hold with and without the protected item.
    screenLockNote: "Biometric sign-in asks for this device's screen-lock check.",
    // MB-1: the Settings switch in a session that was created with the fingerprint.
    passwordSessionRequired: 'Sign in with your password to change biometric sign-in.',
    // The offer after a password sign-in was accepted and the tablet could not keep the token.
    enrolFailed: 'Biometric sign-in could not be turned on on this device.',
  },
} as const satisfies ResourceTree;
