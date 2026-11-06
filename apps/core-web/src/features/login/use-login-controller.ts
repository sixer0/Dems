/**
 * Login behaviour (01_specs §14.8; research/04 §5.8; 03_motion_spec M-C-22).
 *
 * States: Idle, Validating, Submitting, Error, Locked out, Core offline, Signed out / expired,
 * Success (`displayState`, exposed on the page as `data-state`).
 *
 * - **Credentials** live only in this hook's state while typed, and in the one call of the
 *   sign-in action (`signIn(username, password)`). The password is cleared after every attempt,
 *   never logged, never written to storage, the URL or an event (AC-50, design book §20.1).
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
 *
 * **Live mode** (backend task 04_client_integration_spec §5.2 to §5.6, §8.2 A1; plan row W55).
 * The page runs on the Core server when the source in the context is the Live source
 * (`useWebLive()` is not null). The states, the Alert and the motion are the same; what changes
 * is where each value comes from. Everything below is behind `live !== null`, so the simulator
 * path above is as it was:
 *
 * | | Live mode |
 * |-|-----------|
 * | Submit (WS-1) | The request is handed over at once. The Submitting state stays until the action settles, and at least `VERIFY_BEAT_MS`. It has no time-out of its own: a sign-in can wait up to 16 s behind an owed sign-out (brief list row 31), and the form cannot be submitted twice meanwhile. The password state is cleared when the request is handed over |
 * | Wrong password (WS-2), lockout (WS-3) | The action resolves with the simulator's own result union (401, 423); the countdown is the same selector on the Live clock |
 * | A rejected sign-in | `./login-live-model` (`signInFailureFor`): a 429 shows the limit toast and puts the form back (LB-10); no answer shows the offline Alert; a 422 is shown as the server's refusal of the input (the form adds no second rule set); the rest is "unexpected" with a record that names the cause |
 * | Policy | The Core server's: this hook displays what it answers |
 * | Core offline (WS-4) | The same gate on the Live socket's heartbeat view; Retry asks the Live source for a new socket now (CL-11a), and the query bridge asks for the health answer again when that socket is back. A Core server that answers but is not ready blocks sign-in with the "starting" wording (§3.5) |
 * | Why the operator arrived (WS-6) | `live.lastSessionEnd`, read once at mount; in memory only |
 * | A session found without a submit (§5.4) | The page runs its normal hand-off when the store becomes SIGNED_IN while it is on screen: a sign-in whose Core state arrived late, a session the Core turned out to hold still, a sign-in in another tab found at a reconnect |
 * | Demo operators (WS-9 C2) | The three seeded operators of the shared `OPERATORS` constant: the replica holds no operator before sign-in |
 * | Pairing (WS-7) | Not read: the web console does not pair |
 * | Security key (WS-8) | No such operation: the button is not rendered |
 * | Session | The server's cookie. This hook never sees a token, and nothing about the session is written to web storage |
 */
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { MotionGlobalConfig } from 'motion/react'
import { CoreMode, settle, useCoreActions } from '@dems/shared/live'
import { HeartbeatContext, useHeartbeat, useRetryCooldown } from '@dems/shared/realtime'
import {
  DEMO_OPERATOR_PASSWORD,
  OPERATORS,
  selectIsSignedIn,
  selectLockout,
  useSim,
  useSimInstance,
  type SignInResult,
  type SimOperator,
  type SimState,
} from '@dems/shared/sim'
import { describeCoreError, useCoreErrorPresenter } from '@/lib/core-errors'
import { useWebLive, webErrorSink } from '@/runtime'
import { useLiveCoreHealth } from './live-adapter'
import { isCoreStarting, liveArrivalNoticeFor, signInFailureFacts, signInFailureFor } from './login-live-model'
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
import { newLoginCorrelationId, recordLoginIssue, reportLoginIssue } from './report'
import { readLastAuthEvent } from './sim-adapter'

export type { LoginField } from './login-model'
export type PendingMethod = 'password' | 'security-key'

