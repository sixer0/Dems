/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W75: settle site A7 of the Security & Audit page — "Export audit" (`exportAudit` →
// operation 61, `features/security-audit/export-audit-dialog.tsx`) — and the export FILE, built from
// every page of operation 59 `listAuditRows` — in Live mode on the contract-checked fake transport,
// and the same dialog in Simulated mode as the control group (backend task
// 04_client_integration_spec §8.2 A7, §8.1 LB-1, LB-2, LB-6, LB-10, §6.2; AC-C-48, AC-C-60;
// decision F59; gate CLG (b) and the row's own check of 02_plan §11). The page of this file is
// `http://127.0.0.1:5178/`.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | AC-C-60, the row's check: with 450 rows on the fake server the audit export file holds 450 rows, read from all pages of operation 59 (200 a page), not from the 200-row ring the socket holds | "A7 success and the file" |
// | A7 202: one POST with the reason; the receipt from the AUDIT_EXPORTED row in the replica (CL-16); the step shows the page count; the success toast says nothing of a simulation | "A7 success and the file" |
// | A7 refusal, AC-C-48: a 403 NOT_PERMITTED (`notPermitted` example) shows the denied toast naming the Supervisor; the dialog keeps the reason; Export is idle | "A7 refusal" |
// | A7 422: the reason field's error; the Core is the judge (F59) | "A7 refusal" |
// | A7 outage and limit (LB-6, LB-10): the presenter's sentence; the dialog keeps the reason | "A7 outage" |
// | LB-1: busy at once, a second press sends nothing, the spinner late, Cancel waits for the answer | "A7 pending" |
// | The file cannot be built (a page refused, the chain moved): no partial file; the inline sentence names the export the Core recorded | "the file" |
// | Simulated: the dialog runs the simulator's export in the press, builds no file and keeps its words | "Simulated mode is unchanged" |
import { act, cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuditRowBody } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { rateLimited, type FakeCommandOptions } from '@dems/shared/live/testing'
import { appendAudit, OPERATOR_IDS, type AuditLogSlice, type AuditRow, type Sim, type SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import type { LivePage, LiveTestBed } from '@/runtime/testing/live-harness'
import {
  auditChain,
  clearToasts,
  cursorOf,
  liveSecurityAudit,
  makeSim,
  ringOf,
  simulatedSecurityAudit,
  stubViewport,
  toastTexts,
  toastWith,
} from '@/features/security-audit/__tests__/live-security-audit-bed'
import type { AuditExportFile } from '@/features/security-audit/export-file'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 40_000 })

const X = en.securityAudit.exportAudit
const LX = en.securityAudit.live.exportAudit
const OFFLINE = en.common.coreErrors.offline
const LIMITED = (seconds: number) => en.common.coreErrors.limited.replace('{{seconds}}', String(seconds))
const DENIED = X.denied.replace('{{role}}', 'Supervisor')
const REASON = 'Quarterly audit review by the supervisor'
const EXPORT_ID = 'EXP-000032'

type Ops = FakeCommandOptions['ops']

let bed: LiveTestBed | undefined
let loaded: LivePage | undefined
let restoreViewport: () => void = () => undefined
const sims: Sim[] = []
let blobs: Blob[] = []
let clicks: HTMLAnchorElement[] = []

const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)
const records = (source: string) => webErrorSink.records().filter((record) => record.source === source)

/**
 * The Core of this file: a stored chain of `stored` rows (the table operation 59 reads), of which the
 * socket's ring holds only the newest `ring` (so the file can only come from the pages). The export
 * appends its AUDIT_EXPORTED row to both, as the Core does.
 */
