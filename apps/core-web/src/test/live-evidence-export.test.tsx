/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W69: settle sites A5, C-5 and D-6 of the Evidence page — the export wizard — in Live mode
// on the contract-checked fake transport (backend task 04_client_integration_spec §8.2 A5, §8.4 C-5
// and D-6; F59; LB-1, LB-2, LB-6, LB-10; gate CLG (b) of 02_plan §11). Simulated mode is the folder's
// own tests (`features/evidence/__tests__/evidence-export.test.tsx`), unchanged.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | A5 success: one POST to operation 42 with the reason and destination; the export ID the Core gave; the toast after the answer | "A5 success" |
// | C-5: the audit row of the export is read from the replica after the answer (the delta of its revision) | "A5 success" |
// | §19.3 rule 3 in Live mode: the source is verified by the Core (operation 41) before the export | "A5 success" |
// | A5 refusal: 403 → the wizard's denied Alert; 422 INVALID_REASON → the Reason step with the reason kept (F59: the Core is the judge) | "A5 refusal" |
// | A5 outage, LB-6: the presenter's one toast, the row's failure state with its sentence, the dialog stays open | "A5 outage" |
// | D-6: one export per selected row on the denied path, in row order, each refused by the Core; the denied Alert | "D-6" |
// | D-6, LB-10: past the denial budget the later calls answer 429, shown once as a limit | "D-6" |
// | D-6: when the Core lets a call through, its answers are the result (the server is the judge) | "D-6" |
// | LB-1: the export is busy at once (a second press sends nothing), spinner late | "A5 pending" |
import { act, cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EvidenceVerifyResultBody } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { rateLimited, type FakeCommandOptions } from '@dems/shared/live/testing'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import { INVESTIGATOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'
import {
  auditWith,
  clearToasts,
  EV,
  findDetailBody,
  installJsdomStubs,
  openLiveEvidence,
  servedItem,
  toastTexts,
  toastWith,
  type LiveEvidence,
} from '@/features/evidence/__tests__/live-evidence-bed'

// The page body is a lazily loaded chunk: under load the first import can take longer than the library's default.
configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 40_000 })

const W = en.evidence.exportWizard
const L = en.evidence.live
const OFFLINE = en.common.coreErrors.offline
const UI = { timeout: 15_000 }
const REASON = 'Prosecutor request'
const DESTINATION = W.destinations.CASE_FILE

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

const requests = (operationId: string) => opened!.bed.fake.log.requestsOf(operationId)

/** The Core's PASS for an item (every track as sealed). */
function passed(bed: LiveTestBed, evidenceId: string): EvidenceVerifyResultBody {
  const item = servedItem(bed, evidenceId)
  return {
    evidenceId,
    ok: true,
    at: bed.fake.clock.now(),
    tracks: item.tracks.map((track) => ({ trackId: track.trackId, expected: track.sha256, actual: track.sha256, ok: true })),
    manifestOk: true,
    signatureOk: true,
  }
}

/** The SUPERVISOR on an item's detail page with the wizard open on the Reason step. */
async function openWizard(evidenceId: string): Promise<LiveEvidence> {
  opened = await openLiveEvidence(`/evidence/${evidenceId}`)
  opened.bed.fake.answer('verifyEvidence', (call) => ({ status: 200, body: passed(opened!.bed, call.params.id ?? '') }))
  await findDetailBody()
  fireEvent.click(screen.getByTestId('evidence-export'))
  await screen.findByTestId('export-wizard', {}, UI)
  return opened
}

function enterReason(text: string) {
  fireEvent.change(screen.getByTestId('export-reason'), { target: { value: text } })
  fireEvent.click(screen.getByTestId('export-next'))
}

