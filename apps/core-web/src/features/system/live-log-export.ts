/**
 * The log export FILE in Live mode (plan row W76; backend task 04_client_integration_spec §8.2 A8,
 * AC-C-60; 01_specs §11: "An audit or log export file | Built by the client from server rows
 * (operations 59 and 63) after the server accepted the export (operations 61, 62)";
 * implementation/39 §7.4, §12).
 *
 * The Core writes no file and returns none. Once it accepted the export (202, the AUDIT_EXPORTED row
 * in the replica), the console reads, through the console's one paged walk (`lib/core-page-walk.ts`,
 * plan row W1), only while an operator is signed in (D176: the walk asks before every page):
 *
 * - the STORED audit chain from operation 59 `listAuditRows` (`walkAuditChain`), oldest first, 200
 *   rows a page, following `nextCursor`, up to the rows the export covers: every row before its
 *   AUDIT_EXPORTED row (that row's sequence minus one, its `prevHash` the head; the Core's own answer
 *   counts the same way, implementation/39 §7.4). The table may hold more rows than the 1,000-row
 *   ring the socket keeps, so the ring is never the file. The walk must end on the export's head;
 *   anything else (a reset discarded the chain meanwhile: the Core answers 422 to the old cursor) is
 *   a failure, never a partial file;
 * - every operational event from operation 63 `listEvents` (`walkAllEvents`), 200 a page, to the
 *   last page (the table may hold more than the 500-event ring).
 *
 * This file keeps the page's own parts: its error (its name, code and list are the page's record),
 * the export's target, the file.
 *
 * Pure except `downloadJson`, which hands the finished text to the browser.
 */
import type { AuditPage, EventPage } from '@dems/shared/api'
import type { AuditRow, DiagnosticsRun, ServiceEntry, SimEvent } from '@dems/shared/sim'
import { downloadJsonFile } from '@/lib/download'
import {
  CORE_PAGE_LIMIT,
  walkAllEvents,
  walkAuditChain,
  type AuditChainTarget,
  type CorePageAnswer,
  type CorePageReader,
  type CoreWalkFailure,
} from '@/lib/core-page-walk'

/** Rows per page of operations 59 and 63: the contract's largest page (API-9). */
export const LOG_PAGE_LIMIT = CORE_PAGE_LIMIT

export type AuditPageAnswer = CorePageAnswer<AuditPage>
export type EventPageAnswer = CorePageAnswer<EventPage>

/** Why a walk did not produce the file (the walk's own failure: a page, the chain, an endless list). */
export type LogWalkFailure = CoreWalkFailure

export class LogWalkError extends Error {
  override readonly name = 'LogWalkError'
  readonly reason: LogWalkFailure
  /** The HTTP status of a refused page, for the page's record (never the text of the answer). */
  readonly status: number | null
  readonly code: string
  constructor(reason: LogWalkFailure) {
    super('The logs of the Core could not be read to the end of the export.')
    this.reason = reason
    this.status = reason.kind === 'CALL' ? reason.failure.status : null
    this.code = reason.kind === 'CALL' ? reason.failure.error.code : reason.kind === 'CHAIN' ? 'CHAIN_MOVED' : 'ENDLESS_LIST'
  }
}

/** What the audit walk is bound to: the rows the export covers and the hash of the last of them, when known. */
export interface LogExportTarget extends AuditChainTarget {
  /** When the Core accepted the export (the AUDIT_EXPORTED row's instant); null when unknown. */
  readonly at: number | null
}

/** The export's target, read from its AUDIT_EXPORTED row in the replica's ring (newest first). */
export function logExportTarget(rows: readonly AuditRow[], exportId: string): LogExportTarget {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index] as AuditRow
    if (row.type === 'AUDIT_EXPORTED' && row.details.exportId === exportId) {
      return { exportId, rows: row.seq - 1, head: row.prevHash, at: row.at }
    }
  }
  return { exportId, rows: null, head: null, at: null }
}

/** What both walks of the page take: the session check (D176) and the page counter. */
export interface LogWalkOptions {
  readonly signedIn: () => boolean
  readonly onPage?: (read: number) => void
}

const fail = (reason: LogWalkFailure) => new LogWalkError(reason)

/**
 * Reads the stored chain from the first row up to the export's rows. `onPage(read)` after each page.
 * Without a known row count it stops before the AUDIT_EXPORTED row of `exportId` (or at the last page).
 * Throws `LogWalkError`.
 */
