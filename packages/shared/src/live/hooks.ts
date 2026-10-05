/**
 * React bindings of the light Live API (backend task 04_client_integration_spec §2.3 CL-12,
 * CL-15; §12.1 TS-2, TS-3). The only file of this folder that imports React.
 *
 * Every hook reads the source held in the simulator's own `SimContext` (`../sim/react`), where
 * a Live source is placed as well. So each hook works under the existing `SimProvider`, in both
 * modes, and no second provider exists.
 *
 * - `useCoreActions()`: the actions object, typed for both modes. For a simulator it is
 *   `sim.actions` itself (the object `useSimActions()` returns): no wrapper, no promise.
 * - `useCoreMode()`: SIMULATED or LIVE, derived from the source (TS-3).
 * - `useLive()`: the Live source, or `null` in Simulated mode.
 * - `useLiveLink()`: the Live link state, or `null` in Simulated mode; follows every change.
 * - `useCorePermission(permission)`: the server's permission hint; follows `session.updated`.
 * - `useLiveSelector(read)`: any other value of the Live source (its session, why the last session
 *   ended, the last audit chain check); follows every change the source reports.
 */
import { useCallback, useSyncExternalStore } from 'react';
import type { Sim } from '../sim/engine';
import { useSimInstance } from '../sim/react';
import type { Permission } from '../sim/vocabulary';
import { coreActionsOf, type CoreActions } from './core-actions';
import {
  coreModeOf,
  corePermissionOf,
  liveLinkOf,
  liveOf,
  type CoreMode,
  type LiveHandle,
  type LiveLinkState,
} from './mode';

/** A simulator never changes its Live values: nothing to subscribe to. */
const NOT_SUBSCRIBED = (): void => undefined;

/** Reads a value of the source and renders again when the Live source reports a change. */
function useLiveValue<T>(read: (sim: Sim) => T): T {
  const sim = useSimInstance();
  const subscribe = useCallback(
    (listener: () => void) => liveOf(sim)?.onLiveChange(listener) ?? NOT_SUBSCRIBED,
    [sim],
  );
  const snapshot = (): T => read(sim);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** The stable actions object of the nearest `SimProvider`, typed for both modes (CL-12). */
export function useCoreActions(): CoreActions {
  return coreActionsOf(useSimInstance());
}

/** SIMULATED with a simulator in the context, LIVE with a Live source (TS-3). */
export function useCoreMode(): CoreMode {
  return coreModeOf(useSimInstance());
}

/** The Live source, or `null` in Simulated mode. For the type argument see `liveOf`. */
export function useLive<Handle extends LiveHandle = LiveHandle>(): Handle | null {
  return liveOf<Handle>(useSimInstance());
}

/** The Live link state, or `null` in Simulated mode. */
export function useLiveLink(): LiveLinkState | null {
  return useLiveValue(liveLinkOf);
}

/** Whether the server's effective permission list holds `permission`; false in Simulated mode (§6.1). */
export function useCorePermission(permission: Permission): boolean {
  return useLiveValue((sim) => corePermissionOf(sim, permission));
}

/**
 * A value read from the Live source; the component renders again when the source reports a change
 * (`onLiveChange`: the link, the session, the end of a session, the audit chain check). `read`
 * gets `null` in Simulated mode. For a member beyond `LiveHandle`, name the Live source as the
 * parameter's type, with a type-only import, as for `liveOf`:
 *
 * ```ts
 * const end = useLiveSelector((live: LiveSim | null) => live?.lastSessionEnd ?? null);
 * ```
 *
 * `read` must return the same reference while nothing changed (a member of the source, or a
 * primitive): the Live source replaces an object on every change and never edits it in place, so
 * a member read as it is satisfies that. A new object built on every call would render for ever.
 */
export function useLiveSelector<T, Handle extends LiveHandle = LiveHandle>(read: (live: Handle | null) => T): T {
  return useLiveValue((sim) => read(liveOf<Handle>(sim)));
}
