// Determinism (AC-51; D19, D28/Q7): two runs with { seed: 20261001, scenario: 'recording' } over
// 600 ticks are deep-equal (events, audit rows, chain head, the whole snapshot, audio frames).
// The same holds for a scripted live flow. A different seed gives a different stream.
import { describe, expect, it } from 'vitest';
import {
  buildScenarioState,
  canonicalJSON,
  createIdleState,
  createManualClock,
  createSim,
  DEFAULT_SEED,
  ENGINE_INTERVAL_MS,
  toSnapshot,
  type AudioFrame,
  type ScenarioName,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 10:00 WIB

function runTicks(options: { seed?: number; scenario?: ScenarioName }, ticks: number) {
  const clock = createManualClock(START);
  const sim = createSim({ ...options, clock, storage: null, authStorage: null });
  const frames: AudioFrame[] = [];
  sim.store.subscribe(
    (state) => state.audio.inputs['MIC-02']!,
    (frame) => frames.push(frame),
  );
  for (let i = 0; i < ticks; i += 1) {
    clock.advance(ENGINE_INTERVAL_MS);
    sim.tick();
  }
  return { state: sim.store.getState(), frames, errors: sim.errors() };
}

describe('AC-51: identical runs', () => {
  it("two runs of { seed: 20261001, scenario: 'recording' } over 600 ticks are deep-equal", () => {
    const a = runTicks({ seed: DEFAULT_SEED, scenario: 'recording' }, 600);
    const b = runTicks({ seed: DEFAULT_SEED, scenario: 'recording' }, 600);
    expect(a.errors).toEqual([]);
    expect(b.state.events).toEqual(a.state.events);
    expect(b.state.audit).toEqual(a.state.audit);
    expect(b.state.audit.head).toBe(a.state.audit.head);
    expect(canonicalJSON(toSnapshot(b.state))).toBe(canonicalJSON(toSnapshot(a.state)));
    expect(b.frames).toEqual(a.frames);
    // …and the runs actually did something in those 30 s of sim time.
    const initial = createSim({ scenario: 'recording', clock: createManualClock(START), storage: null, authStorage: null }).store.getState();
    expect(a.state.audit.total).toBeGreaterThan(initial.audit.total);
    expect(a.state.health.series.length).toBeGreaterThanOrEqual(30);
    expect(a.frames.length).toBeGreaterThanOrEqual(600);
    expect(a.state.session?.state).toBe('RECORDING');
  });

  it.each(['idle', 'finalizing', 'fault-demo'] as const)('the %s scenario is deterministic too', (scenario) => {
    const a = runTicks({ scenario }, 300);
    const b = runTicks({ scenario }, 300);
    expect(canonicalJSON(toSnapshot(b.state))).toBe(canonicalJSON(toSnapshot(a.state)));
    expect(b.frames).toEqual(a.frames);
  });

  it('a scenario built twice for the same instant is identical', () => {
    const base = () => createIdleState({ now: START, seed: DEFAULT_SEED });
    for (const name of ['recording', 'finalizing', 'fault-demo'] as const) {
      expect(canonicalJSON(buildScenarioState(name, base()))).toBe(canonicalJSON(buildScenarioState(name, base())));
    }
  });

  it('a scripted live flow (sign-in → create → precheck → record → seal) is identical across runs', () => {
    const script = () => {
      const clock = createManualClock(START);
      const sim = createSim({ clock, storage: null, authStorage: null });
      const run = (ms: number) => {
        for (let t = 0; t < ms; t += ENGINE_INTERVAL_MS) {
          clock.advance(ENGINE_INTERVAL_MS);
          sim.tick();
        }
      };
      sim.actions.signIn('budi.santoso', 'demo-2026');
      sim.actions.createSession({
        caseNumber: 'LP/2026/1001-0008',
        subjectType: 'SAKSI',
        subjectName: 'Determinism Saksi',
        investigatorId: 'OPR-001',
        room: 'Interview Room 1',
        profileId: 'STANDARD_1080P25',
      });
      sim.actions.beginPrecheck();
      run(5_000);
      sim.actions.startRecording();
      run(40_000);
      sim.actions.addMarker('Key statement');
      sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-02' });
      run(5_000);
      sim.actions.stopRecording('Interview completed');
      run(12_000);
      return sim.store.getState();
    };
    const a = script();
    const b = script();
    expect(a.session?.state).toBe('SEALED');
    expect(canonicalJSON(toSnapshot(b))).toBe(canonicalJSON(toSnapshot(a)));
    expect(b.session?.precheck.items.map((item) => item.resolvesAt)).toEqual(a.session?.precheck.items.map((item) => item.resolvesAt));
  });
});

describe('seeds', () => {
  it('another seed gives another stream (chain head, audio)', () => {
    const a = runTicks({ seed: DEFAULT_SEED, scenario: 'recording' }, 200);
    const b = runTicks({ seed: 7, scenario: 'recording' }, 200);
    expect(b.state.audit.head).not.toBe(a.state.audit.head);
    expect(b.frames.map((frame) => frame.dbfs)).not.toEqual(a.frames.map((frame) => frame.dbfs));
  });

  it('the dataset itself does not depend on the seed (one canonical dataset, D28/Q7)', () => {
    const a = createIdleState({ now: START, seed: DEFAULT_SEED });
    const b = createIdleState({ now: START, seed: 7 });
    expect(b.evidence).toEqual(a.evidence);
    expect(b.audit.head).toBe(a.audit.head);
  });
});
