/**
 * Session-state routing (04_mobile_specs §3.3, §3.5, §3.7; step 70).
 *
 * `sessionResyncHref` is the §3.7 table as a pure function: where a session in a given state
 * belongs. The boot router uses it for the post-sign-in precedence (§3.3), the session routes use
 * it for their deep-link policies (§3.5), and the runtime's `SessionRouteSync` (step 73, owner of
 * `src/runtime/**`) should call it instead of keeping a second copy of the table.
 */
import type { SessionState } from '@dems/shared/domain';

/** A session-flow href. Literal forms, so they type-check against the typed routes. */
export type SessionHref =
  | '/session/new?step=1'
  | '/session/new?step=2'
  | '/session/new?step=3'
  | '/session/live'
  | '/session/finalizing'
  | '/session/recovery'
  | `/session/summary/${string}`;

export interface ResyncContext {
  /** The session the state belongs to (needed for the summary route). */
  readonly sessionId?: string | null;
  /**
   * Whether the operator has acknowledged the last SEALED summary (SCR-02 `acknowledgeSummary`).
   * Unknown (`undefined`) counts as acknowledged, so an idle app never jumps to an old summary.
   */
  readonly summaryAcknowledged?: boolean;
}

/**
 * 04 §3.7: the route a session state belongs to, or `null` for "stay" (no session, or SEALED
 * with the summary acknowledged).
 */
export function sessionResyncHref(state: SessionState | null, context: ResyncContext = {}): SessionHref | null {
  switch (state) {
    case null:
      return null;
    case 'CREATE':
      return '/session/new?step=1';
    case 'PRECHECK':
      return '/session/new?step=2';
    case 'ARMED':
      return '/session/new?step=3';
    case 'RECORDING':
      return '/session/live';
    case 'STOPPING':
    case 'FINALIZING':
      return '/session/finalizing';
    case 'SEALED':
      return context.summaryAcknowledged === false && context.sessionId
        ? `/session/summary/${context.sessionId}`
        : null;
    case 'FAULT':
    case 'RECOVERY':
      return '/session/recovery';
    default:
      return null;
  }
}

/**
 * States in which a new session cannot start (04 §3.5: `/session/new` is "refused (toast) if a
 * session is active"). CREATE, PRECHECK and ARMED are the Start Session flow itself, so the
 * wizard stays reachable for them.
 */
const SESSION_BUSY: ReadonlySet<SessionState> = new Set(['RECORDING', 'STOPPING', 'FINALIZING', 'FAULT', 'RECOVERY']);

export function isSessionBusy(state: SessionState | null): boolean {
  return state !== null && SESSION_BUSY.has(state);
}

/** Session states that keep the flow screens modal (no swipe-back; 04 §3.6 `gestureEnabled: false`). */
export function isSessionActive(state: SessionState | null): boolean {
  return state !== null && state !== 'SEALED';
}

/** Where a signed-in operator lands (04 §3.3): the resync target, then the pending href, then Home. */
export function postSignInHref(resync: string | null, pending: string | null): string {
  return resync ?? pending ?? '/home';
}
