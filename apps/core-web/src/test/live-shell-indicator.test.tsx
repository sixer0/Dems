/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W54: the mode indicator of the shell's top bar and the shell's mode switch (backend task
// 04_client_integration_spec §3.2, §3.3, MD-4; CA-09). The page of this file is
// `http://127.0.0.1:5178/`: the address the console is opened at in Live mode (WT-2a).
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | AC-C-24 the indicator `shell-mode` reads SIMULATED with the simulator, LIVE with the Live source and the link up, LIVE · OFFLINE with the link down; it is rendered at every shell width | "at three widths" |
// | §3.2 LIVE · RECONNECTING while the socket resynchronises | "while the socket resynchronises" |
// | MD-4 the switch is offered only where the router carries a selectable mode | "the mode switch" |
// | §3.3 step 1: the confirmation with the specification's sentence, then the runtime's `switchTo` | "the mode switch" |
// | CA-09 one chip in the top bar breaks no existing test: nothing of the bar is hidden for it, and it is hidden at no width | "never hidden" |
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pickReplicatedState, type HealthResponse, type ReplicatedState } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { CoreMode, LiveLinkState } from '@dems/shared/live'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim, type SimState } from '@dems/shared/sim'
import { isLinkLost, isLinkUp, modeIndicatorState } from '@/components/shell/mode-indicator-state'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { createAppRouter } from '@/router'
import { webErrorSink, type CoreModeControl } from '@/runtime'
import { createLiveTestBed, SUPERVISOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'

const SHELL_DIR = join(dirname(fileURLToPath(import.meta.url)), '../components/shell')

const health: HealthResponse = {
  status: 'ok',
  service: 'dems-mock-core',
  version: '0.1.0',
  apiVersion: 'v1',
  serverTime: '2026-10-04T03:00:00.000Z',
  uptimeMs: 1000,
  ws: { path: '/ws', heartbeatIntervalMs: 1000, clients: 1 },
}

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

// A page's chunk is loaded by a dynamic import: under load that can take longer than the library's default second.
configure({ asyncUtilTimeout: 6_000 })
vi.setConfig({ testTimeout: 20_000 })

/** The three widths of the row: the full sidebar, the Drawer and the bottom tab bar. */
const WIDTHS: ReadonlyArray<readonly [width: number, tier: string, sidebar: string]> = [
  [1920, 'xl', 'full'],
  [900, 'sm', 'drawer'],
  [600, 'xs', 'tabs'],
]

const originalMatchMedia = window.matchMedia
/** matchMedia that answers `(min-width: Npx)` for a given viewport width (jsdom has no layout). */
function viewport(width: number) {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    return {
      matches: min ? width >= Number(min[1]) : false,
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

/**
 * Empties the kit's toast queue, which is one per page and outlives a test. A toast that is still
 * open is closed without its exit animation; one that a test closed is waited for (300 ms).
 */
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}

Element.prototype.scrollTo ??= function scrollTo() {}
window.scrollTo = (() => undefined) as typeof window.scrollTo

let bed: LiveTestBed | undefined
const sims: Sim[] = []

/** The console on the simulator, as every test before the backend task builds it; `coreMode` as the app passes it. */
function mountSimulated(path: string, coreMode?: CoreModeControl) {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: Date.now() })
  const sim = createSim({ storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  const router = createAppRouter(
    { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket(), ...(coreMode ? { coreMode } : {}) },
    { history: createMemoryHistory({ initialEntries: [path] }) },
  )
  render(<RouterProvider router={router} />)
  return { sim, router }
}

const control = (mode: CoreMode, switchTo: CoreModeControl['switchTo'] = vi.fn(async () => true)): CoreModeControl => ({ mode, selectable: true, switchTo })

const wire = (state: SimState): ReplicatedState => pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState)

const indicator = () => screen.getByTestId('shell-mode')
/** The kit's colour class of the chip: `chip--warning`, `chip--success` or `chip--danger`. */
const tone = () => [...(indicator().querySelector('.dems-mode-chip')?.classList ?? [])].filter((name) => /^chip--(warning|success|danger|default|accent)$/.test(name))

beforeEach(() => {
  resetMissingI18nKeys()
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(health), { status: 200 })),
  )
})

