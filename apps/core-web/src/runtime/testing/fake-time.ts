/**
 * The page's own timers on a fake clock, for a test that would otherwise WAIT for the product's
 * real delays (the 3-2-1 countdown, the export job's 2 s poll, "nothing happens for N seconds").
 * Not a test file (Vitest collects `*.test.*` only); no production file imports it.
 *
 * | Helper | What it gives a test |
 * |--------|----------------------|
 * | `pageTimersFake()` | From here on `setTimeout` and `setInterval` of the page are fake. Call it BEFORE the action whose timer the test wants to drive: a timer armed on the real clock stays real |
 * | `pageTimersReal()` | Back to the system timers (every `afterEach` of a file that fakes them). Timers still pending on the fake clock never fire |
 * | `pass(ms)` | Moves the fake clock on by `ms` in 50 ms slices, each inside its own `act`, so a timer that a render arms (a countdown's next step) is armed and run as on the system clock |
 * | `until(check)` | What `waitFor` is on the real clock: runs `check` until it does not throw, letting the page work in between. Each round runs the zero timers (the query library tells its observers on `setTimeout(callback, 0)`, so no test has to wait for "the observers were told" itself), the promise jobs, and one turn of the real event loop (a lazily loaded chunk). With `stepMs` the fake clock moves on by that much per round |
 *
 * Why not `waitFor` / `findBy…` while the timers are fake: the testing library ends each of them
 * with a `setTimeout(resolve, 0)` of its own, which a fake clock never runs — the wait would hang.
 */
import { act } from '@testing-library/react'
import { vi } from 'vitest'

/** The system's timer, taken before any test fakes it. */
const realSetTimeout = globalThis.setTimeout

export function pageTimersFake(): void {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
}

export function pageTimersReal(): void {
  vi.useRealTimers()
}

/** One slice of `pass`. A timer that a render arms is armed when its `act` ends, so it starts at most this late. */
export const PASS_SLICE_MS = 50

/**
 * Moves the fake clock on by `ms` in slices of `PASS_SLICE_MS`, each in its own `act`: React renders
 * between two slices, so a chain of timers (each step of a countdown arms the next one from an
 * effect) runs through as it does on the system clock. ONE `act` over the whole span would run only
 * the first timer of such a chain - and a "nothing happened for N seconds" check would prove nothing.
 */
export async function pass(ms: number): Promise<void> {
  for (let elapsed = 0; elapsed < ms || elapsed === 0; elapsed += PASS_SLICE_MS) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(Math.min(PASS_SLICE_MS, Math.max(ms - elapsed, 0)))
    })
    if (ms <= 0) break
  }
}

/**
 * What it takes to run a `setTimeout(callback, 0)`: the fake clock gives a zero timer that is armed
 * WHILE the clock is being moved (an answer that arrives inside a poll's own timer) a due time one
 * millisecond later, so moving it by 0 would leave the query library's observers untold.
 */
export const ZERO_TIMER_MS = 1

export interface UntilOptions {
  /** Fake milliseconds per round. Default (and least) `ZERO_TIMER_MS`: only the timers that are due now (the observers' zero timer) run. */
  readonly stepMs?: number
  /** Rounds before the last failure of `check` is thrown. Default 200. */
  readonly rounds?: number
}

/** Runs `check` until it passes; throws its last failure after `rounds` rounds. Fake timers only. */
export async function until<T>(check: () => T, options: UntilOptions = {}): Promise<T> {
  const stepMs = Math.max(options.stepMs ?? 0, ZERO_TIMER_MS)
  const rounds = options.rounds ?? 200
  /** One round of the page's work: the timers due within `ms`, the promise jobs, one turn of the real event loop. */
  const work = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
      for (let turn = 0; turn < 40; turn += 1) await Promise.resolve()
      await new Promise<void>((resolve) => void realSetTimeout(resolve, 0))
    })
  let failure: unknown
  for (let round = 0; round <= rounds; round += 1) {
    let value: T
    try {
      value = check()
    } catch (error) {
      failure = error
      await work(stepMs)
      continue
    }
    // As `waitFor` does after its callback passed: what is already on its way lands before the test
    // goes on (a request that was just logged gets its answer drawn). Two milliseconds of fake time.
    await work(ZERO_TIMER_MS)
    await work(ZERO_TIMER_MS)
    return value
  }
  throw failure
}
