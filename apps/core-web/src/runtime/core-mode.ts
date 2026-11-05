/**
 * The data mode of the web console: the resolver and the stored choice (backend task
 * 04_client_integration_spec §3.1, MD-1, MD-2, MD-4; plan row W50).
 *
 * Two modes exist: SIMULATED (the in-browser simulator is the Core) and LIVE (the Core server is
 * the Core). Which one a page load runs is decided ONCE, before any data source exists, by the
 * first rule that matches (MD-2):
 *
 * | # | Rule | Result | Choice offered |
 * |--:|------|--------|----------------|
 * | 1 | A packaged build (`VITE_DEMS_CORE_ORIGIN=same-origin`) or a production build | SIMULATED, whatever is stored or set | no |
 * | 1b | `VITE_DEMS_PRODUCTION_LOCK` is exactly `1` (the production console unit sets it; audit row 106, D25 N3, D29 Q6) | LIVE, whatever is stored or set | no |
 * | 2 | `localStorage` key `dems.core.mode.v1` holds exactly `SIMULATED` or `LIVE` | That value | yes |
 * | 3 | `VITE_DEMS_CORE_MODE` is exactly `simulated` or `live` (a lane sets `live`) | That value | yes |
 * | 4 | Otherwise | SIMULATED | yes |
 *
 * Any other stored or environment value counts as absent; any lock value other than `1` is off, so
 * lanes and developer runs (which do not set the lock) keep rules 2 to 4 and the choice.
 * `localStorage` is per origin, so each dev lane (5176 to 5178) keeps its own choice. The key collides with none of the console's
 * eight existing keys (MD-1).
 *
 * Pure but for the two storage helpers, which never throw: a browser that blocks its storage
 * reads as "nothing stored".
 */
import { CoreMode, DEFAULT_CORE_MODE, parseCoreMode } from '@dems/shared/live'

/** `localStorage` key of the chosen mode (MD-1). Value: `SIMULATED` or `LIVE`. */
export const CORE_MODE_STORAGE_KEY = 'dems.core.mode.v1'

/** Build-time preselection of a dev server (a lane sets `live`). Value: `simulated` or `live`. */
export const CORE_MODE_ENV_KEY = 'VITE_DEMS_CORE_MODE'

/**
 * The production console lock (audit register S1/S2; D25 N3, D29 Q6). On = the value is exactly `1`;
 * any other value, or absent, = off. Set only in the `dems-console` unit, never by a lane.
 */
export const CORE_MODE_LOCK_ENV_KEY = 'VITE_DEMS_PRODUCTION_LOCK'

/** Which rule of MD-2 decided. */
export const CoreModeSource = {
  /** Rule 1: the build offers no choice. */
  BUILD: 'BUILD',
  /** Rule 1b: the production console lock is on; LIVE, no choice (register S3). */
  PRODUCTION_LOCK: 'PRODUCTION_LOCK',
  /** Rule 2: the stored choice. */
  STORED: 'STORED',
  /** Rule 3: the preselection of the dev server. */
  ENV: 'ENV',
  /** Rule 4. */
  DEFAULT: 'DEFAULT',
} as const
export type CoreModeSource = (typeof CoreModeSource)[keyof typeof CoreModeSource]

export interface CoreModeInput {
  /** `import.meta.env.DEV`: false in every production build. */
  readonly dev: boolean
  /** `isSameOriginCore()`: the packaged build. */
  readonly packaged: boolean
  /** The raw text under `dems.core.mode.v1`, or `null`. */
  readonly stored: string | null
  /** The raw value of `VITE_DEMS_CORE_MODE`, or `undefined`. */
  readonly env: string | undefined
  /** The raw value of `VITE_DEMS_PRODUCTION_LOCK`, or `undefined` (absent = off). */
  readonly lock?: string | undefined
}

export interface CoreModeResolution {
  readonly mode: CoreMode
  /** MD-4: whether this build offers the choice (rule 1 says no). The selector renders only when true. */
  readonly selectable: boolean
  readonly source: CoreModeSource
}

const ENV_VALUES: Readonly<Record<string, CoreMode>> = {
  simulated: CoreMode.SIMULATED,
  live: CoreMode.LIVE,
}

/** `VITE_DEMS_CORE_MODE`: exactly `simulated` or `live`. Anything else counts as absent (MD-2). */
export function parseCoreModeEnv(value: unknown): CoreMode | null {
  if (typeof value !== 'string') return null
  return Object.prototype.hasOwnProperty.call(ENV_VALUES, value) ? (ENV_VALUES[value] ?? null) : null
}

/** Register S1: the lock is on only when the value is exactly `1`. */
function isProductionLockOn(value: unknown): boolean {
  return value === '1'
}

/** MD-2: the data mode of this page load. */
export function resolveCoreMode(input: CoreModeInput): CoreModeResolution {
  if (!input.dev || input.packaged) {
    return { mode: CoreMode.SIMULATED, selectable: false, source: CoreModeSource.BUILD }
  }
  // Rule 1b (register S4): the stored choice and the preselection are not read.
  if (isProductionLockOn(input.lock)) {
    return { mode: CoreMode.LIVE, selectable: false, source: CoreModeSource.PRODUCTION_LOCK }
  }
  const stored = parseCoreMode(input.stored)
  if (stored !== null) return { mode: stored, selectable: true, source: CoreModeSource.STORED }
  const preselected = parseCoreModeEnv(input.env)
  if (preselected !== null) return { mode: preselected, selectable: true, source: CoreModeSource.ENV }
  return { mode: DEFAULT_CORE_MODE, selectable: true, source: CoreModeSource.DEFAULT }
}

/** The origin's `localStorage`, or `null` when the browser has none or blocks it. Never throws. */
export function pageLocalStorage(): Storage | null {
  try {
    const storage = globalThis.localStorage
    return storage && typeof storage.getItem === 'function' ? storage : null
  } catch {
    return null
  }
}

/** The raw text under the mode key, or `null` (absent, or the storage cannot be read). Never throws. */
export function readStoredCoreMode(storage: Pick<Storage, 'getItem'> | null): string | null {
  if (storage === null) return null
  try {
    return storage.getItem(CORE_MODE_STORAGE_KEY)
  } catch {
    return null
  }
}

/** Stores the choice. False when the storage refused it: the mode then cannot be changed in this browser. */
export function writeStoredCoreMode(storage: Pick<Storage, 'setItem'> | null, mode: CoreMode): boolean {
  if (storage === null) return false
  try {
    storage.setItem(CORE_MODE_STORAGE_KEY, mode)
    return true
  } catch {
    return false
  }
}

/**
 * What the router context carries about the mode (MD-4). A router built by a test without this
 * member renders no selector, so no existing test sees a new control.
 */
export interface CoreModeControl {
  /** The mode of this page load. It never changes while the page lives: a change reloads the page. */
  readonly mode: CoreMode
  /** Whether the build offers the choice: the Login selector and the shell's indicator switch only when true. */
  readonly selectable: boolean
  /**
   * §3.3 steps 2 to 4, after the caller's own confirmation dialog (step 1): signs out of the
   * current mode, stores the choice and reloads the page at `/login`. Resolves to `false`, with
   * nothing changed, when the mode is not selectable, is already `next`, or could not be stored.
   */
  readonly switchTo: (next: CoreMode) => Promise<boolean>
}