function coreWith(stored: number, ring: number) {
  let table: AuditLogSlice = auditChain(stored, Date.now())
  const served = (idle: SimState): SimState => ({ ...idle, audit: ringOf(table, ring) })
  /** The Core accepts the export: the AUDIT_EXPORTED row (its details as the simulator writes them, `rows` = the ring, F-1 of row 39). */
  const accept = (): { ops: Ops; head: string; exportRow: AuditRow } => {
    const head = table.head
    const appended = appendAudit(
      table,
      {
        type: 'AUDIT_EXPORTED',
        message: `Audit log exported (${ring} rows)`,
        actorId: OPERATOR_IDS.ANDI,
        details: { exportId: EXPORT_ID, rows: ring, head, chainOk: true, eventKind: 'EXPORT', reason: REASON, destination: 'Audit archive (simulated)' },
      },
      table.rows.at(-1)!.at + 1_000,
      100_000,
    )
    table = appended.log
    const kept = ringOf(table, ring)
    return {
      ops: [{ op: 'append', slice: 'audit', rows: [appended.row], head: kept.head, total: kept.total, dropped: kept.dropped }] as Ops,
      head,
      exportRow: appended.row,
    }
  }
  /** Operation 59: the stored table, ascending, `limit` a page, the cursor of the last row of a page. */
  const listAuditRows = (call: { query: Readonly<Record<string, string>> }) => {
    const limit = Number(call.query.limit ?? 50)
    const cursor = call.query.cursor
    let start = 0
    if (cursor !== undefined) {
      const index = table.rows.findIndex((row) => cursorOf(row) === cursor)
      if (index < 0) return bed!.fake.example('listAuditRows', 422, 'invalidQuery')
      start = index + 1
    }
    const rows = table.rows.slice(start, start + limit) as unknown as AuditRowBody[]
    const more = start + limit < table.rows.length
    return {
      status: 200,
      body: { rows, head: table.head, total: table.total, nextCursor: more ? cursorOf(rows.at(-1) as unknown as AuditRow) : null },
    }
  }
  return { served, accept, listAuditRows, table: () => table }
}

async function live(core: ReturnType<typeof coreWith>, options: Parameters<typeof liveSecurityAudit>[0] = {}) {
  const created = await liveSecurityAudit({ served: core.served, ...options })
  bed = created.bed
  loaded = created.page
  created.bed.fake.answer('listAuditRows', core.listAuditRows)
  return created
}

/** Opens the dialog, types the reason and returns the dialog. */
async function openDialog(reason = REASON): Promise<HTMLElement> {
  fireEvent.click(await screen.findByTestId('export-audit'))
  const dialog = await screen.findByTestId('export-audit-dialog')
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: reason } })
  return dialog
}

/** The text of the one file handed to the browser, parsed. */
async function downloadedFile(): Promise<AuditExportFile> {
  await waitFor(() => expect(blobs).toHaveLength(1), { timeout: 15_000 })
  const blob = blobs[0]!
  expect(blob.type).toBe('application/json')
  const text = typeof blob.text === 'function' ? await blob.text() : await new Response(blob).text()
  return JSON.parse(text) as AuditExportFile
}

beforeAll(() => {
  restoreViewport = stubViewport()
})

afterAll(() => {
  restoreViewport()
})

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  blobs = []
  clicks = []
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn((blob: Blob) => {
      blobs.push(blob)
      return `blob:audit-${blobs.length}`
    }),
  })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
    clicks.push(this)
  })
})

afterEach(async () => {
  const misuse = loaded?.sink.records().filter((record) => record.source === 'live.misuse') ?? []
  loaded = undefined
  cleanup()
  await clearToasts()
  bed?.dispose()
  bed = undefined
  for (const sim of sims.splice(0)) sim.stop()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  expect(misuse.map((record) => `${record.level} ${record.message}`)).toEqual([])
})

