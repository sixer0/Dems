/**
 * The API Reference page's own log (backend task 04_client_integration_spec §11 AR-9, CL-6a; plan
 * row W84; decision D182). The page binds the console's one page reporter (`@/lib/page-report`,
 * row W0 §15) to the prefix `api`, so a record goes to `webErrorSink`: kept in memory, printed to the
 * console in a dev build, never sent anywhere and never put in web storage.
 *
 * What a record holds, and nothing else:
 *
 * | Member | Value |
 * |--------|-------|
 * | `message` | The caller's fixed sentence, never the text of an error (it may quote input) |
 * | `source` | `ApiReference.<call site>` |
 * | `context` | Of a request, only its `method`, its `path` (no origin, no query) and its `status`; then the reporter's own facts: the cause by its class (`errorName`), its code and status, and an `api-…` correlation ID |
 *
 * Never a request body, an answer, a header, a query string or a stack (D182 removed the message
 * and the stack the page logged before). A Try-it body can hold a password, a pairing code or a
 * token, and an answer can hold Core data.
 */
import { createPageReporter } from '@/lib/page-report'

export type ApiReferenceLogLevel = 'error' | 'warn'

/** The facts of a request a record may carry (AR-9: method, path and status only). */
export interface ApiReferenceLogContext {
  method?: string
  /** The path of the URL only: no origin, no query, no fragment. */
  path?: string
  status?: number
}

const page = createPageReporter('api')

/** Writes one record to the page's own log. Never throws. */
export function logApiReference(
  level: ApiReferenceLogLevel,
  source: string,
  error: unknown,
  message: string,
  context: ApiReferenceLogContext = {},
): void {
  const facts: Record<string, string | number> = {}
  if (context.method !== undefined) facts.method = context.method
  if (context.path !== undefined) facts.path = context.path
  if (context.status !== undefined) facts.status = context.status
  page.report(`ApiReference.${source}`, error, message, facts, level)
}
