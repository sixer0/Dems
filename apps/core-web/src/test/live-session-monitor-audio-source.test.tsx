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
// Audit row 157 (D5, S5 §6; AC-4.6 UI; D4, D30, D130): operation 81 is retired - the microphones are fixed by the
// camera-microphone pairing, the Core (row 149) and the simulator (row 150) answer `409 AUDIO_SOURCE_FIXED_BY_PAIRING`.
// The Live switch cases of row 72 (confirmed switch, refusals, Checking of the toggle) are REPLACED by the cases below.
//
// | Rule | Where it is proven here |
// |------|-------------------------|
// | A SUPERVISOR on a recording sees no switch control; the console never sends operation 81 | "row 157: no switch control" |
// | The audio-source band asks operation 82 once on mount (it stays a read) | "row 157: no switch control" |
// | With the link down there is still no control and no "Checking" toggle | "row 157: no switch control" |
// | Each half reads "Mic N (Camera N)", Pair 1 "Transcribed" (row 156 `micPairLabel`) | "row 157: the pair labels" |
// | `MIC_SILENT` warns, offers nothing and sends nothing (OD-11) | "the silence warning" |
import { act, cleanup, configure, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { ALWAYS_VISIBLE, createManualClock, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const A = en.session.audioSource
const PAIRS = en.devices.pairs
const SWITCHED_TOAST = A.switched.split('{{')[0]!
const RECORD = 'SessionMonitor.AudioPanel.switchAudioSource'
const TRACKS = ['AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04'] as const

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

/** Row 157: none of the retired switch surfaces is in the panel or on the page. */
function expectNoSwitchControl(audio: HTMLElement) {
  for (const id of ['sm-audio-switch', 'sm-audio-switch-reason', 'sm-audio-refusal', 'sm-audio-silent-switch', 'sm-audio-silent-reason']) {
    expect(within(audio).queryByTestId(id)).not.toBeInTheDocument()
  }
  expect(screen.queryByTestId('sm-audio-switch-dialog')).not.toBeInTheDocument()
  expect(audio.querySelector('[data-testid^="sm-audio-role-"], [data-testid^="sm-audio-channel-"]')).toBeNull()
  expect(within(audio).queryByRole('button', { name: /switch/i })).not.toBeInTheDocument()
}

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

describe('row 157: no switch control (AC-4.6 UI; op 81 retired, D130)', () => {
  it('a SUPERVISOR on a recording sees no toggle, no confirmation and no reason line; operation 81 is never sent; the band reads operation 82 once', async () => {
    const { bed, audio } = await liveMonitor()
    await waitFor(() => expect(requests('listAudioSourceIntervals')).toHaveLength(1))
    await waitFor(() => expect(audio.querySelector('.sm-audio-body')).toHaveAttribute('data-active-input', 'MIC-01'))
    expectNoSwitchControl(audio)
    await bed.flush()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(requests('switchAudioSource')).toHaveLength(0)
    expect(requests('listAudioSourceIntervals')).toHaveLength(1)
    expect(toastWith(SWITCHED_TOAST)).toHaveLength(0)
    expect(webErrorSink.records().filter((record) => record.source === RECORD)).toHaveLength(0)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('with the link down there is still no control (no "Checking" toggle) and nothing is sent', async () => {
    const { bed, audio } = await liveMonitor()
    await waitFor(() => expect(requests('listAudioSourceIntervals')).toHaveLength(1))
    await act(async () => {
      bed.core.unreachable()
    })
    await bed.flush()
    expectNoSwitchControl(audio)
    expect(within(audio).queryByText(A.checking)).not.toBeInTheDocument()
    expect(requests('switchAudioSource')).toHaveLength(0)
  })
})

describe('row 157: the pair labels (S5 §6; N-40)', () => {
  it('each half reads "Mic N (Camera N)" and Pair 1 alone says Transcribed', async () => {
    const { audio } = await liveMonitor()
    await waitFor(() => expect(within(audio).getByTestId('sm-audio-pair-AUDIO-01')).toBeInTheDocument())
    TRACKS.forEach((track, index) => {
      expect(within(audio).getByTestId(`sm-audio-pair-${track}`)).toHaveTextContent(PAIRS.micOfCamera.replaceAll('{{n}}', String(index + 1)))
      expect(audio.querySelector(`[data-channel="${track}"].sm-audio-half`)).toHaveAttribute('data-pair', String(index + 1))
    })
    expect(within(audio).getByTestId('sm-audio-transcribed-AUDIO-01')).toHaveTextContent(PAIRS.transcribed)
    expect(audio.querySelectorAll('[data-testid^="sm-audio-transcribed-"]')).toHaveLength(1)
    expect(audio.textContent ?? '').not.toContain(A.role.ACTIVE)
    expect(audio.textContent ?? '').not.toContain(A.role.STANDBY)
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('the silence warning (OD-11)', () => {
  it('shows the warning of the Core\'s state, offers nothing and sends no switch', async () => {
    const { bed, audio } = await liveMonitor((sim) => sim.actions.inject('MIC_SILENT'))
    const warning = await within(audio).findByTestId('sm-audio-silent')
    expect(warning).toHaveAttribute('data-input', 'MIC-01')
    expect(within(warning).queryByRole('button')).not.toBeInTheDocument()
    await bed.flush()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(requests('switchAudioSource')).toHaveLength(0)
    expectNoSwitchControl(audio)
  })
})
