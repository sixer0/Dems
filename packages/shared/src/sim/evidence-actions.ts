/**
 * Evidence and audit actions (masterplan/01_specs.md §14.5.3, §14.5.7; book §19; EVT-13/14,
 * EVT-25/26): `verify`, `exportEvidence`, `archiveEvidence`, `exportAudit`.
 *
 * - `verify(id)` recomputes the integrity (evidence.ts), records PASS or FAIL on the item and
 *   in its custody log, and writes EVIDENCE_VERIFIED or EVIDENCE_VERIFY_FAILED.
 * - Export follows the signed-in role (S20): INVESTIGATOR → 403 with an EXPORT_DENIED row;
 *   SUPERVISOR → 202 with EVIDENCE_EXPORTED (the ExportEvent). A reason of at least 5
 *   characters is mandatory (S21, §19.2 item 8).
 */
import { AuditEventKind } from '../domain';
import { findOperatorById, roleHas } from './auth';
import { EXPORT_REASON_MIN_LENGTH } from './constants';
import { exportIdFor } from './dataset';
import { DATASET_EXPORT_SEQ } from './demo-alignment';
import { SimErrorCode, SimNotFoundError, SimPermissionError, SimTransitionError } from './errors';
import { recordActivity, verifyAuditChain } from './events';
import { EVIDENCE_STATUS_STAGE, verifyEvidenceItem } from './evidence';
import { signedInOperatorId } from './session-machine';
import { cutText } from './text-cut';
import type {
  AuditExportRequest,
  EpochMs,
  EvidenceItem,
  EvidenceVerifyResult,
  ExportRequest,
  ExportResult,
  SimState,
} from './types';
import { EvidenceStatus, Permission } from './vocabulary';

/** Default export destination text when the request leaves it empty. */
export const DEFAULT_EXPORT_DESTINATION = 'Case file transfer (simulated)';
/** Default destination of an audit or log export. */
export const DEFAULT_AUDIT_EXPORT_DESTINATION = 'Audit archive (simulated)';

/**
 * The next `EXP-NNNNNN` (step 54, SIM-GAP-W47-4): its own counter, continuing after the dataset's
 * EXP-000031 (EV 0004's prebuilt package), so a live export never reuses or undercuts that ID.
 */
export function nextExportId(meta: SimState['meta']): { id: string; meta: SimState['meta'] } {
  const seq = meta.counters.export ?? DATASET_EXPORT_SEQ + 1;
  return { id: exportIdFor(seq), meta: { ...meta, counters: { ...meta.counters, export: seq + 1 } } };
}

function replaceItem(state: SimState, item: EvidenceItem): SimState {
  return { ...state, evidence: state.evidence.map((existing) => (existing.id === item.id ? item : existing)) };
}

function findItem(state: SimState, evidenceId: string): EvidenceItem {
  const item = state.evidence.find((existing) => existing.id === evidenceId);
  if (!item) throw new SimNotFoundError('evidence', evidenceId);
  return item;
}

export function verifyEvidenceTransition(
  state: SimState,
  now: EpochMs,
  evidenceId: string,
): { state: SimState; result: EvidenceVerifyResult } {
  const item = findItem(state, evidenceId);
  const result = verifyEvidenceItem(item, now);
  const actorId = signedInOperatorId(state);
  const failed = result.tracks.filter((track) => !track.ok).map((track) => track.trackId);
  const verified: EvidenceItem = {
    ...item,
    verification: { status: result.ok ? 'PASS' : 'FAIL', at: now },
    custody: [
      ...item.custody,
      {
        at: now,
        action: result.ok ? 'VERIFIED' : 'VERIFY_FAILED',
        actorId,
        detail: result.ok ? null : `Mismatch: ${failed.join(', ') || 'manifest or signature'}`,
      },
    ],
  };
  const next = replaceItem(state, verified);
  return {
    result,
    state: {
      ...next,
      ...recordActivity(next, now, {
        audit: {
          type: result.ok ? 'EVIDENCE_VERIFIED' : 'EVIDENCE_VERIFY_FAILED',
          message: result.ok
            ? `Evidence ${evidenceId} verified: every hash matches`
            : `Evidence ${evidenceId} failed verification (${failed.join(', ') || 'manifest or signature'})`,
          severity: result.ok ? 'INFO' : 'CRITICAL',
          actorId,
          evidenceId,
          details: {
            manifestOk: result.manifestOk,
            signatureOk: result.signatureOk,
            failedTracks: failed.join(','),
            ...(result.ok ? {} : { eventKind: AuditEventKind.TAMPER }),
          },
        },
        event: {
          type: result.ok ? 'EVIDENCE_VERIFIED' : 'EVIDENCE_VERIFY_FAILED',
          message: result.ok ? `Evidence verified · ${evidenceId}` : `Integrity check FAILED · ${evidenceId}`,
          severity: result.ok ? 'SUCCESS' : 'CRITICAL',
          params: { evidenceId, failedTracks: failed.join(',') },
        },
      }),
    },
  };
}

