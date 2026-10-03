/**
 * Login behaviour (01_specs §14.8; research/04 §5.8; 03_motion_spec M-C-22).
 *
 * States: Idle, Validating, Submitting, Error, Locked out, Core offline, Signed out / expired,
 * Success (`displayState`, exposed on the page as `data-state`).
 *
 * - **Credentials** live only in this hook's state while typed, and in the one simulator call
 *   (`actions.signIn(username, password)`). The password is cleared after every attempt, never
 *   logged, never written to storage, the URL or an event (AC-50, design book §20.1).
 * - **Policy** is the simulator's (`auth.ts`): 5 failures in 5 min → locked for 60 s on the
 *   simulator clock, audit AUTH_SUCCESS / AUTH_FAILED / AUTH_LOCKED. This hook only displays it:
 *   the lockout countdown is derived in whole seconds inside the selector (review 40 R8, m9), so
 *   it re-renders at 1 Hz, not at the 10 Hz clock tick.
 * - **Core offline** (heartbeat) disables Sign In and the security key. Retry restarts the
 *   heartbeat client now instead of waiting for its backoff, rate-limited 3 s → 6 s → 12 s, at
 *   most 3 times (`useRetryCooldown`), exactly as the mobile Login does.
 * - **Submitting** is a short simulated verification beat (`VERIFY_BEAT_MS`), because the
 *   simulator answers synchronously; "Use security key (simulated)" waits 1.2 s (D28/Q15) and
 *   signs in as the SUPERVISOR operator.
 * - Unexpected failures (a throwing action, an unreachable heartbeat client) show the generic copy
 *   and are reported as structured entries with a correlation ID and no credential.
 */
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { MotionGlobalConfig } from 'motion/react'
import { HeartbeatContext, useHeartbeat, useRetryCooldown } from '@dems/shared/realtime'
import {
  DEMO_OPERATOR_PASSWORD,
  selectLockout,
  useSim,
  useSimInstance,
  type SignInResult,
  type SimOperator,
} from '@dems/shared/sim'
import {
  arrivalNoticeFor,
  coreLinkFor,
  displayStateFor,
  fieldErrorFor,
  hasFieldErrors,
  isCoreBlocked,
  isSubmitDisabled,
  noticeFor,
  SECURITY_KEY_PROMPT_MS,
  validateCredentials,
  VERIFY_BEAT_MS,
  withFieldError,
  type ArrivalNotice,
  type AttemptOutcome,
  type FieldErrors,
  type LoginField,
} from './login-model'
import { newLoginCorrelationId, reportLoginIssue } from './report'
import { readLastAuthEvent } from './sim-adapter'

export type { LoginField } from './login-model'
export type PendingMethod = 'password' | 'security-key'

export interface LoginControllerOptions {
  /** The top-level route shown before `/login` mounted (`/_app` after a sign-out from the shell). */
  previousTopLevel: string | undefined
  /** The simulator accepted the operator: play the hand-off (M-APP-01, Login half). */
  onAccepted: (operatorId: string) => void
  /** A credential error: one card shake (M-C-22). */
  onRejected: () => void
  /** Move focus to a field (the first invalid one, or the cleared password after an error). */
  onFocusField: (field: LoginField) => void
}

/** A presentational beat: skipped when Motion skips animations (tests, automation). */
function beatMs(ms: number): number {
  return MotionGlobalConfig.skipAnimations ? 0 : ms
}

const selectLockoutView = (s: Parameters<typeof selectLockout>[0]) => {
  const lockout = selectLockout(s)
  // Whole seconds inside the selector: re-render at 1 Hz, not at the 100 ms clock tick (R8).
  return {
    locked: lockout.locked,
    retryInSeconds: lockout.locked ? Math.ceil(lockout.retryInMs / 1000) : 0,
  }
}

