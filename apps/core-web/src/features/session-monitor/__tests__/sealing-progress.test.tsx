// Blueprint row 87 (M7-W6; WB-01 modal; UX spec flows 3 and 4; E-13): sealing progress on the web
// console is forward-only and comes from the Core's states alone.
//
// | Rule | Where |
// |------|-------|
// | The percent is the mean of the step percents, floored (the rule of operation 83) | "the rule" |
// | A lower value from the Core never rewinds a step or the overall percent; a DONE step stays DONE | "forward-only" |
// | NEGATIVE CONTROL: without a new Core state nothing moves, however much time passes | "no Core state, no movement" |
// | The ETA is the Core's or none (no line at all - fix wave K, G75c-05); never a number made here | "the ETA" |
// | A resumed seal says so, and is drawn in the SAME dialog as the recovery (no modal swap) | "resumed sealing, in place" |
//
// The software part of M7-FF-WEB; the browser run on a real sealing is scripted for the M7 gate.
import { act, cleanup, render, screen, within, fireEvent, waitFor, configure } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, afterAll, beforeAll } from 'vitest'
import { FINALIZATION_STEPS_V2, SessionState } from '@dems/shared/domain'
import { en } from '@dems/shared/i18n'
import type { FinalizationStepState, Sim } from '@dems/shared/sim'
import { createTestSim, withProviders } from '@/components/composed/__tests__/test-utils'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { FinalizationModal, type OverlayMode } from '../finalization-modal'
import { EMPTY_SEALING_MEMORY, advanceSealing, etaSeconds, type SealingMemory, type SealingStepInput } from '../sealing-progress'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { type SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createManualClock, createMemoryAuthStorage, createSim, OPERATOR_IDS, SEAL_BLOCKED_DETAIL_SENTENCE, SEAL_BLOCKED_EXAMPLE_ALERT, SEAL_BLOCKED_EXAMPLE_FINALIZATION, SEAL_BLOCKED_EXAMPLE_SESSION_ID, SEAL_RECORDING_KEPT_SENTENCE, SEAL_RETRYING_EXAMPLE_FINALIZATION, sealAttentionOf, type ActiveSession, type SimAlert } from '@dems/shared/sim'
import { saidAlready } from '@/lib/seal-attention'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { enWeb } from '@/i18n-web'
import { REDUCED_MOTION_MEDIA_QUERY } from '@/motion'
import { createAppRouter } from '@/router'

