/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Wave H, driver D (gate 70, finding G70-02, MAJOR; ruling D196: "the selector offers every
// registered microphone on both lines"). Before this the microphone section had only "Make
// primary", so `MIC-03` could be selected by API only. The new control is operation 78 of contract
// C3 in its PAIR-REPLACEMENT form (decision D133 (1)): two lines, each with a role, `deviceId ==
// inputId`.
//
// | Rule | Where it is proven |
// |------|--------------------|
// | Every registered microphone is offered for the PRIMARY and for the STANDBY line; a Save is ONE operation 78 with the two lines of the new pair | "Simulated mode", "Live mode" |
// | The simulator (the Core's own rules) takes the pair and writes its `CAPTURE_CONFIG_CHANGED` row with `operationId: updateCaptureConfig` | "Simulated mode" |
// | The same microphone on both lines is refused on the client: the option of the other line's microphone is disabled and says why | "Simulated mode" |
// | The controls keep the selector's gates: the role sentence, the lock sentence, disabled - never hidden | "Simulated mode: gates" |
// | Development wording in real capture: the option says "Development source", this Mac's microphone is named, and its limit sentence stands at the choice | "Live mode" |
// | A refusal of the Core is worded as the selector words it (409 locked, 422 development only, 422 not accepted) | "Live mode" |
// | A registered camera (`CAM-03`) can be put on EACH video track from the web (one camera on both tracks at once needs two profiles: a rule of the contract, so each track has its own case) | "cameras" |
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthSessionInfo } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { refusal, type FakeCommandOptions } from '@dems/shared/live/testing'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, OPERATORS, ROLE_PERMISSIONS, type ScenarioName, type Sim, type SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createAppRouter } from '@/router'
import { createLiveTestBed, type LiveTestBed } from '@/runtime/testing/live-harness'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const S = en.devices.selector
const M = en.devices.micLines
type Device = SimState['captureDevices']['devices'][number]

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

const sims: Sim[] = []
let bed: LiveTestBed | undefined

const withThird = (devices: readonly Device[], kind: 'CAMERA' | 'MIC', extra: Partial<Device> = {}): Device[] => {
  const like = devices.find((device) => device.kind === kind)!
  return [...devices, { ...like, id: kind === 'CAMERA' ? 'CAM-03' : 'MIC-03', model: kind === 'CAMERA' ? 'Added camera' : 'Added microphone', ...extra } as Device]
}

async function simSelector(scenario: ScenarioName, operatorId: string, kind: 'CAMERA' | 'MIC' = 'MIC') {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId, issuedAt: Date.now() })
  const sim = createSim({ scenario, storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  sim.store.setState({ captureDevices: { devices: withThird(sim.store.getState().captureDevices.devices, kind) } })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: ['/devices'] }) })
  render(<RouterProvider router={router} />)
  await screen.findByTestId('page-devices', undefined, { timeout: 8_000 })
  const panel = await screen.findByTestId('panel-selector')
  return { sim, panel }
}

function sessionOf(operatorId: string): Pick<AuthSessionInfo, 'operator' | 'permissions'> {
  const operator = OPERATORS.find((entry) => entry.id === operatorId)!
  return {
    operator: {
      id: operator.id,
      username: operator.username,
      rank: operator.rank,
      name: operator.name,
      displayName: operator.displayName,
      initials: operator.initials,
      role: operator.role,
    },
    permissions: [...ROLE_PERMISSIONS[operator.role]],
  }
}

