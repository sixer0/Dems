// Simulator store and createSim adapters (masterplan/01_specs.md §14.7 `store.ts`, `engine.ts`;
// SCR-01: injected storage and visibility, `ready` after hydration, audio slice not persisted).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import {
  createManualClock,
  createMemoryAuthStorage,
  createMemoryStateStorage,
  createSim,
  ENGINE_INTERVAL_MS,
  SIM_STORAGE_KEY,
  type SimPersistStorage,
  type SimScheduler,
  type SimSnapshot,
  type VisibilityAdapter,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 10:00 WIB

function jsonStorage(storage: StateStorage): SimPersistStorage {
  const persistStorage = createJSONStorage<SimSnapshot>(() => storage);
  if (!persistStorage) throw new Error('storage unavailable');
  return persistStorage;
}

/** An AsyncStorage-like store whose reads wait until `release()` (models RN hydration). */
function deferredStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const setItem = vi.fn(async (name: string, value: string) => {
    data.set(name, value);
  });
  const storage: StateStorage = {
    getItem: async (name) => {
      await gate;
      return data.get(name) ?? null;
    },
    setItem,
    removeItem: async (name) => {
      data.delete(name);
    },
  };
  return { storage, release: () => release(), setItem, data };
}

/** A snapshot written by one sim (signed-in operator, tablet offline), as stored JSON. */
function storedSnapshot(seed = 20261001): string {
  const memory = createMemoryStateStorage();
  const clock = createManualClock(START);
  const sim = createSim({ seed, clock, storage: jsonStorage(memory), authStorage: null });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  sim.actions.setTabletLink('OFFLINE');
  sim.flush();
  const raw = memory.dump()[SIM_STORAGE_KEY];
  if (!raw) throw new Error('nothing persisted');
  return raw;
}

describe('persisted snapshot (dems.sim.v1)', () => {
  it('excludes the audio, clock and auth slices and keeps everything else', () => {
    const parsed = JSON.parse(storedSnapshot()) as { state: Record<string, unknown>; version: number };
    expect(parsed.version).toBe(2);
    const keys = Object.keys(parsed.state);
    expect(keys).not.toContain('audio');
    expect(keys).not.toContain('clock');
    expect(keys).not.toContain('auth');
    for (const key of ['session', 'pairing', 'tabletLink', 'sessionHistory', 'audit', 'evidence', 'authLockout']) {
      expect(keys).toContain(key);
    }
    expect((parsed.state.tabletLink as { state: string }).state).toBe('OFFLINE');
  });

  it('never stores a password or the signed-in operator record', () => {
    const raw = storedSnapshot();
    expect(raw).not.toContain('demo-2026');
    expect(raw).not.toContain('"auth":');
  });
});

describe('ready resolves after hydration (injected async storage)', () => {
  it('holds the fresh state until the storage answers, then restores the snapshot', async () => {
    const stored = deferredStorage({ [SIM_STORAGE_KEY]: storedSnapshot() });
    const sim = createSim({
      clock: createManualClock(START + 60_000),
      storage: jsonStorage(stored.storage),
      authStorage: createMemoryAuthStorage(),
    });

    let settled = false;
    void sim.ready.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(sim.isReady()).toBe(false);
    expect(settled).toBe(false);
    expect(sim.store.getState().tabletLink.state).toBe('CONNECTED'); // fresh, not yet hydrated

    stored.release();
    await sim.ready;
    expect(settled).toBe(true);
    expect(sim.isReady()).toBe(true);
    expect(sim.wasRestored()).toBe(true);
    const state = sim.store.getState();
    expect(state.tabletLink.state).toBe('OFFLINE');
    expect(state.meta.epoch).toBe(1);
    expect(sim.rng.epoch).toBe(1);
    // Transient slices come from the live store, never from storage.
    expect(state.auth.status).toBe('SIGNED_OUT');
    expect(state.clock.now).toBe(START + 60_000);
    expect(state.audio.inputs['MIC-01'].noSignal).toBe(false);
    expect(sim.errors()).toEqual([]);
  });

  it('resolves with a fresh state when nothing is stored', async () => {
    const stored = deferredStorage();
    const sim = createSim({ clock: createManualClock(START), storage: jsonStorage(stored.storage), authStorage: null });
    stored.release();
    await sim.ready;
    expect(sim.wasRestored()).toBe(false);
    expect(sim.store.getState().meta.epoch).toBe(0);
  });

  it('rejects a snapshot written with another seed and reports it', async () => {
    const stored = deferredStorage({ [SIM_STORAGE_KEY]: storedSnapshot(1) });
    const onError = vi.fn();
    const sim = createSim({
      seed: 2,
      clock: createManualClock(START),
      storage: jsonStorage(stored.storage),
      authStorage: null,
      onError,
    });
    stored.release();
    await sim.ready;
    expect(sim.wasRestored()).toBe(false);
    expect(sim.store.getState().meta.seed).toBe(2);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ source: 'store.hydrate', level: 'warn' }));
  });

  it('still resolves when the storage read fails, and reports the error', async () => {
    const broken: StateStorage = {
      getItem: () => {
        throw new Error('storage blocked');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    const sim = createSim({ clock: createManualClock(START), storage: jsonStorage(broken), authStorage: null });
    await sim.ready;
    expect(sim.isReady()).toBe(true);
    expect(sim.errors()).toEqual([expect.objectContaining({ source: 'store.hydrate', message: 'storage blocked' })]);
  });
});

