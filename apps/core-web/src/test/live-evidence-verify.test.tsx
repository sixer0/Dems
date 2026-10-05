/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W69: settle sites A6 and D-1 of the Evidence page — integrity verification — in Live mode
// on the contract-checked fake transport (backend task 04_client_integration_spec §8.2 A6, §8.4 D-1,
// §14 point 7; 01_specs MS-2, MS-5; gate CLG (b) of 02_plan §11; AC-C-61). Simulated mode is the
// folder's own tests (`features/evidence/__tests__/evidence-integrity.test.tsx`), unchanged.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | AC-C-61: verification calls operation 41 and no demo operation; the verdict shown is the server's | "A6 success", "D-1" |
// | A6: the chip, the per-check list and the custody entry show the server's `EvidenceVerifyResult` | "A6 success" |
// | §14 point 7: the bundled check runs only for `DEMO_PACKAGE`, is labelled, writes nothing; a difference is said, the Core's verdict stays | "§14 point 7" |
// | D-1: no demo control mirrors a tamper in Live mode | "D-1" |
// | A6 refusal, AC-C-48: a 403 NOT_PERMITTED shows the denied toast naming the role; the control returns to idle | "A6 refusal" |
// | A6 outage, LB-6; LB-10: the presenter's sentence, the retry state; a 429 is a limit | "A6 outage" |
// | MS-2: operation 40 decides the bundled media; without its answer none is shown | "MS-2" |
// | §3.2: no "simulated" word on the Live verification card | "A6 success" |
// | Under StrictMode (`main.tsx`) a verification started on arrival reaches the Core once | "StrictMode" |
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EvidenceVerifyResultBody } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { rateLimited, refusal, type FakeCommandOptions } from '@dems/shared/live/testing'
import type { EvidenceItem } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import type { LiveTestBed } from '@/runtime/testing/live-harness'
import {
  clearToasts,
  DEMO_OPERATIONS,
  demoPackage,
  EV,
  evidenceWith,
  findDetailBody,
  installJsdomStubs,
  openLiveEvidence,
  servedItem,
  toastTexts,
  toastWith,
  type LiveEvidence,
} from '@/features/evidence/__tests__/live-evidence-bed'

vi.setConfig({ testTimeout: 40_000 })

const L = en.evidence.live
const V = en.evidence.verify
const DENIED = en.common.rbac.deniedTitle
const REQUIRES = (role: string) => en.common.rbac.requiresRole.replace('{{role}}', role)
const OFFLINE = en.common.coreErrors.offline
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

async function openIntegrity(evidenceId: string, options: Parameters<typeof openLiveEvidence>[1] = {}): Promise<LiveEvidence> {
  opened = await openLiveEvidence(`/evidence/${evidenceId}?tab=integrity`, options)
  await findDetailBody()
  await screen.findByTestId('evidence-integrity', {}, UI)
  return opened
}

/** The server's verdict for an item: every track as sealed, or `failing` with another found hash. */
function verdict(bed: LiveTestBed, evidenceId: string, failing: EvidenceItem['tracks'][number]['trackId'] | null = null): EvidenceVerifyResultBody {
  const item = servedItem(bed, evidenceId)
  return {
    evidenceId,
    ok: failing === null,
    at: bed.fake.clock.now(),
    tracks: item.tracks.map((track) => ({
      trackId: track.trackId,
      expected: track.sha256,
      actual: track.trackId === failing ? 'f'.repeat(64) : track.sha256,
      ok: track.trackId !== failing,
    })),
    manifestOk: true,
    signatureOk: true,
  }
}

