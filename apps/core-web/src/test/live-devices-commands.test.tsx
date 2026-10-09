/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W70: settle sites B-7 and D-5 of Devices & Inputs — the kebab commands of a camera tile
// or an audio card (`features/devices/index.tsx`, `deviceCommand` → operation 48 `restartDevice`,
// 49 `testDeviceSignal`, 50 `identifyDevice`) — in Live mode on the contract-checked fake
// transport, and the same menu in Simulated mode as the control group (backend task
// 04_client_integration_spec §8.3 B-7, §8.4 D-5, §8.1 LB-1 to LB-10, §6.2, §3.2; gate CLG (b) of
// 02_plan §11).
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | B-7 success: one request to the operation of the command, the menu closed at the press, the toast after the answer (with the Core's delta applied, CL-16) | "B-7 success" |
// | B-7 refusal, AC-C-48: a 403 NOT_PERMITTED shows the denied toast naming the role, the control returns to idle | "B-7 refusal" |
// | B-7: 409 RECORDING_ACTIVE and COMMAND_UNSUPPORTED keep the existing friendly toast and one record in the page's own log | "B-7 refusal" |
// | B-7 outage, LB-6 / CL-22: the presenter's sentence, no success toast; with the link down no request and one toast for five presses | "B-7 outage" |
// | LB-10: a 429 is a limit, not an outage | "B-7 outage" |
// | D-5: the local blink starts in `ok`, never before the answer and never on a refusal | "D-5 identify" |
// | LB-1: busy at once (the device's commands disabled, a second press sends nothing, the tile head `aria-busy`), spinner late | "LB-1 pending" |
// | §3.2: no "simulated" word on the Live menu or its toasts; Simulated mode keeps its words and its synchronous timing | "B-7 success", "Simulated mode is unchanged" |
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthSessionInfo } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { LiveLinkState } from '@dems/shared/live'
import { rateLimited, refusal, type FakeCommandOptions } from '@dems/shared/live/testing'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  OPERATOR_IDS,
  OPERATORS,
  ROLE_PERMISSIONS,
  type ScenarioName,
  type Sim,
} from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createAppRouter } from '@/router'
import { webErrorSink } from '@/runtime'
import { createLiveTestBed, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'

// The page is a lazily loaded chunk with a camera feed and an SVG display: under load the first import can take a while.
configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 25_000 })

const RINA = OPERATORS.find((operator) => operator.id === OPERATOR_IDS.RINA)!
/** The seeded TECHNICIAN: the one role that holds DEVICE_MANAGE, so Restart is enabled (D152 ruling 4). */
const TECHNICIAN_SESSION: Pick<AuthSessionInfo, 'operator' | 'permissions'> = {
  operator: {
    id: RINA.id,
    username: RINA.username,
    rank: RINA.rank,
    name: RINA.name,
    displayName: RINA.displayName,
    initials: RINA.initials,
    role: RINA.role,
  },
  permissions: [...ROLE_PERMISSIONS.TECHNICIAN],
}

const L = en.devices.live
// Task 3, decision D100 (2) (blueprint row 137; C3 §3 op 48; OD-22): on a Core server a CAMERA's Restart is
// the confirmed PoE cycle. The kebab asks for the confirmation, then sends operation 48 with
// `{ confirm: true }`; its toast is the cycle's. Every other rule of this file (LB-1, LB-5, LB-6, LB-10,
// CL-22) is proven on that same path.
const RESTARTED = (name: string) => en.devices.selector.poe.requested.replace('{{name}}', name)
const TEST_SENT = (name: string) => L.actions.testSignalSent.replace('{{name}}', name)
const IDENTIFYING = (name: string) => en.devices.actions.identifying.replace('{{name}}', name)
const FAILED = en.devices.actions.failed
const DENIED = en.common.rbac.deniedTitle
const REQUIRES = (role: string) => en.common.rbac.requiresRole.replace('{{role}}', role)
const OFFLINE = en.common.coreErrors.offline
const PAGE_SOURCE = 'features/devices.run'

const originalMatchMedia = window.matchMedia
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

