/**
 * `SessionRouteSync` (04_mobile_specs §3.7), mounted by `(app)/_layout.tsx` (step 70).
 *
 * It forces navigation with `router.replace` only for the §3.7 triggers it owns:
 * - **heartbeat resync** (trigger 2): the heartbeat client's `onResync` after an OFFLINE → LIVE
 *   reconnect (§5.5), delivered through the runtime's resync bus;
 * - **simulator-driven transitions** (trigger 3): STOPPING → FINALIZING, FINALIZING → SEALED,
 *   any → FAULT (`isForcedTransition`).
 *
 * Trigger 1 ("right after sign-in", including a relaunch after a crash) is the boot router's: when
 * the `Stack.Protected` guard admits `(app)`, Expo Router falls back to `/` and `useBootHref`
 * (step 70) applies the same table with the §3.3 precedence. Doing it here too would navigate
 * twice, so this component never navigates on mount.
 *
 * A resync never creates a session: it only reads the state (the simulator's idempotent
 * `createSession` is the other half of that guarantee, S26).
 */
import type { Href } from 'expo-router';
// The hooks module directly, not the `expo-router` entry: the entry also loads `standard-navigation`
// (ESM only), which the step-67 Jest transform allowlist does not cover. Every suite that renders
// `AppProviders` imports this file, and only the step-70 router harness mocks that package. Same
// module instance as the entry re-exports (`build/exports.js` → `./hooks`).
import { usePathname, useRouter } from 'expo-router/build/hooks';
import { useCallback, useEffect, useRef } from 'react';
import { useActiveSession, type ActiveSessionInfo } from './contract';
import { useRuntimeInternals } from './internals';
import { reportRuntimeIssue } from './log';
import { hrefPath, isForcedTransition, resyncNavigation, type ResyncTrigger } from './route-sync';

export function SessionRouteSync(): null {
  const session = useActiveSession();
  const pathname = usePathname();
  const router = useRouter();
  const bus = useRuntimeInternals()?.resyncBus ?? null;

  // The latest values for the bus callback, which outlives renders.
  const latest = useRef<{ session: ActiveSessionInfo; pathname: string }>({ session, pathname });
  useEffect(() => {
    latest.current = { session, pathname };
  }, [session, pathname]);

  const resync = useCallback(
    (trigger: ResyncTrigger, current: { session: ActiveSessionInfo; pathname: string }) => {
      const { session: s, pathname: path } = current;
      const href = resyncNavigation(path, s.state, {
        sessionId: s.sessionId,
        ...(s.summaryAcknowledged !== undefined ? { summaryAcknowledged: s.summaryAcknowledged } : {}),
      });
      if (href === null) return;
      try {
        router.replace(href as Href);
        reportRuntimeIssue('info', `runtime.routeSync.${trigger}`, 'Resynced route to the session state', {
          state: s.state,
          to: hrefPath(href),
        });
      } catch (error) {
        reportRuntimeIssue('error', `runtime.routeSync.${trigger}`, error, { state: s.state });
      }
    },
    [router],
  );

  const previous = useRef(session.state);
  useEffect(() => {
    const prev = previous.current;
    previous.current = session.state;
    if (isForcedTransition(prev, session.state)) resync('transition', { session, pathname });
    // Only a state change is a trigger; a route change alone never is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.state, resync]);

  useEffect(() => bus?.subscribe(() => resync('heartbeat', latest.current)), [bus, resync]);

  return null;
}