/** The delta of a verification on the Core: the item's verification and its custody entry. */
function verifiedOps(bed: LiveTestBed, evidenceId: string, ok: boolean): FakeCommandOptions['ops'] {
  const at = bed.fake.clock.now()
  const value = evidenceWith(bed, evidenceId, (item) => ({
    ...item,
    verification: { status: ok ? 'PASS' : 'FAIL', at },
    custody: [...item.custody, { at, action: ok ? 'VERIFIED' : 'VERIFY_FAILED', actorId: 'OPR-002', detail: ok ? null : 'Mismatch: VIDEO-02' }],
  }))
  return [{ op: 'replace', slice: 'evidence', value }] as FakeCommandOptions['ops']
}

const checkRows = () => Array.from(screen.getByTestId('evidence-verify-card').querySelectorAll<HTMLElement>('[data-check]'))
const verdictChip = () => within(screen.getByTestId('evidence-verify-card')).getByTestId('evidence-verdict')
const requests = (operationId: string) => opened!.bed.fake.log.requestsOf(operationId)
const demoRequests = () => opened!.bed.fake.log.requests.filter((call) => call.operationId !== null && DEMO_OPERATIONS.includes(call.operationId))

describe('A6 success (§8.2; AC-C-61)', () => {
  it('one POST to operation 41; the chip, the six checks and the custody entry are the server\'s; no demo operation; no "simulated" word', async () => {
    const { bed } = await openIntegrity(EV.sealed)
    expect(screen.getByTestId('evidence-integrity')).toHaveAttribute('data-mode', 'core')
    // MS-2: operation 40 answered NONE, so no bundled package and the Core's values carry the Live label.
    expect(screen.getByTestId('evidence-package-chip')).toHaveAttribute('data-package', 'core')
    expect(screen.getByTestId('evidence-hashes')).toHaveAttribute('data-source', 'core')
    expect(requests('getEvidence')).toHaveLength(1)
    const command = bed.fake.scriptCommand('verifyEvidence', { ops: verifiedOps(bed, EV.sealed, true), order: 'delta-first', answer: { status: 200, body: verdict(bed, EV.sealed) } })

    fireEvent.click(screen.getByTestId('evidence-verify'))
    await waitFor(() => expect(verdictChip()).toHaveAttribute('data-verdict', 'PASS'), UI)
    expect(command.deltaSent).toBe(true)
    expect(requests('verifyEvidence')).toHaveLength(1)
    expect(requests('verifyEvidence')[0]).toMatchObject({ method: 'POST', path: `/api/v1/evidence/${EV.sealed}/verify`, params: { id: EV.sealed } })
    expect(demoRequests()).toEqual([])

    const rows = checkRows()
    expect(rows.map((row) => row.dataset.check)).toEqual(['track:VIDEO-01', 'track:VIDEO-02', 'track:AUDIO-01', 'track:AUDIO-02', 'manifest', 'signature'])
    expect(rows.every((row) => row.dataset.source === 'core' && row.dataset.phase === 'pass')).toBe(true)
    // The custody entry the Core wrote arrived with the answer's delta (CL-16).
    const custody = screen.getByTestId('evidence-custody')
    expect(custody.querySelector('[data-custody-action]')).toHaveAttribute('data-custody-action', 'VERIFIED')
    expect(screen.getByTestId('evidence-verify-label')).toHaveTextContent(L.verify.note)
    expect(screen.getByTestId('evidence-verify-card')).toHaveTextContent(L.verify.mode)
    expect(screen.getByTestId('evidence-verify-card').textContent ?? '').not.toMatch(/simulat/i)
    // The values' chip names the Core's record. The signature line keeps its words: the Core's item
    // carries "the simulated signature" (the contract's own description of operation 39), so they are true.
    expect(within(screen.getByTestId('evidence-hashes')).getByText(L.coreRecord)).toBeInTheDocument()
    expect(screen.queryByTestId('evidence-bundled')).not.toBeInTheDocument()
    await waitFor(() => expect(toastWith(V.toastPass.replace('{{id}}', EV.sealed))).toHaveLength(1))
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a FAIL from the server is shown as FAIL on exactly the track the server named, with the sealed value beside the found one', async () => {
    const { bed } = await openIntegrity(EV.sealed2)
    bed.fake.scriptCommand('verifyEvidence', { ops: verifiedOps(bed, EV.sealed2, false), order: 'delta-first', answer: { status: 200, body: verdict(bed, EV.sealed2, 'VIDEO-02') } })
    fireEvent.click(screen.getByTestId('evidence-verify'))
    await waitFor(() => expect(verdictChip()).toHaveAttribute('data-verdict', 'FAIL'), UI)
    expect(checkRows().filter((row) => row.dataset.phase === 'fail').map((row) => row.dataset.check)).toEqual(['track:VIDEO-02'])
    expect(within(checkRows()[1]!).getByText(V.sealed)).toBeInTheDocument()
    expect(screen.getByTestId('evidence-custody').querySelector('[data-custody-action]')).toHaveAttribute('data-custody-action', 'VERIFY_FAILED')
    await waitFor(() => expect(toastWith(V.toastFail.replace('{{id}}', EV.sealed2).replace('{{checks}}', 'VIDEO-02'))).toHaveLength(1))
    expect(demoRequests()).toEqual([])
  })
})