/** A Live console on a Core in real capture: every device carries its class, MIC-03 is this Mac's microphone. */
async function liveSelector() {
  const created = createLiveTestBed({ session: sessionOf(OPERATOR_IDS.ANDI) })
  bed = created
  const devices = created.core.served.captureDevices.devices.map((device) => ({ ...device, adapter: 'FAKE', sourceClass: 'DEVELOPMENT' }) as Device)
  created.core.served.captureDevices = { devices: withThird(devices, 'MIC', { adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' } as Partial<Device>) }
  const page = await created.load()
  await created.mount(page, '/devices')
  await screen.findByTestId('page-devices')
  const panel = await screen.findByTestId('panel-selector')
  await within(panel).findByTestId('selector-ready')
  return { bed: created, panel }
}

const captureAudit = (sim: Sim) => sim.store.getState().audit.rows.filter((row) => row.type === 'CAPTURE_CONFIG_CHANGED')
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)
const trigger = (panel: HTMLElement, role: 'PRIMARY' | 'STANDBY') => within(within(panel).getByTestId(`selector-mic-source-${role}`)).getByRole('button')
const save = (panel: HTMLElement, role: 'PRIMARY' | 'STANDBY') => within(panel).getByTestId(`selector-mic-save-${role}`)
async function choose(panel: HTMLElement, role: 'PRIMARY' | 'STANDBY', name: RegExp) {
  fireEvent.click(trigger(panel, role))
  fireEvent.click(await screen.findByRole('option', { name }))
  await waitFor(() => expect(save(panel, role)).toBeEnabled())
}

const originalMatchMedia = window.matchMedia
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}

const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
  HTMLMediaElement.prototype.play = (() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = (() => undefined) as unknown as HTMLMediaElement['pause']
  Element.prototype.scrollTo ??= function scrollTo() {}
  window.scrollTo = (() => undefined) as typeof window.scrollTo
  Element.prototype.getAnimations ??= function getAnimations() {
    return []
  }
})
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
  HTMLMediaElement.prototype.play = originalPlay
  HTMLMediaElement.prototype.pause = originalPause
})
beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
})
afterEach(async () => {
  cleanup()
  await clearToasts()
  for (const sim of sims.splice(0)) sim.stop()
  bed?.dispose()
  bed = undefined
  vi.restoreAllMocks()
})

