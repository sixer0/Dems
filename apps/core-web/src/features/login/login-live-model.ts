/**
 * Live rules of the Login page (backend task 04_client_integration_spec §5.5 WS-2 to WS-7, §5.6
 * WS-14, §6.4, §6.5, §8.1 LB-10, §8.2 A1; brief list row 16 of implementation/44_live_source.md
 * §17.4; plan row W55).
 *
 * Pure functions only: what the page shows for a session end the Live source reports, for a
 * sign-in that was rejected, and for the health answer of the Core server. Nothing here is used
 * in Simulated mode. Like `./login-model`, no output ever holds a credential.
 *
 * **Why the operator is on the page** (`liveArrivalNoticeFor`), from `live.lastSessionEnd`. The
 * notice is in memory only: after a reload the Live source reports none (WS-6).
 *
 * | The end the Live source reports | Notice |
 * |---------------------------------|--------|
 * | None, or an end while nobody was signed in (the credential of the socket was refused) | none |
 * | This console's own sign-out: `signOut` is `LOCK` | "Console locked" |
 * | This console's own sign-out: `signOut` is `USER` | "You have been signed out." |
 * | `IDLE_EXPIRED`, whatever the source (the Core said it, confirmed it, or could not be asked) | "Your session expired after 15 minutes without activity." |
 * | `ABSOLUTE_EXPIRED` | "Your session reached its 8-hour limit." (WS-14) |
 * | `USER_DISABLED` | "This account was disabled by an administrator." (danger, §6.4) |
 * | `SIGNED_OUT` or `ROTATED` that this console did not send (a sign-out, a Lock or another sign-in elsewhere in this browser) | "You have been signed out." |
 * | No reason (an invalid cookie), `TOKEN_REUSE` (never sent to a web session), a revoked device | none |
 *
 * **A sign-in that was rejected** (`signInFailureFor`; §8.2 A1). A wrong password and a locked
 * console are NOT rejections: the action resolves with the simulator's own result union for them
 * (CL-19). The first matching row decides:
 *
 * | # | What the action rejected with | The page shows |
 * |--:|-------------------------------|----------------|
 * | 1 | `STOPPED`: the data source was stopped (a mode switch) | Nothing: the page is being replaced |
 * | 2 | A 429 | The limit toast with the seconds of `retry-after`; the form keeps what was typed; never the offline Alert (LB-10) |
 * | 3 | No answer, a time-out, the link not ONLINE | The offline Alert, not "unexpected" |
 * | 4 | 503 `NOT_READY` | The offline Alert in its "starting" wording (§3.5) |
 * | 5 | The sign-in was accepted and the Core state did not arrive (§5.2 step 6) | The presenter's toast; the page hands off when the state arrives |
 * | 6 | Another answer without a usable result (a 500, an answer outside the contract), or an action that does not exist in Live mode | The presenter's toast |
 * | 7 | 403 `ORIGIN_NOT_ALLOWED` (the console is open at an address the Core server does not accept, WT-2a) | The "unexpected" Alert; the presenter names the address to open and writes the record that names the cause |
 * | 8 | 422: the Core server refused the input itself | The "input rejected" Alert. The form keeps its own bounds and adds no second rule set: the server is the judge |
 * | 9 | Anything else (403 `DEVICE_NOT_PAIRED`, an unknown error) | The "unexpected" Alert, and one record that names the cause |
 */
import type { HealthResponse } from '@dems/shared/api'
import { SimErrorCode, SimTransitionError } from '@dems/shared/sim'
import { CoreErrorNoticeKind, type CoreErrorNotice } from '@/lib/core-errors'
import type { WebLive } from '@/runtime'
import type { ArrivalNotice, AttemptOutcome } from './login-model'

/** Why the last session ended, as the Live source reports it (`live.lastSessionEnd`). */
export type LiveSessionEnd = NonNullable<WebLive['lastSessionEnd']>

/** The arrival notice of the Login page in Live mode (the table above). */
export function liveArrivalNoticeFor(end: LiveSessionEnd | null): ArrivalNotice {
  if (end === null || end.kind !== 'SESSION_ENDED' || !end.wasSignedIn) return null
  if (end.signOut === 'LOCK') return 'console-locked'
  if (end.signOut === 'USER') return 'signed-out'
  switch (end.reason) {
    case 'IDLE_EXPIRED':
      return 'expired'
    case 'ABSOLUTE_EXPIRED':
      return 'expired-absolute'
    case 'USER_DISABLED':
      return 'disabled'
    case 'SIGNED_OUT':
    case 'ROTATED':
      return 'signed-out'
    default:
      return null
  }
}

