/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Blueprint row 87 (M7-W6): the v2 verify view in Live mode, on the contract-checked fake transport
// (the answers of operation 41 are checked against the registry schema, so they carry the contract of
// TODAY: `files`, `transcriptOk`, `manifestOk`, `signatureOk`). The bodies are the ones the real
// verifier of row 85 produced (`features/evidence/__tests__/fixtures/verify-v2-recorded.ts`).
//
// | Rule | Where it is proven here |
// |------|-------------------------|
// | A v2 item never shows the six v1 rows, not even while it waits | "while the Core has not answered" |
// | Nothing moves without the Core: time passing draws no row, no bar, no count, no verdict | "while the Core has not answered" |
// | The result is shown whole when the answer arrives; no row is ever pending or running | "the answer arrives" |
// | A FAIL of the Core is FAIL on the chip, in the toast and on every drawn row | "the tamper demo" |
// | One call of operation 41 and no demo operation | both |
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EvidenceVerifyResultBody } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import type { EvidenceItem } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import type { LiveTestBed } from '@/runtime/testing/live-harness'
import { RECORDED_VERIFY_V2 } from '@/features/evidence/__tests__/fixtures/verify-v2-recorded'
import {
  clearToasts,
  DEMO_OPERATIONS,
  EV,
  evidenceWith,
  findDetailBody,
  installJsdomStubs,
  openLiveEvidence,
  toastWith,
  type LiveEvidence,
} from '@/features/evidence/__tests__/live-evidence-bed'

vi.setConfig({ testTimeout: 40_000 })

const V2 = en.evidence.verifyV2
const UI = { timeout: 15_000 }
let opened: LiveEvidence | undefined

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  webErrorSink.clear()
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
  vi.restoreAllMocks()
})

/** The served item as a schema-v2 item: it carries its two sealed camera files. */
const asV2 = (item: EvidenceItem): EvidenceItem => ({
  ...item,
  files: (['VIDEO-01', 'VIDEO-02'] as const).map((trackId) => ({ trackId, fileName: `fragments/${trackId}.mp4`, sizeBytes: 3_500, sha256: (trackId === 'VIDEO-01' ? 'a' : 'b').repeat(64), fragmentCount: 5 })),
})

async function openV2Integrity(evidenceId: string): Promise<LiveEvidence> {
  opened = await openLiveEvidence(`/evidence/${evidenceId}?tab=integrity`, {
    before: (bed) => {
      bed.core.served = { ...bed.core.served, evidence: evidenceWith(bed, evidenceId, asV2) }
    },
  })
  await findDetailBody()
  await screen.findByTestId('evidence-integrity', {}, UI)
  return opened
}

/** A recorded answer, as the Core would give it for this item now. */
function recorded(bed: LiveTestBed, name: keyof typeof RECORDED_VERIFY_V2, evidenceId: string): EvidenceVerifyResultBody {
  return { ...RECORDED_VERIFY_V2[name].body, evidenceId, at: bed.fake.clock.now() } as EvidenceVerifyResultBody
}

const card = () => screen.getByTestId('evidence-verify-card')
const chip = () => within(card()).getByTestId('evidence-verdict')
/** The rows of the result (camera files, transcript, manifest, signature) — or, before an answer, any row at all. */
const drawnRows = () => Array.from((screen.queryByTestId('evidence-v2-rows') ?? card()).querySelectorAll<HTMLElement>('[data-check]')).map((row) => `${row.dataset.check}:${row.dataset.phase}`)
const drawnChecks = () => Array.from(screen.getByTestId('evidence-v2-checks').querySelectorAll<HTMLElement>('[data-check]')).map((row) => `${row.dataset.check}:${row.dataset.status}`)
const SPEC_LINE = 'VIDEO-02 fragment 3 tampered (stored-bytes hash mismatch; chain broken from fragment 3)'
const requests = (operationId: string) => opened!.bed.fake.log.requestsOf(operationId)
const demoRequests = () => opened!.bed.fake.log.requests.filter((call) => call.operationId !== null && DEMO_OPERATIONS.includes(call.operationId))

