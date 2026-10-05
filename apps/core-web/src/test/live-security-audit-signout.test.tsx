/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W1, item 2 (decisions D176, D182 DC-2 and DC-3): the audit export of the Security & Audit
// page reads operation 59 `listAuditRows` through the console's one paged walk
// (`lib/core-page-walk.ts`), which asks before EVERY page whether an operator is still signed in.
// After a sign-out the walk sends nothing more and ends as the Core would have answered (401
// `NOT_SIGNED_IN`), which the refusal presenter leaves silent: no page toast, no record, no file.
// The System page's twin is `live-system-export.test.tsx` "D176: no Core read after a sign-out"; the
// walk's own cases are `lib/__tests__/core-page-walk.test.ts`. W75's own export tests
// (`live-security-audit-export.test.tsx`) are not changed; this file borrows their Core's shape.
import { act, cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuditRowBody } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import type { FakeCommandOptions } from '@dems/shared/live/testing'
import { appendAudit, OPERATOR_IDS, type AuditLogSlice, type SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import type { LivePage, LiveTestBed } from '@/runtime/testing/live-harness'
import { auditChain, clearToasts, cursorOf, liveSecurityAudit, ringOf, stubViewport, toastWith } from '@/features/security-audit/__tests__/live-security-audit-bed'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 40_000 })

const LX = en.securityAudit.live.exportAudit
const REASON = 'Quarterly audit review by the supervisor'
const EXPORT_ID = 'EXP-000032'

type Ops = FakeCommandOptions['ops']

let bed: LiveTestBed | undefined
let loaded: LivePage | undefined
let restoreViewport: () => void = () => undefined
let blobs: Blob[] = []

const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)
const records = (source: string) => webErrorSink.records().filter((record) => record.source === source)

/**
 * The Core: a stored chain of `stored` rows (the table operation 59 reads), of which the socket's ring
 * holds the newest `ring`; the export appends its AUDIT_EXPORTED row to both, as the Core does.
 */
function coreWith(stored: number, ring: number) {
  let table: AuditLogSlice = auditChain(stored, Date.now())
  const served = (idle: SimState): SimState => ({ ...idle, audit: ringOf(table, ring) })
  const accept = (): { ops: Ops; head: string } => {
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
    return { ops: [{ op: 'append', slice: 'audit', rows: [appended.row], head: kept.head, total: kept.total, dropped: kept.dropped }] as Ops, head }
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
    return { status: 200, body: { rows, head: table.head, total: table.total, nextCursor: more ? cursorOf(table.rows[start + limit - 1]!) : null } }
  }
  return { served, accept, listAuditRows }
}

beforeAll(() => {
  restoreViewport = stubViewport()
})

afterAll(() => {
  restoreViewport()
})

beforeEach(() => {
  resetCoreErrorPresenter()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  blobs = []
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn((blob: Blob) => {
      blobs.push(blob)
      return `blob:audit-${blobs.length}`
    }),
  })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
})

afterEach(async () => {
  const misuse = loaded?.sink.records().filter((record) => record.source === 'live.misuse') ?? []
  loaded = undefined
  cleanup()
  await clearToasts()
  // Cleared before `dispose()`: a dispose that throws fails its own test only.
  const disposing = bed
  bed = undefined
  disposing?.dispose()
  vi.restoreAllMocks()
  expect(misuse.map((record) => `${record.level} ${record.message}`)).toEqual([])
})

describe('D176: the audit export walk sends no page after a sign-out', () => {
  it('the session ends while the walk waits for page 1: no further page of 59 is asked for; no file; nothing said', async () => {
    const core = coreWith(450, 200)
    const created = await liveSecurityAudit({ served: core.served })
    bed = created.bed
    loaded = created.page
    created.bed.fake.answer('listAuditRows', core.listAuditRows)
    const accepted = core.accept()
    created.bed.fake.scriptCommand('exportAudit', {
      ops: accepted.ops,
      order: 'delta-first',
      answer: { status: 202, body: { exportId: EXPORT_ID, scope: 'AUDIT', rows: 450, head: accepted.head } },
    })
    const held = created.bed.fake.hold('listAuditRows')
    fireEvent.click(await screen.findByTestId('export-audit'))
    const dialog = await screen.findByTestId('export-audit-dialog')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: REASON } })
    fireEvent.click(within(dialog).getByTestId('export-confirm'))
    await waitFor(() => expect(requests('listAuditRows')).toHaveLength(1))
    await created.bed.flush()

    // The Core ends the session (a sign-out in another tab): the socket says so, the console signs out.
    await act(async () => {
      created.bed.core.end('SIGNED_OUT')
    })
    await created.bed.flush()
    await waitFor(() => expect(created.page.live.session).toBeNull())
    await act(async () => {
      held.release(core.listAuditRows({ query: held.call?.query ?? {} }) as never)
    })
    await created.bed.flush()
    await created.bed.elapse(2_000)

    // The page that was out is the last one: nothing more was asked of a signed-out session.
    expect(requests('listAuditRows')).toHaveLength(1)
    expect(requests('listAuditRows').filter((call) => call.status === 401)).toEqual([])
    expect(blobs).toHaveLength(0)
    // The walk ended as the Core's own 401 would have: the presenter is silent, the page adds nothing.
    expect(toastWith(LX.fileFailed.replace('{{exportId}}', EXPORT_ID))).toHaveLength(0)
    expect(records('SecurityAudit.ExportAuditDialog.buildFile')).toHaveLength(0)
  })
})
