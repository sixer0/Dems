/**
 * Login view model (masterplan/01_specs.md §14.8; research/04 §5.8; 03_motion_spec M-C-22).
 *
 * Pure functions only, so the §14.8 state table is tested without rendering
 * (`__tests__/login-model.test.tsx`). The rules mirror the mobile Login (04_mobile_specs §4.1,
 * `apps/mobile/src/features/login/login-model.ts`) so both apps behave the same way:
 *
 * - `coreLinkFor`: the mock-core heartbeat → online / connecting / stale / offline. A reconnect
 *   cycle (CONNECTING after at least one failure) still reads as offline, so the state does not
 *   flicker while the client backs off.
 * - `ringStateFor`: lockout → amber (ATTENTION, M-C-22); Core offline → CRITICAL; a stale
 *   heartbeat → ATTENTION; otherwise READY (gold).
 * - `noticeFor`: which one Alert the card shows, most urgent first.
 * - `displayStateFor`: the §14.8 state name the page exposes as `data-state`.
 *
 * Credentials never enter this module's outputs: `validateCredentials` only reports which field
 * is empty, and nothing here stores, logs or returns a password (§14.8, design book §20.1).
 *
 * Live mode (backend task, plan row W55) adds notice kinds and no rule: `core-starting` (the Core
 * server answers, its database or engine is not ready), `input-rejected` (the Core server's 422),
 * `expired-absolute` and `disabled` (two more reasons of a session end). The simulator produces
 * none of them, so every function answers for the simulator as it did. The Live rules themselves
 * are in `./login-live-model`.
 */
import type { HeartbeatSnapshot } from '@dems/shared/realtime'
import { AuthStatus, SignOutReason, type SimEvent } from '@dems/shared/sim'
import type { GlowRingState } from '@/components/composed'
import { coreHttpOrigin } from '@/lib/core-endpoint'

// ── Timing (UI beats, not motion tokens) ─────────────────────────────────────────────────

/**
 * The simulated verification beat between Sign In and the result, so the Submitting state
 * (Spinner, disabled fields, fingerprint scan) is visible: the simulator answers synchronously.
 * Presentational only; it is skipped when Motion skips animations (tests, automation).
 */
export const VERIFY_BEAT_MS = 600
/** "Use security key (simulated)": the simulated authenticator prompt (01_specs §14.8, D28/Q15). */
export const SECURITY_KEY_PROMPT_MS = 1200
/** The idle timeout the "session expired" notice names (01_specs §14.8: 15 min). */
export const IDLE_TIMEOUT_MINUTES = 15

// ── Core link ────────────────────────────────────────────────────────────────────────────

export type CoreLinkView = 'online' | 'connecting' | 'stale' | 'offline'

export function coreLinkFor(snapshot: Pick<HeartbeatSnapshot, 'state' | 'reconnectAttempt'>): CoreLinkView {
  switch (snapshot.state) {
    case 'LIVE':
      return 'online'
    case 'STALE':
      return 'stale'
    case 'OFFLINE':
      return 'offline'
    default:
      // CONNECTING: the first attempt is neutral; a retry after a failure is still offline.
      return snapshot.reconnectAttempt > 0 ? 'offline' : 'connecting'
  }
}

/** Sign In needs the Core: it is disabled while the heartbeat is offline (§14.8 "Core offline"). */
export function isCoreBlocked(coreLink: CoreLinkView): boolean {
  return coreLink === 'offline'
}

/**
 * `host:port` of the Core for the offline Alert ("Core service unreachable at 127.0.0.1:4400.").
 * The default follows lib/core-endpoint: the page's own host in the packaged build.
 */
export function coreAddress(origin: string = coreHttpOrigin()): string {
  return origin.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/+$/, '')
}

/** The i18n key suffix of `login.deviceStrip.coreLinkValue.*`. */
export function coreLinkKey(coreLink: CoreLinkView): 'ONLINE' | 'CONNECTING' | 'STALE' | 'OFFLINE' {
  switch (coreLink) {
    case 'online':
      return 'ONLINE'
    case 'stale':
      return 'STALE'
    case 'offline':
      return 'OFFLINE'
    default:
      return 'CONNECTING'
  }
}

// ── Ring ─────────────────────────────────────────────────────────────────────────────────

export function ringStateFor({ locked, coreLink }: { locked: boolean; coreLink: CoreLinkView }): GlowRingState {
  if (locked) return 'ATTENTION'
  if (coreLink === 'offline') return 'CRITICAL'
  if (coreLink === 'stale') return 'ATTENTION'
  return 'READY'
}