/** Reason, Authorise (granted: no request), the Core's source verification, then the Export step. */
async function toExportStep(evidenceId: string): Promise<void> {
  enterReason(REASON)
  await screen.findByTestId('export-step-authorise')
  fireEvent.click(screen.getByTestId('export-authorise'))
  fireEvent.click(await screen.findByTestId('export-next'))
  const source = await screen.findByTestId(`export-source-${evidenceId}`)
  await waitFor(() => expect(source).toHaveAttribute('data-verdict', 'PASS'), UI)
  // The source's verdict is the Core's (operation 41), and says so.
  expect(source).toHaveTextContent(L.verify.sourceCaption)
  // The wizard learns the source's verdict one render later: Next is enabled then.
  await waitFor(() => expect(screen.getByTestId('export-next')).not.toBeDisabled())
  fireEvent.click(screen.getByTestId('export-next'))
  await screen.findByTestId('export-submit')
}


/**
 * FXR-W W92-16 (D179 DC-6): a test that claims ONE toast counts the toast CALLS, not the toasts on
 * screen — `waitFor(… toHaveLength(1))` resolves on the first toast, and a second identical toast
 * that arrives later would pass. Each method of the kit's `toast` is spied (the toast still shows).
 */
function spyToastCalls(): () => number {
  const spies = (['success', 'danger', 'warning', 'info'] as const)
    .filter((method) => typeof (toast as unknown as Record<string, unknown>)[method] === 'function')
    .map((method) => vi.spyOn(toast, method))
  return () => spies.reduce((sum, spy) => sum + spy.mock.calls.length, 0)
}

