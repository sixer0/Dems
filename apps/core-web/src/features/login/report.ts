/**
 * Structured error reporting for the Login page.
 *
 * mock-core has no client-log endpoint (D3/D4, D41(g)), so, like the shell (DR-38-14) and the
 * route error boundary, unexpected failures go to the dev console as one structured object per
 * event: `timestamp`, `level`, `source`, `message`, `stack`, `context`, `correlationId`.
 *
 * **Never pass a credential in `context`** (§14.8, design book §20.1 "no credentials in logs").
 * Callers pass only non-secret facts (the method, a storage key, the result reason). The
 * username is not logged either: a typed "username" may be a mistyped password.
 *
 * Live mode (backend task, plan row W55): `recordLoginIssue` writes to the page's own log
 * (`webErrorSink` of `@/runtime`: in memory, printed to the console in a dev build, never sent
 * anywhere), beside the Live source's own record of every rejected action. Its message is a
 * fixed sentence chosen by the caller, never the text of an unknown error.
 */
import type { ErrorSink } from '@/runtime'

export type LoginLogLevel = 'error' | 'warn' | 'info'

export interface LoginLogEntry {
  timestamp: string
  level: LoginLogLevel
  source: string
  message: string
  stack?: string
  context?: Record<string, string | number | boolean | null>
  correlationId: string
}

let sequence = 0

/** A per-attempt correlation ID (`login-<time>-<n>`), so one attempt's entries can be joined. */
export function newLoginCorrelationId(prefix = 'login'): string {
  sequence += 1
  return `${prefix}-${Date.now().toString(36)}-${sequence}`
}

export function buildLoginLogEntry(
  level: LoginLogLevel,
  source: string,
  error: unknown,
  context?: LoginLogEntry['context'],
  correlationId: string = newLoginCorrelationId(),
): LoginLogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    source,
    message: error instanceof Error ? error.message : String(error),
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    ...(context ? { context } : {}),
    correlationId,
  }
}

export function reportLoginIssue(
  level: LoginLogLevel,
  source: string,
  error: unknown,
  context?: LoginLogEntry['context'],
  correlationId?: string,
): LoginLogEntry {
  const entry = buildLoginLogEntry(level, source, error, context, correlationId)
  if (import.meta.env.DEV) {
    const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info
    sink('[core-web] login', entry)
  }
  return entry
}

/**
 * Live mode: one record in the page's own log. `message` is the caller's fixed sentence and
 * `context` holds non-secret facts only (a code, a status, the class of the error).
 */
export function recordLoginIssue(
  sink: Pick<ErrorSink, 'report'>,
  level: 'error' | 'warn',
  source: string,
  message: string,
  context: NonNullable<LoginLogEntry['context']>,
  correlationId: string = newLoginCorrelationId(),
): void {
  sink.report({ level, source, message, at: Date.now(), context: { ...context, correlationId } })
}
