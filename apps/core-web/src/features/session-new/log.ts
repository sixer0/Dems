/**
 * The flow's structured log record (level, source, message, stack, context, correlation ID,
 * timestamp). The console has no client-log endpoint (D3/D4, D41(g)), so the record goes to the
 * page's own log, `webErrorSink` of `@/runtime` (in memory, printed to the console in a dev build,
 * never sent anywhere); the operator always sees a friendly kit toast instead.
 *
 * What a record holds (plan row W64; the discipline of `features/login/report.ts`, finding CPW1-8):
 * - `message`: a fixed sentence naming the step, never the text of an error, which is not trusted
 *   to be free of input;
 * - `context`: the caller's facts (session ID, step, correlation ID) and the facts of the error by
 *   its class: `errorClass`, `code`, `status`, the transport `reason`; for a refused result union,
 *   its `reason` code;
 * - `stack`: the frames of an `Error` without its first line (that line repeats the message).
 * No personal data goes into `context`: subject names and notes are never logged.
 */
import { webErrorSink, type ErrorSink } from '@/runtime'

let sequence = 0

/** One ID per flow attempt (create → precheck → start), so its log lines can be grouped. */
export function newFlowCorrelationId(): string {
  sequence += 1
  return `sn-${Date.now().toString(36)}-${sequence}`
}

export type FlowLogLevel = 'error' | 'warn'

/** The facts of an error by its class; the text of its message is left out on purpose. */
export function errorFacts(error: unknown): Record<string, string | number> {
  // A refused result union (`createSession`) is logged by its reason code.
  if (typeof error === 'string') return { reason: error }
  if (!(error instanceof Error)) return { errorClass: typeof error }
  const facts: Record<string, string | number> = { errorClass: error.name }
  const { code, status, reason } = error as { code?: unknown; status?: unknown; reason?: unknown }
  if (typeof code === 'string') facts.code = code
  if (typeof status === 'number') facts.status = status
  if (typeof reason === 'string') facts.reason = reason
  return facts
}

function framesOf(error: unknown): string | undefined {
  if (!(error instanceof Error) || typeof error.stack !== 'string') return undefined
  const frames = error.stack.split('\n').slice(1).join('\n')
  return frames === '' ? undefined : frames
}

export function logSessionNew(
  level: FlowLogLevel,
  source: string,
  error: unknown,
  context: Record<string, unknown> = {},
  sink: Pick<ErrorSink, 'report'> = webErrorSink,
): void {
  const stack = framesOf(error)
  sink.report({
    level,
    source: `SessionNew.${source}`,
    message: `Start New Session: the step "${source}" did not complete.`,
    ...(stack === undefined ? {} : { stack }),
    context: { ...context, ...errorFacts(error) },
    at: Date.now(),
  })
}
