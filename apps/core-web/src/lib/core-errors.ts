/**
 * The refusal presenter of the web console (backend task 04_client_integration_spec §6.2; §8.1
 * LB-5, LB-6, LB-7, LB-10; §2.5 CL-20, CL-21; brief list row 20 of implementation/44_live_source.md
 * §17.4; plan row W50).
 *
 * One place words what the Core said to a call, so a refusal reads the same on every page. A
 * `fail` branch hands its error here BEFORE its own message:
 *
 * ```ts
 * const presentCoreError = useCoreErrorPresenter()
 * settle(() => actions.archiveEvidence(id), {
 *   ok: () => toast.success(…),
 *   fail: (error) => {
 *     if (presentCoreError(error) !== null) return      // worded here (or deliberately silent)
 *     toast.danger(t('evidence.archive.failed'))        // the page's own branch
 *   },
 * })
 * ```
 *
 * It takes what a Live action rejects with, what the simulator throws, and the failed answer of
 * a page's own call through `live.client.call(...)`. The first matching row decides:
 *
 * | # | Input | Notice | What the operator sees |
 * |--:|-------|--------|------------------------|
 * | 1 | `LiveTransportError`, code `STOPPED` | STOPPED | Nothing: the page is being replaced |
 * | 2 | A 429 (`RATE_LIMITED`) | LIMIT | ONE warning toast: "The Core server is limiting requests from this console. Try again in N s." with N from `retry-after`. Never an "unreachable" sentence (LB-10) |
 * | 3 | Code `CREDENTIALS_UNAVAILABLE` or `CREDENTIALS_TIMEOUT` | NOT_SENT | Danger toast: the request was not sent, nothing was changed |
 * | 4 | Code `SNAPSHOT_TIMEOUT` | SNAPSHOT_TIMEOUT | Warning toast: the sign-in was accepted, the Core state has not arrived |
 * | 5 | Code `TIMEOUT` (no answer in 8 s) | TIMED_OUT | Danger toast: the command may or may not have been applied (LB-7) |
 * | 6 | The Core's 503 `NOT_READY` | STARTING | Danger toast: "The Core server is starting. Nothing was changed." |
 * | 7 | Any other `CORE_OFFLINE` (no answer, the link is not ONLINE) | OFFLINE | Danger toast: "Core server unreachable. Nothing was changed." (LB-6) |
 * | 8 | `UNAVAILABLE` that is no 429 (a 500, an answer outside the contract) | UNAVAILABLE | Danger toast: the Core could not complete the request |
 * | 9 | 401 `NOT_SIGNED_IN` | SIGNED_OUT | Nothing: the session is over and the shell shows the login screen with its own notice (§6.5) |
 * | 10 | 403 `NOT_PERMITTED` or `FORBIDDEN` | PERMISSION | Danger toast `common.rbac.deniedTitle`, naming the first role that holds the permission (§6.2) |
 * | 11 | `NOT_AVAILABLE` | NOT_AVAILABLE | Warning toast: the action is not available in Live mode |
 * | 12 | `DEMO_DISABLED` | DEMO_DISABLED | Warning toast |
 * | 13 | `ORIGIN_NOT_ALLOWED` | ORIGIN_NOT_ALLOWED | Danger toast naming the address to open, and a console record that names the cause (WT-2a) |
 * | 14 | Anything else: `SimTransitionError`, `SimNotFoundError`, another refusal code, an unknown error | `null` | Nothing here: the page's own branch words it (a blocked pre-check, `LAST_ADMIN`, a wrong reason) |
 *
 * Row 14 is deliberate: a refusal that says something about the page's own subject is the page's
 * to word. In particular a pre-check that is blocked because no paired tablet is connected is NOT
 * an outage of the Core server and is never shown with an "unreachable" sentence.
 *
 * Toasts of rows 2 to 8 are coalesced: at most one of a kind in `LIVE_OFFLINE_TOAST_COALESCE_MS`,
 * however many presses or selected rows caused them (LB-6, AC-C-59). A coalesced notice still
 * counts as presented. Nothing is logged here except the record of row 13: the Live source
 * reports every rejected action itself (CL-24).
 */