describe('§14 point 7: the bundled demo package beside the Core\'s verdict (MS-5)', () => {
  it('for DEMO_PACKAGE the bundled check runs, labelled; when it differs the page says so and the verdict stays the server\'s', async () => {
    const { bed } = await openIntegrity(EV.sealed, { media: { [EV.sealed]: demoPackage('0001') } })
    expect(screen.getByTestId('evidence-package-chip')).toHaveAttribute('data-package', 'demo')
    // The pristine package passes in the browser; the server's record says VIDEO-02 does not.
    bed.fake.answer('verifyEvidence', { status: 200, body: verdict(bed, EV.sealed, 'VIDEO-02') })
    fireEvent.click(screen.getByTestId('evidence-verify'))
    await waitFor(() => expect(verdictChip()).toHaveAttribute('data-verdict', 'FAIL'), UI)
    const bundled = await screen.findByTestId('evidence-bundled')
    expect(bundled).toHaveTextContent(L.verify.bundledTitle)
    await waitFor(() => expect(screen.getByTestId('evidence-bundled')).toHaveAttribute('data-verdict', 'PASS'), UI)
    expect(screen.getByTestId('evidence-bundled')).toHaveTextContent(L.verify.bundledNote)
    expect(await screen.findByTestId('evidence-bundled-differs')).toHaveTextContent(L.verify.differs)
    // The verdict of record did not move.
    expect(verdictChip()).toHaveAttribute('data-verdict', 'FAIL')
    expect(checkRows().every((row) => row.dataset.source === 'core')).toBe(true)
    expect(requests('verifyEvidence')).toHaveLength(1)
    expect(demoRequests()).toEqual([])
  })

  it('when the two agree no notice is shown', async () => {
    const { bed } = await openIntegrity(EV.sealed, { media: { [EV.sealed]: demoPackage('0001') } })
    bed.fake.answer('verifyEvidence', { status: 200, body: verdict(bed, EV.sealed) })
    fireEvent.click(screen.getByTestId('evidence-verify'))
    await waitFor(() => expect(screen.getByTestId('evidence-bundled')).toHaveAttribute('data-verdict', 'PASS'), UI)
    expect(verdictChip()).toHaveAttribute('data-verdict', 'PASS')
    expect(screen.queryByTestId('evidence-bundled-differs')).not.toBeInTheDocument()
  })
})

