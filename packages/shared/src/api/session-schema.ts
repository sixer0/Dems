/**
 * Start New Session input: `sessionCreateSchema` (masterplan/01_specs.md §14.5.11 step 1;
 * 04_mobile_specs.md §4.4; book §11.3 fields 3-5; book §21.2 `POST /api/v1/session`).
 *
 * One framework-free zod schema serves three consumers:
 * - the web form (React Hook Form + `zodResolver`, `/session/new`) and the mobile form (the
 *   Session Info step): "Next" stays disabled until it validates;
 * - the request body of `POST /api/v1/session` in the OpenAPI document (`openapi.ts`);
 * - the simulator's `createSession(input)`: the parsed value is assignable to the sim's
 *   `SessionCreateInput` (proved in test/session-schema.test.ts). The sim re-validates on its
 *   side (`isValidSessionInput`: investigator exists and holds SESSION_START), which a static
 *   schema cannot know.
 *
 * Normalisation matches the sim's `normalizeSessionInput`: text is trimmed and inner runs of
 * whitespace collapse to one space (notes are only trimmed), so a retried create is recognised
 * as the same input (S26).
 *
 * Messages are i18n keys in the `sessionNew.info.*` namespace (src/i18n/en/session-new.ts), so
 * the form renders `t(issue.message)`. Keys marked "(add)" in `SESSION_CREATE_MESSAGES` are not
 * in the resources yet: they are only reachable when a client bypasses the form's `maxLength`
 * and default selections (the API path), and the `/session/new` page step adds them.
 *
 * Every text field carries the text rule of the contract (`text.ts`; backend task 2026-10-04
 * 01_specs API-13): U+0000 and an unpaired surrogate are refused, because the Core server stores
 * these fields in PostgreSQL and in the audit chain. Its message is the contract's English
 * sentence (`API_TEXT_RULE_MESSAGE`), not an i18n key: `SESSION_CREATE_MESSAGES` stays the set of
 * keys the session page has resources for, and a key that is missing renders as its own text.
 */
import { z } from 'zod';
import { RecordingProfileId, SubjectType } from '../sim/vocabulary';
import { CASE_NUMBER_PATTERN, OPERATOR_ID_PATTERN } from './patterns';
import { API_TEXT_RULE_MESSAGE, isWellFormedText } from './text';

/** Field limits; the sim enforces the same bounds (`isValidSessionInput`). Forms set `maxLength` from these. */
export const SESSION_INPUT_LIMITS = {
  /** `LP/YYYY/MMDD-NNNN` is always 17 characters; the pattern fixes it. */
  caseNumberLength: 17,
  subjectNameMax: 120,
  roomMax: 80,
  notesMax: 2_000,
} as const;

/** Default room (the device's room; the sim falls back to it too). */
export const DEFAULT_SESSION_ROOM = 'Interview Room 1';

/** Every message the schema can emit: an i18n key. */
export const SESSION_CREATE_MESSAGES = {
  caseNumberRequired: 'sessionNew.info.caseNumber.required',
  caseNumberInvalid: 'sessionNew.info.caseNumber.invalid',
  subjectTypeRequired: 'sessionNew.info.subjectType.required',
  subjectNameRequired: 'sessionNew.info.subjectName.required',
  /** (add) Only via the API: the form caps the input at `subjectNameMax`. */
  subjectNameTooLong: 'sessionNew.info.subjectName.tooLong',
  investigatorRequired: 'sessionNew.info.investigator.required',
  /** (add) Only via the API: the form's Select defaults to `DEFAULT_SESSION_ROOM`. */
  roomRequired: 'sessionNew.info.room.required',
  /** (add) Only via the API. */
  roomTooLong: 'sessionNew.info.room.tooLong',
  /** (add) Only via the API: the form's Select defaults to the standard profile. */
  profileRequired: 'sessionNew.info.profile.required',
  /** (add) Only via the API: the form caps the input at `notesMax`. */
  notesTooLong: 'sessionNew.info.notes.tooLong',
} as const;

/** The keys the form can actually show; they exist in `en` today (checked by the test). */
export const SESSION_CREATE_FORM_MESSAGE_KEYS = [
  SESSION_CREATE_MESSAGES.caseNumberRequired,
  SESSION_CREATE_MESSAGES.caseNumberInvalid,
  SESSION_CREATE_MESSAGES.subjectTypeRequired,
  SESSION_CREATE_MESSAGES.subjectNameRequired,
  SESSION_CREATE_MESSAGES.investigatorRequired,
] as const;

const M = SESSION_CREATE_MESSAGES;

/**
 * The text rule first (API-13), then trim and collapse inner whitespace runs to one space (the
 * sim's `normalizeSessionInput`). When the text rule fails it is the only issue of the field.
 */
function singleLine(requiredMessage: string) {
  return z
    .string({ error: requiredMessage })
    .refine(isWellFormedText, { error: API_TEXT_RULE_MESSAGE, abort: true })
    .overwrite((value) => value.trim().replace(/\s+/g, ' '));
}

export const sessionCreateSchema = z
  .object({
    caseNumber: singleLine(M.caseNumberRequired)
      .min(1, { error: M.caseNumberRequired })
      .regex(CASE_NUMBER_PATTERN, { error: M.caseNumberInvalid })
      .describe('Case reference number (book §11.3 field 5), format `LP/YYYY/MMDD-NNNN`.'),
    subjectType: z
      .enum(SubjectType, { error: M.subjectTypeRequired })
      .describe('Subject type, Indonesian terms verbatim: TERSANGKA (suspect), SAKSI (witness), LAINNYA (other).'),
    subjectName: singleLine(M.subjectNameRequired)
      .min(1, { error: M.subjectNameRequired })
      .max(SESSION_INPUT_LIMITS.subjectNameMax, { error: M.subjectNameTooLong })
      .describe('Subject or witness name (book §11.3 field 4). Synthetic in the demo.'),
    investigatorId: singleLine(M.investigatorRequired)
      .regex(OPERATOR_ID_PATTERN, { error: M.investigatorRequired })
      .describe(
        'Operator ID of the investigator (book §11.3 field 3), e.g. `OPR-001`. The simulator also requires that the operator exists and holds SESSION_START.',
      ),
    room: singleLine(M.roomRequired)
      .min(1, { error: M.roomRequired })
      .max(SESSION_INPUT_LIMITS.roomMax, { error: M.roomTooLong })
      .describe(`Room or location. The form defaults to "${DEFAULT_SESSION_ROOM}".`),
    profileId: z
      .enum(RecordingProfileId, { error: M.profileRequired })
      .describe('Recording profile. STANDARD_1080P25 = "Standard (1080p / 25 fps)", H.264, 2 video + 2 audio tracks.'),
    notes: z
      .string()
      .refine(isWellFormedText, { error: API_TEXT_RULE_MESSAGE, abort: true })
      .overwrite((value) => value.trim())
      .max(SESSION_INPUT_LIMITS.notesMax, { error: M.notesTooLong })
      .optional()
      .describe('Optional context for the interview.'),
  })
  .describe('Session Info (step 1 of Start New Session). The request body of `POST /api/v1/session`.');

/** The validated, normalised create input (form output and API request body). */
export type SessionCreateRequest = z.output<typeof sessionCreateSchema>;
/** What a form holds before validation (same shape; every field may still be invalid). */
export type SessionCreateFormValues = z.input<typeof sessionCreateSchema>;