/** A signed-in operator on Devices & Inputs in Live mode, with the four kebabs on screen. */
async function liveDevices(session: Pick<AuthSessionInfo, 'operator' | 'permissions'> = TECHNICIAN_SESSION): Promise<{ bed: LiveTestBed; page: LivePage }> {
  const created = createLiveTestBed({ session })
  bed = created
  const page = await created.load()
  await created.mount(page, '/devices')
  await screen.findByTestId('page-devices')
  await screen.findByTestId('device-menu-MIC-02')
  return { bed: created, page }
}

const trigger = (deviceId: string) => screen.getByTestId(`device-menu-${deviceId}`)
/** The head of the tile or card: it carries `aria-busy` while a command is out (the kit's Button drops it, F63-2). */
const head = (deviceId: string) => trigger(deviceId).closest('.dev-tile-head') as HTMLElement
async function openMenu(deviceId: string): Promise<HTMLElement> {
  fireEvent.click(trigger(deviceId))
  return screen.findByRole('menu')
}
/** Opens the kebab and presses one of its items, by the start of its accessible name. */
async function press(deviceId: string, item: RegExp): Promise<void> {
  const menu = await openMenu(deviceId)
  fireEvent.click(within(menu).getByRole('menuitem', { name: item }))
}
/** Live mode, a camera: Restart from the kebab, then the confirmation of the PoE cycle (D100 (2)). */
async function pressRestart(deviceId: string): Promise<void> {
  await press(deviceId, /^Restart/)
  fireEvent.click(await screen.findByTestId('camera-restart-confirm'))
}
const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)
const pageRecords = () => webErrorSink.records().filter((record) => record.source === PAGE_SOURCE)
/** The served cameras with one camera offline: the effect a restart has on the Core. */
const camerasWith = (deviceId: string, online: boolean) =>
  JSON.parse(JSON.stringify(bed!.core.served.cameras.map((camera) => (camera.deviceId === deviceId ? { ...camera, online } : camera))))

// jsdom implements neither media playback nor a 2D canvas, nor Web Animations (the kit's Tabs indicator).
const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
  HTMLMediaElement.prototype.play = (() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = (() => undefined) as unknown as HTMLMediaElement['pause']
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
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
})

afterEach(async () => {
  cleanup()
  await clearToasts()
  bed?.dispose()
  bed = undefined
  vi.restoreAllMocks()
})

describe('B-7 success (§8.3; LB-3; §3.2)', () => {
  it('Restart: one POST to operation 48 for the tile\'s device, the menu closes at the press, the toast follows the answer and says nothing of a simulation', async () => {
    const { bed } = await liveDevices()
    // CL-16: the delta of the answer's revision holds the effect; the toast must see it.
    const command = bed.fake.scriptCommand('restartDevice', {
      ops: [{ op: 'replace', slice: 'cameras', value: camerasWith('CAM-01', false) }] as FakeCommandOptions['ops'],
      order: 'delta-first',
    })
    expect(screen.getByTestId('camera-tile-VIDEO-01')).toHaveAttribute('data-status', 'READY')
    const menu = await openMenu('CAM-01')
    // §3.2: the Live labels carry no "(simulated)".
    expect(within(menu).getByRole('menuitem', { name: /^Restart/ })).toHaveTextContent(L.menu.restart)
    expect(within(menu).getByRole('menuitem', { name: /^Test signal/ })).toHaveTextContent(L.menu.testSignal)
    expect(menu.textContent ?? '').not.toMatch(/simulat/i)
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^Restart/ }))
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    // D100 (2): nothing is sent until the operator confirmed the PoE cycle.
    const confirm = await screen.findByTestId('camera-restart-confirm')
    expect(requests('restartDevice')).toHaveLength(0)
    fireEvent.click(confirm)

    await waitFor(() => expect(toastWith(RESTARTED('Camera 1'))).toHaveLength(1))
    expect(command.deltaSent).toBe(true)
    expect(requests('restartDevice')).toHaveLength(1)
    expect(requests('restartDevice')[0]).toMatchObject({ method: 'POST', path: '/api/v1/device/CAM-01/restart', params: { id: 'CAM-01' }, body: { confirm: true } })
    expect(requests('testDeviceSignal')).toHaveLength(0)
    expect(requests('identifyDevice')).toHaveLength(0)
    // The tile shows the Core's state of the device: the delta was applied before the toast (CL-16).
    expect(screen.getByTestId('camera-tile-VIDEO-01')).toHaveAttribute('data-status', 'FAULT')
    expect(toastTexts().join(' ')).not.toMatch(/simulat/i)
    expect(head('CAM-01')).not.toHaveAttribute('aria-busy')
    expect(pageRecords()).toHaveLength(0)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('Test signal: one POST to operation 49 for the microphone\'s device and its own toast', async () => {
    const { bed } = await liveDevices()
    bed.fake.answerFromExample('testDeviceSignal')
    await press('MIC-01', /^Test signal/)
    await waitFor(() => expect(toastWith(TEST_SENT('MIC 1'))).toHaveLength(1))
    expect(requests('testDeviceSignal')).toHaveLength(1)
    expect(requests('testDeviceSignal')[0]).toMatchObject({ method: 'POST', path: '/api/v1/device/MIC-01/test-signal' })
    expect(requests('restartDevice')).toHaveLength(0)
    expect(toastTexts().join(' ')).not.toMatch(/simulat/i)
  })
})

