/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W64: the pending test of the row (backend task 04_client_integration_spec §8.1 LB-1;
// AC-C-57, AC-C-58), CLG (c), and what Simulated mode keeps.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | AC-C-57 with an answer delayed by 1 s two quick presses send ONE request, no spinner at 300 ms, the in-button spinner at 500 ms | "an answer after 1 s" (fake timers for the page; the answer is held on the fake transport and released at 1,000 ms) |
// | AC-C-57 with an answer after 50 ms no spinner is rendered | "an answer after 50 ms" |
// | AC-C-58 the pending state adds no element outside the pressed control | "an answer after 1 s" (a pointer press: nothing at all); "a focused press" (only React Aria's visually hidden live announcer) |
// | CLG (c), AC-C-53 no `useSimActions` and no `.actions` read on a `Sim` in the folder's production files | "the folder's production files" |
// | LB-1 on every other control of the row: Next on step 2, "Re-run checks", Start, the Discard confirm | "LB-1 on every control" |
// | Simulated mode as before: the blocked Core link keeps its Simulated wording | "the Devices step in Simulated mode" |
//
// The control under test is the scan button of site A4: a press reserves a case number on the
// Core, so a second request would reserve a second one.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { LIVE_PENDING_REVEAL_MS } from '@dems/shared/live'
import { SimProvider } from '@dems/shared/sim'
import { DevicesStep } from '@/features/session-new/devices-step'
import { gateView } from '@/features/session-new/model'
import {
  clearToasts,
  CORE_START_MS,
  coreWithSession,
  isDisabled,
  mountSessionNew,
  stubMediaForJsdom,
  type MountedSessionNew,
} from '@/features/session-new/__tests__/live-session-new-bed'
import '@/i18n'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const SCANNED = 'LP/2026/1001-0042'
let live: MountedSessionNew | undefined

const spinnerIn = (element: Element) => element.querySelector('[data-slot="spinner"]')
const scanRequests = () => live!.bed.fake.log.requestsOf('scanCaseNumber').length

/** Every element added to the document outside `control` from now on. */
function watchOutside(control: Element) {
  const added: Element[] = []
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) if (node instanceof Element && !control.contains(node)) added.push(node)
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
  return { added, stop: () => observer.disconnect() }
}

/** Moves the page's fake timers on by `ms`, with React's work inside `act`. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

/** The page at step 1, the scan answer held back, the page's timers fake from here on. */
async function scanHeld() {
  live = await mountSessionNew()
  const held = live.bed.fake.hold('scanCaseNumber')
  const arrivedBefore = live.bed.fake.calls.length
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const scan = screen.getByTestId('sn-scan')
  return { held, scan, arrivedBefore }
}

beforeEach(async () => {
  await clearToasts()
})

afterEach(async () => {
  vi.useRealTimers()
  cleanup()
  await clearToasts()
  live?.bed.dispose()
  live = undefined
  vi.restoreAllMocks()
})

