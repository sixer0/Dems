/**
 * Data mode of a client, and the light view of a Live source (backend task
 * 04_client_integration_spec §3.1, §2.3 CL-15, §12.1 TS-3).
 *
 * There are two data modes: SIMULATED (the in-app simulator is the Core) and LIVE (the Core
 * server is the Core). The mode of a running client is NOT a setting that is read here: it is
 * derived from the object held in `SimContext` (TS-3). A simulator means SIMULATED; a Live
 * source carries the marker `coreMode: 'LIVE'`. So no test and no screen has to provide a mode.
 *
 * Which source a client builds is decided once by that client (web: MD-2, mobile: MD-3), from
 * its own build flags and its own stored choice. This file holds only the pure parts of that
 * decision: the values, the default and the parser of a stored value. It reads no storage and
 * no build flag.
 *
 * Framework-free: type-only imports, no runtime dependency.
 */
import type { Sim } from '../sim/engine';
import type { Permission } from '../sim/vocabulary';

/** The two data modes (§3.1). The mobile link source HEARTBEAT is SIMULATED data, not a third mode. */
export const CoreMode = {
  SIMULATED: 'SIMULATED',
  LIVE: 'LIVE',
} as const;
export type CoreMode = (typeof CoreMode)[keyof typeof CoreMode];

export const CORE_MODES: readonly CoreMode[] = [CoreMode.SIMULATED, CoreMode.LIVE];

/** Every build starts SIMULATED unless a dev build chose LIVE (§3.1, MD-2 rule 4). */
export const DEFAULT_CORE_MODE: CoreMode = CoreMode.SIMULATED;

/** A stored mode value: exactly `SIMULATED` or `LIVE`. Any other value counts as absent (MD-2). */
export function parseCoreMode(value: unknown): CoreMode | null {
  return value === CoreMode.SIMULATED || value === CoreMode.LIVE ? value : null;
}

/** State of the Live link to the Core server (CL-15). Commands are sent only while ONLINE (CL-22). */
export const LiveLinkState = {
  CONNECTING: 'CONNECTING',
  ONLINE: 'ONLINE',
  STALE: 'STALE',
  OFFLINE: 'OFFLINE',
  RESYNCING: 'RESYNCING',
} as const;
export type LiveLinkState = (typeof LiveLinkState)[keyof typeof LiveLinkState];

/** The part of the Live session information the light API reads: the effective permission list (§6.1). */
export interface LiveSessionHint {
  readonly permissions: readonly string[];
}

/**
 * What the light API needs from a Live source. The Live source (`@dems/shared/live/source`)
 * implements it beside the `Sim` members and its other members of CL-15.
 */
export interface LiveHandle {
  /** Marks a Live source. A simulator has no such member. */
  readonly coreMode: typeof CoreMode.LIVE;
  readonly link: LiveLinkState;
  /** `null` while nobody is signed in. A change replaces the object; it is never edited in place. */
  readonly session: LiveSessionHint | null;
  /** Calls `listener` after `link` or `session` changed. Returns the function that ends the subscription. */
  onLiveChange(listener: () => void): () => void;
}

/**
 * The Live source behind `sim`, or `null` for a simulator. The full shape belongs to the Live
 * source; name it as the type argument, with a type-only import, where more than `LiveHandle`
 * is needed. The argument is not checked at run time.
 */
export function liveOf<Handle extends LiveHandle = LiveHandle>(sim: Sim): Handle | null {
  return (sim as Partial<LiveHandle>).coreMode === CoreMode.LIVE ? (sim as unknown as Handle) : null;
}

/** The data mode of the source held in `SimContext` (TS-3). */
export function coreModeOf(sim: Sim): CoreMode {
  return liveOf(sim) ? CoreMode.LIVE : CoreMode.SIMULATED;
}

/** The Live link state, or `null` in Simulated mode. */
export function liveLinkOf(sim: Sim): LiveLinkState | null {
  return liveOf(sim)?.link ?? null;
}

/**
 * Whether the Core server's effective permission list of the signed-in operator holds
 * `permission` (§6.1). A hint for display: the server decides every call. False in Simulated
 * mode and while signed out: the simulator has no such list, and its screens keep `selectCan`.
 */
export function corePermissionOf(sim: Sim, permission: Permission): boolean {
  return liveOf(sim)?.session?.permissions.includes(permission) ?? false;
}