describe('A7 success and the file (§8.2 A7; AC-C-60)', () => {
  it('with 450 rows on the fake server the export file holds 450 rows: one POST, then all pages of operation 59 (200 a page), seq 1..450, ending on the export\'s head', async () => {
    const core = coreWith(450, 200)
    const { bed, page } = await live(core)
    expect(page.live.store.getState().audit.rows).toHaveLength(200)
    const accepted = core.accept()
    bed.fake.scriptCommand('exportAudit', {
      ops: accepted.ops,
      order: 'delta-first',
      answer: { status: 202, body: { exportId: EXPORT_ID, scope: 'AUDIT', rows: 450, head: accepted.head } },
    })
    const dialog = await openDialog()
    expect(dialog).toHaveTextContent(LX.destinationValue)
    expect(dialog).not.toHaveTextContent(X.destinationValue)
    fireEvent.click(within(dialog).getByTestId('export-confirm'))

    await waitFor(() => expect(toastWith(LX.success)).toHaveLength(1))
    expect(toastWith(LX.success)[0]).toContain(X.successBody.replace('{{exportId}}', EXPORT_ID).replace('{{count}}', '450'))
    expect(requests('exportAudit')).toHaveLength(1)
    expect(requests('exportAudit')[0]).toMatchObject({ method: 'POST', path: '/api/v1/audit/export', body: { reason: REASON } })

    const file = await downloadedFile()
    expect(file.rows).toHaveLength(450)
    expect(file.rows.map((row) => row.seq)).toEqual(Array.from({ length: 450 }, (_, index) => index + 1))
    expect(file.rows.at(-1)?.hash).toBe(accepted.head)
    expect(file).toMatchObject({ kind: 'dems-audit-export', source: 'core-server', exportId: EXPORT_ID, scope: 'AUDIT', reason: REASON, chain: { rows: 450, head: accepted.head } })
    // The AUDIT_EXPORTED row itself is not in the file: it is the record of the file.
    expect(file.rows.some((row) => row.type === 'AUDIT_EXPORTED')).toBe(false)
    expect(clicks.at(-1)?.download).toBe(`dems-audit-${EXPORT_ID}.json`)

    // All pages of operation 59, 200 rows a page, each after the cursor of the page before.
    const pages = requests('listAuditRows')
    expect(pages).toHaveLength(3)
    expect(pages.map((call) => call.query.limit)).toEqual(['200', '200', '200'])
    expect(pages[0]?.query.cursor).toBeUndefined()
    expect(pages[1]?.query.cursor).toBe(cursorOf(core.table().rows[199]!))
    expect(pages[2]?.query.cursor).toBe(cursorOf(core.table().rows[399]!))

    // The result: the Core's export ID, the stored rows covered (not the ring's 200), the file.
    const result = await screen.findByTestId('export-audit-result', {}, { timeout: 12_000 })
    expect(result).toHaveTextContent(EXPORT_ID)
    expect(result).toHaveTextContent(LX.reasonNote)
    expect(within(result).getByTestId('export-audit-file')).toHaveAttribute('data-rows', '450')
    expect(toastTexts().join(' ')).not.toMatch(/simulat/i)

    // Download again hands the same file to the browser once more.
    fireEvent.click(within(result).getByTestId('export-audit-download'))
    await waitFor(() => expect(blobs).toHaveLength(2))
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the step "Build export package" shows the page count while the pages are read', async () => {
    const core = coreWith(450, 200)
    const { bed } = await live(core)
    const accepted = core.accept()
    bed.fake.scriptCommand('exportAudit', {
      ops: accepted.ops,
      order: 'delta-first',
      answer: { status: 202, body: { exportId: EXPORT_ID, scope: 'AUDIT', rows: 450, head: accepted.head } },
    })
    // The first page is answered, the second waits: the pipeline holds on its build step and names the page.
    let pageCount = 0
    bed.fake.answerOnce('listAuditRows', (call) => {
      pageCount += 1
      return core.listAuditRows(call)
    })
    const held = bed.fake.hold('listAuditRows')
    const dialog = await openDialog()
    fireEvent.click(within(dialog).getByTestId('export-confirm'))
    await waitFor(() => expect(screen.getByTestId('export-audit-pages')).toHaveTextContent(LX.readingPages.replace('{{page}}', '2').replace('{{pages}}', '3')), { timeout: 10_000 })
    expect(pageCount).toBe(1)
    // Longer than the five steps' pace (5 × 220 ms): the pipeline still holds on its build step.
    await new Promise((resolve) => setTimeout(resolve, 1_600))
    expect(screen.queryByTestId('export-audit-result')).not.toBeInTheDocument()
    expect(screen.getByTestId('export-audit-pages')).toHaveTextContent(LX.readingPages.replace('{{page}}', '2').replace('{{pages}}', '3'))
    await act(async () => {
      held.release(core.listAuditRows({ query: held.call?.query ?? {} }) as never)
    })
    await bed.flush()
    const file = await downloadedFile()
    expect(file.rows).toHaveLength(450)
    await screen.findByTestId('export-audit-result', {}, { timeout: 12_000 })
  })
})

