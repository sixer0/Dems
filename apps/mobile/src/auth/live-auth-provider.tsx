/**
 * `LiveAuthProvider`: the auth layer of LIVE mode, where the Core server is the Core (backend task
 * W56; 04_client_integration_spec §6.5, §8.5 S1-1 to S1-3, §9.2, §9.3). `AuthProvider` mounts it
 * when the runtime holds the app's Live source; the screens read the same `useAuth()` and
 * `useAuthSession()` as with the simulator.
 *
 * | Part | LIVE behaviour |
 * |---|---|
 * | Reachability | Only a PAIRED tablet signs in. On a tablet that is not paired no sign-in request leaves the device (`UNAVAILABLE`); with the link down none does either (`CORE_OFFLINE`) |
 * | Password sign-in (S1-1) | Operation 2 through the Core action `signIn`, awaited: it settles when the session's snapshot is in the replica. The session token stays in the runtime's memory; this layer never sees it. A wrong password and the lockout are the action's own results; a limit (429) is the presenter's limit toast and `UNAVAILABLE`, never a wrong password and never an outage |
 * | Lockout | The Core's, keyed by the device; read from the replica's `authLockout` slice through the same `lockoutInfoOf` |
 * | Sign out, Lock console | The Core action `signOut`; it ends the session here at once, also with the link down (the Live source owes the Core the sign-out, DR-11). The Login notice is read from why the session ended (`lastSessionEnd`), not from the action |
 * | Idle | The 5 s activity throttle stays; the Live source reports activity to the Core at most once a minute (CL-27). **The Core ends the session**; the "Session expired" dialog opens for `IDLE_EXPIRED` and, with the 8-hour sentence, for `ABSOLUTE_EXPIRED` |
 * | Other session ends (§6.4, §6.5) | `USER_DISABLED`, `TOKEN_REUSE`, `ABSOLUTE_EXPIRED`: `useAuthSession().notice`, the Alert of the Login screen |
 * | Biometric enrolment (MB-1, MB-2) | Operation 7, **only in a session created by password on this tablet**; the token it returns once goes into the secure store with its marker. Turning it off: operation 7 first, then both items are deleted |
 * | Biometric sign-in (MB-3 to MB-6) | One OS check, then operation 8 with the stored token under the device's own credential (the runtime's rule, decision D118); the next token is stored before the action settles. **A token is never sent twice** (finding F72): a second press joins the first, and a token whose answer is not known is deleted, not retried |
 * | A failed OS check (MB-4) | Operation 9 through the Core action `recordBiometricFailure`. A cancelled prompt calls nothing |
 * | `biometric` of the session (MB-7) | From the stored marker: enabled, the operator's ID and name, how the token is stored. `dems.mobile.auth.v1` is neither read nor written |
 *
 * **Secrets.** A password exists for the duration of one `signIn` call. The biometric token passes
 * from the secure store into the Live source's request inside `./live-biometric.ts`; this file
 * never holds one. Nothing here writes AsyncStorage, and no log line carries a credential, a
 * token, a password or a username.
 *
 * **Release builds (MD-6).** This component is part of every bundle and is never mounted in a
 * release build: no Live source exists there. The token storage and, through it, the secure-store
 * wrapper are loaded behind a literal `__DEV__` test and are not part of a release bundle.
 */
