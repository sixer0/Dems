/**
 * Debug-build hooks of the runtime (never active in a release build: all are gated on `__DEV__`).
 *
 * 1. `&scenario=<name>` deep links (04_mobile_specs §3.5: "Any guarded URL + &scenario=recording —
 *    loads the simulator scenario first (debug builds only; used by the screenshot ACs)"). The
 *    navigation shell parses and ignores the param (step 70, `scenarioSchema`); the runtime loads the
 *    scenario. Only the four simulator scenario names are accepted; anything else is ignored. The
 *    scenario loads after hydration (a restored snapshot would otherwise replace it) and keeps the
 *    signed-in operator (13_sim_engine §2.2 `loadScenario`).
 * 2. `globalThis.__DEMS_DEBUG__ = { sim, sha256Hex, log, runtime(), setCoreLinkSource() }` for
 *    on-device checks through the Hermes inspector (MA-08 / MA-10 / MA-19 evidence before the
 *    Login, Monitor and Settings screens exist; the D54 (d) SHA-256 proof). It holds no
 *    credentials; a debug build already exposes the whole JS runtime to its debugger.
 * 3. `?probe=<name>&run=<id>` deep links (backend task plan W12): runs one device probe of
 *    `./dev-probes.ts` and writes its result lines to the device log. The probe module is loaded
 *    only inside an `if (__DEV__)` block, so a release bundle holds neither the call nor the module.
 * 4. `core=LIVE|SIMULATED|HEARTBEAT` deep links (backend task W51; 04_client_integration_spec MD-7):
 *    sets the Core link source through `setCoreLinkSource`, so a device check needs no taps through
 *    Settings. The choice is stored like the Settings choice (`dems.mobile.prefs.v1`); a launch with
 *    `core=SIMULATED` puts the default back. At a cold start the launch URL's value is applied
 *    BEFORE the runtime builds its data source (`applyLaunchCoreSource`), so a launch with
 *    `core=LIVE` never starts the simulator. In LIVE mode `scenario=` is ignored and logged: it
 *    would call a demo control of the Core server that nobody asked for. Under a literal `__DEV__`
 *    test: in a release build the parameter does nothing.
 */
import { useEffect, type RefObject } from 'react';
import { Linking } from 'react-native';
import { liveOf } from '@dems/shared/live';
import { ScenarioName, sha256Hex, type Sim } from '@dems/shared/sim';
import type { ConnectionBannerKind } from './connection-banner';
import type { CoreLinkInfo, CoreLinkSource, RuntimeStatus } from './contract';
import { CORE_LINK_SOURCES, getCoreLinkSource, setCoreLinkSource } from './core-link';
import { reportRuntimeIssue, runtimeLog, type RuntimeLog } from './log';

const SCENARIOS: ReadonlySet<string> = new Set(Object.values(ScenarioName));

