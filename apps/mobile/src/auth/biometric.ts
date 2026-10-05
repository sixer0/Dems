/**
 * Biometric sign-in service (04_mobile_specs §6.3; expo-local-authentication 57.0.3, VM-13; T-M05).
 *
 * Flow of the Login fingerprint button:
 * 1. `hasHardwareAsync()` false → the button is hidden (`unavailable`);
 * 2. `isEnrolledAsync()` false → disabled with the caption "Biometrics not set up on this device"
 *    (`not-enrolled`);
 * 3. `authenticateAsync({ promptMessage 'Sign in to DEMS', promptSubtitle <operator name>,
 *    cancelLabel 'Use password', disableDeviceFallback: true, biometricsSecurityLevel: 'strong' })`.
 *
 * Results (§6.3 step 3):
 * | OS result | App result | Simulator |
 * |---|---|---|
 * | success | `signed-in` | `signInWithBiometric(lastOperatorId)` → AUTH_SUCCESS, method BIOMETRIC |
 * | user_cancel, system_cancel, app_cancel, user_fallback | `cancelled` (stay) | nothing, no audit row |
 * | lockout | `lockout`: Alert "Biometrics locked — use your password" | nothing |
 * | not_enrolled, passcode_not_set | `not-enrolled`: the caption | nothing |
 * | authentication_failed | `failed` (or `locked` on the 5th) | `recordBiometricFailure` → one failure toward the §6.1 lockout |
 * | not_available | `unavailable` | nothing |
 * | anything else (timeout, unknown, …) | `error` (logged) | nothing |
 *
 * The simulator trusts the OS result: "simulated identity binding". No biometric data ever reaches
 * the app; only the OS verdict does.
 *
 * Backend task W56 (04_client_integration_spec §8.5 S1-2, S1-3): the two auth calls may answer
 * later. With the simulator they answer at once and `applyBiometricOutcome` returns its result at
 * once, as before; with a Live source (the Core server is the Core) they are promises and so is the
 * result. In LIVE mode the Core never takes the OS verdict as a sign-in: it takes a single-use
 * token (`./live-biometric.ts`), and a token it refuses for good is the result `invalid`.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import type { LocalAuthenticationOptions, LocalAuthenticationResult } from 'expo-local-authentication';
import type { SignInResult as SimSignInResult } from '@dems/shared/sim';
import { reportRuntimeIssue } from '@/runtime';

/** The expo-local-authentication calls the service uses (the module in the app, a fake in tests). */
export interface BiometricApi {
  hasHardwareAsync(): Promise<boolean>;
  isEnrolledAsync(): Promise<boolean>;
  authenticateAsync(options?: LocalAuthenticationOptions): Promise<LocalAuthenticationResult>;
}

const DEFAULT_API: BiometricApi = LocalAuthentication;

export type BiometricAvailability = 'unavailable' | 'not-enrolled' | 'available';

/** Hardware and enrolment (§6.3 steps 2.1 and 2.2). A failing query counts as unavailable (logged). */
export async function getBiometricAvailability(api: BiometricApi = DEFAULT_API): Promise<BiometricAvailability> {
  try {
    if (!(await api.hasHardwareAsync())) return 'unavailable';
    return (await api.isEnrolledAsync()) ? 'available' : 'not-enrolled';
  } catch (error) {
    reportRuntimeIssue('warn', 'auth.biometric.availability', error);
    return 'unavailable';
  }
}

export type BiometricPromptOutcome = 'success' | 'cancel' | 'lockout' | 'not-enrolled' | 'failed' | 'unavailable' | 'error';

/** The §6.3 result table, OS side (pure). */
export function promptOutcomeFor(result: LocalAuthenticationResult): BiometricPromptOutcome {
  if (result.success) return 'success';
  switch (result.error) {
    case 'user_cancel':
    case 'system_cancel':
    case 'app_cancel':
    case 'user_fallback':
      return 'cancel';
    case 'lockout':
      return 'lockout';
    case 'not_enrolled':
    case 'passcode_not_set':
      return 'not-enrolled';
    case 'authentication_failed':
      return 'failed';
    case 'not_available':
      return 'unavailable';
    default:
      return 'error';
  }
}

export interface BiometricPromptText {
  /** "Sign in to DEMS". */
  readonly promptMessage: string;
  /** The operator's display name. */
  readonly promptSubtitle?: string;
  /** "Use password". */
  readonly cancelLabel: string;
}

/** The §6.3 prompt options (pure). */
export function biometricPromptOptions(text: BiometricPromptText): LocalAuthenticationOptions {
  return {
    promptMessage: text.promptMessage,
    ...(text.promptSubtitle ? { promptSubtitle: text.promptSubtitle } : {}),
    cancelLabel: text.cancelLabel,
    disableDeviceFallback: true,
    biometricsSecurityLevel: 'strong',
  };
}

