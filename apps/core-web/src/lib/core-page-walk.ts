/**
 * The ONE paged walk of the Core's lists for an export file (plan row W1; decisions D178 DC-4 and
 * FW76-5, D176). It replaces the two copies of W75 (`features/security-audit/export-file.ts`, the
 * audit export) and W76 (`features/system/live-log-export.ts`, the log export).
 *
 * The Core writes no export file and returns none (01_specs §11: "An audit or log export file | Built
 * by the client from server rows (operations 59 and 63) after the server accepted the export";
 * 04_client_integration_spec §8.2 A7, A8; AC-C-60; implementation/39 §7.4, §12). Once it accepted an
 * export, the page reads:
 *
 * | Walk | Operation | Ends | Checked |
 * |------|-----------|------|---------|
 * | `walkAuditChain` | 59 `listAuditRows`, oldest first | at the rows the export covers (the AUDIT_EXPORTED row's sequence minus one); without a known count, before the AUDIT_EXPORTED row of the export, or at the last page | the rows are 1, 2, 3, … without a gap, as many as the export covers, ending on its head (the chain check) |
 * | `walkAllEvents` | 63 `listEvents` | at the last page | — |
 *
 * Every walk:
 * - reads EVERY page, `CORE_PAGE_LIMIT` (200, the contract's largest page, API-9) a page, following
 *   `nextCursor`: the Core's tables may hold more than the rings the socket keeps, so a ring is never
 *   the file;
 * - asks `signedIn()` before EVERY page (decision D176, finding F75-2: a Core read runs only while an
 *   operator is signed in). After a sign-out (or any session end) it sends nothing more and ends as
 *   the Core would have answered: a 401 `NOT_SIGNED_IN` failure, which the refusal presenter leaves
 *   silent (the shell shows the login screen with its own notice);
 * - never returns a partial list: a refused page or an outage, a chain that moved (a reset discarded
 *   it meanwhile: the Core answers 422 to the old cursor), or a server that keeps handing out cursors
 *   each THROW the page's own error, built by `fail` (its name and code are the page's record).
 *
 * Pure: the page hands in its reader (the Live source's typed client, rule 1 — read structurally, so
 * no page imports the typed client here), its session check and its error.
 */
import { ApiErrorCode, type AuditPage, type EventPage } from '@dems/shared/api'
import type { AuditRow, SimEvent } from '@dems/shared/sim'

/** Rows per page of operations 59 and 63: the contract's largest page (API-9). */
export const CORE_PAGE_LIMIT = 200

/** A hard stop for a walk that never ends (a server that keeps handing out cursors). */
const MAX_PAGES = 10_000

/** A failed answer of the typed client, read structurally. Kept whole, so the presenter gets the object the client returned. */
export interface CorePageFailure {
  readonly ok: false
  readonly status: number | null
  readonly error: { readonly code: string }
}

export type CorePageAnswer<Data> = { readonly ok: true; readonly data: Data } | CorePageFailure

/** Reads one page after `cursor` (null: the first page). */
export type CorePageReader<Data> = (cursor: string | null) => Promise<CorePageAnswer<Data>>

/** Which list a walk reads. */
export type CoreWalkList = 'AUDIT' | 'EVENTS'

/** Why a walk did not produce its list. */
export type CoreWalkFailure =
  /** A page was not answered with rows (the refusal or the outage, as the typed client returned it), or the session ended (`SIGNED_OUT_PAGE`). */
  | { readonly kind: 'CALL'; readonly list: CoreWalkList; readonly failure: CorePageFailure }
  /** The audit rows walked do not end on the export's head, or a sequence is missing: the chain moved. */
  | { readonly kind: 'CHAIN'; readonly walked: number; readonly lastSeq: number | null }
  /** The server kept handing out cursors. */
  | { readonly kind: 'ENDLESS'; readonly list: CoreWalkList }

/**
 * What a walk ends with when the session is over before a page (D176): the Core's own answer to a call
 * without a session, in the typed client's shape (`transport: null`: a refusal, not an outage), so the
 * presenter treats it exactly as that 401.
 */
