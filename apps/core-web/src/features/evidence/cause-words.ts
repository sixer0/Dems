import type { TFunction } from 'i18next'
import { causeCodeWords } from '@/lib/event-words'

/**
 * A cause code as the operator reads it (fix wave J, JW-13 / JW-27): the fault's name where the vocabulary
 * has one ("Storage full"). Fix wave Q (JW-13): the ONE map is `lib/event-words.ts`; a code no vocabulary
 * holds reads in its readable form ("Capture stalled"), never as the raw code.
 */
export function causeWords(t: TFunction, cause: string): string {
  return causeCodeWords(t, cause)
}