afterEach(async () => {
  cleanup()
  await clearToasts()
  for (const sim of sims.splice(0)) sim.stop()
  bed?.dispose()
  bed = undefined
  window.matchMedia = originalMatchMedia
  vi.unstubAllGlobals()
})

describe('the indicator state (§3.2)', () => {
  it('follows the data mode and, in Live mode, the link and nothing else', () => {
    expect(modeIndicatorState(CoreMode.SIMULATED, null)).toBe('SIMULATED')
    expect(modeIndicatorState(CoreMode.LIVE, LiveLinkState.ONLINE)).toBe('LIVE')
    expect(modeIndicatorState(CoreMode.LIVE, LiveLinkState.OFFLINE)).toBe('OFFLINE')
    expect(modeIndicatorState(CoreMode.LIVE, LiveLinkState.STALE)).toBe('OFFLINE')
    expect(modeIndicatorState(CoreMode.LIVE, LiveLinkState.CONNECTING)).toBe('RECONNECTING')
    expect(modeIndicatorState(CoreMode.LIVE, LiveLinkState.RESYNCING)).toBe('RECONNECTING')
    // A simulator has no link; a link value beside it changes nothing.
    expect(modeIndicatorState(CoreMode.SIMULATED, LiveLinkState.ONLINE)).toBe('SIMULATED')
    expect(modeIndicatorState(CoreMode.LIVE, null)).toBe('SIMULATED')
  })

  it('the link notice counts OFFLINE and STALE as lost, ONLINE and RESYNCING as up, and CONNECTING as neither', () => {
    const lost = Object.values(LiveLinkState).filter((link) => isLinkLost(link))
    const up = Object.values(LiveLinkState).filter((link) => isLinkUp(link))
    expect(lost.sort()).toEqual([LiveLinkState.OFFLINE, LiveLinkState.STALE].sort())
    expect(up.sort()).toEqual([LiveLinkState.ONLINE, LiveLinkState.RESYNCING].sort())
    expect(isLinkLost(LiveLinkState.CONNECTING) || isLinkUp(LiveLinkState.CONNECTING)).toBe(false)
    expect(isLinkLost(null) || isLinkUp(null)).toBe(false)
  })

  it('the words are the specification\'s', () => {
    expect(en.common.coreMode.chip).toEqual({ SIMULATED: 'SIMULATED', LIVE: 'LIVE' })
    expect(en.common.coreMode.chipOffline).toBe('LIVE · OFFLINE')
    expect(en.common.coreMode.chipReconnecting).toBe('LIVE · RECONNECTING')
    expect(en.shell.mode.tooltip.SIMULATED).toBe('The Core is simulated in this browser. Nothing is sent to a server.')
    expect(en.shell.mode.tooltip.LIVE).toBe('Data comes from the Core server on this computer.')
  })
})

describe.each(WIDTHS)('AC-C-24: the indicator at three widths, %i px', (width, tier, sidebar) => {
  it('reads SIMULATED with the simulator', async () => {
    viewport(width)
    mountSimulated('/storage')
    await screen.findByTestId('page-storage')
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-shell-tier', tier)
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-sidebar', sidebar)
    expect(within(screen.getByRole('banner')).getByTestId('shell-mode')).toBe(indicator())
    expect(indicator()).toHaveTextContent(/^SIMULATED$/)
    expect(indicator()).toHaveAttribute('data-state', 'SIMULATED')
    expect(indicator()).toHaveAttribute('aria-label', 'Data mode: SIMULATED')
    expect(tone()).toEqual(['chip--warning'])
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-core-mode', 'SIMULATED')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('reads LIVE with the Live source and the link up', async () => {
    viewport(width)
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    await bed.mount(page, '/storage')
    await screen.findByTestId('page-storage')
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-shell-tier', tier)
    expect(page.live.link).toBe(LiveLinkState.ONLINE)
    expect(within(screen.getByRole('banner')).getByTestId('shell-mode')).toBe(indicator())
    expect(indicator()).toHaveTextContent(/^LIVE$/)
    expect(indicator()).toHaveAttribute('data-state', 'LIVE')
    expect(indicator()).toHaveAttribute('aria-label', 'Data mode: LIVE')
    expect(tone()).toEqual(['chip--success'])
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-core-mode', 'LIVE')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('reads LIVE · OFFLINE with the link down, and LIVE again when it is back', async () => {
    viewport(width)
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    await bed.mount(page, '/storage')
    await screen.findByTestId('page-storage')

    bed.core.unreachable()
    await bed.flush()
    expect(page.live.link).toBe(LiveLinkState.OFFLINE)
    expect(indicator()).toHaveTextContent(/^LIVE · OFFLINE$/)
    expect(indicator()).toHaveAttribute('data-state', 'OFFLINE')
    expect(indicator()).toHaveAttribute('aria-label', 'Data mode: LIVE · OFFLINE')
    expect(tone()).toEqual(['chip--danger'])
    // Through the retries of the socket the indicator never says LIVE.
    await bed.elapse(5_000)
    expect(indicator()).not.toHaveAttribute('data-state', 'LIVE')
    // …and none of those retries turns the chip to the recovery colour: after a real loss the chip
    // stays in the outage colour until the link is up again (decision D144(2), finding CPW1-6), so
    // the chip and the sticky notice never disagree during an outage.
    for (let step = 0; step < 6; step += 1) {
      expect(tone()).toEqual(['chip--danger'])
      await bed.elapse(500)
    }

    bed.core.back()
    await bed.elapse(40_000, 1_000)
    expect(page.live.link).toBe(LiveLinkState.ONLINE)
    expect(indicator()).toHaveTextContent(/^LIVE$/)
    expect(indicator()).toHaveAttribute('data-state', 'LIVE')
  })
})