describe('A7 refusal (§6.2; AC-C-48; F59)', () => {
  it('AC-C-48: a 403 NOT_PERMITTED (the contract\'s `notPermitted` example) shows the denied toast naming the Supervisor; the dialog keeps the reason; Export is idle; no page is read', async () => {
    const core = coreWith(30, 30)
    const { bed } = await live(core)
    bed.fake.answerOnce('exportAudit', bed.fake.example('exportAudit', 403, 'notPermitted'))
    const dialog = await openDialog()
    fireEvent.click(within(dialog).getByTestId('export-confirm'))
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(DENIED)
    expect(within(dialog).getByRole('textbox')).toHaveValue(REASON)
    const confirm = within(dialog).getByTestId('export-confirm')
    expect(confirm).not.toHaveAttribute('aria-busy')
    expect(confirm).not.toHaveAttribute('data-pending')
    expect(screen.queryByTestId('export-audit-result')).not.toBeInTheDocument()
    expect(requests('listAuditRows')).toHaveLength(0)
    expect(blobs).toHaveLength(0)
    expect(toastWith(LX.success)).toHaveLength(0)
  })

  it('a 422 is the reason field\'s error: the Core is the judge of the reason; typing clears it', async () => {
    const core = coreWith(30, 30)
    const { bed } = await live(core)
    // The Core refuses a reason the form's own bound let through (F59; on a lane: three astral
    // characters, six UTF-16 code units, which the Core counts as three — a body the contract-checked
    // fake refuses to carry, so the refusal is scripted here for a reason the contract accepts).
    bed.fake.answerOnce('exportAudit', bed.fake.example('exportAudit', 422, 'invalidReason'))
    const dialog = await openDialog()
    fireEvent.click(within(dialog).getByTestId('export-confirm'))
    await waitFor(() => expect(within(dialog).getByText(LX.reasonRefused)).toBeInTheDocument())
    expect(within(dialog).getByRole('textbox')).toHaveValue(REASON)
    expect(toastWith(X.reasonError.replace('{{min}}', '5'))).toHaveLength(0)
    expect(toastWith(LX.success)).toHaveLength(0)
    expect(requests('listAuditRows')).toHaveLength(0)
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: `${REASON}, second request` } })
    await waitFor(() => expect(within(dialog).queryByText(LX.reasonRefused)).not.toBeInTheDocument())
  })
})

describe('A7 outage (LB-6; LB-10)', () => {
  it('no answer: the presenter\'s sentence once; no page toast; the dialog keeps the reason and offers Export again', async () => {
    const core = coreWith(30, 30)
    const { bed } = await live(core)
    bed.fake.failOnce('exportAudit')
    const dialog = await openDialog()
    fireEvent.click(within(dialog).getByTestId('export-confirm'))
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(toastWith(X.failed)).toHaveLength(0)
    expect(within(dialog).getByRole('textbox')).toHaveValue(REASON)
    await waitFor(() => expect(within(dialog).getByTestId('export-confirm')).not.toHaveAttribute('aria-busy'))
    expect(records('SecurityAudit.ExportAuditDialog.submit')).toHaveLength(0)
    expect(requests('listAuditRows')).toHaveLength(0)
  })

  it('LB-10: a 429 shows the limit toast with the seconds of `retry-after`, never the outage sentence', async () => {
    const core = coreWith(30, 30)
    const { bed } = await live(core)
    bed.fake.answerOnce('exportAudit', rateLimited(9))
    const dialog = await openDialog()
    fireEvent.click(within(dialog).getByTestId('export-confirm'))
    await waitFor(() => expect(toastWith(LIMITED(9))).toHaveLength(1))
    expect(toastWith(OFFLINE)).toHaveLength(0)
    expect(within(dialog).getByRole('textbox')).toHaveValue(REASON)
  })
})

