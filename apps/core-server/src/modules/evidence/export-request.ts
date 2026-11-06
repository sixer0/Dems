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
import { DEFAULT_EXPORT_DESTINATION, DEFAULT_EXPORT_DESTINATION_REAL, type ExportRequest } from '@dems/shared/sim';

export type ExportBody =
  | { readonly kind: 'VALID'; readonly request: ExportRequest; /** True when the body names `kind` itself (R93-06): only then is it written to the request row. */ readonly named: boolean }
  | { readonly kind: 'REASON_MISSING' }
  | { readonly kind: 'INVALID' };

/** What the hosted action gets in place of a missing or too-short reason: it refuses it, always. */
export const NO_REASON: ExportRequest = Object.freeze({ reason: '', destination: '' });

/**
 * What the Core records, as the ONE function of the capture operation answered it
 * (`captureOperationOf`, asked by the route - static rule G-R16: nothing here reads the capture
 * mode of the configuration): `simulated` = the operation SIMULATED, `real` = a Core in its own
 * capture (development or production).
 */
export type ExportCapture = 'simulated' | 'real';

/**
 * THE ONE DEFAULT DESTINATION OF THIS CORE, true to its capture operation (fix wave K, driver S2;
 * re-gate 94 notes G94b-11, G94b-12). A request that names no destination is recorded with it, and
 * operation 40 states it (`exportDestinationDefault`) so that every client pre-selects the same
 * one. A Core in its own capture simulates nothing: its text does not say "(simulated)".
 */
export function exportDestinationDefaultOf(capture: ExportCapture): string {
  return capture === 'simulated' ? DEFAULT_EXPORT_DESTINATION : DEFAULT_EXPORT_DESTINATION_REAL;
}

/**
 * The request as the hosted action takes it. A Core in its OWN capture hands its default in for an
 * empty destination; a Core in simulated capture hands the request on as it is - the hosted action
 * then names the simulator's default itself, which IS that Core's default (one text, one place).
 */
export function withDestinationDefault(request: ExportRequest, capture: ExportCapture): ExportRequest {
  if (capture === 'simulated') return request;
  return typeof request.destination === 'string' && request.destination.trim() !== '' ? request : { ...request, destination: exportDestinationDefaultOf(capture) };
}

const REASON = 'reason';

function hasNoReason(body: unknown): boolean {
  return typeof body === 'object' && body !== null && (body as Record<string, unknown>)[REASON] === undefined;
}

export function readExportBody(body: unknown): ExportBody {
  const parsed = EvidenceExportRequestSchema.safeParse(body);
  if (parsed.success) {
    // An absent destination is the empty text: the action then names its default.
    return { kind: 'VALID', request: { reason: parsed.data.reason, destination: parsed.data.destination ?? '' }, named: typeof body === 'object' && body !== null && (body as Record<string, unknown>)['kind'] !== undefined };
  }
  const absent = hasNoReason(body);
  const onlyTheLowerBound = parsed.error.issues.every(
    (issue) => issue.path.length === 1 && issue.path[0] === REASON && (issue.code === 'too_small' || (issue.code === 'invalid_type' && absent)),
  );
  return onlyTheLowerBound ? { kind: 'REASON_MISSING' } : { kind: 'INVALID' };
}