describe('G70-02 Simulated mode: every registered microphone on both lines (operation 78, pair replacement)', () => {
  it('PRIMARY line: MIC-03 is offered, a Save makes it the primary input beside the standby, and ONE audit row names operation 78', async () => {
    const { sim, panel } = await simSelector('idle', OPERATOR_IDS.ANDI)
    expect(within(panel).getByTestId('selector-mic-source-PRIMARY')).toHaveTextContent(M.label.PRIMARY)
    expect(within(panel).getByTestId('selector-mic-source-STANDBY')).toHaveTextContent(M.label.STANDBY)
    expect(save(panel, 'PRIMARY')).toBeDisabled()
    await choose(panel, 'PRIMARY', /MIC-03/)
    // Not optimistic: the line names the Core's input until the answer.
    expect(sim.store.getState().captureConfig.mics.map((mic) => mic.inputId)).toEqual(['MIC-01', 'MIC-02'])
    fireEvent.click(save(panel, 'PRIMARY'))
    await waitFor(() => expect(within(panel).getByTestId('selector-role-MIC-03')).toHaveTextContent(S.role.PRIMARY))
    expect(within(panel).getByTestId('selector-role-MIC-02')).toHaveTextContent(S.role.STANDBY)
    expect(within(panel).queryByTestId('selector-mic-MIC-01')).not.toBeInTheDocument()
    expect(sim.store.getState().captureConfig.mics).toEqual(
      expect.arrayContaining([expect.objectContaining({ inputId: 'MIC-03', deviceId: 'MIC-03', role: 'PRIMARY' }), expect.objectContaining({ inputId: 'MIC-02', deviceId: 'MIC-02', role: 'STANDBY' })]),
    )
    const rows = captureAudit(sim)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.details).toMatchObject({ operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', inputId: 'MIC-03', from: 'MIC-01', to: 'MIC-03' })
    await waitFor(() => expect(save(panel, 'PRIMARY')).toBeDisabled())
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('STANDBY line: MIC-03 becomes the standby input; the primary stays', async () => {
    const { sim, panel } = await simSelector('idle', OPERATOR_IDS.RINA)
    await choose(panel, 'STANDBY', /MIC-03/)
    fireEvent.click(save(panel, 'STANDBY'))
    await waitFor(() => expect(within(panel).getByTestId('selector-role-MIC-03')).toHaveTextContent(S.role.STANDBY))
    expect(within(panel).getByTestId('selector-role-MIC-01')).toHaveTextContent(S.role.PRIMARY)
    const rows = captureAudit(sim)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.details).toMatchObject({ operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', inputId: 'MIC-03', from: 'MIC-02', to: 'MIC-03' })
  })

  it('the same microphone on both lines is refused here: the other line\'s microphone is a disabled option that says why', async () => {
    const { sim, panel } = await simSelector('idle', OPERATOR_IDS.ANDI)
    fireEvent.click(trigger(panel, 'PRIMARY'))
    const taken = await screen.findByRole('option', { name: /MIC-02/ })
    expect(taken).toHaveAttribute('aria-disabled', 'true')
    expect(taken).toHaveTextContent(M.onOtherLine.STANDBY)
    expect(await screen.findByRole('option', { name: /MIC-03/ })).not.toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(taken)
    expect(save(panel, 'PRIMARY')).toBeDisabled()
    expect(captureAudit(sim)).toHaveLength(0)
  })
})

describe('G70-02 Simulated mode: gates of the new controls (OD-10)', () => {
  it('a role without CAPTURE_CONFIG sees both selects and Saves disabled with the role sentence, none hidden', async () => {
    const { sim, panel } = await simSelector('idle', OPERATOR_IDS.BUDI)
    const sentence = en.common.rbac.requiresRole.replace('{{role}}', 'SUPERVISOR or TECHNICIAN')
    for (const role of ['PRIMARY', 'STANDBY'] as const) {
      expect(trigger(panel, role)).toBeDisabled()
      expect(save(panel, role)).toBeDisabled()
    }
    for (const id of ['MIC-01', 'MIC-02']) {
      expect(within(panel).getByTestId(`selector-reason-${id}`)).toHaveTextContent(sentence)
      expect(within(panel).getByTestId(`selector-reason-${id}`)).toHaveAttribute('data-block', 'ROLE')
    }
    expect(captureAudit(sim)).toHaveLength(0)
  })

  it('with a session open both selects are disabled with the lock sentence', async () => {
    const { panel } = await simSelector('recording', OPERATOR_IDS.ANDI)
    for (const role of ['PRIMARY', 'STANDBY'] as const) expect(trigger(panel, role)).toBeDisabled()
    for (const id of ['MIC-01', 'MIC-02']) {
      expect(within(panel).getByTestId(`selector-reason-${id}`)).toHaveTextContent(S.locked)
      expect(within(panel).getByTestId(`selector-reason-${id}`)).toHaveAttribute('data-block', 'LOCKED')
    }
  })
})

describe('G70-02 Live mode (a Core in real capture): wording, the one request, refusals', () => {
  it('the option of this Mac\'s microphone says so and "Development source"; choosing it shows the limit sentence; Save is ONE operation 78 with the pair', async () => {
    const { bed: created, panel } = await liveSelector()
    fireEvent.click(trigger(panel, 'PRIMARY'))
    const option = await screen.findByRole('option', { name: /MIC-03/ })
    expect(option).toHaveTextContent(en.common.sourceClass.kind.localMicrophone)
    expect(option).toHaveTextContent(en.common.sourceClass.badge)
    fireEvent.click(option)
    await waitFor(() => expect(save(panel, 'PRIMARY')).toBeEnabled())
    expect(within(panel).getByTestId('source-limit-choice-PRIMARY')).toHaveTextContent(en.common.localSourceNotice.microphoneLimit)
    expect(requests('updateCaptureConfig')).toHaveLength(0)

    const served = clone(created.core.served.captureConfig)
    const next = {
      ...served,
      updatedAt: served.updatedAt + 1,
      mics: [
        { ...served.mics.find((mic) => mic.role === 'PRIMARY')!, inputId: 'MIC-03', deviceId: 'MIC-03' },
        served.mics.find((mic) => mic.role === 'STANDBY')!,
      ],
    }
    created.fake.scriptCommand('updateCaptureConfig', {
      ops: [{ op: 'replace', slice: 'captureConfig', value: next }] as FakeCommandOptions['ops'],
      order: 'answer-first',
      answer: { status: 200, body: next },
    })
    fireEvent.click(save(panel, 'PRIMARY'))
    await waitFor(() => expect(within(panel).getByTestId('selector-role-MIC-03')).toHaveTextContent(S.role.PRIMARY))
    expect(requests('updateCaptureConfig')).toHaveLength(1)
    expect(requests('updateCaptureConfig')[0]).toMatchObject({
      method: 'POST',
      path: '/api/v1/capture/config',
      body: {
        mics: [
          { inputId: 'MIC-03', deviceId: 'MIC-03', role: 'PRIMARY' },
          { inputId: 'MIC-02', deviceId: 'MIC-02', role: 'STANDBY' },
        ],
      },
    })
    expect(requests('setPrimaryMic')).toHaveLength(0)
    // The saved line carries the badge and the limit, as built.
    expect(within(panel).getByTestId('selector-badge-MIC-03')).toHaveTextContent(en.common.sourceClass.badge)
    expect(within(panel).getByTestId('source-limit-selector-MIC-03')).toHaveTextContent(en.common.localSourceNotice.microphoneLimit)
  })

  it('refusals keep the selector\'s words: 409 locked, 422 development only, another 422 "not accepted"; no line changes', async () => {
    const { bed: created, panel } = await liveSelector()
    const message = () => within(panel).findByTestId('selector-mic-message-STANDBY')
    await choose(panel, 'STANDBY', /MIC-03/)
    created.fake.answerOnce('updateCaptureConfig', created.fake.example('updateCaptureConfig', 409, 'locked'))
    fireEvent.click(save(panel, 'STANDBY'))
    expect(await message()).toHaveTextContent(S.locked)
    created.fake.answerOnce('updateCaptureConfig', refusal(422, 'INVALID_INPUT', 'Refused.', { in: 'body', reason: 'DEVELOPMENT_SOURCE_NOT_ALLOWED', deviceId: 'MIC-03' }))
    await waitFor(() => expect(save(panel, 'STANDBY')).toBeEnabled())
    fireEvent.click(save(panel, 'STANDBY'))
    await waitFor(async () => expect(await message()).toHaveTextContent(S.developmentOnly))
    created.fake.answerOnce('updateCaptureConfig', refusal(422, 'INVALID_INPUT'))
    await waitFor(() => expect(save(panel, 'STANDBY')).toBeEnabled())
    fireEvent.click(save(panel, 'STANDBY'))
    await waitFor(async () => expect(await message()).toHaveTextContent(S.invalid))
    expect(requests('updateCaptureConfig')).toHaveLength(3)
    expect(within(panel).getByTestId('selector-role-MIC-02')).toHaveTextContent(S.role.STANDBY)
    expect(within(panel).queryByTestId('selector-mic-MIC-03')).not.toBeInTheDocument()
  })
})

describe('cameras: a registered camera on EACH video track from the web (gate 70 did it live; pinned here)', () => {
  it.each([
    ['VIDEO-01', 'CAM-01'],
    ['VIDEO-02', 'CAM-02'],
  ] as const)('CAM-03 is saved on %s: one row of operation 79 for that track, the other track untouched', async (trackId, from) => {
    const { sim, panel } = await simSelector('idle', OPERATOR_IDS.ANDI, 'CAMERA')
    fireEvent.click(within(within(panel).getByTestId(`selector-source-${trackId}`)).getByRole('button'))
    fireEvent.click(await screen.findByRole('option', { name: /CAM-03/ }))
    const button = within(panel).getByTestId(`selector-save-${trackId}`)
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)
    await waitFor(() => expect(within(panel).getByTestId(`selector-camera-${trackId}`)).toHaveAttribute('data-device', 'CAM-03'))
    const other = trackId === 'VIDEO-01' ? 'VIDEO-02' : 'VIDEO-01'
    expect(within(panel).getByTestId(`selector-camera-${other}`)).toHaveAttribute('data-device', other === 'VIDEO-01' ? 'CAM-01' : 'CAM-02')
    expect(captureAudit(sim).map((row) => row.details)).toEqual([expect.objectContaining({ operationId: 'setCaptureCameraSource', trackId, from, to: 'CAM-03' })])
  })
})
