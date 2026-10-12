/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W65: the action bar of the Session Monitor in Live mode — settle site B-2 (`addMarker`,
// `addNote`, `snapshot`, `stopRecording`, `features/session-monitor/action-bar.tsx`) with the reads
// C-1 and C-2 — through the real router and the real Live source on the contract-checked fake
// transport (backend task 04_client_integration_spec §8.3 B-2, §8.4 C-1, C-2, §8.1 LB-1 to LB-10,
// §6.2; gate CLG (b) of 02_plan §11). The page of this file is `http://127.0.0.1:5178/`.
//
// The Core's side is a simulator of the same scenario: the state it serves is the snapshot, and
// the effect of a command is the session slice that simulator holds after the same action, sent as
// the delta of the command's revision (CL-16).
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | B-2 marker: success with the flight's label and the toast read in `ok` (C-1); chip at the button while out (LB-4); refusal (AC-C-48); outage (LB-6) | "B-2 marker" |
// | B-2 note: success closes the drawer on the settle; refusal and outage keep it open with the text | "B-2 note" |
// | B-2 snapshot: the shutter at the press, the toast on the settle with the camera read in `ok` (C-2); refusal; outage | "B-2 snapshot" |
// | B-2 stop: success closes on the settle and the overlay follows the state; 422 shows the field's error (F59); 409 already ended (Q16); refusal; outage and limit keep the dialog open (LB-6, LB-10) | "B-2 stop" |
// | LB-1 busy at once (a second press sends nothing), spinner late | "B-2 marker", "B-2 stop" |
// | Simulated mode renders nothing of the waiting state (the simulator answers inside the press) | "Simulated mode is unchanged" |
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { rateLimited, refusal, type FakeCommandOptions } from '@dems/shared/live/testing'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  OPERATOR_IDS,
  type ControllableClock,
  type Sim,
} from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createAppRouter } from '@/router'
import { webErrorSink } from '@/runtime'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const S = en.session.actions
const DENIED = en.common.rbac.deniedTitle
const REQUIRES = (role: string) => en.common.rbac.requiresRole.replace('{{role}}', role)
const OFFLINE = en.common.coreErrors.offline
const LIMITED = (seconds: number) => en.common.coreErrors.limited.replace('{{seconds}}', String(seconds))
const REASON_ERROR = S.endSession.reasonTooShort.replace('{{min}}', '5')

type Ops = FakeCommandOptions['ops']

const originalMatchMedia = window.matchMedia
const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext

/** Empties the kit's toast queue, which is one per page and outlives a test (F76-9). */
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}
/** The toasts on screen, by their text (scoped to the kit's toast slot, F76-9). */
const toastTexts = (): string[] => Array.from(document.querySelectorAll('[data-slot="toast"]')).map((element) => element.textContent ?? '')
const toastWith = (text: string) => toastTexts().filter((entry) => entry.includes(text))

let bed: LiveTestBed | undefined
let core: Sim | undefined
/** The page load of the test: its own sink must hold no `live.misuse` report (brief list row 18). */
let loaded: LivePage | undefined
/** The Core model's clock: the test moves it by hand and steps the engine with `tick()`. */
let coreClock: ControllableClock | undefined

/**
 * The Core's model: a simulator in the recording scenario on the fake transport's clock, with the
 * SUPERVISOR of the session signed in (so its actions pass the simulator's own gates).
 */
function coreModel(at: number): Sim {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: at })
  coreClock = createManualClock(at)
  return createSim({
    scenario: 'recording',
    clock: coreClock,
    storage: null,
    authStorage,
    visibility: ALWAYS_VISIBLE,
    scheduler: () => () => undefined,
  })
}

/** The session slice the Core holds after `run`, as the delta of a command (a plain JSON copy). */
function effect(run: (sim: Sim) => void): Ops {
  run(core!)
  return [{ op: 'replace', slice: 'session', value: JSON.parse(JSON.stringify(core!.store.getState().session)) }] as Ops
}

/** The SUPERVISOR (OPR-002) on `/session` in Live mode, a recording on screen. */
async function liveMonitor(): Promise<{ bed: LiveTestBed; page: LivePage }> {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  core = coreModel(created.fake.clock.now())
  created.core.served = core.store.getState()
  const page = await created.load()
  loaded = page
  await created.mount(page, '/session')
  await screen.findByTestId('page-session-monitor', {}, { timeout: 15_000 })
  await waitFor(() => expect(screen.getByTestId('page-session-monitor')).toHaveAttribute('data-phase', 'RECORDING'))
  return { bed: created, page }
}