/**
 * Ring size per layout tier (01_specs §14.8 "320-360 px"; research/04 §5.8: about 260 px at
 * 1024-1279, a 280 px brand band below 1024). The emblem is half the ring (160-180 px at ≥ 1280).
 */
export type LoginTier = 'wide' | 'split' | 'stacked' | 'compact'

export function ringSizeFor(tier: LoginTier, tall: boolean): number {
  switch (tier) {
    case 'wide':
      return tall ? 340 : 320
    case 'split':
      return 260
    case 'stacked':
      return 200
    default:
      return 168
  }
}

export function emblemSizeFor(ringSize: number): number {
  return Math.round(ringSize / 2)
}

// ── Form ─────────────────────────────────────────────────────────────────────────────────

export type LoginField = 'username' | 'password'

export const FIELD_ERROR_KEYS = {
  username: 'login.username.required',
  password: 'login.password.required',
} as const

export type FieldErrorKey = (typeof FIELD_ERROR_KEYS)[LoginField]
export type FieldErrors = Partial<Record<LoginField, FieldErrorKey>>

/** One field's error: the username is matched trimmed (the simulator lower-cases it). */
export function fieldErrorFor(field: LoginField, value: string): FieldErrorKey | undefined {
  const empty = field === 'username' ? value.trim().length === 0 : value.length === 0
  return empty ? FIELD_ERROR_KEYS[field] : undefined
}

/** Two required strings. */
export function validateCredentials(username: string, password: string): FieldErrors {
  const errors: FieldErrors = {}
  const usernameError = fieldErrorFor('username', username)
  const passwordError = fieldErrorFor('password', password)
  if (usernameError) errors.username = usernameError
  if (passwordError) errors.password = passwordError
  return errors
}

/** `errors` with `field` set to `error`, or removed when `error` is undefined (a new object). */
export function withFieldError(errors: FieldErrors, field: LoginField, error: FieldErrorKey | undefined): FieldErrors {
  const next: FieldErrors = { ...errors }
  if (error) next[field] = error
  else delete next[field]
  return next
}

export function hasFieldErrors(errors: FieldErrors): boolean {
  return errors.username !== undefined || errors.password !== undefined
}

// ── Arrival (Signed out / expired) ──────────────────────────────────────────────────────

/** `expired-absolute` and `disabled` are reported by the Core server only (Live mode; §5.6 WS-14, §6.4). */
export type ArrivalNotice = 'signed-out' | 'console-locked' | 'expired' | 'expired-absolute' | 'disabled' | null

const AUTH_EVENT_TYPES: ReadonlySet<string> = new Set(['AUTH_LOGIN', 'AUTH_LOGOUT', 'AUTH_EXPIRED'])

/** The newest sign-in, sign-out or expiry event (events are stored oldest first). */
export function lastAuthEvent(events: readonly SimEvent[]): SimEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event && AUTH_EVENT_TYPES.has(event.type)) return event
  }
  return null
}

export interface ArrivalInputs {
  authStatus: AuthStatus
  /** The top-level route this router showed before `/login` mounted (`/_app` after the shell). */
  previousTopLevel: string | undefined
  lastEvent: Pick<SimEvent, 'type' | 'params'> | null
}

/**
 * Why the operator is on the Login page (M-APP-02): an idle expiry (the simulator says EXPIRED),
 * or a sign-out from the shell (Sign out, or Lock console), or neither (a fresh visit).
 */
export function arrivalNoticeFor({ authStatus, previousTopLevel, lastEvent }: ArrivalInputs): ArrivalNotice {
  if (authStatus === AuthStatus.EXPIRED) return 'expired'
  if (previousTopLevel !== '/_app') return null
  if (lastEvent?.type === 'AUTH_EXPIRED') return 'expired'
  if (lastEvent?.type === 'AUTH_LOGOUT' && lastEvent.params['reason'] === SignOutReason.LOCK) return 'console-locked'
  return 'signed-out'
}

// ── The one Alert ────────────────────────────────────────────────────────────────────────

export type AttemptOutcome =
  | { readonly kind: 'invalid'; readonly attemptsRemaining: number }
  /** Something unexpected failed (logged); the generic copy is shown. */
  | { readonly kind: 'unexpected' }
  /** Live mode: the attempt got no answer from the Core server (the offline Alert, not "unexpected"). */
  | { readonly kind: 'core-offline' }
  /** Live mode: the Core server answered that it is not ready yet (503 `NOT_READY`). */
  | { readonly kind: 'core-starting' }
  /** Live mode: the Core server refused the input itself (422). It is the judge of the bounds. */
  | { readonly kind: 'input-rejected' }