export function readExportedAuditRows(readPage: CorePageReader<AuditPage>, target: LogExportTarget, options: LogWalkOptions): Promise<AuditRow[]> {
  return walkAuditChain(readPage, target, { ...options, fail })
}

/** Reads every operational event, page after page, to the last one. Throws `LogWalkError`. */
export function readAllEvents(readPage: CorePageReader<EventPage>, options: LogWalkOptions): Promise<SimEvent[]> {
  return walkAllEvents(readPage, { ...options, fail })
}

/** What `softwareVersion` of the file reads when a Core in its own capture has not stated its version. */
export const LOG_EXPORT_VERSION_NOT_REPORTED = 'not-reported'

/** The file's content: the export's identity, why it was made, the stored rows it covers and the events. */
export interface LogExportFile {
  readonly kind: 'dems-log-export'
  readonly source: 'core-server'
  /**
   * `true` on the demonstration (a simulated Core: its data is synthetic). ABSENT on a Core in its own capture
   * (fix wave J closing pass J4, item 3): its audit rows and events are what that Core recorded, not demo data.
   */
  readonly demo?: true
  /** What the file is: `LOG_EXPORT_NOTICE_DEMO` on the demonstration, `LOG_EXPORT_NOTICE_OWN_CAPTURE` on a Core in its own capture. */
  readonly notice: string
  readonly exportId: string
  readonly scope: 'LOGS'
  readonly reason: string
  readonly deviceId: string
  /** The demonstration model's version on the demonstration; on a Core in its own capture the Core server's own version (operation 64), or `not-reported` (JW-26). */
  readonly softwareVersion: string
  /** A Core in its own capture: each component by its id with the version its owner states (`null` = not stated). Absent on the demonstration. */
  readonly components?: readonly { readonly id: string; readonly version: string | null }[]
  readonly exportedAt: string
  readonly audit: { readonly total: number; readonly head: string | null; readonly rows: readonly AuditRow[] }
  readonly events: readonly SimEvent[]
  readonly services: readonly ServiceEntry[]
  readonly diagnostics: DiagnosticsRun | null
}

/** The file's statement about itself on the demonstration (a simulated Core). Unchanged wording. */
export const LOG_EXPORT_NOTICE_DEMO = 'DEMO - log export of the DEMS Core server (synthetic demo data). Built from every page of its audit chain and events.'
/** The same on a Core in its own capture: the Core's own records - no demo flag and no word of synthetic data. */
export const LOG_EXPORT_NOTICE_OWN_CAPTURE =
  'Log export of this DEMS Core server: the audit chain and the events this Core recorded, read from every page of both lists; services and diagnostics as this Core reported them to the console.'

export function buildLogExportFile(input: {
  /** This Core runs its own capture (`isOwnCaptureCoreState`): the file is that Core's record, not demo data. Absent or false: the demonstration. */
  ownCapture?: boolean
  exportId: string
  reason: string
  deviceId: string
  softwareVersion: string
  components?: readonly { readonly id: string; readonly version: string | null }[]
  at: number
  rows: readonly AuditRow[]
  events: readonly SimEvent[]
  services: readonly ServiceEntry[]
  diagnostics: DiagnosticsRun | null
}): LogExportFile {
  return {
    kind: 'dems-log-export',
    source: 'core-server',
    ...(input.ownCapture === true ? {} : { demo: true as const }),
    notice: input.ownCapture === true ? LOG_EXPORT_NOTICE_OWN_CAPTURE : LOG_EXPORT_NOTICE_DEMO,
    exportId: input.exportId,
    scope: 'LOGS',
    reason: input.reason,
    deviceId: input.deviceId,
    softwareVersion: input.softwareVersion,
    ...(input.components === undefined ? {} : { components: input.components }),
    exportedAt: new Date(input.at).toISOString(),
    audit: { total: input.rows.length, head: input.rows.at(-1)?.hash ?? null, rows: input.rows },
    events: input.events,
    services: input.services,
    diagnostics: input.diagnostics,
  }
}

/** Triggers a JSON download in the browser (`lib/download.ts`, W92-7). Throws when the platform cannot create the file. */
export function downloadJson(fileName: string, data: unknown): void {
  downloadJsonFile(fileName, data)
}