/** The simulator scenario named by a URL's `scenario` query param, or `null` (pure). */
export function scenarioFromUrl(url: string | null | undefined): ScenarioName | null {
  if (typeof url !== 'string' || url.length === 0 || url.length > 512) return null;
  const match = /[?&]scenario=([^&#]*)/.exec(url);
  if (!match) return null;
  let value: string;
  try {
    value = decodeURIComponent(match[1]!).trim();
  } catch {
    return null;
  }
  return SCENARIOS.has(value) ? (value as ScenarioName) : null;
}

/**
 * The Core link source named by a URL's `core` query param, or `null` (pure; MD-7). Only the three
 * source names, exactly as written, are accepted; anything else is ignored.
 */
export function coreSourceFromUrl(url: string | null | undefined): CoreLinkSource | null {
  if (typeof url !== 'string' || url.length === 0 || url.length > 512) return null;
  const match = /[?&]core=([^&#]*)/.exec(url);
  if (!match) return null;
  let value: string;
  try {
    value = decodeURIComponent(match[1]!).trim();
  } catch {
    return null;
  }
  return CORE_LINK_SOURCES.find((source) => source === value) ?? null;
}

/**
 * MD-7: sets the Core link source a URL names. Debug builds only: the literal `__DEV__` test makes
 * Metro drop the block from a release bundle, where the parameter does nothing. A value that is
 * already the source changes and stores nothing.
 */
function applyCoreSourceFromUrl(url: string | null | undefined, origin: 'launch' | 'link'): void {
  if (__DEV__) {
    const source = coreSourceFromUrl(url);
    if (source === null || source === getCoreLinkSource()) return;
    setCoreLinkSource(source);
    reportRuntimeIssue('info', 'runtime.debug.core', 'Core link source set from a deep link', { source, origin });
  }
}

let launchCoreSource: Promise<void> | null = null;

/**
 * Applies the `core=` parameter of the LAUNCH URL, once per process (MD-7). The runtime waits for
 * it before it builds its data source, so the source a device check asks for is the first one
 * built. Resolves at once in a release build, and never rejects.
 */
export function applyLaunchCoreSource(enabled: boolean = __DEV__): Promise<void> {
  if (!enabled) return Promise.resolve();
  launchCoreSource ??= Promise.resolve()
    .then(() => Linking.getInitialURL())
    .then((url) => applyCoreSourceFromUrl(url, 'launch'))
    .catch((error: unknown) => reportRuntimeIssue('warn', 'runtime.debug.initialUrl', error));
  return launchCoreSource;
}

/** Test hook: the next `applyLaunchCoreSource()` reads the launch URL again. */
export function resetDebugLaunchForTests(): void {
  launchCoreSource = null;
}

/** A device probe requested by a URL: `?probe=<name>` and, optionally, `&run=<id>`. */
interface DevProbeRequest {
  readonly name: string;
  readonly run: string;
}

/**
 * The device probe named by a URL's `probe` query param, or `null` (pure). Not exported: its only
 * caller is the `__DEV__` block below, so a release bundle drops it too.
 */
function devProbeFromUrl(url: string | null | undefined): DevProbeRequest | null {
  if (typeof url !== 'string' || url.length === 0 || url.length > 512) return null;
  const name = /[?&]probe=([a-z][a-z0-9-]{0,31})(?:[&#]|$)/.exec(url)?.[1];
  if (!name) return null;
  const run = /[?&]run=([A-Za-z0-9]{1,16})(?:[&#]|$)/.exec(url)?.[1] ?? '0';
  return { name, run };
}

/**
 * The one hook of `./dev-probes.ts` (backend task plan W12). Debug builds only: the literal
 * `__DEV__` test makes Metro drop this block, and with it the probe module, from a release bundle.
 */
function runDevProbeFromUrl(url: string | null | undefined): void {
  if (__DEV__) {
    const request = devProbeFromUrl(url);
    if (request === null) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay inside the __DEV__ block
      const probes = require('./dev-probes') as typeof import('./dev-probes');
      void probes.runDevProbe(request.name, request.run);
    } catch (error) {
      reportRuntimeIssue('error', 'runtime.debug.probe', error, { probe: request.name, run: request.run });
    }
  }
}

/** Initial URLs already applied, per simulator (StrictMode runs effects twice in development). */
const initialApplied = new WeakSet<Sim>();

/**
 * Loads `&scenario=` from the launch URL and from later deep links, and applies `core=` (debug
 * builds only). `sim` is the source of `SimContext`: the simulator, or the Live source.
 */
export function useDebugScenarioLinks(sim: Sim, enabled: boolean = __DEV__): void {
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    const load = (url: string | null | undefined, origin: 'launch' | 'link') => {
      runDevProbeFromUrl(url);
      // The launch URL's `core=` is applied once per process (the runtime has usually done it
      // before its first source was built); a later deep link is applied when it arrives.
      if (origin === 'launch') void applyLaunchCoreSource(enabled);
      else applyCoreSourceFromUrl(url, origin);
      const scenario = scenarioFromUrl(url);
      if (scenario === null) return;
      // MD-7: never a scenario in LIVE mode. It is a demo control of the Core server.
      if (liveOf(sim) !== null || coreSourceFromUrl(url) === 'LIVE') {
        reportRuntimeIssue('info', 'runtime.debug.scenario', 'Scenario ignored: the Core link source is LIVE', { scenario, origin });
        return;
      }
      void sim.ready.then(() => {
        if (!active) return;
        try {
          sim.actions.loadScenario(scenario);
          reportRuntimeIssue('info', 'runtime.debug.scenario', 'Scenario loaded from a deep link', { scenario, origin });
        } catch (error) {
          reportRuntimeIssue('error', 'runtime.debug.scenario', error, { scenario, origin });
        }
      });
    };

    if (!initialApplied.has(sim)) {
      initialApplied.add(sim);
      Linking.getInitialURL()
        .then((url) => load(url, 'launch'))
        .catch((error: unknown) => reportRuntimeIssue('warn', 'runtime.debug.initialUrl', error));
    }
    let subscription: { remove(): void } | null = null;
    try {
      subscription = Linking.addEventListener('url', ({ url }) => load(url, 'link'));
    } catch (error) {
      reportRuntimeIssue('warn', 'runtime.debug.linkListener', error);
    }
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [sim, enabled]);
}

/** What the runtime shows the app, as of its last render (read on a device through the handle). */
export interface RuntimeDebugSnapshot {
  readonly status: RuntimeStatus;
  readonly coreLink: CoreLinkInfo;
  readonly banner: ConnectionBannerKind;
}

export interface DemsDebugHandle {
  readonly sim: Sim;
  readonly sha256Hex: (text: string) => string;
  /** The persistent runtime log (read its records on a device). */
  readonly log: RuntimeLog;
  /** The runtime's last rendered status, Core link and banner. */
  runtime(): RuntimeDebugSnapshot | null;
  /** The Settings "Core link source" switch, for device checks before the Settings screen exists (MA-10). */
  setCoreLinkSource(source: CoreLinkSource): void;
}

type DebugGlobal = typeof globalThis & { __DEMS_DEBUG__?: DemsDebugHandle };

/** Publishes the debug handle while mounted (debug builds only). */
export function useDebugHandle(
  sim: Sim,
  snapshot?: RefObject<RuntimeDebugSnapshot | null>,
  enabled: boolean = __DEV__,
): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const g = globalThis as DebugGlobal;
    const handle: DemsDebugHandle = {
      sim,
      sha256Hex,
      log: runtimeLog,
      runtime: () => snapshot?.current ?? null,
      setCoreLinkSource,
    };
    g.__DEMS_DEBUG__ = handle;
    return () => {
      if (g.__DEMS_DEBUG__ === handle) delete g.__DEMS_DEBUG__;
    };
  }, [sim, snapshot, enabled]);
}
