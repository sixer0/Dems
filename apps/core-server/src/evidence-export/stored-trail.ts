/**
 * THE STORED ROWS OF AN EXPORT (closing pass F-X; review finding R93-11, second half).
 *
 * What the export jobs and operation 87 need to know of an export - its REQUEST and, when it
 * failed, the REASON - is committed to the database before the engine's state shows it (a unit of
 * work commits, then the audit ring of the state gets the row). The ring holds the newest 1000
 * rows and starts again from them at every start of the Core; the stored rows hold every one. This
 * file reads the stored rows, so that the answer of a job never depends on what the ring still has.
 *
 * WHERE EACH FACT IS STORED (no table of its own, no migration):
 *
 *   the request     `exports` (the durable request table: ID, evidence item, operator, reason,
 *                   destination, instant - derived from the audit row in the same unit of work,
 *                   `db/mapping/exports.ts`) JOINED WITH its audit row `EVIDENCE_EXPORTED` whose
 *                   `details.exportId` is that ID, which gives what the table does not hold: the
 *                   audit ID (the authorisation reference) and `details.kind`.
 *                   A DOWNLOAD row is `EVIDENCE_EXPORTED` too (`details.reason: EXPORT_DOWNLOADED`)
 *                   and carries NO `exportId`: it matches no row of `exports` and is never read as
 *                   a request.
 *   the failure     the newest audit row `EVIDENCE_EXPORT_FAILED` whose `details.jobId` is the job.
 *
 * Both are read-only single statements on the runtime pool; the caller runs them through
 * `app.db.read`, which logs and persists a failed read and answers 503 `NOT_READY`. This file
 * opens nothing and logs nothing. Its values are bind parameters; nothing is put into statement text.
 */
import type { QueryResultRow } from 'pg';
import type { ExportRequestRecord } from './jobs';
import { ExportKind } from './package-export';

/** A connection that runs one parameterised statement (the runtime pool). */
export interface ExportTrailQueryable {
  query<Row extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<{ readonly rows: Row[] }>;
}

/** The request of one evidence export: the `exports` row and its audit row. The newest audit row wins (there is one). */
export const READ_STORED_EXPORT_REQUEST =
  'SELECT e.evidence_id, e.operator_id, e.destination, e.reason, a.id AS audit_id, a.at, a.details ' +
  'FROM public.exports e JOIN public.audit_log a ' +
  "ON a.evidence_id = e.evidence_id AND a.type = 'EVIDENCE_EXPORTED' AND a.details->>'exportId' = e.id " +
  "WHERE e.id = $1 AND e.scope = 'EVIDENCE' ORDER BY a.seq DESC LIMIT 1";

/** The reason of the newest failure row of one job. */
export const READ_STORED_EXPORT_FAILURE = "SELECT details FROM public.audit_log WHERE type = 'EVIDENCE_EXPORT_FAILED' AND details->>'jobId' = $1 ORDER BY seq DESC LIMIT 1";

interface StoredRequestRow extends QueryResultRow {
  evidence_id: string | null;
  operator_id: string | null;
  destination: string | null;
  reason: string | null;
  audit_id: string;
  /** `bigint`: the driver hands it over as text. */
  at: string | number;
  details: Record<string, unknown> | null;
}

/** The committed request of that export ID as the database holds it, or null when no export has the ID. */
export async function readStoredExportRequest(db: ExportTrailQueryable, exportId: string): Promise<ExportRequestRecord | null> {
  const row = (await db.query<StoredRequestRow>(READ_STORED_EXPORT_REQUEST, [exportId])).rows[0];
  if (row === undefined) return null;
  const at = Number(row.at);
  if (row.evidence_id === null || row.operator_id === null || row.destination === null || row.reason === null || !Number.isSafeInteger(at)) return null;
  const kind = row.details?.['kind'];
  return {
    exportId,
    evidenceId: row.evidence_id,
    auditId: row.audit_id,
    at,
    operatorId: row.operator_id,
    destination: row.destination,
    reason: row.reason,
    kind: kind === ExportKind.PACKAGE || kind === ExportKind.COMPOSITE ? kind : null,
  };
}

/** The stored reason of the newest `EVIDENCE_EXPORT_FAILED` row of that job, or null when the job has none. */
export async function readStoredExportFailure(db: ExportTrailQueryable, jobId: string): Promise<string | null> {
  const row = (await db.query<{ details: Record<string, unknown> | null }>(READ_STORED_EXPORT_FAILURE, [jobId])).rows[0];
  const reason = row?.details?.['reason'];
  return typeof reason === 'string' ? reason : null;
}
