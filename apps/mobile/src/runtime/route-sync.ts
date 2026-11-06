/**
 * State-routed resync (04_mobile_specs §3.7; T-M06), the pure part.
 *
 * `resyncTarget(state, context)` is the §3.7 table. The table itself lives once, in the
 * navigation shell's `sessionResyncHref` (`src/navigation/session-routes.ts`, step 70), which the
 * boot router already uses for the post-sign-in precedence (§3.3); this function is the runtime's
 * name for it, so there is exactly one copy of the table (step 70 asked for this).
 *
 * `isForcedTransition(prev, next)` says which simulator-driven transitions force navigation
 * (§3.7 trigger 3): STOPPING → FINALIZING, FINALIZING → SEALED, and any state → FAULT. Every other
 * change (for example RECORDING while the operator browses Evidence) never yanks the user: the
 * live mini-bar shows instead.
 */
import type { SessionState } from '@dems/shared/domain';
import { sessionResyncHref, type ResyncContext, type SessionHref } from '@/navigation/session-routes';

export type { ResyncContext, SessionHref } from '@/navigation/session-routes';

/** 04 §3.7: the route a session state belongs to, or `null` (stay). */
export function resyncTarget(state: SessionState | null, context: ResyncContext = {}): SessionHref | null {
  return sessionResyncHref(state, context);
}

/** Why a resync ran (logged; §3.7 triggers). Trigger 1, "right after sign-in", is the boot router's (§3.3, step 70). */
export type ResyncTrigger = 'heartbeat' | 'transition';

/** §3.7 trigger 3: simulator-driven transitions inside the flow. */
export function isForcedTransition(prev: SessionState | null, next: SessionState | null): boolean {
  if (prev === next) return false;
  if (next === 'FAULT') return true;
  return (prev === 'STOPPING' && next === 'FINALIZING') || (prev === 'FINALIZING' && next === 'SEALED');
}

/** The path part of an href (`/session/new?step=2` → `/session/new`). */
export function hrefPath(href: string): string {
  const query = href.indexOf('?');
  return query >= 0 ? href.slice(0, query) : href;
}

/**
 * Where a resync should navigate from `pathname`, or `null` when there is nothing to do: no target,
 * or already on the target's path (the Start Session wizard reads its step from the state itself).
 */
export function resyncNavigation(pathname: string, state: SessionState | null, context: ResyncContext = {}): SessionHref | null {
  const target = resyncTarget(state, context);
  if (target === null) return null;
  return hrefPath(target) === pathname ? null : target;
}
