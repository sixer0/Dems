// Step 54 (review 40 §5.b, M1; m9; D96, m5): every single-argument selector is shallow-stable on one
// state (so `useSim(select…)` never loops); the system status survives the 10 Hz clock and the 1 Hz
// health tick unchanged; 1 Hz selectors exist for the timer and the lockout; RECORDING never hides
// a warning; the SECURE pill checklist always agrees with the ring.
import { describe, expect, it } from 'vitest';
import { shallow } from 'zustand/shallow';
import * as Sim from '../src/sim';
import {
  createManualClock,
  createSim,
  INTEGRITY_CHECKLIST_IDS,
  selectElapsedSeconds,
  selectIntegrityChecklist,
  selectLockoutSeconds,
  selectSystemFlagIds,
  selectSystemSeverity,
  selectSystemState,
  selectSystemStateValue,
  SYSTEM_FLAG_IDS,
  systemStatus,
  type ScenarioName,
  type SimState,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 10:00 WIB

function harness(scenario: ScenarioName = 'idle') {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario });
  const run = (ms: number, step = 50) => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  return { sim, clock, run, state: () => sim.store.getState() };
}

/** Every exported `select*` function that takes the state alone. */
const SELECTORS: [string, (state: SimState) => unknown][] = (Object.entries(Sim) as [string, unknown][])
  .filter(([name, value]) => name.startsWith('select') && typeof value === 'function' && (value as (...args: unknown[]) => unknown).length === 1)
  .map(([name, value]) => [name, value as (state: SimState) => unknown]);

describe('every single-argument selector is shallow-stable (review 40 §5.b item 4)', () => {
  it('found the selectors (sanity)', () => {
    expect(SELECTORS.length).toBeGreaterThan(40);
    expect(SELECTORS.map(([name]) => name)).toEqual(expect.arrayContaining(['selectSystemState', 'selectIntegrityChecklist', 'selectFrontPanel']));
  });

  it.each(['idle', 'recording', 'fault-demo'] as const)('%s: sel(s) and sel(s) compare shallow-equal', (scenario) => {
    const h = harness(scenario);
    h.run(2_000);
    const state = h.state();
    const unstable = SELECTORS.filter(([, select]) => !shallow(select(state), select(state))).map(([name]) => name);
    expect(unstable).toEqual([]);
  });
});

describe('selectSystemState is referentially stable (M1)', () => {
  it('a clock or audio tick returns the same object', () => {
    const h = harness('recording');
    h.run(1_000);
    const before = selectSystemState(h.state());
    h.run(150); // 10 Hz clock and 20 Hz audio, no 1 Hz step
    expect(selectSystemState(h.state())).toBe(before);
  });

  it('the 1 Hz health tick (new time, health and storage objects) returns the same object while the status is equal', () => {
    const h = harness('idle');
    h.run(500);
    const before = selectSystemState(h.state());
    const timeBefore = h.state().time;
    h.run(3_000);
    expect(h.state().time).not.toBe(timeBefore);
    expect(selectSystemState(h.state())).toBe(before);
    expect(selectSystemFlagIds(h.state())).toBe(selectSystemFlagIds(h.state()));
  });

  it('a real change returns a new status, flag IDs and checklist', () => {
    const h = harness('idle');
    const before = selectSystemState(h.state());
    h.sim.actions.inject('FAN_STALL');
    const after = selectSystemState(h.state());
    expect(after).not.toBe(before);
    expect(selectSystemFlagIds(h.state())).toEqual(['FAN_STALL']);
    expect(selectSystemStateValue(h.state())).toBe('ATTENTION');
  });

  it('flags carry structured params and only finite IDs (consumers never parse message)', () => {
    const h = harness('fault-demo');
    const flags = selectSystemState(h.state()).flags;
    for (const flag of flags) expect(SYSTEM_FLAG_IDS).toContain(flag.id);
    expect(flags.find((flag) => flag.id === 'CAMERA_VIDEO-02')?.params).toMatchObject({ track: 'VIDEO-02' });
    expect(flags.find((flag) => flag.id === 'MIC_AUDIO-02_CLIP')?.params).toMatchObject({ track: 'AUDIO-02' });
    expect(flags.find((flag) => flag.id === 'TIME_FALLBACK')?.params).toEqual({ source: 'NTP' });
  });
});

