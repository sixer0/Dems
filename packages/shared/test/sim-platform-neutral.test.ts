// Platform neutrality (SCR-01; 04_mobile_specs.md §5.2, §13): the engine runs with injected
// adapters and NO web globals (the Hermes / React Native case): no document, window,
// sessionStorage or localStorage. Node 26 defines a global sessionStorage, so it is stubbed
// away here (D54 a, F-31-1). A static scan keeps web globals and nondeterminism out of src/sim.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import {
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  ENGINE_INTERVAL_MS,
  SIM_STORAGE_KEY,
  type SimPersistStorage,
  type SimScheduler,
  type SimSnapshot,
  type VisibilityAdapter,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 10:00 WIB
const SIM_DIR = fileURLToPath(new URL('../src/sim/', import.meta.url));

/** An AsyncStorage-like store: every call resolves on a later microtask. */
function asyncStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: StateStorage = {
    getItem: async (name) => data.get(name) ?? null,
    setItem: async (name, value) => {
      data.set(name, value);
    },
    removeItem: async (name) => {
      data.delete(name);
    },
  };
  const persist = createJSONStorage<SimSnapshot>(() => storage) as SimPersistStorage;
  return { persist, data };
}

/** An AppState-like visibility adapter the test drives. */
function appState() {
  let current: 'active' | 'background' = 'active';
  const listeners = new Set<() => void>();
  const adapter: VisibilityAdapter = {
    isHidden: () => current !== 'active',
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
  return {
    adapter,
    set(next: 'active' | 'background') {
      current = next;
      for (const listener of listeners) listener();
    },
  };
}

/** A scheduler that hands the tick function to the test instead of using setInterval. */
function manualScheduler() {
  const state: { tick: (() => void) | null; interval: number | null } = { tick: null, interval: null };
  const scheduler: SimScheduler = (tick, intervalMs) => {
    state.tick = tick;
    state.interval = intervalMs;
    return () => {
      state.tick = null;
    };
  };
  return { scheduler, state };
}

describe('no web globals (the React Native case)', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', undefined);
    vi.stubGlobal('localStorage', undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('the environment really has no document, window, sessionStorage or localStorage', () => {
    const globals = globalThis as Record<string, unknown>;
    expect(globals.document).toBeUndefined();
    expect(globals.window).toBeUndefined();
    expect(globals.sessionStorage).toBeUndefined();
    expect(globals.localStorage).toBeUndefined();
  });

  it('runs a full session on injected adapters: async storage, AppState visibility, own scheduler', async () => {
    const storage = asyncStorage();
    const visibility = appState();
    const { scheduler, state: sched } = manualScheduler();
    const clock = createManualClock(START);
    const sim = createSim({
      clock,
      storage: storage.persist,
      authStorage: createMemoryAuthStorage(),
      visibility: visibility.adapter,
      scheduler,
      initialPairing: 'UNPAIRED',
    });
    sim.start();
    expect(sched.tick).toBeNull(); // the hydration gate: nothing ticks before ready
    await sim.ready;
    await Promise.resolve();
    expect(sched.interval).toBe(ENGINE_INTERVAL_MS);
    const drive = (ms: number) => {
      for (let t = 0; t < ms; t += ENGINE_INTERVAL_MS) {
        clock.advance(ENGINE_INTERVAL_MS);
        sched.tick?.();
      }
    };

    expect(sim.actions.pair('482913')).toMatchObject({ ok: true });
    expect(sim.actions.signInWithBiometric('OPR-001')).toMatchObject({ ok: true, method: 'BIOMETRIC' });
    sim.actions.createSession({
      caseNumber: 'LP/2026/1001-0008',
      subjectType: 'SAKSI',
      subjectName: 'Neutral Saksi',
      investigatorId: 'OPR-001',
      room: 'Interview Room 1',
      profileId: 'STANDARD_1080P25',
    });
    sim.actions.beginPrecheck();
    drive(5_000);
    sim.actions.startRecording();
    drive(20_000);
    const frame = sim.store.getState().audio.inputs['MIC-01']!;
    for (const value of Object.values(frame)) expect(['number', 'boolean']).toContain(typeof value);

    // Background: the scheduler stops and the snapshot is flushed; the Core keeps "running".
    visibility.set('background');
    expect(sched.tick).toBeNull();
    sim.actions.stopRecording('Interview completed');
    clock.advance(15_000);
    visibility.set('active'); // one catch-up tick with the elapsed time
    expect(sim.store.getState().session?.state).toBe('SEALED');
    expect(sched.tick).not.toBeNull();

    sim.flush();
    await Promise.resolve();
    const raw = storage.data.get(SIM_STORAGE_KEY);
    expect(raw).toBeDefined();
    const stored = JSON.parse(raw ?? '{}') as { state: Record<string, unknown> };
    for (const key of ['audio', 'clock', 'auth']) expect(Object.keys(stored.state)).not.toContain(key);
    expect((stored.state.session as { state: string }).state).toBe('SEALED');
    expect(raw).not.toContain('482913'); // the pairing code never reaches storage
    expect(raw).not.toContain('demo-2026');
    sim.stop();
    expect(sim.errors()).toEqual([]);
  });

  it('a relaunch hydrates from the async storage and resumes the recording timer (MA-08 unit form)', async () => {
    const storage = asyncStorage();
    const clock = createManualClock(START);
    const first = createSim({ clock, storage: storage.persist, authStorage: null, scenario: 'recording' });
    await first.ready;
    first.actions.setActiveCamera('VIDEO-02'); // any change schedules a snapshot write
    first.flush();
    await Promise.resolve();
    const startedAt = first.store.getState().session?.startedAt;

    clock.advance(90_000); // the app was killed for 90 s
    const second = createSim({ clock, storage: storage.persist, authStorage: null });
    expect(second.isReady()).toBe(false);
    await second.ready;
    expect(second.wasRestored()).toBe(true);
    second.tick();
    const state = second.store.getState();
    expect(state.session).toMatchObject({ state: 'RECORDING', startedAt });
    expect(state.clock.now - (startedAt ?? 0)).toBe((18 * 60 + 42) * 1_000 + 90_000);
    expect(state.sessionHistory.filter((entry) => entry.id === state.session?.id)).toHaveLength(0); // no second session
    expect(second.errors()).toEqual([]);
  });

  it('the default adapters fall back to memory storage and "always visible"', () => {
    const sim = createSim({ clock: createManualClock(START) });
    expect(sim.isReady()).toBe(true);
    sim.start();
    expect(sim.isRunning()).toBe(true);
    sim.stop();
    expect(sim.errors()).toEqual([]);
  });
});

describe('static scan of src/sim', () => {
  const files = readdirSync(SIM_DIR).filter((name) => name.endsWith('.ts'));
  const source = (name: string) =>
    readFileSync(`${SIM_DIR}${name}`, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:\\])\/\/.*$/gm, '$1');

  it('scans every simulator file', () => {
    expect(files.length).toBeGreaterThanOrEqual(28);
    expect(files).toEqual(expect.arrayContaining(['engine.ts', 'session-machine.ts', 'audio.ts', 'api.ts', 'platform.ts']));
  });

  it('only platform.ts names web globals or globalThis (positive control: it does)', () => {
    const webGlobal = /\b(document|window|sessionStorage|localStorage|navigator)\b|globalThis/;
    expect(webGlobal.test(source('platform.ts'))).toBe(true);
    const offenders = files.filter((name) => name !== 'platform.ts' && webGlobal.test(source(name)));
    expect(offenders).toEqual([]);
  });

  it('nothing is nondeterministic: no Math.random, crypto, randomUUID or performance; Date.now only in clock.ts', () => {
    const random = /Math\.random|randomUUID|\bcrypto\b|performance\./;
    expect(files.filter((name) => random.test(source(name)))).toEqual([]);
    expect(files.filter((name) => name !== 'clock.ts' && /\bDate\.now\b/.test(source(name)))).toEqual([]);
    // Bare timer calls only in the platform adapters (types.ts only declares the adapter shape).
    const timer = /(^|[^.\w])set(Timeout|Interval)\s*\(/m;
    expect(files.filter((name) => !['platform.ts', 'types.ts'].includes(name) && timer.test(source(name)))).toEqual([]);
  });

  it('only react.ts imports React, and nothing imports node:, react-native or expo', () => {
    const imports = (name: string) => [...source(name).matchAll(/from '([^']+)'/g)].map((match) => match[1] ?? '');
    for (const name of files) {
      const list = imports(name);
      if (name !== 'react.ts') expect(list.filter((spec) => spec === 'react' || spec.startsWith('react/'))).toEqual([]);
      expect(list.filter((spec) => spec.startsWith('node:') || spec.startsWith('react-native') || spec.startsWith('expo'))).toEqual([]);
    }
  });
});
