/**
 * Shared helpers of the Start New Session Live tests (plan row W64; `src/test/live-session-new-*.test.tsx`).
 * Not a test file (Vitest collects `*.test.*` only); no production file imports it.
 *
 * | Helper | What it gives a test |
 * |--------|----------------------|
 * | `createCoreDriver(now)` | A simulator that stands for the Core server's engine, signed in as the bed's SUPERVISOR: the test runs the same actions the Core runs and sends the resulting `session` slice as the command's delta. So every state the page receives is one the real engine produces |
 * | `mountSessionNew(options)` | The W50 harness (`createLiveTestBed`): a Live page load signed in as the SUPERVISOR, the Core holding `served` (default: idle), the real router at `/session/new` |
 * | `sessionOps(driver)` | The delta that replaces the `session` slice with the driver's |
 * | `toastsWith(text)`, `clearToasts()` | Toast queries scoped to `[data-slot="toast"]`, and the queue emptied between tests (F76-9) |
 * | `deniedTitle`, `deniedRole`, `offline` | The words of the presenter (§6.2, LB-6) a refusal and an outage must show |
 */
import { act, fireEvent, screen } from '@testing-library/react'
import { toast } from '@heroui/react'
import { DEFAULT_SESSION_ROOM, OPENAPI_EXAMPLE_INSTANT, pickReplicatedState, type ReplicatedState, type SessionCreateRequest } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import {
  ALWAYS_VISIBLE,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  PRECHECK_TOTAL_MAX_MS,
  RecordingProfileId,
  type Sim,
  type SimState,
} from '@dems/shared/sim'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed, type MountedPage, type MountOptions } from '@/runtime/testing/live-harness'

/** The presenter's denied toast for SESSION_START (§6.2): the title and the role it names. */
export const deniedTitle = en.common.rbac.deniedTitle
export const deniedRole = en.common.rbac.requiresRole.replace('{{role}}', en.common.roles.INVESTIGATOR)
/** LB-6. */
export const offline = en.common.coreErrors.offline

/** Where the fake transport's clock starts (the contract's example instant): the Core driver starts there too. */
export const CORE_START_MS = Date.parse(OPENAPI_EXAMPLE_INSTANT)

/** The input the form below fills in, as the Core receives it. */
export const FORM_INPUT: SessionCreateRequest = {
  caseNumber: 'LP/2026/1001-0101',
  subjectType: 'TERSANGKA',
  subjectName: 'Rudi Hartono',
  investigatorId: SUPERVISOR_SESSION.operator.id,
  room: DEFAULT_SESSION_ROOM,
  profileId: RecordingProfileId.STANDARD_1080P25,
}

const wire = (state: SimState): ReplicatedState => pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState)

export interface CoreDriver {
  readonly sim: Sim
  /** Runs the engine in 50 ms steps until `done` holds (or the longest pre-check is over). */
  runUntil(done: (state: SimState) => boolean, maxMs?: number): boolean
  /** The Core's state now. */
  state(): SimState
}

/** The Core's engine for a test, signed in as the bed's SUPERVISOR, on its own manual clock. */
export function createCoreDriver(now: number): CoreDriver {
  const clock = createManualClock(now)
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: SUPERVISOR_SESSION.operator.id, issuedAt: now })
  const sim = createSim({ storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined, clock })
  return {
    sim,
    runUntil(done, maxMs = PRECHECK_TOTAL_MAX_MS + 500) {
      for (let elapsed = 0; elapsed <= maxMs; elapsed += 50) {
        if (done(sim.store.getState())) return true
        clock.advance(50)
        sim.tick()
      }
      return done(sim.store.getState())
    },
    state: () => sim.store.getState(),
  }
}

/** The pre-check of the driver's session, run to its outcome. */
export function resolvePrecheck(driver: CoreDriver): void {
  const resolved = driver.runUntil((state) => state.session?.precheck.outcome != null || state.session?.state === 'ARMED')
  if (!resolved) throw new Error('the driver\'s pre-check did not resolve')
}

/** The delta of a session command: the `session` slice as the Core holds it after the command. */
export function sessionOps(driver: CoreDriver) {
  return [{ op: 'replace' as const, slice: 'session' as const, value: wire(driver.state()).session }]
}

