/**
 * The lease of the idle microphone meters: operation 113 `holdIdleMeters` (decisions D51 / D53; plan D53
 * part (d), row 92). Kept in a `.ts` module so that `audio-input-card.tsx` exports only components.
 *
 * WHAT IT DOES. While no session records, a Core in its own capture reads the PRIMARY and STANDBY
 * microphones only while someone holds this lease (30 s, `IDLE_METER_LEASE_MS`). The levels arrive in
 * the same replicated state the meters already read (`applyCaptureTelemetry`), so nothing here carries
 * a level: the lease only asks the Core to read.
 *
 * | Rule | How it is kept |
 * |------|----------------|
 * | Live mode, a Core in real capture, no session active, the page visible | `useIdleMeterLease`: the lease is held only while all four hold |
 * | Asked now, then every 10 s (a third of the lease) | `createIdleMeterLease`: one call at the first holder, one interval |
 * | ONE lease per page, whatever number of cards hold it | the lease is shared per Live source (`leaseOf`); the cards count as holders |
 * | Stops on unmount, on a hidden page and when a session opens | the holder's release; the last release clears the interval |
 * | A refused call (`409 IDLE_METERS_NOT_AVAILABLE`, an outage) | the state `UNAVAILABLE`, one record per run of refusals in the page's log; the next renewal asks again |
 */
import { useEffect, useSyncExternalStore } from 'react'
import { hasActiveSession, useSim } from '@dems/shared/sim'
import { deferEffectStart } from '@/lib/effect-start'
import { useWebLive, type WebLive } from '@/runtime'
import { reportDevicesError } from './report'
import { useRealCaptureCore } from './source-class'

/** The renewal interval: a third of the Core's 30 s lease, so one lost call does not end it. */
export const IDLE_METER_RENEW_MS = 10_000

/** `OFF`: not held. `PENDING`: asked, no answer yet. `HELD`: the Core holds the lease. `UNAVAILABLE`: the Core refused it, or did not answer. */
export type IdleMeterLeaseState = 'OFF' | 'PENDING' | 'HELD' | 'UNAVAILABLE'

/** One call of operation 113, as the lease needs it: whether it was held, and the codes of a refusal. */
export type HoldIdleMetersCall = () => Promise<{ readonly ok: true } | { readonly ok: false; readonly status: number | null; readonly code: string }>

export interface IdleMeterLeaseTimers {
  readonly setInterval: (callback: () => void, ms: number) => unknown
  readonly clearInterval: (handle: unknown) => void
}

export interface IdleMeterLease {
  /** Takes a hold; returns its release (idempotent). The first hold asks at once and starts the renewals. */
  hold(): () => void
  state(): IdleMeterLeaseState
  subscribe(listener: () => void): () => void
}

const SYSTEM_TIMERS: IdleMeterLeaseTimers = {
  setInterval: (callback, ms) => globalThis.setInterval(callback, ms),
  clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof setInterval>),
}

/** The fixed sentences of the page's own record. */
const LEASE_REFUSED_RECORD = 'The idle microphone meters were not held.'
const LEASE_THREW_RECORD = 'The idle microphone meters could not be asked for.'

export type IdleMeterLeaseReport = (error: unknown, message: string, context: Record<string, string | number | null>) => void

const defaultReport: IdleMeterLeaseReport = (error, message, context) => reportDevicesError('features/devices.idleMeterLease', error, message, { operationId: 'holdIdleMeters', ...context }, 'warn')