describe('B-7 refusal (§6.2; AC-C-48; LB-5)', () => {
  it('AC-C-48: a 403 NOT_PERMITTED (the contract\'s `notPermitted` example) shows the denied toast naming the Technician role, no success toast, and the control returns to idle', async () => {
    const { bed } = await liveDevices()
    bed.fake.answerOnce('restartDevice', bed.fake.example('restartDevice', 403, 'notPermitted'))
    const danger = vi.spyOn(toast, 'danger')
    await pressRestart('CAM-02')

    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(DENIED)[0]).toContain(REQUIRES(en.common.roles.TECHNICIAN))
    expect(danger).toHaveBeenCalledTimes(1)
    expect(toastWith(RESTARTED('Camera 2'))).toHaveLength(0)
    expect(toastWith(FAILED)).toHaveLength(0)
    expect(head('CAM-02')).not.toHaveAttribute('aria-busy')
    const menu = await openMenu('CAM-02')
    expect(within(menu).getByRole('menuitem', { name: /^Restart/ })).not.toHaveAttribute('aria-disabled', 'true')
    // The presenter worded it: no record of the page's own (the Live source reports the rejection itself, CL-24).
    expect(pageRecords()).toHaveLength(0)
    expect(requests('restartDevice')).toHaveLength(1)
  })

  it('a 403 NOT_PERMITTED of operation 49 names the first role that holds DIAGNOSTICS_RUN (RESIDUAL-W70-2, W83 ledger #46: no `notPermitted` example)', async () => {
    const { bed } = await liveDevices()
    bed.fake.answerOnce('testDeviceSignal', refusal(403, 'NOT_PERMITTED', 'Not permitted.', { permission: 'DIAGNOSTICS_RUN' }))
    await press('MIC-02', /^Test signal/)
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(DENIED)[0]).toContain(REQUIRES(en.common.roles.INVESTIGATOR))
    expect(toastWith(TEST_SENT('MIC 2'))).toHaveLength(0)
    expect(head('MIC-02')).not.toHaveAttribute('aria-busy')
  })

  it('409 RECORDING_ACTIVE (rebuilt as `SimTransitionError`) keeps the existing friendly toast and writes one record with code and status only', async () => {
    const { bed } = await liveDevices()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    bed.fake.answerOnce('restartDevice', bed.fake.example('restartDevice', 409, 'recordingActive'))
    await pressRestart('CAM-02')
    await waitFor(() => expect(toastWith(FAILED)).toHaveLength(1))
    expect(toastWith(DENIED)).toHaveLength(0)
    expect(toastWith(OFFLINE)).toHaveLength(0)
    expect(toastWith(RESTARTED('Camera 2'))).toHaveLength(0)
    const records = pageRecords()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ level: 'error', message: 'A device command of Devices & Inputs was not carried out.' })
    expect(records[0]?.context).toMatchObject({ deviceId: 'CAM-02', command: 'POE_CYCLE', errorName: 'SimTransitionError', code: 'RECORDING_ACTIVE' })
    expect(String(records[0]?.context?.correlationId)).toMatch(/^dev-/)
    // Rule M14: neither the server's text nor a stack reaches the record.
    expect(JSON.stringify(records[0])).not.toContain('Restart is unavailable while recording')
    expect(records[0]?.stack).toBeUndefined()
    expect(head('CAM-02')).not.toHaveAttribute('aria-busy')
  })

  it('409 COMMAND_UNSUPPORTED of operation 49 keeps the same friendly toast', async () => {
    const { bed } = await liveDevices()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    bed.fake.answerOnce('testDeviceSignal', bed.fake.example('testDeviceSignal', 409, 'commandUnsupported'))
    await press('MIC-01', /^Test signal/)
    await waitFor(() => expect(toastWith(FAILED)).toHaveLength(1))
    expect(pageRecords()[0]?.context).toMatchObject({ command: 'TEST_SIGNAL', code: 'COMMAND_UNSUPPORTED' })
  })
})

