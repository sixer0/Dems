/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W76: the Settings panel's command of B-10 (the live camera, operation 51), the console
// preferences and presentation mode of the System page (operation 68; §8.4 F, fire-and-forget), the
// effect that seeds the preferences (rule of gateway_check/08a §15: an effect-started command is
// RETURNED through `deferEffectStart`, proven under StrictMode), and the static rules of the folder
// (CLG (c), AC-C-53, MD-6, TS-15) — in Live mode on the contract-checked fake transport, with the
// Simulated control group.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | B-10 live camera: one POST with the camera; a refusal (422) keeps the generic toast and one record; an outage the presenter's | "B-10 the live camera" |
// | §8.4 F: a preference change is one POST to operation 68 with the changed key; a failed write is worded by the presenter | "F the console preferences" |
// | Live presentation mode is written to the Core only; the tab flag follows the server's value | "F the console preferences" |
// | StrictMode, Live: opening the page sends NO preference (the Core's slice is the record); Simulated: the stored choice is seeded ONCE, one task later | "StrictMode" |
// | CLG (c), AC-C-53: no `useSimActions`, no `.actions` read on a `Sim` in the folder's production files; no console; no heavy module | "static rules of the folder" |
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { StrictMode } from 'react'
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { expectScanCovers } from './static-scan'
import { en } from '@dems/shared/i18n'
import { type FakeCommandOptions } from '@dems/shared/live/testing'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createManualClock, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { PRESENTATION_MODE_STORAGE_KEY, resetPresentationModeForTests } from '@/lib/presentation-mode'
import { createAppRouter } from '@/router'
import { webErrorSink } from '@/runtime'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'
import { PREFS_STORAGE_KEY } from '@/features/system/sim-adapter'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const S = en.system.settings
const OFFLINE = en.common.coreErrors.offline
const GENERIC = en.system.errors.generic

const originalMatchMedia = window.matchMedia
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}
const toastTexts = (): string[] => Array.from(document.querySelectorAll('[data-slot="toast"]')).map((element) => element.textContent ?? '')
const toastWith = (text: string) => toastTexts().filter((entry) => entry.includes(text))

Element.prototype.scrollIntoView ??= function scrollIntoView() {}

let bed: LiveTestBed | undefined
const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)
const records = (source: string) => webErrorSink.records().filter((record) => record.source === source)

async function liveSystem(options: { strict?: boolean } = {}): Promise<{ bed: LiveTestBed; page: LivePage }> {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  const page = await created.load()
  await created.mount(page, '/system', { strict: options.strict === true })
  await screen.findByTestId('page-system')
  await screen.findByTestId('system-settings-device')
  return { bed: created, page }
}

/** Opens one item of the Settings accordion. */
function openItem(id: string): HTMLElement {
  const item = screen.getByTestId(`system-settings-${id}`)
  const trigger = within(item).getAllByRole('button')[0]!
  if (trigger.getAttribute('aria-expanded') !== 'true') fireEvent.click(trigger)
  return item
}

/** Picks the live camera by its option name. */
async function pickCamera(name: string): Promise<void> {
  const item = openItem('device')
  fireEvent.click(within(within(item).getByTestId('system-active-camera')).getByRole('button'))
  fireEvent.click(await screen.findByRole('option', { name }))
}

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  resetPresentationModeForTests()
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

describe('B-10 the live camera (settings-panel; operation 51)', () => {
  it('success: one POST with the chosen camera; the Select shows the Core\'s camera after the delta', async () => {
    const { bed } = await liveSystem()
    const served = bed.core.served
    const other = served.cameras.find((camera) => camera.id !== served.activeCameraId)!
    bed.fake.scriptCommand('setActiveCamera', {
      ops: [{ op: 'replace', slice: 'activeCameraId', value: other.id }] as FakeCommandOptions['ops'],
      order: 'delta-first',
      answer: { status: 204 },
    })
    await pickCamera(other.name)
    await waitFor(() => expect(requests('setActiveCamera')).toHaveLength(1))
    expect(requests('setActiveCamera')[0]).toMatchObject({ method: 'POST', body: { cameraId: other.id } })
    await waitFor(() => expect(screen.getByTestId('system-active-camera')).toHaveTextContent(other.name))
    expect(toastWith(GENERIC)).toHaveLength(0)
  })

  it('a refusal the presenter leaves to the page (422): the generic toast and one record, with code and status only', async () => {
    const { bed } = await liveSystem()
    const served = bed.core.served
    const other = served.cameras.find((camera) => camera.id !== served.activeCameraId)!
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    bed.fake.answerOnce('setActiveCamera', bed.fake.example('setActiveCamera', 422, 'invalidInput'))
    await pickCamera(other.name)
    await waitFor(() => expect(toastWith(GENERIC)).toHaveLength(1))
    const kept = records('System.Settings.activeCamera')
    expect(kept).toHaveLength(1)
    // The Core's 422 is rebuilt as the simulator's class (CL-20): the record names it by class and code, never by its text.
    expect(kept[0]).toMatchObject({ message: 'System: the step "Settings.activeCamera" did not complete.' })
    expect(kept[0]?.context).toMatchObject({ cameraId: other.id, errorName: 'SimTransitionError' })
    expect(JSON.stringify(kept[0])).not.toContain(String((bed.fake.example('setActiveCamera', 422, 'invalidInput').body as { error: { message: string } }).error.message))
    expect(String(kept[0]?.context?.correlationId)).toMatch(/^sys-/)
  })

  it('an outage: the presenter\'s sentence; the Select keeps the Core\'s camera', async () => {
    const { bed } = await liveSystem()
    const served = bed.core.served
    const active = served.cameras.find((camera) => camera.id === served.activeCameraId)!
    const other = served.cameras.find((camera) => camera.id !== served.activeCameraId)!
    bed.fake.failOnce('setActiveCamera')
    await pickCamera(other.name)
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(screen.getByTestId('system-active-camera')).toHaveTextContent(active.name)
  })
})