describe("sealing progress: the rule, the finalization dialog, resumed sealing (M7-FF-WEB)", () => {
  const F = en.session.finalization
  const IDS = FINALIZATION_STEPS_V2

  /** Six steps: the first `done` are DONE, the next is running at `progress`, the rest wait. */
  function steps(done: number, progress: number | undefined, patch: Partial<SealingStepInput> = {}): SealingStepInput[] {
    return IDS.map((id, index) => {
      if (index < done) return { id, status: 'done', progress: 100, attempt: 1 }
      if (index === done) return { id, status: 'active', ...(progress === undefined ? {} : { progress }), attempt: 1, ...patch }
      return { id, status: 'pending', progress: 0, attempt: 1 }
    })
  }

  /** Feeds Core states in order and returns the view after each. */
  function feed(states: readonly (readonly SealingStepInput[] | null)[], sessionId = 'SES-1', sealedAtLast = false) {
    let memory: SealingMemory = EMPTY_SEALING_MEMORY
    return states.map((state, index) => {
      const next = advanceSealing(memory, sessionId, state, sealedAtLast && index === states.length - 1)
      memory = next.memory
      return next.view
    })
  }

  describe('the rule', () => {
    it('percent = floor(mean of the step percents); DONE is 100, a running step its progress, a waiting step 0', () => {
      expect(feed([null])[0]!.percent).toBe(0)
      expect(feed([steps(0, 0)])[0]!.percent).toBe(0)
      expect(feed([steps(1, 0)])[0]!.percent).toBe(16)
      expect(feed([steps(1, 50)])[0]!.percent).toBe(25)
      expect(feed([steps(3, 72)])[0]!.percent).toBe(62)
      expect(feed([steps(5, 99)])[0]!.percent).toBe(99)
    })

    it('100 belongs to SEALED (or to six DONE steps): a running step never reads 100', () => {
      const view = feed([steps(5, 100)])[0]!
      expect(view.steps[5]).toMatchObject({ status: 'active', percent: 99 })
      expect(view.percent).toBe(99)
      expect(feed([steps(5, 99), steps(6, undefined)])[1]!.percent).toBe(100)
      expect(feed([steps(2, 10)], 'SES-1', true)[0]).toMatchObject({ percent: 100, etaMs: null })
    })

    it('without a `progress` from the Core (the v1 shape) it is the count of DONE steps, as before this row', () => {
      const view = feed([steps(2, undefined)])[0]!
      expect(view.percent).toBe(33)
      expect(view.reportsProgress).toBe(false)
    })
  })

  describe('forward-only', () => {
    it('a lower percent of the running step is not drawn; the overall never decreases', () => {
      const views = feed([steps(2, 80), steps(2, 30), steps(2, 85)])
      expect(views.map((view) => view.steps[2]!.percent)).toEqual([80, 80, 85])
      expect(views.map((view) => view.percent)).toEqual([46, 46, 47])
    })

    it('a resumed attempt that rewrites a DONE step: the step stays DONE, the percent stays, and the view says "resumed"', () => {
      const first = steps(4, 40)
      // RECOVERY resumes from an earlier checkpoint: step 3 runs again at attempt 2, the later steps wait again.
      const resumed: SealingStepInput[] = IDS.map((id, index) => {
        if (index < 2) return { id, status: 'done', progress: 100, attempt: 1 }
        if (index === 2) return { id, status: 'active', progress: 5, attempt: 2 }
        return { id, status: 'pending', progress: 0, attempt: 1 }
      })
      const [before, after] = feed([first, resumed])
      expect(before!.percent).toBe(73)
      expect(after!.percent).toBe(73)
      // Steps 3 and 4 were drawn DONE and stay DONE; step 5 follows the Core (it waits again) and keeps the percent it had.
      expect(after!.steps.map((step) => step.status)).toEqual(['done', 'done', 'done', 'done', 'pending', 'pending'])
      expect(after!.steps.map((step) => step.percent)).toEqual([100, 100, 100, 100, 40, 0])
      expect([before!.resumed, after!.resumed, after!.attempt]).toEqual([false, true, 2])
    })

    it('a state without the steps (the slice is missing for a moment, or lists fewer steps) does not rewind the overall percent', () => {
      const views = feed([steps(4, 40), null, steps(4, 40).slice(0, 2), steps(4, 45)])
      expect(views.map((view) => view.percent)).toEqual([73, 73, 73, 74])
      // A state that lists MORE steps than the one before lowers the mean; what was drawn is kept.
      const grown = feed([steps(1, 60).slice(0, 2), steps(1, 60)])
      expect(grown.map((view) => view.percent)).toEqual([80, 80])
    })

    it('another session starts from nothing', () => {
      let memory = advanceSealing(EMPTY_SEALING_MEMORY, 'SES-1', steps(4, 90), false).memory
      const next = advanceSealing(memory, 'SES-2', steps(0, 10), false)
      memory = next.memory
      expect(next.view.percent).toBe(1)
      expect(next.view.steps[3]!.status).toBe('pending')
      expect(memory.sessionId).toBe('SES-2')
    })
  })

  describe('no Core state, no movement (negative control)', () => {
    it('the same state again changes nothing, and gives back the same memory object', () => {
      const state = steps(2, 55, { etaMs: 4_000 })
      const first = advanceSealing(EMPTY_SEALING_MEMORY, 'SES-1', state, false)
      const second = advanceSealing(first.memory, 'SES-1', state, false)
      const third = advanceSealing(second.memory, 'SES-1', steps(2, 55, { etaMs: 4_000 }), false)
      expect(second.memory).toBe(first.memory)
      expect(third.memory).toBe(first.memory)
      expect(third.view).toEqual(first.view)
    })

    it('the module reads no clock and starts no timer', async () => {
      const fs = (await import(/* @vite-ignore */ `node:${'fs'}`)) as { readFileSync(path: string, encoding: string): string }
      const source = fs.readFileSync(`${(import.meta as { dirname?: string }).dirname}/../sealing-progress.ts`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
      expect(source).not.toMatch(/\bDate\b|\bperformance\b|setTimeout|setInterval|requestAnimationFrame|useEffect/)
      // Positive control: the scan reads the code.
      expect(source).toMatch(/export function advanceSealing/)
    })
  })

  describe('the ETA', () => {
    it("is the Core's value at the running step, or none; a number is never made here", () => {
      expect(feed([steps(2, 10, { etaMs: 4_200 })])[0]).toMatchObject({ etaMs: 4_200, reportsProgress: true })
      expect(feed([steps(2, 10, { etaMs: null })])[0]).toMatchObject({ etaMs: null, reportsProgress: true })
      expect(feed([steps(2, 10)])[0]).toMatchObject({ etaMs: null, reportsProgress: true })
      expect(feed([steps(2, 10, { etaMs: -5 })])[0]!.etaMs).toBeNull()
      expect(feed([steps(2, 10, { etaMs: Number.NaN })])[0]!.etaMs).toBeNull()
      expect([etaSeconds(4_200), etaSeconds(1), etaSeconds(0), etaSeconds(61_000)]).toEqual([5, 1, 1, 61])
    })
  })

  // ── The dialog ───────────────────────────────────────────────────────────────────────────────

  const sims: Sim[] = []

  beforeEach(() => {
    resetMissingI18nKeys()
    vi.useFakeTimers()
  })
  afterEach(() => {
    cleanup()
    for (const sim of sims.splice(0)) sim.stop()
    vi.useRealTimers()
  })

  function finalizingSim(): { sim: Sim; sessionId: string } {
    const sim = createTestSim('finalizing')
    sims.push(sim)
    const sessionId = sim.store.getState().session!.id
    return { sim, sessionId }
  }

  /** The Core sends a state: the finalization steps (and, when given, the session state). */
  function coreSends(sim: Sim, list: readonly SealingStepInput[], state?: SessionState): void {
    act(() => {
      sim.store.setState((s) => {
        const session = s.session!
        const merged: FinalizationStepState[] = session.finalization.steps.map((step, index) => ({ ...step, ...list[index], id: step.id }))
        return { session: { ...session, ...(state ? { state } : {}), evidenceId: state === SessionState.SEALED ? null : session.evidenceId, finalization: { ...session.finalization, steps: merged } } }
      })
    })
  }

  function mount(sim: Sim, sessionId: string, mode: OverlayMode = 'finalization') {
    const element = (next: OverlayMode) => withProviders(<FinalizationModal mode={next} isOpen sessionId={sessionId} onClose={() => undefined} />, { sim })
    const view = render(element(mode))
    return { rerender: (next: OverlayMode) => view.rerender(element(next)) }
  }

  const modal = () => screen.getByTestId('finalization-modal')
  const label = () => within(modal()).getByTestId('sm-final-progress').textContent ?? ''
  const percentText = (percent: number) => F.progress.replace('{{percent}}', String(percent))
  const stepStatuses = () => within(modal()).getAllByRole('listitem').map((item) => item.getAttribute('data-status'))

  describe('the finalization dialog (M7-FF-WEB, software part)', () => {
    it('draws the Core percent, moves only when the Core sends a state, and never back', () => {
      const { sim, sessionId } = finalizingSim()
      coreSends(sim, steps(2, 40, { etaMs: 6_000 }))
      mount(sim, sessionId)
      expect(label()).toContain(percentText(40))
      expect(within(modal()).getByTestId('sm-final-eta')).toHaveTextContent(en.session.sealingEta.step.replace('{{seconds}}', '6'))
      expect(stepStatuses()).toEqual(['done', 'done', 'active', 'pending', 'pending', 'pending'])
      expect(within(modal()).getAllByRole('listitem')[2]).toHaveTextContent('40%')

      // NEGATIVE CONTROL: a minute passes on this page, the Core sends nothing: the same percent, the same ETA.
      act(() => {
        vi.advanceTimersByTime(60_000)
      })
      expect(label()).toContain(percentText(40))
      expect(within(modal()).getByTestId('sm-final-eta')).toHaveTextContent(en.session.sealingEta.step.replace('{{seconds}}', '6'))

      // A lower value from the Core is not drawn.
      coreSends(sim, steps(2, 10, { etaMs: 9_000 }))
      expect(label()).toContain(percentText(40))
      expect(within(modal()).getAllByRole('listitem')[2]).toHaveTextContent('40%')
      // A higher one is.
      coreSends(sim, steps(3, 20, { etaMs: 3_000 }))
      expect(label()).toContain(percentText(53))
      expect(stepStatuses()).toEqual(['done', 'done', 'done', 'active', 'pending', 'pending'])
      expect(getMissingI18nKeys()).toEqual([])
    })

    // Fix wave K (G75c-05; `contract_wave_k.md` S1 section 5): `etaMs: null` draws NO time-left line - the pin moved by delta
    // from the line "Estimating the time left…" (the transcript step never states an ETA, so the line promised a number that never came).
    it('no ETA from the Core: no time-left line at all - no "estimating", no number', () => {
      const { sim, sessionId } = finalizingSim()
      coreSends(sim, steps(1, 5, { etaMs: null }))
      mount(sim, sessionId)
      expect(within(modal()).queryByTestId('sm-final-eta')).toBeNull()
      expect(modal()).not.toHaveTextContent(F.estimating)
      expect(modal()).not.toHaveTextContent(/about \d+ s left/)
      // CONTROL: the same step with a measured ETA from the Core draws it.
      coreSends(sim, steps(1, 10, { etaMs: 6_000 }))
      expect(within(modal()).getByTestId('sm-final-eta')).toHaveTextContent(en.session.sealingEta.step.replace('{{seconds}}', '6'))
    })

    it('a resumed attempt: the DONE steps stay DONE, the percent stays, and the note says "Resumed after restart"', () => {
      const { sim, sessionId } = finalizingSim()
      coreSends(sim, steps(4, 40))
      mount(sim, sessionId)
      expect(label()).toContain(percentText(73))
      expect(within(modal()).queryByTestId('sm-final-resumed')).toBeNull()
      coreSends(
        sim,
        IDS.map((id, index) => (index < 2 ? { id, status: 'done', progress: 100, attempt: 1 } : index === 2 ? { id, status: 'active', progress: 5, attempt: 2 } : { id, status: 'pending', progress: 0, attempt: 1 })),
      )
      expect(label()).toContain(percentText(73))
      expect(stepStatuses()).toEqual(['done', 'done', 'done', 'done', 'pending', 'pending'])
      expect(within(modal()).getByTestId('sm-final-resumed')).toHaveTextContent(F.resumed)
      expect(within(modal()).getByTestId('sm-final-resumed')).toHaveAttribute('data-attempt', '2')
    })
  })

  describe('resumed sealing, in place (flow 4; WB-01 modal)', () => {
    it('a recovery that turns into a resumed seal draws the finalization in the SAME dialog, and the mode change after it changes nothing', () => {
      const { sim, sessionId } = finalizingSim()
      coreSends(sim, steps(2, 30, { attempt: 2 }), SessionState.RECOVERY)
      const view = mount(sim, sessionId, 'recovery')
      const dialog = modal()
      expect(dialog).toHaveAttribute('data-body', 'recovery')

      // The Core resumes the seal while the page still holds the overlay in recovery mode.
      coreSends(sim, steps(2, 35, { attempt: 2 }), SessionState.FINALIZING)
      expect(modal()).toBe(dialog)
      expect(dialog).toHaveAttribute('data-mode', 'recovery')
      expect(dialog).toHaveAttribute('data-body', 'finalization')
      expect(label()).toContain(percentText(39))
      expect(within(dialog).getByTestId('sm-final-resumed')).toHaveTextContent(F.resumed)
      const bar = within(dialog).getByTestId('sm-final-progress')

      // The page then moves the overlay to finalization mode: the same dialog, the same bar, the same percent.
      view.rerender('finalization')
      expect(modal()).toBe(dialog)
      expect(within(dialog).getByTestId('sm-final-progress')).toBe(bar)
      expect(label()).toContain(percentText(39))
    })

    it('a recovery that ends SEALED can be closed (before, only an INCOMPLETE end could)', () => {
      const { sim, sessionId } = finalizingSim()
      coreSends(sim, steps(6, undefined), SessionState.SEALED)
      mount(sim, sessionId, 'recovery')
      expect(modal()).toHaveAttribute('data-body', 'finalization')
      expect(modal()).toHaveAttribute('data-state', 'SEALED')
      expect(label()).toContain(percentText(100))
      expect(within(modal()).getByTestId('sm-final-close')).toBeInTheDocument()
    })
  })
})

// Fix wave I, driver B - finding G75b-02 (MAJOR) of re-gate 75 (`gateway_check/10b_m5_regate.md`,
// `w2_03_seal_blocked.png`): on a session whose seal was blocked the web seal dialog read "Finalizing
// evidence / 0% complete / Resumed after restart", said nothing of the block and could not be left.
//
// The contract is `delegation_progress/contract_wave_i.md` (driver A1): `sealAttentionOf` of
// `@dems/shared/sim` and its EXAMPLES, which this file imports - no payload is retyped here (D208).
//
// | Rule | Case |
// |---|---|
// | BLOCKED: the dialog says sealing is blocked, the Core's reason, its detail, what restores it, that the recording is kept, what the operator can do | "dialog: blocked" |
// | BLOCKED: no percentage, no "estimating", no "Resumed after restart" | "dialog: blocked" |
// | BLOCKED: the dialog can be closed (button and Escape); the session stays FINALIZING on the Core, and the dialog says so | "dialog: can be left" |
// | RETRYING: the Core's sentence ("retry n of N"), the recording is kept, the dialog can be left; never "Resumed after restart" from `attempt` | "dialog: retrying" |
// | The Monitor banner and the Dashboard row say "Sealing blocked", not a running "Finalizing ... step 1 of 6" | "rows" |
// | "Resumed after restart" is never derived from `attempt` beside a session of the Core's own capture | "resumed" |
// | CONTROLS: a seal that simply runs keeps its percent and cannot be closed; the simulator's resumed seal keeps its note | "controls" |
describe("a seal that is blocked or retried: the dialog, the Monitor banner and the Dashboard (G75b-02)", () => {
  vi.resetConfig()
  beforeAll(() => void configure({ asyncUtilTimeout: 1_000 }))
  afterAll(() => void configure({ asyncUtilTimeout: 1_000 }))

  vi.setConfig({ testTimeout: 30_000 })

  const W = enWeb.web.sealBlocked
  const F = en.session.finalization
  const FIND = { timeout: 15_000 }
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
  const originalPlay = HTMLMediaElement.prototype.play
  const originalPause = HTMLMediaElement.prototype.pause
  const originalGetContext = HTMLCanvasElement.prototype.getContext

  type Finalization = ActiveSession['finalization']

  /** The open session becomes the contract's example session with `finalization` (and, when given, the alert). */
  function coreState(sim: Sim, finalization: Finalization, alerts: readonly SimAlert[], patch: Record<string, unknown> = {}) {
    const session = sim.store.getState().session!
    sim.store.setState({
      session: { ...session, id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, state: 'FINALIZING', finalization, captureDurable: true, ...patch } as typeof session,
      alerts: [...alerts],
    })
  }
  const blocked = (sim: Sim) => coreState(sim, SEAL_BLOCKED_EXAMPLE_FINALIZATION, [SEAL_BLOCKED_EXAMPLE_ALERT])
  const retrying = (sim: Sim) => coreState(sim, SEAL_RETRYING_EXAMPLE_FINALIZATION, [])

  function mount(route: string, prepare: (sim: Sim) => void): Sim {
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: DEMO_NOW })
    const sim = createSim({ clock: createManualClock(DEMO_NOW), scenario: 'finalizing', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(sim)
    prepare(sim)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: [route] }) })
    render(<RouterProvider router={router} />)
    return sim
  }

  const dialog = () => screen.findByTestId('finalization-modal', {}, FIND)

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

  describe('the examples are the contract (a guard of this file)', () => {
    it('the shared reader reads BLOCKED and RETRYING from the two example states', () => {
      const session = { id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, state: 'FINALIZING' as const }
      expect(sealAttentionOf({ session: { ...session, finalization: SEAL_BLOCKED_EXAMPLE_FINALIZATION }, alerts: [SEAL_BLOCKED_EXAMPLE_ALERT] })?.kind).toBe('BLOCKED')
      expect(sealAttentionOf({ session: { ...session, finalization: SEAL_RETRYING_EXAMPLE_FINALIZATION }, alerts: [] })?.kind).toBe('RETRYING')
    })
  })

  describe('G75b-02 dialog: blocked', () => {
    it('says sealing is blocked, the reason, what restores it, that the recording is kept and what the operator can do - no percentage, no "Resumed after restart"', async () => {
      mount('/session', blocked)
      const modal = await dialog()
      const notice = within(modal).getByTestId('sm-seal-attention')
      expect(notice).toHaveAttribute('data-kind', 'BLOCKED')
      expect(notice).toHaveAttribute('role', 'alert')
      expect(within(modal).getByRole('heading', { name: W.title })).toBeInTheDocument()
      // The Core's own words. Fix wave M (G75e-06 (b), final re-check 75): the dialog stated the cause FOUR times - the
      // sentence of the failed step, the detail code's sentence and the alert's message all begin with it. The alert's
      // message is the whole statement (the cause, what restores the seal, what it costs); the other two are drawn only
      // where they add to it. (This replaces the pin "all three sentences are drawn".)
      const failedStep = SEAL_BLOCKED_EXAMPLE_FINALIZATION.steps.find((step) => step.status === 'error')!
      expect(within(notice).getByTestId('sm-seal-attention-message')).toHaveTextContent(SEAL_BLOCKED_EXAMPLE_ALERT.message)
      const text = notice.textContent ?? ''
      const cause = SEAL_BLOCKED_DETAIL_SENTENCE.SESSION_KEY_STORE_UNAVAILABLE.replace(/\.$/, '')
      expect(SEAL_BLOCKED_EXAMPLE_ALERT.message).toContain(cause)
      expect(failedStep.detail).toContain(cause)
      expect(text.split(cause)).toHaveLength(2)
      expect(notice).not.toHaveTextContent(failedStep.detail!)
      // "after 3 automatic retries" is the retry control's sentence, once.
      expect(text.split('3 automatic retries')).toHaveLength(2)
      // The rule: a sentence whose leading clause the message holds is not drawn again; one that adds to it is.
      expect(saidAlready(SEAL_BLOCKED_EXAMPLE_ALERT.message, SEAL_BLOCKED_DETAIL_SENTENCE.SESSION_KEY_STORE_UNAVAILABLE)).toBe(true)
      expect(saidAlready(SEAL_BLOCKED_EXAMPLE_ALERT.message, failedStep.detail!)).toBe(true)
      expect(saidAlready(SEAL_BLOCKED_EXAMPLE_ALERT.message, SEAL_BLOCKED_DETAIL_SENTENCE.SESSION_KEY_UNSAFE)).toBe(false)
      expect(notice).toHaveTextContent(SEAL_RECORDING_KEPT_SENTENCE)
      expect(notice).toHaveTextContent(W.action)
      expect(notice).toHaveTextContent(W.closeNote)
      // Nothing invented.
      expect(within(modal).queryByTestId('sm-final-progress')).toBeNull()
      expect(modal).not.toHaveTextContent(/\d+% complete/)
      expect(within(modal).queryByTestId('sm-final-eta')).toBeNull()
      expect(within(modal).queryByTestId('sm-final-resumed')).toBeNull()
      expect(modal).not.toHaveTextContent(F.resumed)
      expect(modal).not.toHaveTextContent(F.title)
      expect(getMissingI18nKeys()).toEqual([])
    })

    it('can be left with its button; the session stays FINALIZING on the Core', async () => {
      const sim = mount('/session', blocked)
      const modal = await dialog()
      fireEvent.click(within(modal).getByTestId('sm-final-close'))
      await waitFor(() => expect(screen.queryByTestId('finalization-modal')).toBeNull(), FIND)
      expect(sim.store.getState().session).toMatchObject({ id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, state: 'FINALIZING' })
    })

    it('can be left with Escape', async () => {
      mount('/session', blocked)
      const modal = await dialog()
      fireEvent.keyDown(modal, { key: 'Escape', code: 'Escape' })
      await waitFor(() => expect(screen.queryByTestId('finalization-modal')).toBeNull(), FIND)
    })

    it('the alert resolved (the seal runs again): the notice goes and the progress is back', async () => {
      const sim = mount('/session', blocked)
      const modal = await dialog()
      expect(within(modal).getByTestId('sm-seal-attention')).toBeInTheDocument()
      act(() => {
        const session = sim.store.getState().session!
        const steps = session.finalization.steps.map((step, index) => (index === 0 ? { ...step, status: 'active' as const, detail: null, progress: 10 } : step))
        sim.store.setState({ session: { ...session, finalization: { ...session.finalization, steps } }, alerts: [{ ...SEAL_BLOCKED_EXAMPLE_ALERT, active: false, resolvedAt: DEMO_NOW }] })
      })
      await waitFor(() => expect(within(modal).queryByTestId('sm-seal-attention')).toBeNull(), FIND)
      expect(within(modal).getByTestId('sm-final-progress')).toBeInTheDocument()
      expect(within(modal).queryByTestId('sm-final-close')).toBeNull()
    })
  })

  describe('G75b-02 dialog: retrying', () => {
    it("shows the Core's retry sentence and that the recording is kept; it can be left; no \"Resumed after restart\" from `attempt`", async () => {
      mount('/session', retrying)
      const modal = await dialog()
      const notice = within(modal).getByTestId('sm-seal-attention')
      expect(notice).toHaveAttribute('data-kind', 'RETRYING')
      const failedStep = SEAL_RETRYING_EXAMPLE_FINALIZATION.steps.find((step) => step.status === 'error')!
      expect(failedStep.attempt).toBeGreaterThan(1)
      expect(notice).toHaveTextContent(W.retryTitle)
      expect(notice).toHaveTextContent(failedStep.detail!)
      expect(notice).toHaveTextContent(SEAL_RECORDING_KEPT_SENTENCE)
      expect(within(modal).queryByTestId('sm-final-resumed')).toBeNull()
      expect(modal).not.toHaveTextContent(/\d+% complete/)
      expect(within(modal).getByTestId('sm-final-close')).toBeInTheDocument()
    })
  })

  describe('G75b-02 rows: the Monitor banner and the Dashboard', () => {
    it('Monitor banner: "SEALING BLOCKED" with the Core\'s reason - not "FINALIZING ... step 1 of 6"', async () => {
      mount('/session', blocked)
      const banner = await screen.findByTestId('sm-status-banner', {}, FIND)
      expect(banner).toHaveTextContent(W.bannerTitle)
      expect(banner).toHaveAttribute('data-seal', 'BLOCKED')
      expect(banner).not.toHaveTextContent(en.session.banner.FINALIZING.title)
      expect(banner).not.toHaveTextContent(/step \d of \d/i)
      expect(within(banner).getByTestId('sm-banner-detail')).toHaveTextContent(SEAL_RECORDING_KEPT_SENTENCE)
    })

    it('Dashboard: the session row reads "Sealing blocked", shows no step progress and no spinner', async () => {
      mount('/dashboard', blocked)
      const row = await screen.findByTestId('session-finalizing', {}, FIND)
      expect(row).toHaveTextContent(W.rowState)
      expect(row).toHaveAttribute('data-seal', 'BLOCKED')
      expect(row).not.toHaveTextContent(en.dashboard.activeSession.finalizing.title)
      expect(row).not.toHaveTextContent(/Step \d of \d/)
      expect(within(row).queryByRole('progressbar')).toBeNull()
      expect(row).toHaveTextContent(SEAL_RECORDING_KEPT_SENTENCE)
      expect(getMissingI18nKeys()).toEqual([])
    })

    it('CONTROL - a seal that runs: the banner reads FINALIZING, the Dashboard "Finalizing evidence"', async () => {
      mount('/dashboard', () => undefined)
      const row = await screen.findByTestId('session-finalizing', {}, FIND)
      expect(row).toHaveTextContent(en.dashboard.activeSession.finalizing.title)
      expect(row).not.toHaveTextContent(W.rowState)
    })
  })

  describe('"Resumed after restart" is no reading of `attempt` (contract note section 4)', () => {
    const attemptTwo = (sim: Sim, patch: Record<string, unknown>) => {
      const session = sim.store.getState().session!
      const steps = session.finalization.steps.map((step, index) => ({ ...step, attempt: 2, status: index === 0 ? ('active' as const) : ('pending' as const), progress: index === 0 ? 5 : 0 }))
      sim.store.setState({ session: { ...session, state: 'FINALIZING', finalization: { ...session.finalization, steps }, ...patch } as typeof session })
    }

    it("a session of the Core's own capture at attempt 2: the note is not shown", async () => {
      mount('/session', (sim) => attemptTwo(sim, { captureDurable: true }))
      const modal = await dialog()
      expect(within(modal).getByTestId('sm-final-progress')).toBeInTheDocument()
      expect(within(modal).queryByTestId('sm-final-resumed')).toBeNull()
    })

    it("CONTROL - the simulator's own session at attempt 2 (there the attempt only grows on a recovery): the note stays", async () => {
      mount('/session', (sim) => attemptTwo(sim, {}))
      const modal = await dialog()
      expect(within(modal).getByTestId('sm-final-resumed')).toHaveTextContent(F.resumed)
    })
  })

  describe('CONTROL - a seal that simply runs', () => {
    it('keeps its percent, shows no notice and cannot be closed', async () => {
      mount('/session', () => undefined)
      const modal = await dialog()
      expect(within(modal).queryByTestId('sm-seal-attention')).toBeNull()
      expect(within(modal).getByTestId('sm-final-progress')).toBeInTheDocument()
      expect(within(modal).queryByTestId('sm-final-close')).toBeNull()
      fireEvent.keyDown(modal, { key: 'Escape', code: 'Escape' })
      expect(screen.getByTestId('finalization-modal')).toBeInTheDocument()
    })
  })
})
