/**
 * Platform adapters (SCR-01; 04_mobile_specs.md §5.2).
 *
 * This is the ONLY simulator file that may name a web global, and each access is guarded:
 * it reads `globalThis` through a structural type, checks the value exists, and wraps the
 * access in try/catch (session storage throws a SecurityError when site data is blocked).
 * On React Native and in Node, every default falls back to memory or "always visible".
 *
 * Mobile passes its own adapters instead: `createJSONStorage(() => AsyncStorage)`, an
 * AppState visibility adapter, and `null` auth storage (memory only, 04 §6.4).
 */
import { createJSONStorage, type StateStorage, type StorageValue } from 'zustand/middleware';
import { AUTH_STORAGE_KEY } from './constants';
import type {
  AuthSessionRecord,
  AuthSessionStorage,
  SimPersistStorage,
  SimScheduler,
  SimSnapshot,
  TimerAdapter,
  VisibilityAdapter,
} from './types';

// ── Guarded web globals (default adapters only) ──────────────────────────────────────────

/** The part of the web visibility API the default adapter uses. */
interface VisibilityDocumentLike {
  hidden?: boolean;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

interface WebGlobalsLike {
  document?: VisibilityDocumentLike;
  sessionStorage?: StateStorage;
}

/** Session storage when the host has a usable one; otherwise null. Never throws. */
export function getWebSessionStorage(): StateStorage | null {
  try {
    const candidate = (globalThis as WebGlobalsLike).sessionStorage;
    if (!candidate || typeof candidate.getItem !== 'function') return null;
    return candidate;
  } catch {
    return null;
  }
}

/** The page visibility API when the host has one; otherwise null. Never throws. */
function getVisibilityDocument(): VisibilityDocumentLike | null {
  try {
    const candidate = (globalThis as WebGlobalsLike).document;
    if (!candidate || typeof candidate.addEventListener !== 'function') return null;
    return candidate;
  } catch {
    return null;
  }
}

// ── Memory storages (tests, Node, mobile fallback) ───────────────────────────────────────

/** A synchronous string key-value store with the web storage method names. */
export function createMemoryStateStorage(initial?: Record<string, string>): StateStorage & {
  dump(): Record<string, string>;
} {
  const data = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getItem: (name) => data.get(name) ?? null,
    setItem: (name, value) => {
      data.set(name, value);
    },
    removeItem: (name) => {
      data.delete(name);
    },
    dump: () => Object.fromEntries(data),
  };
}

/** Snapshot storage in memory, JSON round-tripped so it behaves like real storage. */
export function createMemoryPersistStorage(): SimPersistStorage {
  const storage = createJSONStorage<SimSnapshot>(() => createMemoryStateStorage());
  if (!storage) throw new Error('createJSONStorage rejected an in-memory storage');
  return storage;
}

/** Default snapshot storage: web session storage when present, else memory. */
export function createDefaultPersistStorage(): SimPersistStorage {
  const web = getWebSessionStorage();
  if (web) {
    const storage = createJSONStorage<SimSnapshot>(() => web);
    if (storage) return storage;
  }
  return createMemoryPersistStorage();
}

// ── Auth record storage (`dems.auth`) ────────────────────────────────────────────────────

function parseAuthRecord(raw: string | null): AuthSessionRecord | null {
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null) return null;
  const { operatorId, issuedAt } = value as Record<string, unknown>;
  if (typeof operatorId !== 'string' || typeof issuedAt !== 'number') return null;
  return { operatorId, issuedAt };
}

/** Auth record storage over any synchronous string storage. */
export function createStateStorageAuth(
  storage: StateStorage,
  onError?: (source: string, error: unknown) => void,
): AuthSessionStorage {
  return {
    load() {
      try {
        const raw = storage.getItem(AUTH_STORAGE_KEY);
        return typeof raw === 'string' || raw === null ? parseAuthRecord(raw) : null;
      } catch (error) {
        onError?.('authStorage.load', error);
        return null;
      }
    },
    save(record) {
      try {
        storage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({ operatorId: record.operatorId, issuedAt: record.issuedAt }),
        );
      } catch (error) {
        onError?.('authStorage.save', error);
      }
    },
    clear() {
      try {
        storage.removeItem(AUTH_STORAGE_KEY);
      } catch (error) {
        onError?.('authStorage.clear', error);
      }
    },
  };
}

