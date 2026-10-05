/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W0, item 6 (finding F70-1, decision D156): the Log tab of the device drawer words an
// Identify row as "Identify (blink)" — the device menu's own word — in both data modes. Before W0
// every DEVICE_COMMAND that was not a test signal read "Restart (simulated)" / "Restart". This is the
// ONE deliberate change of a Simulated screen in row W0.
//
// | Mode | Where |
// |------|-------|
// | Simulated: the simulator's own Identify row reads "Identify (blink)"; a test signal and a restart keep their words | "Simulated" |
// | Live: the Core's Identify row reads "Identify (blink)"; no "Restart", no "simulated" | "Live" |
import { cleanup, configure, fireEvent, render, screen, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createManualClock, createMemoryAuthStorage, createSim, DeviceCommand, OPERATOR_IDS, type Sim } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createAppRouter } from '@/router'
import { webErrorSink } from '@/runtime'
import { createLiveTestBed, SUPERVISOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 25_000 })

const IDENTIFY = en.common.deviceMenu.identify
const DEMO_NOW = Date.parse('2026-10-01T10:00:00+07:00')

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

const originalMatchMedia = window.matchMedia
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}

const sims: Sim[] = []
let bed: LiveTestBed | undefined

/** A simulator signed in as a TECHNICIAN (Restart needs DEVICE_MANAGE), on a manual clock that never ticks by itself. */
function technicianSim(): Sim {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.RINA, issuedAt: DEMO_NOW })
  const sim = createSim({ clock: createManualClock(DEMO_NOW), scenario: 'idle', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  return sim
}

/** Opens Camera 1's drawer on its Log tab and returns the Log's table. */
async function cameraLog(): Promise<HTMLElement> {
  fireEvent.click(await screen.findByRole('button', { name: 'Open details for Camera 1' }))
  const drawer = await screen.findByTestId('device-drawer')
  fireEvent.click(within(drawer).getByRole('tab', { name: 'Log' }))
  return within(drawer).findByTestId('device-log')
}

/** The Log's detail cells (the third column), top to bottom. */
const detailCells = (log: HTMLElement) => within(log).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('gridcell').at(-1)?.textContent ?? '')

const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
  HTMLMediaElement.prototype.play = (() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = (() => undefined) as unknown as HTMLMediaElement['pause']
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
  resetCoreErrorPresenter()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
})

afterEach(async () => {
  cleanup()
  await clearToasts()
  for (const sim of sims.splice(0)) sim.stop()
  bed?.dispose()
  bed = undefined
  vi.restoreAllMocks()
})

describe('Simulated: the drawer Log words each device command by its own name', () => {
  it('an Identify row reads "Identify (blink)"; the test signal and the restart keep their Simulated words', async () => {
    const sim = technicianSim()
    sim.actions.deviceCommand('CAM-01', DeviceCommand.TEST_SIGNAL)
    sim.actions.deviceCommand('CAM-01', DeviceCommand.IDENTIFY)
    sim.actions.deviceCommand('CAM-01', DeviceCommand.RESTART)
    const router = createAppRouter(
      { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket() },
      { history: createMemoryHistory({ initialEntries: ['/devices'] }) },
    )
    render(<RouterProvider router={router} />)
    await screen.findByTestId('page-devices', {}, { timeout: 15_000 })
    const cells = detailCells(await cameraLog())
    expect(cells).toEqual(expect.arrayContaining([IDENTIFY, en.common.deviceMenu.testSignal, en.common.deviceMenu.restart]))
    expect(cells.filter((cell) => cell === IDENTIFY)).toHaveLength(1)
    expect(cells.filter((cell) => cell === en.common.deviceMenu.restart)).toHaveLength(1)
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('Live: the Core\'s Identify row reads "Identify (blink)"', () => {
  it('no "Restart" and no "simulated" for an Identify row of the Core', async () => {
    // The Core's own engine records one Identify of CAM-01 (the row the served state holds).
    const source = technicianSim()
    source.actions.deviceCommand('CAM-01', DeviceCommand.IDENTIFY)
    const row = source.store.getState().audit.rows.at(-1)!
    expect(row.details.command).toBe(DeviceCommand.IDENTIFY)
    const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
    bed = created
    created.core.served = { ...created.core.served, audit: { ...created.core.served.audit, rows: [...created.core.served.audit.rows, row] } }
    const page = await created.load()
    await created.mount(page, '/devices')
    await screen.findByTestId('page-devices', {}, { timeout: 15_000 })
    const log = await cameraLog()
    const cells = detailCells(log)
    expect(cells).toContain(IDENTIFY)
    expect(cells).not.toContain(en.devices.live.menu.restart)
    expect(log.textContent ?? '').not.toMatch(/simulat/i)
    expect(getMissingI18nKeys()).toEqual([])
  })
})
