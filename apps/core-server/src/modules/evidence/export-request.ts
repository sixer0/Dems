/**
 * The body of `exportEvidence` (plan row W35; spec §7.2, §7.3 lines 8 and 10, §7.9 operation 42;
 * contract `EvidenceExportRequest`; decisions D50, D64).
 *
 * The schema is the contract's, unchanged. What this file adds is WHERE a failure of it is
 * answered, because the specification gives the export two different 422 answers at two
 * different places of the precedence table:
 *
 *   line 8    422 `INVALID_INPUT`   the body does not match its schema: a reason that is not
 *                                   text, or longer than 500 code units, or holds U+0000 or an
 *                                   unpaired surrogate; a destination that is not text or is
 *                                   longer than 120. Decided before the engine runs.
 *   line 10   422 `INVALID_REASON`  the reason is missing or shorter than 5 characters. Decided
 *                                   by the hosted action, AFTER its 404 and its two 409 checks
 *                                   ("for `exportEvidence`: 404, 409, 422"), as in Simulated
 *                                   mode: an unknown item answers 404 whatever the reason is.
 *
 * So a body is read as one of three:
 *
 *   VALID            the contract's schema accepted it. The reason is trimmed by the schema.
 *   REASON_MISSING   the ONLY thing wrong is the reason's lower bound: it is absent, or it is
 *                    text of fewer than 5 characters after trimming. The caller hands the hosted
 *                    action `NO_REASON`, which the action refuses with `INVALID_REASON` after
 *                    its own checks. The text the client sent never reaches the engine, and the
 *                    action cannot accept: the contract counts characters and the simulator
 *                    counts code units, so a reason of three two-unit characters is too short
 *                    for the first and long enough for the second.
 *   INVALID          anything else.
 *
 * Pure: no database, no clock. Nothing of the body is put into a message or a log line.
 */
import { EvidenceExportRequestSchema } from '@dems/shared/api';
import type { ExportRequest } from '@dems/shared/sim';

export type ExportBody =
  | { readonly kind: 'VALID'; readonly request: ExportRequest }
  | { readonly kind: 'REASON_MISSING' }
  | { readonly kind: 'INVALID' };

/** What the hosted action gets in place of a missing or too-short reason: it refuses it, always. */
export const NO_REASON: ExportRequest = Object.freeze({ reason: '', destination: '' });

const REASON = 'reason';

function hasNoReason(body: unknown): boolean {
  return typeof body === 'object' && body !== null && (body as Record<string, unknown>)[REASON] === undefined;
}

export function readExportBody(body: unknown): ExportBody {
  const parsed = EvidenceExportRequestSchema.safeParse(body);
  if (parsed.success) {
    // An absent destination is the empty text: the action then names its default.
    return { kind: 'VALID', request: { reason: parsed.data.reason, destination: parsed.data.destination ?? '' } };
  }
  const absent = hasNoReason(body);
  const onlyTheLowerBound = parsed.error.issues.every(
    (issue) => issue.path.length === 1 && issue.path[0] === REASON && (issue.code === 'too_small' || (issue.code === 'invalid_type' && absent)),
  );
  return onlyTheLowerBound ? { kind: 'REASON_MISSING' } : { kind: 'INVALID' };
}