describe('a schema-v2 item, while the Core has not answered', () => {
  it('the card waits: no v1 row, no bar, no count; five seconds later nothing has moved; then the answer is shown whole', async () => {
    const { bed } = await openV2Integrity(EV.sealed)
    // Before any run: no "0 of 6 checks" for an item that has no six tracks to check.
    expect(drawnRows()).toEqual([])
    const held = bed.fake.hold('verifyEvidence')

    fireEvent.click(screen.getByTestId('evidence-verify'))
    await waitFor(() => expect(requests('verifyEvidence')).toHaveLength(1), UI)
    await screen.findByTestId('evidence-verify-v2-waiting', {}, UI)
    const waiting = () => ({
      chip: chip().getAttribute('data-verdict'),
      rows: drawnRows(),
      bar: card().querySelector('[role="progressbar"]') !== null,
      count: /\d+ of \d+ checks/.test(card().textContent ?? ''),
      text: screen.getByTestId('evidence-verify-v2-waiting').textContent,
    })
    const before = waiting()
    expect(before).toEqual({ chip: 'RUNNING', rows: [], bar: false, count: false, text: V2.waiting })

    // NEGATIVE CONTROL of "progress only from the Core": time passes, the Core says nothing, the card is the same.
    await bed.elapse(5_000, 500)
    expect(waiting()).toEqual(before)
    expect(screen.queryByTestId('evidence-verify-v2')).toBeNull()

    held.release({ status: 200, body: recorded(bed, 'pass', EV.sealed) })
    await waitFor(() => expect(chip()).toHaveAttribute('data-verdict', 'PASS'), UI)
    // Whole, in the commit that has the verdict: no row is pending or running at any time.
    expect(drawnRows()).toEqual(['file:VIDEO-01:pass', 'file:VIDEO-02:pass', 'transcript:pass', 'manifest:pass', 'signature:pass'])
    // Row 92: the whole report of operation 41 arrives with it — 15 checks, and the source line first.
    expect(drawnChecks()).toHaveLength(15)
    expect(drawnChecks().every((check) => check.endsWith(':PASS'))).toBe(true)
    expect(screen.getByTestId('evidence-verify-v2').firstElementChild).toBe(screen.getByTestId('evidence-v2-sources'))
    expect(screen.getByTestId('evidence-v2-sources')).toHaveTextContent(en.common.sourceClass.verify.development)
    expect(screen.queryByTestId('evidence-verify-v2-waiting')).toBeNull()
    expect(screen.queryByTestId('evidence-checks')).toBeNull()
    expect(requests('verifyEvidence')).toHaveLength(1)
    expect(demoRequests()).toEqual([])
    expect(toastWith(en.evidence.verify.toastPass.replace('{{id}}', EV.sealed))).toHaveLength(1)
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('the tamper demo answer (one fragment of VIDEO-02 altered)', () => {
  it("the Core's FAIL is FAIL on the chip, on the file's row and in the toast; the other rows pass; the answer names the fragment", async () => {
    const { bed } = await openV2Integrity(EV.tampered)
    bed.fake.answer('verifyEvidence', (call) => ({ status: 200, body: recorded(bed, 'tamperedFragment', call.params.id ?? '') }))

    fireEvent.click(screen.getByTestId('evidence-verify'))
    await waitFor(() => expect(chip()).toHaveAttribute('data-verdict', 'FAIL'), UI)
    expect(screen.getByTestId('evidence-verify-v2')).toHaveAttribute('data-verdict', 'FAIL')
    expect(drawnRows()).toEqual(['file:VIDEO-01:pass', 'file:VIDEO-02:fail', 'transcript:pass', 'manifest:pass', 'signature:pass'])
    // Fix wave K (G89b-06): the pin moved by delta - check V-05 of this answer is SKIPPED ("Not run: an earlier check failed"),
    // so the decrypted bytes of the file were not checked and its row says "Not run", never "FAIL".
    expect(card().querySelector('[data-check="file:VIDEO-02"]')).toHaveTextContent('Stored bytes FAIL · decrypted bytes Not run · fragment chain FAIL')
    expect(screen.getByTestId('evidence-v2-fragments')).toHaveTextContent(SPEC_LINE)
    expect(screen.queryByTestId('evidence-v2-fragment-not-named')).toBeNull()
    expect(drawnChecks().filter((check) => check.endsWith(':FAIL'))).toEqual(['V-04:FAIL', 'V-06:FAIL', 'V-08:FAIL'])
    expect(toastWith(en.evidence.verify.toastFail.replace('{{id}}', EV.tampered).replace('{{checks}}', 'VIDEO-02'))).toHaveLength(1)
    expect(toastWith('PASS')).toHaveLength(0)
    expect(requests('verifyEvidence')).toHaveLength(1)
    expect(demoRequests()).toEqual([])
    expect(getMissingI18nKeys()).toEqual([])
  })
})