describe('D-1: no demo control mirrors a tamper in Live mode (§8.4)', () => {
  it('the bundled copy of EV 0005 fails on AUDIO-02 while the Core\'s record passes: only operation 41 is called, and the Core\'s PASS is shown', async () => {
    // In Simulated mode this disagreement makes the page inject the evidence tamper fault before it records (sim-adapter case 1).
    const { bed } = await openIntegrity(EV.tampered, {
      media: { [EV.tampered]: demoPackage('0005') },
      before: (created) => {
        created.core.served = { ...created.core.served, evidence: evidenceWith(created, EV.tampered, (item) => ({ ...item, tampered: false })) }
      },
    })
    bed.fake.answer('verifyEvidence', { status: 200, body: verdict(bed, EV.tampered) })
    fireEvent.click(screen.getByTestId('evidence-verify'))
    await waitFor(() => expect(verdictChip()).toHaveAttribute('data-verdict', 'PASS'), UI)
    await waitFor(() => expect(screen.getByTestId('evidence-bundled')).toHaveAttribute('data-verdict', 'FAIL'), UI)
    expect(await screen.findByTestId('evidence-bundled-differs')).toBeInTheDocument()
    expect(requests('verifyEvidence')).toHaveLength(1)
    expect(requests('injectFault')).toHaveLength(0)
    expect(demoRequests()).toEqual([])
    // Nothing but the two reads and the one verification went to the Core from this page.
    const pageCalls = bed.fake.log.requests.map((call) => call.operationId).filter((id) => id !== 'getAuthSession' && id !== 'getSignInStatus' && id !== 'touchSession' && id !== 'getServiceHealth')
    expect(pageCalls).toEqual(['getEvidence', 'verifyEvidence'])
  })
})

describe('A6 refusal (§6.2; AC-C-48; LB-5)', () => {
  it('a 403 NOT_PERMITTED shows the denied toast naming the Investigator role (the first that holds EVIDENCE_VIEW); no verdict, no page record; the control is idle again', async () => {
    const { bed } = await openIntegrity(EV.sealed)
    // CONTRACT-GAP-W69-1: operation 41 has no `notPermitted` example (every seeded role holds EVIDENCE_VIEW, `evidence.ts` VIEW_DENIED), so the envelope is written here.
    bed.fake.answerOnce('verifyEvidence', refusal(403, 'NOT_PERMITTED', 'Not permitted.', { permission: 'EVIDENCE_VIEW' }))
    fireEvent.click(screen.getByTestId('evidence-verify'))
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(DENIED)[0]).toContain(REQUIRES(en.common.roles.INVESTIGATOR))
    expect(toastWith(V.errorToast)).toHaveLength(0)
    expect(toastTexts().join(' ')).not.toMatch(/Integrity (verified|FAILED)/)
    await waitFor(() => expect(verdictChip()).toHaveAttribute('data-verdict', 'ERROR'))
    expect(webErrorSink.records().filter((record) => record.source.startsWith('Evidence.'))).toHaveLength(0)
    expect(screen.getByTestId('evidence-verify')).not.toHaveAttribute('data-pending')
    expect(requests('verifyEvidence')).toHaveLength(1)
  })
})

describe('A6 outage (LB-6, LB-10)', () => {
  it('a request without an answer shows "Core server unreachable. Nothing was changed.", the error state with its rate-limited retry, and no verdict toast', async () => {
    const { bed } = await openIntegrity(EV.sealed)
    bed.fake.failOnce('verifyEvidence')
    fireEvent.click(screen.getByTestId('evidence-verify'))
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    await waitFor(() => expect(verdictChip()).toHaveAttribute('data-verdict', 'ERROR'))
    expect(screen.getByTestId('evidence-verify')).toHaveTextContent(en.common.actions.retry)
    expect(toastWith(V.errorToast)).toHaveLength(0)
    expect(toastTexts().join(' ')).not.toMatch(/Integrity (verified|FAILED)/)
    expect(requests('verifyEvidence')).toHaveLength(1)
  })

  it('LB-10: a 429 shows the limit toast with the seconds of `retry-after`, never the outage sentence', async () => {
    const { bed } = await openIntegrity(EV.sealed)
    bed.fake.answerOnce('verifyEvidence', rateLimited(7))
    fireEvent.click(screen.getByTestId('evidence-verify'))
    await waitFor(() => expect(toastWith(en.common.coreErrors.limited.replace('{{seconds}}', '7'))).toHaveLength(1))
    expect(toastWith(OFFLINE)).toHaveLength(0)
    expect(screen.getByTestId('shell-mode')).not.toHaveTextContent(/OFFLINE/)
  })
})

