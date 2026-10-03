/**
 * The Evidence page's structured error record (level, source, message, stack, context, correlation
 * ID, timestamp). Mock-core has no client log endpoint (D3/D4, D41(g)), so, like steps 38, 39 and
 * the other pages, the record goes to the dev console only. The user always sees a friendly toast or
 * inline Alert instead (three-layer rule: feedback, log, graceful fallback).
 *
 * No personal data goes into `context`: export reasons are never logged (only their length), and
 * evidence is referred to by its ID.
 */
let sequence = 0

/** A correlation ID for one verification or export run, so its log lines can be grouped. */
export function newCorrelationId(kind: 'verify' | 'export' | 'media' | 'ui'): string {
  sequence += 1
  return `evi-${kind}-${Date.now().toString(36)}-${sequence}`
}

export type EvidenceLogLevel = 'error' | 'warn' | 'info'

export function logEvidence(
  level: EvidenceLogLevel,
  source: string,
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  if (!import.meta.env.DEV) return
  const record = {
    level,
    source: `Evidence.${source}`,
    message: error instanceof Error ? error.message : String(error),
    stack_trace: error instanceof Error ? error.stack : undefined,
    context,
    timestamp: new Date().toISOString(),
  }
  if (level === 'error') console.error('[core-web] evidence', record)
  else if (level === 'warn') console.warn('[core-web] evidence', record)
  else console.info('[core-web] evidence', record)
}

export function logEvidenceError(source: string, error: unknown, context: Record<string, unknown> = {}): void {
  logEvidence('error', source, error, context)
}
