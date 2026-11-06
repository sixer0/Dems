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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { liveOf } from '@dems/shared/live';
import { useActiveSession, type ActiveSessionInfo } from './contract';
import { emitForeignSession, foreignSessionPhase } from './foreign-session-signal';
import { useRuntimeInternals } from './internals';
import { watchLiveResync } from './live-resync-watch';
import { reportRuntimeIssue } from './log';
import { hrefPath, isForcedTransition, resyncNavigation, type ResyncTrigger } from './route-sync';
import type { MobileLiveSim } from './sim-adapters';
import { selectActiveSessionInfo } from './sim-runtime-provider';

/**
 * Fix wave Q (CT-05; ruling of D246): the paths on which this device takes part in the CURRENT session - the
 * Start Session wizard, the monitor, Finalizing, Recovery, and the Summary of that very session. Pure.
 */
export function isSessionFlowPath(pathname: string, sessionId: string | null): boolean {
  if (sessionId === null) return false;
  if (pathname === '/session/new' || pathname === '/session/live' || pathname === '/session/finalizing' || pathname === '/session/recovery') return true;
  return pathname === `/session/summary/${sessionId}`;
}

/**
 * The sessions THIS device took part in (CT-05). Module state, not component state: it outlives a remount of
 * the signed-in layout (a sign-out and sign-in, the still form of the motion watch).
 *
 * Decision D247 item 6: the newest of them are also kept on the device (`ATTENDED_STORAGE_KEY`), because the
 * boot router asks the same question right after a sign-in - also the first one after a relaunch, when a
 * session this device ran before the relaunch must still open its Summary. Until the stored list is read a
 * session counts as "not this device's": its Summary is offered on Home, never opened unasked.
 */
const attendedSessions = new Set<string>();
const attendedListeners = new Set<() => void>();
let attendedVersion = 0;

/** Where the attended sessions are kept (AsyncStorage; ids only, no personal data). */
export const ATTENDED_STORAGE_KEY = 'dems.session.attended.v1';
/** How many session ids are kept: the question is only ever asked about the Core's current session. */
export const ATTENDED_KEEP = 24;

function attendedChanged(): void {
  attendedVersion += 1;
  for (const listener of [...attendedListeners]) listener();
}

function persistAttended(): void {
  const newest = [...attendedSessions].slice(-ATTENDED_KEEP);
  AsyncStorage.setItem(ATTENDED_STORAGE_KEY, JSON.stringify(newest)).catch((error: unknown) => {
    // The set still holds for this run of the app; after a relaunch the Summary is then offered, not opened.
    reportRuntimeIssue('warn', 'runtime.routeSync.attended.persist', error, { kept: newest.length });
  });
}

/** Reads the stored list into the set (once per run of the app; safe to call again). */
export async function hydrateAttendedSessions(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ATTENDED_STORAGE_KEY);
    if (raw === null) return;
    const stored: unknown = JSON.parse(raw);
    if (!Array.isArray(stored)) return;
    let added = false;
    for (const id of stored) {
      if (typeof id === 'string' && id !== '' && !attendedSessions.has(id)) {
        attendedSessions.add(id);
        added = true;
      }
    }
    if (added) attendedChanged();
  } catch (error) {
    reportRuntimeIssue('warn', 'runtime.routeSync.attended.hydrate', error, {});
  }
}
void hydrateAttendedSessions();

/** Marks a session as one this device takes part in. */
export function markSessionAttended(sessionId: string | null): void {
  if (sessionId === null || attendedSessions.has(sessionId)) return;
  attendedSessions.add(sessionId);
  attendedChanged();
  persistAttended();
}

/** Whether this device took part in `sessionId` (as far as it knows now). */
export function isSessionAttended(sessionId: string | null): boolean {
  return sessionId !== null && attendedSessions.has(sessionId);
}

export function resetAttendedSessionsForTests(): void {
  attendedSessions.clear();
  attendedChanged();
}

const subscribeAttended = (onChange: () => void): (() => void) => {
  attendedListeners.add(onChange);
  return () => {
    attendedListeners.delete(onChange);
  };
};
const attendedSnapshot = (): number => attendedVersion;

/**
 * Decision D247 item 6 (the ruling of CT-05 extended to the sign-in): whether `sessionId` is a session of
 * THIS device. Without a Core link the device is the only console, so every session is its own; in LIVE mode
 * it is one this device stood on a flow screen of (`isSessionFlowPath`). The boot router opens an
 * unacknowledged Summary only for such a session; Home offers the other ones as an entry.
 */
export function useSessionRanHere(sessionId: string | null): boolean {
  const sim = useRuntimeInternals()?.sim ?? null;
  const liveMode = sim !== null && liveOf<MobileLiveSim>(sim) !== null;
  useSyncExternalStore(subscribeAttended, attendedSnapshot);
  if (sessionId === null) return false;
  return !liveMode || attendedSessions.has(sessionId);
}

export function SessionRouteSync(): null {
  const session = useActiveSession();
  const pathname = usePathname();
  const router = useRouter();
  const internals = useRuntimeInternals();
  const bus = internals?.resyncBus ?? null;
  const sim = internals?.sim ?? null;

  // Fix wave Q (CT-05): the sessions THIS device took part in, in this run of the app: it stood on a screen of the
  // session's flow while the session was the Core's current one (a session is set up, started and ended from those
  // screens; "Return to live session" and "View finalization" are the operator's own choice to follow one). In LIVE
  // mode a session that is not among them was run from another console: it never moves this operator - they are
  // told (`foreign-session-signal`). Without a Core link the device is the only console: every session is its own.
  const liveMode = sim !== null && liveOf<MobileLiveSim>(sim) !== null;
  const liveModeRef = useRef(liveMode);
  useEffect(() => {
    liveModeRef.current = liveMode;
  }, [liveMode]);
  // Declared before the transition effect below: an effect of the same commit that marks runs first.
  useEffect(() => {
    if (isSessionFlowPath(pathname, session.sessionId)) markSessionAttended(session.sessionId);
  }, [pathname, session.sessionId]);

  // The latest values for the bus callback, which outlives renders.
  const latest = useRef<{ session: ActiveSessionInfo; pathname: string }>({ session, pathname });
  useEffect(() => {
    latest.current = { session, pathname };
  }, [session, pathname]);

  const resync = useCallback(
    (trigger: ResyncTrigger, current: { session: ActiveSessionInfo; pathname: string }) => {
      const { session: s, pathname: path } = current;
      if (isSessionFlowPath(path, s.sessionId)) markSessionAttended(s.sessionId);
      if (liveModeRef.current && s.sessionId !== null && !attendedSessions.has(s.sessionId)) {
        // CT-05: another console's session. Nothing navigates; what happened is said once per phase.
        const phase = foreignSessionPhase(s.state);
        const wouldMove = resyncNavigation(path, s.state, {
          sessionId: s.sessionId,
          ...(s.summaryAcknowledged !== undefined ? { summaryAcknowledged: s.summaryAcknowledged } : {}),
        });
        if (phase !== null && wouldMove !== null && emitForeignSession({ sessionId: s.sessionId, phase })) {
          reportRuntimeIssue('info', `runtime.routeSync.${trigger}`, 'A session run from another console changed; this device was not moved', { state: s.state });
        }
        return;
      }
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