/** A Core whose open session is at `stage`, built by the engine itself. */
export function coreWithSession(now: number, stage: 'CREATE' | 'WARN' | 'BLOCK' | 'ARMED'): CoreDriver {
  const driver = createCoreDriver(now)
  if (stage === 'WARN') driver.sim.actions.inject('MIC_NO_SIGNAL')
  if (stage === 'BLOCK') driver.sim.actions.setTabletLink('OFFLINE')
  const created = driver.sim.actions.createSession({ ...FORM_INPUT, subjectName: 'Siti Rahma', caseNumber: 'LP/2026/1001-0007' })
  if (!created.ok) throw new Error(`the driver could not create a session: ${created.reason}`)
  if (stage === 'CREATE') return driver
  driver.sim.actions.beginPrecheck()
  resolvePrecheck(driver)
  const state = driver.state().session?.state
  const expected = stage === 'ARMED' ? 'ARMED' : 'PRECHECK'
  if (state !== expected) throw new Error(`the driver's session is ${String(state)}, not ${expected}`)
  return driver
}

export interface MountedSessionNew {
  readonly bed: LiveTestBed
  readonly page: LivePage
  readonly mounted: MountedPage
}

/**
 * One Live page load at `path`, signed in as the SUPERVISOR; the Core serves `served` (default: its
 * idle state). `prepare` runs after the load and before the router is mounted: the place to script
 * an answer the page asks for as soon as it renders (the resume effect of B-6).
 */
export async function mountSessionNew(
  options: { served?: SimState; path?: string; mount?: MountOptions; prepare?: (bed: LiveTestBed) => void } = {},
): Promise<MountedSessionNew> {
  const bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
  if (options.served) bed.core.served = options.served
  const page = await bed.load()
  options.prepare?.(bed)
  const mounted = await bed.mount(page, options.path ?? '/session/new', options.mount)
  await screen.findByTestId('page-session-new', {}, { timeout: 15_000 })
  return { bed, page, mounted }
}

/** Fills the Session Info form with `FORM_INPUT` (the investigator, room and profile are the defaults). */
export function fillForm({ caseNumber = FORM_INPUT.caseNumber, name = FORM_INPUT.subjectName, subject = true } = {}): void {
  const caseInput = screen.getByTestId('sn-case-number')
  fireEvent.change(caseInput, { target: { value: caseNumber } })
  fireEvent.blur(caseInput)
  // A second press on the selected subject type deselects it: leave it when it is already chosen.
  if (subject) fireEvent.click(screen.getByTestId(`sn-subject-${FORM_INPUT.subjectType}`))
  const nameInput = screen.getByTestId('sn-subject-name')
  fireEvent.change(nameInput, { target: { value: name } })
  fireEvent.blur(nameInput)
}

export function isDisabled(element: HTMLElement): boolean {
  return element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true' || element.hasAttribute('data-disabled')
}

/** The toasts on screen whose text holds `text` (scoped to the kit's toast element, F76-9). */
export function toastsWith(text: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-slot="toast"]')).filter((element) => (element.textContent ?? '').includes(text))
}

const originalMatchMedia = window.matchMedia

/**
 * Empties the kit's toast queue, which is one per page and outlives a test (the pattern of W54's
 * tests). A toast that is still open is closed without its exit animation; one that is exiting is
 * waited for. The presenter's coalescing memory is reset too, so every test starts clean.
 */
export async function clearToasts(): Promise<void> {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
  resetCoreErrorPresenter()
}

/** Lets the page's promise jobs and the fake's answers run. */
export async function settleAll(bed: LiveTestBed): Promise<void> {
  await bed.flush()
  await act(async () => {
    await bed.fake.idle()
  })
  await bed.flush()
}

/**
 * jsdom implements neither media playback nor a 2D canvas: the camera previews and the meters of
 * step 2 would print "Not implemented" on every render (the folder's existing test stubs the same).
 * Returns the function that puts the originals back.
 */
export function stubMediaForJsdom(): () => void {
  const originalPlay = HTMLMediaElement.prototype.play
  const originalPause = HTMLMediaElement.prototype.pause
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  HTMLMediaElement.prototype.play = (() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = (() => undefined) as unknown as HTMLMediaElement['pause']
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
  return () => {
    HTMLMediaElement.prototype.play = originalPlay
    HTMLMediaElement.prototype.pause = originalPause
    HTMLCanvasElement.prototype.getContext = originalGetContext
  }
}