describe('RECORDING never hides a warning (D96) and the checklist agrees with the ring (m5)', () => {
  it('recording + MIC clip: ring RECORDING, severity WARNING, inputs row ATTENTION', () => {
    const h = harness('recording');
    expect(selectSystemSeverity(h.state())).toBe('OK');
    h.sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-02' });
    const status = selectSystemState(h.state());
    expect(status.state).toBe('RECORDING');
    expect(status.severity).toBe('WARNING');
    const row = (id: string) => selectIntegrityChecklist(h.state())[INTEGRITY_CHECKLIST_IDS.indexOf(id as never)];
    expect(row('inputs')).toBe('ATTENTION');
  });

  it('recording + fan stall: severity WARNING, platform row ATTENTION', () => {
    const h = harness('recording');
    h.sim.actions.inject('FAN_STALL');
    expect(selectSystemState(h.state())).toMatchObject({ state: 'RECORDING', severity: 'WARNING' });
    expect(selectIntegrityChecklist(h.state())[INTEGRITY_CHECKLIST_IDS.indexOf('platform')]).toBe('ATTENTION');
  });

  it('POWER_FAIL at idle: ring CRITICAL and the recording row CRITICAL (no all-OK checklist)', () => {
    const h = harness('idle');
    h.sim.actions.inject('POWER_FAIL');
    expect(selectSystemState(h.state())).toMatchObject({ state: 'CRITICAL', severity: 'CRITICAL' });
    const checklist = selectIntegrityChecklist(h.state());
    expect(checklist[INTEGRITY_CHECKLIST_IDS.indexOf('recording')]).toBe('CRITICAL');
  });

  it.each([
    'CAMERA_LOSS',
    'MIC_NO_SIGNAL',
    'MIC_CLIP',
    'STORAGE_LOW',
    'STORAGE_FULL',
    'GNSS_LOSS',
    'TAMPER',
    'FAN_STALL',
    'POWER_FAIL',
    'TPM_FAILURE',
    'SECURITY_FAULT',
    'AUDIT_TAMPER',
  ] as const)('%s: the checklist severity matches the ring severity', (kind) => {
    const h = harness('idle');
    h.sim.actions.inject(kind);
    const status = systemStatus(h.state());
    const checklist = selectIntegrityChecklist(h.state());
    const worst = checklist.includes('CRITICAL') ? 'CRITICAL' : checklist.includes('ATTENTION') ? 'WARNING' : 'OK';
    expect(worst).toBe(status.severity);
  });
});

describe('1 Hz selectors for clocks (review 40 m9; §9.3)', () => {
  it('selectElapsedSeconds changes once per second while selectElapsedMs changes at 10 Hz', () => {
    const h = harness('recording');
    const seconds = new Set<number>();
    const millis = new Set<number>();
    for (let index = 0; index < 20; index += 1) {
      h.run(100, 100);
      seconds.add(selectElapsedSeconds(h.state()));
      millis.add(Sim.selectElapsedMs(h.state()));
    }
    expect(seconds.size).toBeLessThanOrEqual(3);
    expect(millis.size).toBeGreaterThanOrEqual(19);
  });

  it('selectLockoutSeconds counts the 60 s lockout down in whole seconds', () => {
    const h = harness('idle');
    for (let attempt = 0; attempt < 5; attempt += 1) h.sim.actions.signIn('budi.santoso', 'wrong');
    expect(selectLockoutSeconds(h.state())).toBe(60);
    h.run(10_400, 100);
    expect(selectLockoutSeconds(h.state())).toBe(50);
    h.run(50_000, 100);
    expect(selectLockoutSeconds(h.state())).toBe(0);
  });
});
