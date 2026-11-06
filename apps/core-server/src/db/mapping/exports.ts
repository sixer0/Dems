/**
 * Export records: the one table of the engine's data that no slice holds (plan row W20;
 * database contract §4.20, SD-7).
 *
 * The shared code records an accepted export as an audit row whose details carry the export ID
 * (`EVIDENCE_EXPORTED` for one evidence item; `AUDIT_EXPORTED` for the audit log, or for the log
 * bundle when its details say `scope: 'LOGS'`). The row of `exports` is derived from that audit
 * row, by the seed for the dataset's one export and by the engine host for every later one. So
 * the table and the audit trail cannot disagree about who exported what, when and why.
 *
 * Pure: audit rows in, export rows out.
 */
import type { AuditRow } from '@dems/shared/sim';
import type { ExportRow } from '../schema';
import { MappingError, safeInteger, storableText } from './guards';

const EVIDENCE_EXPORTED = 'EVIDENCE_EXPORTED';
const AUDIT_EXPORTED = 'AUDIT_EXPORTED';
const LOG_BUNDLE_SCOPE = 'LOGS';

/**
 * The export record of one audit row, or `null` when the row records no accepted export (any
 * other type, or an `EVIDENCE_EXPORTED` row without an export ID, which is how a history item
 * exported before export IDs existed would look).
 *
 * An accepted export that the table cannot hold is refused, never dropped: an export without an
 * operator, or without the reason and destination the table requires. The operations of the
 * Core server always carry both.
 */
export function exportRowFromAudit(row: AuditRow): ExportRow | null {
  if (row.type !== EVIDENCE_EXPORTED && row.type !== AUDIT_EXPORTED) return null;
  const exportId = row.details['exportId'];
  if (typeof exportId !== 'string') return null;

  const place = `exports (${exportId}, audit seq ${row.seq})`;
  const reason = row.details['reason'];
  const destination = row.details['destination'];
  if (row.actorId === null || typeof reason !== 'string' || typeof destination !== 'string') {
    throw new MappingError(
      'EXPORT_NOT_STORABLE',
      place,
      'an export record needs the operator, a reason and a destination; the audit row lacks one of them.',
    );
  }
  const isEvidence = row.type === EVIDENCE_EXPORTED;
  if (isEvidence && row.evidenceId === null) {
    throw new MappingError('EXPORT_NOT_STORABLE', place, 'an evidence export names no evidence item.');
  }
  return {
    id: storableText(exportId, 'exports.id'),
    scope: isEvidence ? 'EVIDENCE' : row.details['scope'] === LOG_BUNDLE_SCOPE ? 'LOGS' : 'AUDIT',
    evidenceId: isEvidence ? row.evidenceId : null,
    operatorId: row.actorId,
    reason: storableText(reason, `${place}.reason`),
    destination: storableText(destination, `${place}.destination`),
    at: safeInteger(row.at, `${place}.at`),
  };
}

/** The export records of a list of audit rows, in the order of the rows. */
export function exportRowsFromAudit(rows: readonly AuditRow[]): ExportRow[] {
  const records: ExportRow[] = [];
  for (const row of rows) {
    const record = exportRowFromAudit(row);
    if (record !== null) records.push(record);
  }
  return records;
}
