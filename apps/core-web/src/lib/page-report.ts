/**
 * A page's own log reporter — the console's one page-report helper (plan row W0, item 8: finding
 * F70-5, decision D156; moved here from `features/dashboard/report.ts` by decision D165).
 *
 * The console has no client-log endpoint (predecessor decisions D3, D4, D41(g)), so the record goes
 * to the page's own log, `webErrorSink` of `@/runtime`: kept in memory in every build, printed to the
 * console in a dev build, never sent anywhere and never put in web storage. In Live mode the Live
 * source also reports every rejected action itself (CL-24); this record is the page's own, for the
 * branch the refusal presenter left to the page.
 *
 * The discipline of `components/shell/shell-report.ts` and `features/login/report.ts` (finding
 * CPW1-8, decision D144(1)): `message` is the caller's fixed sentence, never the text of the error,
 * which is not trusted to be free of input; the cause is named by its class, code and status;
 * `context` holds non-secret facts of the caller (a device ID, a command name, a channel).
 *
 * A page binds its prefix once, in its own module:
 *
 * ```ts
 * const page = createPageReporter('usr')
 * export const reportUsersError = page.report
 * ```
 */
import { webErrorSink, type ErrorSink } from '@/runtime'

/** The facts that identify a cause without quoting it: its code and its status, when it has them. */
function causeFacts(error: unknown): Record<string, string | number> {
  if (typeof error !== 'object' || error === null) return {}
  const { code, status } = error as { code?: unknown; status?: unknown }
  return {
    ...(typeof code === 'string' || typeof code === 'number' ? { code } : {}),
    ...(typeof status === 'number' ? { status } : {}),
  }
}

export interface PageReporter {
  /** A correlation ID per failed control action (`<prefix>-<time>-<n>`), so its records can be joined. */
  readonly newCorrelationId: () => string
  /**
   * Writes one record to the page's own log. Never throws (the sink does not). `sink` is for tests;
   * a page passes nothing.
   */
  readonly report: (
    source: string,
    error: unknown,
    message: string,
    context?: Record<string, string | number | boolean | null>,
    level?: 'error' | 'warn',
    sink?: Pick<ErrorSink, 'report'>,
  ) => void
}

/** The reporter of one page: its correlation IDs start with `prefix` and count on their own. */
export function createPageReporter(prefix: string): PageReporter {
  let sequence = 0
  const newCorrelationId = (): string => {
    sequence += 1
    return `${prefix}-${Date.now().toString(36)}-${sequence}`
  }
  const report: PageReporter['report'] = (source, error, message, context = {}, level = 'error', sink = webErrorSink) => {
    sink.report({
      level,
      source,
      message,
      at: Date.now(),
      context: {
        ...context,
        errorName: error instanceof Error ? error.name : typeof error,
        ...causeFacts(error),
        correlationId: newCorrelationId(),
      },
    })
  }
  return { newCorrelationId, report }
}
