import { webErrorSink } from '@/runtime'

/** What a caller may say about a failure of its own control; the default is the shell's own sentence. */
const DEFAULT_MESSAGE = 'A shell control could not complete its action.'

/**
 * The cause by its class, code and status. The text of an unknown error is NOT trusted to be free
 * of input (finding CPW1-8, decision D144(1): the discipline W55 states for this same sink in
 * `features/login/report.ts`), and in a dev build the sink also prints to the console Vite forwards
 * to the terminal (F72-6). A refusal of the Core server carries a code and a status; those are the
 * facts that identify it.
 */
function errorFacts(error: unknown): Record<string, string | number> {
  if (typeof error !== 'object' || error === null) return {}
  const { code, status } = error as { code?: unknown; status?: unknown }
  return {
    ...(typeof code === 'string' || typeof code === 'number' ? { code } : {}),
    ...(typeof status === 'number' ? { status } : {}),
  }
}

/**
 * Writes an error of a shell control to the page's own log (`runtime/error-sink.ts`: kept in
 * memory, printed in a dev build, never sent anywhere). The console has no client-log endpoint
 * (predecessor decisions D3, D4, D41(g)). The Live source reports a rejected action itself; this
 * is for what reaches a `fail` branch of the shell besides that.
 *
 * `message` is the CALLER's fixed sentence — one per control, chosen in the source — never a text
 * built from the error (CPW1-8). `context` holds non-secret facts of the caller's own (a mode, a
 * path); the class, code and status of the cause are added here.
 */
export function reportShellError(source: string, error: unknown, message: string = DEFAULT_MESSAGE, context?: Record<string, string | number | boolean | null>): void {
  webErrorSink.report({
    level: 'error',
    source,
    message,
    at: Date.now(),
    context: { ...context, errorName: error instanceof Error ? error.name : typeof error, ...errorFacts(error) },
  })
}