describe('LIVE · RECONNECTING (§3.2)', () => {
  it('while the socket resynchronises: a delta with a gap, until the snapshot that was asked for', async () => {
    viewport(1920)
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    await bed.mount(page, '/storage')
    await screen.findByTestId('page-storage')
    const socket = page.sockets.at(-1)!

    // The Core is three revisions ahead of what this socket was told: the client drops the delta and asks for a snapshot.
    socket.delta([{ op: 'replace', slice: 'operators', value: wire(bed.core.served).operators }], { revision: bed.fake.position.revision + 3 })
    await bed.flush()
    expect(page.live.link).toBe(LiveLinkState.RESYNCING)
    expect(indicator()).toHaveTextContent(/^LIVE · RECONNECTING$/)
    expect(indicator()).toHaveAttribute('data-state', 'RECONNECTING')
    // D144(2) / CPW1-6: the link is up while it resynchronises, so the chip is not in the outage colour.
    expect(tone()).toEqual(['chip--warning'])
    // The link is up: this is not an outage, and no link notice is shown.
    expect(screen.queryByText(en.common.coreLink.lostTitle)).not.toBeInTheDocument()

    await bed.elapse(2_500)
    expect(socket.receivedOf('resync')).toHaveLength(1)
    socket.snapshot(wire(bed.core.served))
    await bed.flush()
    expect(page.live.link).toBe(LiveLinkState.ONLINE)
    expect(indicator()).toHaveAttribute('data-state', 'LIVE')
    expect(screen.queryByText(en.common.coreLink.restored)).not.toBeInTheDocument()
  })
})

