/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W0, item 9 (decision D158 DC-4): the two "simulated" labels on Live evidence items without
// a package say what is true in Live mode — the values are the Core server's record — and Simulated
// mode keeps its words (04_client_integration_spec §3.2). The export destinations and the signature
// line stay "(simulated)" by D158 DC-4 and are not touched.
//
// | Place | Simulated (unchanged) | Live |
// |-------|-----------------------|------|
// | Metadata tab, the record's label | "Simulated evidence record" | "Core record" |
// | Metadata tab, the record's first members | `"simulated": true`, "SIMULATED record from the in-browser simulator …" | `"record": "CORE"`, "The Core server's record of this item …" |
// | Preview card, the package line | "No DEMO package for this item: simulated data only." | "No DEMO package for this item: the Core server's record only." |
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { SimProvider, type Sim } from '@dems/shared/sim'
import { createTestSim } from '@/components/composed/__tests__/test-utils'
import { MetadataTab } from '@/features/evidence/metadata-tab'
import { buildEvidenceRow } from '@/features/evidence/model'
import { EvidencePreview } from '@/features/evidence/preview-card'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { clearToasts, EV, findDetailBody, installJsdomStubs, openLiveEvidence, type LiveEvidence } from '@/features/evidence/__tests__/live-evidence-bed'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createLiveTestBed, SUPERVISOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'

vi.setConfig({ testTimeout: 40_000 })
const UI = { timeout: 15_000 }

let opened: LiveEvidence | undefined
let bed: LiveTestBed | undefined
const sims: Sim[] = []

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  installJsdomStubs()
})

afterEach(async () => {
  cleanup()
  await clearToasts()
  opened?.bed.dispose()
  opened = undefined
  bed?.dispose()
  bed = undefined
  for (const sim of sims.splice(0)) sim.stop()
  vi.restoreAllMocks()
})

/** The first evidence row of `sim` (the caller drops its package: an item no DEMO package joins). */
function rowWithoutPackage(sim: Sim) {
  const state = sim.store.getState()
  const item = state.evidence[0]
  if (!item) throw new Error('the state holds no evidence item')
  return buildEvidenceRow(item, state.operators)
}

describe('Simulated mode keeps its words', () => {
  it('the Metadata tab: "Simulated evidence record" with `"simulated": true`; the preview: "simulated data only"', () => {
    const sim = createTestSim()
    sims.push(sim)
    const row = { ...rowWithoutPackage(sim), pkg: null }
    render(
      <SimProvider sim={sim}>
        <MetadataTab row={row} />
        <EvidencePreview row={row} onOpen={() => undefined} onExport={() => undefined} />
      </SimProvider>,
    )
    const metadata = screen.getByTestId('evidence-metadata')
    expect(metadata).toHaveAttribute('data-package', 'simulated')
    expect(within(metadata).getByRole('region', { name: en.evidence.metadata.simulatedRecord })).toBeInTheDocument()
    expect(metadata.textContent).toContain('"simulated": true')
    expect(metadata.textContent).toContain('SIMULATED record from the in-browser simulator; no DEMO package joins this item.')
    const line = screen.getByTestId('evidence-preview').querySelector('.evi-preview-package')!
    expect(line).toHaveAttribute('data-package', 'simulated')
    expect(line).toHaveTextContent(en.evidence.preview.noPackage)
  })
})

describe('Live mode: the Core server\'s record is called so', () => {
  it('the Metadata tab of the detail page (operation 40 answers NONE): "Core record", `"record": "CORE"`, no "simulated" word', async () => {
    opened = await openLiveEvidence(`/evidence/${EV.sealed7}?tab=metadata`)
    await findDetailBody()
    const metadata = await screen.findByTestId('evidence-metadata', {}, UI)
    expect(metadata).toHaveAttribute('data-package', 'core')
    expect(within(metadata).getByRole('region', { name: en.evidence.live.coreRecord })).toBeInTheDocument()
    expect(within(metadata).queryByRole('region', { name: en.evidence.metadata.simulatedRecord })).not.toBeInTheDocument()
    const record = JSON.parse(within(metadata).getByRole('region', { name: en.evidence.live.coreRecord }).textContent ?? '') as Record<string, unknown>
    expect(record.record).toBe('CORE')
    expect(record.note).toBe("The Core server's record of this item; no DEMO package joins it.")
    expect(record).not.toHaveProperty('simulated')
    // The record's values are the Core's (the served item). Its signature member is the Core's own
    // value, which the contract calls simulated (D158 DC-4: truthful, not touched).
    expect(record.evidenceId).toBe(EV.sealed7)
    const { signature: _signature, ...ownWords } = record
    expect(JSON.stringify(ownWords)).not.toMatch(/simulat/i)
    // Outside the record, the tab says nothing of a simulation either.
    const outside = (metadata.textContent ?? '').replace(within(metadata).getByRole('region').textContent ?? '', '')
    expect(outside).not.toMatch(/simulat/i)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the preview card: "the Core server\'s record only", no "simulated" word', async () => {
    const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
    bed = created
    const page = await created.load()
    // An item no DEMO package joins (a session recorded on the Core); the served dataset's items all join one.
    const row = { ...rowWithoutPackage(page.runtime.sim), pkg: null }
    render(
      <SimProvider sim={page.runtime.sim}>
        <EvidencePreview row={row} onOpen={() => undefined} onExport={() => undefined} />
      </SimProvider>,
    )
    const line = screen.getByTestId('evidence-preview').querySelector('.evi-preview-package')!
    expect(line).toHaveAttribute('data-package', 'core')
    expect(line).toHaveTextContent(en.evidence.live.noPackage)
    expect(line.textContent ?? '').not.toMatch(/simulat/i)
    expect(getMissingI18nKeys()).toEqual([])
  })
})