export type LoginNotice =
  | { readonly kind: 'locked'; readonly retryInSeconds: number }
  | AttemptOutcome
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'console-locked' }
  | { readonly kind: 'expired' }
  | { readonly kind: 'expired-absolute' }
  | { readonly kind: 'disabled' }

export interface NoticeInputs {
  lockout: { readonly locked: boolean; readonly retryInSeconds: number }
  coreBlocked: boolean
  /** Live mode: the block is a Core server that is starting, not one that is unreachable. */
  coreStarting?: boolean
  lastAttempt: AttemptOutcome | null
  /** The arrival notice, until this page makes its first attempt. */
  arrival: ArrivalNotice
}

/**
 * One Alert at a time, most urgent first: Locked (warning, live countdown) → Core offline (danger,
 * Retry) → the last attempt's error (danger: generic copy + attempts left) → Signed out / Console
 * locked / Expired (accent). A lockout that has ended no longer shows.
 */
export function noticeFor({ lockout, coreBlocked, coreStarting = false, lastAttempt, arrival }: NoticeInputs): LoginNotice | null {
  if (lockout.locked) return { kind: 'locked', retryInSeconds: lockout.retryInSeconds }
  if (coreBlocked) return coreStarting ? { kind: 'core-starting' } : { kind: 'core-offline' }
  if (lastAttempt) return lastAttempt
  if (arrival) return { kind: arrival }
  return null
}

export function alertStatusFor(notice: LoginNotice): 'danger' | 'warning' | 'accent' {
  switch (notice.kind) {
    case 'locked':
      return 'warning'
    case 'signed-out':
    case 'console-locked':
    case 'expired':
    case 'expired-absolute':
      return 'accent'
    default:
      return 'danger'
  }
}

/** A notice about why the operator is on this page (it enters last, M-APP-02), not about an attempt. */
export function isArrivalNotice(notice: LoginNotice | null): boolean {
  switch (notice?.kind) {
    case 'signed-out':
    case 'console-locked':
    case 'expired':
    case 'expired-absolute':
    case 'disabled':
      return true
    default:
      return false
  }
}

// ── The §14.8 state name ─────────────────────────────────────────────────────────────────

/** Idle; Validating; Submitting; Error; Locked out; Core offline; Signed out / expired; Success. */
export type LoginDisplayState =
  | 'idle'
  | 'validating'
  | 'submitting'
  | 'error'
  | 'locked'
  | 'offline'
  | 'signed-out'
  | 'success'

export interface DisplayInputs {
  success: boolean
  pending: boolean
  notice: LoginNotice | null
  fieldErrors: FieldErrors
}

export function displayStateFor({ success, pending, notice, fieldErrors }: DisplayInputs): LoginDisplayState {
  if (success) return 'success'
  if (pending) return 'submitting'
  if (notice?.kind === 'locked') return 'locked'
  if (notice?.kind === 'core-offline' || notice?.kind === 'core-starting') return 'offline'
  if (notice?.kind === 'invalid' || notice?.kind === 'unexpected' || notice?.kind === 'input-rejected') return 'error'
  if (hasFieldErrors(fieldErrors)) return 'validating'
  if (notice) return 'signed-out'
  return 'idle'
}

/** Sign In (and the security key) are disabled while locked, pending, succeeding or Core offline. */
export function isSubmitDisabled(inputs: { locked: boolean; pending: boolean; success: boolean; coreBlocked: boolean }): boolean {
  return inputs.locked || inputs.pending || inputs.success || inputs.coreBlocked
}

// ── Text helpers ─────────────────────────────────────────────────────────────────────────

/** `mm:ss` digit groups of a countdown in whole seconds (never negative). */
export function countdownParts(totalSeconds: number): { minutes: number; seconds: number; text: string } {
  const safe = Math.max(0, Math.ceil(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return { minutes, seconds, text: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` }
}

const TOKEN = '\u0000'

/**
 * Splits a translated sentence around one interpolated value, so the value can be a live
 * component (SlidingNumber, AnimatedNumber) while the words stay in i18n.
 */
export function splitAroundToken(render: (token: string) => string): { before: string; after: string } {
  const text = render(TOKEN)
  const at = text.indexOf(TOKEN)
  if (at < 0) return { before: text, after: '' }
  return { before: text.slice(0, at), after: text.slice(at + TOKEN.length) }
}

/** Splits a rendered sentence around the first occurrence of a number (the plural count). */
export function splitAroundNumber(text: string, value: number): { before: string; after: string } | null {
  const needle = String(value)
  const at = text.indexOf(needle)
  if (at < 0) return null
  return { before: text.slice(0, at), after: text.slice(at + needle.length) }
}