import { useCallback } from 'react'
import { toast } from '@heroui/react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { ApiErrorCode } from '@dems/shared/api'
import type { CoreCallFailure } from '@dems/shared/client'
import { CoreRefusalError, LiveTransportError, LiveTransportReason } from '@dems/shared/live'
import { OperatorRole, ROLE_PERMISSIONS, SimErrorCode, SimPermissionError, type Permission } from '@dems/shared/sim'
import { webErrorSink, type ErrorSink } from '@/runtime/error-sink'
import { liveConsoleOrigin } from '@/runtime/live-host'

/**
 * At most one toast of a kind in this time, in milliseconds (LB-6: "coalesced to one per 3 s").
 * Pinned by the controller for the row that first needs it (decision D43).
 */
export const LIVE_OFFLINE_TOAST_COALESCE_MS = 3_000

/** What the presenter showed, or deliberately did not show. */
export const CoreErrorNoticeKind = {
  STOPPED: 'STOPPED',
  LIMIT: 'LIMIT',
  NOT_SENT: 'NOT_SENT',
  SNAPSHOT_TIMEOUT: 'SNAPSHOT_TIMEOUT',
  TIMED_OUT: 'TIMED_OUT',
  STARTING: 'STARTING',
  OFFLINE: 'OFFLINE',
  UNAVAILABLE: 'UNAVAILABLE',
  SIGNED_OUT: 'SIGNED_OUT',
  PERMISSION: 'PERMISSION',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  DEMO_DISABLED: 'DEMO_DISABLED',
  ORIGIN_NOT_ALLOWED: 'ORIGIN_NOT_ALLOWED',
} as const
export type CoreErrorNoticeKind = (typeof CoreErrorNoticeKind)[keyof typeof CoreErrorNoticeKind]

export type CoreErrorNotice =
  | { readonly kind: typeof CoreErrorNoticeKind.LIMIT; /** `retry-after` in whole seconds; `null` when the answer had none. */ readonly seconds: number | null }
  | {
      readonly kind: typeof CoreErrorNoticeKind.PERMISSION
      /** The first role that holds the permission, least privileged first; `null` when no role is known. */
      readonly role: OperatorRole | null
      readonly permission: string
    }
  | { readonly kind: Exclude<CoreErrorNoticeKind, typeof CoreErrorNoticeKind.LIMIT | typeof CoreErrorNoticeKind.PERMISSION> }

export interface DescribeCoreErrorOptions {
  /**
   * For the failed answer of a page's own call: the permission its operation needs, used when the
   * envelope names none. A rejected action carries its permission itself.
   */
  readonly permission?: Permission
}

/** Client-side codes of a transport failure (`@dems/shared/client`, `@dems/shared/live/source`). */
const TransportCode = {
  STOPPED: 'STOPPED',
  SNAPSHOT_TIMEOUT: 'SNAPSHOT_TIMEOUT',
  TIMEOUT: 'TIMEOUT',
  CREDENTIALS_UNAVAILABLE: 'CREDENTIALS_UNAVAILABLE',
  CREDENTIALS_TIMEOUT: 'CREDENTIALS_TIMEOUT',
} as const

/** The client's own code of an action that has no operation in Live mode, or whose storage failed. */
const NOT_AVAILABLE = 'NOT_AVAILABLE'

const ROLE_ORDER = [OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR, OperatorRole.TECHNICIAN] as const

/**
 * The first role, least privileged first, that holds the permission. A label of several
 * permissions (`A | B`: any of them is enough) names the first role that holds one of them.
 */
export function requiredRoleForPermission(permission: string): OperatorRole | null {
  const wanted = permission
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part !== '')
  return ROLE_ORDER.find((role) => wanted.some((name) => (ROLE_PERMISSIONS[role] as readonly string[]).includes(name))) ?? null
}

interface TransportFacts {
  readonly reason: LiveTransportReason
  readonly status: number | null
  readonly code: string | null
  readonly retryAfterSeconds: number | null
}

