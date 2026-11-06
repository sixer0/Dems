/**
 * Where a failure of a Security & Audit control is written (step 51; backend task, plan row W75):
 * the page's own log through the console's one page-report helper, `createPageReporter` of
 * `@/lib/page-report` (plan row W0, decision D165). The record goes to `webErrorSink` of `@/runtime`:
 * kept in memory in every build, printed to the console in a dev build (where the predecessor's
 * `console.error` wrote), never sent anywhere and never put in web storage. In Live mode the Live
 * source also reports every rejected action itself (CL-24); this record is the page's own, for the
 * branch the refusal presenter left to the page.
 *
 * The discipline (finding CPW1-8): `message` is a fixed sentence naming the step, never the text of
 * the error, which is not trusted to be free of input; the cause is named by its class, code and
 * status; `context` holds non-secret facts only. An export reason is never logged, only its length.
 */
import { createPageReporter } from '@/lib/page-report'

export type SecurityAuditLogLevel = 'error' | 'warn'

const page = createPageReporter('sa')

/** A correlation ID per failed control action (`sa-<time>-<n>`), so its records can be joined. */
export const newSecurityAuditCorrelationId = page.newCorrelationId

/** The record's fixed sentence for a step of the page. */
export function securityAuditStepMessage(source: string): string {
  return `Security & Audit: the step "${source}" did not complete.`
}

/**
 * Writes one record to the page's own log. `source` names the step (`ChainPanel.verify`); the
 * record's source is `SecurityAudit.<source>`. Never throws (the sink does not).
 */
export function logSecurityAudit(
  level: SecurityAuditLogLevel,
  source: string,
  error: unknown,
  context: Record<string, string | number | boolean | null> = {},
): void {
  page.report(`SecurityAudit.${source}`, error, securityAuditStepMessage(source), context, level)
}
