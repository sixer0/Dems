/**
 * `AuthProvider` (04_mobile_specs §3.2 slot 10, §6): a thin adapter over the simulator's `auth.ts`.
 *
 * It sits inside `SimRuntimeProvider` and re-provides the runtime contract with the real `auth`:
 * - `signIn(username, password)` → `sim.actions.signIn`. The simulator applies the §6.1 policy
 *   (demo password, 5 failures in 5 min → 60 s lockout on the simulator clock, one audit row per
 *   attempt: AUTH_SUCCESS, AUTH_FAILED, AUTH_LOCKED). In heartbeat mode with the Core OFFLINE the
 *   attempt is refused before the simulator (`CORE_OFFLINE`, §4.1 L6: Sign In disabled).
 *   Credentials exist only for the duration of the call: never stored, logged or put in a URL.
 * - `signOut(reason)`: USER or LOCK ("Lock console") → the simulator's sign-out (one audit row).
 *   Recording is never touched (§3.3).
 *
 * And, through `useAuthSession()`:
 * - the **idle lock**: every touch inside the app counts as activity (a bubbling `onTouchStart`
 *   on one wrapping view calls `sim.actions.touch()`,
 *   throttled); after 15 min without one the simulator expires the sign-in (AUTH_EXPIRED). The
 *   provider then records `lastSignOut = 'IDLE'` for the Login alert and opens the global
 *   "Session expired" dialog (§4.19). The guard (step 70) moves the operator to `/login`;
 * - the **lockout** as the Login screen shows it (live countdown, attempts remaining);
 * - **biometric sign-in** (§6.3, `biometric.ts`): availability, the enable offer after a password
 *   sign-in (a global dialog, so it survives the move to Home), the Settings toggle, and the
 *   fingerprint-button flow. Preferences live in `dems.mobile.auth.v1` (`auth-prefs.ts`).
 *
 * The authenticated session lives in memory only (§6.4): after a cold start the operator signs in
 * again, and the route sync restores the monitor if a session is still recording.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import {
  selectLockout,
  useSim,
  useSimInstance,
  type SignInResult as SimSignInResult,
  type SimState,
} from '@dems/shared/sim';
import {
  RuntimeContractProvider,
  newCorrelationId,
  reportRuntimeIssue,
  useRuntime,
  type AuthContract,
  type AuthOperator,
  type CoreLinkInfo,
  type SignInResult,
  type SignOutReason,
} from '@/runtime';
import { BiometricOfferDialog, IdleLockDialog } from './auth-dialogs';
import { getAuthPrefs, setAuthPrefs, useAuthPrefs } from './auth-prefs';
import { biometricSignIn, getBiometricAvailability, type BiometricApi, type BiometricAvailability, type BiometricSignInResult } from './biometric';
import { findAuthOperator } from './operators';

/** Touches closer together than this count once (the simulator itself keeps ≥ 1 s). */
export const ACTIVITY_THROTTLE_MS = 5_000;

export interface AuthLockoutInfo {
  readonly locked: boolean;
  /** Simulator-clock end of the lockout, epoch ms. */
  readonly lockedUntilMs: number | null;
  /** Whole seconds left (for the C-6 countdown); 0 when not locked. */
  readonly retryInSeconds: number;
  readonly attemptsRemaining: number;
}

export interface BiometricInfo {
  /** `unknown` until the first OS query answers. */
  readonly availability: BiometricAvailability | 'unknown';
  readonly enabled: boolean;
  readonly lastOperatorId: string | null;
  /** The operator the fingerprint button signs in, for the prompt subtitle and the Login caption. */
  readonly lastOperator: AuthOperator | null;
  /** Set when reading or writing `dems.mobile.auth.v1` failed (Settings shows a toast). */
  readonly prefsError: 'read' | 'write' | null;
}

