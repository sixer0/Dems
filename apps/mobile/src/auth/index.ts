/**
 * Mobile auth (step 73; 04_mobile_specs §6): the `AuthProvider` over the simulator's auth, the
 * biometric service (§6.3, T-M05), the idle lock and the `dems.mobile.auth.v1` preferences.
 * The contract hooks (`useAuth`, …) stay in `@/runtime`; `useAuthSession` adds what Login,
 * Settings and the avatar menu need beyond the contract.
 */
export {
  ACTIVITY_THROTTLE_MS,
  AuthProvider,
  isSignInBlocked,
  lockoutInfoOf,
  toContractSignInResult,
  useAuthSession,
  type AuthLockoutInfo,
  type AuthProviderProps,
  type AuthSession,
  type BiometricInfo,
} from './auth-provider';
export { BiometricOfferDialog, IdleLockDialog, type BiometricOfferDialogProps, type IdleLockDialogProps } from './auth-dialogs';
export {
  DEFAULT_AUTH_PREFS,
  MOBILE_AUTH_KEY,
  getAuthPrefs,
  hydrateAuthPrefs,
  parseAuthPrefs,
  readAuthPrefs,
  resetAuthPrefsForTests,
  setAuthPrefs,
  useAuthPrefs,
  writeAuthPrefs,
  type AuthPrefs,
  type AuthPrefsView,
} from './auth-prefs';
export {
  applyBiometricOutcome,
  biometricPromptOptions,
  biometricSignIn,
  getBiometricAvailability,
  promptBiometric,
  promptOutcomeFor,
  type BiometricApi,
  type BiometricAvailability,
  type BiometricPromptOutcome,
  type BiometricPromptText,
  type BiometricSignInOptions,
  type BiometricSignInResult,
  type BiometricSimAuth,
} from './biometric';
export { findAuthOperator, toAuthOperator } from './operators';
