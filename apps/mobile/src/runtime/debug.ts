/**
 * Debug-build hooks of the runtime (never active in a release build: both are gated on `__DEV__`).
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
 */
import { useEffect, type RefObject } from 'react';
import { Linking } from 'react-native';
import { ScenarioName, sha256Hex, type Sim } from '@dems/shared/sim';
import type { ConnectionBannerKind } from './connection-banner';
import type { CoreLinkInfo, CoreLinkSource, RuntimeStatus } from './contract';
import { setCoreLinkSource } from './core-link';
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

/** Initial URLs already applied, per simulator (StrictMode runs effects twice in development). */
const initialApplied = new WeakSet<Sim>();

/** Loads `&scenario=` from the launch URL and from later deep links (debug builds only). */
export function useDebugScenarioLinks(sim: Sim, enabled: boolean = __DEV__): void {
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    const load = (url: string | null | undefined, origin: 'launch' | 'link') => {
      const scenario = scenarioFromUrl(url);
      if (scenario === null) return;
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