import { useToast } from 'heroui-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { OperatorBody } from '@dems/shared/api';
import { settle, useCoreActions, useLiveSelector } from '@dems/shared/live';
import type { LiveSessionEnd } from '@dems/shared/live/source';
import { useSim, type SignInResult as SimSignInResult, type SimState } from '@dems/shared/sim';
import {
  initialsFor,
  isPairingBlocked,
  newCorrelationId,
  reportRuntimeIssue,
  useCoreErrorPresenter,
  useRuntime,
  type AuthContract,
  type AuthOperator,
  type CoreErrorPresentation,
  type MobileLive,
  type MobileLiveSim,
  type SignInResult,
  type SignOutReason,
} from '@/runtime';
import type { BiometricMarker } from '@/runtime/secure-credentials';
import { BiometricOfferDialog, IdleLockDialog } from './auth-dialogs';
import {
  AuthFrame,
  isSignInBlocked,
  lockoutInfoOf,
  selectAuthView,
  toContractSignInResult,
  useActivityTouch,
  type AuthSession,
  type BiometricInfo,
  type BiometricOperator,
} from './auth-session';
import {
  applyBiometricOutcome,
  fromFailure,
  getBiometricAvailability,
  promptBiometric,
  type BiometricApi,
  type BiometricAvailability,
  type BiometricPromptOutcome,
  type BiometricPromptText,
  type BiometricSignInResult,
} from './biometric';
import './i18n-bundle';
import {
  authNotice,
  biometricTokenFate,
  errorOfCallFailure,
  expiryOf,
  isTokenReuse,
  noticeOfSessionEnd,
  rejectedSignIn,
  signOutReasonOf,
} from './live-auth-model';
import type { LiveBiometricStore } from './live-biometric';
import { findAuthOperator, toAuthOperator } from './operators';

const stores = new WeakMap<MobileLive, LiveBiometricStore>();

/**
 * The token storage of a Live source: one per source, so a provider that is mounted again (React
 * StrictMode) keeps the one open attempt. `null` in a release build: the block below, with the
 * module it loads and the secure-store wrapper behind it, is not part of a release bundle (MD-6).
 */
function biometricStoreOf(mobile: MobileLive): LiveBiometricStore | null {
  if (__DEV__) {
    const existing = stores.get(mobile);
    if (existing !== undefined) return existing;
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- the module must stay inside the __DEV__ block (MD-6)
    const { createLiveBiometricStore } = require('./live-biometric') as typeof import('./live-biometric');
    const created = createLiveBiometricStore({ deviceId: () => mobile.getPairing().deviceId });
    stores.set(mobile, created);
    return created;
  }
  return null;
}

/** The signed-in operator as the replica holds it: the Core replaces the object on a role change (§6.3). */
const selectSignedInOperator = (s: SimState) =>
  s.auth.status === 'SIGNED_IN' ? (s.operators.find((candidate) => candidate.id === s.auth.operatorId) ?? null) : null;

const readSessionEnd = (live: MobileLiveSim | null): LiveSessionEnd | null => live?.lastSessionEnd ?? null;
const readSessionMethod = (live: MobileLiveSim | null) => live?.session?.method ?? null;
const readSessionOperator = (live: MobileLiveSim | null) => live?.session?.operator ?? null;

/** The operator of the caller's own session, when the replica's `operators` slice does not hold it (yet). */
function operatorOfSession(operator: OperatorBody): AuthOperator {
  return { id: operator.id, displayName: operator.displayName, initials: operator.initials, role: operator.role, username: operator.username };
}

function sameMarker(a: BiometricMarker | null, b: BiometricMarker | null): boolean {
  if (a === null || b === null) return a === b;
  return a.operatorId === b.operatorId && a.displayName === b.displayName && a.deviceId === b.deviceId && a.protected === b.protected;
}

/** Why an enrolment did not happen; `error` is the Core's refusal when there was one. */
type EnrolOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly cause: 'session' | 'refused' | 'storage'; readonly error: Error | null };

export interface LiveAuthProviderProps {
  /** The app's Live source with its adapters (`useMobileLiveRuntime()`). */
  mobile: MobileLive;
  children?: ReactNode;
  /** Tests inject a fake expo-local-authentication. */
  biometricApi?: BiometricApi;
}