const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)
const sessionOf = (page: LivePage) => page.live.store.getState().session!
const slot = (testId: string) => screen.getByTestId(testId).closest('.sm-action-slot') as HTMLElement

async function openMarker(label: string) {
  fireEvent.click(screen.getByTestId('sm-action-marker'))
  fireEvent.change(await screen.findByTestId('sm-marker-input'), { target: { value: label } })
  fireEvent.click(screen.getByTestId('sm-marker-submit'))
}

async function openNote(text: string): Promise<HTMLElement> {
  fireEvent.click(screen.getByTestId('sm-action-note'))
  const drawer = await screen.findByTestId('sm-note-drawer')
  fireEvent.change(within(drawer).getByTestId('sm-note-input'), { target: { value: text } })
  fireEvent.click(within(drawer).getByTestId('sm-note-submit'))
  return drawer
}

async function openStop(reason: string): Promise<HTMLElement> {
  // Keyboard and assistive-tech activation opens the dialog directly (M-C-19).
  fireEvent.click(screen.getByTestId('sm-action-end'))
  const dialog = await screen.findByTestId('sm-end-dialog')
  fireEvent.change(within(dialog).getByTestId('sm-end-reason'), { target: { value: reason } })
  fireEvent.click(within(dialog).getByTestId('sm-end-confirm'))
  return dialog
}

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
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
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = vi.fn() as unknown as HTMLMediaElement['pause']
})

afterEach(async () => {
  // Brief list row 18 of implementation/44_live_source.md §17.4: no call site read a Live result as a value.
  const misuse = loaded?.sink.records().filter((record) => record.source === 'live.misuse') ?? []
  loaded = undefined
  cleanup()
  await clearToasts()
  bed?.dispose()
  bed = undefined
  core?.stop()
  core = undefined
  coreClock = undefined
  window.matchMedia = originalMatchMedia
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  expect(misuse.map((record) => `${record.level} ${record.message}`)).toEqual([])
})

