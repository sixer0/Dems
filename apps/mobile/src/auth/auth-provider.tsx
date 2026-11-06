/**
 * `AuthProvider` (04_mobile_specs §3.2 slot 10, §6): a thin adapter over the Core's auth.
 *
 * It sits inside `SimRuntimeProvider` and re-provides the runtime contract with the real `auth`.
 * Which Core it adapts follows the data source of the runtime (backend task W56):
 *
 * | Core link source | Provider | The Core |
 * |---|---|---|
 * | SIMULATED, HEARTBEAT | `SimulatedAuthProvider` (this file) | The simulator's `auth.ts`, as before the backend task |
 * | LIVE (debug builds only) | `LiveAuthProvider` (`./live-auth-provider.tsx`) | The Core server: a session on a paired device, a server-driven idle expiry, a single-use biometric token |
 *
 * Both give the screens the same `useAuth()` and `useAuthSession()` (`./auth-session.tsx`). A
 * change across the LIVE boundary mounts another runtime and with it another provider; within
 * one runtime mount the provider never changes.
 *
 * `SimulatedAuthProvider`:
 * - `signIn(username, password)` → the Core action `signIn`. The simulator applies the §6.1 policy
 *   (demo password, 5 failures in 5 min → 60 s lockout on the simulator clock, one audit row per
 *   attempt: AUTH_SUCCESS, AUTH_FAILED, AUTH_LOCKED). In heartbeat mode with the Core OFFLINE the
 *   attempt is refused before the simulator (`CORE_OFFLINE`, §4.1 L6: Sign In disabled).
 *   Credentials exist only for the duration of the call: never stored, logged or put in a URL.
 * - `signOut(reason)`: USER or LOCK ("Lock console") → the simulator's sign-out (one audit row).
 *   Recording is never touched (§3.3).
 *
 * And, through `useAuthSession()`:
 * - the **idle lock**: every touch inside the app counts as activity (a bubbling `onTouchStart`
 *   on one wrapping view calls the Core action `touch`, throttled); after 15 min without one the
 *   simulator expires the sign-in (AUTH_EXPIRED). The provider then records `lastSignOut = 'IDLE'`
 *   for the Login alert and opens the global "Session expired" dialog (§4.19). The guard (step 70)
 *   moves the operator to `/login`;
 * - the **lockout** as the Login screen shows it (live countdown, attempts remaining);
 * - **biometric sign-in** (§6.3, `biometric.ts`): availability, the enable offer after a password
 *   sign-in (a global dialog, so it survives the move to Home), the Settings toggle, and the
 *   fingerprint-button flow. Preferences live in `dems.mobile.auth.v1` (`auth-prefs.ts`).
 *
 * The authenticated session lives in memory only (§6.4): after a cold start the operator signs in
 * again, and the route sync restores the monitor if a session is still recording.
 *
 * The Core's actions are taken from `useCoreActions()` (04_client_integration_spec CL-12,
 * AC-C-53): for the simulator that is its own actions object, answering at once, as before.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { settle, useCoreActions } from '@dems/shared/live';
import { useSim, useSimInstance, type SignInResult as SimSignInResult } from '@dems/shared/sim';
import {
  newCorrelationId,
  reportRuntimeIssue,
  useMobileLiveRuntime,
  useRuntime,
  type AuthContract,
  type SignInResult,
  type SignOutReason,
} from '@/runtime';
import { BiometricOfferDialog, IdleLockDialog } from './auth-dialogs';
import { getAuthPrefs, setAuthPrefs, useAuthPrefs } from './auth-prefs';
import {
  AuthFrame,
  isSignInBlocked,
  lockoutInfoOf,
  selectAuthView,
  toContractSignInResult,
  useActivityTouch,
  type AuthSession,
} from './auth-session';
import { biometricSignIn, getBiometricAvailability, type BiometricApi, type BiometricAvailability, type BiometricSignInResult } from './biometric';
import { LiveAuthProvider } from './live-auth-provider';
import { findAuthOperator } from './operators';

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

export interface AuthProviderProps {
  children?: ReactNode;
  /** Tests inject a fake expo-local-authentication. */
  biometricApi?: BiometricApi;
}

/** The auth layer of the runtime's data source: the Core server in LIVE mode, else the simulator. */
export function AuthProvider({ children, biometricApi }: AuthProviderProps) {
  const mobile = useMobileLiveRuntime();
  return mobile !== null ? (
    <LiveAuthProvider mobile={mobile} {...(biometricApi ? { biometricApi } : {})}>
      {children}
    </LiveAuthProvider>
  ) : (
    <SimulatedAuthProvider {...(biometricApi ? { biometricApi } : {})}>{children}</SimulatedAuthProvider>
  );
}

function SimulatedAuthProvider({ children, biometricApi }: AuthProviderProps) {
  const sim = useSimInstance();
  const actions = useCoreActions();
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
        // The simulator answers at once (CL-26: a call from an asynchronous function may be awaited).
        result = await actions.signIn(username, password);
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
    [sim, actions, offerBiometricFor],
  );

  const signOut = useCallback(
    (reason: SignOutReason = 'USER') => {
      setLastSignOut(reason);
      // IDLE is the simulator's own expiry; an explicit IDLE sign-out is recorded as a USER one.
      settle(() => actions.signOut(reason === 'LOCK' ? 'LOCK' : 'USER'), {
        fail: (error) => reportRuntimeIssue('error', 'auth.signOut', error, { reason }),
      });
    },
    [actions],
  );

  const auth = useMemo<AuthContract>(
    () => ({ isAuthenticated: operator !== null, operator, signIn, signOut }),
    [operator, signIn, signOut],
  );
  const contract = useMemo(() => ({ ...runtime, auth }), [runtime, auth]);

  // Activity (idle lock): throttled `touch()` on any touch inside the app.
  const touch = useActivityTouch(actions);

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
      auth: actions,
      ...(biometricApi ? { api: biometricApi } : {}),
    });
    if (result.kind === 'signed-in') {
      setLastSignOut(null);
      setExpiredNotice(false);
    }
    if (result.kind === 'not-enrolled' || result.kind === 'unavailable') setAvailability(result.kind);
    return result;
  }, [sim, actions, t, biometricApi]);

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
        protected: null,
        changeBlocked: false,
      },
      biometricOffer,
      acceptBiometricOffer,
      declineBiometricOffer,
      setBiometricEnabled,
      refreshBiometricAvailability,
      signInWithBiometric,
      lockConsole,
      touch,
      notice: null,
      signInFailure: null,
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
    <AuthFrame
      contract={contract}
      session={session}
      onActivity={touch}
      overlays={
        <>
          {/* Mounted only while open: a closed kit Dialog still mounts its overlay hooks. */}
          {expiredNotice ? <IdleLockDialog isOpen onDismiss={dismissExpiredNotice} /> : null}
          {biometricOffer !== null ? (
            <BiometricOfferDialog isOpen onAccept={() => void acceptBiometricOffer()} onDecline={declineBiometricOffer} />
          ) : null}
        </>
      }
    >
      {children}
    </AuthFrame>
  );
}
