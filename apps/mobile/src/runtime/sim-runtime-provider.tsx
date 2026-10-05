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
 *
 * **Three Core link sources** (backend task W51; 04_client_integration_spec §3.1, MD-3, MD-5, §7.2,
 * §9.5). SIMULATED and HEARTBEAT run the simulator, as above. LIVE runs the app's Live source
 * (`createMobileLive`, `sim-adapters.ts`): the replica of the Core server's state, in the same
 * `SimContext`, so every `useSim` selector reads it unchanged.
 *
 * | | SIMULATED, HEARTBEAT | LIVE (debug builds only) |
 * |---|---|---|
 * | Data source | The simulator | The Live source; the simulator is not created, its snapshot is neither read nor written (MD-5) |
 * | `HeartbeatContext` below this provider | The mock-core client of `HeartbeatProvider` | The heartbeat view of the Live source's one socket; the mock-core client is stopped, and started again on leaving LIVE |
 * | `coreLink` | As before | `source: 'LIVE'`, the state of that heartbeat (LIVE → ONLINE) |
 * | `status.ready` | Snapshot and prefs hydrated | The stored device credential was read (MP-10 step 1) |
 * | `pairing` (MP-9) | Absent | `required: true`; CHECKING, then UNPAIRED or PAIRED |
 * | Tablet link bridge (S4-7) | HEARTBEAT only | Inactive: the server sets the link from real connections |
 * | Resync signal | `HeartbeatProvider`'s `onResync` | The Live socket's RESYNCED event |
 *
 * Exactly one data source exists per runtime mount (MD-5). Which one is decided by the stored
 * Core link source and, in a debug build, the launch URL's `core=` parameter (MD-7). Changing
 * across the LIVE boundary unmounts one source and mounts the other; SIMULATED ↔ HEARTBEAT keeps
 * the simulator, as before. A release build never builds a Live source: LIVE is not available
 * there, and `createMobileLive` is `() => null` in its bundle (MD-6).
 */
import { useToast } from 'heroui-native';
import { useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { HeartbeatState } from '@dems/shared/domain';
import { liveOf } from '@dems/shared/live';
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
  type CoreLinkSource,
  type PairingInfo,
  type RuntimeStatus,
} from './contract';
import {
  coreLinkStateFor,
  DEFAULT_CORE_LINK_SOURCE,
  effectiveCoreLinkSource,
  getCoreLinkSource,
  hydrateCoreLinkSource,
  isCoreLinkSourceAvailable,
  isCoreLinkSourceHydrated,
  tabletLinkForHeartbeat,
  useCoreLinkSource,
} from './core-link';
import { applyLaunchCoreSource, useDebugHandle, useDebugScenarioLinks, type RuntimeDebugSnapshot } from './debug';
import { RuntimeInternalsContext, useRuntimeInternals, type RuntimeInternals } from './internals';
import { KeepAwakeController } from './keep-awake';
import { reportRuntimeIssue } from './log';
import { createResyncBus, type ResyncBus } from './resync-bus';
import { createMobileLive, createMobileSim, mobileLiveOf, type MobileLive, type MobileLiveSim, type MobileSimOptions } from './sim-adapters';