function transportNotice({ reason, status, code, retryAfterSeconds }: TransportFacts): CoreErrorNotice {
  if (code === TransportCode.STOPPED) return { kind: CoreErrorNoticeKind.STOPPED }
  // LB-10: decided before the reason is looked at, so a limit can never read as an outage.
  if (status === 429 || code === ApiErrorCode.RATE_LIMITED) return { kind: CoreErrorNoticeKind.LIMIT, seconds: retryAfterSeconds }
  if (code === TransportCode.CREDENTIALS_UNAVAILABLE || code === TransportCode.CREDENTIALS_TIMEOUT) return { kind: CoreErrorNoticeKind.NOT_SENT }
  if (code === TransportCode.SNAPSHOT_TIMEOUT) return { kind: CoreErrorNoticeKind.SNAPSHOT_TIMEOUT }
  if (code === TransportCode.TIMEOUT) return { kind: CoreErrorNoticeKind.TIMED_OUT }
  // The Core's own 503 only: a gateway's 503 (the dev proxy with the backend down) is an outage, not a start.
  if (code === ApiErrorCode.NOT_READY) return { kind: CoreErrorNoticeKind.STARTING }
  if (reason === LiveTransportReason.CORE_OFFLINE) return { kind: CoreErrorNoticeKind.OFFLINE }
  return { kind: CoreErrorNoticeKind.UNAVAILABLE }
}

function refusalNotice(status: number | null, code: string, permission: string): CoreErrorNotice | null {
  if (code === ApiErrorCode.NOT_SIGNED_IN) return { kind: CoreErrorNoticeKind.SIGNED_OUT }
  if (status === 403 && (code === ApiErrorCode.NOT_PERMITTED || code === ApiErrorCode.FORBIDDEN)) {
    return { kind: CoreErrorNoticeKind.PERMISSION, role: requiredRoleForPermission(permission), permission }
  }
  if (code === NOT_AVAILABLE) return { kind: CoreErrorNoticeKind.NOT_AVAILABLE }
  if (code === ApiErrorCode.DEMO_DISABLED) return { kind: CoreErrorNoticeKind.DEMO_DISABLED }
  if (code === ApiErrorCode.ORIGIN_NOT_ALLOWED) return { kind: CoreErrorNoticeKind.ORIGIN_NOT_ALLOWED }
  return null
}

function isCallFailure(input: unknown): input is CoreCallFailure {
  if (typeof input !== 'object' || input === null) return false
  const candidate = input as Partial<CoreCallFailure>
  return candidate.ok === false && typeof candidate.error === 'object' && candidate.error !== null && 'transport' in candidate
}

/** The notice of `input` (the table above), or `null` when the page words it itself. Pure. */
export function describeCoreError(input: unknown, options: DescribeCoreErrorOptions = {}): CoreErrorNotice | null {
  if (input instanceof LiveTransportError) return transportNotice(input)
  if (input instanceof SimPermissionError) {
    if (input.code === SimErrorCode.NOT_SIGNED_IN) return { kind: CoreErrorNoticeKind.SIGNED_OUT }
    return { kind: CoreErrorNoticeKind.PERMISSION, role: requiredRoleForPermission(input.permission), permission: input.permission }
  }
  if (input instanceof CoreRefusalError) return refusalNotice(input.status, input.code, '')
  if (isCallFailure(input)) {
    if (input.transport !== null) {
      return transportNotice({ reason: input.transport, status: input.status, code: input.error.code, retryAfterSeconds: input.retryAfterSeconds })
    }
    const named = input.error.details?.permission
    return refusalNotice(input.status, input.error.code, typeof named === 'string' && named !== '' ? named : (options.permission ?? ''))
  }
  return null
}

/** The part of the kit's `toast` the presenter uses (tests pass their own). */
export interface CoreErrorToast {
  danger(title: string, options?: { description?: string }): unknown
  warning(title: string, options?: { description?: string }): unknown
}

export interface CoreErrorPresenterDeps {
  readonly t: TFunction
  /** Default: the kit's `toast`. */
  readonly toast?: CoreErrorToast
  /** Default `Date.now`. */
  readonly now?: () => number
  /** Default: the page's own sink. */
  readonly sink?: ErrorSink
  /** Default `window.location`: the port of the address named by ORIGIN_NOT_ALLOWED. */
  readonly location?: Pick<Location, 'port' | 'origin'>
}

/** The kinds whose toasts are coalesced, and the gate each shares. An outage and a starting Core are one gate. */
const COALESCE_GATE: Partial<Record<CoreErrorNoticeKind, string>> = {
  [CoreErrorNoticeKind.LIMIT]: 'LIMIT',
  [CoreErrorNoticeKind.NOT_SENT]: 'NOT_SENT',
  [CoreErrorNoticeKind.TIMED_OUT]: 'TIMED_OUT',
  [CoreErrorNoticeKind.STARTING]: 'OFFLINE',
  [CoreErrorNoticeKind.OFFLINE]: 'OFFLINE',
  [CoreErrorNoticeKind.UNAVAILABLE]: 'UNAVAILABLE',
}

