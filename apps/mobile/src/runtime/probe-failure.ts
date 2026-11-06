/**
 * Background probes and keep-alives in LIVE mode: one slow or timed-out answer is never an outage by
 * itself (row FX-M1, defect E2E-T-1, ruling R5 of decision D201).
 *
 * What happened (E2E-T-1, tablet, 09:52): the Core answered the keep-alive `POST /api/v1/auth/touch`
 * in 28 ms, but the app's JS thread was starved (host load 22) and the typed client's 8 s budget, a
 * wall-clock timer, ran out first. The Live source rejected the touch with `LiveTransportError`
 * CORE_OFFLINE and reported it at level `error`, and the app's log wrote "The Core server is
 * unreachable (CORE_OFFLINE)" to `console.error`: a red LogBox error over the Evidence screen while
 * the link was ONLINE (`link: 'ONLINE'` in the record itself).
 *
 * The two rules of this file, both pure:
 *
 * 1. **Re-check once before declaring** (`isRecheckable`): a probe whose first attempt ran out of
 *    time is asked once more before its result is handed on. A starved thread has caught up by then,
 *    so the second answer measures the network, not the thread. Only probes are re-asked: reads, and
 *    the keep-alive, whose repetition only extends the idle time the Core already counts. A command
 *    is never sent twice.
 * 2. **The link decides what an outage is** (`judgeLiveRejection`): a rejection with no answer of the
 *    Core is judged through the runtime's one view of the link (`coreLinkViewOf`, row M0). Link
 *    `down`: the Core is unreachable, and the offline notice already says so; the record is a
 *    warning. Link `up` or `settling`: no outage. A probe is then recorded as `info` until it failed
 *    `PROBE_FAILURES_BEFORE_WARN` times in a row (consecutive failures, counted by the app's client),
 *    and its message says what it is; a command's failure stays a warning, worded by the refusal
 *    presenter where it is shown. Nothing of this is ever an `error`: an expected state of the link
 *    is not a fault (R6).
 */
import type { LiveLinkState } from '@dems/shared/live';
import type { SimErrorReport } from '@dems/shared/sim';
import { coreLinkViewOf } from './link-notice';
import type { RuntimeLogLevel } from './log';

/** The probes and the keep-alive: asked by the app or the Live source in the background, never on an operator's command. */
export const PROBE_OPERATIONS: ReadonlySet<string> = new Set([
  'getServiceHealth',
  'touchSession',
  'getAuthSession',
  'getSignInStatus',
  'getDeviceRegistration',
]);

/** The Live source's action name of a probe → its operation (the keep-alive is the action `touch`). */
const PROBE_ACTIONS: Readonly<Record<string, string>> = { touch: 'touchSession' };

/** Probe failures in a row while the link is up before the record turns from `info` to `warn`. */
export const PROBE_FAILURES_BEFORE_WARN = 2;

/** The typed client's word for a call that got no answer within its budget (`CoreErrorKind.TIMEOUT`). */
const TIMEOUT_KIND = 'TIMEOUT';

/** A probe whose attempt timed out is asked once more before its result is declared (rule 1). */
export function isRecheckable(operationId: string, result: { readonly ok: boolean; readonly kind?: unknown }): boolean {
  return PROBE_OPERATIONS.has(operationId) && !result.ok && result.kind === TIMEOUT_KIND;
}

/** A result that counts as "no answer" for the consecutive count: no status at all (a time-out, a lost connection). */
export function isUnanswered(result: { readonly ok: boolean; readonly status?: number | null }): boolean {
  return !result.ok && (result.status === null || result.status === undefined);
}

export interface JudgedReport {
  readonly level: RuntimeLogLevel;
  readonly message: string;
  /** Added to the record's context: how the link read and, for a probe, the failures in a row. */
  readonly context: Readonly<Record<string, string | number | null>>;
}

/** The link word a report carries (`context.link`), as one of the Live link's states, or `null`. */
function linkOf(report: SimErrorReport): LiveLinkState | null {
  const link = report.context?.link;
  return typeof link === 'string' ? (link as LiveLinkState) : null;
}

/**
 * Rule 2. The judgement of a Live source report, or `null` to keep the report as it is: only the
 * rejection of an action (`live.action.<name>`) for which the Core gave no answer
 * (`LiveTransportError`) is judged; a refusal, a misuse and a thrown error keep their own level.
 * `failuresInARow(operationId)` is the app client's count of probe attempts in a row without an answer.
 */
export function judgeLiveRejection(report: SimErrorReport, failuresInARow: (operationId: string) => number): JudgedReport | null {
  if (!report.source.startsWith('live.action.')) return null;
  if (report.context?.errorName !== 'LiveTransportError') return null;
  const action = report.source.slice('live.action.'.length);
  const view = coreLinkViewOf(linkOf(report));
  if (view === 'down') return { level: 'warn', message: report.message, context: { linkView: view } };
  const operationId = PROBE_ACTIONS[action] ?? (typeof report.context?.operationId === 'string' ? report.context.operationId : null);
  if (operationId === null || !PROBE_OPERATIONS.has(operationId)) {
    // A command the operator gave: its failure is shown by the refusal presenter; here it is a warning.
    return { level: 'warn', message: report.message, context: { linkView: view } };
  }
  const inARow = Math.max(1, failuresInARow(operationId));
  return {
    level: inARow >= PROBE_FAILURES_BEFORE_WARN ? 'warn' : 'info',
    message: `The background ${action} got no answer in time while the Core link was ${view === 'up' ? 'up' : 'not down'}; not an outage (R5).`,
    context: { linkView: view, failuresInARow: inARow },
  };
}
