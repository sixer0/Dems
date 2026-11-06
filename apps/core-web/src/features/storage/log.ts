/**
 * The Storage page's structured error record (level, source, message, stack frames, context with a
 * correlation ID, timestamp).
 *
 * The console has no client-log endpoint (predecessor decisions D3, D4, D41(g)), so the record goes
 * to the page's own log, `webErrorSink` of `@/runtime`: kept in memory in every build, printed to the
 * console in a dev build (where the predecessor's `console.error` wrote), never sent anywhere and
 * never put in web storage. In Live mode the Live source also reports every rejected action itself
 * (CL-24); this record is the page's own, for the branch the refusal presenter left to the page.
 *
 * The discipline of `features/login/report.ts` and `components/shell/shell-report.ts` (finding
 * CPW1-8, decision D144(1); plan row W71): `message` is a fixed sentence naming the step, never the
 * text of the error, which is not trusted to be free of input; the cause is named by its class, code
 * and status; the stack keeps its frames without the first line (that line repeats the message).
 * `context` never carries personal data: only IDs and enums.
 */
import { webErrorSink, type ErrorSink } from '@/runtime'

let sequence = 0

/** A correlation ID per failed step (`stor-<time>-<n>`), so its records can be joined. */
export function newStorageCorrelationId(): string {
  sequence += 1
  return `stor-${Date.now().toString(36)}-${sequence}`
}

/** The facts that identify a cause without quoting it: its class, its code and its status. */
function causeFacts(error: unknown): Record<string, string | number> {
  if (!(error instanceof Error)) return { errorName: typeof error }
  const facts: Record<string, string | number> = { errorName: error.name }
  const { code, status } = error as { code?: unknown; status?: unknown }
  if (typeof code === 'string' || typeof code === 'number') facts.code = code
  if (typeof status === 'number') facts.status = status
  return facts
}

/** The frames of an `Error` without its first line, which repeats the message. */
function framesOf(error: unknown): string | undefined {
  if (!(error instanceof Error) || typeof error.stack !== 'string') return undefined
  const frames = error.stack.split('\n').slice(1).join('\n')
  return frames === '' ? undefined : frames
}

/**
 * Writes one record of level `error` to the page's own log. Never throws (the sink does not).
 * `sink` is for tests; the page passes nothing.
 */
export function logStorageError(
  source: string,
  error: unknown,
  context: Record<string, unknown> = {},
  sink: Pick<ErrorSink, 'report'> = webErrorSink,
): void {
  const stack = framesOf(error)
  sink.report({
    level: 'error',
    source: `Storage.${source}`,
    message: `Storage: the step "${source}" did not complete.`,
    ...(stack === undefined ? {} : { stack }),
    at: Date.now(),
    context: { ...context, ...causeFacts(error), correlationId: newStorageCorrelationId() },
  })
}
