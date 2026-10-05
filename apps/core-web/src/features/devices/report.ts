/**
 * Where a failure of a Devices & Inputs control is written (backend task, plan row W70): the page's
 * own log through the console's one page-report helper, `createPageReporter` of `@/lib/page-report`
 * (plan row W0, item 8 — finding F70-5, decision D156: this file was a copy of the Dashboard's; the
 * helper moved to `lib/` by decision D165). The record's discipline is written there: a fixed
 * sentence, the cause by its class, code and status, never its text; non-secret facts of the caller
 * in `context`.
 */
import { createPageReporter } from '@/lib/page-report'

const devices = createPageReporter('dev')

/** A correlation ID per failed control action (`dev-<time>-<n>`), so its records can be joined. */
export const newDevicesCorrelationId = devices.newCorrelationId

/**
 * Writes one record to the page's own log: `(source, error, message, context?, level = 'error', sink?)`.
 * Never throws (the sink does not). `sink` is for tests; the page passes nothing.
 */
export const reportDevicesError = devices.report
