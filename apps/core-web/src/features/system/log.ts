/**
 * The System page's own log (plan row W76; gateway_check/08a §15, decision D165): the console's one
 * page reporter, `createPageReporter('sys')` from `@/lib/page-report`, bound once here.
 *
 * Every record goes to the page's own log (`webErrorSink`: kept in memory in every build, printed to
 * the console in a dev build, never sent anywhere). The message is a fixed sentence built from the
 * step's code name, never the text of the error; the cause is named by its class, code and status;
 * `context` keeps plain values only (IDs, enums, counts): no personal data, no credential.
 *
 * A refusal the shared presenter words (`useCoreErrorPresenter`) is NOT recorded here: the Live
 * source reports every rejected action itself (CL-24). This log is for the branch the presenter left
 * to the page.
 */
import { createPageReporter } from '@/lib/page-report'

const page = createPageReporter('sys')

/** The page's reporter: one record per call, correlation IDs `sys-…`. */
export const reportSystemError = page.report
export const newSystemCorrelationId = page.newCorrelationId

type Fact = string | number | boolean | null

/** The plain values of `context`; anything else (an object, a function) is left out. */
function plainFacts(context: Readonly<Record<string, unknown>>): Record<string, Fact> {
  const facts: Record<string, Fact> = {}
  for (const [key, value] of Object.entries(context)) {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') facts[key] = value
  }
  return facts
}

/**
 * Writes one record for a step of the System page that did not complete. `source` is a code name
 * of the step (`Maintenance.restart`), never input.
 */
export function logSystemError(
  source: string,
  error: unknown,
  context: Readonly<Record<string, unknown>> = {},
  level: 'error' | 'warn' = 'error',
): void {
  reportSystemError(`System.${source}`, error, `System: the step "${source}" did not complete.`, plainFacts(context), level)
}
