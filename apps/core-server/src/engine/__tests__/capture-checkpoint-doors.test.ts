// The capture-checkpoint transition of the engine host (task 3 wave H, closing pass Z1; driver A
// decision 3): pure, on a state of the shared simulator. The door through a booted Core with the
// fake worker: `src/capture-session/__tests__/session-capture.db.test.ts`, describe "Z1".
import { createManualClock, createSim, hostClockTimeTransition, type SimState } from '@dems/shared/sim';
import { SessionSliceSchema, TimeSliceSchema } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { applyCaptureCheckpointsTransition, captureCheckpointsOf, type CaptureCheckpointFacts } from '../capture-checkpoint-doors';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);

/** A RECORDING session; `own` = it carries the capture member, as a recording of the Core's own capture does. */
function recording(own: boolean): SimState {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, capture: own ? 'external' : 'simulated' });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  sim.actions.createSession({ caseNumber: 'LP/2026/1001-0010', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' });
  sim.actions.beginPrecheck();
  for (let elapsed = 0; elapsed < 6_000; elapsed += 50) {
    clock.advance(50);
    sim.tick();
  }
  sim.actions.startRecording();
  // The simulator's own connecting second ends: the member goes (a durable recording of the simulator's capture carries none).
  for (let elapsed = 0; elapsed < 2_000; elapsed += 50) {
    clock.advance(50);
    sim.tick();
  }
  const state = sim.store.getState();
  if (state.session?.state !== 'RECORDING') throw new Error(`the bed is not recording: ${state.session?.state}`);
  // The Core's capture session writes the member in the unit of the start; the bed says it here.
  return own ? { ...state, session: { ...state.session, captureDurable: true } } : state;
}

const FACTS: CaptureCheckpointFacts = { lastAt: START + 20_000, cameras: [{ deviceId: 'CAM-02', fragments: 3, bytes: 3_000 }, { deviceId: 'CAM-01', fragments: 4, bytes: 4_096 }] };

describe('applyCaptureCheckpointsTransition', () => {
  it('puts the figures on the open session of the Core\'s own capture: totals, the newest instant, by camera in a fixed order; the slice still parses; nothing else moved', () => {
    const state = recording(true);
    const id = state.session?.id ?? '';
    const next = applyCaptureCheckpointsTransition(state, id, FACTS);
    expect(next.session?.captureCheckpoints).toEqual({
      fragments: 7,
      bytes: 7_096,
      lastAt: START + 20_000,
      cameras: [{ deviceId: 'CAM-01', fragments: 4, bytes: 4_096 }, { deviceId: 'CAM-02', fragments: 3, bytes: 3_000 }],
    });
    expect(SessionSliceSchema.safeParse(next.session).success).toBe(true);
    expect(next.audit).toBe(state.audit);
    expect(next.events).toBe(state.events);
    expect({ ...next.session, captureCheckpoints: undefined }).toEqual({ ...state.session, captureCheckpoints: undefined });
  });

  it('the same figures again return the SAME state (no statement, no revision)', () => {
    const state = recording(true);
    const id = state.session?.id ?? '';
    const once = applyCaptureCheckpointsTransition(state, id, FACTS);
    expect(applyCaptureCheckpointsTransition(once, id, FACTS)).toBe(once);
  });

  it('CONTROL - a recording of the simulator\'s capture is told nothing: it carries no capture member', () => {
    const state = recording(false);
    expect(state.session).not.toHaveProperty('captureDurable');
    expect(applyCaptureCheckpointsTransition(state, state.session?.id ?? '', FACTS)).toBe(state);
  });

  it('refuses another session, figures that are no counts, an empty list, and figures that go backwards', () => {
    const state = recording(true);
    const id = state.session?.id ?? '';
    expect(applyCaptureCheckpointsTransition(state, 'SES-20261001-9999', FACTS)).toBe(state);
    expect(applyCaptureCheckpointsTransition(state, id, { lastAt: START, cameras: [{ deviceId: 'CAM-01', fragments: 1.5, bytes: 10 }] })).toBe(state);
    expect(applyCaptureCheckpointsTransition(state, id, { lastAt: START, cameras: [{ deviceId: 'CAM-01', fragments: 1, bytes: -1 }] })).toBe(state);
    expect(applyCaptureCheckpointsTransition(state, id, { lastAt: START, cameras: [] })).toBe(state);
    expect(applyCaptureCheckpointsTransition(state, id, { lastAt: START, cameras: [{ deviceId: 'CAM-01', fragments: 1, bytes: 1 }, { deviceId: 'CAM-01', fragments: 2, bytes: 2 }] })).toBe(state);
    const once = applyCaptureCheckpointsTransition(state, id, FACTS);
    expect(applyCaptureCheckpointsTransition(once, id, { lastAt: START + 30_000, cameras: [{ deviceId: 'CAM-01', fragments: 2, bytes: 2_048 }] })).toBe(once);
    expect(applyCaptureCheckpointsTransition(once, id, { ...FACTS, lastAt: START + 10_000 })).toBe(once);
  });

  it('a camera without a checkpoint is not listed with a 0', () => {
    expect(captureCheckpointsOf({ lastAt: 5, cameras: [{ deviceId: 'CAM-01', fragments: 2, bytes: 9 }, { deviceId: 'CAM-02', fragments: 0, bytes: 0 }] })).toEqual({ fragments: 2, bytes: 9, lastAt: 5, cameras: [{ deviceId: 'CAM-01', fragments: 2, bytes: 9 }] });
    expect(captureCheckpointsOf({ lastAt: 5, cameras: [{ deviceId: 'CAM-02', fragments: 0, bytes: 0 }] })).toBeNull();
  });
});

describe('the host-clock time slice (Z1 item 1) is a slice of the contract', () => {
  it('parses, and says host clock', () => {
    const state = hostClockTimeTransition(createSim({ storage: null, authStorage: null }).store.getState());
    expect(TimeSliceSchema.safeParse(state.time).success).toBe(true);
    expect(state.time).toMatchObject({ hostClock: true, source: 'RTC', locked: false });
    expect(hostClockTimeTransition(state)).toBe(state);
  });
});
