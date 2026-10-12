/**
 * THE ONE MAP FROM A CODE TO THE WORDS AN OPERATOR READS (fix wave J, driver J-W: JW-03; fix wave Q,
 * driver Q-W: JW-13). Every table, list and timeline of the console that shows a code the Core
 * recorded - an audit type, an event type, a custody action, a fault kind, a severity, the value of a
 * pre-check row, the cause a seal was given up for - words it through THIS file.
 *
 * The rule, the same for every kind of code:
 *
 * | The code | What is drawn |
 * |---|---|
 * | is in the vocabulary of its kind | the vocabulary's words ("Evidence verification failed") |
 * | is not (an additive code of a newer Core) | a readable form of the code ("Verify failed" for `VERIFY_FAILED`) - never the raw code, never a translation key, and no missing-key record |
 *
 * The vocabulary is asked FIRST (`hasOwnProperty`), so a code it does not hold is never looked up as
 * a sentence: `t()` with a `defaultValue` still records a missing key (CW-03: the pre-check row of an
 * unreachable camera asked for `common.enums.lensState.UNREACHABLE`).
 *
 * A KNOWN code without words is a defect: `lib/__tests__/event-words.test.ts` walks every code the
 * shared vocabulary and the simulator know and fails when one of them falls back to the readable form.
 *
 * The request row of an export JOB and its completion carry the same event type
 * (`EVIDENCE_EXPORTED`); the Core states `params.exportPhase` (`contract_wave_j.md` J-S 3):
 *
 * | `exportPhaseOfEvent(event)` | Title |
 * |---|---|
 * | `REQUESTED` | "Export requested" |
 * | `COMPLETED`, or null (an event without the member: the simulator's own completed export) | the type's own title ("Evidence exported") |
 */
import type { TFunction } from 'i18next'
import { en } from '@dems/shared/i18n'
import { exportPhaseOfEvent, SEAL_BLOCKED_DETAIL_SENTENCE, type SimEvent } from '@dems/shared/sim'

const holds = (tree: object, code: string): boolean => Object.prototype.hasOwnProperty.call(tree, code)

/**
 * A code as readable words, for a code no vocabulary holds: `VERIFY_FAILED` -> "Verify failed",
 * `capture-worker` -> "Capture worker". Text that is not a code (it has a lower-case letter and a
 * space: a sentence the Core wrote) is returned as it is.
 */
export function readableCode(code: string): string {
  const text = code.trim()
  if (text === '') return code
  if (/[a-z]/.test(text) && /\s/.test(text)) return text
  const words = text.replace(/[_\-.\s]+/g, ' ').trim().toLowerCase()
  return words === '' ? text : words.charAt(0).toUpperCase() + words.slice(1)
}

// ── The vocabularies of the shared tree (one word list per kind of code) ─────────────────

/** The kinds of code whose words are a flat list under `common.<kind>` of the shared tree. */
export const CODE_VOCABULARY = {
  auditType: en.common.auditType,
  eventType: en.common.eventType,
  faultKind: en.common.faultKind,
  severity: en.common.severity,
  auditCategory: en.common.auditCategory,
} as const
export type CodeKind = keyof typeof CODE_VOCABULARY

/** The words of a code of `kind`: the vocabulary's, else the readable form of the code. */
export function codeWords(t: TFunction, kind: CodeKind, code: string): string {
  return holds(CODE_VOCABULARY[kind], code) ? (t(`common.${kind}.${code}` as never) as string) : readableCode(code)
}

/** True when the vocabulary of `kind` holds `code` (the readable form is then NOT what is drawn). */
export function isKnownCode(kind: CodeKind, code: string): boolean {
  return holds(CODE_VOCABULARY[kind], code)
}

export const auditTypeWords = (t: TFunction, type: string): string => codeWords(t, 'auditType', type)
export const eventTypeWords = (t: TFunction, type: string): string => codeWords(t, 'eventType', type)
export const faultKindWords = (t: TFunction, kind: string): string => codeWords(t, 'faultKind', kind)
export const severityWords = (t: TFunction, severity: string): string => codeWords(t, 'severity', severity)

/** The title of an event in an activity list (Storage, Network & Time, the Dashboard's recent events). */
export function eventTitle(t: TFunction, event: Pick<SimEvent, 'type' | 'params'>): string {
  if (exportPhaseOfEvent(event) === 'REQUESTED') return t('web.waveJ.events.exportRequested')
  return eventTypeWords(t, event.type)
}