describe('the mode switch of the shell (§3.3 step 1; MD-4)', () => {
  it('without a selectable mode the indicator is no control: a router built without `coreMode`, in both modes', async () => {
    viewport(1920)
    mountSimulated('/storage')
    await screen.findByTestId('page-storage')
    expect(indicator().tagName).not.toBe('BUTTON')
    fireEvent.click(indicator())
    expect(screen.queryByTestId('mode-switch-dialog')).not.toBeInTheDocument()
    cleanup()

    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    await bed.mount(page, '/storage')
    await screen.findByTestId('page-storage')
    expect(indicator().tagName).not.toBe('BUTTON')
    fireEvent.click(indicator())
    expect(screen.queryByTestId('mode-switch-dialog')).not.toBeInTheDocument()
  })

  it('a build that offers no choice (`selectable: false`) gets no control either', async () => {
    viewport(1920)
    const switchTo = vi.fn(async () => true)
    mountSimulated('/storage', { mode: CoreMode.SIMULATED, selectable: false, switchTo })
    await screen.findByTestId('page-storage')
    expect(indicator().tagName).not.toBe('BUTTON')
    fireEvent.click(indicator())
    expect(screen.queryByTestId('mode-switch-dialog')).not.toBeInTheDocument()
    expect(switchTo).not.toHaveBeenCalled()
  })

  it('Simulated: the chip opens the confirmation for Live; nothing is switched before Confirm; Cancel changes nothing', async () => {
    viewport(1920)
    const switchTo = vi.fn(async () => true)
    mountSimulated('/storage', control(CoreMode.SIMULATED, switchTo))
    await screen.findByTestId('page-storage')
    expect(indicator().tagName).toBe('BUTTON')
    expect(indicator()).toHaveTextContent(/^SIMULATED$/)
    expect(indicator()).toHaveAttribute('data-state', 'SIMULATED')
    expect(indicator()).toHaveAttribute('aria-label', 'Data mode: SIMULATED')

    fireEvent.click(indicator())
    const dialog = await screen.findByTestId('mode-switch-dialog')
    expect(within(dialog).getByText('Switch to Live mode?')).toBeInTheDocument()
    expect(within(dialog).getByText('You will be signed out and the console reloads. Simulated data and Live data are separate.')).toBeInTheDocument()
    expect(switchTo).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByTestId('mode-switch-cancel'))
    await waitFor(() => expect(screen.queryByTestId('mode-switch-dialog')).not.toBeInTheDocument())
    expect(switchTo).not.toHaveBeenCalled()

    fireEvent.click(indicator())
    fireEvent.click(within(await screen.findByTestId('mode-switch-dialog')).getByTestId('mode-switch-confirm'))
    await waitFor(() => expect(switchTo).toHaveBeenCalledTimes(1))
    expect(switchTo).toHaveBeenCalledWith(CoreMode.LIVE)
    // The switch succeeded: the page is being loaded again, and nothing says that it failed.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByText(en.common.coreMode.switchFailed)).not.toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('Live: the chip opens the confirmation for Simulated and hands the choice to the runtime once', async () => {
    viewport(1920)
    const switchTo = vi.fn(() => new Promise<boolean>(() => undefined)) // the page is being loaded again: it never settles here
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    await bed.mount(page, '/storage', { coreMode: control(CoreMode.LIVE, switchTo) })
    await screen.findByTestId('page-storage')
    expect(indicator().tagName).toBe('BUTTON')
    expect(indicator()).toHaveTextContent(/^LIVE$/)

    fireEvent.click(indicator())
    const dialog = await screen.findByTestId('mode-switch-dialog')
    expect(within(dialog).getByText('Switch to Simulated mode?')).toBeInTheDocument()
    const confirm = within(dialog).getByTestId('mode-switch-confirm')
    fireEvent.click(confirm)
    fireEvent.click(confirm) // a second press while the switch runs sends nothing
    await waitFor(() => expect(switchTo).toHaveBeenCalledTimes(1))
    expect(switchTo).toHaveBeenCalledWith(CoreMode.SIMULATED)
    // The shell itself signs nobody out: steps 2 to 4 are the runtime's.
    expect(bed.fake.log.requestsOf('signOut')).toHaveLength(0)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a switch that throws is reported to the page\'s log, and the operator is told that nothing changed', async () => {
    viewport(1920)
    const records = webErrorSink.records().length
    mountSimulated('/storage', control(CoreMode.SIMULATED, vi.fn(() => Promise.reject(new Error('the storage is gone')))))
    await screen.findByTestId('page-storage')
    fireEvent.click(indicator())
    fireEvent.click(within(await screen.findByTestId('mode-switch-dialog')).getByTestId('mode-switch-confirm'))
    expect(await screen.findByText(en.common.coreMode.switchFailed)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByTestId('mode-switch-dialog')).not.toBeInTheDocument())
    // CPW1-8 (decision D144(1)): the record is the caller's fixed sentence plus the class of the
    // cause and the two modes. The text of an unknown error is never written to the page's log.
    const written = webErrorSink.records().slice(records)
    expect(written).toEqual([
      expect.objectContaining({
        level: 'error',
        source: 'shell.modeSwitch',
        message: 'The data mode could not be changed.',
        context: { from: 'SIMULATED', to: 'LIVE', errorName: 'Error' },
      }),
    ])
    expect(JSON.stringify(written)).not.toContain('the storage is gone')
  })

  it('a choice the browser could not store: the dialog closes and the operator is told that nothing changed', async () => {
    viewport(1920)
    const switchTo = vi.fn(async () => false)
    mountSimulated('/storage', control(CoreMode.SIMULATED, switchTo))
    await screen.findByTestId('page-storage')
    fireEvent.click(indicator())
    fireEvent.click(within(await screen.findByTestId('mode-switch-dialog')).getByTestId('mode-switch-confirm'))
    expect(await screen.findByText(en.common.coreMode.switchFailed)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByTestId('mode-switch-dialog')).not.toBeInTheDocument())
    expect(indicator()).toHaveTextContent(/^SIMULATED$/)
  })
})