const EXPORTABLE: readonly EvidenceStatus[] = [
  EvidenceStatus.SEALED,
  EvidenceStatus.UNDER_REVIEW,
  EvidenceStatus.EXPORTED,
];

export function exportEvidenceTransition(
  state: SimState,
  now: EpochMs,
  evidenceId: string,
  request: ExportRequest,
): { state: SimState; result: ExportResult } {
  const actorId = signedInOperatorId(state);
  const operator = findOperatorById(state.operators, actorId);
  if (!operator) return { state, result: { ok: false, status: 401, reason: 'NOT_SIGNED_IN' } };
  if (!roleHas(operator.role, Permission.EVIDENCE_EXPORT)) {
    return {
      result: { ok: false, status: 403, reason: 'FORBIDDEN' },
      state: {
        ...state,
        ...recordActivity(state, now, {
          audit: {
            type: 'EXPORT_DENIED',
            message: `Export of ${evidenceId} denied: role ${operator.role} lacks EVIDENCE_EXPORT`,
            severity: 'WARNING',
            actorId: operator.id,
            evidenceId,
            details: { role: operator.role, eventKind: AuditEventKind.UNAUTHORIZED_EXPORT },
          },
          event: {
            type: 'EXPORT_DENIED',
            message: `Export denied · ${evidenceId}`,
            severity: 'WARNING',
            params: { evidenceId, role: operator.role },
          },
        }),
      },
    };
  }
  const item = state.evidence.find((existing) => existing.id === evidenceId);
  if (!item) return { state, result: { ok: false, status: 404, reason: 'NOT_FOUND' } };
  if (!EXPORTABLE.includes(item.status)) return { state, result: { ok: false, status: 409, reason: 'NOT_SEALED' } };
  if (state.security.state === 'FAULT') return { state, result: { ok: false, status: 409, reason: 'SECURITY_FAULT' } };
  const reason = typeof request?.reason === 'string' ? request.reason.trim() : '';
  if (reason.length < EXPORT_REASON_MIN_LENGTH) {
    return { state, result: { ok: false, status: 422, reason: 'INVALID_REASON' } };
  }
  const destination =
    typeof request.destination === 'string' && request.destination.trim()
      ? cutText(request.destination.trim(), 120) // code units; never splits a surrogate pair (SIM-GAP-1)
      : DEFAULT_EXPORT_DESTINATION;
  const { id: exportId, meta } = nextExportId(state.meta);
  const exported: EvidenceItem = {
    ...item,
    status: EvidenceStatus.EXPORTED,
    lifecycleStage: EVIDENCE_STATUS_STAGE.EXPORTED,
    custody: [...item.custody, { at: now, action: 'EXPORTED', actorId: operator.id, detail: destination }],
  };
  const next = { ...replaceItem(state, exported), meta };
  return {
    result: { ok: true, status: 202, exportId },
    state: {
      ...next,
      ...recordActivity(next, now, {
        audit: {
          type: 'EVIDENCE_EXPORTED',
          message: `Evidence ${evidenceId} exported`,
          actorId: operator.id,
          evidenceId,
          details: { exportId, destination, reason, eventKind: AuditEventKind.EXPORT },
        },
        event: {
          type: 'EVIDENCE_EXPORTED',
          message: `Evidence exported · ${evidenceId}`,
          severity: 'SUCCESS',
          params: { evidenceId, exportId },
        },
      }),
    },
  };
}

