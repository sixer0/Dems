// The page harness of the "real capture states only facts" tests (`real-core-facts.test.tsx`) and of
// the seal notices beside the Monitor's tests (`features/session-monitor/__tests__/unsealable-notice.test.tsx`):
// a simulator on a manual clock, the app's real router at a route, and the jsdom stand-ins both need.
// Moved here unchanged from the test file of fix wave L (driver L-W) when its cases went to those two
// homes (suite consolidation, test/14): one harness, two files. Not a test file; no production file imports it.
//
// | Export | What it gives a test |
// |--------|----------------------|
// | `useRealCorePages()` | Registers the set-up and tear-down of the harness for the `describe` that calls it (or for the file) |
// | `newSim(scenario, operatorId?)` | A simulator signed in as `operatorId`, stopped after the test |
// | `mount(route, scenario, prepare?, operatorId?)` | The app's router at `route` over such a simulator, a silent socket |
// | `realCore(sim)` | The two statements of a Core in its own capture (contract examples) |
// | `unsealableOf(sessionId, patch?)` | The contract's unsealable alert, of that session |
// | `page(testId)` | `findByTestId` with the harness timeout `FIND` |
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'
import { SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE } from '@dems/shared/api'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, HOST_CLOCK_TIME, OPERATOR_IDS, SEAL_UNSEALABLE_EXAMPLE_ALERT, createManualClock, createMemoryAuthStorage, createSim, type ScenarioName, type Sim, type SimAlert } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { resetMissingI18nKeys } from '@/i18n'
import { REDUCED_MOTION_MEDIA_QUERY } from '@/motion'
import { createAppRouter } from '@/router'

export const FIND = { timeout: 15_000 }
export const DEMO_NOW = Date.parse('2026-10-01T10:00:00+07:00')

class SilentSocket implements SocketLike {
  readyState = 0
  onopen: SocketLike['onopen'] = null
  onmessage: SocketLike['onmessage'] = null
  onclose: SocketLike['onclose'] = null
  onerror: SocketLike['onerror'] = null
  close() {
    this.readyState = 3
  }
}

function stubMatchMedia() {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    return {
      matches: query === REDUCED_MOTION_MEDIA_QUERY ? true : min ? 1920 >= Number(min[1]) : false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    } as MediaQueryList
  }) as typeof window.matchMedia
}

const sims: Sim[] = []
const originalMatchMedia = window.matchMedia
const originalGetContext = HTMLCanvasElement.prototype.getContext
const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause

export function newSim(scenario: ScenarioName, operatorId: string | null = OPERATOR_IDS.BUDI): Sim {
  const authStorage = createMemoryAuthStorage()
  if (operatorId !== null) authStorage.save({ operatorId, issuedAt: DEMO_NOW })
  const sim = createSim({ clock: createManualClock(DEMO_NOW), scenario, storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  return sim
}

export function mount(route: string, scenario: ScenarioName, prepare: (sim: Sim) => void = () => undefined, operatorId: string = OPERATOR_IDS.BUDI): Sim {
  const sim = newSim(scenario, operatorId)
  prepare(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: [route] }) })
  render(<RouterProvider router={router} />)
  return sim
}

/** A Core in its own capture: the two statements of the state (contract examples). */
export function realCore(sim: Sim): void {
  sim.store.setState({ security: { ...sim.store.getState().security, ...SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE }, time: { ...HOST_CLOCK_TIME } })
}

export const unsealableOf = (sessionId: string, patch: Partial<SimAlert> = {}): SimAlert => ({ ...SEAL_UNSEALABLE_EXAMPLE_ALERT, target: sessionId, params: { ...SEAL_UNSEALABLE_EXAMPLE_ALERT.params, sessionId }, ...patch })

/** The set-up and tear-down of the harness, for the `describe` that calls it. */
export function useRealCorePages(): void {
  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
    Element.prototype.scrollTo ??= function scrollTo() {}
    window.scrollTo = (() => undefined) as typeof window.scrollTo
  })
  afterAll(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext
    HTMLMediaElement.prototype.play = originalPlay
    HTMLMediaElement.prototype.pause = originalPause
    window.matchMedia = originalMatchMedia
  })
  beforeEach(() => {
    resetMissingI18nKeys()
    stubMatchMedia()
    window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve()) as unknown as HTMLMediaElement['play']
    HTMLMediaElement.prototype.pause = vi.fn() as unknown as HTMLMediaElement['pause']
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })))
  })
  afterEach(() => {
    cleanup()
    for (const sim of sims.splice(0)) sim.stop()
    vi.unstubAllGlobals()
    window.sessionStorage.clear()
  })
}

export const page = (testId: string) => screen.findByTestId(testId, {}, FIND)
