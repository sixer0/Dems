/**
 * The page's structured error record (level, source, message, stack, context, timestamp).
 * Mock-core has no client log endpoint (D3/D4, D41(g)), so, like steps 38, 39 and 44, the record
 * goes to the dev console only. No personal data goes into `context`: an export reason is never
 * logged, only its length.
 */
export type SecurityAuditLogLevel = 'error' | 'warn' | 'info'

export function logSecurityAudit(
  level: SecurityAuditLogLevel,
  source: string,
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  if (!import.meta.env.DEV) return
  const record = {
    level,
    source: `SecurityAudit.${source}`,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    timestamp: new Date().toISOString(),
  }
  if (level === 'error') console.error('[core-web] security-audit', record)
  else console.warn('[core-web] security-audit', record)
}
