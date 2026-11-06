// E-fix FX-W: three Evidence-detail defects of the end-to-end round (test/07a_e2e_web_supervisor.md §20).
//
// | Defect | Root cause | Proven here |
// |--------|------------|-------------|
// | E2E-W1-3 the integrity card opens "Not verified" although the record holds a PASS | `integrity-tab.tsx` read only this view's run (`state.verdict ?? 'NOT_RUN'`), never `item.verification` | "storedVerification", "IntegrityTab opens on the record's verdict", "the page" |
// | E2E-W1-4 the Metadata tab shows another record's bundled manifest with no notice (Live) | the D84 join ignores the dated parts, so `EV-20261006-0012` joins package `EV-20261001-0012`; the tab showed any joined package as the item's metadata. Ruling of row FX-W2: the own-record rule applies in Live mode only; in Simulated mode the package IS the item's content (re-dated dataset) | "Metadata tab: a joined package of another record", "Simulated mode on another day than the packages'" |
// | E2E-W1-7 custody times break mid-token ("6 Oct 20 / 26 09:5 / 8:24") | the time cell was one `.evi-mono` span, and `.evi-mono` is `word-break: break-all` (for hashes) | "custody times" |
//
// Simulated mode and component level; the Live twins are in `src/test/live-efix-evidence.test.tsx`.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoCheckId } from '@dems/shared/demo-data'
import { en } from '@dems/shared/i18n'
import { formatUtcOffset } from '@dems/shared/realtime'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createManualClock, createMemoryAuthStorage, createSim, OPERATOR_IDS, OPERATORS, type EvidenceItem, type Sim } from '@dems/shared/sim'
import { withProviders } from '@/components/composed/__tests__/test-utils'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { createAppRouter } from '@/router'
import { EvidenceAssetsContext } from '../demo-assets'
import { IntegrityTab } from '../integrity-tab'
import { MetadataTab } from '../metadata-tab'
import { buildEvidenceRow, formatWibDateTime, packageDescribesItem, storedVerification, type EvidenceRow } from '../model'
import type { EvidenceVerification, VerifyState } from '../use-verification'
import { createDatasetSim, diskAssets, evidenceIdOf, installBrowserStubs, mountEvidence, stopSims } from './harness'

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

/** Simulators this file builds itself (on another day than the packages'); stopped after each test. */
const simsOnOtherDays: Sim[] = []

const ANDI = OPERATORS.find((operator) => operator.id === OPERATOR_IDS.ANDI)!
const EVIDENCE_CSS = join(dirname(fileURLToPath(import.meta.url)), '../evidence.css')
const SIX: DemoCheckId[] = ['track:VIDEO-01', 'track:VIDEO-02', 'track:AUDIO-01', 'track:AUDIO-02', 'manifest', 'signature']

beforeEach(() => {
  resetMissingI18nKeys()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
})

