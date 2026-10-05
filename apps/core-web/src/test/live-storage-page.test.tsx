/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W71: the Storage page in Live mode — what it shows comes from the Core server's replica,
// and nothing on it claims a simulation (backend task 04_client_integration_spec §3.2, §7.3 group
// G13) — and the static rules of its folder (gate CLG (c) of 02_plan §11; AC-C-53), and the page's
// own error record (CPW1-8). Site B-9 itself is proven in `live-storage-policy.test.tsx`.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | G13: the panels render on the Live source's replica with the Core's values, and follow a delta | "the page on the Core's data" |
// | §3.2: a Live screen says nothing of a simulation; the SMART footnote says the Core reports none (CONTRACT-GAP-W71-1) | "the page on the Core's data" |
// | The page reads no storage operation of its own: the replica is the source | "the page on the Core's data" |
// | An outage: the page keeps the last data and shows no notice of its own (§21.2 of row W54) | "an outage" |
// | CLG (c), AC-C-53: no production file imports `useSimActions` or reads `.actions` of a `Sim`; the one action runs through `settle` | "static rules of the folder" |
// | Error logging: the page's own record goes to the sink by a fixed sentence, without the error's text | "static rules of the folder", "the page's own record" |
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { cleanup, configure, render, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { FakeCommandOptions } from '@dems/shared/live/testing'
import type { SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { logStorageError } from '@/features/storage/log'
import { StoragePanelBoundary } from '@/features/storage/panel'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { REDUCED_MOTION_MEDIA_QUERY } from '@/motion'
import { webErrorSink, type ErrorRecord } from '@/runtime'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'

// The page is a lazily loaded chunk: under load the first import can take longer than the library's second.
configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 25_000 })

const S = en.storage
const PANELS = ['capacity', 'kpis', 'usage', 'sealed', 'volumes', 'activity', 'calculator', 'policy'] as const

