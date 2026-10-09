/**
 * Sealing progress, forward-only (blueprint row 87, M7-W6; UX spec flow 3 §4.7 and flow 4 §5.7;
 * evidence package spec §E.2; E-13; checks M7-FF-WEB).
 *
 * THE RULE. What the finalization view draws is a pure function of the `session.finalization`
 * states the Core sent, in the order they arrived, and of nothing else:
 *
 *   - no clock is read and no timer runs here: between two Core states the drawn values cannot
 *     change (a client timer never invents progress);
 *   - a step once drawn DONE stays drawn DONE, and its percent never falls: a resumed attempt may
 *     rewrite a step's `progress` on the Core (`attempt` grows), the view keeps the largest it saw;
 *   - the overall percent never decreases;
 *   - the ETA is the Core's `etaMs` of the running step as it came; without one nothing is guessed
 *     ("estimating…").
 *
 * `advanceSealing` is the whole rule: `(memory, session, steps, sealed) -> { view, memory }`. The
 * memory belongs to ONE session; another session ID starts from nothing. The same percent rule as
 * operation 83 (`sealingProgress` of the simulator): the mean of the step percents, floored.
 */
import { useState } from 'react'

/** The members of a finalization step this view reads (the slice's `FinalizationStepState`). */
export interface SealingStepInput {
  readonly id: string
  readonly status: 'pending' | 'active' | 'done' | 'warn' | 'error'
  readonly progress?: number | undefined
  readonly etaMs?: number | null | undefined
  readonly attempt?: number | undefined
}

export interface SealingStepView {
  readonly id: string
  /** The status drawn: the Core's, except that a step once seen DONE stays `done`. */
  readonly status: SealingStepInput['status']
  /** 0 … 100, the largest value seen for this step. */
  readonly percent: number
}

export interface SealingProgressView {
  readonly steps: readonly SealingStepView[]
  /** Whole percent over all steps, 0 … 100; never lower than a value drawn before for this session. */
  readonly percent: number
  /** The Core's estimate at the running step, in ms; null: none reported (nothing is guessed). */
  readonly etaMs: number | null
  /** True when the Core reports progress or an ETA for the running step (v2 steps). */
  readonly reportsProgress: boolean
  /** A RECOVERY resume: some step is at attempt 2 or later (the rule of operation 83). */
  readonly resumed: boolean
  /** The highest attempt among the steps (1 for a first run). */
  readonly attempt: number
}

export interface SealingMemory {
  readonly sessionId: string | null
  readonly percent: number
  /** Per step ID: the largest percent seen; 100 once the step was seen DONE. */
  readonly steps: Readonly<Record<string, number>>
  readonly attempt: number
}

export const EMPTY_SEALING_MEMORY: SealingMemory = Object.freeze({ sessionId: null, percent: 0, steps: Object.freeze({}), attempt: 1 })

const clampPercent = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.floor(value))) : 0)

/** The percent the Core's state gives one step: DONE 100, a running step its `progress` (below 100), any other 0. */
function reportedPercent(step: SealingStepInput): number {
  if (step.status === 'done') return 100
  if (step.status === 'pending') return 0
  // A step that is not DONE never reads 100: the last percent belongs to the Core's DONE.
  return Math.min(99, clampPercent(step.progress))
}

export function advanceSealing(
  memory: SealingMemory,
  sessionId: string | null,
  steps: readonly SealingStepInput[] | null,
  sealed: boolean,
): { readonly view: SealingProgressView; readonly memory: SealingMemory } {
  const held = memory.sessionId === sessionId ? memory : { ...EMPTY_SEALING_MEMORY, sessionId }
  const list = steps ?? []
  const seen: Record<string, number> = {}
  let changed = held !== memory
  const views: SealingStepView[] = list.map((step) => {
    const before = held.steps[step.id] ?? 0
    const now = sealed ? 100 : reportedPercent(step)
    const percent = Math.max(before, now)
    seen[step.id] = percent
    if (percent !== before) changed = true
    return { id: step.id, status: percent >= 100 ? 'done' : step.status, percent }
  })
  // Steps the Core no longer lists keep what was seen of them (nothing is forgotten within a session).
  for (const [id, percent] of Object.entries(held.steps)) if (!(id in seen)) seen[id] = percent

  // Over every step this session has shown, not only the ones this state lists: a state that lists
  // fewer steps (or none) must neither rewind the percent nor make the rest look finished.
  const known = Object.values(seen)
  const mean = known.length === 0 ? 0 : Math.floor(known.reduce((sum, value) => sum + value, 0) / known.length)
  const percent = Math.max(held.percent, sealed ? 100 : mean)
  const attempt = Math.max(held.attempt, ...list.map((step) => (typeof step.attempt === 'number' && Number.isInteger(step.attempt) ? step.attempt : 1)))
  if (percent !== held.percent || attempt !== held.attempt) changed = true

  const running = sealed ? undefined : list.find((step) => step.status === 'active' && (seen[step.id] ?? 0) < 100)
  const etaMs = running !== undefined && typeof running.etaMs === 'number' && Number.isFinite(running.etaMs) && running.etaMs >= 0 ? running.etaMs : null
  const view: SealingProgressView = {
    steps: views,
    percent,
    etaMs,
    reportsProgress: running !== undefined && (typeof running.progress === 'number' || etaMs !== null),
    resumed: attempt > 1,
    attempt,
  }
  return { view, memory: changed ? { sessionId, percent, steps: seen, attempt } : memory }
}

/**
 * The forward-only view of one session's sealing. The memory is React state adjusted while
 * rendering (no effect, no timer): it changes only in a render that received a new Core state.
 */
export function useSealingProgress(sessionId: string | null, steps: readonly SealingStepInput[] | null, sealed: boolean): SealingProgressView {
  const [memory, setMemory] = useState<SealingMemory>(EMPTY_SEALING_MEMORY)
  const next = advanceSealing(memory, sessionId, steps, sealed)
  if (next.memory !== memory) setMemory(next.memory)
  return next.view
}

/** Whole seconds of an ETA, rounded up, at least 1 ("about 4 s left"). */
export function etaSeconds(etaMs: number): number {
  return Math.max(1, Math.ceil(etaMs / 1000))
}
