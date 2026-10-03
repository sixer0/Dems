/**
 * The flow's structured log record (level, source, message, stack, context, correlation ID,
 * timestamp). Mock-core has no client log endpoint (D3/D4, D41(g)), so, like the other pages, the
 * record goes to the dev console only; the operator always sees a friendly kit toast instead.
 * No personal data goes into `context`: subject names and notes are never logged, only the
 * session ID, the step and lengths.
 */
let sequence = 0

/** One ID per flow attempt (create → precheck → start), so its log lines can be grouped. */
export function newFlowCorrelationId(): string {
  sequence += 1
  return `sn-${Date.now().toString(36)}-${sequence}`
}

export type FlowLogLevel = 'error' | 'warn' | 'info'

export function logSessionNew(level: FlowLogLevel, source: string, error: unknown, context: Record<string, unknown> = {}): void {
  if (!import.meta.env.DEV) return
  const record = {
    level,
    source: `SessionNew.${source}`,
    message: error instanceof Error ? error.message : String(error),
    stack_trace: error instanceof Error ? error.stack : undefined,
    context,
    timestamp: new Date().toISOString(),
  }
  if (level === 'error') console.error('[core-web] session-new', record)
  else if (level === 'warn') console.warn('[core-web] session-new', record)
  else console.info('[core-web] session-new', record)
}