describe('F the console preferences and presentation mode (operation 68; §8.4 F)', () => {
  it('a change of the clock format is one POST with that key; nothing else is sent', async () => {
    const { bed } = await liveSystem()
    bed.fake.answer('updateSettings', (call) => ({ status: 200, body: { ...bed.core.served.settings, ...(call.body as object) } }))
    const item = openItem('app')
    fireEvent.click(within(item).getByRole('radio', { name: S.timeFormat12 }))
    await waitFor(() => expect(requests('updateSettings')).toHaveLength(1))
    expect(requests('updateSettings')[0]).toMatchObject({ method: 'POST', path: '/api/v1/settings', body: { timeFormat: '12' } })
  })

  it('a failed write is worded by the presenter (outage)', async () => {
    const { bed } = await liveSystem()
    bed.fake.failOnce('updateSettings')
    const item = openItem('app')
    fireEvent.click(within(item).getByRole('radio', { name: S.timeFormat12 }))
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
  })

  it('Live presentation mode goes to the Core only; the tab flag follows the server\'s value when its delta arrives', async () => {
    const { bed } = await liveSystem()
    const command = bed.fake.scriptCommand('updateSettings', {
      ops: [{ op: 'replace', slice: 'settings', value: { ...bed.core.served.settings, presentationMode: true } }] as FakeCommandOptions['ops'],
      order: 'answer-first',
      answer: { status: 200, body: { ...bed.core.served.settings, presentationMode: true } },
    })
    openItem('app')
    fireEvent.click(within(screen.getByTestId('system-presentation-mode')).getByRole('switch'))
    await waitFor(() => expect(requests('updateSettings')).toHaveLength(1))
    expect(requests('updateSettings')[0]).toMatchObject({ body: { presentationMode: true } })
    await bed.flush()
    // Not written by the page itself: the Core has not said so yet.
    expect(window.sessionStorage.getItem(PRESENTATION_MODE_STORAGE_KEY)).not.toBe('1')
    await act(async () => {
      command.sendDelta()
    })
    await bed.flush()
    await waitFor(() => expect(window.sessionStorage.getItem(PRESENTATION_MODE_STORAGE_KEY)).toBe('1'))
    expect(within(screen.getByTestId('system-presentation-mode')).getByRole('switch')).toBeChecked()
  })
})

describe('StrictMode (gateway_check/08a §15; F69-1)', () => {
  it('Live: opening the page under StrictMode with a stored choice sends NO preference: the Core\'s slice is the record', async () => {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ timeFormat: '12', notifyWarnings: false, notifySound: true }))
    const { bed } = await liveSystem({ strict: true })
    await bed.elapse(1_000)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    await bed.flush()
    expect(requests('updateSettings')).toHaveLength(0)
    expect(getMissingI18nKeys()).toEqual([])
  })
})

// ── The control group: Simulated mode under StrictMode ────────────────────────────────────────

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

describe('Simulated mode is unchanged', () => {
  const sims: Sim[] = []
  afterEach(() => {
    for (const sim of sims.splice(0)) sim.stop()
  })

  it('StrictMode: the stored choice is seeded into the simulator ONCE (one task later), and the panel shows it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ timeFormat: '12', notifyWarnings: false, notifySound: true }))
    const clock = createManualClock(Date.now())
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: clock.now() })
    const sim = createSim({ storage: null, authStorage, clock, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined, scenario: 'idle' })
    sims.push(sim)
    const update = vi.spyOn(sim.actions, 'updateSettings')
    const router = createAppRouter(
      { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket() },
      { history: createMemoryHistory({ initialEntries: ['/system'] }) },
    )
    render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    )
    await screen.findByTestId('page-system')
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update).toHaveBeenCalledWith({ timeFormat: '12', notifyWarnings: false, notifySound: true })
    expect(sim.store.getState().settings.timeFormat).toBe('12')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(update).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})

