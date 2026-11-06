/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W63: settle site B-7 of the Dashboard — the device command of a tile's kebab
// (`features/dashboard/devices-panel.tsx`, `deviceCommand` → operation 48 `restartDevice` or 49
// `testDeviceSignal`) — in Live mode on the contract-checked fake transport, and the same menu in
// Simulated mode as the control group (backend task 04_client_integration_spec §8.3 B-7, §8.1
// LB-1 to LB-10, §6.2; gate CLG (b) of 02_plan §11).
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | B-7 success: one request to the operation of the command, the success toast after the answer, the menu closed at the press | "B-7 success" |
// | B-7 refusal, AC-C-48: a 403 NOT_PERMITTED shows the denied toast that names the role, and the control returns to idle | "B-7 refusal" |
// | B-7: 409 RECORDING_ACTIVE / COMMAND_UNSUPPORTED keep the existing friendly toast and one record in the page's own log | "B-7 refusal" |
// | B-7 outage, LB-6 / CL-22: an outage shows the presenter's sentence, no success toast; with the link down no request is sent | "B-7 outage" |
// | LB-10: a 429 is a limit, not an outage | "B-7 outage" |
// | LB-1: busy at once (a second press sends nothing), spinner late | "B-7 pending" |
// | §3.2: no "simulated" word on the Live menu or its toasts; Simulated mode keeps its words and its synchronous timing | "B-7 success", "Simulated mode is unchanged" |
// | Ruling R3 (D201; E-fix FX-W, E2E-W1-2 = E2E-W2-1): Test signal follows DIAGNOSTICS_RUN (operation 49), Restart stays on DEVICE_MANAGE (operation 48), like the Devices page | "R3 gating" (Live), "Simulated mode is unchanged" |
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'

// The panels are a lazily loaded chunk: under load the first import can take longer than the library's second.
configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 25_000 })

const RINA = OPERATORS.find((operator) => operator.id === OPERATOR_IDS.RINA)!
/** The seeded TECHNICIAN: the one role that holds DEVICE_MANAGE (and DIAGNOSTICS_RUN), so the two commands are enabled. */
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

const W = en.dashboard.devices
// Integration pass D2 (D100 (2)): on a Core server "Restart" of a CAMERA tile is the confirmed PoE cycle
// (operation 48 with `{ confirm: true }`), so its success toast is the cycle's, as on the Devices page.
const LIVE_RESTART_SENT = (name: string) => en.devices.selector.poe.requested.replace('{{name}}', name)
/** The confirmation of a camera's power cycle (Live mode): the second press that sends the command. */
async function confirmCycle(): Promise<void> {
  fireEvent.click(await screen.findByTestId(/^dashboard-camera-restart-confirm-/))
}
const LIVE_TEST_SENT = (name: string) => W.live.testSignalSent.replace('{{name}}', name)
const DENIED = en.common.rbac.deniedTitle
const REQUIRES = (role: string) => en.common.rbac.requiresRole.replace('{{role}}', role)
const OFFLINE = en.common.coreErrors.offline

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

/** A signed-in operator on the Dashboard in Live mode, with panel E on screen. */
async function liveDashboard(session: Pick<AuthSessionInfo, 'operator' | 'permissions'> = TECHNICIAN_SESSION): Promise<{ bed: LiveTestBed; page: LivePage }> {
  const created = createLiveTestBed({ session })
  bed = created
  const page = await created.load()
  await created.mount(page, '/dashboard')
  await screen.findByTestId('panel-e')
  await screen.findByRole('button', { name: W.tileMenu.replace('{{name}}', 'Camera 1') })
  return { bed: created, page }
}

