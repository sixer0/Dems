/**
 * Where a failure of the commissioning screen is written (task 4, blueprint row 112): the page's own
 * log through the console's one page-report helper (`@/lib/page-report`). Its discipline is written
 * there: a fixed sentence, the cause by its class, code and status, never its text; non-secret facts
 * in `context`. No address, interface name or device text is put in a record.
 */
import { createPageReporter } from '@/lib/page-report'

const commissioning = createPageReporter('com')

export const reportCommissioningError = commissioning.report

/** The fixed sentences of the page's records. */
export const COMMISSIONING_RECORD = {
  panel: 'A panel of the commissioning screen failed to render.',
  threw: 'A request of the commissioning screen could not be sent.',
  failed: 'A request of the commissioning screen was not carried out.',
} as const
