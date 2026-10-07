// E-fix FX-W, E2E-W1-6: at 390 x 844 the Dashboard status strip's six labels and values ran into one
// another ("3.2 TB Free" over "Synchronized" over "Secure", "Connected" cut at the right edge).
//
// Root cause: the narrow-tier rules (`dashboard.css`) set the wrap basis on `.dems-strip-cell`, but
// the strip's flex items are the cells' motion wrappers, which carried the `flex-1` utility (and a
// utility beats the components layer). So nothing wrapped, and a value had no way to end inside its cell.
// Fix: the wrapper is `.dems-strip-item` with its basis in the stylesheet (three per row below 1024 px,
// two below 768 px), and there the value text truncates with an ellipsis inside its cell (wider tiers
// keep their look).
// jsdom has no layout: the structure is checked in the DOM, the rules in the stylesheet's text, and the
// look by the before/after screenshots (gateway_check/assets/11b_*_d5_strip_390x844.png).
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render, screen, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createManualClock, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { createAppRouter } from '@/router'

/** The stylesheet as stored (vitest blanks CSS imports, so it is read from disk, as `live-shell-indicator.test.tsx` does). */
const DASHBOARD_CSS = join(dirname(fileURLToPath(import.meta.url)), '../dashboard.css')
const dashboardCss = readFileSync(DASHBOARD_CSS, 'utf8')

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

const DEMO_NOW = Date.parse('2026-10-01T10:00:00+07:00')
const sims: Sim[] = []
const originalMatchMedia = window.matchMedia

/** A 390 px wide window: no tier query matches, so the shell is the `xs` tier (bottom tabs). */
function stubNarrowWindow() {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    return {
      matches: min ? 390 >= Number(min[1]) : false,
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

async function narrowDashboard(): Promise<HTMLElement> {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: DEMO_NOW })
  const sim = createSim({ clock: createManualClock(DEMO_NOW), scenario: 'idle', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  const router = createAppRouter(
    { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket() },
    { history: createMemoryHistory({ initialEntries: ['/dashboard'] }) },
  )
  render(<RouterProvider router={router} />)
  return screen.findByTestId('panel-c', {}, { timeout: 8000 })
}

beforeEach(() => {
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
  stubNarrowWindow()
})

afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  window.matchMedia = originalMatchMedia
  vi.unstubAllGlobals()
})

/** The body of the rule whose selector is exactly `selector` (whitespace-normalised). */
function ruleBody(css: string, selector: string): string | null {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
  const match = new RegExp(`(?:^|[}{;])\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(flat)
  return match ? match[1]!.trim() : null
}

describe('status strip at the xs tier (E2E-W1-6)', () => {
  it('each cell sits in a `.dems-strip-item` wrapper without the `flex-1` utility, and its value text is a truncating span', async () => {
    const strip = await narrowDashboard()
    expect(document.querySelector('.dems-shell')).toHaveAttribute('data-shell-tier', 'xs')
    const nav = strip.querySelector('.dems-strip') as HTMLElement
    const items = Array.from(nav.children).filter((child) => !child.classList.contains('dems-strip-sep'))
    expect(items).toHaveLength(6)
    for (const item of items) {
      expect(item).toHaveClass('dems-strip-item')
      expect(item).not.toHaveClass('flex-1')
      const value = item.querySelector('.dems-strip-value') as HTMLElement
      const text = value.querySelector(':scope > .dems-strip-value-text')
      expect(text).not.toBeNull()
      expect(text!.textContent?.length ?? 0).toBeGreaterThan(0)
    }
    // The accessible name still carries the whole value (the ellipsis is visual only).
    expect(within(strip).getByTestId('strip-time')).toHaveAccessibleName(/GNSS \/ Time: Synchronized/)
    expect(within(strip).getByTestId('strip-network')).toHaveAccessibleName(/Network: Connected/)
  })

  it('the stylesheet wraps the items (three per row below 1024 px, two below 768 px) and ends a long value in an ellipsis', () => {
    expect(ruleBody(dashboardCss, '.dems-strip-item')).toBe('flex: 1 1 0;')
    expect(ruleBody(dashboardCss, ".dems-shell:is([data-shell-tier='sm'], [data-shell-tier='xs']) .dems-strip-item")).toBe('flex: 1 1 30%;')
    expect(ruleBody(dashboardCss, ".dems-shell[data-shell-tier='xs'] .dems-strip-item")).toBe('flex-basis: 45%;')
    expect(ruleBody(dashboardCss, ".dems-shell:is([data-shell-tier='sm'], [data-shell-tier='xs']) .dems-strip")).toContain('flex-wrap: wrap;')
    const text = ruleBody(dashboardCss, ".dems-shell:is([data-shell-tier='sm'], [data-shell-tier='xs']) .dems-strip-value-text") ?? ''
    expect(text).toContain('min-width: 0;')
    expect(text).toContain('overflow: hidden;')
    expect(text).toContain('text-overflow: ellipsis;')
    expect(ruleBody(dashboardCss, ".dems-shell:is([data-shell-tier='sm'], [data-shell-tier='xs']) .dems-strip-value")).toBe('max-width: 100%;')
    // Wider tiers keep their look: no truncation or width limit outside the narrow rules.
    expect(ruleBody(dashboardCss, '.dems-strip-value-text')).toBeNull()
    const value = ruleBody(dashboardCss, '.dems-strip-value') ?? ''
    expect(value).toContain('white-space: nowrap;')
    expect(value).not.toContain('max-width')
    // The rule that never reached a flex item is gone.
    expect(ruleBody(dashboardCss, ".dems-shell:is([data-shell-tier='sm'], [data-shell-tier='xs']) .dems-strip-cell")).toBeNull()
  })
})