export const SIGNED_OUT_PAGE: CorePageFailure & { readonly transport: null; readonly retryAfterSeconds: null } = {
  ok: false,
  status: 401,
  error: { code: ApiErrorCode.NOT_SIGNED_IN },
  transport: null,
  retryAfterSeconds: null,
}

export interface CoreWalkOptions {
  /** Asked before every page (D176); `false` ends the walk with `SIGNED_OUT_PAGE` and sends nothing more. */
  readonly signedIn: () => boolean
  /** The page's own error for a failure: the walk throws what this returns. */
  readonly fail: (reason: CoreWalkFailure) => Error
  /** After each page read, with its number (1, 2, …). */
  readonly onPage?: (read: number) => void
}

/** What the audit walk is bound to: the rows the export covers and the hash of the last of them, when known. */
export interface AuditChainTarget {
  readonly exportId: string
  /** Rows the export covers (the AUDIT_EXPORTED row's sequence minus one); null when that row was not seen. */
  readonly rows: number | null
  /** Hash of the last covered row (the AUDIT_EXPORTED row's `prevHash`); null when unknown. */
  readonly head: string | null
}

/** One page, only while signed in; a refused page throws the page's error. */
async function readSignedIn<Data>(readPage: CorePageReader<Data>, cursor: string | null, list: CoreWalkList, options: CoreWalkOptions): Promise<Data> {
  if (!options.signedIn()) throw options.fail({ kind: 'CALL', list, failure: SIGNED_OUT_PAGE })
  const answer = await readPage(cursor)
  if (!answer.ok) throw options.fail({ kind: 'CALL', list, failure: answer })
  return answer.data
}

/** Reads the stored chain (operation 59) from the first row up to the export's rows, then checks it. */
export async function walkAuditChain(readPage: CorePageReader<AuditPage>, target: AuditChainTarget, options: CoreWalkOptions): Promise<AuditRow[]> {
  const rows: AuditRow[] = []
  let cursor: string | null = null
  let finished = false
  for (let read = 1; read <= MAX_PAGES && !finished; read += 1) {
    const page: AuditPage = await readSignedIn(readPage, cursor, 'AUDIT', options)
    for (const row of page.rows as AuditRow[]) {
      const enough = target.rows !== null && rows.length >= target.rows
      const exportRow = target.rows === null && row.type === 'AUDIT_EXPORTED' && row.details.exportId === target.exportId
      if (enough || exportRow) {
        finished = true
        break
      }
      rows.push(row)
    }
    options.onPage?.(read)
    cursor = page.nextCursor
    if (cursor === null || (target.rows !== null && rows.length >= target.rows)) finished = true
  }
  if (!finished) throw options.fail({ kind: 'ENDLESS', list: 'AUDIT' })
  checkChain(rows, target, options.fail)
  return rows
}

/** The walked rows are 1, 2, 3, … without a gap, as many as the export covers, ending on its head. */
function checkChain(rows: readonly AuditRow[], target: AuditChainTarget, fail: CoreWalkOptions['fail']): void {
  const last = rows.at(-1) ?? null
  const moved = (): never => {
    throw fail({ kind: 'CHAIN', walked: rows.length, lastSeq: last?.seq ?? null })
  }
  if (target.rows !== null && rows.length !== target.rows) moved()
  for (let index = 0; index < rows.length; index += 1) if ((rows[index] as AuditRow).seq !== index + 1) moved()
  if (target.head !== null && last !== null && last.hash !== target.head) moved()
}

/** Reads every operational event (operation 63), page after page, to the last one. */
export async function walkAllEvents(readPage: CorePageReader<EventPage>, options: CoreWalkOptions): Promise<SimEvent[]> {
  const events: SimEvent[] = []
  let cursor: string | null = null
  for (let read = 1; read <= MAX_PAGES; read += 1) {
    const page: EventPage = await readSignedIn(readPage, cursor, 'EVENTS', options)
    events.push(...(page.events as SimEvent[]))
    options.onPage?.(read)
    cursor = page.nextCursor
    if (cursor === null) return events
  }
  throw options.fail({ kind: 'ENDLESS', list: 'EVENTS' })
}
