/**
 * The simulator store (masterplan/01_specs.md §14.7 `store.ts`; SCR-01).
 *
 * zustand vanilla `createStore` with `subscribeWithSelector` (transient 20 Hz meter
 * subscriptions) and `persist` (key `dems.sim.v1`, writes throttled to 1 s, so a reload
 * resumes and the session timer survives: S4).
 *
 * Persisted snapshot = state minus `audio` (20 Hz), `clock` (re-derived) and `auth` (lives
 * in `dems.auth` on the web and in memory on mobile). Hydration is explicit (`skipHydration`)
 * and snapshot writes stay off until it finishes, so an asynchronous storage (AsyncStorage)
 * can never be overwritten by a pre-hydration state (04 §5.2 hydration gate).
 */
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { createStore, type Mutate, type StoreApi } from 'zustand/vanilla';
import { SIM_SNAPSHOT_VERSION, SIM_STORAGE_KEY } from './constants';
import type { SimPersistStorage, SimSnapshot, SimState } from './types';

export type SimStore = Mutate<
  StoreApi<SimState>,
  [['zustand/subscribeWithSelector', never], ['zustand/persist', SimSnapshot]]
>;

/** The snapshot keys, in state order (everything except audio, clock and auth). */
export const SNAPSHOT_KEYS = [
  'meta',
  'device',
  'operators',
  'authLockout',
  'pairing',
  'tabletLink',
  'session',
  'lastSealedSessionId',
  'lastSealedAcknowledged',
  'sessionHistory',
  'activeCameraId',
  'cameras',
  'mics',
  'storage',
  'storagePolicy',
  'time',
  'network',
  'security',
  'services',
  'health',
  'otherDevices',
  'ports',
  'evidence',
  'events',
  'alerts',
  'audit',
  'faults',
  'diagnostics',
  'update',
  'settings',
  'captureConfig',
  'captureDevices',
] as const satisfies readonly (keyof SimSnapshot)[];

/**
 * Keys a stored snapshot must have to be usable. Slices added after the first release (step 54:
 * `settings`; task 3 M2: `captureConfig`, `captureDevices`) are optional in a stored snapshot: the
 * merge takes them from the fresh state, so a reload after an upgrade resumes instead of starting
 * over.
 */
export const ADDED_SNAPSHOT_KEYS = ['settings', 'captureConfig', 'captureDevices'] as const satisfies readonly (
  keyof SimSnapshot
)[];
export const REQUIRED_SNAPSHOT_KEYS: readonly (keyof SimSnapshot)[] = SNAPSHOT_KEYS.filter(
  (key) => !(ADDED_SNAPSHOT_KEYS as readonly string[]).includes(key),
);

// Compile-time proof that SNAPSHOT_KEYS lists every snapshot key.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const snapshotKeysComplete: Exact<(typeof SNAPSHOT_KEYS)[number], keyof SimSnapshot> = true;
void snapshotKeysComplete;

/** The persisted part of the state. */
export function toSnapshot(state: SimState): SimSnapshot {
  const { audio: _audio, clock: _clock, auth: _auth, ...snapshot } = state;
  return snapshot;
}

/** A snapshot is usable when it has every key, the current schema and the same seed. */
export function isUsableSnapshot(value: unknown, seed: number): value is SimSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (!REQUIRED_SNAPSHOT_KEYS.every((key) => key in record)) return false;
  const meta = record.meta as Partial<SimState['meta']> | null | undefined;
  return (
    typeof meta === 'object' &&
    meta !== null &&
    meta.schemaVersion === SIM_SNAPSHOT_VERSION &&
    meta.seed === seed &&
    typeof meta.epoch === 'number' &&
    Array.isArray(record.evidence) &&
    typeof record.audit === 'object' &&
    record.audit !== null
  );
}

export interface CreateSimStoreOptions {
  initialState: SimState;
  storage: SimPersistStorage;
  /** Called after hydration finished (with or without a stored snapshot) or failed. */
  onHydrated: (outcome: { restored: boolean; error?: unknown }) => void;
  /** Called when a stored snapshot is rejected (wrong shape, schema or seed). */
  onRejectedSnapshot?: () => void;
}

export function createSimStore(options: CreateSimStoreOptions): SimStore {
  let restored = false;
  return createStore<SimState>()(
    subscribeWithSelector(
      persist(() => options.initialState, {
        name: SIM_STORAGE_KEY,
        version: SIM_SNAPSHOT_VERSION,
        storage: options.storage,
        skipHydration: true,
        partialize: toSnapshot,
        // A snapshot from another schema version is dropped, not migrated.
        migrate: () => ({}) as SimSnapshot,
        merge: (persisted, current) => {
          if (!isUsableSnapshot(persisted, current.meta.seed)) {
            if (persisted !== undefined && persisted !== null && Object.keys(persisted).length > 0) {
              options.onRejectedSnapshot?.();
            }
            return current;
          }
          restored = true;
          return {
            ...current,
            ...persisted,
            meta: { ...persisted.meta, epoch: persisted.meta.epoch + 1 },
            // Transient slices always come from the live state.
            audio: current.audio,
            clock: current.clock,
            auth: current.auth,
          };
        },
        onRehydrateStorage: () => (_state, error) => {
          options.onHydrated(error === undefined ? { restored } : { restored, error });
        },
      }),
    ),
  );
}