describe('AC-C-57, AC-C-58: busy at once, spinner late (LB-1), on the scan button', () => {
  it('the reveal time is the motion token of the specification (420 ms), between the two checkpoints of the test', () => {
    expect(LIVE_PENDING_REVEAL_MS).toBe(420)
    expect(LIVE_PENDING_REVEAL_MS).toBeGreaterThan(300)
    expect(LIVE_PENDING_REVEAL_MS).toBeLessThan(500)
  })

  it('an answer after 1 s: two quick presses send ONE request; no spinner at 300 ms; the in-button spinner at 500 ms; nothing is added outside the control', async () => {
    const { held, scan, arrivedBefore } = await scanHeld()
    const icon = scan.innerHTML
    const outside = watchOutside(scan)

    fireEvent.click(scan)
    fireEvent.click(scan)
    await act(async () => {
      await live!.bed.fake.arrived(arrivedBefore + 1)
    })
    await live!.bed.flush()
    expect(scanRequests()).toBe(1)
    // Busy at once: marked for assistive technology, the look unchanged.
    expect(scan).toHaveAttribute('aria-busy', 'true')

    await advance(300)
    expect(spinnerIn(scan)).toBeNull()
    expect(scan).not.toHaveAttribute('data-pending')
    expect(scan.innerHTML).toBe(icon)
    fireEvent.click(scan)

    await advance(200)
    // 500 ms: the kit's pending state, the Spinner in place of the icon (one child: nothing moves).
    expect(spinnerIn(scan)).not.toBeNull()
    expect(scan).toHaveAttribute('data-pending', 'true')
    expect(scan.children).toHaveLength(1)
    expect(outside.added).toEqual([])

    await advance(500)
    expect(spinnerIn(scan)).not.toBeNull()
    held.release({ status: 200, body: { caseNumber: SCANNED } })
    await live!.bed.flush()
    await advance(0)
    expect(screen.getByTestId('sn-case-number')).toHaveValue(SCANNED)
    expect(spinnerIn(scan)).toBeNull()
    expect(scan).not.toHaveAttribute('aria-busy')
    expect(scan).not.toHaveAttribute('data-pending')
    expect(scan.innerHTML).toBe(icon)
    // Three presses in all, one request.
    expect(scanRequests()).toBe(1)
    expect(outside.added).toEqual([])
    outside.stop()
  })

  it('an answer after 50 ms: no spinner is ever rendered', async () => {
    const { held, scan, arrivedBefore } = await scanHeld()
    const icon = scan.innerHTML
    const outside = watchOutside(scan)
    let spinnerSeen = false
    const inside = new MutationObserver(() => {
      if (spinnerIn(scan) !== null) spinnerSeen = true
    })
    inside.observe(scan, { childList: true, subtree: true, attributes: true })

    fireEvent.click(scan)
    await act(async () => {
      await live!.bed.fake.arrived(arrivedBefore + 1)
    })
    await advance(50)
    held.release({ status: 200, body: { caseNumber: SCANNED } })
    await live!.bed.flush()
    await advance(0)
    expect(screen.getByTestId('sn-case-number')).toHaveValue(SCANNED)
    // Well past the reveal time: still nothing.
    await advance(1_000)
    expect(spinnerSeen).toBe(false)
    expect(spinnerIn(scan)).toBeNull()
    expect(scan).not.toHaveAttribute('aria-busy')
    expect(scan.innerHTML).toBe(icon)
    expect(scanRequests()).toBe(1)
    expect(outside.added).toEqual([])
    inside.disconnect()
    outside.stop()
  })

  it('a focused press (keyboard): the only elements added outside the control are inside React Aria\'s visually hidden live announcer', async () => {
    const { held, scan, arrivedBefore } = await scanHeld()
    await act(async () => {
      scan.focus()
    })
    const outside = watchOutside(scan)
    fireEvent.click(scan)
    await act(async () => {
      await live!.bed.fake.arrived(arrivedBefore + 1)
    })
    await advance(500)
    expect(spinnerIn(scan)).not.toBeNull()
    for (const element of outside.added) {
      expect(element.closest('[data-live-announcer="true"]'), element.outerHTML).not.toBeNull()
    }
    const announcer = document.querySelector<HTMLElement>('[data-live-announcer="true"]')
    if (announcer !== null) {
      // 1 px, clipped, out of the flow: it moves nothing.
      expect(announcer.style.position).toBe('absolute')
      expect(announcer.style.width).toBe('1px')
      expect(announcer.style.height).toBe('1px')
    }
    held.release({ status: 200, body: { caseNumber: SCANNED } })
    await live!.bed.flush()
    await advance(0)
    expect(scanRequests()).toBe(1)
    outside.stop()
  })
})

describe('LB-1 on every control of the row: busy at once, the in-button spinner after the reveal time, one request', () => {
  let restoreMedia: () => void = () => undefined
  beforeAll(() => {
    restoreMedia = stubMediaForJsdom()
  })
  afterAll(() => restoreMedia())

  /** Each control at the step that shows it, ready to be pressed (real timers until the press). */
  const CONTROLS = {
    'Next on step 2 (acknowledgePrecheckWarnings)': {
      stage: 'WARN',
      operation: 'acknowledgePrecheckWarnings',
      testId: 'sn-next',
      async ready() {
        await waitFor(() => expect(screen.getByTestId('page-session-new')).toHaveAttribute('data-step', '2'))
        fireEvent.click(within(screen.getByTestId('sn-gate-warn')).getByRole('checkbox'))
        await waitFor(() => expect(isDisabled(screen.getByTestId('sn-next'))).toBe(false))
      },
    },
    '"Re-run checks" (retryPrecheck)': {
      stage: 'BLOCK',
      operation: 'retryPrecheck',
      testId: 'sn-retry',
      async ready() {
        await screen.findByTestId('sn-retry')
      },
    },
    'Start (startRecording)': {
      stage: 'ARMED',
      operation: 'startSession',
      testId: 'sn-start',
      async ready() {
        await waitFor(() => expect(screen.getByTestId('page-session-new')).toHaveAttribute('data-step', '3'))
        const countdown = within(screen.getByTestId('sn-countdown-switch')).getByRole('switch')
        fireEvent.click(countdown)
        await waitFor(() => expect(countdown).not.toBeChecked())
      },
    },
    'the Discard confirm (cancel)': {
      stage: 'WARN',
      operation: 'cancelSession',
      testId: 'sn-cancel-confirm',
      async ready() {
        await waitFor(() => expect(screen.getByTestId('page-session-new')).toHaveAttribute('data-step', '2'))
        fireEvent.click(screen.getByTestId('sn-cancel'))
        await screen.findByTestId('sn-cancel-confirm')
      },
    },
  } as const

  it.each(Object.keys(CONTROLS) as (keyof typeof CONTROLS)[])('%s', async (name) => {
    const control = CONTROLS[name]
    live = await mountSessionNew({ served: coreWithSession(CORE_START_MS, control.stage).state() })
    await control.ready()
    const held = live.bed.fake.hold(control.operation)
    const arrivedBefore = live.bed.fake.calls.length
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const button = screen.getByTestId(control.testId)
    const outside = watchOutside(button)

    fireEvent.click(button)
    fireEvent.click(button)
    await act(async () => {
      await live!.bed.fake.arrived(arrivedBefore + 1)
    })
    await live!.bed.flush()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await advance(300)
    expect(spinnerIn(button)).toBeNull()
    expect(button).not.toHaveAttribute('data-pending')
    await advance(200)
    expect(spinnerIn(button)).not.toBeNull()
    expect(button).toHaveAttribute('data-pending', 'true')
    expect(outside.added).toEqual([])
    // The Core is not reached: the control returns to idle (LB-6), the second press sent nothing.
    held.fail()
    await live!.bed.flush()
    await advance(0)
    expect(spinnerIn(button)).toBeNull()
    expect(button).not.toHaveAttribute('aria-busy')
    expect(live!.bed.fake.log.requestsOf(control.operation)).toHaveLength(1)
    outside.stop()
  })
})

