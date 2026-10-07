/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// E-fix FX-W2 (routed by D202): the Session Monitor's note drawer was titled "Investigator note" (and its
// action said "Add investigator note") even when a SUPERVISOR wrote the note, while FX-C titles the
// timeline entry by the author's role ("Supervisor Note Added" / "Investigator Note Added"). The drawer
// title and the action's subtitle now follow the signed-in operator's role (`session.actions.sessionNote.
// drawerTitleBy` / `subtitleBy`), in both data modes.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createManualClock, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createAppRouter } from '@/router'
import { createLiveTestBed, SUPERVISOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'

vi.setConfig({ testTimeout: 30_000 })

const N = en.session.actions.sessionNote
const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext

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
let bed: LiveTestBed | undefined

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
  Element.prototype.scrollTo ??= function scrollTo() {}
  window.scrollTo = (() => undefined) as typeof window.scrollTo
})

afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
  HTMLMediaElement.prototype.play = originalPlay
  HTMLMediaElement.prototype.pause = originalPause
})

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = vi.fn() as unknown as HTMLMediaElement['pause']
})

afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  bed?.dispose()
  bed = undefined
  vi.unstubAllGlobals()
})

/** A simulator in the recording scenario with `operatorId` signed in. */
function recordingSim(operatorId: string, at = Date.parse('2026-10-01T10:00:00+07:00')): Sim {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId, issuedAt: at })
  const sim = createSim({ scenario: 'recording', clock: createManualClock(at), storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  return sim
}

async function simulatedMonitor(operatorId: string) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })))
  const sim = recordingSim(operatorId)
  const router = createAppRouter(
    { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket() },
    { history: createMemoryHistory({ initialEntries: ['/session'] }) },
  )
  render(<RouterProvider router={router} />)
  await screen.findByTestId('page-session-monitor', {}, { timeout: 15_000 })
}

/** Opens the note drawer and returns it with the action button. */
async function openNoteDrawer(): Promise<{ action: HTMLElement; drawer: HTMLElement }> {
  const action = screen.getByTestId('sm-action-note')
  fireEvent.click(action)
  return { action, drawer: await screen.findByTestId('sm-note-drawer') }
}

describe('the note drawer follows the signed-in role (Simulated mode)', () => {
  it('a SUPERVISOR writes a "Supervisor note": drawer heading, dialog name and action subtitle', async () => {
    await simulatedMonitor(OPERATOR_IDS.ANDI)
    const { action, drawer } = await openNoteDrawer()
    expect(action).toHaveTextContent(N.subtitleBy.SUPERVISOR)
    expect(action).not.toHaveTextContent(/investigator/i)
    expect(within(drawer).getByRole('heading', { name: N.drawerTitleBy.SUPERVISOR })).toBeInTheDocument()
    expect(drawer).toHaveAttribute('aria-label', 'Supervisor note')
    expect(drawer).toHaveAttribute('data-role', 'SUPERVISOR')
    expect(drawer.textContent ?? '').not.toMatch(/investigator note/i)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('an INVESTIGATOR writes an "Investigator note"', async () => {
    await simulatedMonitor(OPERATOR_IDS.BUDI)
    const { action, drawer } = await openNoteDrawer()
    expect(action).toHaveTextContent(N.subtitleBy.INVESTIGATOR)
    expect(within(drawer).getByRole('heading', { name: N.drawerTitleBy.INVESTIGATOR })).toBeInTheDocument()
    expect(drawer).toHaveAttribute('aria-label', 'Investigator note')
  })

  it('the words match the timeline titles FX-C gives the note of each role, and the neutral fallback names no role', () => {
    expect(N.drawerTitleBy.SUPERVISOR).toBe('Supervisor note')
    expect(en.session.timeline.noteBy.SUPERVISOR).toBe('Supervisor Note Added')
    expect(N.drawerTitleBy.INVESTIGATOR).toBe('Investigator note')
    expect(en.session.timeline.noteBy.INVESTIGATOR).toBe('Investigator Note Added')
    expect(N.drawerTitle).toBe('Session note')
    expect(N.subtitle).not.toMatch(/investigator|supervisor|technician/i)
  })
})

describe('the note drawer follows the signed-in role (Live mode)', () => {
  it('the SUPERVISOR of the Core session gets "Supervisor note"', async () => {
    const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
    bed = created
    // The Core's model: the recording scenario on the fake transport's clock.
    created.core.served = recordingSim(OPERATOR_IDS.ANDI, created.fake.clock.now()).store.getState()
    const page = await created.load()
    await created.mount(page, '/session')
    await screen.findByTestId('page-session-monitor', {}, { timeout: 15_000 })
    await waitFor(() => expect(screen.getByTestId('page-session-monitor')).toHaveAttribute('data-phase', 'RECORDING'))
    const { action, drawer } = await openNoteDrawer()
    expect(action).toHaveTextContent(N.subtitleBy.SUPERVISOR)
    expect(within(drawer).getByRole('heading', { name: N.drawerTitleBy.SUPERVISOR })).toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  })
})