export function useLoginController({ previousTopLevel, onAccepted, onRejected, onFocusField }: LoginControllerOptions) {
  const sim = useSimInstance()
  const actions = sim.actions
  const heartbeatClient = useContext(HeartbeatContext)
  const heartbeat = useHeartbeat()
  const coreLink = coreLinkFor(heartbeat)
  const coreBlocked = isCoreBlocked(coreLink)
  const lockout = useSim(selectLockoutView)
  const operators = useSim((s) => s.operators)
  const pairing = useSim((s) => s.pairing.state)

  // Why the operator is here (M-APP-02): read once, when the page mounts (the sim's selectLastSignOut).
  const [arrival] = useState<ArrivalNotice>(() =>
    arrivalNoticeFor({
      authStatus: sim.store.getState().auth.status,
      previousTopLevel,
      lastEvent: readLastAuthEvent(sim),
    }),
  )

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [dirty, setDirty] = useState<{ username: boolean; password: boolean }>({ username: false, password: false })
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [pending, setPending] = useState<PendingMethod | null>(null)
  const [accepted, setAccepted] = useState<SimOperator | null>(null)
  const [lastAttempt, setLastAttempt] = useState<AttemptOutcome | null>(null)
  const [attempted, setAttempted] = useState(false)
  /** Both fields show the red border after a credential error, until either is edited (M-C-22). */
  const [credentialsFlagged, setCredentialsFlagged] = useState(false)

  // Lockout edges, derived during render (no effect round-trip): at zero the form re-enables with
  // one gold glow pulse; closing the lock bumps `lockKey` (the shackle closes, M-C-22).
  const [edge, setEdge] = useState({ locked: lockout.locked, unlockPulse: 0, lockKey: 0 })
  if (edge.locked !== lockout.locked) {
    setEdge({
      locked: lockout.locked,
      unlockPulse: lockout.locked ? edge.unlockPulse : edge.unlockPulse + 1,
      lockKey: lockout.locked ? edge.lockKey + 1 : edge.lockKey,
    })
  }

  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  useEffect(() => {
    const pendingTimers = timers.current
    return () => {
      for (const id of pendingTimers) clearTimeout(id)
      pendingTimers.clear()
    }
  }, [])
  const schedule = useCallback((ms: number, run: () => void) => {
    const id = setTimeout(() => {
      timers.current.delete(id)
      run()
    }, ms)
    timers.current.add(id)
  }, [])

  const submitDisabled = isSubmitDisabled({
    locked: lockout.locked,
    pending: pending !== null,
    success: accepted !== null,
    coreBlocked,
  })

  const settle = useCallback(
    (result: SignInResult) => {
      setPending(null)
      setAttempted(true)
      if (result.ok) {
        setLastAttempt(null)
        setAccepted(operators.find((operator) => operator.id === result.operatorId) ?? null)
        onAccepted(result.operatorId)
        return
      }
      if (result.reason === 'INVALID_CREDENTIALS') {
        setLastAttempt({ kind: 'invalid', attemptsRemaining: result.attemptsRemaining })
      } else {
        // LOCKED: the Alert comes from the live lockout state (the simulator clock owns it).
        setLastAttempt(null)
      }
      setCredentialsFlagged(true)
      onRejected()
      onFocusField('password')
    },
    [operators, onAccepted, onRejected, onFocusField],
  )

  const fail = useCallback((source: string, error: unknown, correlationId: string, method: PendingMethod) => {
    setPending(null)
    setAttempted(true)
    setLastAttempt({ kind: 'unexpected' })
    reportLoginIssue('error', source, error, { method }, correlationId)
  }, [])

  // Plain functions (not memoised): they read the latest fields and are only passed to handlers.
  const submit = () => {
    if (submitDisabled) return
    setSubmitAttempted(true)
    const errors = validateCredentials(username, password)
    setFieldErrors(errors)
    if (hasFieldErrors(errors)) {
      onFocusField(errors.username ? 'username' : 'password')
      return
    }
    const correlationId = newLoginCorrelationId('login')
    const typedUsername = username.trim()
    const typedPassword = password
    setPending('password')
    schedule(beatMs(VERIFY_BEAT_MS), () => {
      let result: SignInResult
      try {
        result = actions.signIn(typedUsername, typedPassword)
      } catch (error) {
        fail('login.signIn', error, correlationId, 'password')
        return
      } finally {
        // The password never outlives the attempt (§14.8), whatever the outcome.
        setPassword('')
      }
      settle(result)
    })
  }

  const signInWithSecurityKey = () => {
    if (submitDisabled) return
    const correlationId = newLoginCorrelationId('login-key')
    setPending('security-key')
    schedule(beatMs(SECURITY_KEY_PROMPT_MS), () => {
      let result: SignInResult
      try {
        result = actions.signInWithSecurityKey()
      } catch (error) {
        fail('login.securityKey', error, correlationId, 'security-key')
        return
      }
      settle(result)
    })
  }

  const change = useCallback(
    (field: LoginField, value: string) => {
      if (field === 'username') setUsername(value)
      else setPassword(value)
      setCredentialsFlagged(false)
      if (value.length > 0) setDirty((current) => (current[field] ? current : { ...current, [field]: true }))
      // After a submit, an error clears as soon as the field is filled (and comes back if emptied).
      if (submitAttempted || fieldErrors[field]) {
        setFieldErrors((current) => withFieldError(current, field, fieldErrorFor(field, value)))
      }
    },
    [submitAttempted, fieldErrors],
  )

  /** Validating on blur: an emptied field (one the operator typed in) shows its error. */
  const blur = useCallback(
    (field: LoginField) => {
      if (!dirty[field] && !submitAttempted) return
      const value = field === 'username' ? username : password
      setFieldErrors((current) => withFieldError(current, field, fieldErrorFor(field, value)))
    },
    [dirty, submitAttempted, username, password],
  )

  /** A demo operator row fills both fields with the published demo credentials (§14.8). */
  const fill = useCallback((operator: SimOperator) => {
    setUsername(operator.username)
    setPassword(DEMO_OPERATOR_PASSWORD)
    setFieldErrors({})
    setCredentialsFlagged(false)
  }, [])

  // Core offline → Retry: reconnect the heartbeat now (rate-limited).
  const reconnect = useCallback(() => {
    if (!heartbeatClient) return
    try {
      heartbeatClient.stop()
      heartbeatClient.start()
    } catch (error) {
      reportLoginIssue('warn', 'login.coreRetry', error)
    }
  }, [heartbeatClient])
  const coreRetry = useRetryCooldown(reconnect)

  const notice = noticeFor({ lockout, coreBlocked, lastAttempt, arrival: attempted ? null : arrival })
  const displayState = displayStateFor({ success: accepted !== null, pending: pending !== null, notice, fieldErrors })

  return {
    username,
    password,
    change,
    blur,
    submit,
    signInWithSecurityKey,
    fill,
    pending,
    accepted,
    notice,
    displayState,
    fieldErrors,
    credentialsFlagged,
    lockout,
    unlockPulse: edge.unlockPulse,
    lockKey: edge.lockKey,
    coreLink,
    heartbeatState: heartbeat.state,
    coreBlocked,
    coreRetry,
    submitDisabled,
    operators,
    paired: pairing === 'PAIRED',
    arrival,
  }
}

export type LoginController = ReturnType<typeof useLoginController>
