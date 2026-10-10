/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Fix wave K, closing pass Z2 (re-gate 94 notes G94b-11 / -12): the export wizard and the Core's default destination.
//
// | Rule | Member read BY NAME | Test |
// |------|---------------------|------|
// | The wizard pre-selects the destination whose RECORDED text equals the Core's default; it is read from operation 40; absent: the first option; the operator's own choice always wins | `EvidenceDetail.exportDestinationDefault` (`EVIDENCE_EXPORT_DESTINATION_DEFAULT_EXAMPLE`, inside the `getEvidence.productSealed` example; `contract_wave_k.md` S2 section 2) | "reads", "pre-selects" |
import { cleanup, configure, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVIDENCE_EXPORT_DESTINATION_DEFAULT_EXAMPLE } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { readDetailFacts } from '../item-facts'
import { EV, findDetailBody, type LiveEvidence } from './live-evidence-bed'
import { asReal, contractDetail, openItem, setupPage, teardownPage, UI } from './wave-h-c2-bed'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 60_000 })

const F = en.evidence.itemFacts.exportReal
const NONE = { source: 'NONE', packageSuffix: null }
/** The contract's own answer of operation 40 for a product-sealed item: it states the default destination. */
const PRODUCT_SEALED = contractDetail('productSealed')

let opened: LiveEvidence | undefined
beforeEach(setupPage)
afterEach(async () => {
  await teardownPage(opened)
  opened = undefined
  cleanup()
})

/** The wizard of a REAL item on its Reason step; operation 40 states `extra` beside the media reference. */
async function openWizard(extra: Record<string, unknown>): Promise<LiveEvidence> {
  opened = await openItem(`/evidence/${EV.sealed}`, EV.sealed, {
    change: asReal(),
    media: NONE,
    extra,
    before: (bed) => {
      bed.fake.answer('verifyEvidence', (call) => {
        const item = bed.core.served.evidence.find((entry) => entry.id === (call.params.id ?? ''))!
        return { status: 200, body: { evidenceId: item.id, ok: true, at: bed.fake.clock.now(), tracks: item.tracks.map((track) => ({ trackId: track.trackId, expected: track.sha256, actual: track.sha256, ok: true })), manifestOk: true, signatureOk: true } } as never
      })
      bed.fake.answer('exportEvidence', bed.fake.example('exportEvidence', 202))
    },
  })
  await findDetailBody()
  fireEvent.click(screen.getByTestId('evidence-export'))
  await screen.findByTestId('export-wizard', {}, UI)
  return opened
}

const destinationText = () => screen.getByTestId('export-destination').textContent ?? ''

describe('exportDestinationDefault: read by name from operation 40', () => {
  it('the contract example states it, and the page reader returns exactly that text', () => {
    expect(PRODUCT_SEALED.exportDestinationDefault).toBe(EVIDENCE_EXPORT_DESTINATION_DEFAULT_EXAMPLE)
    expect(readDetailFacts(PRODUCT_SEALED).exportDestinationDefault).toBe(EVIDENCE_EXPORT_DESTINATION_DEFAULT_EXAMPLE)
    // Controls: an older Core (no member), a member that is not text, an empty text: not reported.
    const { exportDestinationDefault: _dropped, ...older } = PRODUCT_SEALED
    expect(readDetailFacts(older).exportDestinationDefault).toBeNull()
    expect(readDetailFacts({ ...older, exportDestinationDefault: 7 }).exportDestinationDefault).toBeNull()
    expect(readDetailFacts({ ...older, exportDestinationDefault: '' }).exportDestinationDefault).toBeNull()
  })
})

describe('exportDestinationDefault: the wizard pre-selects the option whose recorded text equals it', () => {
  it('the contract example: "Case file transfer" is selected and is the text the export request records', async () => {
    await openWizard({ exportDestinationDefault: PRODUCT_SEALED.exportDestinationDefault })
    expect(destinationText()).toContain(EVIDENCE_EXPORT_DESTINATION_DEFAULT_EXAMPLE)
    expect(destinationText()).toContain(F.destination.CASE_FILE)
    fireEvent.change(screen.getByTestId('export-reason'), { target: { value: 'Court order 12/2026, case file' } })
    fireEvent.click(screen.getByTestId('export-next'))
    await screen.findByTestId('export-step-authorise')
    fireEvent.click(screen.getByTestId('export-authorise'))
    fireEvent.click(await screen.findByTestId('export-next'))
    const source = await screen.findByTestId(`export-source-${EV.sealed}`)
    await waitFor(() => expect(source).toHaveAttribute('data-verdict', 'PASS'), UI)
    await waitFor(() => expect(screen.getByTestId('export-next')).not.toBeDisabled())
    fireEvent.click(screen.getByTestId('export-next'))
    fireEvent.click(await screen.findByTestId('export-submit'))
    await waitFor(() => expect(opened!.bed.fake.log.requestsOf('exportEvidence')).toHaveLength(1), UI)
    expect(opened!.bed.fake.log.requestsOf('exportEvidence')[0]?.body).toMatchObject({ destination: EVIDENCE_EXPORT_DESTINATION_DEFAULT_EXAMPLE })
  })

  it('control: the Core names ANOTHER of the options - that one is selected, not the first (fails if the member is not read)', async () => {
    await openWizard({ exportDestinationDefault: F.destination.USB })
    expect(destinationText()).toContain(F.destination.USB)
    expect(destinationText()).not.toContain(F.destination.CASE_FILE)
  })

  it('control: no member (an older Core) - the first option', async () => {
    await openWizard({})
    expect(destinationText()).toContain(F.destination.CASE_FILE)
  })
})
