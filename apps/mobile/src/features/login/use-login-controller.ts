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
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { HeartbeatContext, useRetryCooldown } from '@dems/shared/realtime';
import { useAuthSession } from '@/auth';
import { useHaptics } from '@/motion';
import { newCorrelationId, reportRuntimeIssue, useAuth, useCoreLink } from '@/runtime';
import {
  EMPTY_LOGIN_FORM,
  isCoreBlocked,
  isSubmitDisabled,
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

  const { lockout, biometric, signInWithBiometric: biometricSignIn } = session;
  const coreBlocked = isCoreBlocked(coreLink);
  const submitDisabled = isSubmitDisabled({ locked: lockout.locked, pending, coreBlocked });

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

  const submit = form.handleSubmit(async ({ username, password }) => {
    if (submitDisabled) return;
    const correlationId = newCorrelationId('login');
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
          settle({ kind: 'unavailable' });
          reportRuntimeIssue('warn', 'login.signIn', 'Sign-in unavailable', { reason: result.reason }, correlationId);
      }
    } catch (error) {
      settle({ kind: 'unavailable' });
      reportRuntimeIssue('error', 'login.signIn', error, undefined, correlationId);
    } finally {
      // The password never outlives the attempt (§6.1).
      form.setValue('password', '');
      setOverrides((current) => ({ ...current, password: '' }));
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

  // L9 Core offline → Retry: reconnect the heartbeat now (rate-limited).
  const reconnect = useCallback(() => {
    if (!heartbeat) return;
    try {
      heartbeat.stop();
      heartbeat.start();
    } catch (error) {
      reportRuntimeIssue('warn', 'login.coreRetry', error);
    }
  }, [heartbeat]);
  const coreRetry = useRetryCooldown(reconnect);

  const notice = noticeFor({
    lockout,
    coreBlocked,
    lastAttempt,
    lastSignOut: attempted ? null : session.lastSignOut,
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
    coreBlocked,
    lockout,
    biometric,
    submitDisabled,
    credentialsFlagged,
    unlockPulse,
    coreRetry,
    overrides,
    rejectSeq,
  };
}

export type LoginController = ReturnType<typeof useLoginController>;