const trigger = (name: string) => screen.getByRole('button', { name: W.tileMenu.replace('{{name}}', name) })
/** The head of the tile: it carries `aria-busy` while a command is out (the kit's Button does not pass it on). */
const head = (name: string) => trigger(name).closest('.dems-tile-head') as HTMLElement
/** Opens the tile's kebab and returns the menu. */
async function openMenu(name: string): Promise<HTMLElement> {
  fireEvent.click(trigger(name))
  return screen.findByRole('menu')
}
/** Opens the kebab and presses one of its items, by the start of its accessible name. */
async function press(name: string, item: RegExp): Promise<void> {
  const menu = await openMenu(name)
  fireEvent.click(within(menu).getByRole('menuitem', { name: item }))
  // D100 (2): in Live mode (a bed is up) a camera's Restart sends nothing before the confirmation.
  if (bed !== undefined && name.startsWith('Camera') && item.source.includes('Restart')) await confirmCycle()
}
const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)
/** The served state's cameras with one camera changed: the effect a restart has on the Core. */
const camerasWith = (deviceId: string, online: boolean) =>
  JSON.parse(JSON.stringify(bed!.core.served.cameras.map((camera) => (camera.deviceId === deviceId ? { ...camera, online } : camera))))

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

describe('B-7 success (§8.3; LB-3)', () => {
  it('Restart: one POST to operation 48 for the tile\'s device, the menu closes at the press, the toast follows the answer and says nothing of a simulation', async () => {
    const { bed } = await liveDashboard()
    // CL-16: the delta of the answer's revision holds the effect; the toast must see it.
    const command = bed.fake.scriptCommand('restartDevice', {
      ops: [{ op: 'replace', slice: 'cameras', value: camerasWith('CAM-01', false) }] as FakeCommandOptions['ops'],
      order: 'delta-first',
    })
    const menu = await openMenu('Camera 1')
    // §3.2: the Live labels carry no "(simulated)".
    expect(within(menu).getByRole('menuitem', { name: /^Restart/ })).toHaveTextContent(W.live.restart)
    expect(within(menu).getByRole('menuitem', { name: /^Test signal/ })).toHaveTextContent(W.live.testSignal)
    expect(menu.textContent ?? '').not.toMatch(/simulat/i)
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^Restart/ }))
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    // D100 (2): nothing is sent before the confirmation; the dialog names the camera.
    const dialog = await screen.findByTestId('dashboard-camera-restart-dialog-CAM-01')
    expect(dialog).toHaveTextContent(en.devices.selector.poe.confirmTitle.replace('{{name}}', 'Camera 1'))
    expect(requests('restartDevice')).toHaveLength(0)
    await confirmCycle()

    await waitFor(() => expect(toastWith(LIVE_RESTART_SENT('Camera 1'))).toHaveLength(1))
    expect(command.deltaSent).toBe(true)
    expect(requests('restartDevice')).toHaveLength(1)
    expect(requests('restartDevice')[0]).toMatchObject({ method: 'POST', path: '/api/v1/device/CAM-01/restart', params: { id: 'CAM-01' }, body: { confirm: true } })
    expect(requests('testDeviceSignal')).toHaveLength(0)
    // The tile shows the Core's state of the device: the delta was applied before the toast (CL-16).
    expect(screen.getByTestId('tile-state-CAM-01')).toHaveTextContent(en.common.status.noSignal)
    expect(toastTexts().join(' ')).not.toMatch(/simulat/i)
    expect(head('Camera 1')).not.toHaveAttribute('aria-busy')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('Test signal: one POST to operation 49 for the microphone\'s device and its own toast', async () => {
    const { bed } = await liveDashboard()
    bed.fake.answerFromExample('testDeviceSignal')
    await press('MIC 1', /^Test signal/)
    await waitFor(() => expect(toastWith(LIVE_TEST_SENT('MIC 1'))).toHaveLength(1))
    expect(requests('testDeviceSignal')).toHaveLength(1)
    expect(requests('testDeviceSignal')[0]).toMatchObject({ method: 'POST', path: '/api/v1/device/MIC-01/test-signal' })
    expect(requests('restartDevice')).toHaveLength(0)
    expect(toastTexts().join(' ')).not.toMatch(/simulat/i)
  })
})

