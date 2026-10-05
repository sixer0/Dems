/**
 * The bodies of `stopSession` and `addSessionNote` (plan row W34, follow-up of decision D94;
 * spec §7.2, §7.3 lines 8 and 10, §7.8 operations 26 and 35; contract `SessionStopRequest` and
 * `SessionNoteRequest`). The approach is the evidence module's for the export reason
 * (`modules/evidence/export-request.ts`, decision D92): one error precedence for every module.
 *
 * Both bodies have one text member that the contract bounds from BELOW (a stop reason of at
 * least five characters, a note of at least one) and that the hosted action checks too
 * (`REASON_TOO_SHORT`, `NOTE_INVALID`). The specification answers such a member at two places
 * of its precedence table:
 *
 *   line 8    422 `INVALID_INPUT`    the body does not match its schema in SHAPE: the member is
 *                                    not text, or holds U+0000 or an unpaired surrogate, or is
 *                                    longer than its maximum. Decided before the engine runs.
 *   line 10   404, then 409, then    the member is absent or too short. That is business
 *             422                    validation, decided "in the order the hosted action checks
 *                                    it": after the open session was looked at (404) and after
 *                                    its state (409), as the simulator's REST layer does. The
 *                                    422 is then the action's own: `INVALID_REASON` for a stop,
 *                                    `INVALID_INPUT` (`simCode: NOTE_INVALID`) for a note.
 *
 * So the schema is the contract's, unchanged, but it is applied in the handler, not as the
 * route's body schema (which would answer the lower bound at stage 7, before the 404 and the
 * 409). A body is read as one of three:
 *
 *   VALID          the contract's schema accepted it. The text is trimmed by the schema.
 *   TEXT_MISSING   the ONLY thing wrong is the lower bound of the member: it is absent, or it
 *                  is text with fewer characters than the minimum after trimming. The handler
 *                  hands the hosted action `NO_TEXT`, which the action always refuses, after
 *                  its own checks. The text the client sent NEVER reaches the engine: the
 *                  contract counts characters and the simulator counts UTF-16 code units, so a
 *                  reason of three two-unit characters is too short for the first and long
 *                  enough for the second, and the action would accept it.
 *   INVALID        anything else.
 *
 * Pure: no database, no clock. Nothing of the body is put into a message or a log line.
 */
import type { z } from 'zod';

export type TextBody<Value> =
  | { readonly kind: 'VALID'; readonly value: Value }
  | { readonly kind: 'TEXT_MISSING' }
  | { readonly kind: 'INVALID' };

/** What the hosted action gets in place of a missing or too-short text: it refuses it, always. */
export const NO_TEXT = '';

/** zod's issue code for "below the minimum", and for "not of the type" (which an absent member is). */
const TOO_SMALL = 'too_small';
const INVALID_TYPE = 'invalid_type';

function isAbsent(body: unknown, member: string): boolean {
  return typeof body === 'object' && body !== null && (body as Record<string, unknown>)[member] === undefined;
}

/**
 * Reads a body with the contract's schema. `member` is the one text member whose lower bound is
 * the hosted action's to refuse.
 */
export function readTextBody<Schema extends z.ZodType>(schema: Schema, member: string, body: unknown): TextBody<z.output<Schema>> {
  const parsed = schema.safeParse(body);
  if (parsed.success) return { kind: 'VALID', value: parsed.data };
  const absent = isAbsent(body, member);
  const onlyTheLowerBound = parsed.error.issues.every(
    (issue) => issue.path.length === 1 && issue.path[0] === member && (issue.code === TOO_SMALL || (issue.code === INVALID_TYPE && absent)),
  );
  return onlyTheLowerBound ? { kind: 'TEXT_MISSING' } : { kind: 'INVALID' };
}
