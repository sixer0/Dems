import type { TFunction } from 'i18next'
import { en } from '@dems/shared/i18n'

const FAULT_KINDS: Readonly<Record<string, string>> = en.common.faultKind
const AUDIT_TYPES: Readonly<Record<string, string>> = en.common.auditType

/**
 * A cause code as the operator reads it (fix wave J, JW-13 / JW-27): the fault's name where the vocabulary
 * has one ("Storage full"), else the code as it is. The vocabulary is asked first, so a code it does
 * not hold is never looked up as a sentence (and never recorded as a missing one).
 */
export function causeWords(t: TFunction, cause: string): string {
  return Object.prototype.hasOwnProperty.call(FAULT_KINDS, cause) ? t(`common.faultKind.${cause}` as never) : cause
}

/** The name of an audit / custody action where the audit vocabulary has one, else null. */
export function auditActionWords(t: TFunction, action: string): string | null {
  return Object.prototype.hasOwnProperty.call(AUDIT_TYPES, action) ? (t(`common.auditType.${action}` as never) as string) : null
}
