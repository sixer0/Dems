/**
 * Login behaviour (04_mobile_specs §4.1, §6.1–§6.3; states of §6.2: Idle, Validating, Submitting,
 * Error, Locked, Core offline, Signed out / Expired, Success).
 *
 * - The form: react-hook-form + the local zod schema (§5.7). Credentials live only in the form
 *   state and in the one `useAuth().signIn(username, password)` call; the password field is cleared
 *   after every attempt, and nothing about the credentials is logged or stored (§6.1 "Never").
 * - Password sign-in → the simulator's §6.1 policy (5 failures in 5 min → 60 s lockout on the
 *   simulator clock; audit AUTH_SUCCESS / AUTH_FAILED / AUTH_LOCKED) through the step-73
 *   `AuthProvider`.
 * - Fingerprint sign-in → `useAuthSession().signInWithBiometric()` (§6.3).
 * - Core offline in heartbeat mode → Sign In disabled and a Retry that restarts the heartbeat
 *   client now instead of waiting for its backoff; rate-limited 3 s → 6 s → 12 s, 3 attempts
 *   (`useRetryCooldown`, the agent's retry rule).
 * - Haptics through the one service (§7.6): Sign In press (light), success, failure, lockout.
 * - Unexpected failures go to the persistent runtime log (`dems.mobile.log.v1`) with a
 *   correlation id and no credential in the context.
 *
 * LIVE mode (backend task W59; 04_client_integration_spec §9.2, §3.5, §8.5 S1-1, LB-10). The same
 * two calls sign in on the Core server through the auth layer (`@/auth`, W56); the simulated paths
 * above are untouched. What LIVE adds here, all of it behind `live`:
 * - a refusal the contract's result cannot say is read from `useAuthSession().signInFailure`:
 *   a limit (429) shows no Alert and keeps what was typed (the auth layer shows the limit toast);
 *   a sign-in the Core server did not answer shows the presenter's sentences in place;
 * - the fingerprint result `invalid` (the stored token is dead) shows nothing of its own: the
 *   auth layer's notice says it, and takes the Alert slot (`noticeFor`);
 * - the offline Alert follows the Live link without flicker; Retry asks the Live socket to
 *   reconnect, on the same cooldown; "Use Simulated mode" stores the simulator as the source;
 * - `coreLook` (row M2 follow-up, decision D180): the chip, the ring and the ambient loops read the
 *   runtime's notice and view of the link (`useCoreLinkNotice()` → `liveCoreLookOf`), never its
 *   two-valued `state`, so a link that is still connecting never reads "offline" or critical.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { HeartbeatContext, useRetryCooldown } from '@dems/shared/realtime';
import { useAuthSession } from '@/auth';
import { useHaptics } from '@/motion';
import { newCorrelationId, reportRuntimeIssue, setCoreLinkSource, useAuth, useCoreLink, useCoreLinkNotice, useMobileLive } from '@/runtime';
import { isLimitFailure, isLiveLogin, liveAttemptFor, liveOfflineNoticeAfter } from './login-live-model';
import {
  EMPTY_LOGIN_FORM,
  isCoreBlocked,
  isSubmitDisabled,
  liveCoreLookOf,
  loginSchema,
  noticeFor,
  type AttemptOutcome,
  type LoginFormInput,
  type LoginFormValues,
} from './login-model';

/** Values pushed into the uncontrolled inputs until the next keystroke in that field. */
export interface FieldOverrides {
  readonly username?: string;
  readonly password?: string;
}

export interface LoginControllerOptions {
  /** A credential error: one card shake (M-C-22). */
  onRejected?: () => void;
  /** The sign-in succeeded: the card leaves (M-APP-01, Login half). */
  onAccepted?: () => void;
}

