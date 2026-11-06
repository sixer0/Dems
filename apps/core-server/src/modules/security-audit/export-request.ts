/**
 * The body of `exportAudit` and `exportLogs` (plan row W39; spec §7.2, §7.3 lines 8 and 10,
 * §7.13 operations 61 and 62; contract `AuditExportRequest`; decisions D50, D64, D92 DN-2).
 *
 * The schema is the contract's, unchanged. What this file adds is WHERE a failure of it is
 * answered, because the specification gives the two exports two different 422 answers at two
 * different places of the precedence table:
 *
 *   line 8    422 `INVALID_INPUT`   the body does not match its schema: a reason that is not
 *                                   text, or longer than 500 code units, or holds U+0000 or an
 *                                   unpaired surrogate; a destination that is not text or is
 *                                   longer than 120. Decided before the engine runs.
 *   line 10   422 `INVALID_REASON`  the reason is missing or shorter than 5 characters. Decided
 *                                   by the hosted action, in its own order (401, the audited
 *                                   403, then the reason), as in Simulated mode.
 *
 * So a body is read as one of three:
 *
 *   VALID            the contract's schema accepted it. Reason and destination are trimmed by
 *                    the schema; an absent destination is the empty text, for which the action
 *                    names its default ("Audit archive (simulated)").
 *   REASON_MISSING   the ONLY thing wrong is the reason's lower bound: it is absent, or it is
 *                    text of fewer than 5 characters after trimming. The caller hands the hosted
 *                    action `NO_REASON`, which the action refuses with `INVALID_REASON`. The
 *                    text the client sent never reaches the engine, and the action cannot
 *                    accept: the contract counts characters and the simulator counts code units,
 *                    so a reason of three two-unit characters is too short for the first and
 *                    long enough for the second. (The simulator's form WITHOUT a request, which
 *                    records an export with no reason, is never used: a request is always
 *                    handed over.)
 *   INVALID          anything else.
 *
 * Pure: no database, no clock. Nothing of the body is put into a message or a log line.
 */
import { AuditExportRequestSchema } from '@dems/shared/api';
import type { AuditExportRequest } from '@dems/shared/sim';

export type AuditExportBody =
  | { readonly kind: 'VALID'; readonly request: AuditExportRequest }
  | { readonly kind: 'REASON_MISSING' }
  | { readonly kind: 'INVALID' };

/** What the hosted action gets in place of a missing or too-short reason: it refuses it, always. */
export const NO_REASON: AuditExportRequest = Object.freeze({ reason: '', destination: '' });

const REASON = 'reason';

function hasNoReason(body: unknown): boolean {
  return typeof body === 'object' && body !== null && (body as Record<string, unknown>)[REASON] === undefined;
}

export function readAuditExportBody(body: unknown): AuditExportBody {
  const parsed = AuditExportRequestSchema.safeParse(body);
  if (parsed.success) {
    return { kind: 'VALID', request: { reason: parsed.data.reason, destination: parsed.data.destination ?? '' } };
  }
  const absent = hasNoReason(body);
  const onlyTheLowerBound = parsed.error.issues.every(
    (issue) => issue.path.length === 1 && issue.path[0] === REASON && (issue.code === 'too_small' || (issue.code === 'invalid_type' && absent)),
  );
  return onlyTheLowerBound ? { kind: 'REASON_MISSING' } : { kind: 'INVALID' };
}
