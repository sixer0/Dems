/**
 * Why the Core refused to assign a source to a selector slot, in plain words (task 4 row 234; the
 * finding of the user's run on real cameras, `delegation_progress/file_ownership.md` "row 233";
 * decision C60 "FACT FOR THE USER").
 *
 * Operations 78, 79 and 80 answer `422 INVALID_INPUT` with a WORD in `details.reason`. Until this
 * row the selector worded one of them (`DEVELOPMENT_SOURCE_NOT_ALLOWED`) and said "This choice was
 * not accepted" for every other, so an operator who had adopted a real camera on a development
 * Core read no reason at all.
 *
 * | `details.reason` | Who answers it (`apps/core-server/src/modules/capture-config/routes.ts`) | Sentence |
 * |------------------|--------------------------------------------------------------------------|----------|
 * | `DEVELOPMENT_SOURCE_NOT_ALLOWED` | `CaptureAssignmentRefusal` | `devices.selector.developmentOnly` (as before this row) |
 * | `PRODUCTION_SOURCE_NOT_ALLOWED` | `CaptureAssignmentRefusal` | the shared tree, `common.captureSlotRefusal`, with the source noun (`common.captureSlotSource`) |
 * | `CAPTURE_DEVICE_NOT_SERVED` | `CaptureAssignmentRefusal` | the shared tree, `common.captureSlotRefusal`, with the source noun |
 * | `CAPTURE_DEVICE_CLASS_MISMATCH` | `CaptureAssignmentRefusal` | the shared tree, `common.captureSlotRefusal`, with the source noun |
 * | `CAMERA_PROFILE_NOT_STATED` | `CaptureProfileRefusal` | the shared tree, `common.captureSlotRefusal` |
 * | `CAMERA_PROFILE_NOT_OF_DEVICE` | `CaptureProfileRefusal` | the shared tree, `common.captureSlotRefusal` |
 * | `CAMERA_PROFILE_WITHOUT_STREAM` | the stream-row rule of operations 78 / 79 (rows S86a, V7c; C130) | the shared tree, `common.captureSlotRefusal` (names adoption: a connection test does not repair it) |
 * | `SLOT_UNASSIGNED_AND_ASSIGNED` | the hosted action of operation 78 | the shared tree, `common.captureSlotRefusal`, with the source noun |
 * | any other word | the adapter layer's own code (rule CR-4: a fixed word) | the general sentence, followed by the code |
 * | no word | a refusal of the schema stage | the general sentence alone |
 *
 * ONE SOURCE (task 4 row V4, decision C80). Every sentence is the shared tree's
 * (`common.captureSlotRefusal`, written by the single writer of `packages/shared`): the four this
 * console worded itself were moved there word for word and its copies removed.
 *
 * THE PANEL READS THAT GROUP AND NOTHING ELSE (clean-up after row V4, by the single writer of
 * `apps/core-web`): the two members this console kept "by reference" under
 * `web.captureSlotRefusal` (`reason`, `source`) are gone. Every worded reason is the kind `SHARED`:
 * the panel asks `common.captureSlotRefusal.<word>` and always hands in the noun of the refused row
 * (`common.captureSlotSource`); a sentence without the placeholder `{{source}}` ignores it. The day
 * the shared tree gains a word, the console reads it without a change here. No word is ever shown
 * as a sentence, and a word is shown as a code only when it has the form of one.
 */
import { en } from '@dems/shared/i18n'

/** The form of a reason word: upper-case letters, digits and underscores. Anything else is not drawn. */
export const SLOT_REFUSAL_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/

/** The reason the selector has worded since task 3 (`devices.selector.developmentOnly`). */
export const DEVELOPMENT_SOURCE_NOT_ALLOWED = 'DEVELOPMENT_SOURCE_NOT_ALLOWED'

/** Which kind of source the refused row holds: the sentences of this console name it. */
export type SlotSourceKind = 'CAMERA' | 'MIC'

/** The reasons the shared tree words: the keys of `common.captureSlotRefusal`, the one source. */
export type SharedSlotRefusalReason = keyof typeof en.common.captureSlotRefusal

export type SlotRefusalWording =
  /** The sentence the selector has always had for a development source. */
  | { readonly kind: 'DEVELOPMENT_ONLY' }
  /** A sentence of the shared tree, by its word; the panel hands in the noun of the refused row. */
  | { readonly kind: 'SHARED'; readonly reason: SharedSlotRefusalReason }
  /** A word nobody has a sentence for: the general sentence, then the word as a code. */
  | { readonly kind: 'CODE'; readonly code: string }
  /** No word (or no word of the form): the general sentence alone. */
  | { readonly kind: 'PLAIN' }

const has = (tree: object, key: string): boolean => Object.prototype.hasOwnProperty.call(tree, key)

/** The reasons this console can word by a sentence of its own or of the shared tree; for the tests. */
export function wordedSlotRefusalReasons(): readonly string[] {
  return [...new Set([DEVELOPMENT_SOURCE_NOT_ALLOWED, ...Object.keys(en.common.captureSlotRefusal)])]
}

/** How a `422` of a slot assignment is worded, by its `details.reason`; pure. */
export function slotRefusalWording(reason: string | null): SlotRefusalWording {
  if (reason === null || !SLOT_REFUSAL_CODE_PATTERN.test(reason)) return { kind: 'PLAIN' }
  // The one source: the shared tree's group, asked first.
  if (has(en.common.captureSlotRefusal, reason)) return { kind: 'SHARED', reason: reason as SharedSlotRefusalReason }
  if (reason === DEVELOPMENT_SOURCE_NOT_ALLOWED) return { kind: 'DEVELOPMENT_ONLY' }
  return { kind: 'CODE', code: reason }
}