// ── Custody actions (the chain-of-custody table of an evidence item) ─────────────────────

/**
 * Every custody action the simulator and the Core write (`action` of a `CustodyEntry`; an open set
 * by contract, so a newer Core may add one - it then reads in its readable form). Each names the
 * sentence it is drawn with: the audit vocabulary's where the action has an audit twin, the
 * console's own word where it has none.
 */
export const CUSTODY_ACTION_KEY = {
  RECORDING_STARTED: 'common.auditType.RECORDING_STARTED',
  RECORDING_STOPPED: 'common.auditType.RECORDING_STOPPED',
  RECORDING_INTERRUPTED: 'web.waveQ.custody.RECORDING_INTERRUPTED',
  SESSION_INCOMPLETE: 'common.auditType.SESSION_INCOMPLETE',
  SEALED: 'common.auditType.EVIDENCE_SEALED',
  VERIFIED: 'common.auditType.EVIDENCE_VERIFIED',
  VERIFY_FAILED: 'common.auditType.EVIDENCE_VERIFY_FAILED',
  REVIEW_OPENED: 'common.auditType.EVIDENCE_REVIEW_OPENED',
  EXPORTED: 'common.auditType.EVIDENCE_EXPORTED',
  EXPORT_DOWNLOADED: 'web.waveQ.custody.EXPORT_DOWNLOADED',
  ARCHIVED: 'common.auditType.EVIDENCE_ARCHIVED',
} as const
export type KnownCustodyAction = keyof typeof CUSTODY_ACTION_KEY

/** The words of a custody action: its own, else the audit vocabulary's (a Core that writes an audit type there), else the readable form. */
export function custodyActionWords(t: TFunction, action: string): string {
  if (holds(CUSTODY_ACTION_KEY, action)) return t(CUSTODY_ACTION_KEY[action as KnownCustodyAction] as never) as string
  return auditTypeWords(t, action)
}

/** Every code inside a custody detail ("STORAGE_FULL; recovered", "Cause: CAPTURE_FAULT") by its name; the other words stay. */
export function custodyDetailWords(t: TFunction, detail: string): string {
  return detail.replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g, (code) => causeCodeWords(t, code))
}

// ── Causes (an interrupted recording, a seal that was given up, a failed export) ─────────

const SEAL_CAUSE_SENTENCE: Readonly<Record<string, string>> = SEAL_BLOCKED_DETAIL_SENTENCE

/**
 * A cause code as the operator reads it: the fault's name ("Storage full"), the shared sentence of a
 * session-key cause ("The Core's key store cannot be used."), else the readable form of the code.
 */
export function causeCodeWords(t: TFunction, cause: string): string {
  if (holds(CODE_VOCABULARY.faultKind, cause)) return faultKindWords(t, cause)
  if (holds(SEAL_CAUSE_SENTENCE, cause)) return SEAL_CAUSE_SENTENCE[cause] as string
  return readableCode(cause)
}

/**
 * The line of a cause where the Core's code is the reference (an unsealable notice, a quarantined session):
 * the words first, the code the Core recorded after them - the administrator searches the Core's log for it.
 */
export function sealCauseLine(t: TFunction, cause: string): string {
  return t('web.waveQ.cause.line', { words: causeCodeWords(t, cause), cause })
}

/** True when `cause` has words of its own (a fault kind or a session-key cause), not only the readable form. */
export function isKnownCause(cause: string): boolean {
  return holds(CODE_VOCABULARY.faultKind, cause) || holds(SEAL_CAUSE_SENTENCE, cause)
}

// ── Values of an enumeration (`common.enums.<name>.<VALUE>`) ─────────────────────────────

type EnumName = keyof typeof en.common.enums

/** A value no enumeration of the shared tree holds, by the code a row carries it under. */
const VALUE_KEY = {
  /** D114: the value of a pre-check row whose source did not answer. */
  UNREACHABLE: 'common.developmentRoster.notReachable',
} as const

/**
 * The words of the value of an enumeration: the tree's (`common.enums.<name>.<value>`), else the
 * console's word for a value outside it (`UNREACHABLE`), else the readable form. The tree is asked
 * first, so a value it does not hold records no missing key (CW-03).
 */
export function enumValueWords(t: TFunction, name: EnumName, value: string): string {
  if (holds(en.common.enums[name], value)) return t(`common.enums.${name}.${value}` as never) as string
  if (holds(VALUE_KEY, value)) return t(VALUE_KEY[value as keyof typeof VALUE_KEY])
  return readableCode(value)
}