/** SEALED, UNDER_REVIEW or EXPORTED → ARCHIVED. Needs EVIDENCE_REVIEW (the UI disables it otherwise). */
export function archiveEvidenceTransition(state: SimState, now: EpochMs, evidenceId: string): SimState {
  const actorId = signedInOperatorId(state);
  const operator = findOperatorById(state.operators, actorId);
  if (!operator || !roleHas(operator.role, Permission.EVIDENCE_REVIEW)) {
    throw new SimPermissionError('archiveEvidence', Permission.EVIDENCE_REVIEW);
  }
  const item = findItem(state, evidenceId);
  if (item.status === EvidenceStatus.ARCHIVED) return state;
  if (item.status === EvidenceStatus.RECORDED) {
    throw new SimTransitionError(null, 'archiveEvidence', 'unsealed (RECORDED) evidence cannot be archived', SimErrorCode.UNSEALED_EVIDENCE);
  }
  const archived: EvidenceItem = {
    ...item,
    status: EvidenceStatus.ARCHIVED,
    lifecycleStage: EVIDENCE_STATUS_STAGE.ARCHIVED,
    custody: [...item.custody, { at: now, action: 'ARCHIVED', actorId: operator.id, detail: null }],
  };
  const next = replaceItem(state, archived);
  return {
    ...next,
    ...recordActivity(next, now, {
      audit: {
        type: 'EVIDENCE_ARCHIVED',
        message: `Evidence ${evidenceId} archived`,
        actorId: operator.id,
        evidenceId,
        details: { retentionPolicy: state.storagePolicy.retentionPolicy },
      },
      event: { type: 'EVIDENCE_ARCHIVED', message: `Evidence archived · ${evidenceId}`, params: { evidenceId } },
    }),
  };
}

export type AuditExportScope = 'AUDIT' | 'LOGS';

/**
 * "Export audit" (S20: AUDIT_EXPORT, SUPERVISOR) and "Export logs" (step 54, W52-7: scope LOGS,
 * the audit chain plus the events). Order: 401 → 403 (audited EXPORT_DENIED) → 422 INVALID_REASON
 * (a request with a reason under 5 characters; step 54, W51-1) → 202 with AUDIT_EXPORTED, whose
 * details carry the reason and destination when a request was given. Without a request the
 * step-32 behaviour stands (no reason recorded).
 */
export function exportAuditTransition(
  state: SimState,
  now: EpochMs,
  request?: AuditExportRequest,
  scope: AuditExportScope = 'AUDIT',
): { state: SimState; result: ExportResult } {
  const actorId = signedInOperatorId(state);
  const operator = findOperatorById(state.operators, actorId);
  if (!operator) return { state, result: { ok: false, status: 401, reason: 'NOT_SIGNED_IN' } };
  const label = scope === 'LOGS' ? 'Log export' : 'Audit export';
  if (!roleHas(operator.role, Permission.AUDIT_EXPORT)) {
    return {
      result: { ok: false, status: 403, reason: 'FORBIDDEN' },
      state: {
        ...state,
        ...recordActivity(state, now, {
          audit: {
            type: 'EXPORT_DENIED',
            message: `${label} denied: role ${operator.role} lacks AUDIT_EXPORT`,
            severity: 'WARNING',
            actorId: operator.id,
            details: { role: operator.role, scope, eventKind: AuditEventKind.UNAUTHORIZED_EXPORT },
          },
          event: {
            type: 'EXPORT_DENIED',
            message: `${label} denied`,
            severity: 'WARNING',
            params: { role: operator.role, scope },
          },
        }),
      },
    };
  }
  const reason = request === undefined ? null : typeof request?.reason === 'string' ? request.reason.trim() : '';
  if (reason !== null && reason.length < EXPORT_REASON_MIN_LENGTH) {
    return { state, result: { ok: false, status: 422, reason: 'INVALID_REASON' } };
  }
  const destination =
    request === undefined
      ? null
      : typeof request.destination === 'string' && request.destination.trim()
        ? cutText(request.destination.trim(), 120) // code units; never splits a surrogate pair (SIM-GAP-1)
        : DEFAULT_AUDIT_EXPORT_DESTINATION;
  const { id: exportId, meta } = nextExportId(state.meta);
  const chain = verifyAuditChain(state.audit);
  const next = { ...state, meta };
  return {
    result: { ok: true, status: 202, exportId },
    state: {
      ...next,
      ...recordActivity(next, now, {
        audit: {
          type: 'AUDIT_EXPORTED',
          message:
            scope === 'LOGS'
              ? `Logs exported (${state.audit.rows.length} audit rows, ${state.events.length} events)`
              : `Audit log exported (${state.audit.rows.length} rows)`,
          actorId: operator.id,
          details: {
            exportId,
            rows: state.audit.rows.length,
            head: state.audit.head,
            chainOk: chain.ok,
            eventKind: AuditEventKind.EXPORT,
            ...(scope === 'LOGS' ? { scope, events: state.events.length } : {}),
            ...(reason !== null ? { reason, destination } : {}),
          },
        },
      }),
    },
  };
}
