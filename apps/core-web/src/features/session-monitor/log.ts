/**
 * The page's structured error record (level, source, message, context, correlation ID).
 *
 * Mock-core and the Core server have no client log endpoint (D3/D4, D41(g)), so the record goes to
 * the page's own log, `webErrorSink` of `@/runtime` (plan row W65): kept in memory, printed to the
 * console in a dev build (as this helper did before the row), never sent anywhere and never stored
 * in web storage. In Live mode the Live source records every rejected action itself as well
 * (CL-24); this record says which control of the page it was.
 *
 * Discipline (finding CPW1-8, the Login page's rule): the message is a fixed sentence, and the
 * error is named by its class, its code, its status and its transport reason, never by its text,
 * because the text of an unknown error is not trusted to be free of input. No personal data goes
 * in `context`: note and reason texts are never logged, only their length.
 */
import { webErrorSink, type ErrorSink } from '@/runtime'

let sequence = 0

/** One ID per press, so the page's record can be joined with the Live source's record of the same action. */
export function newSessionMonitorCorrelationId(source: string): string {
  sequence += 1
  return `sm-${source}-${Date.now().toString(36)}-${sequence}`
}

/** What an error says about itself without its text: class name, code, status, transport reason. */
export function describeSessionMonitorError(error: unknown): Record<string, string | number | null> {
  if (!(error instanceof Error)) return { error: typeof error, code: null, status: null }
  const facts = error as Error & { code?: unknown; status?: unknown; reason?: unknown; event?: unknown; from?: unknown }
  return {
    error: error.name,
    code: typeof facts.code === 'string' ? facts.code : null,
    status: typeof facts.status === 'number' ? facts.status : null,
    ...(typeof facts.reason === 'string' ? { reason: facts.reason } : {}),
    ...(typeof facts.from === 'string' ? { from: facts.from } : {}),
  }
}

export function logSessionMonitorError(
  source: string,
  error: unknown,
  context: Record<string, unknown> = {},
  sink: Pick<ErrorSink, 'report'> = webErrorSink,
): void {
  sink.report({
    level: 'error',
    source: `SessionMonitor.${source}`,
    message: `A Session Monitor action failed (${source}).`,
    at: Date.now(),
    context: { ...context, ...describeSessionMonitorError(error), correlationId: newSessionMonitorCorrelationId(source) },
  })
}
