/**
 * The start of the console's data source: ONE source per page load (backend task
 * 04_client_integration_spec §3.1 MD-2, MD-5, MD-6; §3.3; §5.1; ADQ-2, ADQ-7; plan row W50).
 * `main.tsx` calls `bootCoreRuntime` once, before the router exists.
 *
 * | The mode resolves to | What is built | What is NOT touched |
 * |----------------------|---------------|---------------------|
 * | SIMULATED | The simulator, exactly as before (`createSim({ onError })`) | The Live module is not loaded; no request goes to the Core server; no socket is opened (MD-5) |
 * | LIVE, page at `http://127.0.0.1:<port>` | The Live source (`./live-start`), awaited until its bootstrap is over | `createSim` is not called; the simulator's stored snapshot (`dems.sim.v1`) and operator record (`dems.auth`) are neither read nor written (MD-5) |
 * | LIVE, page under `localhost` or any other host | NOTHING: the start is refused with the cause and the address to open (WT-2a) | Neither source is built. Live never falls back to the simulator by itself (ADQ-7) |
 *
 * MD-6: the import of `./live-start` (the only module that loads the typed client and the Live
 * source) stands behind `import.meta.env.DEV`. In a production or packaged build the condition is
 * the constant `false`, the bundler drops the import, and the resolver's rule 1 answers SIMULATED
 * before any other input is read.
 *
 * Changing the mode (§3.3) always passes the login screen of the other mode: the current session
 * is signed out, the choice is stored, and the page is loaded again at `/login`. One data source
 * per page load means there is no switch in place.
 */
import { coreActionsOf, CoreMode } from '@dems/shared/live'
import { selectIsSignedIn, SignOutReason, type CreateSimOptions, type Sim, type SimErrorReport } from '@dems/shared/sim'
import { isSameOriginCore } from '@/lib/core-endpoint'
import {
  pageLocalStorage,
  readStoredCoreMode,
  resolveCoreMode,
  writeStoredCoreMode,
  type CoreModeControl,
  type CoreModeResolution,
} from './core-mode'
import { webErrorSink, type ErrorSink } from './error-sink'
import { liveHostRefusal, type ConsoleLocation, type LiveHostRefusal } from './live-host'
import type { StorageEventTarget } from './owed-sign-out-storage'

type LiveStartModule = typeof import('./live-start')
type SimulatorModule = { createSim: (options?: CreateSimOptions) => Sim }

/** MD-6: unreachable in a production build (`import.meta.env.DEV` is the constant `false` there). */
const loadLiveStart: (() => Promise<LiveStartModule>) | null = import.meta.env.DEV ? () => import('./live-start') : null

/** The page's address, as the start-up and the mode switch use it. */
export type BootLocation = ConsoleLocation & Pick<Location, 'host'> & { assign(url: string): void; reload(): void }

export interface BootCoreRuntimeOptions {
  /** Simulated mode: the simulator's error report, as `main.tsx` has always passed it. */
  readonly onSimError: (report: SimErrorReport) => void
  /** Default `import.meta.env.DEV`. */
  readonly dev?: boolean
  /** Default `isSameOriginCore()`. */
  readonly packaged?: boolean
  /** Default `import.meta.env.VITE_DEMS_CORE_MODE`. */
  readonly env?: string | undefined
  /** Default: the origin's `localStorage` (`null` when the browser has none). */
  readonly storage?: Storage | null
  /** Default `window.location`. */
  readonly location?: BootLocation
  /** Default `window` (the `storage` event of another tab's Lock). */
  readonly storageEvents?: StorageEventTarget | null
  readonly sink?: ErrorSink
  /** Default: `import('@dems/shared/sim')`. */
  readonly loadSimulator?: () => Promise<SimulatorModule>
  /** Default: `import('./live-start')` in a dev build, `null` in a production build. */
  readonly loadLive?: (() => Promise<LiveStartModule>) | null
  /** Passed to the Live start-up; tests pass the fake transport and its clock. */
  readonly live?: Partial<Omit<Parameters<LiveStartModule['startLiveRuntime']>[0], 'location' | 'storage' | 'sink' | 'storageEvents'>>
}

interface RuntimeBase {
  readonly resolution: CoreModeResolution
}

export interface SimulatedRuntime extends RuntimeBase {
  readonly kind: 'SIMULATED'
  readonly sim: Sim
  readonly coreMode: CoreModeControl
}

export interface LiveRuntimeStarted extends RuntimeBase {
  readonly kind: 'LIVE'
  /** The Live source as the `Sim` of the router context. */
  readonly sim: Sim
  readonly live: Awaited<ReturnType<LiveStartModule['startLiveRuntime']>>['live']
  readonly owedSignOutPersisted: boolean
  readonly coreMode: CoreModeControl
  /** Stops the source (and its storage watch). */
  stop(): void
}

export interface RefusedRuntime extends RuntimeBase {
  readonly kind: 'REFUSED'
  readonly refusal: LiveHostRefusal
  /** Stores SIMULATED for this origin and loads the page again. False when the choice could not be stored. */
  useSimulated(): boolean
}