describe('A7 pending (LB-1)', () => {
  it('busy at once with the same look; a second press sends nothing; the spinner late; Cancel waits for the answer', async () => {
    const core = coreWith(30, 30)
    const { bed } = await live(core)
    const accepted = core.accept()
    const held = bed.fake.hold('exportAudit')
    const dialog = await openDialog()
    const confirm = within(dialog).getByTestId('export-confirm')
    fireEvent.click(confirm)
    await waitFor(() => expect(requests('exportAudit')).toHaveLength(1))
    await bed.flush()
    expect(confirm).toHaveAttribute('aria-busy', 'true')
    expect(confirm).not.toHaveAttribute('data-pending')
    fireEvent.click(confirm)
    await bed.flush()
    expect(requests('exportAudit')).toHaveLength(1)
    // LB-6: while the Core has not answered the dialog cannot be dismissed and keeps the reason.
    expect(within(dialog).getByRole('button', { name: en.common.actions.cancel })).toBeDisabled()
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' })
    fireEvent.keyUp(dialog, { key: 'Escape', code: 'Escape' })
    await bed.flush()
    expect(screen.getByTestId('export-audit-dialog')).toBe(dialog)
    expect(within(dialog).getByRole('textbox')).toHaveValue(REASON)
    await waitFor(() => expect(confirm).toHaveAttribute('data-pending', 'true'), { timeout: 3_000 })
    expect(confirm.querySelector('[data-slot="spinner"], svg')).not.toBeNull()
    // The answer arrives (its delta first): the export goes on.
    bed.fake.connection().delta(accepted.ops, { revision: bed.fake.position.revision + 1 })
    await act(async () => {
      held.release({ status: 202, body: { exportId: EXPORT_ID, scope: 'AUDIT', rows: 30, head: accepted.head } })
    })
    await bed.flush()
    const file = await downloadedFile()
    expect(file.rows).toHaveLength(30)
    expect(requests('exportAudit')).toHaveLength(1)
  })
})

