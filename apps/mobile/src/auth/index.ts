/**
 * Mobile auth (step 73; 04_mobile_specs §6): the `AuthProvider` over the Core's auth, the
 * biometric service (§6.3, T-M05), the idle lock and the `dems.mobile.auth.v1` preferences.
 * The contract hooks (`useAuth`, …) stay in `@/runtime`; `useAuthSession` adds what Login,
 * Settings and the avatar menu need beyond the contract.
 *
 * Backend task W56: in LIVE mode the Core is the Core server (`./live-auth-provider.tsx`): a
 * session on a paired tablet, a server-driven idle expiry, a single-use biometric token. The
 * screens read the same `useAuthSession()`; what LIVE adds to it is `notice` (the Alerts of the
 * Login screen, drawn by `AuthNoticeAlert`), `signInFailure` (a limit, an outage, a refusal of the
 * last attempt) and two members of `biometric` (`protected`, `changeBlocked`). The storage of the
 * token (`./live-biometric.ts`) is loaded by a debug build only and is not exported here.
 */
export { AuthProvider, type AuthProviderProps } from './auth-provider';
export {
  ACTIVITY_THROTTLE_MS,
  isSignInBlocked,
  lockoutInfoOf,
  toContractSignInResult,
  useAuthSession,
  type AuthLockoutInfo,
  type AuthSession,
  type BiometricInfo,
  type BiometricOperator,
} from './auth-session';
export { BiometricOfferDialog, IdleLockDialog, type BiometricOfferDialogProps, type IdleLockDialogProps } from './auth-dialogs';
export { AuthNoticeAlert, type AuthNoticeAlertProps } from './auth-notice';
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
  fromFailure,
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
export { authEn } from './i18n';
export {
  authNotice,
  biometricPromptPlan,
  biometricTokenFate,
  errorOfCallFailure,
  expiryOf,
  noticeOfSessionEnd,
  rejectedSignIn,
  signOutReasonOf,
  type AuthNotice,
  type AuthNoticeKind,
  type BiometricPromptPlan,
  type BiometricTokenFate,
  type SignInRejection,
} from './live-auth-model';
export { findAuthOperator, toAuthOperator } from './operators';
