// Blueprint row 87 (M7-W6; WB-01 modal; UX spec flows 3 and 4; E-13): sealing progress on the web
// console is forward-only and comes from the Core's states alone.
//
// | Rule | Where |
// |------|-------|
// | The percent is the mean of the step percents, floored (the rule of operation 83) | "the rule" |
// | A lower value from the Core never rewinds a step or the overall percent; a DONE step stays DONE | "forward-only" |
// | NEGATIVE CONTROL: without a new Core state nothing moves, however much time passes | "no Core state, no movement" |
// | The ETA is the Core's or none ("estimating…"); never a number made here | "the ETA" |
// | A resumed seal says so, and is drawn in the SAME dialog as the recovery (no modal swap) | "resumed sealing, in place" |
//
// The software part of M7-FF-WEB; the browser run on a real sealing is scripted for the M7 gate.
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FINALIZATION_STEPS_V2, SessionState } from '@dems/shared/domain'
import { en } from '@dems/shared/i18n'
import type { FinalizationStepState, Sim } from '@dems/shared/sim'
import { createTestSim, withProviders } from '@/components/composed/__tests__/test-utils'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { FinalizationModal, type OverlayMode } from '../finalization-modal'
import { EMPTY_SEALING_MEMORY, advanceSealing, etaSeconds, type SealingMemory, type SealingStepInput } from '../sealing-progress'

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
    expect(within(modal()).getByTestId('sm-final-eta')).toHaveTextContent(F.eta.replace('{{seconds}}', '6'))
    expect(stepStatuses()).toEqual(['done', 'done', 'active', 'pending', 'pending', 'pending'])
    expect(within(modal()).getAllByRole('listitem')[2]).toHaveTextContent('40%')

    // NEGATIVE CONTROL: a minute passes on this page, the Core sends nothing: the same percent, the same ETA.
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(label()).toContain(percentText(40))
    expect(within(modal()).getByTestId('sm-final-eta')).toHaveTextContent(F.eta.replace('{{seconds}}', '6'))

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

  it('no ETA from the Core: "estimating", and no number', () => {
    const { sim, sessionId } = finalizingSim()
    coreSends(sim, steps(1, 5, { etaMs: null }))
    mount(sim, sessionId)
    const eta = within(modal()).getByTestId('sm-final-eta')
    expect(eta).toHaveAttribute('data-eta', 'none')
    expect(eta).toHaveTextContent(F.estimating)
    expect(eta.textContent).not.toMatch(/\d/)
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
