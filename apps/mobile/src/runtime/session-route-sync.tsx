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
 *
 * LIVE mode (decision D169, finding F-2 of row W72): RESYNCED can come before the store holds the
 * Core's snapshot (after an outage the Live source confirms the session first, CPC1-35), and the
 * rendered session is older still. So the heartbeat resync waits until the Live source's store holds
 * that snapshot (`watchLiveResync`, `live-resync-watch.ts`) and then reads the session from that store
 * with the selector the runtime's contract renders it with (`selectActiveSessionInfo`). SIMULATED and
 * HEARTBEAT keep the rendered session: their resync signal replaces no data.
 */
import type { Href } from 'expo-router';
// The hooks module directly, not the `expo-router` entry: the entry also loads `standard-navigation`
// (ESM only), which the step-67 Jest transform allowlist does not cover. Every suite that renders
// `AppProviders` imports this file, and only the step-70 router harness mocks that package. Same
// module instance as the entry re-exports (`build/exports.js` → `./hooks`).
import { usePathname, useRouter } from 'expo-router/build/hooks';
import { useCallback, useEffect, useRef } from 'react';
import { liveOf } from '@dems/shared/live';
import { useActiveSession, type ActiveSessionInfo } from './contract';
import { useRuntimeInternals } from './internals';
import { watchLiveResync } from './live-resync-watch';
import { reportRuntimeIssue } from './log';
import { hrefPath, isForcedTransition, resyncNavigation, type ResyncTrigger } from './route-sync';
import type { MobileLiveSim } from './sim-adapters';
import { selectActiveSessionInfo } from './sim-runtime-provider';

export function SessionRouteSync(): null {
  const session = useActiveSession();
  const pathname = usePathname();
  const router = useRouter();
  const internals = useRuntimeInternals();
  const bus = internals?.resyncBus ?? null;
  const sim = internals?.sim ?? null;

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

  // The subscription and the Live watch outlive renders (the watch remembers an outage), so the
  // callback reads the newest `resync` through a ref instead of re-subscribing when it changes.
  const latestResync = useRef(resync);
  useEffect(() => {
    latestResync.current = resync;
  }, [resync]);
  useEffect(() => {
    const live = sim === null ? null : liveOf<MobileLiveSim>(sim);
    if (bus === null) return undefined;
    if (sim === null || live === null) return bus.subscribe(() => latestResync.current('heartbeat', latest.current));
    // D169: in LIVE, once the store holds the Core's snapshot, from that store.
    const watch = watchLiveResync(live);
    const unsubscribe = bus.subscribe(() =>
      watch.whenSynced(() =>
        latestResync.current('heartbeat', { session: selectActiveSessionInfo(sim.store.getState()), pathname: latest.current.pathname }),
      ),
    );
    return () => {
      unsubscribe();
      watch.dispose();
    };
  }, [bus, sim]);

  return null;
}
