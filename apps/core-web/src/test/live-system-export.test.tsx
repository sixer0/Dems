/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W76: settle site A8 of the System page — Export logs (`exportLogs` → operation 62) — in Live
// mode on the contract-checked fake transport, and the same button in Simulated mode as the control
// group (backend task 04_client_integration_spec §8.2 A8, §8.1 LB-1 to LB-10, §6.2, AC-C-48, AC-C-60;
// finding CPC1-22; decision F59; gate CLG (b) of 02_plan §11).
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | CPC1-22: in Live mode the page collects the reason the Core requires before anything is sent; a short reason is refused on the field and nothing is sent | "the reason" |
// | A8 success, AC-C-60: one POST to operation 62 with the reason; the file is built from ALL pages of operations 59 and 63 — 450 stored audit rows and 450 events while the socket's ring holds 100 and fewer — and the success toast names the export ID | "A8 success" |
// | F59: the Core's 422 INVALID_REASON is the judge — shown on the field, the dialog keeps the reason, no file | "A8 refusal" |
// | AC-C-48: the `notPermitted` 403 shows the denied toast naming the Supervisor role; nothing is read, no file | "A8 refusal" |
// | Outage of the export (LB-6: the dialog stays open with the reason) and a limit (LB-10) | "A8 outage" |
// | A page of operation 59 or 63 that fails, or a chain that moved between pages: never a partial file; the presenter, then the page's own sentence that the export was recorded | "A8 outage" |
// | LB-1: a second press while the export is out sends nothing | "A8 pending" |
// | Decision D176 (F75-2): after a sign-out the walk asks the Core for nothing more | "D176" |
// | Simulated mode is unchanged: no dialog, the simulator's file at once | "Simulated mode is unchanged" |
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuditRowBody, SimEventBody } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { OUTAGE, rateLimited, type FakeCommandOptions, type FakeHttpCall } from '@dems/shared/live/testing'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  appendAudit,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  emptyAuditLog,
  OPERATOR_IDS,
  type AuditLogSlice,
  type AuditRow,
  type Sim,
  type SimEvent,
  type SimState,
} from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createAppRouter } from '@/router'
import { webErrorSink } from '@/runtime'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const X = en.system.live.export
const M = en.system.maintenance
const DENIED_DESCRIPTION = en.common.rbac.requiresRole.replace('{{role}}', en.common.roles.SUPERVISOR)
const OFFLINE = en.common.coreErrors.offline
const LIMITED = (seconds: number) => en.common.coreErrors.limited.replace('{{seconds}}', String(seconds))
const EXPORT_ID = 'EXP-000101'
const REASON = 'Weekly review of the device logs'
const DONE = X.done.replace('{{exportId}}', EXPORT_ID)
const READ_FAILED = X.readFailed.replace('{{exportId}}', EXPORT_ID)

const originalMatchMedia = window.matchMedia
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}
const toastTexts = (): string[] => Array.from(document.querySelectorAll('[data-slot="toast"]')).map((element) => element.textContent ?? '')
const toastWith = (text: string) => toastTexts().filter((entry) => entry.includes(text))

Element.prototype.scrollIntoView ??= function scrollIntoView() {}

let bed: LiveTestBed | undefined
let blobs: Blob[] = []
const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)
const records = (source: string) => webErrorSink.records().filter((record) => record.source === source)

// ── The Core of this file: stored tables longer than the socket's rings ──────────────────────

const T0 = Date.parse('2026-10-05T08:00:00+07:00')
const cursorOf = (prefix: string, seq: number) => `${prefix}${seq}`

/** A stored audit chain of `count` rows, hash-chained as the Core stores it. */
function auditChain(count: number): AuditLogSlice {
  let log = emptyAuditLog()
  for (let index = 0; index < count; index += 1) {
    log = appendAudit(log, { type: 'DEVICE_COMMAND', message: `Device command ${index + 1}`, actorId: OPERATOR_IDS.RINA, deviceId: 'CAM-01', details: { command: 'IDENTIFY' } }, T0 + index * 1_000, 100_000).log
  }
  return log
}