/** What the page does with a rejected sign-in (the second table above). */
export type SignInFailureView =
  /** Row 1: nothing is shown. */
  | { readonly kind: 'stopped' }
  /** Row 2: the presenter's limit toast; the form is put back as it was typed. */
  | { readonly kind: 'limit' }
  /** Rows 5 and 6: the presenter words it; the card shows no Alert of this attempt. */
  | { readonly kind: 'toast' }
  /**
   * Rows 3, 4, 7, 8, 9: the card's Alert. `present`: the presenter is called as well (row 7).
   * `report`: the page writes the record that names the cause (row 9; in row 7 the presenter does).
   */
  | { readonly kind: 'alert'; readonly outcome: AttemptOutcome; readonly present: boolean; readonly report: boolean }

/**
 * `notice` is what the shared presenter says about `error` (`describeCoreError`); `null` when it
 * leaves the error to the page.
 */
export function signInFailureFor(error: unknown, notice: CoreErrorNotice | null): SignInFailureView {
  switch (notice?.kind) {
    case CoreErrorNoticeKind.STOPPED:
      return { kind: 'stopped' }
    case CoreErrorNoticeKind.LIMIT:
      return { kind: 'limit' }
    case CoreErrorNoticeKind.OFFLINE:
    case CoreErrorNoticeKind.TIMED_OUT:
      return { kind: 'alert', outcome: { kind: 'core-offline' }, present: false, report: false }
    case CoreErrorNoticeKind.STARTING:
      return { kind: 'alert', outcome: { kind: 'core-starting' }, present: false, report: false }
    case CoreErrorNoticeKind.SNAPSHOT_TIMEOUT:
    case CoreErrorNoticeKind.UNAVAILABLE:
    case CoreErrorNoticeKind.NOT_SENT:
    case CoreErrorNoticeKind.NOT_AVAILABLE:
    case CoreErrorNoticeKind.DEMO_DISABLED:
      return { kind: 'toast' }
    case CoreErrorNoticeKind.ORIGIN_NOT_ALLOWED:
      return { kind: 'alert', outcome: { kind: 'unexpected' }, present: true, report: false }
    default:
      break
  }
  // A 422 reaches the page as the simulator's own class with the code of an invalid input (CL-20).
  if (error instanceof SimTransitionError && error.code === SimErrorCode.INVALID_INPUT) {
    return { kind: 'alert', outcome: { kind: 'input-rejected' }, present: false, report: false }
  }
  // Also a "signed out" or a "not permitted" answer: neither can be true of a sign-in, so the page says so itself.
  return { kind: 'alert', outcome: { kind: 'unexpected' }, present: false, report: true }
}

/**
 * The non-secret facts of a rejected sign-in for the page's record: the class of the error and,
 * where it has them, its code and status. Never its message: the Live classes write a fixed text,
 * an unknown error may not.
 */
export function signInFailureFacts(error: unknown): { errorName: string; code: string | null; status: number | null } {
  const candidate = (typeof error === 'object' && error !== null ? error : {}) as { name?: unknown; code?: unknown; status?: unknown }
  return {
    errorName: typeof candidate.name === 'string' ? candidate.name : typeof error,
    code: typeof candidate.code === 'string' ? candidate.code : null,
    status: typeof candidate.status === 'number' ? candidate.status : null,
  }
}

// ── Health (WS-5; §3.5) ──────────────────────────────────────────────────────────────────

export type CoreReadiness = 'ready' | 'not-ready' | 'unknown'

/** One member of `ready` of the health answer. `unknown`: no answer yet, or a service that reports none. */
export function readinessOf(value: boolean | undefined): CoreReadiness {
  return value === undefined ? 'unknown' : value ? 'ready' : 'not-ready'
}

/** §3.5: the Core server answers, and its database or its engine is not ready yet. */
export function isCoreStarting(health: Pick<HealthResponse, 'ready'> | undefined): boolean {
  return health?.ready !== undefined && !(health.ready.database && health.ready.engine)
}

/** How often the health answer is asked for again: sooner while the Core server is starting. */
export const HEALTH_REFETCH_MS = 10_000
export const HEALTH_STARTING_REFETCH_MS = 2_000