describe('B-7 outage (LB-6, CL-22; LB-10)', () => {
  it('a request that gets no answer shows "Core server unreachable. Nothing was changed.", no success toast, and the control returns to idle', async () => {
    const { bed } = await liveDevices()
    bed.fake.failOnce('restartDevice')
    await pressRestart('CAM-01')
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(toastWith(RESTARTED('Camera 1'))).toHaveLength(0)
    expect(toastWith(FAILED)).toHaveLength(0)
    expect(requests('restartDevice')).toHaveLength(1)
    expect(head('CAM-01')).not.toHaveAttribute('aria-busy')
    expect(pageRecords()).toHaveLength(0)
  })

  it('with the link down a command is refused at once without a request, and five presses show one toast', async () => {
    const { bed, page } = await liveDevices()
    bed.core.unreachable()
    await bed.flush()
    expect(page.live.link).toBe(LiveLinkState.OFFLINE)
    for (let pressNumber = 0; pressNumber < 5; pressNumber += 1) {
      await pressRestart('CAM-01')
      await bed.flush()
    }
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(requests('restartDevice')).toHaveLength(0)
    expect(toastWith(RESTARTED('Camera 1'))).toHaveLength(0)
    expect(head('CAM-01')).not.toHaveAttribute('aria-busy')
  })

  it('LB-10: a 429 shows the limit toast with the seconds of `retry-after`, never the outage sentence', async () => {
    const { bed, page } = await liveDevices()
    bed.fake.answerOnce('testDeviceSignal', rateLimited(12))
    await press('MIC-01', /^Test signal/)
    await waitFor(() => expect(toastWith(en.common.coreErrors.limited.replace('{{seconds}}', '12'))).toHaveLength(1))
    expect(toastWith(OFFLINE)).toHaveLength(0)
    expect(toastWith(FAILED)).toHaveLength(0)
    expect(page.live.link).toBe(LiveLinkState.ONLINE)
    expect(screen.getByTestId('shell-mode')).not.toHaveTextContent(/OFFLINE/)
  })
})