/** The lease of one Live source; pure apart from the injected call, timers and report. */
export function createIdleMeterLease(call: HoldIdleMetersCall, timers: IdleMeterLeaseTimers = SYSTEM_TIMERS, report: IdleMeterLeaseReport = defaultReport): IdleMeterLease {
  let holders = 0
  let interval: unknown = null
  let current: IdleMeterLeaseState = 'OFF'
  // A new run of holding (first hold after none): an answer of an earlier run is not this run's.
  let run = 0
  const listeners = new Set<() => void>()
  const set = (next: IdleMeterLeaseState) => {
    if (current === next) return
    current = next
    for (const listener of listeners) listener()
  }
  const refused = (error: unknown, message: string, context: Record<string, string | number | null>) => {
    // One record per run of refusals: a renewal every 10 s must not fill the page's log.
    if (current !== 'UNAVAILABLE') report(error, message, context)
    set('UNAVAILABLE')
  }
  const ask = () => {
    const mine = run
    let pending: ReturnType<HoldIdleMetersCall>
    try {
      pending = call()
    } catch (error) {
      refused(error, LEASE_THREW_RECORD, {})
      return
    }
    pending.then(
      (answer) => {
        if (mine !== run || holders === 0) return
        if (answer.ok) set('HELD')
        else refused(null, LEASE_REFUSED_RECORD, { status: answer.status, code: answer.code })
      },
      (error: unknown) => {
        if (mine !== run || holders === 0) return
        refused(error, LEASE_THREW_RECORD, {})
      },
    )
  }
  return {
    hold() {
      holders += 1
      if (holders === 1) {
        run += 1
        set('PENDING')
        ask()
        interval = timers.setInterval(ask, IDLE_METER_RENEW_MS)
      }
      let released = false
      return () => {
        if (released) return
        released = true
        holders -= 1
        if (holders > 0) return
        if (interval !== null) timers.clearInterval(interval)
        interval = null
        run += 1
        set('OFF')
      }
    },
    state: () => current,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** Operation 113 of a Live source, in the lease's form. */
export function holdIdleMetersOf(live: Pick<WebLive, 'client'>): HoldIdleMetersCall {
  return async () => {
    const answer = await live.client.call('holdIdleMeters')
    return answer.ok ? { ok: true } : { ok: false, status: answer.status, code: answer.error.code }
  }
}

const LEASES = new WeakMap<object, IdleMeterLease>()

/** The one lease of a Live source (shared by every card of the page). */
export function leaseOf(live: WebLive): IdleMeterLease {
  let lease = LEASES.get(live)
  if (lease === undefined) {
    lease = createIdleMeterLease(holdIdleMetersOf(live))
    LEASES.set(live, lease)
  }
  return lease
}

const subscribeVisibility = (listener: () => void) => {
  document.addEventListener('visibilitychange', listener)
  return () => document.removeEventListener('visibilitychange', listener)
}
const isVisible = () => document.visibilityState !== 'hidden'
const noSubscribe = () => () => undefined
const OFF = (): IdleMeterLeaseState => 'OFF'

/** Whether the page is visible (`document.visibilityState`). */
export function useDocumentVisible(): boolean {
  return useSyncExternalStore(subscribeVisibility, isVisible, () => true)
}

/**
 * Holds the idle meters while Devices & Inputs is on screen and visible, no session is active, and the
 * console is in Live mode on a Core in real capture. Returns the lease's state (`OFF` whenever it is not held).
 */
export function useIdleMeterLease(): IdleMeterLeaseState {
  const live = useWebLive()
  const realCapture = useRealCaptureCore()
  const sessionActive = useSim(hasActiveSession)
  const visible = useDocumentVisible()
  const lease = live === null ? null : leaseOf(live)
  const enabled = lease !== null && realCapture && !sessionActive && visible
  useEffect(() => {
    if (!enabled || lease === null) return undefined
    // StrictMode runs a mount effect twice: the hold is taken one task later, so only ONE first call is sent.
    let release: (() => void) | null = null
    const cancel = deferEffectStart(() => {
      release = lease.hold()
    })
    return () => {
      cancel()
      release?.()
    }
  }, [enabled, lease])
  const state = useSyncExternalStore(lease === null ? noSubscribe : lease.subscribe, lease === null ? OFF : lease.state, OFF)
  return enabled ? state : 'OFF'
}