export interface LoginControllerOptions {
  /** The top-level route shown before `/login` mounted (`/_app` after a sign-out from the shell). */
  previousTopLevel: string | undefined
  /** The operator was accepted: play the hand-off (M-APP-01, Login half). */
  onAccepted: (operatorId: string) => void
  /** A credential error: one card shake (M-C-22). */
  onRejected: () => void
  /** Move focus to a field (the first invalid one, or the cleared password after an error). */
  onFocusField: (field: LoginField) => void
  /** Live mode: the session ended before the hand-off left the page; the form comes back. */
  onHandOffLost?: () => void
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

const selectOperators = (s: SimState) => s.operators
const selectPairingState = (s: SimState) => s.pairing.state
/** WS-7: the web console does not pair, so the pairing slice is not read in Live mode. */
const pairingNotRead = (_state: SimState) => null

export function useLoginController({ previousTopLevel, onAccepted, onRejected, onFocusField, onHandOffLost }: LoginControllerOptions) {
  const sim = useSimInstance()
  const actions = useCoreActions()
  /** The Live source, or `null` on the simulator. Every Live rule of this hook is behind it. */
  const live = useWebLive()
  const isLive = live !== null
  const presentCoreError = useCoreErrorPresenter()
  const heartbeatClient = useContext(HeartbeatContext)
  const heartbeat = useHeartbeat()
  const coreLink = coreLinkFor(heartbeat)
  const coreUnreachable = isCoreBlocked(coreLink)
  // Live mode only (nothing is asked on the simulator): the Core server answers, and is not ready yet (§3.5).
  const health = useLiveCoreHealth(isLive)
  const coreStarting = isLive && !coreUnreachable && !health.isError && isCoreStarting(health.data)
  const coreBlocked = coreUnreachable || coreStarting
  const lockout = useSim(selectLockoutView)
  const simOperators = useSim(selectOperators)
  // WS-9 C2: before sign-in the replica holds no operator; the seeded ones are the shared constant.
  const operators = isLive ? OPERATORS : simOperators
  const pairing = useSim(isLive ? pairingNotRead : selectPairingState)

  // Why the operator is here (M-APP-02): read once, when the page mounts. The simulator's
  // `selectLastSignOut`; in Live mode what the Live source says about the last session end (WS-6).
  const [arrival] = useState<ArrivalNotice>(() =>
    live
      ? liveArrivalNoticeFor(live.lastSessionEnd)
      : arrivalNoticeFor({
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
  const [pending, setPendingState] = useState<PendingMethod | null>(null)
  /** `pending`, readable by a store listener (Live mode: is a submit of this page still out?). */
  const pendingRef = useRef<PendingMethod | null>(null)
  const setPending = useCallback((next: PendingMethod | null) => {
    pendingRef.current = next
    setPendingState(next)
  }, [])
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
  /** False once the page is gone: a Live result can settle after it (a mode switch, a hand-off). */
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    const pendingTimers = timers.current
    return () => {
      mounted.current = false
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

  /** The hand-off started and has not been taken back: it starts once per sign-in. */
  const handedOff = useRef(false)
  const accept = useCallback(
    (operatorId: string) => {
      if (handedOff.current) return
      setPending(null)
      setAttempted(true)
      setLastAttempt(null)
      const state = sim.store.getState()
      // Live mode: the outcome can be applied a beat after the answer, and the Core can have ended the session meanwhile.
      if (isLive && !selectIsSignedIn(state)) return
      handedOff.current = true
      setAccepted(state.operators.find((operator) => operator.id === operatorId) ?? null)
      onAccepted(operatorId)
    },
    [sim, isLive, onAccepted, setPending],
  )

  /**
   * §5.4 (Live mode): a session this page did not submit exists while the page is on screen (a
   * sign-in whose Core state arrived late, a session the Core turned out to hold still, a sign-in
   * in another tab found at a reconnect). The page runs its normal hand-off, unless a submit of
   * its own is still out: that one applies its own outcome.
   */
  const acceptFoundSession = useCallback(() => {
    if (!isLive || pendingRef.current !== null) return
    const { auth } = sim.store.getState()
    if (selectIsSignedIn(sim.store.getState()) && auth.operatorId !== null) accept(auth.operatorId)
  }, [isLive, sim, accept])

  const applyResult = useCallback(
    (result: SignInResult) => {
      if (result.ok) {
        accept(result.operatorId)
        return
      }
      setPending(null)
      setAttempted(true)
      if (result.reason === 'INVALID_CREDENTIALS') {
        setLastAttempt({ kind: 'invalid', attemptsRemaining: result.attemptsRemaining })
      } else {
        // LOCKED: the Alert comes from the live lockout state (the clock of the Core owns it).
        setLastAttempt(null)
      }
      setCredentialsFlagged(true)
      onRejected()
      onFocusField('password')
      // Live mode: this attempt gave no session, and the console may hold one all the same.
      acceptFoundSession()
    },
    [accept, acceptFoundSession, onRejected, onFocusField, setPending],
  )

  const fail = useCallback(
    (source: string, error: unknown, correlationId: string, method: PendingMethod) => {
      setPending(null)
      setAttempted(true)
      setLastAttempt({ kind: 'unexpected' })
      reportLoginIssue('error', source, error, { method }, correlationId)
    },
    [setPending],
  )

  /**
   * Live mode: the action rejected (`./login-live-model`, the second table). `typedPassword` is
   * the value this attempt carried: only a 429 puts it back, because the Core server did not look
   * at the attempt (LB-10); it is `null` for an attempt without a password.
   */
  const failLive = useCallback(
    (source: string, error: unknown, correlationId: string, method: PendingMethod, typedPassword: string | null) => {
      const view = signInFailureFor(error, describeCoreError(error))
      setPending(null)
      if (view.kind === 'stopped') return
      if (view.kind === 'limit') {
        presentCoreError(error)
        if (typedPassword !== null) setPassword(typedPassword)
        onFocusField('password')
        acceptFoundSession()
        return
      }
      setAttempted(true)
      if (view.kind === 'toast') {
        presentCoreError(error)
        setLastAttempt(null)
        onFocusField('password')
        acceptFoundSession()
        return
      }
      if (view.present) presentCoreError(error)
      if (view.report) {
        // The cause by its class, code and status: the text of an unknown error is not trusted to be free of input.
        recordLoginIssue(webErrorSink, 'error', source, 'The sign-in was rejected in a way the Login page does not word.', { method, ...signInFailureFacts(error) }, correlationId)
      }
      setLastAttempt(view.outcome)
      if (view.outcome.kind === 'input-rejected') {
        setCredentialsFlagged(true)
        onRejected()
      }
      onFocusField('password')
      acceptFoundSession()
    },
    [presentCoreError, acceptFoundSession, onRejected, onFocusField, setPending],
  )

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

    if (isLive) {
      // WS-1: sent at once. The outcome is applied when the action settled AND the beat is over, so the state never flashes.
      const sentAt = Date.now()
      const afterBeat = (apply: () => void) => {
        if (!mounted.current) return
        const remaining = beatMs(VERIFY_BEAT_MS) - (Date.now() - sentAt)
        if (remaining > 0) schedule(remaining, apply)
        else apply()
      }
      settle(() => actions.signIn(typedUsername, typedPassword), {
        ok: (result) => afterBeat(() => applyResult(result)),
        fail: (error) => afterBeat(() => failLive('login.signIn', error, correlationId, 'password', typedPassword)),
      })
      // The request is handed over: the password state does not outlive that (§14.8; AC-C-44).
      setPassword('')
      return
    }

    schedule(beatMs(VERIFY_BEAT_MS), () => {
      settle(() => actions.signIn(typedUsername, typedPassword), {
        ok: applyResult,
        fail: (error) => fail('login.signIn', error, correlationId, 'password'),
      })
      // The password never outlives the attempt (§14.8), whatever the outcome.
      setPassword('')
    })
  }

  const signInWithSecurityKey = () => {
    if (submitDisabled) return
    const correlationId = newLoginCorrelationId('login-key')
    setPending('security-key')
    schedule(beatMs(SECURITY_KEY_PROMPT_MS), () => {
      settle(() => actions.signInWithSecurityKey(), {
        ok: applyResult,
        // The Core server has no such operation (WS-8): the button is not rendered in Live mode, and a call is refused.
        fail: (error) =>
          isLive ? failLive('login.securityKey', error, correlationId, 'security-key', null) : fail('login.securityKey', error, correlationId, 'security-key'),
      })
    })
  }

  // Live mode: the page follows the session of the console while it is on screen, in the turn in
  // which the Live source reports the change.
  useEffect(() => {
    if (!live) return undefined
    return live.store.subscribe(
      selectIsSignedIn,
      (nowSignedIn) => {
        if (nowSignedIn) {
          // §5.4. A sign-in of this page sets SIGNED_IN before it settles: `pendingRef` keeps that one out.
          acceptFoundSession()
          return
        }
        // The session ended between the sign-in and the moment the hand-off left this page (the
        // Core ended it, or another tab signed out): the form comes back instead of an empty page.
        if (!handedOff.current) return
        handedOff.current = false
        setAccepted(null)
        onHandOffLost?.()
      },
      { fireImmediately: true },
    )
  }, [live, acceptFoundSession, onHandOffLost])

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
    if (live) {
      // CL-11a: the Live source owns the one socket; the heartbeat view's `start` and `stop` do nothing.
      // The health answer needs no call of its own: the query bridge asks for it again when the socket is back.
      try {
        live.reconnect('RETRY')
      } catch (error) {
        recordLoginIssue(webErrorSink, 'warn', 'login.coreRetry', 'The Live socket could not be asked to reconnect.', {
          errorName: error instanceof Error ? error.name : typeof error,
        })
      }
      return
    }
    if (!heartbeatClient) return
    try {
      heartbeatClient.stop()
      heartbeatClient.start()
    } catch (error) {
      reportLoginIssue('warn', 'login.coreRetry', error)
    }
  }, [live, heartbeatClient])
  const coreRetry = useRetryCooldown(reconnect)

  const notice = noticeFor({ lockout, coreBlocked, coreStarting, lastAttempt, arrival: attempted ? null : arrival })
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
    /** The data mode of this page load, from the source in the context (TS-3). */
    mode: isLive ? CoreMode.LIVE : CoreMode.SIMULATED,
    /** Live mode: the Core server answers, and its database or its engine is not ready yet. */
    coreStarting,
  }
}

export type LoginController = ReturnType<typeof useLoginController>
