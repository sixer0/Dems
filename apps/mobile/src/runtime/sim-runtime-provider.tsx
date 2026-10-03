/**
 * `SimRuntimeProvider` (04_mobile_specs §3.2 slot 9, §5.1, §5.2; replaces the step-68 stub).
 *
 * - Creates one mobile simulator per mount (`createMobileSim`: AsyncStorage snapshot, AppState
 *   visibility, memory-only operator record) or uses an injected one (tests), and runs it through
 *   the shared `SimProvider` (start after hydration, stop on unmount). Screens below can use the
 *   shared hooks directly: `useSim(selector)`, `useSimActions()`, `useAudioSharedValues(channel)`.
 * - Provides the runtime contract (`@/runtime`): `status.ready` is the hydration gate (snapshot and
 *   runtime prefs), so `BootGate` holds the splash until the saved session is back (§3.2);
 *   `session` is the active-session summary; `coreLink` is the Core link (§5.2, `core-link.ts`).
 *   The `auth` part is added one layer down by `AuthProvider` (slot 10, `src/auth`).
 * - In heartbeat mode it drives the simulator's tablet link from the heartbeat (MA-10).
 * - Holds the keep-awake tag for a running session whether or not anyone is signed in (§6.6).
 * - Computes the app-wide connection banner (`useConnectionBanner`).
 * - Debug builds: `&scenario=` deep links and the `__DEMS_DEBUG__` handle (`debug.ts`).
 * - Routes simulator error reports (`onError`) into the persistent runtime log.
 */
import { useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, useCallback, type ReactNode } from 'react';
import type { HeartbeatState } from '@dems/shared/domain';
import { HeartbeatContext } from '@dems/shared/realtime';
import {
  selectPendingSummaryId,
  SimProvider,
  useSim,
  type Sim,
  type SimErrorReport,
  type SimState,
} from '@dems/shared/sim';
import { bannerKindAfterResync, ConnectionBannerContext, connectionBannerFor, nextBannerKind, RESYNCED_BANNER_MS, type ConnectionBannerKind } from './connection-banner';
import {
  createRuntimeContract,
  RUNTIME_IMPLEMENTATION,
  RuntimeContractProvider,
  type ActiveSessionInfo,
  type CoreLinkInfo,
  type RuntimeStatus,
} from './contract';
import { coreLinkStateFor, hydrateCoreLinkSource, isCoreLinkSourceHydrated, tabletLinkForHeartbeat, useCoreLinkSource } from './core-link';
import { useDebugHandle, useDebugScenarioLinks, type RuntimeDebugSnapshot } from './debug';
import { RuntimeInternalsContext, type RuntimeInternals } from './internals';
import { KeepAwakeController } from './keep-awake';
import { reportRuntimeIssue } from './log';
import { createResyncBus, type ResyncBus } from './resync-bus';
import { createMobileSim, type MobileSimOptions } from './sim-adapters';

export interface SimRuntimeProviderProps {
  children?: ReactNode;
  /** An existing simulator (tests). Default: `createMobileSim(simOptions)` once per mount. */
  sim?: Sim;
  /** Options for the simulator this provider creates (ignored with `sim`). */
  simOptions?: MobileSimOptions;
  /** The heartbeat resync signal (`AppProviders` owns it); default: a private bus. */
  resyncBus?: ResyncBus;
}

/** Simulator error reports → the persistent runtime log (the simulator has no sink of its own). */
export function logSimError(report: SimErrorReport): void {
  reportRuntimeIssue(report.level, `sim.${report.source}`, Object.assign(new Error(report.message), report.stack ? { stack: report.stack } : {}), report.context);
}

/** The active-session summary the contract exposes (primitives only, so `useSim` compares it shallowly). */
export function selectActiveSessionInfo(s: SimState): Required<ActiveSessionInfo> {
  const session = s.session;
  const sessionId = session?.id ?? null;
  const pending = selectPendingSummaryId(s);
  return {
    state: session?.state ?? null,
    sessionId,
    startedAtMs: session?.startedAt ?? null,
    summaryAcknowledged: pending === null || pending !== sessionId,
  };
}

const selectTabletLink = (s: SimState) => s.tabletLink.state;

/** The heartbeat client state as a primitive (re-renders only when the state changes, not per beat). */
function useHeartbeatState(): HeartbeatState {
  const client = useContext(HeartbeatContext);
  const subscribe = useCallback((onChange: () => void) => (client ? client.subscribe(onChange) : () => undefined), [client]);
  const read = useCallback((): HeartbeatState => client?.getSnapshot().state ?? 'CONNECTING', [client]);
  return useSyncExternalStore(subscribe, read, read);
}

export function SimRuntimeProvider({ children, sim, simOptions, resyncBus }: SimRuntimeProviderProps) {
  const [owned] = useState<Sim | null>(() =>
    sim
      ? null
      : createMobileSim({
          ...simOptions,
          onError: (report) => {
            logSimError(report);
            simOptions?.onError?.(report);
          },
        }),
  );
  const instance = sim ?? (owned as Sim);
  const [ownBus] = useState(createResyncBus);
  const bus = resyncBus ?? ownBus;

  return (
    <SimProvider sim={instance} autoStart>
      <RuntimeBridge sim={instance} resyncBus={bus}>
        {children}
      </RuntimeBridge>
    </SimProvider>
  );
}

