/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Closing copy round (W83 ledger #95; observation of plan row W0, decision D165): in Live mode, when
// the Core's media reference (operation 40) does not answer, whether a DEMO package belongs to the item
// is unknown. The Metadata tab then says so with the header chip's words, "Media reference
// unavailable", instead of "No DEMO package for this item", and its record claims no absence.
//
// | Case | The tab's empty-state title | The record's note |
// |------|------------------------------|-------------------|
// | Simulated (unchanged, whatever the prop) | "No DEMO package for this item" | "SIMULATED record … no DEMO package joins this item." |
// | Live, operation 40 answers NONE (unchanged) | "No DEMO package for this item" | "… no DEMO package joins it." |
// | Live, operation 40 unanswered (new) | "Media reference unavailable" (the header chip's key) | "… its media reference is unavailable, so no DEMO package is shown." |
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { SimProvider, type Sim } from '@dems/shared/sim'
import { createTestSim } from '@/components/composed/__tests__/test-utils'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { MetadataTab } from '../metadata-tab'
import { buildEvidenceRow } from '../model'
import { clearToasts, demoPackage, EV, findDetailBody, installJsdomStubs, openLiveEvidence, type LiveEvidence } from './live-evidence-bed'

vi.setConfig({ testTimeout: 40_000 })
const UI = { timeout: 15_000 }

const NO_PACKAGE = en.evidence.metadata.noPackage
const UNAVAILABLE = en.evidence.live.mediaUnavailable
const NOTE_NONE = "The Core server's record of this item; no DEMO package joins it."
const NOTE_UNKNOWN = "The Core server's record of this item; its media reference is unavailable, so no DEMO package is shown."

let opened: LiveEvidence | undefined
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
  for (const sim of sims.splice(0)) sim.stop()
  vi.restoreAllMocks()
})

/** The tab's empty state and its record (the JSON region), as the operator reads them. */
async function metadataTab(): Promise<{ title: string; record: Record<string, unknown> }> {
  const metadata = await screen.findByTestId('evidence-metadata', {}, UI)
  const title = metadata.querySelector('.evi-empty-title')?.textContent ?? ''
  const record = JSON.parse(within(metadata).getByRole('region').textContent ?? '') as Record<string, unknown>
  return { title, record }
}

describe('Simulated mode keeps its words', () => {
  it('the prop changes nothing: "No DEMO package for this item" and the SIMULATED record', async () => {
    const sim = createTestSim()
    sims.push(sim)
    const state = sim.store.getState()
    const item = state.evidence[0]
    if (!item) throw new Error('the state holds no evidence item')
    const row = { ...buildEvidenceRow(item, state.operators), pkg: null }
    render(
      <SimProvider sim={sim}>
        <MetadataTab row={row} mediaUnavailable />
      </SimProvider>,
    )
    const { title, record } = await metadataTab()
    expect(title).toBe(NO_PACKAGE)
    expect(record.simulated).toBe(true)
    expect(record.note).toBe('SIMULATED record from the in-browser simulator; no DEMO package joins this item.')
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('Live mode: the Metadata tab says what is known', () => {
  it('operation 40 answers NONE: "No DEMO package for this item", as before', async () => {
    opened = await openLiveEvidence(`/evidence/${EV.sealed7}?tab=metadata`)
    await findDetailBody()
    expect(screen.getByTestId('evidence-package-chip')).toHaveAttribute('data-package', 'core')
    const { title, record } = await metadataTab()
    expect(title).toBe(NO_PACKAGE)
    expect(record.note).toBe(NOTE_NONE)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('operation 40 unanswered: "Media reference unavailable", the header chip\'s words; nothing claims there is no package', async () => {
    opened = await openLiveEvidence(`/evidence/${EV.sealed}?tab=metadata`, {
      media: { [EV.sealed]: demoPackage('0001') },
      before: (created) => created.fake.failOnce('getEvidence'),
    })
    await findDetailBody()
    const chip = screen.getByTestId('evidence-package-chip')
    await waitFor(() => expect(chip).toHaveAttribute('data-package', 'unavailable'))
    expect(chip).toHaveTextContent(UNAVAILABLE)
    const { title, record } = await metadataTab()
    expect(title).toBe(UNAVAILABLE)
    expect(record.record).toBe('CORE')
    expect(record.note).toBe(NOTE_UNKNOWN)
    const metadata = screen.getByTestId('evidence-metadata')
    expect(metadata.textContent).not.toContain(NO_PACKAGE)
    expect(metadata.textContent).not.toContain('no DEMO package joins')
    expect(getMissingI18nKeys()).toEqual([])
  })
})
