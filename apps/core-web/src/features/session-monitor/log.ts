/**
 * The page's structured error record (level, source, message, stack, context). Mock-core has no
 * client log endpoint (D3/D4, D41(g)), so this is the dev console only, like steps 38 and 39.
 * No personal data goes in `context`: note and reason texts are never logged, only their length.
 */
export function logSessionMonitorError(source: string, error: unknown, context: Record<string, unknown> = {}) {
  if (!import.meta.env.DEV) return
  console.error('[core-web] session monitor', {
    level: 'error',
    source: `SessionMonitor.${source}`,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    timestamp: new Date().toISOString(),
  })
}