afterEach(() => {
  cleanup()
  stopSims()
  for (const sim of simsOnOtherDays.splice(0)) sim.stop()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** The dataset item of a package suffix (the simulator stands at the packages' `datasetNow`). */
function datasetItem(sim: Sim, suffix: string): EvidenceItem {
  const id = evidenceIdOf(sim, suffix)
  return JSON.parse(JSON.stringify(sim.store.getState().evidence.find((entry) => entry.id === id))) as EvidenceItem
}

const rowOf = (sim: Sim, item: EvidenceItem): EvidenceRow => buildEvidenceRow(item, sim.store.getState().operators)

/** The item with a verification on its record, and the custody entry it writes. */
function verified(item: EvidenceItem, status: 'PASS' | 'FAIL', at: number, actorId: string | null): EvidenceItem {
  return {
    ...item,
    verification: { status, at },
    custody: [...item.custody, { at, action: status === 'PASS' ? 'VERIFIED' : 'VERIFY_FAILED', actorId, detail: status === 'PASS' ? null : 'Mismatch: VIDEO-02' }],
  }
}

function viewState(patch: Partial<VerifyState> = {}): VerifyState {
  return {
    phase: 'idle',
    mode: 'package',
    checks: SIX.map((id) => ({ id, phase: 'pending', expected: null, actual: null, source: null })),
    verdict: null,
    label: null,
    report: null,
    runId: 0,
    bundled: null,
    differs: false,
    ...patch,
  }
}

function renderIntegrity(sim: Sim, row: EvidenceRow, state: VerifyState = viewState()) {
  const verification: EvidenceVerification = { state, run: async () => null }
  return render(withProviders(<IntegrityTab row={row} verification={verification} />, { sim }))
}

const card = () => screen.getByTestId('evidence-verify-card')
const chip = () => within(card()).getByTestId('evidence-verdict')
const lastLine = (status: string, at: number, actor: string) =>
  en.evidence.verify.last.full
    .replace('{{result}}', status)
    .replace('{{at}}', `${formatWibDateTime(at)} UTC${formatUtcOffset()}`)
    .replace('{{actor}}', actor)

/** The body of the rule whose selector is exactly `selector` (whitespace-normalised). */
function ruleBody(css: string, selector: string): string | null {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
  const match = new RegExp(`(?:^|[}{;])\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(flat)
  return match ? match[1]!.trim() : null
}

// ── E2E-W1-3 ─────────────────────────────────────────────────────────────────────────────────

describe('storedVerification (E2E-W1-3)', () => {
  it('reads the record: none for NOT_RUN; the verdict, its time and the actor of the custody entry of that instant', () => {
    const sim = createDatasetSim()
    const item = datasetItem(sim, '0001')
    expect(item.verification.status).toBe('NOT_RUN')
    expect(storedVerification(item)).toBeNull()
    const at = item.sealedAt! + 60_000
    // A later VERIFIED by someone else must not be taken for the record's verification of `at`.
    const pass = verified(item, 'PASS', at, OPERATOR_IDS.ANDI)
    pass.custody.push({ at: at + 5_000, action: 'VERIFIED', actorId: OPERATOR_IDS.RINA, detail: null })
    expect(storedVerification(pass)).toEqual({ status: 'PASS', at, actorId: OPERATOR_IDS.ANDI, actorKnown: true })
    expect(storedVerification(verified(item, 'FAIL', at, OPERATOR_IDS.BUDI))).toEqual({ status: 'FAIL', at, actorId: OPERATOR_IDS.BUDI, actorKnown: true })
    // Without an entry of that verdict the actor is not known; a system entry has no operator.
    expect(storedVerification({ ...item, verification: { status: 'PASS', at } })).toEqual({ status: 'PASS', at, actorId: null, actorKnown: false })
    expect(storedVerification(verified(item, 'PASS', at, null))).toEqual({ status: 'PASS', at, actorId: null, actorKnown: true })
  })
})

describe("IntegrityTab opens on the record's verdict (E2E-W1-3)", () => {
  it('a record holding PASS: the chip is PASS before any run, with the last verification\'s result, time and operator, and "Verify again"', () => {
    const sim = createDatasetSim()
    const item = datasetItem(sim, '0001')
    const at = item.sealedAt! + 60_000
    renderIntegrity(sim, rowOf(sim, verified(item, 'PASS', at, OPERATOR_IDS.ANDI)))
    expect(chip()).toHaveAttribute('data-verdict', 'PASS')
    expect(card()).toHaveAttribute('data-verdict-source', 'record')
    expect(screen.getByTestId('evidence-verify-last')).toHaveTextContent(lastLine('PASS', at, ANDI.displayName))
    expect(screen.getByTestId('evidence-verify')).toHaveTextContent(en.evidence.verify.again)
    // The per-check list is a run's: no "0 of 6 checks" beside a PASS.
    expect(screen.getByTestId('evidence-verify-stored-hint')).toHaveTextContent(en.evidence.verify.storedHint)
    expect(card().textContent).not.toContain('0 of 6 checks')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a record holding FAIL opens on FAIL', () => {
    const sim = createDatasetSim()
    const item = datasetItem(sim, '0002')
    const at = item.sealedAt! + 120_000
    renderIntegrity(sim, rowOf(sim, verified(item, 'FAIL', at, OPERATOR_IDS.BUDI)))
    expect(chip()).toHaveAttribute('data-verdict', 'FAIL')
    expect(screen.getByTestId('evidence-verify-last')).toHaveTextContent(lastLine('FAIL', at, 'AKP Budi Santoso'))
  })

  it('a record never verified is unchanged: "Not verified", "0 of 6 checks", "Verify", no last line', () => {
    const sim = createDatasetSim()
    renderIntegrity(sim, rowOf(sim, datasetItem(sim, '0001')))
    expect(chip()).toHaveAttribute('data-verdict', 'NOT_RUN')
    expect(card()).toHaveAttribute('data-verdict-source', 'none')
    expect(screen.queryByTestId('evidence-verify-last')).toBeNull()
    expect(card().textContent).toContain('0 of 6 checks')
    expect(screen.getByTestId('evidence-verify')).toHaveTextContent(en.evidence.detail.integrity.verify)
  })

  it("a run in this view shows its own verdict (running, then done) over the record's", () => {
    const sim = createDatasetSim()
    const item = datasetItem(sim, '0001')
    const row = rowOf(sim, verified(item, 'PASS', item.sealedAt! + 60_000, OPERATOR_IDS.ANDI))
    const view = renderIntegrity(sim, row, viewState({ phase: 'running', runId: 1 }))
    expect(chip()).toHaveAttribute('data-verdict', 'RUNNING')
    expect(card()).toHaveAttribute('data-verdict-source', 'run')
    view.rerender(withProviders(<IntegrityTab row={row} verification={{ state: viewState({ phase: 'done', verdict: 'FAIL', runId: 1 }), run: async () => null }} />, { sim }))
    expect(chip()).toHaveAttribute('data-verdict', 'FAIL')
    expect(screen.queryByTestId('evidence-verify-stored-hint')).toBeNull()
  })
})

describe('the page (Simulated mode): the stored verdict on open', () => {
  it('the detail page of an item whose record holds a PASS opens the integrity tab on PASS, naming who verified', async () => {
    installBrowserStubs()
    const harness = mountEvidence(`/evidence/${'EV-20260929-0001'}?tab=integrity`, { operatorId: OPERATOR_IDS.ANDI })
    const at = harness.sim.store.getState().clock.now - 30_000
    act(() => {
      harness.sim.store.setState((state) => ({ evidence: state.evidence.map((entry) => (entry.id === 'EV-20260929-0001' ? verified(entry, 'PASS', at, OPERATOR_IDS.ANDI) : entry)) }))
    })
    const verify = await screen.findByTestId('evidence-verify-card', {}, { timeout: 15_000 })
    expect(within(verify).getByTestId('evidence-verdict')).toHaveAttribute('data-verdict', 'PASS')
    expect(within(verify).getByTestId('evidence-verify-last')).toHaveTextContent(lastLine('PASS', at, ANDI.displayName))
  })
})

// ── E2E-W1-7 ─────────────────────────────────────────────────────────────────────────────────

describe('custody times (E2E-W1-7)', () => {
  it('each time is a date token and a clock token, with the same words as before', () => {
    const sim = createDatasetSim()
    const item = datasetItem(sim, '0001')
    renderIntegrity(sim, rowOf(sim, item))
    const cells = screen.getAllByTestId('evidence-custody-time')
    expect(cells).toHaveLength(item.custody.length)
    const newestFirst = [...item.custody].reverse()
    cells.forEach((cell, index) => {
      const date = cell.querySelector('.evi-custody-date')
      const clock = cell.querySelector('.evi-custody-clock')
      expect(date?.textContent).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/)
      expect(clock?.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/)
      expect(cell.textContent).toBe(formatWibDateTime(newestFirst[index]!.at))
    })
  })

  it('the stylesheet keeps each token whole: no break inside the date or the clock (hashes keep breaking anywhere)', () => {
    const css = readFileSync(EVIDENCE_CSS, 'utf8')
    const time = ruleBody(css, '.evi-mono.evi-custody-time') ?? ''
    expect(time).toContain('word-break: normal;')
    expect(time).toContain('overflow-wrap: normal;')
    expect(ruleBody(css, '.evi-custody-date, .evi-custody-clock')).toBe('white-space: nowrap;')
    expect(ruleBody(css, '.evi-mono')).toContain('word-break: break-all;')
  })
})

// ── E2E-W1-4 ─────────────────────────────────────────────────────────────────────────────────

/** The same demo interview on another day: the join holds, the record's IDs and case number differ. */
function rebased(item: EvidenceItem): EvidenceItem {
  return {
    ...item,
    id: item.id.replace(/^EV-\d{8}-/, 'EV-20261006-'),
    sessionId: item.sessionId.replace(/^SES-\d{8}-/, 'SES-20261006-'),
    caseNumber: item.caseNumber.replace(/\/\d{4}-(\d+)$/, '/1005-$1'),
  }
}

describe('Metadata tab: a joined package of another record (E2E-W1-4)', () => {
  it('the join still gives the package (its media play), but only the package\'s own record counts as described by it', () => {
    const sim = createDatasetSim()
    const own = datasetItem(sim, '0012')
    const row = rowOf(sim, own)
    expect(row.pkg?.evidenceId).toBe(own.id)
    expect(packageDescribesItem(row.pkg, own)).toBe(true)
    const other = rebased(own)
    const otherRow = rowOf(sim, other)
    expect(otherRow.pkg?.evidenceId).toBe(own.id)
    expect(packageDescribesItem(otherRow.pkg, other)).toBe(false)
    expect(packageDescribesItem(null, own)).toBe(false)
    expect(packageDescribesItem(otherRow.pkg, { ...own, caseNumber: other.caseNumber })).toBe(false)
  })

  it("the package's own record is unchanged: the 13 manifest fields, the package tree, data-package demo", () => {
    const sim = createDatasetSim()
    render(withProviders(<MetadataTab row={rowOf(sim, datasetItem(sim, '0012'))} />, { sim }))
    const metadata = screen.getByTestId('evidence-metadata')
    expect(metadata).toHaveAttribute('data-package', 'demo')
    expect(within(metadata).getByTestId('evidence-manifest-fields')).toBeInTheDocument()
    expect(within(metadata).getByTestId('evidence-package-tree')).toBeInTheDocument()
    expect(within(metadata).queryByTestId('evidence-foreign-package')).toBeNull()
  })

  it('Simulated mode (ruling of row FX-W2): a re-dated record keeps the package as its metadata, with no notice', () => {
    const sim = createDatasetSim()
    const own = datasetItem(sim, '0012')
    const other = rebased(own)
    expect(packageDescribesItem(rowOf(sim, other).pkg, other)).toBe(false)
    render(withProviders(<MetadataTab row={rowOf(sim, other)} />, { sim }))
    const metadata = screen.getByTestId('evidence-metadata')
    // The simulator re-dates its dataset; it creates no other record: the package is this item's content.
    expect(metadata).toHaveAttribute('data-package', 'demo')
    expect(within(metadata).getByTestId('evidence-manifest-fields')).toBeInTheDocument()
    expect(within(metadata).getByTestId('evidence-package-tree')).toBeInTheDocument()
    expect(within(metadata).queryByTestId('evidence-foreign-package')).toBeNull()
    expect(within(metadata).queryByTestId('evidence-foreign-documents')).toBeNull()
    expect(metadata.textContent ?? '').not.toContain(en.evidence.metadata.foreign.title)
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('Simulated mode on another day than the packages\' (ruling of row FX-W2)', () => {
  it('a simulator dated 2026-10-06: the detail page of item 0012 (re-dated ids) shows the package as its metadata and no notice', async () => {
    installBrowserStubs()
    const at = Date.parse('2026-10-06T10:00:00+07:00')
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: at })
    const sim = createSim({ clock: createManualClock(at), storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    simsOnOtherDays.push(sim)
    const item = datasetItem(sim, '0012')
    const pkg = rowOf(sim, item).pkg
    // Re-dated: the item's ID is not the package's, yet the join gives the package (D84).
    expect(item.id).not.toBe(pkg?.evidenceId)
    expect(pkg?.evidenceSuffix).toBe('0012')
    expect(item.id.endsWith('-0012')).toBe(true)
    const router = createAppRouter(
      { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket() },
      { history: createMemoryHistory({ initialEntries: [`/evidence/${item.id}?tab=metadata`] }) },
    )
    render(createElement(EvidenceAssetsContext.Provider, { value: await diskAssets() }, createElement(RouterProvider, { router })))
    const metadata = await screen.findByTestId('evidence-metadata', {}, { timeout: 15_000 })
    expect(metadata).toHaveAttribute('data-package', 'demo')
    expect(within(metadata).getByTestId('evidence-manifest-fields')).toBeInTheDocument()
    expect(within(metadata).queryByTestId('evidence-foreign-package')).toBeNull()
    expect(screen.getByTestId('evidence-package-chip')).toHaveAttribute('data-package', 'demo')
    expect(getMissingI18nKeys()).toEqual([])
  })
})

