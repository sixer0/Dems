// Plan row W50: the runtime's public surface for the shell and the page rows (`@/runtime`).
// What a page imports to know the mode, to call an operation and to offer the mode switch.
import { renderHook } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterContextProvider } from '@tanstack/react-router'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CoreMode, useCoreMode, useLiveLink } from '@dems/shared/live'
import { ALWAYS_VISIBLE, createSim, SimProvider, type Sim } from '@dems/shared/sim'
import { createAppRouter } from '@/router'
import * as runtime from '@/runtime'
import { useCoreModeControl, useWebLive, type CoreModeControl, type WebLive } from '@/runtime'
import { createLiveTestBed, SUPERVISOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'

let bed: LiveTestBed | undefined
const sims: Sim[] = []

afterEach(() => {
  for (const sim of sims.splice(0)) sim.stop()
  bed?.dispose()
  bed = undefined
})

function simulator(): Sim {
  const sim = createSim({ storage: null, authStorage: null, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  return sim
}

const withSource = (sim: Sim) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(SimProvider, { sim }, children)
  }

describe('`@/runtime`: the barrel', () => {
  it('exports the names the page rows are told, and nothing of the heavy module or of the test harness', () => {
    expect(Object.keys(runtime).sort()).toEqual(
      [
        'ADMIN_CHANGED_QUERY_KEYS',
        'CORE_MODE_ENV_KEY',
        'CORE_MODE_STORAGE_KEY',
        'CORE_QUERY_DEFAULTS',
        'CORE_QUERY_KEY',
        'CORE_QUERY_KEYS',
        'CORE_QUERY_PERMISSIONS',
        'CORE_QUERY_ROOT',
        'ERROR_SINK_CAPACITY',
        'LIVE_CONSOLE_HOST',
        'liveConsoleOrigin',
        'onCoreQueriesCleared',
        'redactCredentials',
        'useCoreModeControl',
        'useWebLive',
        'webErrorSink',
      ].sort(),
    )
    for (const name of ['startLiveRuntime', 'bootCoreRuntime', 'createLiveTestBed', 'createOwedSignOutPort']) {
      expect(Object.keys(runtime)).not.toContain(name)
    }
  })
})

describe('useWebLive: the one way a page reaches the Core server', () => {
  it('Live mode: the Live source of the page, with the registry-typed client; the shared hooks read the same source', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    const hook = renderHook(() => ({ live: useWebLive(), mode: useCoreMode(), link: useLiveLink() }), { wrapper: withSource(page.runtime.sim) })
    expect(hook.result.current.mode).toBe(CoreMode.LIVE)
    expect(hook.result.current.link).toBe('ONLINE')
    const live: WebLive | null = hook.result.current.live
    expect(live).toBe(page.live)
    // Typed by the contract: the operation ID and the answer's members are checked by the compiler.
    const answer = await live?.client.call('listUsers')
    expect(answer?.ok).toBe(true)
    if (answer?.ok) expect(Array.isArray(answer.data.users)).toBe(true)
    expect(bed.fake.log.requestsOf('listUsers')).toHaveLength(1)
    hook.unmount()
  })

  it('Simulated mode: `null`, so a page shows its "Live mode only" state and calls nothing', () => {
    const hook = renderHook(() => ({ live: useWebLive(), mode: useCoreMode(), link: useLiveLink() }), { wrapper: withSource(simulator()) })
    expect(hook.result.current).toEqual({ live: null, mode: CoreMode.SIMULATED, link: null })
  })
})

describe('useCoreModeControl: the mode of this page load and its switch (MD-4)', () => {
  const control: CoreModeControl = { mode: CoreMode.SIMULATED, selectable: true, switchTo: vi.fn(async () => true) }

  function under(coreMode: CoreModeControl | undefined) {
    const router = createAppRouter(
      { sim: simulator(), queryClient: new QueryClient(), ...(coreMode === undefined ? {} : { coreMode }) },
      { history: createMemoryHistory({ initialEntries: ['/login'] }) },
    )
    return renderHook(() => useCoreModeControl(), {
      wrapper: ({ children }: { children: ReactNode }) => <RouterContextProvider router={router}>{children}</RouterContextProvider>,
    })
  }

  it('the object the entry put into the router context', () => {
    expect(under(control).result.current).toBe(control)
  })

  it('`null` for a router built without it (every test that existed before): no selector is rendered', () => {
    expect(under(undefined).result.current).toBeNull()
  })
})