describe('throttled snapshot writes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes nothing before hydration finishes (the AsyncStorage gate)', async () => {
    const stored = deferredStorage({ [SIM_STORAGE_KEY]: storedSnapshot() });
    const sim = createSim({ clock: createManualClock(START), storage: jsonStorage(stored.storage), authStorage: null });
    sim.actions.setTabletLink('OFFLINE');
    sim.actions.setActiveCamera('VIDEO-02');
    await vi.advanceTimersByTimeAsync(5_000);
    expect(stored.setItem).not.toHaveBeenCalled();

    stored.release();
    await sim.ready;
    // Hydration replaced the pre-hydration changes with the stored snapshot.
    expect(sim.store.getState().activeCameraId).toBe('VIDEO-01');
    sim.actions.setActiveCamera('VIDEO-02');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(stored.setItem).toHaveBeenCalledTimes(1);
  });

  it('coalesces changes into at most one write per second; flush() writes at once', async () => {
    const memory = createMemoryStateStorage();
    const setItem = vi.spyOn(memory, 'setItem');
    const clock = createManualClock(START);
    const sim = createSim({ clock, storage: jsonStorage(memory), authStorage: null });
    expect(sim.isReady()).toBe(true); // synchronous storage hydrates inside createSim

    for (let i = 0; i < 10; i += 1) {
      sim.actions.setActiveCamera(i % 2 === 0 ? 'VIDEO-02' : 'VIDEO-01');
      await vi.advanceTimersByTimeAsync(50);
    }
    expect(setItem).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(setItem).toHaveBeenCalledTimes(1);

    sim.actions.setTabletLink('OFFLINE');
    sim.flush();
    expect(setItem).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(setItem).toHaveBeenCalledTimes(2);
  });

  it('reports a failing write instead of throwing', async () => {
    const failing: StateStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
      removeItem: () => undefined,
    };
    const sim = createSim({ clock: createManualClock(START), storage: jsonStorage(failing), authStorage: null });
    sim.actions.setTabletLink('OFFLINE');
    expect(() => sim.flush()).not.toThrow();
    expect(sim.errors()).toEqual([expect.objectContaining({ source: 'persist.setItem', message: 'quota exceeded' })]);
  });
});