const originalMatchMedia = window.matchMedia
/** Reduced motion, as the folder's own tests run the page: numbers land on their value without a spring. */
function stubReducedMotion() {
  window.matchMedia = ((query: string) =>
    ({
      matches: query === REDUCED_MOTION_MEDIA_QUERY,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia
}
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

/** Every word of the page a person or a screen reader meets: its text and its accessible names. */
function pageWords(): string {
  const labels = Array.from(document.body.querySelectorAll('[aria-label], [title], [alt]')).map((element) =>
    ['aria-label', 'title', 'alt'].map((name) => element.getAttribute(name) ?? '').join(' '),
  )
  return `${document.body.textContent ?? ''} ${labels.join(' ')}`
}

let bed: LiveTestBed | undefined

/** The SUPERVISOR on the Storage page in Live mode, with `serve` applied to the Core's state. */
async function liveStorage(serve?: (idle: SimState) => SimState): Promise<{ bed: LiveTestBed; page: LivePage }> {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  if (serve) created.core.served = serve(created.core.served)
  const page = await created.load()
  await created.mount(page, '/storage')
  await screen.findByTestId('page-storage')
  for (const id of PANELS) await screen.findByTestId(`storage-panel-${id}`)
  return { bed: created, page }
}

/** The evidence volume at `percent` used, with the state the Core's engine gives that fill. */
function evidenceAt(state: SimState, percent: number, level: SimState['storage']['state']): SimState {
  const volumes = state.storage.volumes.map((volume) =>
    volume.kind === 'EVIDENCE' ? { ...volume, usedBytes: Math.round((volume.totalBytes * percent) / 100) } : volume,
  )
  return { ...state, storage: { ...state.storage, volumes, state: level } }
}

/** A Core whose state no simulator in a browser would show at load: LOW, kept until case closure, no auto-archive, a hot drive bay. */
function distinctCore(idle: SimState): SimState {
  const state = evidenceAt(idle, 90, 'LOW')
  return {
    ...state,
    storagePolicy: { retentionPolicy: 'CASE_CLOSURE', retentionDays: 3_650, autoArchive: false },
  }
}

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  stubReducedMotion()
})

afterEach(async () => {
  cleanup()
  window.matchMedia = originalMatchMedia
  await clearToasts()
  bed?.dispose()
  bed = undefined
  vi.restoreAllMocks()
})

describe('the page on the Core\'s data (G13; §3.2)', () => {
  it('renders every panel on the Live source with the Core\'s policy and fill, the shell says LIVE, and no word of the page says "simulated"', async () => {
    const { bed } = await liveStorage(distinctCore)
    expect(screen.getByTestId('shell-mode')).toHaveTextContent('LIVE')
    // Banner and policy panel: the Core's LOW state and its policy, not a simulator's READY / 90 days.
    expect(screen.getByTestId('storage-banner')).toHaveAttribute('data-state', 'LOW')
    expect(screen.getByTestId('storage-banner')).toHaveTextContent(S.banner.LOW)
    expect(screen.getByTestId('storage-policy-retention')).toHaveTextContent(S.manage.policies.CASE_CLOSURE)
    expect(screen.getByTestId('storage-threshold-scale')).toHaveAttribute('data-tone', 'warning')
    await waitFor(() => expect(screen.getByTestId('storage-kpi-retentionDays')).toHaveTextContent('3,650days'))
    expect(screen.getByTestId('storage-kpi-retentionDays')).toHaveTextContent('auto-archive off')
    // Volumes: one card per volume of the Core, the evidence volume at the Core's fill.
    for (const volume of bed.core.served.storage.volumes) expect(screen.getByTestId(`storage-volume-${volume.id}`)).toBeInTheDocument()
    const evidence = bed.core.served.storage.volumes.find((volume) => volume.kind === 'EVIDENCE')!
    expect(screen.getByTestId(`storage-volume-${evidence.id}`)).toHaveTextContent('90% used')
    // CONTRACT-GAP-W71-1: the SMART counters are the console's; the footnote says so in Live words.
    expect(screen.getByTestId('storage-panel-volumes')).toHaveTextContent(S.volumes.live.derivedNote)
    expect(screen.getByTestId('storage-panel-volumes')).not.toHaveTextContent(S.volumes.derivedNote)
    // §3.2: nothing on the screen speaks of a simulation.
    expect(pageWords()).not.toMatch(/simulat/i)
    // The page asked the Core for nothing of its own: the replica is its source (G13: one operation, 55, on a press).
    for (const operationId of ['getStorageStatus', 'getStorageDetail', 'setStoragePolicy']) expect(bed.fake.log.requestsOf(operationId), operationId).toHaveLength(0)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('follows a delta of the Core: a new policy and a fill that crosses LOW show at once, with the page\'s escalation toast', async () => {
    const { bed, page } = await liveStorage()
    expect(screen.getByTestId('storage-banner')).toHaveAttribute('data-state', 'READY')
    const low = evidenceAt(bed.core.served, 90, 'LOW').storage
    page.sockets.at(-1)!.delta([
      { op: 'replace', slice: 'storagePolicy', value: { retentionPolicy: 'DAYS_30', retentionDays: 30, autoArchive: true } },
      { op: 'replace', slice: 'storage', value: JSON.parse(JSON.stringify(low)) },
    ] as FakeCommandOptions['ops'])
    await bed.flush()
    await waitFor(() => expect(screen.getByTestId('storage-policy-retention')).toHaveTextContent(S.manage.policies.DAYS_30))
    await waitFor(() => expect(screen.getByTestId('storage-banner')).toHaveAttribute('data-state', 'LOW'))
    await waitFor(() => expect(screen.getByTestId('storage-kpi-retentionDays')).toHaveTextContent('30days'))
    // M-PG-STOR: the escalation the Core reported raises the page's own warning, as in Simulated mode.
    await waitFor(() => expect(toastWith(S.toast.LOW)).toHaveLength(1))
    expect(toastTexts().join(' ')).not.toMatch(/simulat/i)
  })
})

describe('an outage (§21.2 of row W54: the shell speaks, the page does not)', () => {
  it('with the Core unreachable the page keeps the Core\'s last data and adds no notice of its own', async () => {
    const { bed } = await liveStorage(distinctCore)
    const storagePage = screen.getByTestId('page-storage')
    bed.core.unreachable()
    await bed.flush()
    await waitFor(() => expect(screen.getByTestId('shell-mode')).toHaveTextContent(/OFFLINE|RECONNECTING/))
    expect(screen.getByTestId('storage-policy-retention')).toHaveTextContent(S.manage.policies.CASE_CLOSURE)
    expect(screen.getByTestId('storage-banner')).toHaveAttribute('data-state', 'LOW')
    expect(within(storagePage).queryByText(new RegExp(en.common.coreErrors.offline.split('.')[0]!))).not.toBeInTheDocument()
    expect(within(storagePage).queryAllByRole('alert')).toHaveLength(0)
    expect(pageWords()).not.toMatch(/simulat/i)
  })
})

describe('the page\'s own record (error logging; CPW1-8)', () => {
  it('a failure is written to the sink with a fixed sentence, the class, code and status of its cause, a correlation ID and the stack frames without the message line', () => {
    const records: ErrorRecord[] = []
    const error = Object.assign(new Error('a text that may hold input'), { code: 'POLICY_RANGE', status: 422 })
    logStorageError('ManageStorageDrawer.apply', error, { retentionPolicy: 'YEAR_1' }, { report: (record) => records.push(record as ErrorRecord) })
    expect(records).toHaveLength(1)
    const [record] = records
    expect(record).toMatchObject({ level: 'error', source: 'Storage.ManageStorageDrawer.apply', message: 'Storage: the step "ManageStorageDrawer.apply" did not complete.' })
    expect(record?.context).toMatchObject({ retentionPolicy: 'YEAR_1', errorName: 'Error', code: 'POLICY_RANGE', status: 422 })
    expect(String(record?.context?.correlationId)).toMatch(/^stor-[0-9a-z]+-\d+$/)
    expect(typeof record?.at).toBe('number')
    expect(JSON.stringify(record)).not.toContain('a text that may hold input')
    // A value that is not an Error is named by its type only.
    logStorageError('ManageStorageDrawer.apply', 'a thrown string', {}, { report: (entry) => records.push(entry as ErrorRecord) })
    expect(records[1]?.context).toMatchObject({ errorName: 'string' })
    expect(JSON.stringify(records[1])).not.toContain('a thrown string')
  })

  it('a panel that throws while rendering shows its fallback and writes one record to the page\'s own log, without the text of the error', () => {
    // React reports the caught error to the console itself; that is React's, not the page's.
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    function Broken(): never {
      throw new Error('a text that may hold input')
    }
    render(
      <StoragePanelBoundary panel="volumes">
        <Broken />
      </StoragePanelBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(en.common.errors.panelTitle)
    const records = webErrorSink.records().filter((record) => record.source === 'Storage.PanelBoundary')
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ level: 'error', message: 'Storage: the step "PanelBoundary" did not complete.' })
    expect(records[0]?.context).toMatchObject({ panel: 'volumes', errorName: 'Error' })
    expect(JSON.stringify(records[0])).not.toContain('a text that may hold input')
  })
})

describe('static rules of the folder (CLG (c); AC-C-53; MD-6)', () => {
  // `import.meta.dirname` (Node, through Vitest): jsdom replaces the global `URL`, so no file URL is built here.
  const folder = resolve(import.meta.dirname, '../features/storage')
  const walk = (directory: string): string[] =>
    readdirSync(directory).flatMap((name) => {
      const path = join(directory, name)
      if (statSync(path).isDirectory()) return name === '__tests__' ? [] : walk(path)
      return /\.tsx?$/.test(name) ? [path] : []
    })
  const production = walk(folder).map((path) => ({ name: relative(folder, path), text: readFileSync(path, 'utf8') }))
  /** The code of a file without its comments: a rule is about what runs. */
  const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

  it('reads the files it means to read', () => {
    expect(production.map((file) => file.name)).toEqual(expect.arrayContaining(['manage-drawer.tsx', 'index.tsx', 'sim-adapter.ts', 'log.ts', 'panel.tsx', 'volumes-panel.tsx']))
    expect(production.length).toBeGreaterThanOrEqual(21)
  })

  it('AC-C-53: no file imports `useSimActions` or reads `.actions` of a `Sim`; the policy change comes from `useCoreActions()` and runs inside `settle`', () => {
    // The i18n keys `common.actions.*` are words, not a read of a data source: they are left out.
    const withoutActionWords = (text: string) => code(text).replace(/common\.actions\.[A-Za-z]+/g, '')
    for (const { name, text } of production) {
      expect(text, name).not.toMatch(/useSimActions/)
      expect(withoutActionWords(text), name).not.toMatch(/\.actions\b/)
      expect(code(text), name).not.toMatch(/\bSimContext\b|live\.source/)
    }
    const drawer = code(production.find((file) => file.name === 'manage-drawer.tsx')?.text ?? '')
    expect(drawer).toMatch(/useCoreActions\(\)/)
    expect(drawer.match(/actions\.setStoragePolicy\(/g)).toHaveLength(1)
    expect(drawer.match(/settle\(\(\) => actions\.setStoragePolicy\(/g)).toHaveLength(1)
    // Rule 2 of the page rows: the presenter speaks first, before the page's own record and toast.
    const presenter = drawer.indexOf('if (presentCoreError(error) !== null) return')
    expect(presenter).toBeGreaterThan(-1)
    expect(presenter).toBeLessThan(drawer.indexOf('logStorageError('))
    expect(presenter).toBeLessThan(drawer.indexOf("toast.danger(t('storage.manage.failed'))"))
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
    const log = code(production.find((file) => file.name === 'log.ts')?.text ?? '')
    expect(log).toMatch(/webErrorSink/)
    // CPW1-8: never the text of the error as the message, and never the stack's first line.
    expect(log).not.toMatch(/message:\s*error|error\.message|String\(error\)/)
  })
})