export function LiveAuthProvider({ mobile, children, biometricApi }: LiveAuthProviderProps) {
  const { live } = mobile;
  const actions = useCoreActions();
  const runtime = useRuntime();
  const { t } = useTranslation();
  const { toast } = useToast();
  const presentCoreError = useCoreErrorPresenter();

  const authView = useSim(selectAuthView);
  const lockout = useSim(lockoutInfoOf);
  const replicaOperator = useSim(selectSignedInOperator);
  const sessionEnd = useLiveSelector(readSessionEnd);
  const sessionMethod = useLiveSelector(readSessionMethod);
  const sessionOperator = useLiveSelector(readSessionOperator);

  const [store] = useState(() => biometricStoreOf(mobile));
  const [marker, setMarker] = useState<BiometricMarker | null>(null);
  // Queried when needed, as with the simulator: no OS call while nobody signs in.
  const [availability, setAvailability] = useState<BiometricAvailability | 'unknown'>('unknown');
  const [biometricOffer, setBiometricOffer] = useState<string | null>(null);
  /** The session end whose "Session expired" dialog the operator closed. */
  const [dismissedExpiry, setDismissedExpiry] = useState<LiveSessionEnd | null>(null);
  /** A sign-in attempt found the stored token dead: the Alert of MB-3, until somebody signs in. */
  const [biometricInvalid, setBiometricInvalid] = useState(false);
  const [signInFailure, setSignInFailure] = useState<CoreErrorPresentation | null>(null);
  const [storageError, setStorageError] = useState<'write' | null>(null);

  const linkRef = useRef(runtime.coreLink);
  const pairingRef = useRef(runtime.pairing);
  useEffect(() => {
    linkRef.current = runtime.coreLink;
    pairingRef.current = runtime.pairing;
  }, [runtime.coreLink, runtime.pairing]);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // ── The stored marker: what the fingerprint button and the Settings switch show (MB-7) ──

  const refreshMarker = useCallback(async (): Promise<BiometricMarker | null> => {
    if (store === null) return null;
    const next = await store.marker();
    if (alive.current) setMarker((current) => (sameMarker(current, next) ? current : next));
    return next;
  }, [store]);

  // Read at mount, and again when the pairing changes: the items go with the device credential
  // (MB-2), and a marker belongs to one pairing.
  const pairedDeviceId = runtime.pairing?.state === 'PAIRED' ? runtime.pairing.deviceId : null;
  useEffect(() => {
    refreshMarker().catch((error: unknown) => reportRuntimeIssue('warn', 'auth.biometric.marker', error));
  }, [refreshMarker, pairedDeviceId]);

  // ── Why the session ended (§6.5) ──

  useEffect(
    () =>
      live.onSessionEnd((end) => {
        reportRuntimeIssue(end.reason === 'TOKEN_REUSE' || end.reason === 'USER_DISABLED' ? 'warn' : 'info', 'auth.sessionEnd', 'The session on this tablet ended', {
          kind: end.kind,
          reason: end.reason,
          endSource: end.source,
          signOut: end.signOut,
          wasSignedIn: end.wasSignedIn,
        });
        if (!isTokenReuse(end) || store === null) return;
        // AC-C-108: the token and its marker go; the device credential is not this layer's and stays.
        store
          .remove()
          .then(() => refreshMarker())
          .catch((error: unknown) => reportRuntimeIssue('error', 'auth.biometric.reuse', error));
      }),
    [live, store, refreshMarker],
  );

  const signedIn = authView.status === 'SIGNED_IN';
  const lastSignOut = signedIn ? null : signOutReasonOf(sessionEnd);
  const expiry = signedIn ? null : expiryOf(sessionEnd);
  const expiredNotice = expiry !== null && sessionEnd !== dismissedExpiry;
  const notice = signedIn ? null : biometricInvalid ? authNotice('biometric-invalid') : noticeOfSessionEnd(sessionEnd);

  const operator = useMemo<AuthOperator | null>(() => {
    if (!signedIn) return null;
    if (replicaOperator !== null) return toAuthOperator(replicaOperator);
    return sessionOperator !== null ? operatorOfSession(sessionOperator) : null;
  }, [signedIn, replicaOperator, sessionOperator]);

  // ── Biometric enrolment (MB-1, MB-2) ──

  const refreshBiometricAvailability = useCallback(async () => {
    const next = await getBiometricAvailability(biometricApi);
    if (alive.current) setAvailability(next);
    return next;
  }, [biometricApi]);

  /** Operation 7 with `enabled: true`, and the token it returns into the secure store. */
  const enrol = useCallback(
    async (operatorId: string): Promise<EnrolOutcome> => {
      const session = live.session;
      // The marker names the device by the pairing gate's ID, which is what it is compared with later.
      const deviceId = mobile.getPairing().deviceId;
      // MB-1, AC-C-68: only inside a session that was created by password on this tablet. Anything
      // else sends nothing (the Core would refuse it: 403 with `PASSWORD_SESSION_REQUIRED`).
      if (store === null || session === null || deviceId === null || session.operator.id !== operatorId || session.method !== 'PASSWORD' || session.deviceId === null) {
        reportRuntimeIssue('warn', 'auth.biometric.enrol', 'Biometric sign-in is enabled only in a session created by password on this tablet; nothing was sent', {
          method: session?.method ?? null,
          signedIn: session !== null,
        });
        return { ok: false, cause: 'session', error: null };
      }
      const answer = await live.client.call('setBiometricEnrollment', { body: { enabled: true } });
      if (!answer.ok) {
        reportRuntimeIssue('warn', 'auth.biometric.enrol', 'The Core did not enable biometric sign-in', {
          status: answer.status,
          errorCode: answer.error.code,
          requestId: answer.requestId,
        });
        return { ok: false, cause: 'refused', error: errorOfCallFailure(answer) };
      }
      const issued = answer.data.token;
      const written =
        issued === undefined
          ? null
          : await store.enrol(issued, { operatorId, displayName: session.operator.displayName, deviceId }, t('mobile.biometric.promptMessage'));
      if (written === null || !written.ok) {
        // MB-6a: nothing is kept and nothing falls back silently; biometric sign-in stays off. The
        // wrapper logged the storage failure by code. The Core is told once, so that it holds no
        // live token that nobody has.
        reportRuntimeIssue('error', 'auth.biometric.enrol', 'The tablet could not keep the biometric token; biometric sign-in stays off', {
          errorCode: written === null ? 'NOT_ISSUED' : written.code,
          requestId: answer.requestId,
        });
        const undone = await live.client.call('setBiometricEnrollment', { body: { enabled: false } });
        if (!undone.ok) {
          reportRuntimeIssue('warn', 'auth.biometric.enrol', 'The Core was not told that the enrolment was dropped', {
            status: undone.status,
            errorCode: undone.error.code,
            requestId: undone.requestId,
          });
        }
        await refreshMarker();
        return { ok: false, cause: 'storage', error: null };
      }
      await refreshMarker();
      reportRuntimeIssue('info', 'auth.biometric.enrol', 'Biometric sign-in enabled on this tablet', { operatorId, protected: written.protected });
      return { ok: true };
    },
    [mobile, live, store, t, refreshMarker],
  );

  /** After a password sign-in: offer biometrics when the device can and this operator is not enrolled here. */
  const offerBiometricFor = useCallback(
    async (operatorId: string) => {
      if (store === null) return;
      const next = await refreshBiometricAvailability();
      if (next !== 'available') return;
      const stored = await refreshMarker();
      if (stored !== null && stored.operatorId === operatorId) return;
      // The session may have ended while the storage was read; and only a password session may enrol.
      const session = live.session;
      if (session === null || session.operator.id !== operatorId || session.method !== 'PASSWORD') return;
      if (alive.current) setBiometricOffer(operatorId);
    },
    [live, store, refreshBiometricAvailability, refreshMarker],
  );

  const acceptBiometricOffer = useCallback(async () => {
    const operatorId = biometricOffer;
    setBiometricOffer(null);
    if (!operatorId) return;
    try {
      const outcome = await enrol(operatorId);
      if (outcome.ok) {
        setStorageError(null);
        return;
      }
      setStorageError('write');
      // The offer has no caller that shows a failure: a refusal of the Core is the presenter's, anything else one toast.
      if (outcome.error !== null && presentCoreError(outcome.error)) return;
      toast.show({ variant: 'danger', label: t('features.auth.biometric.enrolFailed') });
    } catch (error) {
      reportRuntimeIssue('error', 'auth.biometric.offer', error);
    }
  }, [biometricOffer, enrol, presentCoreError, toast, t]);
  const declineBiometricOffer = useCallback(() => setBiometricOffer(null), []);

  const setBiometricEnabled = useCallback(
    async (enabled: boolean) => {
      const session = live.session;
      if (session === null || store === null) return;
      if (enabled) {
        const outcome = await enrol(session.operator.id);
        setStorageError(outcome.ok ? null : 'write');
        // The caller (the Settings switch) shows its own failure.
        if (!outcome.ok) throw new Error('Biometric sign-in was not turned on');
        return;
      }
      // MB-2: the Core first, so that the trail holds the change; then both items. While the Core
      // cannot be told nothing is deleted, as with an unpair (MP-7): the two sides stay equal.
      const answer = await live.client.call('setBiometricEnrollment', { body: { enabled: false } });
      if (!answer.ok) {
        reportRuntimeIssue('warn', 'auth.biometric.disable', 'The Core did not turn biometric sign-in off; nothing was deleted', {
          status: answer.status,
          errorCode: answer.error.code,
          requestId: answer.requestId,
        });
        setStorageError('write');
        throw new Error('Biometric sign-in was not turned off');
      }
      const removed = await store.remove();
      await refreshMarker();
      setStorageError(removed ? null : 'write');
      if (!removed) throw new Error('The stored biometric items were not deleted');
      reportRuntimeIssue('info', 'auth.biometric.disable', 'Biometric sign-in turned off on this tablet', { operatorId: session.operator.id });
    },
    [live, store, enrol, refreshMarker],
  );

  // ── Password sign-in (S1-1) ──

  /** The result of a sign-in action that rejected: what the Login screen gets, the presenter's toast, the log. */
  const refused = useCallback(
    (error: unknown, source: string, correlationId: string): Extract<SignInResult, { ok: false }> => {
      const rejection = rejectedSignIn(error);
      setSignInFailure(rejection.presentation);
      if (rejection.toast) presentCoreError(error);
      // The Live source reported the rejection itself (CL-24); this line ties it to the attempt.
      reportRuntimeIssue(rejection.presentation === null ? 'error' : 'warn', source, error, { kind: rejection.presentation?.kind ?? null }, correlationId);
      return rejection.result;
    },
    [presentCoreError],
  );

  const signIn = useCallback(
    async (username: string, password: string): Promise<SignInResult> => {
      const correlationId = newCorrelationId('signin');
      setSignInFailure(null);
      if (isPairingBlocked(pairingRef.current)) {
        // §9.2: the Login screen exists only for a PAIRED tablet. Nothing is sent.
        reportRuntimeIssue('warn', 'auth.signIn', 'Sign-in refused: this tablet is not paired with the Core server; nothing was sent', undefined, correlationId);
        return { ok: false, reason: 'UNAVAILABLE' };
      }
      if (isSignInBlocked(linkRef.current)) {
        reportRuntimeIssue('info', 'auth.signIn', 'Sign-in refused: the Core server is not reachable; nothing was sent', undefined, correlationId);
        return { ok: false, reason: 'CORE_OFFLINE' };
      }
      let result: SimSignInResult;
      try {
        // CL-26: awaited. It resolves when the snapshot of the new session is in the replica.
        result = await actions.signIn(username, password);
      } catch (error) {
        return refused(error, 'auth.signIn', correlationId);
      }
      if (!result.ok) return toContractSignInResult(result, null);
      const session = live.session;
      const signedInOperator =
        findAuthOperator(live.store.getState().operators, result.operatorId) ??
        (session !== null && session.operator.id === result.operatorId ? operatorOfSession(session.operator) : null);
      setBiometricInvalid(false);
      offerBiometricFor(result.operatorId).catch((error: unknown) => reportRuntimeIssue('warn', 'auth.biometric.offer', error, undefined, correlationId));
      return toContractSignInResult(result, signedInOperator);
    },
    [live, actions, refused, offerBiometricFor],
  );

  const signOut = useCallback(
    (reason: SignOutReason = 'USER') => {
      // It ends the session here at once, also with the link down; the notice follows `lastSessionEnd`.
      settle(() => actions.signOut(reason === 'LOCK' ? 'LOCK' : 'USER'), {
        fail: (error) => reportRuntimeIssue('error', 'auth.signOut', error, { reason }),
      });
    },
    [actions],
  );

  const auth = useMemo<AuthContract>(() => ({ isAuthenticated: operator !== null, operator, signIn, signOut }), [operator, signIn, signOut]);
  const contract = useMemo(() => ({ ...runtime, auth }), [runtime, auth]);

  // Activity: the same throttle; the Live source reports it to the Core (CL-27), which ends an idle session.
  const touch = useActivityTouch(actions);

  // ── Biometric sign-in (MB-3 to MB-6) ──

  /** A check that did not pass (MB-4): a failed one is operation 9; a cancelled one calls nothing. */
  const afterCheck = useCallback(
    async (outcome: Exclude<BiometricPromptOutcome, 'success'>, operatorId: string, correlationId: string): Promise<BiometricSignInResult> => {
      try {
        return await applyBiometricOutcome(outcome, operatorId, actions);
      } catch (error) {
        return refused(error, 'auth.biometric.failure', correlationId).reason === 'CORE_OFFLINE' ? { kind: 'core-offline' } : { kind: 'error' };
      }
    },
    [actions, refused],
  );

  const runBiometricSignIn = useCallback(async (): Promise<BiometricSignInResult> => {
    const correlationId = newCorrelationId('signin-bio');
    setSignInFailure(null);
    if (store === null || isPairingBlocked(pairingRef.current)) return { kind: 'unavailable' };
    if (isSignInBlocked(linkRef.current)) return { kind: 'core-offline' };
    const stored = await refreshMarker();
    if (stored === null) return { kind: 'unavailable' };
    // The Core does not look at a token while the device is locked: nothing is asked, nothing is sent.
    const lock = lockoutInfoOf(live.store.getState());
    if (lock.locked && lock.lockedUntilMs !== null) return { kind: 'locked', lockedUntilMs: lock.lockedUntilMs };
    const available = await refreshBiometricAvailability();
    if (available !== 'available') return { kind: available };

    const text: BiometricPromptText = {
      promptMessage: t('mobile.biometric.promptMessage'),
      promptSubtitle: stored.displayName,
      cancelLabel: t('mobile.biometric.cancelLabel'),
    };
    // MB-5: exactly one check. Without the protected item (and on an emulator) it is the existing prompt.
    if (store.promptPlan(stored) === 'os-prompt-first') {
      const outcome = await promptBiometric(text, biometricApi);
      if (outcome !== 'success') return afterCheck(outcome, stored.operatorId, correlationId);
    }

    // Registered when it is needed, not at mount: a port that somebody else registered before the
    // providers were mounted stays until this layer itself signs in with the fingerprint.
    mobile.setBiometricPort(store.port);
    const attempt = store.begin(text.promptMessage);
    // Another attempt holds the token (it cannot happen behind `signInWithBiometric`): nothing is sent.
    if (attempt === null) return { kind: 'error' };
    let settled: { readonly result: SimSignInResult } | { readonly error: unknown };
    try {
      settled = { result: await actions.signInWithBiometric(stored.operatorId) };
    } catch (error) {
      settled = { error };
    }
    // The next token was written before the action settled (MB-6). What is left to decide: a token
    // that was sent and not replaced is kept only when the Core did not look at it.
    const fate = biometricTokenFate(settled);
    const { release, token: tokenEnd } = await attempt.end(fate);
    await refreshMarker();
    reportRuntimeIssue('result' in settled && settled.result.ok ? 'info' : 'warn', 'auth.biometric.signIn', 'Biometric sign-in attempt ended', {
      signedIn: 'result' in settled && settled.result.ok,
      release: release?.kind ?? 'not-asked',
      stored: tokenEnd,
    }, correlationId);

    if ('result' in settled && settled.result.ok) {
      setBiometricInvalid(false);
      return { kind: 'signed-in', operatorId: settled.result.operatorId };
    }
    if (tokenEnd === 'deleted' || release?.kind === 'unreadable') {
      // MB-3, MB-6a: the stored token can never sign in again. Both items are gone; the Alert follows.
      if ('error' in settled && release?.kind === 'released') setSignInFailure(rejectedSignIn(settled.error).presentation);
      setBiometricInvalid(true);
      return { kind: 'invalid' };
    }
    if ('result' in settled) {
      // The lock of the device (423): the token was not looked at and is kept.
      return settled.result.ok ? { kind: 'error' } : fromFailure(settled.result);
    }
    if (release?.kind === 'absent') return { kind: 'unavailable' };
    // MB-5 case a: the protected read was the check, and it did not pass.
    if (release?.kind === 'check') return afterCheck(release.outcome, stored.operatorId, correlationId);
    return refused(settled.error, 'auth.biometric.signIn', correlationId).reason === 'CORE_OFFLINE' ? { kind: 'core-offline' } : { kind: 'error' };
  }, [mobile, live, store, actions, t, biometricApi, refreshMarker, refreshBiometricAvailability, afterCheck, refused]);

  // F72: one biometric sign-in at a time. A second press gets the result of the first: one check,
  // one request, one token.
  const inFlight = useRef<Promise<BiometricSignInResult> | null>(null);
  const signInWithBiometric = useCallback((): Promise<BiometricSignInResult> => {
    if (inFlight.current !== null) return inFlight.current;
    const run = runBiometricSignIn().finally(() => {
      inFlight.current = null;
    });
    inFlight.current = run;
    return run;
  }, [runBiometricSignIn]);

  const dismissExpiredNotice = useCallback(() => setDismissedExpiry(sessionEnd), [sessionEnd]);
  const lockConsole = useCallback(() => signOut('LOCK'), [signOut]);

  const lastOperator = useMemo<BiometricOperator | null>(
    () => (marker === null ? null : { id: marker.operatorId, displayName: marker.displayName, initials: initialsFor(marker.displayName) }),
    [marker],
  );
  const biometric = useMemo<BiometricInfo>(
    () => ({
      availability,
      enabled: marker !== null,
      lastOperatorId: marker?.operatorId ?? null,
      lastOperator,
      prefsError: storageError,
      protected: marker?.protected ?? null,
      changeBlocked: sessionMethod === 'BIOMETRIC',
    }),
    [availability, marker, lastOperator, storageError, sessionMethod],
  );

  // An offer belongs to the session it was made in: it closes when that operator is no longer signed in.
  const openOffer = biometricOffer !== null && signedIn && authView.operatorId === biometricOffer ? biometricOffer : null;

  const session = useMemo<AuthSession>(
    () => ({
      lastSignOut,
      expiredNotice,
      dismissExpiredNotice,
      lockout,
      biometric,
      biometricOffer: openOffer,
      acceptBiometricOffer,
      declineBiometricOffer,
      setBiometricEnabled,
      refreshBiometricAvailability,
      signInWithBiometric,
      lockConsole,
      touch,
      notice,
      signInFailure,
    }),
    [
      lastSignOut,
      expiredNotice,
      dismissExpiredNotice,
      lockout,
      biometric,
      openOffer,
      acceptBiometricOffer,
      declineBiometricOffer,
      setBiometricEnabled,
      refreshBiometricAvailability,
      signInWithBiometric,
      lockConsole,
      touch,
      notice,
      signInFailure,
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
          {expiredNotice ? (
            <IdleLockDialog
              isOpen
              onDismiss={dismissExpiredNotice}
              {...(expiry === 'ABSOLUTE' ? { reason: t('features.auth.notice.absoluteExpired') } : {})}
            />
          ) : null}
          {openOffer !== null ? (
            <BiometricOfferDialog
              isOpen
              note={t('features.auth.biometric.screenLockNote')}
              onAccept={() => void acceptBiometricOffer()}
              onDecline={declineBiometricOffer}
            />
          ) : null}
        </>
      }
    >
      {children}
    </AuthFrame>
  );
}
