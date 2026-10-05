/**
 * The Evidence page's structured error record (level, source, message, stack, context, correlation
 * ID, timestamp).
 *
 * The console has no client-log endpoint (predecessor decisions D3, D4, D41(g)), so the record goes
 * to the page's own log, `webErrorSink` of `@/runtime` (plan row W69, as W63, W64 and W65 did for
 * their pages): kept in memory, printed to the console in a dev build (where this helper wrote
 * before the row), never sent anywhere and never put in web storage. In Live mode the Live source
 * also reports every rejected action itself (CL-24); this record says which control of the page it
 * was. The user always sees a friendly toast or inline Alert instead (three-layer rule: feedback,
 * log, graceful fallback).
 *
 * Discipline (finding CPW1-8, the rule of `features/login/report.ts`): `message` is a fixed sentence
 * naming the step, never the text of the error, which is not trusted to be free of input; the cause
 * is named by its class, its code, its status and its transport reason. No personal data goes into
 * `context`: export reasons are never logged (only their length), and evidence is referred to by
 * its ID.
 */
import { webErrorSink, type ErrorSink } from '@/runtime'

let sequence = 0

/** A correlation ID for one verification or export run, so its log lines can be grouped. */
export function newCorrelationId(kind: 'verify' | 'export' | 'media' | 'ui' | 'archive'): string {
  sequence += 1
  return `evi-${kind}-${Date.now().toString(36)}-${sequence}`
}

export type EvidenceLogLevel = 'error' | 'warn'

/** What an error says about itself without its text: class, code, status, transport reason. */
export function evidenceErrorFacts(error: unknown): Record<string, string | number> {
  if (typeof error !== 'object' || error === null) return { errorClass: typeof error }
  const facts: Record<string, string | number> = { errorClass: error instanceof Error ? error.name : 'object' }
  const { code, status, reason } = error as { code?: unknown; status?: unknown; reason?: unknown }
  if (typeof code === 'string') facts.code = code
  if (typeof status === 'number') facts.status = status
  if (typeof reason === 'string') facts.reason = reason
  return facts
}

/** The frames of an `Error` without its first line (that line repeats the message). */
function framesOf(error: unknown): string | undefined {
  if (!(error instanceof Error) || typeof error.stack !== 'string') return undefined
  const frames = error.stack.split('\n').slice(1).join('\n')
  return frames === '' ? undefined : frames
}

/** Writes one record to the page's own log. Never throws (the sink does not). `sink` is for tests. */
export function logEvidence(
  level: EvidenceLogLevel,
  source: string,
  error: unknown,
  context: Record<string, unknown> = {},
  sink: Pick<ErrorSink, 'report'> = webErrorSink,
): void {
  const stack = framesOf(error)
  sink.report({
    level,
    source: `Evidence.${source}`,
    message: `An Evidence page step did not complete (${source}).`,
    ...(stack === undefined ? {} : { stack }),
    context: { ...context, ...evidenceErrorFacts(error) },
    at: Date.now(),
  })
}

export function logEvidenceError(source: string, error: unknown, context: Record<string, unknown> = {}): void {
  logEvidence('error', source, error, context)
}