describe('the file (no partial file)', () => {
  it('a page the Core does not answer: the presenter\'s sentence; the inline sentence names the export the Core recorded; no file; the build step failed', async () => {
    const core = coreWith(450, 200)
    const { bed } = await live(core)
    const accepted = core.accept()
    bed.fake.scriptCommand('exportAudit', {
      ops: accepted.ops,
      order: 'delta-first',
      answer: { status: 202, body: { exportId: EXPORT_ID, scope: 'AUDIT', rows: 450, head: accepted.head } },
    })
    bed.fake.answerOnce('listAuditRows', core.listAuditRows)
    bed.fake.answerOnce('listAuditRows', () => ({ outage: true }))
    const dialog = await openDialog()
    fireEvent.click(within(dialog).getByTestId('export-confirm'))
    const failed = LX.fileFailed.replace('{{exportId}}', EXPORT_ID)
    await waitFor(() => expect(within(screen.getByTestId('export-audit-dialog')).getByRole('alert')).toHaveTextContent(failed), { timeout: 12_000 })
    expect(toastWith(OFFLINE)).toHaveLength(1)
    // The presenter spoke for the outage: the page adds no toast of its own and no record.
    expect(toastWith(failed)).toHaveLength(0)
    expect(records('SecurityAudit.ExportAuditDialog.buildFile')).toHaveLength(0)
    expect(blobs).toHaveLength(0)
    expect(requests('listAuditRows')).toHaveLength(2)
    expect(screen.queryByTestId('export-audit-file')).not.toBeInTheDocument()
    expect(screen.getByTestId('export-audit-result')).toHaveTextContent(EXPORT_ID)
  })

  it('a chain that moved (the walk does not end on the export\'s head): no file; the page\'s toast and one record with no text', async () => {
    const core = coreWith(450, 200)
    const { bed } = await live(core)
    const accepted = core.accept()
    bed.fake.scriptCommand('exportAudit', {
      ops: accepted.ops,
      order: 'delta-first',
      // The Core names a head the stored rows do not end on: a reset discarded the chain meanwhile.
      answer: { status: 202, body: { exportId: EXPORT_ID, scope: 'AUDIT', rows: 450, head: accepted.head } },
    })
    // The pages of another chain: as many rows, other hashes.
    const other = auditChain(451, Date.now() - 5_000)
    bed.fake.answer('listAuditRows', (call) => {
      const cursor = call.query.cursor
      const start = cursor === undefined ? 0 : other.rows.findIndex((row) => cursorOf(row) === cursor) + 1
      const rows = other.rows.slice(start, start + 200)
      return { status: 200, body: { rows: rows as unknown as AuditRowBody[], head: other.head, total: other.total, nextCursor: start + 200 < other.rows.length ? cursorOf(rows.at(-1)!) : null } }
    })
    const dialog = await openDialog()
    fireEvent.click(within(dialog).getByTestId('export-confirm'))
    const failed = LX.fileFailed.replace('{{exportId}}', EXPORT_ID)
    await waitFor(() => expect(toastWith(failed)).toHaveLength(1), { timeout: 12_000 })
    expect(blobs).toHaveLength(0)
    expect(records('SecurityAudit.ExportAuditDialog.buildFile')).toHaveLength(1)
    const [record] = records('SecurityAudit.ExportAuditDialog.buildFile')
    expect(record).toMatchObject({ level: 'error', message: 'Security & Audit: the step "ExportAuditDialog.buildFile" did not complete.' })
    expect(record?.context).toMatchObject({ exportId: EXPORT_ID, errorName: 'AuditWalkError', code: 'CHAIN_MOVED' })
    expect(String(record?.context?.correlationId)).toMatch(/^sa-/)
    expect(JSON.stringify(record)).not.toContain(REASON)
  })
})

// ── The control group: the same dialog in Simulated mode, as it was before this row ────────────

describe('Simulated mode is unchanged (CLG (a); §3.2)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
  })

  it('the Supervisor exports through the simulator in the press: the AUDIT_EXPORTED row at once, the "(simulated)" toast, the Simulated words, no file', async () => {
    const sim = makeSim(OPERATOR_IDS.ANDI)
    sims.push(sim)
    await simulatedSecurityAudit(sim)
    const before = sim.store.getState().audit.total
    const dialog = await openDialog('Internal review by the unit head')
    expect(dialog).toHaveTextContent(X.destinationValue)
    const confirm = within(dialog).getByTestId('export-confirm')
    fireEvent.click(confirm)
    // Synchronous: the simulator wrote its row in the press.
    expect(sim.store.getState().audit.total).toBe(before + 1)
    expect(sim.store.getState().audit.rows.at(-1)).toMatchObject({ type: 'AUDIT_EXPORTED', details: { reason: 'Internal review by the unit head' } })
    await waitFor(() => expect(toastWith(X.success)).toHaveLength(1))
    const result = await screen.findByTestId('export-audit-result', {}, { timeout: 12_000 })
    expect(result).toHaveTextContent(X.result.reasonNote)
    expect(within(result).queryByTestId('export-audit-file')).not.toBeInTheDocument()
    expect(blobs).toHaveLength(0)
    expect(screen.queryByTestId('export-audit-pages')).not.toBeInTheDocument()
  })
})
