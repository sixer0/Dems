/**
 * Where a failure of a Dashboard control is written (backend task, plan row W63): the page's own log
 * through the console's one page-report helper, `createPageReporter` of `@/lib/page-report` (plan row
 * W0, item 8; moved to `lib/` by decision D165). The record's discipline is written there: a fixed
 * sentence, the cause by its class, code and status, never its text; non-secret facts of the caller
 * in `context`; the page's own sink, `webErrorSink`, never the console directly.
 */
import { createPageReporter } from '@/lib/page-report'
import { webErrorSink, type ErrorSink } from '@/runtime'

const dashboard = createPageReporter('dash')

/** A correlation ID per failed control action of the Dashboard (`dash-<time>-<n>`). */
export const newDashboardCorrelationId = dashboard.newCorrelationId

/**
 * Writes one record of level `error` to the page's own log. Never throws (the sink does not).
 * `sink` is for tests; the page passes nothing.
 */
export function reportDashboardError(
  source: string,
  error: unknown,
  message: string,
  context: Record<string, string | number | boolean | null> = {},
  sink: Pick<ErrorSink, 'report'> = webErrorSink,
): void {
  dashboard.report(source, error, message, context, 'error', sink)
}