describe('B-7 refusal (§6.2; AC-C-48; LB-5)', () => {
  it('AC-C-48: a 403 NOT_PERMITTED (the contract\'s `notPermitted` example) shows the denied toast naming the Technician role, no success toast, and the control returns to idle', async () => {
    const { bed } = await liveDashboard()
    bed.fake.answerOnce('restartDevice', bed.fake.example('restartDevice', 403, 'notPermitted'))
    const danger = vi.spyOn(toast, 'danger')
    await press('Camera 1', /^Restart/)

    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(DENIED)[0]).toContain(REQUIRES(en.common.roles.TECHNICIAN))
    expect(danger).toHaveBeenCalledTimes(1)
    expect(toastWith(LIVE_RESTART_SENT('Camera 1'))).toHaveLength(0)
    expect(toastWith(W.commandFailed)).toHaveLength(0)
    // Idle again: not busy, and the menu offers the command again.
    expect(head('Camera 1')).not.toHaveAttribute('aria-busy')
    const menu = await openMenu('Camera 1')
    expect(within(menu).getByRole('menuitem', { name: /^Restart/ })).not.toHaveAttribute('aria-disabled', 'true')
    // The presenter worded it: the page wrote no record of its own (the Live source reports the rejection itself, CL-24).
    expect(webErrorSink.records().filter((record) => record.source === 'features/dashboard.DeviceMenu')).toHaveLength(0)
    expect(requests('restartDevice')).toHaveLength(1)
  })

  it('a 403 NOT_PERMITTED of operation 49 names the first role that holds DIAGNOSTICS_RUN', async () => {
    const { bed } = await liveDashboard()
    // RESIDUAL-W63-1 (W83 ledger #40): operation 49 has no `notPermitted` example (every seeded role holds the permission), so the envelope is written here.
    bed.fake.answerOnce('testDeviceSignal', refusal(403, 'NOT_PERMITTED', 'Not permitted.', { permission: 'DIAGNOSTICS_RUN' }))
    await press('MIC 2', /^Test signal/)
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(DENIED)[0]).toContain(REQUIRES(en.common.roles.INVESTIGATOR))
    expect(toastWith(LIVE_TEST_SENT('MIC 2'))).toHaveLength(0)
    expect(head('MIC 2')).not.toHaveAttribute('aria-busy')
  })

  it('409 RECORDING_ACTIVE (rebuilt as `SimTransitionError`) keeps the existing friendly toast and writes one record with code and status only', async () => {
    const { bed } = await liveDashboard()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    bed.fake.answerOnce('restartDevice', bed.fake.example('restartDevice', 409, 'recordingActive'))
    await press('Camera 2', /^Restart/)
    await waitFor(() => expect(toastWith(W.commandFailed)).toHaveLength(1))
    expect(toastWith(DENIED)).toHaveLength(0)
    expect(toastWith(OFFLINE)).toHaveLength(0)
    const records = webErrorSink.records().filter((record) => record.source === 'features/dashboard.DeviceMenu')
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ level: 'error', message: 'A device command of the Dashboard was not carried out.' })
    expect(records[0]?.context).toMatchObject({ deviceId: 'CAM-02', command: 'POE_CYCLE', errorName: 'SimTransitionError', code: 'RECORDING_ACTIVE' })
    expect(String(records[0]?.context?.correlationId)).toMatch(/^dash-/)
    expect(head('Camera 2')).not.toHaveAttribute('aria-busy')
  })

  it('409 COMMAND_UNSUPPORTED of operation 49 keeps the same friendly toast', async () => {
    const { bed } = await liveDashboard()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    bed.fake.answerOnce('testDeviceSignal', bed.fake.example('testDeviceSignal', 409, 'commandUnsupported'))
    await press('MIC 1', /^Test signal/)
    await waitFor(() => expect(toastWith(W.commandFailed)).toHaveLength(1))
    expect(webErrorSink.records().filter((record) => record.source === 'features/dashboard.DeviceMenu')[0]?.context).toMatchObject({ code: 'COMMAND_UNSUPPORTED' })
  })
})