describe('static rules of the folder (CLG (c); AC-C-53; MD-6; TS-15)', () => {
  // `import.meta.dirname` (Node, through Vitest): jsdom replaces the global `URL`, so no file URL is built here.
  const folder = resolve(import.meta.dirname, '../features/system')
  const walk = (directory: string): string[] =>
    readdirSync(directory).flatMap((name) => {
      const path = join(directory, name)
      if (statSync(path).isDirectory()) return name === '__tests__' ? [] : walk(path)
      return /\.tsx?$/.test(name) ? [path] : []
    })
  const production = walk(folder).map((path) => ({ name: relative(folder, path), text: readFileSync(path, 'utf8') }))
  /** The code of a file without its comments: a rule is about what runs. */
  const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('reads the files it means to read', () => {
    // Rule R1 (`static-scan.ts`): the scan equals an independent listing of the folder and is not empty.
    expectScanCovers({ scanned: production.map((file) => file.name), listed: import.meta.glob('../features/system/**/*.{ts,tsx}'), root: '../features/system' })
  })

  it('AC-C-53: no file imports `useSimActions` or reads `.actions` of a `Sim`; actions come from `useCoreActions()`', () => {
    const withoutActionWords = (text: string) => code(text).replace(/common\.actions\.[A-Za-z]+/g, '')
    for (const { name, text } of production) {
      expect(text, name).not.toMatch(/useSimActions/)
      expect(withoutActionWords(text), name).not.toMatch(/\.actions\b/)
      expect(code(text), name).not.toMatch(/\bSimContext\b|live\.source/)
    }
    const users = production.filter((file) => /useCoreActions\(\)/.test(code(file.text))).map((file) => file.name)
    expect(users).toEqual(expect.arrayContaining(['demo-panel.tsx', 'diagnostics.tsx', 'export-logs-dialog.tsx', 'settings-panel.tsx', 'sim-adapter.ts', 'update-panel.tsx', 'use-sim-command.ts']))
  })

  it('MD-6, TS-15: no file loads the typed client or the Live source, builds a client, opens a socket or imports a test double', () => {
    for (const { name, text } of production) {
      const source = code(text)
      expect(source, name).not.toMatch(/from '@dems\/shared\/(client|live\/source|live\/testing)'/)
      expect(source, name).not.toMatch(/createCoreClient|createLiveSim|runtime\/(testing|live-start|boot)|new WebSocket/)
    }
  })

  it('error logging: no console call; the page\'s record goes through `createPageReporter(\'sys\')` with a fixed sentence', () => {
    for (const { name, text } of production) expect(code(text), name).not.toMatch(/console\.(error|warn|log)/)
    const log = code(production.find((file) => file.name === 'log.ts')?.text ?? '')
    expect(log).toMatch(/createPageReporter\('sys'\)/)
    expect(log).not.toMatch(/error\.message|\.stack|import\.meta\.env\.DEV/)
  })

  it('rule 2: every command failure goes to the presenter before the page\'s own branch; the reveal time is the shared hook\'s', () => {
    const wrapper = code(production.find((file) => file.name === 'use-sim-command.ts')?.text ?? '')
    expect(wrapper).toMatch(/if \(presentCoreError\(error\) !== null\) return/)
    for (const { name, text } of production) expect(code(text), name).not.toMatch(/LIVE_PENDING_REVEAL_MS/)
  })

  it('the preference seed is the folder\'s one effect-started command, and it is RETURNED through `deferEffectStart` (the guard\'s `ALLOWED` entry for this file is no longer needed)', () => {
    const adapter = code(production.find((file) => file.name === 'sim-adapter.ts')?.text ?? '')
    expect(adapter).toMatch(/return deferEffectStart\(\(\) => \{\s*if \(seeded\.current\) return\s*seeded\.current = true/)
    expect(adapter).toMatch(/if \(live \|\| seeded\.current\) return undefined/)
  })

  it('the Live words of the folder say nothing of a simulation; the Simulated words keep theirs', () => {
    const live = JSON.stringify(en.system.live)
    expect(live).not.toMatch(/simulat/i)
    expect(en.system.maintenance.restartDone).toBe('Core services restarted (simulated)')
    expect(en.system.update.install).toBe('Install update (simulated)')
  })
})