/** Shows the OS prompt. Never throws: a thrown error becomes `error` (logged). */
export async function promptBiometric(text: BiometricPromptText, api: BiometricApi = DEFAULT_API): Promise<BiometricPromptOutcome> {
  try {
    const result = await api.authenticateAsync(biometricPromptOptions(text));
    const outcome = promptOutcomeFor(result);
    if (outcome === 'error') {
      reportRuntimeIssue('warn', 'auth.biometric.prompt', `Biometric prompt ended with ${result.success ? 'success' : result.error}`);
    }
    return outcome;
  } catch (error) {
    reportRuntimeIssue('error', 'auth.biometric.prompt', error);
    return 'error';
  }
}

export type BiometricSignInResult =
  | { readonly kind: 'signed-in'; readonly operatorId: string }
  | { readonly kind: 'cancelled' }
  /** The OS locked biometrics: "Biometrics locked — use your password". */
  | { readonly kind: 'lockout' }
  | { readonly kind: 'not-enrolled' }
  /** One failure counted toward the §6.1 console lockout. */
  | { readonly kind: 'failed'; readonly attemptsRemaining: number }
  /** The console lockout (§6.1), from the simulator clock. */
  | { readonly kind: 'locked'; readonly lockedUntilMs: number }
  | { readonly kind: 'unavailable' }
  /** The Core link is down: sign-in is disabled (04 §4.1 L6). */
  | { readonly kind: 'core-offline' }
  /**
   * LIVE mode only (MB-3, MB-6a): the stored token can never sign in again and both stored items
   * are deleted. The operator signs in with the password and enables biometric sign-in again; the
   * Alert is `useAuthSession().notice`.
   */
  | { readonly kind: 'invalid' }
  | { readonly kind: 'error' };

/**
 * The auth calls a biometric sign-in makes: the actions of the source in `SimContext`. The
 * simulator answers at once; a Live source answers after the Core server did.
 */
export interface BiometricSimAuth {
  signInWithBiometric(operatorId: string): SimSignInResult | Promise<SimSignInResult>;
  recordBiometricFailure(operatorId: string | null): SimSignInResult | Promise<SimSignInResult>;
}

/** A failed attempt as the fingerprint button shows it: the console lockout, or the attempts left. */
export function fromFailure(result: Extract<SimSignInResult, { ok: false }>): BiometricSignInResult {
  return result.reason === 'LOCKED'
    ? { kind: 'locked', lockedUntilMs: result.lockedUntil }
    : { kind: 'failed', attemptsRemaining: result.attemptsRemaining };
}

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function';
}

/** `map` of an answer: at once for the simulator's plain value, on settlement for a Live result. */
function mapAnswer<T, R>(answer: T | Promise<T>, map: (value: T) => R): R | Promise<R> {
  return isPromiseLike(answer) ? Promise.resolve(answer).then(map) : map(answer);
}

/**
 * The §6.3 result table, auth side (pure apart from the auth calls it makes). With the simulator
 * the result is returned at once, as before; with a Live source it is a promise, which rejects
 * with what the action rejected with.
 */
export function applyBiometricOutcome(
  outcome: BiometricPromptOutcome,
  operatorId: string,
  auth: BiometricSimAuth,
): BiometricSignInResult | Promise<BiometricSignInResult> {
  switch (outcome) {
    case 'success':
      return mapAnswer(auth.signInWithBiometric(operatorId), (result) =>
        result.ok ? { kind: 'signed-in', operatorId: result.operatorId } : fromFailure(result),
      );
    case 'failed':
      // A failure never signs in; `ok` cannot be true here.
      return mapAnswer(auth.recordBiometricFailure(operatorId), (result) => (result.ok ? { kind: 'error' } : fromFailure(result)));
    case 'cancel':
      return { kind: 'cancelled' };
    case 'lockout':
      return { kind: 'lockout' };
    case 'not-enrolled':
      return { kind: 'not-enrolled' };
    case 'unavailable':
      return { kind: 'unavailable' };
    default:
      return { kind: 'error' };
  }
}

export interface BiometricSignInOptions {
  readonly operatorId: string;
  readonly text: BiometricPromptText;
  readonly auth: BiometricSimAuth;
  readonly api?: BiometricApi;
}

/** The whole fingerprint-button flow of the simulator: availability, prompt, then the auth call (§6.3). */
export async function biometricSignIn({ operatorId, text, auth, api = DEFAULT_API }: BiometricSignInOptions): Promise<BiometricSignInResult> {
  const availability = await getBiometricAvailability(api);
  if (availability === 'unavailable') return { kind: 'unavailable' };
  if (availability === 'not-enrolled') return { kind: 'not-enrolled' };
  const outcome = await promptBiometric(text, api);
  try {
    // Awaited here, so that a result that arrives later and fails is contained below as well.
    return await applyBiometricOutcome(outcome, operatorId, auth);
  } catch (error) {
    reportRuntimeIssue('error', 'auth.biometric.signIn', error, { outcome });
    return { kind: 'error' };
  }
}
