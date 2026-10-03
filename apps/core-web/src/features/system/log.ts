/**
 * The System page's structured error record (level, source, message, stack, context, timestamp).
 * Mock-core has no client log endpoint (D3/D4, D41(g)), so the record goes to the dev console, as
 * on the other pages. `context` never carries personal data: only IDs, enums and counts.
 */
export function logSystemError(
  source: string,
  error: unknown,
  context: Record<string, unknown> = {},
  level: 'error' | 'warn' = 'error',
) {
  if (!import.meta.env.DEV) return
  const record = {
    level,
    source: `System.${source}`,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    timestamp: new Date().toISOString(),
  }
  if (level === 'warn') console.warn('[core-web] system', record)
  else console.error('[core-web] system', record)
}