export interface SimRuntimeProviderProps {
  children?: ReactNode;
  /**
   * An existing data source (tests): a simulator, or the app's Live source
   * (`createMobileLive(options).sim`). It is used as it is, whatever the Core link preference
   * says; its kind decides the data mode. Default: built from the Core link source.
   */
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

/**
 * The Core link source of a runtime that holds a SIMULATOR. A LIVE preference cannot apply to it
 * (an injected simulator, or a build without a Live source): the link then reads as the default.
 */
export function simulatorLinkSource(preferred: CoreLinkSource): CoreLinkSource {
  return preferred === 'LIVE' ? DEFAULT_CORE_LINK_SOURCE : preferred;
}

/**
 * MD-5, MD-7: the Core link source this process starts with. The stored preference, then, in a
 * debug build, the launch URL's `core=` parameter. Never rejects.
 */
export function decideCoreLinkSource(): Promise<CoreLinkSource> {
  return hydrateCoreLinkSource()
    .then(() => applyLaunchCoreSource())
    .then(getCoreLinkSource, getCoreLinkSource);
}

/**
 * MD-5: may the simulator this provider creates read its stored snapshot? In a release build
 * always, and at once (`undefined`: no wait, as before): LIVE cannot be the source there. In a
 * debug build only once the source is decided and is not LIVE; with LIVE the simulator object of
 * the first frame is dropped without having read or written anything.
 */
function snapshotAllowed(): Promise<boolean> | undefined {
  if (!isCoreLinkSourceAvailable('LIVE')) return undefined;
  return decideCoreLinkSource().then((source) => source !== 'LIVE');
}

export function SimRuntimeProvider({ children, sim, simOptions, resyncBus }: SimRuntimeProviderProps) {
  const preferred = useCoreLinkSource();
  const [ownBus] = useState(createResyncBus);
  const bus = resyncBus ?? ownBus;

  // The Live source this provider owns: one per stay in LIVE mode, created when the preference
  // turns LIVE and dropped when it leaves ("adjusting state when a prop changes": no effect, no
  // extra commit). Creating it sends nothing and reads nothing; `LiveRuntime` starts it.
  const wantsLive = sim === undefined && effectiveCoreLinkSource(preferred) === 'LIVE';
  const [owned, setOwned] = useState<{ readonly mobile: MobileLive | null } | null>(null);
  if (wantsLive && owned === null) setOwned({ mobile: createMobileLive() });
  if (!wantsLive && owned !== null) setOwned(null);

  if (sim !== undefined && liveOf(sim) !== null && mobileLiveOf(sim) === null) {
    // A programming error of a test: the runtime needs the adapters (the credential memory, the
    // pairing gate), which only `createMobileLive` builds.
    throw new Error('SimRuntimeProvider: inject `createMobileLive(options).sim`, not a Live source built without the mobile adapters.');
  }
  const mobile = sim !== undefined ? mobileLiveOf(sim) : (owned?.mobile ?? null);
  useOuterHeartbeatPaused(mobile !== null);

  // MD-6: LIVE was asked for and this build holds no Live source. The simulator runs instead.
  const liveUnavailable = wantsLive && owned !== null && owned.mobile === null;
  useEffect(() => {
    if (liveUnavailable) {
      reportRuntimeIssue('warn', 'runtime.live.unavailable', 'The Core link source LIVE is not available in this build; the simulator is used');
    }
  }, [liveUnavailable]);

  if (mobile !== null) {
    return (
      <LiveRuntime key={liveKeyOf(mobile)} mobile={mobile} resyncBus={bus}>
        {children}
      </LiveRuntime>
    );
  }
  return sim !== undefined ? (
    <SimulatorRuntime key="simulator" sim={sim} resyncBus={bus}>
      {children}
    </SimulatorRuntime>
  ) : (
    // The fallback gets a simulator of its own, which reads its snapshot at once: the one of the
    // first frame was told to wait for a source that then turned out to be LIVE.
    <OwnedSimulatorRuntime key={liveUnavailable ? 'simulator-fallback' : 'simulator'} gated={!liveUnavailable} simOptions={simOptions} resyncBus={bus}>
      {children}
    </OwnedSimulatorRuntime>
  );
}

const liveKeys = new WeakMap<MobileLive, string>();
let liveKeySeq = 0;
/** One React key per Live source, so a new source never inherits the state of the one before it. */
function liveKeyOf(mobile: MobileLive): string {
  let key = liveKeys.get(mobile);
  if (key === undefined) {
    liveKeySeq += 1;
    key = `live-${liveKeySeq}`;
    liveKeys.set(mobile, key);
  }
  return key;
}

/**
 * LIVE mode has ONE socket, the Live source's (CL-7): the mock-core heartbeat client that
 * `HeartbeatProvider` runs above this provider is stopped while a Live source is mounted and
 * started again on leaving LIVE. `start` and `stop` of that client are idempotent. On unmount
 * nothing is started: `HeartbeatProvider` stops its own client.
 */
function useOuterHeartbeatPaused(paused: boolean): void {
  const outer = useContext(HeartbeatContext);
  const stoppedHere = useRef(false);
  useEffect(() => {
    if (!outer) return undefined;
    if (paused) {
      stoppedHere.current = true;
      outer.stop();
      // When both mount in one commit, `HeartbeatProvider` starts its client in its own effect,
      // which runs after this one: stop it once more when that commit's effects are over.
      let current = true;
      void Promise.resolve().then(() => {
        if (current) outer.stop();
      });
      return () => {
        current = false;
      };
    }
    if (stoppedHere.current) {
      stoppedHere.current = false;
      outer.start();
    }
    return undefined;
  }, [outer, paused]);
}

interface RuntimeProps {
  resyncBus: ResyncBus;
  children?: ReactNode;
}

/**
 * The simulator this provider creates: one per stay outside LIVE mode. `gated`: its snapshot
 * storage waits for the source decision (`snapshotAllowed`).
 */
function OwnedSimulatorRuntime({ simOptions, gated, resyncBus, children }: RuntimeProps & { simOptions: MobileSimOptions | undefined; gated: boolean }) {
  const [owned] = useState<Sim>(() => {
    const allowed = gated ? snapshotAllowed() : undefined;
    return createMobileSim({
      ...simOptions,
      ...(allowed ? { storageAllowed: allowed } : {}),
      onError: (report) => {
        logSimError(report);
        simOptions?.onError?.(report);
      },
    });
  });
  return (
    <SimulatorRuntime sim={owned} resyncBus={resyncBus}>
      {children}
    </SimulatorRuntime>
  );
}

function SimulatorRuntime({ sim, resyncBus, children }: RuntimeProps & { sim: Sim }) {
  return (
    <SimProvider sim={sim} autoStart>
      <RuntimeBridge sim={sim} resyncBus={resyncBus}>
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
  const source = simulatorLinkSource(useCoreLinkSource());
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

// ---------------------------------------------------------------------------------------------
// LIVE mode
// ---------------------------------------------------------------------------------------------

/**
 * The Live source as the data source of the app (MD-5). The source is started here, not by
 * `SimProvider`: `start()` first reads the stored device credential, once, so the first socket
 * already carries it (MP-10; the Live source's brief list, row 8). `SimProvider` only provides it.
 */
function LiveRuntime({ mobile, resyncBus, children }: RuntimeProps & { mobile: MobileLive }) {
  useEffect(() => {
    void mobile.start();
    return () => mobile.stop();
  }, [mobile]);

  return (
    <HeartbeatContext.Provider value={mobile.live.heartbeat}>
      <SimProvider sim={mobile.sim} autoStart={false}>
        <LiveBridge mobile={mobile} resyncBus={resyncBus}>
          {children}
        </LiveBridge>
      </SimProvider>
    </HeartbeatContext.Provider>
  );
}

/** MP-10: the runtime is ready when the pairing state at start is known. It does not wait for the Core server. */
function useLiveReady(mobile: MobileLive): boolean {
  const [ready, setReady] = useState(() => mobile.isReady() && isCoreLinkSourceHydrated());
  useEffect(() => {
    if (ready) return undefined;
    let active = true;
    Promise.all([mobile.ready, hydrateCoreLinkSource()])
      .then(() => {
        if (active) setReady(true);
      })
      .catch((error: unknown) => reportRuntimeIssue('error', 'runtime.live.ready', error));
    return () => {
      active = false;
    };
  }, [mobile, ready]);
  return ready;
}

function LiveBridge({ mobile, resyncBus, children }: RuntimeProps & { mobile: MobileLive }) {
  const { live, sim } = mobile;
  const ready = useLiveReady(mobile);
  const session = useSim(selectActiveSessionInfo);
  const tabletLink = useSim(selectTabletLink);
  // The context above holds the Live source's heartbeat view: the one socket (CL-7).
  const heartbeat = useHeartbeatState();
  const pairing = useSyncExternalStore<PairingInfo>(mobile.subscribe, mobile.getPairing, mobile.getPairing);

  useDebugScenarioLinks(sim);
  const debugSnapshot = useRef<RuntimeDebugSnapshot | null>(null);
  useDebugHandle(sim, debugSnapshot);

  useEffect(() => {
    if (!ready) return;
    reportRuntimeIssue('info', 'runtime.live.ready', 'Live source ready', { pairing: mobile.getPairing().state });
  }, [mobile, ready]);

  // §3.5 "link back": the existing "Resynced" banner and the existing route resync, on the bus.
  useEffect(
    () =>
      live.onResync((event) => {
        if (event.phase === 'RESYNCED') resyncBus.emit();
      }),
    [live, resyncBus],
  );

  const coreLink = useMemo<CoreLinkInfo>(() => ({ source: 'LIVE', state: coreLinkStateFor('LIVE', heartbeat, tabletLink), heartbeat }), [heartbeat, tabletLink]);
  const status = useMemo<RuntimeStatus>(() => ({ ready, implementation: 'live', restored: false }), [ready]);
  const contract = useMemo(() => createRuntimeContract({ status, coreLink, session, pairing }), [status, coreLink, session, pairing]);
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
          <RoleChangeNotice live={live} />
          {children}
        </ConnectionBannerContext.Provider>
      </RuntimeContractProvider>
    </RuntimeInternalsContext.Provider>
  );
}

/**
 * §6.3: one notice when the Core changed the signed-in operator's role (`session.updated`). The
 * gated controls change by themselves: they read the role from the replicated `operators` slice,
 * which the same change replaces. Nobody is signed out and nothing is reloaded (AC-C-49).
 */
function RoleChangeNotice({ live }: { live: MobileLiveSim }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  useEffect(
    () =>
      live.onControl((message) => {
        if (message.type !== 'session.updated') return;
        try {
          toast.show({ variant: 'default', label: t('mobile.live.roleChanged', { role: t(`common.roles.${message.operator.role}`) }) });
        } catch (error) {
          reportRuntimeIssue('error', 'runtime.live.roleNotice', error);
        }
      }),
    [live, t, toast],
  );
  return null;
}

/**
 * The app's Live source, or `null`: SIMULATED or HEARTBEAT mode, or outside the runtime provider.
 * A screen calls an operation that is no simulator action through it and through nothing else:
 * `useMobileLive()?.client.call(operationId, input)`.
 */
export function useMobileLive(): MobileLiveSim | null {
  const sim = useRuntimeInternals()?.sim;
  return sim ? liveOf<MobileLiveSim>(sim) : null;
}

/** The Live source with its adapters (`start`, the pairing gate, the biometric port), or `null` as above. */
export function useMobileLiveRuntime(): MobileLive | null {
  const sim = useRuntimeInternals()?.sim;
  return sim ? mobileLiveOf(sim) : null;
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

/**
 * The banner kind, written ONLY while rendering, from the kind of that render (decision D170, finding
 * F-1 of row W68). The link arrives through `useSyncExternalStore` (a sync update) while the resync
 * signal comes from a socket callback (a default-lane update). A functional updater of `kind` queued
 * by the signal and skipped by the render that applied the link change was later rebased over that
 * render-phase update and undid it: "Resynced", then "offline" again with the link ONLINE. So the bus
 * and the timer only count their signals, each in a state of its own, and the render folds every input
 * that changed into `kind` in one step: the link (`nextBannerKind`), a resync (`bannerKindAfterResync`),
 * the end of "Resynced" (hidden). No effect and no extra commit for a link change, as before.
 */
export function useConnectionBannerState(link: CoreLinkInfo, bus: ResyncBus) {
  const [kind, setKind] = useState<ConnectionBannerKind>(() => nextBannerKind('hidden', link));
  const [resyncs, setResyncs] = useState(0);
  const [expiries, setExpiries] = useState(0);
  const [seen, setSeen] = useState({ link, resyncs, expiries });
  if (seen.link !== link || seen.resyncs !== resyncs || seen.expiries !== expiries) {
    let next = kind;
    if (seen.link !== link) next = nextBannerKind(next, link);
    if (seen.resyncs !== resyncs) next = bannerKindAfterResync(next);
    if (seen.expiries !== expiries && next === 'resynced') next = 'hidden';
    setSeen({ link, resyncs, expiries });
    if (next !== kind) setKind(next);
  }
  useEffect(() => bus.subscribe(() => setResyncs((count) => count + 1)), [bus]);
  useEffect(() => {
    if (kind !== 'resynced') return undefined;
    const timer = setTimeout(() => setExpiries((count) => count + 1), RESYNCED_BANNER_MS);
    return () => clearTimeout(timer);
  }, [kind]);
  return useMemo(() => connectionBannerFor(kind), [kind]);
}