describe('B-7 outage (LB-6, CL-22; LB-10)', () => {
  it('a request that gets no answer shows "Core server unreachable. Nothing was changed.", no success toast, and the control returns to idle', async () => {
    const { bed } = await liveDashboard()
    bed.fake.failOnce('restartDevice')
    await press('Camera 1', /^Restart/)
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(toastWith(LIVE_RESTART_SENT('Camera 1'))).toHaveLength(0)
    expect(toastWith(W.commandFailed)).toHaveLength(0)
    expect(requests('restartDevice')).toHaveLength(1)
    expect(head('Camera 1')).not.toHaveAttribute('aria-busy')
    expect(webErrorSink.records().filter((record) => record.source === 'features/dashboard.DeviceMenu')).toHaveLength(0)
  })

  it('with the link down a command is refused at once without a request, and five presses show one toast', async () => {
    const { bed, page } = await liveDashboard()
    bed.core.unreachable()
    await bed.flush()
    expect(page.live.link).toBe(LiveLinkState.OFFLINE)
    for (let pressNumber = 0; pressNumber < 5; pressNumber += 1) {
      await press('Camera 1', /^Restart/)
      await bed.flush()
    }
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(requests('restartDevice')).toHaveLength(0)
    expect(toastWith(LIVE_RESTART_SENT('Camera 1'))).toHaveLength(0)
    expect(head('Camera 1')).not.toHaveAttribute('aria-busy')
  })

  it('LB-10: a 429 shows the limit toast with the seconds of `retry-after`, never the outage sentence', async () => {
    const { bed, page } = await liveDashboard()
    bed.fake.answerOnce('restartDevice', rateLimited(12))
    await press('Camera 1', /^Restart/)
    await waitFor(() => expect(toastWith(en.common.coreErrors.limited.replace('{{seconds}}', '12'))).toHaveLength(1))
    expect(toastWith(OFFLINE)).toHaveLength(0)
    expect(toastWith(W.commandFailed)).toHaveLength(0)
    expect(page.live.link).toBe(LiveLinkState.ONLINE)
    expect(screen.getByTestId('shell-mode')).not.toHaveTextContent(/OFFLINE/)
  })
})

describe('B-7 pending (LB-1: busy at once, spinner late)', () => {
  it('while the command is out a second press sends nothing; the spinner replaces the icon only after LIVE_PENDING_REVEAL_MS; the toast follows the answer', async () => {
    const { bed } = await liveDashboard()
    const held = bed.fake.hold('restartDevice')
    await press('Camera 1', /^Restart/)
    await waitFor(() => expect(requests('restartDevice')).toHaveLength(1))
    await bed.flush()
    // Busy at once, same look: no spinner yet, and nothing was added beside the trigger.
    expect(head('Camera 1')).toHaveAttribute('aria-busy', 'true')
    expect(trigger('Camera 1')).not.toHaveAttribute('data-pending')
    const tile = screen.getByTestId('device-tile-VIDEO-01')
    const elementsBefore = tile.querySelectorAll('*').length
    expect(toastWith(LIVE_RESTART_SENT('Camera 1'))).toHaveLength(0)

    // A second press: both commands are disabled while the first is out.
    const menu = await openMenu('Camera 1')
    expect(within(menu).getByRole('menuitem', { name: /^Restart/ })).toHaveAttribute('aria-disabled', 'true')
    expect(within(menu).getByRole('menuitem', { name: /^Test signal/ })).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^Restart/ }))
    fireEvent.keyDown(menu, { key: 'Escape' })
    await bed.flush()
    expect(requests('restartDevice')).toHaveLength(1)

    // Spinner late: after the reveal time (real timers; the motion policy's time scale is 1 here).
    await waitFor(() => expect(trigger('Camera 1')).toHaveAttribute('data-pending', 'true'), { timeout: 3_000 })
    expect(trigger('Camera 1').querySelector('svg.lucide-ellipsis-vertical')).toBeNull()
    expect(within(tile).queryAllByRole('menu')).toHaveLength(0)

    await act(async () => {
      held.release()
    })
    await bed.flush()
    await waitFor(() => expect(toastWith(LIVE_RESTART_SENT('Camera 1'))).toHaveLength(1))
    expect(head('Camera 1')).not.toHaveAttribute('aria-busy')
    expect(trigger('Camera 1')).not.toHaveAttribute('data-pending')
    expect(tile.querySelectorAll('*').length).toBe(elementsBefore)
    expect(requests('restartDevice')).toHaveLength(1)
  })
})