describe('never hidden (AC-C-24; CA-09)', () => {
  const css = readFileSync(join(SHELL_DIR, 'shell.css'), 'utf8')
  const topBar = readFileSync(join(SHELL_DIR, 'top-bar.tsx'), 'utf8')
  const source = readFileSync(join(SHELL_DIR, 'mode-indicator.tsx'), 'utf8')

  it('the indicator carries none of the classes that drop a top-bar item at a narrow width', () => {
    expect(source).not.toMatch(/dems-hide-below/)
    expect(topBar).toMatch(/<DeviceBlock \/>\s*<Separator[^>]*\/>\s*<ModeIndicator \/>\s*<Separator[^>]*\/>\s*<NotificationsBell \/>/)
  })

  /**
   * Every `@media <condition>` block of the stylesheet, each as its list of rules, flattened
   * (finding CPW1-5): the widths are READ, so reformatting the stylesheet cannot redden this test
   * while it hides exactly the same items. What is pinned is which item yields at which width.
   */
  function mediaBlocks(condition: string): string[][] {
    const flat = css.replace(/\s+/g, ' ')
    const needle = `@media ${condition}`
    const found: string[][] = []
    for (let at = flat.indexOf(needle); at >= 0; at = flat.indexOf(needle, at + 1)) {
      const open = flat.indexOf('{', at)
      if (open < 0) break
      let depth = 0
      let end = open
      for (let i = open; i < flat.length; i += 1) {
        if (flat[i] === '{') depth += 1
        else if (flat[i] === '}') {
          depth -= 1
          if (depth === 0) {
            end = i
            break
          }
        }
      }
      found.push(flat.slice(open + 1, end).split('}').map((rule) => rule.trim()).filter((rule) => rule !== ''))
    }
    return found
  }

  /** The selector list and the body of each rule of one `@media` block. */
  function declarations(rules: readonly string[]): Array<{ selectors: string[]; hidesSomething: boolean }> {
    return rules.map((rule) => {
      const at = rule.indexOf('{')
      const list = (at < 0 ? rule : rule.slice(0, at)).split(',').map((one) => one.trim())
      return { selectors: list, hidesSomething: /display:\s*none/.test(at < 0 ? '' : rule.slice(at)) }
    })
  }

  /**
   * True when the block hides an element that IS of this class — a selector that ends with it, so a
   * rule that only hides `.x + .y` does not count as hiding `.x` (proven by mutation: the first form
   * of this helper accepted that, and the date could stop yielding while the test stayed green).
   * With `liveOnly`, the selector must also key on the shell's Live mode attribute.
   */
  const blockHides = (condition: string, className: string, liveOnly = false): boolean =>
    mediaBlocks(condition).some((rules) =>
      declarations(rules).some(
        ({ selectors, hidesSomething }) =>
          hidesSomething &&
          selectors.some((one) => new RegExp(`\\.${className}$`).test(one) && (liveOnly ? /data-core-mode=['"]?LIVE/.test(one) : true)),
      ),
    )

  it('where the bar cannot hold both, the date yields: below 1520 px in both modes, below 1664 px in Live mode', () => {
    expect(blockHides('(width < 1520px)', 'dems-topbar-date')).toBe(true)
    // The 1664 block is the Live-only one: its selector keys on the shell's mode attribute.
    expect(blockHides('(width < 1664px)', 'dems-topbar-date', true)).toBe(true)
    // At the width of a phone the clock yields as well, on the same two conditions.
    expect(blockHides('(width < 432px)', 'dems-topbar-clock')).toBe(true)
    expect(blockHides('(width < 496px)', 'dems-topbar-clock', true)).toBe(true)
  })

  it('no rule of the shell\'s stylesheet hides it', () => {
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selector]) => /dems-mode-(indicator|chip)/.test(selector ?? ''))
    expect(rules.length).toBeGreaterThan(0)
    for (const [, , body] of rules) expect(body).not.toMatch(/display\s*:\s*none|visibility\s*:\s*hidden/)
  })
})