export function useLoginController({ onRejected, onAccepted }: LoginControllerOptions = {}) {
  // react-hook-form's `form` object is mutable by design; keep this hook out of React Compiler
  // memoisation, like the component that renders its fields (F-70-1: device-only bugs).
  'use no memo';
  const auth = useAuth();
  const session = useAuthSession();
  const coreLink = useCoreLink();
  const haptic = useHaptics();
  const heartbeat = useContext(HeartbeatContext);
  /** LIVE mode: the Core server is the Core. Every LIVE branch below hangs on this one word of the runtime. */
  const live = isLiveLogin(coreLink);
  const mobileLive = useMobileLive();
  /** LIVE: how the chip, the ring and the ambient loops read the link (`null` in the other modes). */
  const linkNotice = useCoreLinkNotice();
  const coreLook = live ? liveCoreLookOf(linkNotice) : null;

  const form = useForm<LoginFormInput, unknown, LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: EMPTY_LOGIN_FORM,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const [pending, setPending] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<AttemptOutcome | null>(null);
  const [attempted, setAttempted] = useState(false);
  /** Both fields show the red border after a credential error, until either is edited (M-C-22). */
  const [credentialsFlagged, setCredentialsFlagged] = useState(false);
  const [unlockPulse, setUnlockPulse] = useState(0);
  /**
   * The inputs are uncontrolled: a controlled `value` dropped keystrokes on the emulator whenever
   * the JS thread lagged behind a burst of input (DR-S75-5). A programmatic change (demo fill, the
   * password cleared after an attempt) is pushed into an input as a one-off `value` override, which
   * the next keystroke in that field releases. (Remounting a `secureTextEntry` input with a
   * `defaultValue` came up empty on Android, so overrides are applied to the mounted input.)
   */
  const [overrides, setOverrides] = useState<FieldOverrides>({});
  /** Counts rejected password attempts; the card puts the focus back into the password field. */
  const [rejectSeq, setRejectSeq] = useState(0);
  /** LIVE LB-10: a LIVE sign-in ended UNAVAILABLE and its refusal is classified on the next render. */
  const [awaitingLimit, setAwaitingLimit] = useState(false);

  const { lockout, biometric, signInWithBiometric: biometricSignIn, signInFailure } = session;
  const coreBlocked = isCoreBlocked(coreLink);
  const submitDisabled = isSubmitDisabled({ locked: lockout.locked, pending, coreBlocked });

  // LIVE: the offline Alert follows the link's heartbeat without flicker (CONNECTING keeps what is
  // shown), while Sign In stays disabled for as long as the link is not ONLINE. State derived from
  // a changed input, adjusted while rendering (no effect, no extra frame).
  const linkHeartbeat = coreLink.heartbeat;
  const [heartbeatSeen, setHeartbeatSeen] = useState(linkHeartbeat);
  const [liveOfflineShown, setLiveOfflineShown] = useState(() => live && liveOfflineNoticeAfter(false, linkHeartbeat));
  if (heartbeatSeen !== linkHeartbeat) {
    setHeartbeatSeen(linkHeartbeat);
    setLiveOfflineShown(live && liveOfflineNoticeAfter(liveOfflineShown, linkHeartbeat));
  }

  // §6.3 step 2: ask the OS once the screen is up (hardware, enrolment).
  const { refreshBiometricAvailability } = session;
  useEffect(() => {
    refreshBiometricAvailability().catch((error: unknown) => reportRuntimeIssue('warn', 'login.biometric.availability', error));
  }, [refreshBiometricAvailability]);

  // Lockout edges: closing → error haptic; opening at zero → one gold glow pulse (M-C-22).
  const wasLocked = useRef(lockout.locked);
  useEffect(() => {
    if (lockout.locked && !wasLocked.current) haptic('lockout');
    if (!lockout.locked && wasLocked.current) setUnlockPulse((n) => n + 1);
    wasLocked.current = lockout.locked;
  }, [lockout.locked, haptic]);

  const settle = useCallback(
    (outcome: AttemptOutcome | null) => {
      setAttempted(true);
      setLastAttempt(outcome);
    },
    [],
  );

  /** The password never outlives the attempt (§6.1): out of the form, and out of the mounted input. */
  const clearPassword = useCallback(() => {
    form.setValue('password', '');
    setOverrides((current) => ({ ...current, password: '' }));
  }, [form]);

  // LIVE, LB-10 (AC-C-110): a limit keeps the form filled, because the Core server did not look at
  // the attempt. Whether a rejected sign-in was a limit is the auth layer's to say (`signInFailure`),
  // and its state reaches this hook with the render after the attempt, not inside the attempt's own
  // closure. So a LIVE attempt that ended `UNAVAILABLE` leaves the field as it is and marks itself
  // (`awaitingLimit`); the first render that carries its outcome also carries the auth layer's word
  // (set before the sign-in call returned), and this render-time adjustment — the same pattern as the
  // offline Alert above, no ref and no effect — then clears the password unless that word is a limit.
  if (awaitingLimit) {
    setAwaitingLimit(false);
    if (!isLimitFailure(signInFailure)) clearPassword();
  }

  const submit = form.handleSubmit(async ({ username, password }) => {
    if (submitDisabled) return;
    const correlationId = newCorrelationId('login');
    let passwordDecidedLater = false;
    haptic('primaryPress');
    setPending(true);
    try {
      const result = await auth.signIn(username, password);
      if (result.ok) {
        settle(null);
        haptic('signInSuccess');
        onAccepted?.();
        return;
      }
      switch (result.reason) {
        case 'INVALID_CREDENTIALS':
          settle({ kind: 'invalid', attemptsRemaining: result.attemptsRemaining ?? 0 });
          setCredentialsFlagged(true);
          setRejectSeq((n) => n + 1);
          haptic('signInFailure');
          onRejected?.();
          break;
        case 'LOCKED':
          // The lockout Alert comes from the live lockout state; the haptic from its edge.
          settle(null);
          setCredentialsFlagged(true);
          onRejected?.();
          break;
        case 'CORE_OFFLINE':
          settle({ kind: 'core-offline' });
          haptic('signInFailure');
          break;
        default:
          // LIVE: what the refusal was arrives with the next render (see `awaitingLimit`).
          if (live) {
            setAwaitingLimit(true);
            passwordDecidedLater = true;
          }
          settle({ kind: 'unavailable' });
          reportRuntimeIssue('warn', 'login.signIn', 'Sign-in unavailable', { reason: result.reason }, correlationId);
      }
    } catch (error) {
      settle({ kind: 'unavailable' });
      reportRuntimeIssue('error', 'login.signIn', error, undefined, correlationId);
    } finally {
      // The password never outlives the attempt (§6.1). The one exception is a limit in LIVE mode.
      if (!passwordDecidedLater) clearPassword();
      setPending(false);
    }
  });

  const signInWithBiometric = async () => {
    if (submitDisabled) return;
    const correlationId = newCorrelationId('login-bio');
    setPending(true);
    try {
      const result = await biometricSignIn();
      switch (result.kind) {
        case 'signed-in':
          settle(null);
          haptic('signInSuccess');
          onAccepted?.();
          break;
        case 'cancelled':
          // §6.3: user_cancel / system_cancel → no audit, stay.
          break;
        case 'lockout':
          settle({ kind: 'biometric-lockout' });
          haptic('signInFailure');
          break;
        case 'failed':
          settle({ kind: 'biometric-failed', attemptsRemaining: result.attemptsRemaining });
          haptic('signInFailure');
          onRejected?.();
          break;
        case 'locked':
          settle(null);
          onRejected?.();
          break;
        case 'core-offline':
          settle({ kind: 'core-offline' });
          break;
        case 'not-enrolled':
        case 'unavailable':
          // The button re-renders from the refreshed availability (caption or hidden).
          break;
        case 'invalid':
          // LIVE (MB-3): the stored token can never sign in again. The auth layer deleted it and
          // holds the notice that says so; this screen shows nothing of its own.
          settle(null);
          haptic('signInFailure');
          break;
        default:
          settle({ kind: 'biometric-error' });
          reportRuntimeIssue('warn', 'login.biometric', 'Biometric sign-in ended with an error', undefined, correlationId);
      }
    } catch (error) {
      settle({ kind: 'biometric-error' });
      reportRuntimeIssue('error', 'login.biometric', error, undefined, correlationId);
    } finally {
      setPending(false);
    }
  };

  /** L10: a demo operator row fills both fields with the published demo credentials. */
  const fill = useCallback(
    (username: string, password: string) => {
      form.setValue('username', username, { shouldDirty: true });
      form.setValue('password', password, { shouldDirty: true });
      form.clearErrors();
      setCredentialsFlagged(false);
      setOverrides({ username, password });
    },
    [form],
  );

  /** A keystroke: clears the red borders and releases that field's override. */
  const onEdit = useCallback((field: keyof FieldOverrides) => {
    setCredentialsFlagged(false);
    setOverrides((current) => {
      if (current[field] === undefined) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  // L9 Core offline → Retry: reconnect the heartbeat now (rate-limited). In LIVE mode the Live
  // source owns the one socket (its heartbeat view can neither be stopped nor started): it is
  // asked to reconnect, on the same cooldown.
  const reconnect = useCallback(() => {
    try {
      if (mobileLive !== null) {
        mobileLive.reconnect('RETRY');
        return;
      }
      if (!heartbeat) return;
      heartbeat.stop();
      heartbeat.start();
    } catch (error) {
      reportRuntimeIssue('warn', 'login.coreRetry', error);
    }
  }, [heartbeat, mobileLive]);
  const coreRetry = useRetryCooldown(reconnect);

  /**
   * LIVE, Core offline → "Use Simulated mode" (§3.5; LIVE exists in debug builds only, MD-3). The
   * runtime mounts the simulator in place of the Live source; the boot router picks the screen.
   * Nobody is signed in on this screen, so nothing is signed out and nothing is asked first.
   */
  const switchToSimulated = useCallback(() => {
    try {
      reportRuntimeIssue('info', 'login.useSimulated', 'Core link source set to SIMULATED from the Login screen');
      setCoreLinkSource('SIMULATED');
      router.replace('/');
    } catch (error) {
      reportRuntimeIssue('error', 'login.useSimulated', error);
    }
  }, []);

  const notice = noticeFor({
    lockout,
    // LIVE: the Alert of the link, without flicker. HEARTBEAT: the link itself, as before.
    coreBlocked: live ? liveOfflineShown : coreBlocked,
    lastAttempt: live ? liveAttemptFor(lastAttempt, signInFailure) : lastAttempt,
    lastSignOut: attempted ? null : session.lastSignOut,
    authNotice: session.notice?.kind ?? null,
  });

  return {
    form,
    submit,
    signInWithBiometric,
    fill,
    onEdit,
    pending,
    notice,
    coreLink,
    coreLook,
    coreBlocked,
    lockout,
    biometric,
    submitDisabled,
    credentialsFlagged,
    unlockPulse,
    coreRetry,
    overrides,
    rejectSeq,
    live,
    switchToSimulated,
  };
}

export type LoginController = ReturnType<typeof useLoginController>;