/** When each gate last let a toast through. Shared by every call site of the page. */
const lastShownAt = new Map<string, number>()

/** Forgets the coalescing state (tests). */
export function resetCoreErrorPresenter(): void {
  lastShownAt.clear()
}

function passesGate(kind: CoreErrorNoticeKind, now: number): boolean {
  const gate = COALESCE_GATE[kind]
  if (gate === undefined) return true
  const last = lastShownAt.get(gate)
  if (last !== undefined && now - last >= 0 && now - last < LIVE_OFFLINE_TOAST_COALESCE_MS) return false
  lastShownAt.set(gate, now)
  return true
}

/**
 * Words `input` for the operator. Returns the notice, also when its toast was coalesced or when
 * the notice is silent by design; `null` when the page's own branch must word the error.
 */
export function presentCoreError(input: unknown, deps: CoreErrorPresenterDeps, options: DescribeCoreErrorOptions = {}): CoreErrorNotice | null {
  const notice = describeCoreError(input, options)
  if (notice === null) return null
  const { t } = deps
  const show = deps.toast ?? toast
  const now = (deps.now ?? Date.now)()
  if (!passesGate(notice.kind, now)) return notice

  switch (notice.kind) {
    case CoreErrorNoticeKind.STOPPED:
    case CoreErrorNoticeKind.SIGNED_OUT:
      break
    case CoreErrorNoticeKind.LIMIT:
      show.warning(
        notice.seconds === null ? t('common.coreErrors.limitedNoTime') : t('common.coreErrors.limited', { seconds: notice.seconds }),
      )
      break
    case CoreErrorNoticeKind.NOT_SENT:
      show.danger(t('common.coreErrors.notSent'))
      break
    case CoreErrorNoticeKind.SNAPSHOT_TIMEOUT:
      show.warning(t('common.coreErrors.snapshotTimeout'))
      break
    case CoreErrorNoticeKind.TIMED_OUT:
      show.danger(t('common.coreErrors.timedOut'))
      break
    case CoreErrorNoticeKind.STARTING:
      show.danger(t('common.coreErrors.starting'))
      break
    case CoreErrorNoticeKind.OFFLINE:
      show.danger(t('common.coreErrors.offline'))
      break
    case CoreErrorNoticeKind.UNAVAILABLE:
      show.danger(t('common.coreErrors.unavailable'))
      break
    case CoreErrorNoticeKind.PERMISSION:
      show.danger(
        t('common.rbac.deniedTitle'),
        notice.role === null ? undefined : { description: t('common.rbac.requiresRole', { role: t(`common.roles.${notice.role}`) }) },
      )
      break
    case CoreErrorNoticeKind.NOT_AVAILABLE:
      show.warning(t('common.coreErrors.notAvailable'))
      break
    case CoreErrorNoticeKind.DEMO_DISABLED:
      show.warning(t('common.coreErrors.demoDisabled'))
      break
    case CoreErrorNoticeKind.ORIGIN_NOT_ALLOWED: {
      const location = deps.location ?? window.location
      const address = liveConsoleOrigin(location)
      show.danger(t('common.coreErrors.originNotAllowed', { address }))
      // WT-2a, A1: the console record names the cause and the address to use.
      ;(deps.sink ?? webErrorSink).report({
        level: 'error',
        source: 'core-errors.originNotAllowed',
        message: `The Core server refused a request of this page with ORIGIN_NOT_ALLOWED. The page is open at ${location.origin}; the Core server accepts the web console only from the addresses in its own list (${address} for this dev server, when its port is one the Core server knows). Open the console at ${address}.`,
        at: now,
        context: { current: location.origin, expected: address },
      })
      break
    }
  }
  return notice
}

/** The presenter bound to the page's translations. The returned function is stable. */
export function useCoreErrorPresenter(): (input: unknown, options?: DescribeCoreErrorOptions) => CoreErrorNotice | null {
  const { t } = useTranslation()
  return useCallback((input, options) => presentCoreError(input, { t }, options), [t])
}
