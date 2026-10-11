/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W63: the Dashboard page in Live mode — what it shows comes from the Core server's
// replica, and nothing on it claims a simulation (backend task 04_client_integration_spec §3.2,
// §7.3 group G5; 01_specs §11 MS-1) — and the static rules of its folder (gate CLG (c) of 02_plan
// §11; AC-C-53). Site B-7 itself is proven in `live-dashboard-devices.test.tsx`.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | G5: the ten panels render on the Live source's replica, with the Core's values, and follow a delta | "the page on the Core's data" |
// | §3.2: a Live screen says nothing of a simulation; the sealed hash that is not the package's says "NO MEDIA PACKAGE" | "the page on the Core's data", "the sealed hash" |
// | Simulated mode keeps "SIMULATED" after the hash (pure rule) | "the sealed hash" |
// | CLG (c), AC-C-53: no production file of the folder imports `useSimActions` or reads `.actions` of a `Sim`; the one action is called through `settle` | "static rules of the folder" |
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { cleanup, configure, render, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { expectScanCovers } from './static-scan'
import { en } from '@dems/shared/i18n'
import { CoreMode } from '@dems/shared/live'
import type { FakeCommandOptions } from '@dems/shared/live/testing'
import { SessionState } from '@dems/shared/domain'
import { buildScenarioState, DEFAULT_SEED, scenarioRng, tickMachine, type SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { PanelBoundary } from '@/features/dashboard/panel-boundary'
import { manifestSuffixKey } from '@/features/dashboard/sim-adapter'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'

// The panels are a lazily loaded chunk: under load the first import can take longer than the library's second.
configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 25_000 })

const PANELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const

const originalMatchMedia = window.matchMedia
/** Empties the kit's toast queue, which is one per page and outlives a test (F76-9). */
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}

/** Every word of the page a person or a screen reader meets: its text and its accessible names. */
function pageWords(): string {
  const labels = Array.from(document.body.querySelectorAll('[aria-label], [title], [alt]')).map((element) =>
    ['aria-label', 'title', 'alt'].map((name) => element.getAttribute(name) ?? '').join(' '),
  )
  return `${document.body.textContent ?? ''} ${labels.join(' ')}`
}

let bed: LiveTestBed | undefined

/** The SUPERVISOR on the Dashboard in Live mode, with `served` as the Core's state. */
async function liveDashboard(serve?: (idle: SimState) => SimState): Promise<{ bed: LiveTestBed; page: LivePage }> {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  if (serve) created.core.served = serve(created.core.served)
  const page = await created.load()
  await created.mount(page, '/dashboard')
  await screen.findByTestId('page-dashboard')
  for (const id of PANELS) await screen.findByTestId(`panel-${id}`)
  return { bed: created, page }
}

/** The finalizing scenario, run on the Core's own machine until its session is sealed. */
function sealedOnTheCore(idle: SimState): SimState {
  const rng = scenarioRng(DEFAULT_SEED, 'finalizing')
  let state = buildScenarioState('finalizing', idle)
  const start = idle.clock.now
  for (let at = start + 250; state.session?.state !== SessionState.SEALED && at < start + 120_000; at += 250) state = tickMachine(state, at, rng)
  if (state.session?.state !== SessionState.SEALED) throw new Error('the scenario did not reach SEALED')
  return state
}

/**
 * The same, with the sealed item as the Core holds a session recorded on it: no media, no package,
 * `integritySource: SIMULATED` (01_specs §11, the last row of the media table). The scenario's own
 * item is aligned to the demo package.
 */
function sealedWithoutPackage(idle: SimState): SimState {
  const state = sealedOnTheCore(idle)
  const evidenceId = state.session?.evidenceId
  return { ...state, evidence: state.evidence.map((item) => (item.id === evidenceId ? { ...item, integritySource: 'SIMULATED' as const } : item)) }
}

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
  bed?.dispose()
  bed = undefined
  vi.restoreAllMocks()
})

