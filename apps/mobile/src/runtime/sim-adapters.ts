/**
 * Platform adapters that feed the shared simulator on React Native (04_mobile_specs §5.2; SCR-01).
 *
 * The simulator core (`@dems/shared/sim`, D19) is reused, not forked: this file only supplies the
 * adapters `createSim` accepts (12_sim_contract §2 "Mobile (step 73)" recipe):
 *
 * | Adapter | Mobile implementation |
 * |---|---|
 * | Snapshot storage | `createJSONStorage(() => AsyncStorage)`: key `dems.sim.v1`, the web key; throttled to 1 s by the engine; the audio, clock and auth slices are excluded by the engine |
 * | Auth record storage | `null` → memory: the operator signs in again after a cold start (§6.4) |
 * | Visibility | `AppState`: `background` / `inactive` pause the engine and flush the snapshot; `active` catches up and resumes |
 * | Hydration gate | the engine's own: `start()` waits for `sim.ready`; the UI waits via `useSimReady()` |
 * | Scheduler | the engine default `setInterval(tick, 50)` (Hermes has it) |
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import {
  createSim,
  SIM_STORAGE_KEY,
  type CreateSimOptions,
  type Sim,
  type SimPersistStorage,
  type SimSnapshot,
  type VisibilityAdapter,
} from '@dems/shared/sim';

/** The simulator snapshot key (same as the web, 04 §5.3). */
export const SIM_SNAPSHOT_KEY = SIM_STORAGE_KEY;

/** Snapshot storage over AsyncStorage (or any promise-based string store with the same methods). */
export function createAsyncStoragePersistStorage(storage: StateStorage = AsyncStorage): SimPersistStorage {
  const persist = createJSONStorage<SimSnapshot>(() => storage);
  if (!persist) throw new Error('createJSONStorage rejected the AsyncStorage adapter');
  return persist;
}

/** The part of React Native's `AppState` the visibility adapter uses. */
export interface AppStateLike {
  readonly currentState: string | null | undefined;
  addEventListener(type: 'change', listener: (state: string) => void): { remove(): void };
}

/**
 * Hidden = the app is not in the foreground. `background` (Android and iOS) and `inactive` (iOS
 * transitions) count as hidden. `unknown` (a state some platforms report before the first event)
 * counts as visible, so the engine never stalls waiting for an event that already happened; the
 * next `change` event corrects it either way.
 */
export function isHiddenAppState(state: string | null | undefined): boolean {
  return state === 'background' || state === 'inactive';
}

/** The engine's visibility adapter over `AppState` (04 §5.2 "Visibility"). */
export function createAppStateVisibility(appState: AppStateLike = AppState as unknown as AppStateLike): VisibilityAdapter {
  return {
    isHidden: () => isHiddenAppState(appState.currentState),
    subscribe(onChange) {
      const subscription = appState.addEventListener('change', () => onChange());
      return () => subscription.remove();
    },
  };
}

export interface MobileSimOptions extends Omit<CreateSimOptions, 'storage' | 'authStorage' | 'visibility'> {
  /** Default: AsyncStorage. `null`: memory (tests). */
  storage?: SimPersistStorage | null;
  /** Default: `AppState`. */
  visibility?: VisibilityAdapter;
}

/**
 * The mobile simulator: the shared `createSim` with the adapters above. The operator record is
 * never persisted (`authStorage: null`), so no identity survives a cold start (§6.4).
 */
export function createMobileSim(options: MobileSimOptions = {}): Sim {
  const { storage, visibility, ...rest } = options;
  return createSim({
    ...rest,
    storage: storage === undefined ? createAsyncStoragePersistStorage() : storage,
    authStorage: null,
    visibility: visibility ?? createAppStateVisibility(),
  });
}