describe('engine start, scheduler and visibility', () => {
  function controllableVisibility() {
    let hidden = false;
    const listeners = new Set<() => void>();
    const adapter: VisibilityAdapter = {
      isHidden: () => hidden,
      subscribe(onChange) {
        listeners.add(onChange);
        return () => listeners.delete(onChange);
      },
    };
    return {
      adapter,
      listeners,
      set(next: boolean) {
        hidden = next;
        for (const listener of listeners) listener();
      },
    };
  }

  function spyScheduler() {
    const cancel = vi.fn();
    const scheduler = vi.fn<SimScheduler>(() => cancel);
    return { scheduler, cancel };
  }

  it('starts the scheduler only after ready, at the 50 ms interval', async () => {
    const stored = deferredStorage();
    const { scheduler } = spyScheduler();
    const sim = createSim({
      clock: createManualClock(START),
      storage: jsonStorage(stored.storage),
      authStorage: null,
      scheduler,
    });
    sim.start();
    expect(scheduler).not.toHaveBeenCalled();
    stored.release();
    await sim.ready;
    await Promise.resolve();
    expect(scheduler).toHaveBeenCalledTimes(1);
    expect(scheduler.mock.calls[0]?.[1]).toBe(ENGINE_INTERVAL_MS);
    expect(sim.isRunning()).toBe(true);
    sim.start(); // idempotent
    expect(scheduler).toHaveBeenCalledTimes(1);
  });

  it('pauses while hidden and catches up with one tick on resume', () => {
    const visibility = controllableVisibility();
    const { scheduler, cancel } = spyScheduler();
    const clock = createManualClock(START);
    const sim = createSim({ clock, storage: null, authStorage: null, scheduler, visibility: visibility.adapter });
    sim.start();
    expect(scheduler).toHaveBeenCalledTimes(1);

    visibility.set(true);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(sim.isRunning()).toBe(false);

    clock.advance(30_000);
    visibility.set(false);
    expect(scheduler).toHaveBeenCalledTimes(2);
    expect(sim.store.getState().clock.now).toBe(START + 30_000); // the catch-up tick published it

    sim.stop();
    expect(visibility.listeners.size).toBe(0);
    expect(sim.isRunning()).toBe(false);
  });

  it('does not start while hidden', () => {
    const visibility = controllableVisibility();
    visibility.set(true);
    const { scheduler } = spyScheduler();
    const sim = createSim({ clock: createManualClock(START), storage: null, authStorage: null, scheduler, visibility: visibility.adapter });
    sim.start();
    expect(scheduler).not.toHaveBeenCalled();
    sim.stop();
  });

  it('publishes the clock in 100 ms steps', () => {
    const clock = createManualClock(START);
    const sim = createSim({ clock, storage: null, authStorage: null });
    clock.advance(40);
    sim.tick();
    expect(sim.store.getState().clock.now).toBe(START);
    clock.advance(70);
    sim.tick();
    expect(sim.store.getState().clock.now).toBe(START + 100);
  });
});

describe('transient audio subscription (the useAudioChannel path)', () => {
  it('fires for its own channel only, and once immediately', () => {
    const sim = createSim({ clock: createManualClock(START), storage: null, authStorage: null });
    const frames: number[] = [];
    const unsubscribe = sim.store.subscribe(
      (state) => state.audio.inputs['MIC-02'],
      (frame) => frames.push(frame.dbfs),
      { fireImmediately: true },
    );
    expect(frames).toEqual([-52]);

    const { audio } = sim.store.getState();
    sim.store.setState({
      audio: { inputs: { ...audio.inputs, 'MIC-02': { ...audio.inputs['MIC-02'], seq: 1, dbfs: -18 } }, activeInputId: audio.activeInputId },
    });
    const after = sim.store.getState().audio;
    sim.store.setState({
      audio: { inputs: { ...after.inputs, 'MIC-01': { ...after.inputs['MIC-01'], seq: 1, dbfs: -20 } }, activeInputId: after.activeInputId },
    });
    sim.actions.setTabletLink('OFFLINE');
    expect(frames).toEqual([-52, -18]);
    unsubscribe();
  });
});

describe('platform defaults outside a browser', () => {
  it('runs with no web globals (the React Native case): memory storage, always visible', () => {
    // Node 26 defines a global sessionStorage (in-memory Web Storage), so remove it here to
    // model Hermes, which has neither a document nor web storage.
    vi.stubGlobal('sessionStorage', undefined);
    try {
      const globals = globalThis as Record<string, unknown>;
      expect(globals.document).toBeUndefined();
      expect(globals.window).toBeUndefined();
      expect(globals.sessionStorage).toBeUndefined();
      const sim = createSim({ clock: createManualClock(START) });
      expect(sim.isReady()).toBe(true);
      sim.actions.signIn('budi.santoso', 'demo-2026');
      sim.start();
      expect(sim.isRunning()).toBe(true);
      sim.stop();
      expect(sim.errors()).toEqual([]);
      // The operator record stayed in memory: a second sim does not see it.
      expect(createSim({ clock: createManualClock(START) }).store.getState().auth.status).toBe('SIGNED_OUT');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('uses a guarded session storage when the host provides one', () => {
    const memory = createMemoryStateStorage();
    vi.stubGlobal('sessionStorage', memory);
    try {
      const sim = createSim({ clock: createManualClock(START) });
      sim.actions.signIn('andi.pratama', 'demo-2026');
      sim.flush();
      const dump = memory.dump();
      expect(JSON.parse(dump['dems.auth'] ?? 'null')).toEqual({ operatorId: 'OPR-002', issuedAt: START });
      expect(dump[SIM_STORAGE_KEY]).toContain('"schemaVersion":2');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
