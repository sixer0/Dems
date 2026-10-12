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
import { HOST_CLOCK_TIME, isOwnCaptureCoreState } from '@dems/shared/sim'
import { rateLimited, type FakeCommandOptions } from '@dems/shared/live/testing'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import { EXPORT_MANIFEST_NOTICE_DEMO_PACKAGE, EXPORT_MANIFEST_NOTICE_OWN_CAPTURE_PACKAGE } from '@/features/evidence/export-download'
import { INVESTIGATOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'
import {
  auditWith,
  clearToasts,
  demoPackage,
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
  const roleStep = await screen.findByTestId('export-step-authorise')
  // Fix wave J round three (N-07): the step is a check of the operator's OWN role and is worded so - not "Request
  // authorisation" / "Authorised", which read as somebody's approval.
  expect(screen.getByTestId('export-authorise')).toHaveTextContent(/^Check my role$/)
  expect(roleStep.textContent).not.toMatch(/Request authorisation/)
  fireEvent.click(screen.getByTestId('export-authorise'))
  expect(await screen.findByTestId('export-role-permits')).toHaveTextContent('Your role may export')
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

// Fix wave J, pass J5 (truth rule 3f; note 174 decision 2). A v1 demonstration item has no archive on any Core: the file
// the CONSOLE writes is all there is, also on a Core in its own capture - where it said `demo: true`, "the DEMS demo
// console". (That no such file is offered for a recording of the Core: `export-job.test.tsx`, `item-exports.test.tsx`.)
describe('pass J5: the export file the console writes for a demonstration item', () => {
  /** Exports the packaged v1 item EV 0001 and presses its download; returns the file the browser was handed. */
  async function downloadedFile(ownCapture: boolean): Promise<{ name: string; file: Record<string, unknown> }> {
    const blobs: Blob[] = []
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: (blob: Blob) => (blobs.push(blob), 'blob:evidence-export') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    opened = await openLiveEvidence(`/evidence/${EV.sealed}`, {
      media: { [EV.sealed]: demoPackage('0001') },
      before: (bed) => {
        if (ownCapture) bed.core.served = { ...bed.core.served, time: { ...HOST_CLOCK_TIME } }
      },
    })
    const { bed, page } = opened
    expect(isOwnCaptureCoreState(page.live.store.getState())).toBe(ownCapture)
    bed.fake.answer('verifyEvidence', (call) => ({ status: 200, body: passed(bed, call.params.id ?? '') }))
    await findDetailBody()
    fireEvent.click(screen.getByTestId('evidence-export'))
    await screen.findByTestId('export-wizard', {}, UI)
    await toExportStep(EV.sealed)
    const audit = auditWith(bed, { type: 'EVIDENCE_EXPORTED', evidenceId: EV.sealed, actorId: 'OPR-002', details: { exportId: 'EXP-000031', reason: REASON } })
    bed.fake.scriptCommand('exportEvidence', { ops: [{ op: 'replace', slice: 'audit', value: audit }] as FakeCommandOptions['ops'], order: 'delta-first' })
    fireEvent.click(screen.getByTestId('export-submit'))
    await screen.findByTestId('export-results', {}, UI)
    await act(async () => {
      fireEvent.click(await screen.findByTestId(`export-download-${EV.sealed}`, {}, UI))
    })
    await waitFor(() => expect(blobs).toHaveLength(1), UI)
    const anchor = click.mock.contexts.at(-1) as HTMLAnchorElement
    const blob = blobs[0]!
    const text = typeof blob.text === 'function' ? await blob.text() : await new Response(blob).text()
    return { name: anchor.download, file: JSON.parse(text) as Record<string, unknown> }
  }

  it('a Core in its own capture: no `demo` member, the notice says it is the console\'s summary of a demonstration item this Core holds', async () => {
    const { file } = await downloadedFile(true)
    expect('demo' in file).toBe(false)
    expect(file.demonstrationItem).toBe(true)
    expect(file.notice).toBe(EXPORT_MANIFEST_NOTICE_OWN_CAPTURE_PACKAGE)
    expect(String(file.notice)).not.toMatch(/^DEMO|demo console|simulat|synthetic/i)
    expect(file.source).toMatchObject({ evidenceId: EV.sealed })
    expect(file.authorization).toMatchObject({ purpose: REASON })
  })

  it('CONTROL - a Core in simulated capture: `demo: true` and the old sentence, word for word', async () => {
    const { name, file } = await downloadedFile(false)
    expect(file.demo).toBe(true)
    expect('demonstrationItem' in file).toBe(false)
    expect(file.notice).toBe(EXPORT_MANIFEST_NOTICE_DEMO_PACKAGE)
    expect(EXPORT_MANIFEST_NOTICE_DEMO_PACKAGE).toBe('DEMO export manifest built in the browser by the DEMS demo console from the sealed DEMO package. Not evidence.')
    expect(name).toMatch(new RegExp(`^EXP-\\d{6}-${EV.sealed}-export-manifest\\.demo\\.json$`))
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

// Fix wave J (JW-14 (c)): the four cases of "D-6: one export per selected row on the denied path" are REPLACED. They drove
// the wizard as an INVESTIGATOR up to "Authorise", where the Core refused each row - the judge's "enabled, then refused two
// steps later, with the raw permission name". ONE rule now: a control the role may not use is disabled WITH its visible
// reason, so the denied path cannot be entered from the page and no request is sent for a role that may not export.
describe('JW-14 (wave J): a role that may not export gets no export control to press - and the reason beside it', () => {
  it('an INVESTIGATOR with three rows selected: the bulk Export is disabled, names the Supervisor role, opens no wizard and sends nothing', async () => {
    opened = await openLiveEvidence('/evidence', { session: INVESTIGATOR_SESSION, before: (bed) => bed.fake.answer('exportEvidence', bed.fake.example('exportEvidence', 403, 'forbidden')) })
    await screen.findByTestId('evidence-list-body', {}, UI)
    for (const id of SELECTED) {
      // The row's checkbox is named by its own label and the row header together: match its start.
      fireEvent.click(await screen.findByRole('checkbox', { name: new RegExp(`^${en.evidence.table.selectRow.replace('{{id}}', id)}\\b`) }, UI))
    }
    const bulk = await screen.findByTestId('evidence-bulk-export')
    expect(bulk).toBeDisabled()
    const reason = within(screen.getByTestId('evidence-bulk')).getByTestId('role-reason')
    expect(reason).toHaveTextContent('Requires the Supervisor role')
    expect(bulk).toHaveAttribute('aria-describedby', reason.id)
    fireEvent.click(bulk)
    expect(screen.queryByTestId('export-wizard')).not.toBeInTheDocument()
    expect(requests('exportEvidence')).toHaveLength(0)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('NEGATIVE CONTROL: a SUPERVISOR with the same rows selected has the bulk Export enabled and no reason line', async () => {
    opened = await openLiveEvidence('/evidence', {})
    await screen.findByTestId('evidence-list-body', {}, UI)
    fireEvent.click(await screen.findByRole('checkbox', { name: new RegExp(`^${en.evidence.table.selectRow.replace('{{id}}', SELECTED[0])}\\b`) }, UI))
    expect(await screen.findByTestId('evidence-bulk-export')).not.toBeDisabled()
    expect(within(screen.getByTestId('evidence-bulk')).queryByTestId('role-reason')).toBeNull()
  })
})
