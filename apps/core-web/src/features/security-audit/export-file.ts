/**
 * The audit export FILE in Live mode (plan row W75; backend task 04_client_integration_spec §8.2 A7;
 * 01_specs §11: "An audit or log export file | Built by the client from server rows (operations 59
 * and 63) after the server accepted the export (operations 61, 62)"; implementation/39 §7.1, §12).
 *
 * The Core writes no file and returns none. Once it accepted the export (202, the AUDIT_EXPORTED row
 * in the replica), the console reads the STORED chain from operation 59 `listAuditRows` through the
 * console's one paged walk (`walkAuditChain`, `lib/core-page-walk.ts`, plan row W1): oldest first,
 * 200 rows a page, following `nextCursor`, up to the rows the export covers — every row before the
 * AUDIT_EXPORTED row (its sequence minus one; the Core's answer counts the same way,
 * implementation/39 §7.4) — only while an operator is signed in (D176). The table may hold more rows
 * than the 1,000-row ring the socket keeps, so the ring is never the file. The walk ends on the row
 * whose hash is the export's head; anything else (the chain was discarded by a reset meanwhile: the
 * Core answers 422 to the old cursor) is a failure, never a partial file. This file keeps the page's
 * own parts: its error (its name and code are the page's record), the file and its name.
 *
 * Pure except `downloadAuditFile`, which hands the finished text to the browser.
 */
import type { AuditPage } from '@dems/shared/api'
import type { AuditRow } from '@dems/shared/sim'
import { CORE_PAGE_LIMIT, walkAuditChain, type AuditChainTarget, type CorePageReader, type CoreWalkFailure } from '@/lib/core-page-walk'

/** Rows per page of operation 59: the contract's largest page (API-9). */
export const AUDIT_PAGE_LIMIT = CORE_PAGE_LIMIT

/** Reads one page of operation 59 after `cursor` (null: the first page). */
export type AuditPageReader = CorePageReader<AuditPage>

/** Why a walk did not produce the file (the walk's own failure: a page, the chain, an endless list). */
export type AuditWalkFailure = CoreWalkFailure

export class AuditWalkError extends Error {
  override readonly name = 'AuditWalkError'
  readonly reason: AuditWalkFailure
  /** The HTTP status of a refused page, for the page's record (never the text of the answer). */
  readonly status: number | null
  readonly code: string
  constructor(reason: AuditWalkFailure) {
    super('The audit list of the Core could not be read to the end of the export.')
    this.reason = reason
    this.status = reason.kind === 'CALL' ? reason.failure.status : null
    this.code = reason.kind === 'CALL' ? reason.failure.error.code : reason.kind === 'CHAIN' ? 'CHAIN_MOVED' : 'ENDLESS_LIST'
  }
}

/** What the walk is bound to: the rows the export covers and the hash of the last of them, when known. */
export type AuditWalkTarget = AuditChainTarget

/** Whole pages the walk needs for `rows` rows (at least one: an empty chain still reads one page). */
export function auditPageCount(rows: number | null): number | null {
  if (rows === null) return null
  return Math.max(1, Math.ceil(rows / AUDIT_PAGE_LIMIT))
}

/**
 * Reads the stored chain from the first row up to the export's rows, asking `signedIn()` before every
 * page (D176). `onPage(read)` after each page. Without a known row count it stops before the
 * AUDIT_EXPORTED row of `exportId` (or at the last page). Throws `AuditWalkError`.
 */
export function readExportedRows(
  readPage: AuditPageReader,
  target: AuditWalkTarget,
  options: { readonly signedIn: () => boolean; readonly onPage?: (read: number) => void },
): Promise<AuditRow[]> {
  return walkAuditChain(readPage, target, { ...options, fail: (reason) => new AuditWalkError(reason) })
}

/** The file's content: the export's identity, why it was made, and the stored rows it covers. */
export interface AuditExportFile {
  readonly kind: 'dems-audit-export'
  readonly source: 'core-server'
  readonly exportId: string
  readonly scope: 'AUDIT'
  readonly deviceId: string
  readonly exportedAt: string
  readonly reason: string
  readonly chain: { readonly rows: number; readonly head: string | null }
  readonly rows: readonly AuditRow[]
}

export function buildAuditExportFile(input: {
  exportId: string
  deviceId: string
  at: number
  reason: string
  rows: readonly AuditRow[]
}): AuditExportFile {
  return {
    kind: 'dems-audit-export',
    source: 'core-server',
    exportId: input.exportId,
    scope: 'AUDIT',
    deviceId: input.deviceId,
    exportedAt: new Date(input.at).toISOString(),
    reason: input.reason,
    chain: { rows: input.rows.length, head: input.rows.at(-1)?.hash ?? null },
    rows: input.rows,
  }
}

/** `dems-audit-<exportId>.json` (an export ID is `EXP-NNNNNN`: safe in a file name). */
export function auditExportFileName(exportId: string): string {
  return `dems-audit-${exportId.replace(/[^A-Za-z0-9-]/g, '')}.json`
}

/** Hands the file to the browser as a download. Throws when the platform cannot create it. */
export function downloadAuditFile(fileName: string, file: AuditExportFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
