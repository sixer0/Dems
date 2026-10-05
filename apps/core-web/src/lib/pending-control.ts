/**
 * "Busy at once, spinner late" — the ONE pending-control hook of the console (plan row W0, item 2;
 * decision D153 ruling 5; backend task 04_client_integration_spec §8.1 LB-1, LB-2, LB-4; AC-C-57,
 * AC-C-58). It replaces the copies of W63 (`dashboard/devices-panel.tsx`), W64
 * (`session-new/use-pending-control.ts`), W65 (`session-monitor/use-pending-press.ts`), W69
 * (`evidence/use-pending-action.ts`), W70 (`devices/live.ts`, `devices/audio-input-card.tsx`) and
 * W71 (`storage/manage-drawer.tsx`).
 *
 * | Phase | From | What the control shows | A press |
 * |-------|------|------------------------|---------|
 * | idle | — | its own look | runs the command |
 * | busy | the press | no visual change; `aria-busy="true"` on the element of `ref` (when the caller attaches it) | is ignored: one command per control (`run` returns `false`, nothing is sent) |
 * | pending | `LIVE_PENDING_REVEAL_MS` after the press, scaled by the motion policy | the kit's own pending state (`isPending`, the `Spinner` in place of the icon), so nothing moves | is ignored |
 *
 * A command that settles before the press returns — every command in Simulated mode (`settle` runs
 * a plain value's handlers before it returns, CL-25) — changes no state of this hook: no phase, no
 * key, no timer, no `onWait`. Simulated screens therefore look and behave exactly as before.
 *
 * Two ways in, one state:
 * - `run(start, key?)`: `start` gets `release` and starts the command itself, so the call site keeps
 *   rule 1's literal shape `settle(() => actions.x(…), { ok, fail, done: release })` (the static
 *   rules of the page rows look for it), or runs several settles in order and calls `release` once
 *   at the end (the export wizard).
 * - `settle(action, handlers)`: the same as `settle` from `@dems/shared/live` on this control, plus
 *   `onWait` — called once right after the press when the outcome is not known yet (a Live result):
 *   where an optimistic visual that changes no record starts (LB-4). `handlers.done` runs after the
 *   control is released.
 *
 * The busy mark (finding F63-2, W0 item 3): the kit's `Button` (`@heroui/react` over React Aria's
 * `Button`) passes only `data-*`, `id` and a fixed list of attributes to the element, so an
 * `aria-busy` PROP never reaches the DOM. `ref` writes the attribute on the pressed control itself
 * (LB-1 as written, decision D153 ruling 1); React does not manage it, so nothing else writes or
 * removes it. A caller that marks a container instead reads `busy`.
 *
 * `key` names what the command is about (an evidence ID), so a table can mark the row whose command
 * is out; one command at a time per hook. A list of controls that may each have one command out at
 * the same time (the Devices page: one per device) keeps its own keyed in-flight set and takes the
 * late reveal from `usePendingReveal(busy)` below.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { LIVE_PENDING_REVEAL_MS, settle as settleResult, type SettleHandlers } from '@dems/shared/live'
import { useMotionPolicy } from '@/motion'

export interface PendingHandlers<T> extends SettleHandlers<T> {
  /** The outcome is not known yet when the press returns (a Live result): start the optimistic visual here (LB-4). */
  onWait?: () => void
}

export interface PendingControl {
  /** From the press until the command settled: further presses are ignored. */
  readonly busy: boolean
  /** Busy for longer than the reveal time: the control shows the kit's pending state. */
  readonly pending: boolean
  /** What the command in flight is about (`key` of `run`), or `null`. */
  readonly key: string | null
  /**
   * Starts one command unless this control has one in flight. `start` gets `release`, which must run
   * once when the command settled (pass it as `settle`'s `done`). Returns whether it started.
   */
  readonly run: (start: (release: () => void) => void, key?: string) => boolean
  /** `settle(action, handlers)` on this control, unless a command of it is out. Returns whether it was sent. */
  readonly settle: <T>(action: () => T | PromiseLike<T>, handlers: PendingHandlers<T>) => boolean
  /** For the pressed control's element: carries `aria-busy="true"` while a command is in flight. */
  readonly ref: RefObject<HTMLButtonElement | null>
}

/**
 * Whether the pending look of a busy control is shown: only after it has been busy for
 * `LIVE_PENDING_REVEAL_MS`, scaled by the motion policy as every other duration (LB-1). A command
 * that settles sooner never changes the look.
 */
export function usePendingReveal(busy: boolean): boolean {
  const { timeScale } = useMotionPolicy()
  const delayMs = LIVE_PENDING_REVEAL_MS * timeScale
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    if (!busy) return undefined
    const timer = setTimeout(() => setRevealed(true), delayMs)
    return () => {
      clearTimeout(timer)
      setRevealed(false)
    }
  }, [busy, delayMs])
  return busy && revealed
}

export function usePendingControl(): PendingControl {
  const ref = useRef<HTMLButtonElement | null>(null)
  const inFlight = useRef(false)
  const [busy, setBusy] = useState(false)
  const [key, setKey] = useState<string | null>(null)
  const pending = usePendingReveal(busy)

  useLayoutEffect(() => {
    const element = ref.current
    if (element === null) return
    if (busy) element.setAttribute('aria-busy', 'true')
    else element.removeAttribute('aria-busy')
  }, [busy])

  const begin = useCallback((start: (release: () => void) => void, actionKey: string | undefined, onWait: (() => void) | undefined): boolean => {
    if (inFlight.current) return false
    inFlight.current = true
    let released = false
    let waiting = false
    const release = (): void => {
      if (released) return
      released = true
      inFlight.current = false
      if (waiting) {
        setBusy(false)
        setKey(null)
      }
    }
    try {
      start(release)
    } catch (error) {
      release()
      throw error
    }
    // Settled already (Simulated mode, or a command refused before it was sent): nothing to show.
    if (!released) {
      waiting = true
      setBusy(true)
      setKey(actionKey ?? null)
      onWait?.()
    }
    return true
  }, [])

  const run = useCallback((start: (release: () => void) => void, actionKey?: string): boolean => begin(start, actionKey, undefined), [begin])

  const settle = useCallback(
    <T,>(action: () => T | PromiseLike<T>, handlers: PendingHandlers<T>): boolean =>
      begin(
        (release) => {
          settleResult(action, {
            ...(handlers.ok ? { ok: handlers.ok } : {}),
            fail: handlers.fail,
            done: () => {
              release()
              handlers.done?.()
            },
          })
        },
        undefined,
        handlers.onWait,
      ),
    [begin],
  )

  return { busy, pending, key, run, settle, ref }
}