/** Memory-only auth record storage (mobile: sign in again after a cold start). */
export function createMemoryAuthStorage(): AuthSessionStorage {
  let record: AuthSessionRecord | null = null;
  return {
    load: () => record,
    save: (next) => {
      record = { operatorId: next.operatorId, issuedAt: next.issuedAt };
    },
    clear: () => {
      record = null;
    },
  };
}

/** Default auth storage: web session storage key `dems.auth` when present, else memory. */
export function createDefaultAuthStorage(
  onError?: (source: string, error: unknown) => void,
): AuthSessionStorage {
  const web = getWebSessionStorage();
  return web ? createStateStorageAuth(web, onError) : createMemoryAuthStorage();
}

// ── Visibility ───────────────────────────────────────────────────────────────────────────

export const ALWAYS_VISIBLE: VisibilityAdapter = {
  isHidden: () => false,
  subscribe: () => () => undefined,
};

/** Default visibility: the page visibility API when present, else always visible. */
export function createDefaultVisibility(): VisibilityAdapter {
  const doc = getVisibilityDocument();
  if (!doc) return ALWAYS_VISIBLE;
  return {
    isHidden: () => doc.hidden === true,
    subscribe(onChange) {
      doc.addEventListener('visibilitychange', onChange);
      return () => doc.removeEventListener('visibilitychange', onChange);
    },
  };
}

// ── Timers and scheduler (platform-neutral globals: browsers, Node, Hermes) ──────────────

/** Global timers, looked up at call time so test fake timers apply. */
export const DEFAULT_TIMERS: TimerAdapter = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) =>
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
};

/** `setInterval(tick, intervalMs)` (§14.7 `engine.ts` default). */
export const defaultScheduler: SimScheduler = (tick, intervalMs) => {
  const handle = globalThis.setInterval(tick, intervalMs);
  return () => globalThis.clearInterval(handle);
};

// ── Throttled snapshot writes (§14.7 `store.ts`: throttled to 1 s) ──────────────────────

export interface ThrottledPersistStorage extends SimPersistStorage {
  /** Writes the pending snapshot now (visibility hidden, stop, destroy). */
  flush(): void;
  /** Drops the pending snapshot without writing it. */
  cancel(): void;
  /** Snapshot writes are dropped until this is set (hydration gate, 04 §5.2). */
  enable(): void;
  readonly enabled: boolean;
}

export function createThrottledPersistStorage(
  inner: SimPersistStorage,
  options: {
    intervalMs: number;
    timers: TimerAdapter;
    onError: (source: string, error: unknown) => void;
  },
): ThrottledPersistStorage {
  let enabled = false;
  let timer: unknown = null;
  let pending: { name: string; value: StorageValue<SimSnapshot> } | null = null;

  const write = () => {
    if (timer !== null) {
      options.timers.clearTimeout(timer);
      timer = null;
    }
    const next = pending;
    pending = null;
    if (!next) return;
    try {
      const result: unknown = inner.setItem(next.name, next.value);
      if (result instanceof Promise) {
        result.catch((error: unknown) => options.onError('persist.setItem', error));
      }
    } catch (error) {
      options.onError('persist.setItem', error);
    }
  };

  return {
    getItem: (name) => inner.getItem(name),
    setItem(name, value) {
      if (!enabled) return;
      pending = { name, value };
      if (timer === null) timer = options.timers.setTimeout(write, options.intervalMs);
    },
    removeItem(name) {
      pending = null;
      if (timer !== null) {
        options.timers.clearTimeout(timer);
        timer = null;
      }
      try {
        const result: unknown = inner.removeItem(name);
        if (result instanceof Promise) {
          result.catch((error: unknown) => options.onError('persist.removeItem', error));
        }
      } catch (error) {
        options.onError('persist.removeItem', error);
      }
    },
    flush: write,
    cancel() {
      pending = null;
      if (timer !== null) {
        options.timers.clearTimeout(timer);
        timer = null;
      }
    },
    enable() {
      enabled = true;
    },
    get enabled() {
      return enabled;
    },
  };
}