describe('A5 success (§8.2; C-5)', () => {
  it('one POST to operation 42 with the reason and the destination; the result names the Core\'s export ID and the audit row the delta brought', async () => {
    const { bed } = await openWizard(EV.exported)
    await toExportStep(EV.exported)
    // §19.3 rule 3: the Core verified the source; nothing was exported yet; Authorise sent nothing for a SUPERVISOR.
    expect(requests('verifyEvidence')).toHaveLength(1)
    expect(requests('exportEvidence')).toHaveLength(0)

    // C-5: the audit row of the export is in the delta of the answer's revision.
    const audit = auditWith(bed, { type: 'EVIDENCE_EXPORTED', evidenceId: EV.exported, actorId: 'OPR-002', details: { exportId: 'EXP-000031', reason: REASON } })
    const command = bed.fake.scriptCommand('exportEvidence', { ops: [{ op: 'replace', slice: 'audit', value: audit }] as FakeCommandOptions['ops'], order: 'delta-first' })
    fireEvent.click(screen.getByTestId('export-submit'))

    const results = await screen.findByTestId('export-results', {}, UI)
    expect(command.deltaSent).toBe(true)
    expect(requests('exportEvidence')).toHaveLength(1)
    expect(requests('exportEvidence')[0]).toMatchObject({ method: 'POST', path: `/api/v1/evidence/${EV.exported}/export`, body: { reason: REASON, destination: DESTINATION } })
    const result = results.querySelector<HTMLElement>('[data-export-id]')
    expect(result).toHaveAttribute('data-export-id', 'EXP-000031')
    const newest = audit.rows.at(-1)!
    expect(result).toHaveTextContent(newest.id)
    expect(result).toHaveTextContent(newest.hash.slice(0, 6))
    await waitFor(() => expect(toastWith(W.successToast.replace('{{id}}', EV.exported))).toHaveLength(1))
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('A5 refusal (§8.2; F59)', () => {
  it('403: the Core refused the role (it wrote EXPORT_DENIED): the wizard shows its denied Alert, no success toast', async () => {
    const { bed } = await openWizard(EV.sealed)
    await toExportStep(EV.sealed)
    bed.fake.answerOnce('exportEvidence', bed.fake.example('exportEvidence', 403, 'forbidden'))
    fireEvent.click(screen.getByTestId('export-submit'))
    const denied = await screen.findByTestId('export-denied', {}, UI)
    expect(denied).toHaveTextContent(W.deniedTitle)
    expect(screen.queryByTestId('export-results')).not.toBeInTheDocument()
    expect(toastWith(W.successToast.replace('{{id}}', EV.sealed))).toHaveLength(0)
    expect(requests('exportEvidence')).toHaveLength(1)
  })

  it('422 INVALID_REASON: back on the Reason step with the reason kept and the Core\'s refusal on the field', async () => {
    const { bed } = await openWizard(EV.sealed)
    await toExportStep(EV.sealed)
    bed.fake.answerOnce('exportEvidence', bed.fake.example('exportEvidence', 422, 'invalidReason'))
    fireEvent.click(screen.getByTestId('export-submit'))
    expect(await screen.findByText(L.export.reasonRefused, {}, UI)).toBeInTheDocument()
    expect(screen.getByTestId('export-reason')).toHaveValue(REASON)
    expect(screen.queryByTestId('export-results')).not.toBeInTheDocument()
    // Typing clears the Core's refusal from the field.
    fireEvent.change(screen.getByTestId('export-reason'), { target: { value: `${REASON} for the court` } })
    await waitFor(() => expect(screen.queryByText(L.export.reasonRefused)).not.toBeInTheDocument())
  })
})

describe('A5 outage (LB-6, LB-10)', () => {
  it('a request without an answer: the presenter\'s one toast, the row in its failure state with the same sentence, the dialog open, no other toast', async () => {
    const { bed } = await openWizard(EV.sealed)
    await toExportStep(EV.sealed)
    bed.fake.failOnce('exportEvidence')
    const toastCalls = spyToastCalls()
    fireEvent.click(screen.getByTestId('export-submit'))
    const results = await screen.findByTestId('export-results', {}, UI)
    const failure = results.querySelector<HTMLElement>('[data-export-failure]')
    expect(failure).toHaveAttribute('data-export-failure', 'NO_RESULT')
    expect(failure).toHaveTextContent(OFFLINE)
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(toastTexts()).toHaveLength(1)
    // W92-16: after a flush, ONE toast call — not only one toast on screen.
    await bed.flush()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(toastCalls()).toBe(1)
    expect(screen.getByTestId('export-wizard')).toBeInTheDocument()
    expect(webErrorSink.records().filter((record) => record.source.startsWith('Evidence.'))).toHaveLength(0)
  })

  it('a 429 is a limit: its toast and its sentence on the row, never the outage sentence', async () => {
    const { bed } = await openWizard(EV.sealed)
    await toExportStep(EV.sealed)
    bed.fake.answerOnce('exportEvidence', rateLimited(11))
    fireEvent.click(screen.getByTestId('export-submit'))
    const limited = en.common.coreErrors.limited.replace('{{seconds}}', '11')
    const results = await screen.findByTestId('export-results', {}, UI)
    expect(results.querySelector('[data-export-failure]')).toHaveTextContent(limited)
    await waitFor(() => expect(toastWith(limited)).toHaveLength(1))
    expect(toastWith(OFFLINE)).toHaveLength(0)
  })
})

describe('A5 pending (LB-1, LB-2)', () => {
  it('while the export is out the step is busy and a second press sends nothing; the spinner shows only after the reveal time', async () => {
    const { bed } = await openWizard(EV.sealed)
    await toExportStep(EV.sealed)
    const held = bed.fake.hold('exportEvidence')
    fireEvent.click(screen.getByTestId('export-submit'))
    await waitFor(() => expect(requests('exportEvidence')).toHaveLength(1))
    await bed.flush()
    expect(screen.getByTestId('export-step-export')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByTestId('export-submit')).not.toHaveAttribute('data-pending')
    fireEvent.click(screen.getByTestId('export-submit'))
    await bed.flush()
    expect(requests('exportEvidence')).toHaveLength(1)
    await waitFor(() => expect(screen.getByTestId('export-submit')).toHaveAttribute('data-pending', 'true'), { timeout: 3_000 })
    await act(async () => {
      held.release()
    })
    await bed.flush()
    await screen.findByTestId('export-results', {}, UI)
    expect(screen.getByTestId('export-step-export')).not.toHaveAttribute('aria-busy')
    expect(requests('exportEvidence')).toHaveLength(1)
  })
})

// ── D-6: the denied path, several selected rows ───────────────────────────────────────────────

const SELECTED = ['EV-20261001-0013', 'EV-20261001-0012', 'EV-20261001-0011'] as const

/** An INVESTIGATOR on the list, three rows selected, the bulk wizard on the Authorise step. */
async function deniedPath(script: (bed: LiveTestBed) => void): Promise<LiveEvidence> {
  opened = await openLiveEvidence('/evidence', { session: INVESTIGATOR_SESSION, before: script })
  await screen.findByTestId('evidence-list-body', {}, UI)
  for (const id of SELECTED) {
    // The row's checkbox is named by its own label and the row header together: match its start.
    fireEvent.click(await screen.findByRole('checkbox', { name: new RegExp(`^${en.evidence.table.selectRow.replace('{{id}}', id)}\\b`) }, UI))
  }
  fireEvent.click(await screen.findByTestId('evidence-bulk-export'))
  await screen.findByTestId('export-wizard', {}, UI)
  enterReason(REASON)
  await screen.findByTestId('export-step-authorise')
  return opened
}

describe('D-6 (§8.4): one export per selected row on the denied path', () => {
  it('three POSTs to operation 42 in row order, each refused by the Core (one EXPORT_DENIED each); then the denied Alert', async () => {
    await deniedPath((bed) => bed.fake.answer('exportEvidence', bed.fake.example('exportEvidence', 403, 'forbidden')))
    fireEvent.click(screen.getByTestId('export-authorise'))
    const denied = await screen.findByTestId('export-denied', {}, UI)
    expect(within(denied).getByTestId('lock-shackle')).toBeInTheDocument()
    expect(requests('exportEvidence').map((call) => call.params.id)).toEqual([...SELECTED])
    for (const call of requests('exportEvidence')) expect(call.body).toEqual({ reason: REASON, destination: DESTINATION })
    expect(screen.queryByTestId('export-next')).not.toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('LB-10: past the denial budget the Core answers 429; the limit toast shows once and the denied Alert follows', async () => {
    await deniedPath((bed) => {
      bed.fake.answerOnce('exportEvidence', bed.fake.example('exportEvidence', 403, 'forbidden'))
      bed.fake.answer('exportEvidence', rateLimited(42))
    })
    fireEvent.click(screen.getByTestId('export-authorise'))
    await screen.findByTestId('export-denied', {}, UI)
    expect(requests('exportEvidence')).toHaveLength(3)
    await waitFor(() => expect(toastWith(en.common.coreErrors.limited.replace('{{seconds}}', '42'))).toHaveLength(1))
    expect(toastWith(OFFLINE)).toHaveLength(0)
  })

  it('an outage on the first call: one offline toast, the other calls still go out, the denied Alert follows', async () => {
    await deniedPath((bed) => {
      bed.fake.failOnce('exportEvidence')
      bed.fake.answer('exportEvidence', bed.fake.example('exportEvidence', 403, 'forbidden'))
    })
    fireEvent.click(screen.getByTestId('export-authorise'))
    await screen.findByTestId('export-denied', {}, UI)
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(requests('exportEvidence').length).toBeGreaterThanOrEqual(1)
  })

  it('the server is the judge: when the Core accepts (the console\'s permission hint was out of date), its answers are the result', async () => {
    await deniedPath((bed) => bed.fake.answerFromExample('exportEvidence'))
    fireEvent.click(screen.getByTestId('export-authorise'))
    const results = await screen.findByTestId('export-results', {}, UI)
    expect(results.querySelectorAll('[data-export-id]')).toHaveLength(3)
    expect(screen.queryByTestId('export-denied')).not.toBeInTheDocument()
    await waitFor(() => expect(toastWith(W.successToast.replace('{{id}}', W.itemCount_other.replace('{{count}}', '3')))).toHaveLength(1))
  })
})
