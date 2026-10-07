/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W87 (step 109), routed by decision D147 ruling DN-2: the CONNECTING instant of the mode
// indicator (backend task 04_client_integration_spec §3.2, §3.5; AC-C-24; decision D144(2), finding
// CPW1-6).
//
// The colour of `LIVE · RECONNECTING` follows the link (`components/shell/mode-indicator.tsx`): while a
// socket is being opened after a loss (CONNECTING) the chip keeps the outage colour, `danger`, so the chip
// and the sticky link notice say the same thing; while an open socket resynchronises (RESYNCING) the link
// is up and the chip reads `warning`. The CP-W1 round measured that no test ever OBSERVED a CONNECTING
// instant (mutation T1, "every RECONNECTING reads warning", survived): after a loss the link sits at
// OFFLINE between attempts, and the fake's refusal of a new socket runs on a promise job right after
// the socket is created. This file looks at the screen in that instant: it moves the fake clock inside
// a synchronous `act`, so React renders the CONNECTING link before the connect script has run.
//
// | Instant | Link | Chip |
// |---------|------|------|
// | a socket opened after a loss, not yet answered | CONNECTING | `LIVE · RECONNECTING`, `danger` |
// | between two attempts | OFFLINE | `LIVE · OFFLINE`, `danger` |
// | an open socket waiting for the snapshot it asked for | RESYNCING | `LIVE · RECONNECTING`, `warning` |
// | the link back | ONLINE | `LIVE`, `success` |
import { act, cleanup, configure, screen } from '@testing-library/react'
import { toast } from '@heroui/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pickReplicatedState, type ReplicatedState } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { LiveLinkState } from '@dems/shared/live'
import type { SimState } from '@dems/shared/sim'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'

// A page's chunk is loaded by a dynamic import: under load that can take longer than the library's default second.
configure({ asyncUtilTimeout: 6_000 })
vi.setConfig({ testTimeout: 30_000 })

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

/** Empties the kit's toast queue, which is one per page and outlives a test. */
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

const wire = (state: SimState): ReplicatedState => pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState)
const indicator = () => screen.getByTestId('shell-mode')
/** The kit's colour class of the chip: `chip--warning`, `chip--success` or `chip--danger`. */
const tone = () => [...(indicator().querySelector('.dems-mode-chip')?.classList ?? [])].filter((name) => /^chip--(warning|success|danger|default|accent)$/.test(name))

/** What the top bar shows now, read in one go. */
const shown = (page: LivePage) => ({
  link: page.live.link,
  state: indicator().getAttribute('data-state'),
  text: indicator().textContent,
  tone: tone(),
})

/**
 * Moves the fake clock in small synchronous steps until a socket is being opened (CONNECTING), and
 * returns what the screen showed in that instant. React renders inside the synchronous `act`; the
 * connect script of the new socket is a promise job, so it has not run yet when the screen is read.
 */
function untilConnecting(page: LivePage, limitMs: number): ReturnType<typeof shown> | null {
  for (let elapsed = 0; elapsed < limitMs; elapsed += 25) {
    act(() => {
      bed!.fake.clock.advance(25)
    })
    if (page.live.link === LiveLinkState.CONNECTING) return shown(page)
  }
  return null
}

async function mountLive(): Promise<LivePage> {
  viewport(1920)
  bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
  const page = await bed.load()
  await bed.mount(page, '/storage')
  await screen.findByTestId('page-storage')
  return page
}

beforeEach(() => {
  resetMissingI18nKeys()
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(async () => {
  cleanup()
  await clearToasts()
  bed?.dispose()
  bed = undefined
  window.matchMedia = originalMatchMedia
})

describe('the CONNECTING instant of the mode indicator (D147 DN-2; D144(2))', () => {
  it('a socket opened after a loss reads `LIVE · RECONNECTING` in the outage colour, at every attempt, until the link is back', async () => {
    const page = await mountLive()
    expect(shown(page)).toEqual({ link: LiveLinkState.ONLINE, state: 'LIVE', text: 'LIVE', tone: ['chip--success'] })

    bed!.core.unreachable()
    await bed!.flush()
    expect(shown(page)).toEqual({ link: LiveLinkState.OFFLINE, state: 'OFFLINE', text: en.common.coreMode.chipOffline, tone: ['chip--danger'] })
    // The sticky notice of §3.5 is up: the chip must not contradict it.
    expect(screen.getByText(en.common.coreLink.lostTitle)).toBeInTheDocument()

    // Three reconnect attempts, each seen in its CONNECTING instant and then refused by the Core.
    const instants: ReturnType<typeof shown>[] = []
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const seen = untilConnecting(page, 60_000)
      expect(seen, `attempt ${attempt + 1}: a CONNECTING instant within 60 s`).not.toBeNull()
      instants.push(seen!)
      // The notice is still there in that instant.
      expect(screen.getByText(en.common.coreLink.lostTitle)).toBeInTheDocument()
      await bed!.flush()
      expect(shown(page)).toEqual({ link: LiveLinkState.OFFLINE, state: 'OFFLINE', text: en.common.coreMode.chipOffline, tone: ['chip--danger'] })
    }
    expect(instants).toEqual(
      Array.from({ length: 3 }, () => ({ link: LiveLinkState.CONNECTING, state: 'RECONNECTING', text: en.common.coreMode.chipReconnecting, tone: ['chip--danger'] })),
    )

    // The Core is back: the next attempt is accepted and the chip says LIVE in the success colour.
    bed!.core.back()
    await bed!.elapse(40_000, 1_000)
    expect(shown(page)).toEqual({ link: LiveLinkState.ONLINE, state: 'LIVE', text: 'LIVE', tone: ['chip--success'] })
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the same label in the recovery colour while an open socket resynchronises (RESYNCING): the two halves of the rule side by side', async () => {
    const page = await mountLive()
    const socket = page.sockets.at(-1)!
    // A delta three revisions ahead: the client drops it and asks for a snapshot on the open socket.
    socket.delta([{ op: 'replace', slice: 'operators', value: wire(bed!.core.served).operators }], { revision: bed!.fake.position.revision + 3 })
    await bed!.flush()
    expect(shown(page)).toEqual({ link: LiveLinkState.RESYNCING, state: 'RECONNECTING', text: en.common.coreMode.chipReconnecting, tone: ['chip--warning'] })
    expect(screen.queryByText(en.common.coreLink.lostTitle)).not.toBeInTheDocument()

    // The socket is lost while it resynchronises: the next socket, while it is being opened, is an outage again.
    bed!.core.unreachable()
    await bed!.flush()
    const seen = untilConnecting(page, 60_000)
    expect(seen).toEqual({ link: LiveLinkState.CONNECTING, state: 'RECONNECTING', text: en.common.coreMode.chipReconnecting, tone: ['chip--danger'] })
    await bed!.flush()
    bed!.core.back()
    await bed!.elapse(40_000, 1_000)
    expect(page.live.link).toBe(LiveLinkState.ONLINE)
    expect(getMissingI18nKeys()).toEqual([])
  })
})
