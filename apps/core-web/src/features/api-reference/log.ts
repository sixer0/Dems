/**
 * The API Reference page's structured log record (level, source, message, stack, context,
 * timestamp). mock-core has no client log endpoint (D3/D4, D41(g)), so the record goes to the dev
 * console, as on the other pages. `context` never carries personal data or request bodies: only
 * methods, paths, statuses and IDs.
 */
export type ApiReferenceLogLevel = 'error' | 'warn' | 'info'

export function logApiReference(
  level: ApiReferenceLogLevel,
  source: string,
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  if (!import.meta.env.DEV) return
  const log = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info
  log('[core-web] api-reference', {
    level,
    source: `ApiReference.${source}`,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    timestamp: new Date().toISOString(),
  })
}