export interface AuthSession {
  /** Why the last operator left, for the Login alert (§3.3); cleared by the next sign-in. */
  readonly lastSignOut: SignOutReason | null;
  /** The "Session expired" dialog is open. */
  readonly expiredNotice: boolean;
  dismissExpiredNotice(): void;
  readonly lockout: AuthLockoutInfo;
  readonly biometric: BiometricInfo;
  /** The operator id a biometric offer is open for, or null. */
  readonly biometricOffer: string | null;
  acceptBiometricOffer(): Promise<void>;
  declineBiometricOffer(): void;
  /** Settings → Security: enable for the signed-in operator, or disable. */
  setBiometricEnabled(enabled: boolean): Promise<void>;
  refreshBiometricAvailability(): Promise<BiometricAvailability>;
  /** The Login fingerprint button (§6.3). */
  signInWithBiometric(): Promise<BiometricSignInResult>;
  /** Avatar menu → Lock console (§6.4). */
  lockConsole(): void;
  /** Records operator activity (the provider already does this for every touch). */
  touch(): void;
}

const NO_LOCKOUT: AuthLockoutInfo = { locked: false, lockedUntilMs: null, retryInSeconds: 0, attemptsRemaining: 5 };

const DEFAULT_SESSION: AuthSession = {
  lastSignOut: null,
  expiredNotice: false,
  dismissExpiredNotice: () => {},
  lockout: NO_LOCKOUT,
  biometric: { availability: 'unknown', enabled: false, lastOperatorId: null, lastOperator: null, prefsError: null },
  biometricOffer: null,
  acceptBiometricOffer: async () => {},
  declineBiometricOffer: () => {},
  setBiometricEnabled: async () => {},
  refreshBiometricAvailability: async () => 'unavailable',
  signInWithBiometric: async () => ({ kind: 'unavailable' }),
  lockConsole: () => {},
  touch: () => {},
};

const AuthSessionContext = createContext<AuthSession>(DEFAULT_SESSION);

/** Login, Settings and the avatar menu read the auth session here (inert outside `AuthProvider`). */
export function useAuthSession(): AuthSession {
  return useContext(AuthSessionContext);
}

/** The lockout as the Login screen shows it; changes at most once per second while locked (pure). */
export function lockoutInfoOf(s: SimState): AuthLockoutInfo {
  const status = selectLockout(s);
  return {
    locked: status.locked,
    lockedUntilMs: status.lockedUntil,
    retryInSeconds: status.locked ? Math.ceil(status.retryInMs / 1000) : 0,
    attemptsRemaining: status.attemptsRemaining,
  };
}

const selectAuthView = (s: SimState) => ({ status: s.auth.status, operatorId: s.auth.operatorId });

/** The contract's result for a simulator sign-in result (pure). */
export function toContractSignInResult(result: SimSignInResult, operator: AuthOperator | null): SignInResult {
  if (result.ok) return operator ? { ok: true, operator } : { ok: false, reason: 'UNAVAILABLE' };
  if (result.reason === 'LOCKED') return { ok: false, reason: 'LOCKED', lockedUntilMs: result.lockedUntil };
  return { ok: false, reason: 'INVALID_CREDENTIALS', attemptsRemaining: result.attemptsRemaining };
}

/** Heartbeat mode with the Core down: Sign In is disabled (04 §4.1 L6). */
export function isSignInBlocked(link: CoreLinkInfo): boolean {
  return link.source === 'HEARTBEAT' && link.state === 'OFFLINE';
}

export interface AuthProviderProps {
  children?: ReactNode;
  /** Tests inject a fake expo-local-authentication. */
  biometricApi?: BiometricApi;
}