describe('MS-2: the Core\'s media reference (operation 40)', () => {
  it('without an answer the header says the reference is unavailable, no bundled media is shown, and the Core still gives its verdict', async () => {
    const { bed } = await openIntegrity(EV.sealed, {
      media: { [EV.sealed]: demoPackage('0001') },
      before: (created) => created.fake.failOnce('getEvidence'),
    })
    expect(screen.getByTestId('evidence-package-chip')).toHaveAttribute('data-package', 'unavailable')
    expect(screen.getByTestId('evidence-package-chip')).toHaveTextContent(L.mediaUnavailable)
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    bed.fake.answer('verifyEvidence', { status: 200, body: verdict(bed, EV.sealed) })
    fireEvent.click(screen.getByTestId('evidence-verify'))
    await waitFor(() => expect(verdictChip()).toHaveAttribute('data-verdict', 'PASS'), UI)
    expect(screen.queryByTestId('evidence-bundled')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('evidence-tab-media'))
    expect(await screen.findByTestId('evidence-media-empty')).toBeInTheDocument()
  })

  it('NONE for an item the guarded join would give a package: no bundled media and no bundled check', async () => {
    await openIntegrity(EV.sealed7)
    expect(screen.getByTestId('evidence-package-chip')).toHaveAttribute('data-package', 'core')
    fireEvent.click(screen.getByTestId('evidence-tab-media'))
    expect(await screen.findByTestId('evidence-media-empty')).toBeInTheDocument()
    expect(screen.getByTestId('evidence-play')).toBeDisabled()
  })
})

describe('StrictMode (`main.tsx`): a verification started on arrival reaches the Core once', () => {
  it('the list\'s "Verify" hand-off opens the Integrity tab and sends ONE request of operation 41', async () => {
    opened = await openLiveEvidence('/evidence', { strict: true })
    const { bed } = opened
    bed.fake.answer('verifyEvidence', (call) => ({ status: 200, body: verdict(bed, call.params.id ?? '') }))
    fireEvent.click(await screen.findByTestId(`evidence-row-menu-${EV.sealed7}`, {}, UI))
    const menu = await screen.findByRole('menu')
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^Verify/ }))
    await screen.findByTestId('evidence-integrity', {}, UI)
    await waitFor(() => expect(verdictChip()).toHaveAttribute('data-verdict', 'PASS'), UI)
    await bed.flush()
    expect(requests('verifyEvidence')).toHaveLength(1)
  })

  it('the export wizard\'s source check sends ONE request of operation 41 per source', async () => {
    opened = await openLiveEvidence(`/evidence/${EV.sealed}`, { strict: true })
    const { bed } = opened
    bed.fake.answer('verifyEvidence', (call) => ({ status: 200, body: verdict(bed, call.params.id ?? '') }))
    await findDetailBody()
    fireEvent.click(screen.getByTestId('evidence-export'))
    await screen.findByTestId('export-wizard', {}, UI)
    fireEvent.change(screen.getByTestId('export-reason'), { target: { value: 'Prosecutor request' } })
    fireEvent.click(screen.getByTestId('export-next'))
    await screen.findByTestId('export-step-authorise', {}, UI)
    fireEvent.click(screen.getByTestId('export-authorise'))
    fireEvent.click(await screen.findByTestId('export-next', {}, UI))
    const source = await screen.findByTestId(`export-source-${EV.sealed}`, {}, UI)
    await waitFor(() => expect(source).toHaveAttribute('data-verdict', 'PASS'), UI)
    await bed.flush()
    expect(requests('verifyEvidence')).toHaveLength(1)
    expect(requests('exportEvidence')).toHaveLength(0)
  })
})