/** The newest `size` rows of a chain, as the socket's ring holds them. */
function ringOf(table: AuditLogSlice, size: number): AuditLogSlice {
  const rows = table.rows.slice(-size)
  return { rows, head: table.head, total: table.total, dropped: table.total - rows.length }
}

/** `count` stored events, `LOG-NNNNNN`, by `seq`. */
function eventTable(count: number): SimEvent[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `LOG-${String(index + 1).padStart(6, '0')}`,
    seq: index + 1,
    at: T0 + index * 500,
    type: 'HEALTH_CHECK_OK',
    severity: 'INFO',
    message: `Health check ${index + 1}`,
    params: {},
    sessionId: null,
    deviceId: null,
  })) as SimEvent[]
}

function coreWith(stored: number, ring: number, events: number) {
  let table = auditChain(stored)
  const eventRows = eventTable(events)
  const served = (idle: SimState): SimState => ({ ...idle, audit: ringOf(table, ring), events: eventRows.slice(-Math.min(ring, events)) })
  /** The Core accepts the export: its AUDIT_EXPORTED row (scope LOGS) is appended to the table and the ring. */
  const accept = (): { ops: FakeCommandOptions['ops']; head: string; exportRow: AuditRow } => {
    const head = table.head
    const appended = appendAudit(
      table,
      {
        type: 'AUDIT_EXPORTED',
        message: `Logs exported (${ring} audit rows, ${events} events)`,
        actorId: OPERATOR_IDS.ANDI,
        details: { exportId: EXPORT_ID, rows: ring, head, chainOk: true, eventKind: 'EXPORT', scope: 'LOGS', events, reason: REASON, destination: 'Audit archive (simulated)' },
      },
      table.rows.at(-1)!.at + 1_000,
      100_000,
    )
    table = appended.log
    const kept = ringOf(table, ring)
    return {
      ops: [{ op: 'append', slice: 'audit', rows: [appended.row], head: kept.head, total: kept.total, dropped: kept.dropped }] as FakeCommandOptions['ops'],
      head,
      exportRow: appended.row,
    }
  }
  /** Operation 59: the stored table, ascending, `limit` a page, the cursor of a page's last row. */
  const listAuditRows = (call: FakeHttpCall) => {
    const limit = Number(call.query.limit ?? 50)
    const cursor = call.query.cursor
    let start = 0
    if (cursor !== undefined) {
      const index = table.rows.findIndex((row) => cursorOf('a', row.seq) === cursor)
      if (index < 0) return bed!.fake.example('listAuditRows', 422, 'invalidQuery')
      start = index + 1
    }
    const rows = table.rows.slice(start, start + limit)
    const more = start + limit < table.rows.length
    return {
      status: 200,
      body: { rows: rows as unknown as AuditRowBody[], head: table.head, total: table.total, nextCursor: more ? cursorOf('a', rows.at(-1)!.seq) : null },
    }
  }
  /** Operation 63: every stored event, oldest first. */
  const listEvents = (call: FakeHttpCall) => {
    const limit = Number(call.query.limit ?? 50)
    const cursor = call.query.cursor
    const start = cursor === undefined ? 0 : eventRows.findIndex((event) => cursorOf('e', event.seq) === cursor) + 1
    const page = eventRows.slice(start, start + limit)
    const more = start + limit < eventRows.length
    return { status: 200, body: { events: page as unknown as SimEventBody[], nextCursor: more ? cursorOf('e', page.at(-1)!.seq) : null } }
  }
  return { served, accept, listAuditRows, listEvents, table: () => table }
}

type Core = ReturnType<typeof coreWith>

async function liveSystem(core: Core): Promise<{ bed: LiveTestBed; page: LivePage }> {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  created.core.served = core.served(created.core.served)
  created.fake.answer('listAuditRows', core.listAuditRows)
  created.fake.answer('listEvents', core.listEvents)
  const page = await created.load()
  await created.mount(page, '/system')
  await screen.findByTestId('page-system')
  await screen.findByTestId('system-export-logs')
  return { bed: created, page }
}

/** Opens the dialog and types `reason`. */
async function openDialog(reason = REASON): Promise<HTMLElement> {
  fireEvent.click(screen.getByTestId('system-export-logs'))
  const dialog = await screen.findByTestId('system-export-dialog')
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: reason } })
  return dialog
}
const submit = (dialog: HTMLElement) => fireEvent.click(within(dialog).getByTestId('system-export-submit'))

