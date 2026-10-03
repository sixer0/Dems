/**
 * The Storage page's structured error record (level, source, message, stack, context, timestamp).
 * Mock-core has no client log endpoint (D3/D4, D41(g)), so the record goes to the dev console, as
 * in steps 38, 39 and the other pages. `context` never carries personal data: only IDs and enums.
 */
export function logStorageError(source: string, error: unknown, context: Record<string, unknown> = {}) {
  if (!import.meta.env.DEV) return
  console.error('[core-web] storage', {
    level: 'error',
    source: `Storage.${source}`,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    timestamp: new Date().toISOString(),
  })
}