export function AuthProvider({ children, biometricApi }: AuthProviderProps) {
  const sim = useSimInstance();
  const runtime = useRuntime();
  const { t } = useTranslation();

  const authView = useSim(selectAuthView);
  const lockout = useSim(lockoutInfoOf);
  const [lastSignOut, setLastSignOut] = useState<SignOutReason | null>(null);
  const [expiredNotice, setExpiredNotice] = useState(false);
  const prefs = useAuthPrefs();
  // Queried when needed (the Login screen calls `refreshBiometricAvailability()`, and so does a
  // password sign-in before the offer), not at mount: no OS call while nobody signs in.
  const [availability, setAvailability] = useState<BiometricAvailability | 'unknown'>('unknown');
  const [biometricOffer, setBiometricOffer] = useState<string | null>(null);

  const linkRef = useRef(runtime.coreLink);
  useEffect(() => {
    linkRef.current = runtime.coreLink;
  }, [runtime.coreLink]);

  // Idle expiry (the simulator's 15-min check): SIGNED_IN → EXPIRED.
  const previousStatus = useRef(authView.status);
  useEffect(() => {
    const previous = previousStatus.current;
    previousStatus.current = authView.status;
    if (previous === 'SIGNED_IN' && authView.status === 'EXPIRED') {
      setLastSignOut('IDLE');
      setExpiredNotice(true);
      reportRuntimeIssue('info', 'auth.idleLock', 'Signed out after 15 min without activity');
    }
  }, [authView.status]);

  const operator = useMemo(
    () => (authView.status === 'SIGNED_IN' ? findAuthOperator(sim.store.getState().operators, authView.operatorId) : null),
    [sim, authView.status, authView.operatorId],
  );

  const refreshBiometricAvailability = useCallback(async () => {
    const next = await getBiometricAvailability(biometricApi);
    setAvailability(next);
    return next;
  }, [biometricApi]);

  /** After a password sign-in: offer biometrics when the device can and it is not already bound to this operator. */
  const offerBiometricFor = useCallback(
    async (operatorId: string) => {
      const next = await refreshBiometricAvailability();
      const current = getAuthPrefs();
      if (next === 'available' && !(current.biometricEnabled && current.lastOperatorId === operatorId)) setBiometricOffer(operatorId);
    },
    [refreshBiometricAvailability],
  );

  const signIn = useCallback(
    async (username: string, password: string): Promise<SignInResult> => {
      const correlationId = newCorrelationId('signin');
      await sim.ready;
      if (isSignInBlocked(linkRef.current)) {
        reportRuntimeIssue('info', 'auth.signIn', 'Sign-in refused: Core link offline (heartbeat mode)', undefined, correlationId);
        return { ok: false, reason: 'CORE_OFFLINE' };
      }
      let result: SimSignInResult;
      try {
        result = sim.actions.signIn(username, password);
      } catch (error) {
        reportRuntimeIssue('error', 'auth.signIn', error, undefined, correlationId);
        return { ok: false, reason: 'UNAVAILABLE' };
      }
      if (!result.ok) return toContractSignInResult(result, null);
      const signedIn = findAuthOperator(sim.store.getState().operators, result.operatorId);
      setLastSignOut(null);
      setExpiredNotice(false);
      void offerBiometricFor(result.operatorId).catch((error: unknown) =>
        reportRuntimeIssue('warn', 'auth.biometric.offer', error, undefined, correlationId),
      );
      return toContractSignInResult(result, signedIn);
    },
    [sim, offerBiometricFor],
  );

  const signOut = useCallback(
    (reason: SignOutReason = 'USER') => {
      setLastSignOut(reason);
      try {
        // IDLE is the simulator's own expiry; an explicit IDLE sign-out is recorded as a USER one.
        sim.actions.signOut(reason === 'LOCK' ? 'LOCK' : 'USER');
      } catch (error) {
        reportRuntimeIssue('error', 'auth.signOut', error, { reason });
      }
    },
    [sim],
  );

  const auth = useMemo<AuthContract>(
    () => ({ isAuthenticated: operator !== null, operator, signIn, signOut }),
    [operator, signIn, signOut],
  );
  const contract = useMemo(() => ({ ...runtime, auth }), [runtime, auth]);

  // Activity (idle lock): throttled `touch()` on any touch inside the app.
  const lastTouch = useRef(0);
  const touch = useCallback(() => {
    const now = Date.now();
    if (now - lastTouch.current < ACTIVITY_THROTTLE_MS) return;
    lastTouch.current = now;
    try {
      sim.actions.touch();
    } catch (error) {
      reportRuntimeIssue('warn', 'auth.touch', error);
    }
  }, [sim]);

  const signInWithBiometric = useCallback(async (): Promise<BiometricSignInResult> => {
    await sim.ready;
    if (isSignInBlocked(linkRef.current)) return { kind: 'core-offline' };
    const { biometricEnabled, lastOperatorId } = getAuthPrefs();
    if (!biometricEnabled || !lastOperatorId) return { kind: 'unavailable' };
    const bound = findAuthOperator(sim.store.getState().operators, lastOperatorId);
    const result = await biometricSignIn({
      operatorId: lastOperatorId,
      text: {
        promptMessage: t('mobile.biometric.promptMessage'),
        ...(bound ? { promptSubtitle: bound.displayName } : {}),
        cancelLabel: t('mobile.biometric.cancelLabel'),
      },
      auth: sim.actions,
      ...(biometricApi ? { api: biometricApi } : {}),
    });
    if (result.kind === 'signed-in') {
      setLastSignOut(null);
      setExpiredNotice(false);
    }
    if (result.kind === 'not-enrolled' || result.kind === 'unavailable') setAvailability(result.kind);
    return result;
  }, [sim, t, biometricApi]);

  const setBiometricEnabled = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        if (!operator) return;
        await setAuthPrefs({ lastOperatorId: operator.id, biometricEnabled: true });
      } else {
        await setAuthPrefs({ lastOperatorId: getAuthPrefs().lastOperatorId, biometricEnabled: false });
      }
    },
    [operator],
  );

  const acceptBiometricOffer = useCallback(async () => {
    const operatorId = biometricOffer;
    setBiometricOffer(null);
    if (operatorId) await setAuthPrefs({ lastOperatorId: operatorId, biometricEnabled: true });
  }, [biometricOffer]);
  const declineBiometricOffer = useCallback(() => setBiometricOffer(null), []);
  const dismissExpiredNotice = useCallback(() => setExpiredNotice(false), []);
  const lockConsole = useCallback(() => signOut('LOCK'), [signOut]);

  const lastOperator = useMemo(() => findAuthOperator(sim.store.getState().operators, prefs.lastOperatorId), [sim, prefs.lastOperatorId]);

  const session = useMemo<AuthSession>(
    () => ({
      lastSignOut,
      expiredNotice,
      dismissExpiredNotice,
      lockout,
      biometric: {
        availability,
        enabled: prefs.biometricEnabled,
        lastOperatorId: prefs.lastOperatorId,
        lastOperator,
        prefsError: prefs.error,
      },
      biometricOffer,
      acceptBiometricOffer,
      declineBiometricOffer,
      setBiometricEnabled,
      refreshBiometricAvailability,
      signInWithBiometric,
      lockConsole,
      touch,
    }),
    [
      lastSignOut,
      expiredNotice,
      dismissExpiredNotice,
      lockout,
      availability,
      prefs,
      lastOperator,
      biometricOffer,
      acceptBiometricOffer,
      declineBiometricOffer,
      setBiometricEnabled,
      refreshBiometricAvailability,
      signInWithBiometric,
      lockConsole,
      touch,
    ],
  );

  return (
    <RuntimeContractProvider value={contract}>
      <AuthSessionContext.Provider value={session}>
        <View testID="auth-activity-boundary" style={styles.fill} onTouchStart={touch}>
          {children}
        </View>
        {/* Mounted only while open: a closed kit Dialog still mounts its overlay hooks. */}
        {expiredNotice ? <IdleLockDialog isOpen onDismiss={dismissExpiredNotice} /> : null}
        {biometricOffer !== null ? (
          <BiometricOfferDialog isOpen onAccept={() => void acceptBiometricOffer()} onDecline={declineBiometricOffer} />
        ) : null}
      </AuthSessionContext.Provider>
    </RuntimeContractProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