describe('R3 gating (D201; E2E-W1-2 = E2E-W2-1): each command follows the permission the Core checks', () => {
  it('a SUPERVISOR (DIAGNOSTICS_RUN, no DEVICE_MANAGE) may send Test signal: the item is enabled with no role hint, one POST to operation 49, the Live toast', async () => {
    const { bed } = await liveDashboard(SUPERVISOR_SESSION)
    expect(SUPERVISOR_SESSION.permissions).toContain('DIAGNOSTICS_RUN')
    expect(SUPERVISOR_SESSION.permissions).not.toContain('DEVICE_MANAGE')
    bed.fake.answerFromExample('testDeviceSignal')
    const menu = await openMenu('Camera 1')
    const test = within(menu).getByRole('menuitem', { name: /^Test signal/ })
    expect(test).not.toHaveAttribute('aria-disabled', 'true')
    expect(test).not.toHaveTextContent(REQUIRES(en.common.roles.TECHNICIAN))
    expect(test.textContent).toBe(W.live.testSignal)
    // Restart keeps the Core's DEVICE_MANAGE: disabled, naming the Technician.
    const restart = within(menu).getByRole('menuitem', { name: /^Restart/ })
    expect(restart).toHaveAttribute('aria-disabled', 'true')
    expect(restart).toHaveTextContent(REQUIRES(en.common.roles.TECHNICIAN))
    fireEvent.click(test)
    await waitFor(() => expect(toastWith(LIVE_TEST_SENT('Camera 1'))).toHaveLength(1))
    expect(requests('testDeviceSignal')).toHaveLength(1)
    expect(requests('testDeviceSignal')[0]).toMatchObject({ method: 'POST', path: '/api/v1/device/CAM-01/test-signal' })
    expect(requests('restartDevice')).toHaveLength(0)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('while a Test signal is out both commands are disabled (LB-1 still holds for a role without DEVICE_MANAGE)', async () => {
    const { bed } = await liveDashboard(SUPERVISOR_SESSION)
    const held = bed.fake.hold('testDeviceSignal')
    await press('MIC 1', /^Test signal/)
    await waitFor(() => expect(requests('testDeviceSignal')).toHaveLength(1))
    await bed.flush()
    const menu = await openMenu('MIC 1')
    expect(within(menu).getByRole('menuitem', { name: /^Test signal/ })).toHaveAttribute('aria-disabled', 'true')
    expect(within(menu).getByRole('menuitem', { name: /^Restart/ })).toHaveAttribute('aria-disabled', 'true')
    fireEvent.keyDown(menu, { key: 'Escape' })
    await act(async () => {
      held.release()
    })
    await bed.flush()
    await waitFor(() => expect(toastWith(LIVE_TEST_SENT('MIC 1'))).toHaveLength(1))
    const again = await openMenu('MIC 1')
    expect(within(again).getByRole('menuitem', { name: /^Test signal/ })).not.toHaveAttribute('aria-disabled', 'true')
    expect(requests('testDeviceSignal')).toHaveLength(1)
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

/** The simulator's fixed "now" (as the folder's own test, so the dataset does not depend on the date). */
const DEMO_NOW = Date.parse('2026-10-01T10:00:00+07:00')
const sims: Sim[] = []

async function simulatedDashboard(operatorId: string, scenario: ScenarioName = 'idle'): Promise<Sim> {
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
    { history: createMemoryHistory({ initialEntries: ['/dashboard'] }) },
  )
  render(<RouterProvider router={router} />)
  await screen.findByTestId('panel-e')
  await screen.findByRole('button', { name: W.tileMenu.replace('{{name}}', 'Camera 1') })
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

  it('a TECHNICIAN sees the simulated words, and a restart shows its "(simulated)" toast at once, with the simulator\'s audit row', async () => {
    const sim = await simulatedDashboard(OPERATOR_IDS.RINA)
    const menu = await openMenu('Camera 1')
    expect(within(menu).getByRole('menuitem', { name: /^Restart/ })).toHaveTextContent(en.common.deviceMenu.restart)
    expect(within(menu).getByRole('menuitem', { name: /^Test signal/ })).toHaveTextContent(en.common.deviceMenu.testSignal)
    const before = sim.store.getState().audit.rows.length
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^Restart/ }))
    // Synchronous: the simulator applied the command in the press.
    expect(sim.store.getState().audit.rows.length).toBe(before + 1)
    expect(sim.store.getState().audit.rows.at(-1)?.type).toBe('DEVICE_COMMAND')
    await waitFor(() => expect(toastWith(W.restartSent.replace('{{name}}', 'Camera 1'))).toHaveLength(1))
    expect(head('Camera 1')).not.toHaveAttribute('aria-busy')
    expect(trigger('Camera 1')).not.toHaveAttribute('data-pending')
  })

  it('R3: an INVESTIGATOR (DIAGNOSTICS_RUN) may send Test signal, as on the Devices page; Restart stays disabled with the role that holds DEVICE_MANAGE', async () => {
    const sim = await simulatedDashboard(OPERATOR_IDS.BUDI)
    const menu = await openMenu('MIC 1')
    const restart = within(menu).getByRole('menuitem', { name: /^Restart/ })
    expect(restart).toHaveAttribute('aria-disabled', 'true')
    expect(restart).toHaveTextContent(REQUIRES(en.common.roles.TECHNICIAN))
    const test = within(menu).getByRole('menuitem', { name: /^Test signal/ })
    expect(test).not.toHaveAttribute('aria-disabled', 'true')
    expect(test).not.toHaveTextContent(REQUIRES(en.common.roles.TECHNICIAN))
    const before = sim.store.getState().audit.rows.length
    fireEvent.click(test)
    // The simulator grants TEST_SIGNAL on DIAGNOSTICS_RUN (`sim/maintenance.ts`): one DEVICE_COMMAND row, at once.
    expect(sim.store.getState().audit.rows.length).toBe(before + 1)
    expect(sim.store.getState().audit.rows.at(-1)).toMatchObject({ type: 'DEVICE_COMMAND', actorId: OPERATOR_IDS.BUDI })
    await waitFor(() => expect(toastWith(W.testSignalSent.replace('{{name}}', 'MIC 1'))).toHaveLength(1))
  })

  it('FXR-W W92-14 (by design; was "a restart while recording keeps the existing friendly toast"): while recording Restart is disabled with the Devices page\'s reason; a press sends nothing and says nothing', async () => {
    const sim = await simulatedDashboard(OPERATOR_IDS.RINA, 'recording')
    const menu = await openMenu('Camera 2')
    const restart = within(menu).getByRole('menuitem', { name: /^Restart/ })
    expect(restart).toHaveAttribute('aria-disabled', 'true')
    expect(restart).toHaveTextContent(en.devices.actions.restartWhileRecording)
    // Test signal is not a restart: it stays offered while recording.
    expect(within(menu).getByRole('menuitem', { name: /^Test signal/ })).not.toHaveAttribute('aria-disabled', 'true')
    const before = sim.store.getState().audit.rows.length
    fireEvent.click(restart)
    await act(async () => undefined)
    expect(sim.store.getState().audit.rows.length).toBe(before)
    expect(toastWith(W.commandFailed)).toHaveLength(0)
    expect(toastWith(W.restartSent.replace('{{name}}', 'Camera 2'))).toHaveLength(0)
  })
})
