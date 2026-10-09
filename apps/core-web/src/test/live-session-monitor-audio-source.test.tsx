/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Task 3 M5, blueprint row 72: the mic switch of the Session Monitor in Live mode — operation 81
// `switchAudioSource` through `useCoreActions()` and operation 82 `listAudioSourceIntervals` through
// its query factory — on the real router and the real Live source over the contract-checked fake
// transport (masterplan/08_client_ux_spec.md §3 flow 2; masterplan/03_api_contract.md §2.2-§2.4).
// The Core's side is a simulator of the same scenario (the model of
// `live-session-monitor-actions.test.tsx`): the effect of a command is the session slice that
// simulator holds after the same action, sent as the delta of the command's revision (CL-16).
//
// NOT proven here: anything of the real Core. Operations 81 and 82 are not routed by the Core server
// yet (blueprint rows 66 and 71); see implementation/31_m5_web_mic.md "to wire".
//
// | Rule | Where it is proven here |
// |------|-------------------------|
// | A switch is confirmed, sent once, and the new active input is shown only when the Core reports it (no optimistic flip) | "a confirmed switch" |
// | The audio-source band asks operation 82 on mount and again after the Core reported the switch | "a confirmed switch" |
// | `409 AUDIO_SOURCE_CONFLICT`: the fixed sentence stays on the panel, the pair unchanged | "refusals" |
// | `403 NOT_PERMITTED`: the denied toast, no state change | "refusals" |
// | "Checking your permissions…" while the link is not up; never an instant enable (E-16; M4-PC-1 for G4) | "Checking" |
// | `MIC_SILENT` warns and sends nothing by itself (OD-11) | "the silence warning" |
import { act, cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { FakeCommandOptions } from '@dems/shared/live/testing'
import { ALWAYS_VISIBLE, createManualClock, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const A = en.session.audioSource
const DENIED = en.common.rbac.deniedTitle
const SWITCHED_TOAST = A.switched.split('{{')[0]!
const RECORD = 'SessionMonitor.AudioPanel.switchAudioSource'

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
const toastTexts = (): string[] => Array.from(document.querySelectorAll('[data-slot="toast"]')).map((element) => element.textContent ?? '')
const toastWith = (text: string) => toastTexts().filter((entry) => entry.includes(text))

let bed: LiveTestBed | undefined
let core: Sim | undefined
let loaded: LivePage | undefined

/** The Core's model: a simulator in the recording scenario, the SUPERVISOR of the session signed in. */
function coreModel(at: number): Sim {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: at })
  return createSim({
    scenario: 'recording',
    clock: createManualClock(at),
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

/** The SUPERVISOR (OPR-002) on `/session` in Live mode, a recording on screen; `prepare` changes what the Core holds first. */
async function liveMonitor(prepare?: (sim: Sim) => void): Promise<{ bed: LiveTestBed; page: LivePage; audio: HTMLElement }> {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  core = coreModel(created.fake.clock.now())
  prepare?.(core)
  created.core.served = core.store.getState()
  const page = await created.load()
  loaded = page
  await created.mount(page, '/session')
  await screen.findByTestId('page-session-monitor', {}, { timeout: 15_000 })
  await waitFor(() => expect(screen.getByTestId('page-session-monitor')).toHaveAttribute('data-phase', 'RECORDING'))
  return { bed: created, page, audio: screen.getByTestId('panel-O') }
}

const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)
const role = (inputId: string) => screen.getByTestId(`sm-audio-role-${inputId}`)

async function confirmSwitch(audio: HTMLElement): Promise<HTMLElement> {
  fireEvent.click(within(audio).getByTestId('sm-audio-switch'))
  const dialog = await screen.findByTestId('sm-audio-switch-dialog')
  fireEvent.click(within(dialog).getByTestId('sm-audio-switch-confirm'))
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
  const misuse = loaded?.sink.records().filter((record) => record.source === 'live.misuse') ?? []
  loaded = undefined
  cleanup()
  await clearToasts()
  bed?.dispose()
  bed = undefined
  core?.stop()
  core = undefined
  window.matchMedia = originalMatchMedia
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  expect(misuse.map((record) => `${record.level} ${record.message}`)).toEqual([])
})

describe('a confirmed switch (operation 81; ux §3.2 steps 2-4)', () => {
  it('is sent once on the confirm, shows the new active input only when the Core reports it, and re-reads the intervals then', async () => {
    const { bed, page, audio } = await liveMonitor()
    const sessionId = page.live.store.getState().session!.id
    // Resolved: the SUPERVISOR may switch; the band read operation 82 once on mount.
    await waitFor(() => expect(within(audio).getByTestId('sm-audio-switch')).not.toBeDisabled())
    await waitFor(() => expect(requests('listAudioSourceIntervals')).toHaveLength(1))
    expect(role('MIC-01')).toHaveAttribute('data-role', 'ACTIVE')
    expect(requests('switchAudioSource')).toHaveLength(0)

    // `answer-first`: the answer arrives, the action settles only when the delta of its revision does (CL-16).
    const command = bed.fake.scriptCommand('switchAudioSource', { ops: effect((sim) => sim.actions.switchAudioSource('MIC-02')), order: 'answer-first' })
    const dialog = await confirmSwitch(audio)
    await bed.fake.arrived()
    await bed.flush()
    expect(requests('switchAudioSource')).toHaveLength(1)
    expect(requests('switchAudioSource')[0]).toMatchObject({ method: 'POST', body: { inputId: 'MIC-02' } })
    expect(JSON.stringify(requests('switchAudioSource')[0])).toContain(sessionId)

    // The Core answered, its state has not arrived: nothing is flipped, the confirm is busy.
    expect(role('MIC-01')).toHaveAttribute('data-role', 'ACTIVE')
    expect(role('MIC-02')).toHaveAttribute('data-role', 'STANDBY')
    expect(toastWith(SWITCHED_TOAST)).toHaveLength(0)
    expect(within(dialog).getByTestId('sm-audio-switch-confirm')).toHaveAttribute('aria-busy', 'true')
    // A second press while the first is out sends nothing (LB-1).
    fireEvent.click(within(dialog).getByTestId('sm-audio-switch-confirm'))
    await bed.flush()
    expect(requests('switchAudioSource')).toHaveLength(1)

    command.sendDelta()
    await bed.flush()
    await waitFor(() => expect(role('MIC-02')).toHaveAttribute('data-role', 'ACTIVE'))
    expect(role('MIC-01')).toHaveAttribute('data-role', 'STANDBY')
    await waitFor(() => expect(toastWith(SWITCHED_TOAST)).toHaveLength(1))
    expect(toastWith(SWITCHED_TOAST)[0]).toContain('MIC 2')
    await waitFor(() => expect(screen.queryByTestId('sm-audio-switch-dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(within(audio).getByTestId('sm-audio-switch')).toHaveTextContent('Switch to MIC 1'))
    // The Core reported a switch: the intervals are asked again.
    await waitFor(() => expect(requests('listAudioSourceIntervals')).toHaveLength(2))
    expect(webErrorSink.records().filter((record) => record.source === RECORD)).toHaveLength(0)
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('refusals (ux §3.2 steps 5-6, §3.5)', () => {
  it('409 AUDIO_SOURCE_CONFLICT: the fixed sentence stays on the panel; the pair does not change; one record of the page', async () => {
    const { bed, audio } = await liveMonitor()
    await waitFor(() => expect(within(audio).getByTestId('sm-audio-switch')).not.toBeDisabled())
    bed.fake.answerOnce('switchAudioSource', bed.fake.example('switchAudioSource', 409, 'conflict'))
    await confirmSwitch(audio)
    const refusal = await within(audio).findByTestId('sm-audio-refusal')
    expect(refusal).toHaveAttribute('data-refusal', 'CONFLICT')
    expect(refusal).toHaveTextContent(A.refusal.CONFLICT)
    expect(role('MIC-01')).toHaveAttribute('data-role', 'ACTIVE')
    expect(toastWith(SWITCHED_TOAST)).toHaveLength(0)
    await waitFor(() => expect(screen.queryByTestId('sm-audio-switch-dialog')).not.toBeInTheDocument())
    const records = webErrorSink.records().filter((record) => record.source === RECORD)
    expect(records).toHaveLength(1)
    expect(records[0]!.context).toMatchObject({ refusal: 'CONFLICT', code: 'AUDIO_SOURCE_CONFLICT', status: 409, from: 'MIC-01', to: 'MIC-02' })
  })

  it('409 INVALID_STATE: "not recording" stays on the panel', async () => {
    const { bed, audio } = await liveMonitor()
    await waitFor(() => expect(within(audio).getByTestId('sm-audio-switch')).not.toBeDisabled())
    bed.fake.answerOnce('switchAudioSource', bed.fake.example('switchAudioSource', 409, 'invalidState'))
    await confirmSwitch(audio)
    expect(await within(audio).findByTestId('sm-audio-refusal')).toHaveAttribute('data-refusal', 'NOT_RECORDING')
    expect(role('MIC-01')).toHaveAttribute('data-role', 'ACTIVE')
  })

  it('403 NOT_PERMITTED: the denied toast, no state change, no success toast', async () => {
    const { bed, audio } = await liveMonitor()
    await waitFor(() => expect(within(audio).getByTestId('sm-audio-switch')).not.toBeDisabled())
    bed.fake.answerOnce('switchAudioSource', bed.fake.example('switchAudioSource', 403, 'notPermitted'))
    await confirmSwitch(audio)
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(role('MIC-01')).toHaveAttribute('data-role', 'ACTIVE')
    expect(toastWith(SWITCHED_TOAST)).toHaveLength(0)
    expect(within(audio).queryByTestId('sm-audio-refusal')).not.toBeInTheDocument()
  })
})

describe('Checking (E-16; G4)', () => {
  it('with the link down the toggle is disabled with "Checking your permissions…" and a press sends nothing', async () => {
    const { bed, audio } = await liveMonitor()
    await waitFor(() => expect(within(audio).getByTestId('sm-audio-switch')).not.toBeDisabled())
    await act(async () => {
      bed.core.unreachable()
    })
    await waitFor(() => expect(within(audio).getByTestId('sm-audio-switch')).toHaveAttribute('data-block', 'CHECKING'))
    expect(within(audio).getByTestId('sm-audio-switch')).toBeDisabled()
    expect(within(audio).getByTestId('sm-audio-switch-reason')).toHaveTextContent(A.checking)
    fireEvent.click(within(audio).getByTestId('sm-audio-switch'))
    expect(screen.queryByTestId('sm-audio-switch-dialog')).not.toBeInTheDocument()
    expect(requests('switchAudioSource')).toHaveLength(0)
  })
})

describe('the silence warning (OD-11)', () => {
  it('shows the warning of the Core\'s state and sends no switch by itself', async () => {
    const { bed, audio } = await liveMonitor((sim) => sim.actions.inject('MIC_SILENT'))
    const warning = await within(audio).findByTestId('sm-audio-silent')
    expect(warning).toHaveAttribute('data-input', 'MIC-01')
    expect(within(warning).getByTestId('sm-audio-silent-switch')).toBeInTheDocument()
    await bed.flush()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(requests('switchAudioSource')).toHaveLength(0)
    expect(role('MIC-01')).toHaveAttribute('data-role', 'ACTIVE')
  })
})