interface RuntimeBridgeProps {
  sim: Sim;
  resyncBus: ResyncBus;
  children?: ReactNode;
}

/**
 * The hydration gate (04 §5.2): the simulator snapshot and the Core link preference, awaited
 * together so a mount costs at most one React update (none when both are already in memory).
 */
function useRuntimeReady(sim: Sim): boolean {
  const [ready, setReady] = useState(() => sim.isReady() && isCoreLinkSourceHydrated());
  useEffect(() => {
    if (ready) return undefined;
    let active = true;
    Promise.all([sim.ready, hydrateCoreLinkSource()])
      .then(() => {
        if (active) setReady(true);
      })
      .catch((error: unknown) => reportRuntimeIssue('error', 'runtime.hydrate', error));
    return () => {
      active = false;
    };
  }, [sim, ready]);
  return ready;
}

function RuntimeBridge({ sim, resyncBus, children }: RuntimeBridgeProps) {
  const ready = useRuntimeReady(sim);
  const source = useCoreLinkSource();
  const session = useSim(selectActiveSessionInfo);
  const tabletLink = useSim(selectTabletLink);
  const heartbeat = useHeartbeatState();

  useTabletLinkFromHeartbeat(sim, ready, source, heartbeat);
  useDebugScenarioLinks(sim);
  const debugSnapshot = useRef<RuntimeDebugSnapshot | null>(null);
  useDebugHandle(sim, debugSnapshot);

  useEffect(() => {
    if (!ready) return;
    reportRuntimeIssue('info', 'runtime.sim.hydrated', 'Simulator ready', {
      restored: sim.wasRestored(),
      state: sim.store.getState().session?.state ?? null,
    });
  }, [sim, ready]);

  const coreLink = useMemo<CoreLinkInfo>(
    () => ({
      source,
      state: coreLinkStateFor(source, heartbeat, tabletLink),
      ...(source === 'HEARTBEAT' ? { heartbeat } : {}),
    }),
    [source, heartbeat, tabletLink],
  );
  const status = useMemo<RuntimeStatus>(
    () => ({ ready, implementation: RUNTIME_IMPLEMENTATION, restored: ready && sim.wasRestored() }),
    [ready, sim],
  );
  const contract = useMemo(() => createRuntimeContract({ status, coreLink, session }), [status, coreLink, session]);
  const internals = useMemo<RuntimeInternals>(() => ({ sim, resyncBus }), [sim, resyncBus]);
  const banner = useConnectionBannerState(coreLink, resyncBus);
  useEffect(() => {
    debugSnapshot.current = { status, coreLink, banner: banner.kind };
  }, [status, coreLink, banner]);

  return (
    <RuntimeInternalsContext.Provider value={internals}>
      <RuntimeContractProvider value={contract}>
        <ConnectionBannerContext.Provider value={banner}>
          <KeepAwakeController />
          {children}
        </ConnectionBannerContext.Provider>
      </RuntimeContractProvider>
    </RuntimeInternalsContext.Provider>
  );
}

/**
 * Heartbeat mode: the simulator's tablet link follows the heartbeat (LIVE → CONNECTED, STALE or
 * OFFLINE → OFFLINE; CONNECTING leaves it). Leaving heartbeat mode reconnects the simulated link.
 * Writes happen after hydration only, and only on a real change (each change is one audit row).
 */
function useTabletLinkFromHeartbeat(sim: Sim, ready: boolean, source: CoreLinkInfo['source'], heartbeat: HeartbeatState) {
  const previousSource = useRef(source);
  useEffect(() => {
    if (!ready) return;
    const leftHeartbeat = previousSource.current === 'HEARTBEAT' && source !== 'HEARTBEAT';
    previousSource.current = source;
    const next = source === 'HEARTBEAT' ? tabletLinkForHeartbeat(heartbeat) : leftHeartbeat ? 'CONNECTED' : null;
    if (next === null || sim.store.getState().tabletLink.state === next) return;
    try {
      sim.actions.setTabletLink(next);
      reportRuntimeIssue(next === 'OFFLINE' ? 'warn' : 'info', 'runtime.coreLink.tabletLink', `Tablet link ${next}`, { source, heartbeat });
    } catch (error) {
      reportRuntimeIssue('error', 'runtime.coreLink.tabletLink', error, { source, heartbeat, next });
    }
  }, [sim, ready, source, heartbeat]);
}

function useConnectionBannerState(link: CoreLinkInfo, bus: ResyncBus) {
  const [kind, setKind] = useState<ConnectionBannerKind>(() => nextBannerKind('hidden', link));
  // A new Core link value updates the banner in the same render ("adjusting state when a prop
  // changes"), so no effect and no extra commit is needed.
  const [seenLink, setSeenLink] = useState(link);
  if (seenLink !== link) {
    setSeenLink(link);
    setKind(nextBannerKind(kind, link));
  }
  useEffect(() => bus.subscribe(() => setKind(bannerKindAfterResync)), [bus]);
  useEffect(() => {
    if (kind !== 'resynced') return undefined;
    const timer = setTimeout(() => setKind((current) => (current === 'resynced' ? 'hidden' : current)), RESYNCED_BANNER_MS);
    return () => clearTimeout(timer);
  }, [kind]);
  return useMemo(() => connectionBannerFor(kind), [kind]);
}
