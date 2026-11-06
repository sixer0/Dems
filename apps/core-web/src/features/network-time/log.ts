/**
 * The Network & Time page's structured error record (level, source, message, context with the
 * error's name and a correlation ID, timestamp).
 *
 * The console has no client-log endpoint (predecessor decisions D3, D4, D41(g)), so the record goes
 * to the page's own log, `webErrorSink` of `@/runtime`: kept in memory in every build, printed to the
 * console in a dev build (where this module's `console.error` wrote before), never sent anywhere and
 * never put in web storage.
 *
 * The discipline of the other page logs (`features/storage/log.ts`, `features/session-monitor/log.ts`;
 * finding CPW1-8, decision D144(1)); plan row W0, item 5 (finding F71-3, decision D155): `message` is a
 * fixed sentence naming the step, never the text of the error, which is not trusted to be free of
 * input; the cause is named by its class name only. `context` never carries personal data: only IDs
 * and enums (the panel, React's component stack).
 */
import { webErrorSink, type ErrorSink } from '@/runtime'

let sequence = 0

/** A correlation ID per failed step (`nt-<time>-<n>`), so its records can be joined. */
export function newNetworkTimeCorrelationId(): string {
  sequence += 1
  return `nt-${Date.now().toString(36)}-${sequence}`
}

/**
 * Writes one record of level `error` to the page's own log. Never throws (the sink does not).
 * `sink` is for tests; the page passes nothing.
 */
export function logNetworkTimeError(
  source: string,
  error: unknown,
  context: Record<string, unknown> = {},
  sink: Pick<ErrorSink, 'report'> = webErrorSink,
): void {
  sink.report({
    level: 'error',
    source: `NetworkTime.${source}`,
    message: `Network & Time: the step "${source}" did not complete.`,
    at: Date.now(),
    context: { ...context, errorName: error instanceof Error ? error.name : typeof error, correlationId: newNetworkTimeCorrelationId() },
  })
}