describe('D-5 identify (§8.4: the local state is set in `ok`)', () => {
  it('the ring blinks only after the Core answered operation 50, with the info toast', async () => {
    const { bed } = await liveDevices()
    const held = bed.fake.hold('identifyDevice')
    await press('CAM-01', /^Identify/)
    await waitFor(() => expect(requests('identifyDevice')).toHaveLength(1))
    await bed.flush()
    // Before the answer: no blink, no toast.
    expect(screen.queryByTestId('identify-CAM-01')).not.toBeInTheDocument()
    expect(toastWith(IDENTIFYING('Camera 1'))).toHaveLength(0)
    expect(requests('identifyDevice')[0]).toMatchObject({ method: 'POST', path: '/api/v1/device/CAM-01/identify' })

    await act(async () => {
      held.release()
    })
    await bed.flush()
    await waitFor(() => expect(screen.getByTestId('identify-CAM-01')).toBeInTheDocument())
    await waitFor(() => expect(toastWith(IDENTIFYING('Camera 1'))).toHaveLength(1))
    expect(head('CAM-01')).not.toHaveAttribute('aria-busy')
  })

  it('a 403 NOT_PERMITTED of operation 50 (envelope without `details.permission`: the access rule names DIAGNOSTICS_RUN) shows the denied toast and no blink', async () => {
    const { bed } = await liveDevices()
    bed.fake.answerOnce('identifyDevice', refusal(403, 'NOT_PERMITTED', 'Not permitted.'))
    await press('MIC-01', /^Identify/)
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(DENIED)[0]).toContain(REQUIRES(en.common.roles.INVESTIGATOR))
    expect(screen.queryByTestId('identify-MIC-01')).not.toBeInTheDocument()
    expect(toastWith(IDENTIFYING('MIC 1'))).toHaveLength(0)
    expect(head('MIC-01')).not.toHaveAttribute('aria-busy')
  })

  it('an outage shows the presenter\'s sentence and no blink', async () => {
    const { bed } = await liveDevices()
    bed.fake.failOnce('identifyDevice')
    await press('CAM-02', /^Identify/)
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(screen.queryByTestId('identify-CAM-02')).not.toBeInTheDocument()
    expect(toastWith(IDENTIFYING('Camera 2'))).toHaveLength(0)
  })
})

describe('LB-1 pending (busy at once, spinner late)', () => {
  it('while a command is out the device\'s three commands are disabled, a second press sends nothing, the head is busy, and the spinner replaces the icon only after LIVE_PENDING_REVEAL_MS', async () => {
    const { bed } = await liveDevices()
    const held = bed.fake.hold('restartDevice')
    await pressRestart('CAM-01')
    await waitFor(() => expect(requests('restartDevice')).toHaveLength(1))
    await bed.flush()
    // Busy at once, same look: no spinner yet.
    expect(head('CAM-01')).toHaveAttribute('aria-busy', 'true')
    expect(trigger('CAM-01')).not.toHaveAttribute('data-pending')
    // Only the device that sent the command is busy.
    expect(head('CAM-02')).not.toHaveAttribute('aria-busy')
    const tile = screen.getByTestId('camera-tile-VIDEO-01')
    const elementsBefore = tile.querySelectorAll('*').length

    const menu = await openMenu('CAM-01')
    for (const item of [/^Restart/, /^Test signal/, /^Identify/]) {
      expect(within(menu).getByRole('menuitem', { name: item })).toHaveAttribute('aria-disabled', 'true')
    }
    expect(within(menu).getByRole('menuitem', { name: /^Details/ })).not.toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^Identify/ }))
    fireEvent.keyDown(menu, { key: 'Escape' })
    await bed.flush()
    expect(requests('restartDevice')).toHaveLength(1)
    expect(requests('identifyDevice')).toHaveLength(0)

    // Spinner late: after the reveal time (real timers; the motion policy's time scale is 1 here).
    await waitFor(() => expect(trigger('CAM-01')).toHaveAttribute('data-pending', 'true'), { timeout: 3_000 })
    expect(trigger('CAM-01').querySelector('svg.lucide-ellipsis-vertical')).toBeNull()
    expect(toastWith(RESTARTED('Camera 1'))).toHaveLength(0)

    await act(async () => {
      held.release()
    })
    await bed.flush()
    await waitFor(() => expect(toastWith(RESTARTED('Camera 1'))).toHaveLength(1))
    expect(head('CAM-01')).not.toHaveAttribute('aria-busy')
    expect(trigger('CAM-01')).not.toHaveAttribute('data-pending')
    expect(trigger('CAM-01').querySelector('svg.lucide-ellipsis-vertical')).not.toBeNull()
    // Nothing was added to the tile while the command was out (the spinner took the icon's place).
    expect(tile.querySelectorAll('*').length).toBe(elementsBefore)
    expect(requests('restartDevice')).toHaveLength(1)
  })

  it('a command answered within LIVE_PENDING_REVEAL_MS never shows the spinner', async () => {
    const { bed } = await liveDevices()
    bed.fake.answerFromExample('testDeviceSignal')
    const seen: string[] = []
    const observer = new MutationObserver(() => {
      if (trigger('MIC-01').hasAttribute('data-pending')) seen.push('pending')
    })
    observer.observe(trigger('MIC-01'), { attributes: true })
    await press('MIC-01', /^Test signal/)
    await waitFor(() => expect(toastWith(TEST_SENT('MIC 1'))).toHaveLength(1))
    await new Promise((resolve) => setTimeout(resolve, 600))
    observer.disconnect()
    expect(seen).toEqual([])
    expect(head('MIC-01')).not.toHaveAttribute('aria-busy')
  })
})

