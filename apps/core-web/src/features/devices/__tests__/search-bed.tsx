// Test support of blueprint row 137: Devices & Inputs in Simulated mode on the real router and a real simulator.
import { cleanup, render, screen } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, type ScenarioName, type Sim } from '@dems/shared/sim'
import { resetMissingI18nKeys } from '@/i18n'
import { createAppRouter } from '@/router'
import { webErrorSink } from '@/runtime'

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

const sims: Sim[] = []
export let consoleCalls: unknown[][] = []
export const toastTexts = (): string[] => Array.from(document.querySelectorAll('[data-slot="toast"]')).map((element) => element.textContent ?? '')

export interface MountedDevices {
  sim: Sim
  queryClient: QueryClient
}

export async function mountDevices(scenario: ScenarioName, operatorId: string, prepare?: (sim: Sim) => void, path = '/devices'): Promise<MountedDevices> {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId, issuedAt: Date.now() })
  const sim = createSim({ scenario, storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  prepare?.(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: [path] }) })
  render(<RouterProvider router={router} />)
  if (path === '/devices') await screen.findByTestId('page-devices', undefined, { timeout: 8_000 })
  return { sim, queryClient }
}

/** jsdom has no media playback, canvas or Web Animations; the console and the sink are recorded for the canary checks. */
export function installDevicesBed(): void {
  const originalPlay = HTMLMediaElement.prototype.play
  const originalPause = HTMLMediaElement.prototype.pause
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
    Element.prototype.scrollTo ??= function scrollTo() {}
    Element.prototype.scrollIntoView ??= function scrollIntoView() {}
    window.scrollTo = (() => undefined) as typeof window.scrollTo
    Element.prototype.getAnimations ??= function getAnimations() {
      return []
    }
  })
  afterAll(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext
    HTMLMediaElement.prototype.play = originalPlay
    HTMLMediaElement.prototype.pause = originalPause
  })
  beforeEach(() => {
    resetMissingI18nKeys()
    webErrorSink.clear()
    consoleCalls = []
    for (const level of ['error', 'warn', 'log', 'info', 'debug'] as const) {
      vi.spyOn(console, level).mockImplementation((...parts: unknown[]) => void consoleCalls.push(parts))
    }
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve()) as unknown as HTMLMediaElement['play']
    HTMLMediaElement.prototype.pause = vi.fn() as unknown as HTMLMediaElement['pause']
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })))
  })
  afterEach(() => {
    cleanup()
    toast.clear()
    for (const sim of sims.splice(0)) sim.stop()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
}