describe('CLG (c), AC-C-53: the folder\'s production files', () => {
  const FOLDER = resolve(import.meta.dirname, '../features/session-new')
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      return statSync(path).isDirectory() ? (name === '__tests__' ? [] : files(path)) : [path]
    })
  const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')
  /** The code without its string literals: an i18n key such as `'common.actions.retry'` is no property read. */
  const withoutStrings = (text: string) =>
    text.replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/"(?:[^"\\\n]|\\.)*"/g, '""').replace(/`[^`]*`/g, '``')
  const production = files(FOLDER)
    .filter((path) => /\.(ts|tsx)$/.test(path))
    .map((path) => ({ path, text: code(readFileSync(path, 'utf8')) }))

  it('read the folder', () => {
    expect(production.map(({ path }) => path.slice(FOLDER.length + 1)).sort()).toEqual(
      expect.arrayContaining(['index.tsx', 'sim-adapter.ts', 'use-pending-control.ts', 'devices-step.tsx']),
    )
  })

  it('the scan can fail: it sees a property read and does not see an i18n key', () => {
    expect(withoutStrings(code('const actions = useSimInstance().actions // a note'))).toMatch(/\.\s*actions\b/)
    expect(withoutStrings(code("sim.actions.cancel()"))).toMatch(/\.\s*actions\b/)
    expect(withoutStrings(code("t('common.actions.retry')"))).not.toMatch(/\.\s*actions\b/)
    expect(code('import { useSimActions } from "x"')).toMatch(/\buseSimActions\b/)
  })

  it('no `useSimActions`, no `.actions` read on anything, the actions come from `useCoreActions()`', () => {
    for (const { path, text } of production) {
      expect(text, path).not.toMatch(/\buseSimActions\b/)
      expect(withoutStrings(text), path).not.toMatch(/\.\s*actions\b/)
    }
    const page = production.find(({ path }) => path.endsWith('index.tsx'))!.text
    expect(page).toMatch(/useCoreActions\(\)/)
    expect(page).toMatch(/\bsettle\(/)
  })
})

describe('the Devices step in Simulated mode keeps its wording (the Live sentence of F69 is Live only)', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  const originalPlay = HTMLMediaElement.prototype.play
  const originalPause = HTMLMediaElement.prototype.pause
  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
    HTMLMediaElement.prototype.play = (() => Promise.resolve()) as unknown as HTMLMediaElement['play']
    HTMLMediaElement.prototype.pause = (() => undefined) as unknown as HTMLMediaElement['pause']
  })
  afterAll(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext
    HTMLMediaElement.prototype.play = originalPlay
    HTMLMediaElement.prototype.pause = originalPause
  })

  it.each([
    [false, 'Simulated'],
    [true, 'Live'],
  ] as const)('live=%s (%s): the blocked Core link', (liveMode: boolean, _mode: string) => {
    const core = coreWithSession(CORE_START_MS, 'BLOCK')
    const session = core.state().session!
    const gate = gateView(session.precheck, session.state, false)
    render(
      <SimProvider sim={core.sim} autoStart={false}>
        <DevicesStep gate={gate} acknowledged={false} onAcknowledgedChange={() => undefined} onRetry={() => undefined} live={liveMode} />
      </SimProvider>,
    )
    const alert = screen.getByTestId('sn-gate-blocked')
    expect(alert).toHaveTextContent(en.sessionNew.devices.reasons.coreOffline)
    if (liveMode) {
      expect(screen.getByTestId('sn-gate-live-link')).toHaveTextContent(en.sessionNew.live.coreLinkHint)
      expect(alert).not.toHaveTextContent(en.sessionNew.devices.resolveHint)
    } else {
      expect(screen.queryByTestId('sn-gate-live-link')).toBeNull()
      expect(alert).toHaveTextContent(en.sessionNew.devices.resolveHint)
    }
    core.sim.stop()
  })
})