// ── The control group: the same menu in Simulated mode, as it was before this row ─────────────

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

/** The simulator's fixed "now", so the dataset does not depend on the date. */
const DEMO_NOW = Date.parse('2026-10-01T10:00:00+07:00')
const sims: Sim[] = []

async function simulatedDevices(operatorId: string, scenario: ScenarioName = 'idle'): Promise<Sim> {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId, issuedAt: DEMO_NOW })
  const sim = createSim({
    clock: createManualClock(DEMO_NOW),
    scenario,
    storage: null,
    authStorage,
    visibility: ALWAYS_VISIBLE,
    scheduler: () => () => undefined,
  })
  sims.push(sim)
  const router = createAppRouter(
    { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket() },
    { history: createMemoryHistory({ initialEntries: ['/devices'] }) },
  )
  render(<RouterProvider router={router} />)
  await screen.findByTestId('page-devices')
  await screen.findByTestId('device-menu-MIC-02')
  return sim
}

describe('Simulated mode is unchanged (CLG (a); §3.2)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
  })
  afterEach(() => {
    for (const sim of sims.splice(0)) sim.stop()
    vi.unstubAllGlobals()
  })

  it('a TECHNICIAN sees the simulated words, and a restart shows its "(simulated)" toast at once, with the simulator\'s audit row and no busy mark', async () => {
    const sim = await simulatedDevices(OPERATOR_IDS.RINA)
    const menu = await openMenu('CAM-01')
    expect(within(menu).getByRole('menuitem', { name: /^Restart/ })).toHaveTextContent(en.common.deviceMenu.restart)
    expect(within(menu).getByRole('menuitem', { name: /^Test signal/ })).toHaveTextContent(en.common.deviceMenu.testSignal)
    const before = sim.store.getState().audit.rows.length
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^Restart/ }))
    // Synchronous: the simulator applied the command in the press.
    expect(sim.store.getState().audit.rows.length).toBe(before + 1)
    expect(sim.store.getState().audit.rows.at(-1)?.type).toBe('DEVICE_COMMAND')
    await waitFor(() => expect(toastWith(en.devices.actions.restarted.replace('{{name}}', 'Camera 1'))).toHaveLength(1))
    expect(head('CAM-01')).not.toHaveAttribute('aria-busy')
    expect(trigger('CAM-01')).not.toHaveAttribute('data-pending')
    expect(pageRecords()).toHaveLength(0)
  })

  it('Identify blinks in the press, as before', async () => {
    await simulatedDevices(OPERATOR_IDS.RINA)
    await press('MIC-02', /^Identify/)
    // No answer to wait for: the ring is there after the press.
    expect(screen.getByTestId('identify-MIC-02')).toBeInTheDocument()
    await waitFor(() => expect(toastWith(IDENTIFYING('MIC 2'))).toHaveLength(1))
  })

  it('while recording, Restart stays disabled with its reason, as before', async () => {
    await simulatedDevices(OPERATOR_IDS.RINA, 'recording')
    // The menu disables Restart while recording; the simulator's refusal is what a forced press meets.
    const menu = await openMenu('CAM-02')
    expect(within(menu).getByRole('menuitem', { name: /^Restart/ })).toHaveAttribute('aria-disabled', 'true')
    expect(within(menu).getByRole('menuitem', { name: /^Restart/ })).toHaveTextContent(en.devices.actions.restartWhileRecording)
  })
})