describe('the page on the Core\'s data (G5; §3.2)', () => {
  it('renders the ten panels on the Live source with the Core\'s recording session, the shell says LIVE, and no word of the page says "simulated"', async () => {
    const { bed } = await liveDashboard((idle) => buildScenarioState('recording', idle))
    const served = bed.core.served
    expect(served.session?.state).toBe(SessionState.RECORDING)
    // Panel D and the hero show the Core's session, not one of a simulator in the browser.
    expect(await screen.findByTestId('session-recording')).toBeInTheDocument()
    expect(screen.getByTestId('session-session')).toHaveTextContent(served.session!.id)
    expect(screen.getByTestId('session-case')).toHaveTextContent(served.session!.input.caseNumber)
    expect(screen.getByTestId('hero-copy')).toHaveAttribute('data-copy', 'recording')
    // Panel E: one tile per camera and microphone of the Core.
    for (const tile of ['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02']) expect(screen.getByTestId(`device-tile-${tile}`)).toBeInTheDocument()
    expect(screen.getByTestId('shell-mode')).toHaveTextContent('LIVE')
    await waitFor(() => expect(within(screen.getByTestId('panel-i')).getAllByTestId('recent-event').length).toBeGreaterThan(0))
    expect(pageWords()).not.toMatch(/simulat/i)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('follows a delta of the Core: a camera that goes offline turns its tile and the status strip', async () => {
    const { bed, page } = await liveDashboard()
    const strip = await screen.findByTestId('strip-cameras')
    await waitFor(() => expect(strip).toHaveTextContent(en.dashboard.statusStrip.value.ready))
    const cameras = JSON.parse(JSON.stringify(bed.core.served.cameras.map((camera) => (camera.deviceId === 'CAM-02' ? { ...camera, online: false } : camera))))
    page.sockets.at(-1)!.delta([{ op: 'replace', slice: 'cameras', value: cameras }] as FakeCommandOptions['ops'])
    await bed.flush()
    await waitFor(() => expect(screen.getByTestId('tile-state-CAM-02')).toHaveTextContent(en.common.status.noSignal))
    expect(screen.getByTestId('strip-cameras')).toHaveTextContent('1 of 2 online')
    expect(screen.getByTestId('tile-state-CAM-01')).not.toHaveTextContent(en.common.status.noSignal)
  })
})

describe('the sealed hash (§3.2; 01_specs §11)', () => {
  it('an item of the evidence package: the hash has no suffix in Live mode either', async () => {
    const { bed } = await liveDashboard(sealedOnTheCore)
    const evidenceId = bed.core.served.session!.evidenceId!
    expect(bed.core.served.evidence.find((entry) => entry.id === evidenceId)?.integritySource).toBe('DEMO_PACKAGE')
    const sealed = await screen.findByTestId('session-sealed')
    const manifest = within(sealed).getByTestId('sealed-manifest')
    expect(manifest).toHaveAttribute('data-source', 'package')
    expect(manifest.parentElement?.querySelector('dt')?.textContent).toBe(en.dashboard.activeSession.sealed.manifestHash)
    expect(pageWords()).not.toMatch(/simulat/i)
  })

  it('a session the Core sealed has no media package: the hash says "NO MEDIA PACKAGE", never "SIMULATED"', async () => {
    const { bed } = await liveDashboard(sealedWithoutPackage)
    const evidenceId = bed.core.served.session!.evidenceId!
    const item = bed.core.served.evidence.find((entry) => entry.id === evidenceId)
    expect(item?.integritySource).toBe('SIMULATED')
    const sealed = await screen.findByTestId('session-sealed')
    const manifest = within(sealed).getByTestId('sealed-manifest')
    expect(manifest).toHaveAttribute('data-source', 'simulated')
    const term = manifest.parentElement?.querySelector('dt')
    expect(term).toHaveTextContent(`${en.dashboard.activeSession.sealed.manifestHash} · ${en.dashboard.activeSession.sealed.noPackage}`)
    expect(sealed).not.toHaveTextContent(en.common.simulated.chip)
    expect(within(sealed).getByText(evidenceId)).toBeInTheDocument()
    expect(pageWords()).not.toMatch(/simulat/i)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the rule: no suffix for a package digest or a pending item in either mode; "SIMULATED" in Simulated mode as before', () => {
    expect(manifestSuffixKey('simulated', CoreMode.SIMULATED)).toBe('common.simulated.chip')
    expect(manifestSuffixKey('simulated', CoreMode.LIVE)).toBe('dashboard.activeSession.sealed.noPackage')
    for (const mode of [CoreMode.SIMULATED, CoreMode.LIVE]) {
      expect(manifestSuffixKey('package', mode)).toBeNull()
      expect(manifestSuffixKey('pending', mode)).toBeNull()
    }
  })

  it('the Live words of the folder say nothing of a simulation; the Simulated words keep theirs', () => {
    for (const text of Object.values(en.dashboard.devices.live)) expect(text).not.toMatch(/simulat/i)
    expect(en.dashboard.activeSession.sealed.noPackage).not.toMatch(/simulat/i)
    expect(en.dashboard.devices.restartSent).toBe('{{name}} restart requested (simulated)')
    expect(en.dashboard.devices.testSignalSent).toBe('Test signal sent to {{name}} (simulated)')
    expect(en.common.deviceMenu.restart).toBe('Restart (simulated)')
  })
})

describe('static rules of the folder (CLG (c); AC-C-53; MD-6)', () => {
  // `import.meta.dirname` (Node, through Vitest): jsdom replaces the global `URL`, so no file URL is built here.
  const folder = resolve(import.meta.dirname, '../features/dashboard')
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
    expectScanCovers({ scanned: production.map((file) => file.name), listed: import.meta.glob('../features/dashboard/**/*.{ts,tsx}'), root: '../features/dashboard' })
  })

  it('AC-C-53: no file imports `useSimActions` or reads `.actions` of a `Sim`; the device command comes from `useCoreActions()` and runs inside `settle`', () => {
    // The i18n keys `common.actions.*` are words, not a read of a data source: they are left out.
    const withoutActionWords = (text: string) => code(text).replace(/common\.actions\.[A-Za-z]+/g, '')
    for (const { name, text } of production) {
      expect(text, name).not.toMatch(/useSimActions/)
      expect(withoutActionWords(text), name).not.toMatch(/\.actions\b/)
      expect(code(text), name).not.toMatch(/\bSimContext\b|live\.source/)
    }
    const panel = code(production.find((file) => file.name === 'devices-panel.tsx')?.text ?? '')
    expect(panel).toMatch(/useCoreActions\(\)/)
    expect(panel.match(/actions\.deviceCommand\(/g)).toHaveLength(1)
    expect(panel.match(/settle\(\(\) => actions\.deviceCommand\(/g)).toHaveLength(1)
    // Rule 2 of the page rows: the presenter speaks first.
    expect(panel).toMatch(/if \(presentCoreError\(error\) !== null\) return/)
  })

  it('MD-6, TS-15: no file loads the typed client or the Live source, builds a client, opens a socket or imports a test double', () => {
    for (const { name, text } of production) {
      const source = code(text)
      expect(source, name).not.toMatch(/from '@dems\/shared\/(client|live\/source|live\/testing)'/)
      expect(source, name).not.toMatch(/createCoreClient|createLiveSim|runtime\/(testing|live-start|boot)|new WebSocket/)
    }
  })

  it('error logging: no failure is written to the console directly; the page\'s own record goes to the sink by a fixed sentence', () => {
    for (const { name, text } of production) expect(code(text), name).not.toMatch(/console\.(error|warn|log)/)
    const report = code(production.find((file) => file.name === 'report.ts')?.text ?? '')
    expect(report).toMatch(/webErrorSink/)
    // CPW1-8: never the text of the error as the message.
    expect(report).not.toMatch(/message:\s*error|error\.message|\.stack/)
  })

  it('a panel that throws while rendering shows its fallback and writes one record, without the text of the error', () => {
    // React reports the caught error to the console itself; that is React's, not the page's.
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    webErrorSink.clear()
    function Broken(): never {
      throw new Error('a text that may hold input')
    }
    render(
      <PanelBoundary panel="e">
        <Broken />
      </PanelBoundary>,
    )
    expect(screen.getByTestId('dashboard-panel-fallback')).toBeInTheDocument()
    const records = webErrorSink.records().filter((record) => record.source === 'features/dashboard.panel-e')
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ level: 'error', message: 'A Dashboard panel failed to render and shows its fallback.' })
    expect(records[0]?.context).toMatchObject({ panel: 'e', attempt: 0, errorName: 'Error' })
    expect(JSON.stringify(records[0])).not.toContain('a text that may hold input')
  })
})