describe('the page of this file', () => {
  it('is the Session Monitor on the Live source, at the address Live mode needs, with every session action open to the SUPERVISOR', async () => {
    const { page } = await liveMonitor()
    expect(window.location.origin).toBe('http://127.0.0.1:5178')
    expect(page.live.session?.operator.id).toBe(OPERATOR_IDS.ANDI)
    for (const id of ['sm-action-marker', 'sm-action-note', 'sm-action-snapshot', 'sm-action-end']) expect(screen.getByTestId(id)).not.toBeDisabled()
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('B-2 marker (C-1; LB-1, LB-4)', () => {
  it('success: one POST with the label, the chip waits at the button while the answer is out, a second press sends nothing, and the toast and the flight label are read in `ok`', async () => {
    const { bed, page } = await liveMonitor()
    const before = sessionOf(page).markerCount
    // `answer-first`: the answer arrives, the action settles only when the delta of its revision does (CL-16).
    const command = bed.fake.scriptCommand('addSessionMarker', { ops: effect((sim) => sim.actions.addMarker('Subject changes statement')), order: 'answer-first' })

    await openMarker('Subject changes statement')
    await bed.fake.arrived()
    await bed.flush()
    // The popover closed at the press; the chip waits at the button (LB-4); the slot is busy (LB-1).
    await waitFor(() => expect(screen.queryByTestId('sm-marker-input')).not.toBeInTheDocument())
    expect(screen.getByTestId('sm-marker-pending')).toHaveTextContent('Subject changes statement')
    expect(slot('sm-action-marker')).toHaveAttribute('aria-busy', 'true')
    expect(requests('addSessionMarker')).toHaveLength(1)
    expect(requests('addSessionMarker')[0]).toMatchObject({ method: 'POST', body: { label: 'Subject changes statement' } })
    expect(toastWith(S.addMarker.added.split('{{')[0]!)).toHaveLength(0)

    // A second press while the first is out sends nothing (LB-1).
    await openMarker('A second one')
    await bed.flush()
    expect(requests('addSessionMarker')).toHaveLength(1)
    // Spinner late: after LIVE_PENDING_REVEAL_MS the kit's pending state shows.
    await waitFor(() => expect(screen.getByTestId('sm-action-marker')).toHaveAttribute('data-pending', 'true'))

    command.sendDelta()
    await bed.flush()
    // C-1: the store holds the new marker when `ok` runs; the toast follows the settle.
    expect(sessionOf(page).markerCount).toBe(before + 1)
    await waitFor(() => expect(toastWith(S.addMarker.added.split('{{')[0]!)).toHaveLength(1))
    await waitFor(() => expect(screen.queryByTestId('sm-marker-pending')).not.toBeInTheDocument())
    expect(slot('sm-action-marker')).not.toHaveAttribute('aria-busy')
    expect(screen.getByTestId('sm-action-marker')).not.toHaveAttribute('data-pending')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('refusal (AC-C-48): a 403 NOT_PERMITTED shows the denied toast naming the role; the chip leaves and the button returns to idle', async () => {
    const { bed, page } = await liveMonitor()
    const before = sessionOf(page).markerCount
    bed.fake.answerOnce('addSessionMarker', bed.fake.example('addSessionMarker', 403, 'notPermitted'))
    await openMarker('Refused marker')
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(DENIED)[0]).toContain(REQUIRES(en.common.roles.INVESTIGATOR))
    expect(toastWith(S.failed)).toHaveLength(0)
    await waitFor(() => expect(screen.queryByTestId('sm-marker-pending')).not.toBeInTheDocument())
    expect(slot('sm-action-marker')).not.toHaveAttribute('aria-busy')
    expect(sessionOf(page).markerCount).toBe(before)
    // The page's own record names the control and the class, not the text.
    expect(webErrorSink.records().filter((record) => record.source === 'SessionMonitor.ActionBar.addMarker')).toHaveLength(1)
    expect(JSON.stringify(webErrorSink.records())).not.toContain('Refused marker')
  })

  it('outage (LB-6): the presenter\'s sentence, no success toast, no marker', async () => {
    const { bed, page } = await liveMonitor()
    const before = sessionOf(page).markerCount
    bed.fake.failOnce('addSessionMarker')
    await openMarker('Lost marker')
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(toastWith(S.addMarker.added.split('{{')[0]!)).toHaveLength(0)
    await waitFor(() => expect(screen.queryByTestId('sm-marker-pending')).not.toBeInTheDocument())
    expect(sessionOf(page).markerCount).toBe(before)
  })
})

describe('B-2 note (LB-1)', () => {
  it('success: Save is busy until the settle, then the drawer closes and the toast shows', async () => {
    const { bed, page } = await liveMonitor()
    const command = bed.fake.scriptCommand('addSessionNote', { ops: effect((sim) => sim.actions.addNote('Counsel present from 10:05')), order: 'answer-first' })
    const drawer = await openNote('Counsel present from 10:05')
    await bed.fake.arrived()
    await bed.flush()
    expect(requests('addSessionNote')[0]).toMatchObject({ method: 'POST', body: { text: 'Counsel present from 10:05' } })
    expect(within(drawer).getByTestId('sm-note-submit')).toHaveAttribute('data-busy', 'true')
    expect(screen.getByTestId('sm-note-drawer')).toBeInTheDocument()
    command.sendDelta()
    await bed.flush()
    await waitFor(() => expect(screen.queryByTestId('sm-note-drawer')).not.toBeInTheDocument())
    expect(toastWith(S.sessionNote.saved)).toHaveLength(1)
    expect(sessionOf(page).notes.at(-1)?.text).toBe('Counsel present from 10:05')
  })

  it('refusal (AC-C-48) keeps the drawer open with the text and shows the denied toast', async () => {
    const { bed } = await liveMonitor()
    bed.fake.answerOnce('addSessionNote', bed.fake.example('addSessionNote', 403, 'notPermitted'))
    const drawer = await openNote('A refused note')
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(DENIED)[0]).toContain(REQUIRES(en.common.roles.INVESTIGATOR))
    expect(screen.getByTestId('sm-note-drawer')).toBe(drawer)
    expect(within(drawer).getByTestId('sm-note-input')).toHaveValue('A refused note')
    expect(within(drawer).getByTestId('sm-note-submit')).not.toHaveAttribute('data-busy')
  })

  it('outage (LB-6) keeps the drawer open with the text', async () => {
    const { bed } = await liveMonitor()
    bed.fake.failOnce('addSessionNote')
    const drawer = await openNote('Written while the Core is away')
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(within(drawer).getByTestId('sm-note-input')).toHaveValue('Written while the Core is away')
    expect(toastWith(S.sessionNote.saved)).toHaveLength(0)
  })
})

describe('B-2 snapshot (C-2; LB-4)', () => {
  it('success: the shutter flashes at the press, the toast follows the settle with the camera read in `ok`', async () => {
    const { bed, page } = await liveMonitor()
    const before = sessionOf(page).snapshotCount
    const command = bed.fake.scriptCommand('takeSessionSnapshot', { ops: effect((sim) => sim.actions.snapshot()), order: 'answer-first' })
    fireEvent.click(screen.getByTestId('sm-action-snapshot'))
    await bed.fake.arrived()
    await bed.flush()
    expect(screen.getByTestId('sm-shutter')).toBeInTheDocument()
    expect(toastWith(S.snapshot.captured)).toHaveLength(0)
    expect(screen.getByTestId('sm-action-snapshot')).toHaveAttribute('data-busy', 'true')
    command.sendDelta()
    await bed.flush()
    await waitFor(() => expect(toastWith(S.snapshot.captured)).toHaveLength(1))
    expect(toastWith(S.snapshot.captured)[0]).toContain('Camera 1')
    expect(sessionOf(page).snapshotCount).toBe(before + 1)
    await waitFor(() => expect(screen.getByTestId('sm-queue-badge')).toHaveTextContent(String(before + 1)))
  })

  it('refusal (AC-C-48): the denied toast, no capture toast, the count unchanged', async () => {
    const { bed, page } = await liveMonitor()
    const before = sessionOf(page).snapshotCount
    bed.fake.answerOnce('takeSessionSnapshot', bed.fake.example('takeSessionSnapshot', 403, 'notPermitted'))
    fireEvent.click(screen.getByTestId('sm-action-snapshot'))
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(DENIED)[0]).toContain(REQUIRES(en.common.roles.INVESTIGATOR))
    expect(toastWith(S.snapshot.captured)).toHaveLength(0)
    expect(toastWith(S.snapshot.failed)).toHaveLength(0)
    expect(sessionOf(page).snapshotCount).toBe(before)
  })

  it('outage (LB-6): the presenter\'s sentence and nothing else', async () => {
    const { bed } = await liveMonitor()
    bed.fake.failOnce('takeSessionSnapshot')
    fireEvent.click(screen.getByTestId('sm-action-snapshot'))
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(toastWith(S.snapshot.captured)).toHaveLength(0)
    expect(toastWith(S.snapshot.failed)).toHaveLength(0)
  })
})

describe('B-2 stop (LB-1, LB-6, LB-10; F59; Q16)', () => {
  it('success: one POST with the reason, the confirm busy until the settle, a second press sends nothing; the dialog closes and the overlay follows the state to SEALED', async () => {
    const { bed, page } = await liveMonitor()
    const stopping = effect((sim) => sim.actions.stopRecording('Interview completed'))
    const command = bed.fake.scriptCommand('stopSession', { ops: stopping, order: 'answer-first', answer: bed.fake.example('stopSession', 202) })
    const dialog = await openStop('Interview completed')
    await bed.fake.arrived()
    await bed.flush()
    expect(requests('stopSession')).toHaveLength(1)
    expect(requests('stopSession')[0]).toMatchObject({ method: 'POST', body: { reason: 'Interview completed' } })
    expect(within(dialog).getByTestId('sm-end-confirm')).toHaveAttribute('data-busy', 'true')
    fireEvent.click(within(dialog).getByTestId('sm-end-confirm'))
    await bed.flush()
    expect(requests('stopSession')).toHaveLength(1)
    await waitFor(() => expect(within(dialog).getByTestId('sm-end-confirm')).toHaveAttribute('data-pending', 'true'))
    expect(screen.getByTestId('sm-end-dialog')).toBeInTheDocument()

    command.sendDelta()
    await bed.flush()
    await waitFor(() => expect(screen.queryByTestId('sm-end-dialog')).not.toBeInTheDocument())
    expect(sessionOf(page).state).toBe('STOPPING')
    const overlay = await screen.findByTestId('finalization-modal')
    expect(overlay).toHaveAttribute('data-mode', 'finalization')

    // The Core finalizes and seals; the overlay follows the deltas.
    for (let step = 0; step < 400 && core!.store.getState().session?.state !== 'SEALED'; step += 1) {
      coreClock!.advance(50)
      core!.tick()
    }
    expect(core!.store.getState().session?.state).toBe('SEALED')
    // A sealed item that no bundled DEMO package joins (as on the lane: another case number), so the
    // overlay shows the Core's digest itself.
    const sealedOps = effect(() => undefined) as Array<{ value: { input: { caseNumber: string } } }>
    sealedOps[0]!.value.input.caseNumber = 'LP/2026/1005-0008'
    bed.fake.connection().delta(sealedOps as unknown as Ops)
    await bed.flush()
    await waitFor(() => expect(screen.getByTestId('finalization-modal')).toHaveAttribute('data-state', 'SEALED'))
    expect(screen.getByTestId('sm-status-banner')).toHaveAttribute('data-kind', 'SEALED')
    expect(toastWith(S.endSession.failed)).toHaveLength(0)
    // [CS] §3.2: the digest of the sealed item is the Core's, so the Live overlay never says "simulated".
    const pkg = await within(screen.getByTestId('finalization-modal')).findByTestId('sm-final-package')
    expect(pkg).toHaveAttribute('data-source', 'core')
    // Fix wave Q (CW-04; truth rule 3f), pin moved: this Core is the DEMONSTRATION (it states neither a host clock nor
    // `platformNotReported`), and the one window that announces "sealed" carried no mark and a chip "LIVE", which read as
    // "real". The dialog says DEMO · SIMULATED in its header, says that the seal is simulated, and the chip beside the
    // digest says DEMO · SIMULATED - not "LIVE". (The control - a Core in its own capture draws none of it and no "LIVE"
    // either - is in `real-core-facts.test.tsx`, "G89b-05".)
    const sealedDialog = screen.getByTestId('finalization-modal')
    expect(within(sealedDialog).getByTestId('demo-mark-seal-dialog')).toHaveTextContent('DEMO · SIMULATED')
    expect(within(sealedDialog).getByTestId('sm-final-demonstration')).toHaveTextContent('Demonstration: this seal is simulated. The item is a demonstration record, not evidence.')
    expect(within(pkg).getByTestId('sm-final-source-chip')).toHaveAttribute('data-source-chip', 'DEMO')
    expect(within(pkg).getByTestId('sm-final-source-chip')).toHaveTextContent('DEMO · SIMULATED')
    expect(sealedDialog.textContent ?? '').not.toMatch(/\bLIVE\b/)
  })

  it('422 INVALID_REASON (F59: the Core counts characters, the client code units): the reason field\'s error, the dialog stays open with the text', async () => {
    const { bed } = await liveMonitor()
    bed.fake.answerOnce('stopSession', bed.fake.example('stopSession', 422, 'invalidReason'))
    // The realistic trigger is a reason of five code units and fewer characters (three emoji are six
    // code units): the client's bound lets it through and the Core counts characters. The fake
    // transport refuses such a body before any answer (the contract's schema counts characters too),
    // so the test sends a valid text and scripts the Core's verdict: the UI under test is the 422.
    const dialog = await openStop('Interview completed')
    await waitFor(() => expect(within(dialog).getByText(REASON_ERROR)).toBeInTheDocument())
    expect(screen.getByTestId('sm-end-dialog')).toBe(dialog)
    expect(within(dialog).getByTestId('sm-end-reason')).toHaveValue('Interview completed')
    expect(toastWith(S.endSession.failed)).toHaveLength(0)
    // A changed text clears the Core's error.
    fireEvent.change(within(dialog).getByTestId('sm-end-reason'), { target: { value: 'Interview completed at 10:40' } })
    await waitFor(() => expect(within(dialog).queryByText(REASON_ERROR)).not.toBeInTheDocument())
  })

  it('409 because the session already ended (Q16): the dialog closes with the info toast', async () => {
    const { bed } = await liveMonitor()
    bed.fake.answerOnce('stopSession', refusal(409, 'INVALID_STATE', 'Session is FINALIZING.', { simCode: 'ILLEGAL_STATE', from: 'FINALIZING', event: 'stopRecording' }))
    await openStop('Interview completed')
    await waitFor(() => expect(toastWith(S.endSession.alreadyEnded)).toHaveLength(1))
    await waitFor(() => expect(screen.queryByTestId('sm-end-dialog')).not.toBeInTheDocument())
    expect(toastWith(S.endSession.failed)).toHaveLength(0)
  })

  it('refusal (AC-C-48): a 403 NOT_PERMITTED shows the denied toast naming the role and closes the dialog', async () => {
    const { bed, page } = await liveMonitor()
    bed.fake.answerOnce('stopSession', bed.fake.example('stopSession', 403, 'notPermitted'))
    await openStop('Interview completed')
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(DENIED)[0]).toContain(REQUIRES(en.common.roles.INVESTIGATOR))
    await waitFor(() => expect(screen.queryByTestId('sm-end-dialog')).not.toBeInTheDocument())
    expect(sessionOf(page).state).toBe('RECORDING')
  })

  it('outage (LB-6) and limit (LB-10): the dialog stays open with the reason; a 429 is worded as a limit and never as an outage', async () => {
    const { bed } = await liveMonitor()
    bed.fake.failOnce('stopSession')
    const dialog = await openStop('Interview completed')
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(screen.getByTestId('sm-end-dialog')).toBe(dialog)
    expect(within(dialog).getByTestId('sm-end-reason')).toHaveValue('Interview completed')
    await waitFor(() => expect(within(dialog).getByTestId('sm-end-confirm')).not.toHaveAttribute('data-busy'))

    await clearToasts()
    bed.fake.answerOnce('stopSession', rateLimited(12))
    fireEvent.click(within(dialog).getByTestId('sm-end-confirm'))
    await waitFor(() => expect(toastWith(LIMITED(12))).toHaveLength(1))
    expect(toastWith(OFFLINE)).toHaveLength(0)
    expect(within(dialog).getByTestId('sm-end-reason')).toHaveValue('Interview completed')
    expect(requests('stopSession')).toHaveLength(2)
  })
})

describe('Simulated mode is unchanged (the simulator answers inside the press)', () => {
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

  it('no chip waits, no control turns busy and no pending state is revealed after a marker, a snapshot and a note', async () => {
    // The health query of the shell in Simulated mode: answered here, so nothing reaches a port.
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })))
    const sim = coreModel(Date.now())
    core = sim
    const router = createAppRouter(
      { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket() },
      { history: createMemoryHistory({ initialEntries: ['/session'] }) },
    )
    render(<RouterProvider router={router} />)
    await screen.findByTestId('page-session-monitor', {}, { timeout: 15_000 })
    const before = sim.store.getState().session!.markerCount

    await openMarker('Simulated marker')
    // The simulator answered inside the press: the marker exists already, and nothing waits.
    expect(sim.store.getState().session!.markerCount).toBe(before + 1)
    expect(screen.queryByTestId('sm-marker-pending')).not.toBeInTheDocument()
    expect(slot('sm-action-marker')).not.toHaveAttribute('aria-busy')
    expect(screen.getByTestId('sm-action-marker')).not.toHaveAttribute('data-busy')
    fireEvent.click(screen.getByTestId('sm-action-snapshot'))
    expect(screen.getByTestId('sm-action-snapshot')).not.toHaveAttribute('data-busy')
    const drawer = await openNote('Simulated note')
    await waitFor(() => expect(screen.queryByTestId('sm-note-drawer')).not.toBeInTheDocument())
    expect(within(drawer).queryByTestId('sm-note-submit')?.getAttribute('data-busy') ?? null).toBeNull()

    // Past the reveal time nothing turns pending either (LIVE_PENDING_REVEAL_MS is 420 ms).
    await new Promise((resolve) => setTimeout(resolve, 600))
    for (const id of ['sm-action-marker', 'sm-action-snapshot']) {
      expect(screen.getByTestId(id)).not.toHaveAttribute('data-pending')
      expect(screen.getByTestId(id)).not.toHaveAttribute('data-busy')
    }
    expect(screen.getAllByTestId('sm-shutter')).toHaveLength(1)
    expect(toastWith(S.addMarker.added.split('{{')[0]!)).toHaveLength(1)
    expect(toastWith(S.snapshot.captured)).toHaveLength(1)
    expect(toastWith(S.sessionNote.saved)).toHaveLength(1)
    expect(getMissingI18nKeys()).toEqual([])
  })
})