/** The downloaded file, parsed. */
async function fileOf(blob: Blob): Promise<Record<string, unknown>> {
  const text = typeof blob.text === 'function' ? await blob.text() : await new Response(blob).text()
  return JSON.parse(text) as Record<string, unknown>
}

beforeEach(() => {
  resetMissingI18nKeys()
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
      return `blob:logs-${blobs.length}`
    }),
  })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
})

afterEach(async () => {
  cleanup()
  await clearToasts()
  bed?.dispose()
  bed = undefined
  vi.restoreAllMocks()
})

describe('the reason (CPC1-22; F59)', () => {
  it('Export logs opens the dialog and sends nothing; a reason under 5 characters is refused on the field and nothing is sent', async () => {
    await liveSystem(coreWith(30, 30, 10))
    expect(screen.getByTestId('system-panel-maintenance')).toHaveTextContent(en.system.live.exportLogsHint)
    const dialog = await openDialog('abc')
    expect(requests('exportLogs')).toHaveLength(0)
    submit(dialog)
    await bed!.flush()
    expect(within(dialog).getByTestId('system-export-reason-error')).toHaveTextContent(X.reasonTooShort.replace('{{min}}', '5'))
    expect(requests('exportLogs')).toHaveLength(0)
    expect(blobs).toHaveLength(0)
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('A8 success (§8.2 A8; AC-C-60)', () => {
  it('one POST with the reason; the file holds ALL 450 stored audit rows and ALL 450 events, read page by page, though the ring holds 100; the toast names the export ID', async () => {
    const core = coreWith(450, 100, 450)
    const { bed, page } = await liveSystem(core)
    expect(page.live.store.getState().audit.rows).toHaveLength(100)
    const accepted = core.accept()
    bed.fake.scriptCommand('exportLogs', {
      ops: accepted.ops,
      order: 'delta-first',
      answer: { status: 202, body: { exportId: EXPORT_ID, scope: 'LOGS', rows: 450, head: accepted.head } },
    })
    const dialog = await openDialog()
    submit(dialog)

    await waitFor(() => expect(blobs).toHaveLength(1), { timeout: 15_000 })
    expect(requests('exportLogs')).toHaveLength(1)
    expect(requests('exportLogs')[0]).toMatchObject({ method: 'POST', path: '/api/v1/logs/export', body: { reason: REASON } })
    // Every page of both lists, 200 a page, oldest first.
    expect(requests('listAuditRows').map((call) => call.query)).toEqual([{ limit: '200' }, { limit: '200', cursor: 'a200' }, { limit: '200', cursor: 'a400' }])
    expect(requests('listEvents').map((call) => call.query)).toEqual([{ limit: '200' }, { limit: '200', cursor: 'e200' }, { limit: '200', cursor: 'e400' }])

    const blob = blobs[0]!
    expect(blob.type).toBe('application/json')
    const file = await fileOf(blob)
    const audit = file.audit as { total: number; head: string; rows: AuditRow[] }
    expect(audit.rows).toHaveLength(450)
    expect(audit.total).toBe(450)
    expect(audit.rows.map((row) => row.seq)).toEqual(Array.from({ length: 450 }, (_, index) => index + 1))
    // The walk ends on the export's head: the hash of the row before its AUDIT_EXPORTED row.
    expect(audit.head).toBe(accepted.head)
    expect(audit.rows.some((row) => row.type === 'AUDIT_EXPORTED')).toBe(false)
    expect((file.events as SimEvent[]).map((event) => event.seq)).toEqual(Array.from({ length: 450 }, (_, index) => index + 1))
    expect(file).toMatchObject({ kind: 'dems-log-export', source: 'core-server', exportId: EXPORT_ID, scope: 'LOGS', reason: REASON, exportedAt: new Date(accepted.exportRow.at).toISOString() })
    expect(Array.isArray(file.services)).toBe(true)

    await waitFor(() => expect(toastWith(DONE)).toHaveLength(1))
    expect(toastWith(DONE)[0]).toContain(X.doneBody.replace('{{rows}}', '450').replace('{{events}}', '450'))
    await waitFor(() => expect(screen.queryByTestId('system-export-dialog')).toBeNull())
    expect(toastTexts().join(' ')).not.toMatch(/simulat/i)
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('A8 refusal (§6.2; AC-C-48; F59)', () => {
  it('the Core\'s 422 INVALID_REASON is shown on the field; the dialog keeps the reason; nothing is read and no file is made', async () => {
    const { bed } = await liveSystem(coreWith(30, 30, 10))
    bed.fake.answerOnce('exportLogs', bed.fake.example('exportLogs', 422, 'invalidReason'))
    const dialog = await openDialog()
    submit(dialog)
    await waitFor(() => expect(within(dialog).getByTestId('system-export-reason-error')).toHaveTextContent(X.reasonRefused))
    expect(within(dialog).getByRole('textbox')).toHaveValue(REASON)
    expect(screen.getByTestId('system-export-dialog')).toBeInTheDocument()
    expect(requests('listAuditRows')).toHaveLength(0)
    expect(blobs).toHaveLength(0)
    expect(toastTexts()).toEqual([])
  })

  it('AC-C-48: the `notPermitted` 403 shows the denied toast naming the Supervisor role; nothing is read; the control returns to idle', async () => {
    const { bed } = await liveSystem(coreWith(30, 30, 10))
    bed.fake.answerOnce('exportLogs', bed.fake.example('exportLogs', 403, 'notPermitted'))
    const dialog = await openDialog()
    const button = within(dialog).getByTestId('system-export-submit')
    submit(dialog)
    await waitFor(() => expect(toastWith(M.exportDenied)).toHaveLength(1))
    expect(toastWith(M.exportDenied)[0]).toContain(DENIED_DESCRIPTION)
    expect(button).not.toHaveAttribute('aria-busy')
    expect(requests('listAuditRows')).toHaveLength(0)
    expect(blobs).toHaveLength(0)
  })
})

describe('A8 outage (LB-6, LB-10)', () => {
  it('an export that gets no answer: the presenter\'s sentence; the dialog stays open with the reason; no file', async () => {
    const { bed } = await liveSystem(coreWith(30, 30, 10))
    bed.fake.failOnce('exportLogs')
    const dialog = await openDialog()
    submit(dialog)
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(screen.getByTestId('system-export-dialog')).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox')).toHaveValue(REASON)
    expect(within(dialog).getByTestId('system-export-submit')).not.toHaveAttribute('aria-busy')
    expect(blobs).toHaveLength(0)
  })

  it('LB-10: a 429 is a limit with the seconds of `retry-after`; the dialog keeps the reason', async () => {
    const { bed } = await liveSystem(coreWith(30, 30, 10))
    bed.fake.answerOnce('exportLogs', rateLimited(7))
    const dialog = await openDialog()
    submit(dialog)
    await waitFor(() => expect(toastWith(LIMITED(7))).toHaveLength(1))
    expect(toastWith(OFFLINE)).toHaveLength(0)
    expect(within(dialog).getByRole('textbox')).toHaveValue(REASON)
  })

  it('a page of operation 63 that gets no answer: no partial file; the presenter, then the sentence that the export was recorded; one record', async () => {
    const core = coreWith(250, 100, 450)
    const { bed } = await liveSystem(core)
    const accepted = core.accept()
    bed.fake.scriptCommand('exportLogs', { ops: accepted.ops, order: 'delta-first', answer: { status: 202, body: { exportId: EXPORT_ID, scope: 'LOGS', rows: 250, head: accepted.head } } })
    let eventPages = 0
    bed.fake.answer('listEvents', (call) => {
      eventPages += 1
      return eventPages === 2 ? OUTAGE : core.listEvents(call)
    })
    submit(await openDialog())
    await waitFor(() => expect(toastWith(READ_FAILED)).toHaveLength(1))
    // FXR-W W92-13 (FW76-3), by design: the export was accepted, so the outage toast never says
    // "Nothing was changed" beside the page's sentence that the Core recorded it.
    expect(toastWith(en.common.coreErrors.offlineAfterAccepted)).toHaveLength(1)
    expect(toastWith('Nothing was changed')).toHaveLength(0)
    expect(blobs).toHaveLength(0)
    const kept = records('System.Maintenance.exportLogs.read')
    expect(kept).toHaveLength(1)
    expect(kept[0]?.context).toMatchObject({ exportId: EXPORT_ID, list: 'EVENTS', errorName: 'LogWalkError' })
    expect(JSON.stringify(kept[0])).not.toContain(REASON)
  })

  it('a chain that moved between two pages (the Core answers 422 to the old cursor): never a partial file', async () => {
    const core = coreWith(450, 100, 10)
    const { bed } = await liveSystem(core)
    const accepted = core.accept()
    bed.fake.scriptCommand('exportLogs', { ops: accepted.ops, order: 'delta-first', answer: { status: 202, body: { exportId: EXPORT_ID, scope: 'LOGS', rows: 450, head: accepted.head } } })
    let auditPages = 0
    bed.fake.answer('listAuditRows', (call) => {
      auditPages += 1
      return auditPages === 2 ? bed.fake.example('listAuditRows', 422, 'invalidQuery') : core.listAuditRows(call)
    })
    submit(await openDialog())
    await waitFor(() => expect(toastWith(READ_FAILED)).toHaveLength(1))
    expect(blobs).toHaveLength(0)
    expect(records('System.Maintenance.exportLogs.read')[0]?.context).toMatchObject({ list: 'AUDIT', status: 422, errorName: 'LogWalkError' })
  })
})

describe('D176: no Core read after a sign-out', () => {
  it('the session ends while the walk waits for a page: no further page of 59 or 63 is asked for, no file, nothing said', async () => {
    const core = coreWith(450, 100, 450)
    const { bed, page } = await liveSystem(core)
    const accepted = core.accept()
    bed.fake.scriptCommand('exportLogs', { ops: accepted.ops, order: 'delta-first', answer: { status: 202, body: { exportId: EXPORT_ID, scope: 'LOGS', rows: 450, head: accepted.head } } })
    const heldPage = bed.fake.hold('listAuditRows')
    submit(await openDialog())
    await waitFor(() => expect(requests('listAuditRows')).toHaveLength(1))
    await bed.flush()
    // The Core ends the session (a sign-out in another tab): the socket says so, the console signs out.
    await act(async () => {
      bed.core.end('SIGNED_OUT')
    })
    await bed.flush()
    await waitFor(() => expect(page.live.session).toBeNull())
    await act(async () => {
      heldPage.release(core.listAuditRows(heldPage.call!))
    })
    await bed.flush()
    await bed.elapse(2_000)
    expect(requests('listAuditRows')).toHaveLength(1)
    expect(requests('listEvents')).toHaveLength(0)
    expect(blobs).toHaveLength(0)
    expect(toastWith(READ_FAILED)).toHaveLength(0)
    expect(records('System.Maintenance.exportLogs.read')).toHaveLength(0)
  })
})

describe('A8 the walk is checked (never a wrong file)', () => {
  it('a page that skips a row (a gap in the chain): no file; the page\'s sentence that the export was recorded; the record names CHAIN_MOVED', async () => {
    const core = coreWith(450, 100, 10)
    const { bed } = await liveSystem(core)
    const accepted = core.accept()
    bed.fake.scriptCommand('exportLogs', { ops: accepted.ops, order: 'delta-first', answer: { status: 202, body: { exportId: EXPORT_ID, scope: 'LOGS', rows: 450, head: accepted.head } } })
    bed.fake.answer('listAuditRows', (call) => {
      const answer = core.listAuditRows(call) as { status: number; body: { rows: AuditRowBody[] } }
      // The second page loses its first row (seq 201): the rows walked are no longer 1, 2, 3, ...
      if (call.query.cursor === 'a200') return { ...answer, body: { ...answer.body, rows: answer.body.rows.slice(1) } }
      return answer
    })
    submit(await openDialog())
    await waitFor(() => expect(toastWith(READ_FAILED)).toHaveLength(1))
    expect(blobs).toHaveLength(0)
    expect(records('System.Maintenance.exportLogs.read')[0]?.context).toMatchObject({ code: 'CHAIN_MOVED', errorName: 'LogWalkError' })
    expect(toastWith(DONE)).toHaveLength(0)
  })
})

describe('A8 pending (LB-1)', () => {
  it('the control stays busy while the pages are read: a second press sends no second export', async () => {
    const core = coreWith(30, 30, 10)
    const { bed } = await liveSystem(core)
    const accepted = core.accept()
    bed.fake.scriptCommand('exportLogs', { ops: accepted.ops, order: 'delta-first', answer: { status: 202, body: { exportId: EXPORT_ID, scope: 'LOGS', rows: 30, head: accepted.head } } })
    const heldPage = bed.fake.hold('listAuditRows')
    const dialog = await openDialog()
    const button = within(dialog).getByTestId('system-export-submit')
    submit(dialog)
    await waitFor(() => expect(requests('listAuditRows')).toHaveLength(1))
    await bed.flush()
    // The Core accepted; the file is being built: still busy, the page counter on screen.
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(within(dialog).getByTestId('system-export-progress')).toHaveTextContent(X.reading.replace('{{page}}', '1'))
    submit(dialog)
    await bed.flush()
    expect(requests('exportLogs')).toHaveLength(1)
    await act(async () => {
      heldPage.release(core.listAuditRows(heldPage.call!))
    })
    await waitFor(() => expect(blobs).toHaveLength(1), { timeout: 15_000 })
    expect(requests('exportLogs')).toHaveLength(1)
  })


  it('while the export is out a second press sends nothing; the reason field is locked; the file follows the answer', async () => {
    const core = coreWith(30, 30, 10)
    const { bed } = await liveSystem(core)
    const accepted = core.accept()
    const held = bed.fake.hold('exportLogs')
    const dialog = await openDialog()
    const button = within(dialog).getByTestId('system-export-submit')
    submit(dialog)
    await waitFor(() => expect(requests('exportLogs')).toHaveLength(1))
    await bed.flush()
    expect(button).toHaveAttribute('aria-busy', 'true')
    submit(dialog)
    await bed.flush()
    expect(requests('exportLogs')).toHaveLength(1)
    const revision = bed.fake.position.revision + 1
    await act(async () => {
      bed.fake.connection().delta(accepted.ops, { revision })
      held.release({ status: 202, body: { exportId: EXPORT_ID, scope: 'LOGS', rows: 30, head: accepted.head }, revision })
    })
    await waitFor(() => expect(blobs).toHaveLength(1), { timeout: 15_000 })
    expect(((await fileOf(blobs[0]!)).audit as { rows: unknown[] }).rows).toHaveLength(30)
  })
})

// ── The control group: Export logs in Simulated mode, as before this row ─────────────────────

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

describe('Simulated mode is unchanged', () => {
  const sims: Sim[] = []
  afterEach(() => {
    for (const sim of sims.splice(0)) sim.stop()
  })

  it('a SUPERVISOR exports at once, without a dialog and without a reason; the file is the simulator\'s', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
    const clock = createManualClock(Date.now())
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: clock.now() })
    const sim = createSim({ storage: null, authStorage, clock, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined, scenario: 'idle' })
    sims.push(sim)
    const router = createAppRouter(
      { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket() },
      { history: createMemoryHistory({ initialEntries: ['/system'] }) },
    )
    render(<RouterProvider router={router} />)
    await screen.findByTestId('page-system')
    expect(screen.getByTestId('system-panel-maintenance')).toHaveTextContent(M.exportLogsHint)
    fireEvent.click(screen.getByTestId('system-export-logs'))
    // Synchronous, as before: the audit row and the file in the press.
    expect(sim.store.getState().audit.rows.at(-1)?.type).toBe('AUDIT_EXPORTED')
    expect(blobs).toHaveLength(1)
    expect(screen.queryByTestId('system-export-dialog')).toBeNull()
    const file = await fileOf(blobs[0]!)
    expect(file).toMatchObject({ demo: true, notice: 'DEMO - simulated log export from the DEMS demo stack.' })
    await waitFor(() => expect(toastWith(M.exportDone.replace('{{rows}}', String(sim.store.getState().audit.rows.length)))).toHaveLength(1))
    vi.unstubAllGlobals()
  })
})