export type CoreRuntime = SimulatedRuntime | LiveRuntimeStarted | RefusedRuntime

interface ModeControlParts {
  readonly resolution: CoreModeResolution
  readonly sim: Sim
  readonly storage: Storage | null
  readonly location: Pick<BootLocation, 'assign'>
  readonly sink: ErrorSink
  /** What ends the data source of the current mode before the page is loaded again. */
  readonly stop: () => void
}

function reportNotStored(sink: ErrorSink, from: CoreMode, to: CoreMode): void {
  sink.report({
    level: 'error',
    source: 'runtime.modeSwitch',
    message: 'The data mode could not be stored in this browser (localStorage is not available). The mode was not changed.',
    at: Date.now(),
    context: { from, to },
  })
}

/** §3.3 steps 2 to 4. Step 1, the confirmation dialog, is the caller's. */
export function createCoreModeControl({ resolution, sim, storage, location, sink, stop }: ModeControlParts): CoreModeControl {
  let switching = false
  return {
    mode: resolution.mode,
    selectable: resolution.selectable,
    async switchTo(next) {
      if (!resolution.selectable || next === resolution.mode || switching) return false
      if (storage === null) {
        // Asked before anybody is signed out: without a storage the choice cannot be kept.
        reportNotStored(sink, resolution.mode, next)
        return false
      }
      switching = true
      try {
        // Step 2: no session of one mode is ever shown in the other.
        if (selectIsSignedIn(sim.store.getState())) {
          // Simulated: a plain call. Live: resolves when the session has ended here (it never fails; brief list row 16).
          await coreActionsOf(sim).signOut(SignOutReason.USER)
        }
        // Simulated: the snapshot is written now, not at the next throttle tick. Live: nothing is persisted.
        sim.flush()
        // Step 3.
        if (!writeStoredCoreMode(storage, next)) {
          reportNotStored(sink, resolution.mode, next)
          return false
        }
        stop()
        // Step 4: one data source per page load.
        location.assign('/login')
        return true
      } finally {
        switching = false
      }
    },
  }
}

export async function bootCoreRuntime(options: BootCoreRuntimeOptions): Promise<CoreRuntime> {
  const sink = options.sink ?? webErrorSink
  const loadLive = options.loadLive === undefined ? loadLiveStart : options.loadLive
  // A build without the Live module is a build that offers no choice (rule 1 of MD-2).
  const dev = (options.dev ?? import.meta.env.DEV) && loadLive !== null
  const packaged = options.packaged ?? isSameOriginCore()
  const selectable = dev && !packaged
  // Rule 1 answers before anything else is read: the stored key is ignored in such a build.
  const storage = selectable ? (options.storage === undefined ? pageLocalStorage() : options.storage) : null
  const location = options.location ?? window.location
  const resolution = resolveCoreMode({
    dev,
    packaged,
    stored: readStoredCoreMode(storage),
    env: options.env === undefined ? import.meta.env.VITE_DEMS_CORE_MODE : options.env,
  })

  if (resolution.mode === CoreMode.LIVE && loadLive !== null) {
    const refusal = liveHostRefusal(location)
    if (refusal !== null) {
      // WT-2a: the console record names the cause and the address to use.
      sink.report({
        level: 'error',
        source: 'runtime.liveHost',
        message: `Live mode was not started: the console was opened at ${refusal.current}. The Core server accepts the web console only from ${refusal.expected} (it holds no other host in its origin list, and the session cookie is bound to that host), so a sign-in from here would be refused with ORIGIN_NOT_ALLOWED. Open ${refusal.href} instead.`,
        at: Date.now(),
        context: { cause: refusal.cause, current: refusal.current, expected: refusal.expected },
      })
      return {
        kind: 'REFUSED',
        resolution,
        refusal,
        useSimulated() {
          if (!writeStoredCoreMode(storage, CoreMode.SIMULATED)) return false
          location.reload()
          return true
        },
      }
    }
    const { startLiveRuntime } = await loadLive()
    const runtime = startLiveRuntime({
      ...options.live,
      location,
      storage,
      sink,
      storageEvents: options.storageEvents === undefined ? window : options.storageEvents,
    })
    // §5.1 step 5. It never rejects; it resolves at the latest after the boot time-out, with the link OFFLINE.
    await runtime.live.ready
    return {
      kind: 'LIVE',
      resolution,
      sim: runtime.sim,
      live: runtime.live,
      owedSignOutPersisted: runtime.owedSignOutPersisted,
      coreMode: createCoreModeControl({ resolution, sim: runtime.sim, storage, location, sink, stop: () => runtime.stop() }),
      stop: () => runtime.stop(),
    }
  }

  const { createSim } = await (options.loadSimulator ?? (() => import('@dems/shared/sim')))()
  const sim = createSim({ onError: options.onSimError })
  return {
    kind: 'SIMULATED',
    resolution,
    sim,
    coreMode: createCoreModeControl({ resolution, sim, storage, location, sink, stop: () => sim.stop() }),
  }
}
