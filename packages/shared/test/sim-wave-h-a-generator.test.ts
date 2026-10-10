// Fix wave H, driver A, finding G75-01 (gate 75; rulings D197, D199): where the capture is the
// Core's own (`CreateSimOptions.capture: 'external'`) NO simulator generator writes an integrity,
// hash, write-verified, timestamp-confirmed or auto-save row or fact. Those rows come from the
// capture / sealing side or do not exist. The simulator's own capture keeps its demo stream.
//
// Every claim has its control: the SAME run in `'simulated'` capture holds the rows.
import { describe, expect, it } from 'vitest';
import { captureFactsOf, createManualClock, createSim, type SessionCreateInput, type SimState } from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);
const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };
/** The rows and timeline kinds only a simulator generator writes. */
const INVENTED_AUDIT = ['FRAME_HASH', 'WRITE_VERIFIED', 'TIMESTAMP_CONFIRMED'];
const INVENTED_EVENTS = ['AUTOSAVE', 'STORAGE_WRITE_VERIFIED', 'TIME_SYNC'];
const INVENTED_TIMELINE = ['AUTOSAVE', 'CHECK', 'HEALTH'];

function recorded(capture: 'simulated' | 'external') {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, capture });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  const state = (): SimState => sim.store.getState();
  const run = (ms: number, step = 250): void => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  // The seed holds rows of the demo history: what THIS run writes is told by the row IDs.
  const seed = state();
  // Idle first: the idle stream of the generator runs here.
  run(10 * 60_000, 1_000);
  const idle = state();
  sim.actions.createSession(INPUT);
  sim.actions.beginPrecheck();
  run(5_000, 50);
  expect(state().session?.state).toBe('ARMED');
  sim.actions.startRecording();
  const sessionId = state().session?.id ?? '';
  // Six minutes of recording: the simulated stream writes about 45 arrivals in that time.
  run(6 * 60_000);
  const seedEvents = new Set(seed.events.map((row) => row.id));
  const seedAudit = new Set(seed.audit.rows.map((row) => row.id));
  const newEvents = (at: SimState): string[] => at.events.filter((row) => !seedEvents.has(row.id)).map((row) => row.type);
  const newAudit = (at: SimState): string[] => at.audit.rows.filter((row) => !seedAudit.has(row.id)).map((row) => row.type);
  return { idle, recording: state(), sessionId, newEvents, newAudit };
}

const auditTypes = (state: SimState, sessionId: string | null): string[] => state.audit.rows.filter((row) => sessionId === null || row.sessionId === sessionId).map((row) => row.type);
const count = (values: readonly string[], wanted: readonly string[]): number => values.filter((value) => wanted.includes(value)).length;

describe('G75-01: no invented integrity stream where the capture is the Core\'s own', () => {
  it('external capture: a recording session holds no FRAME_HASH / WRITE_VERIFIED / TIMESTAMP_CONFIRMED row, no AUTOSAVE event, no AUTOSAVE / CHECK / HEALTH timeline item, and the storage slice states no verified write', () => {
    const h = recorded('external');
    expect(h.recording.session?.state).toBe('RECORDING');
    expect(count(h.newAudit(h.recording), INVENTED_AUDIT)).toBe(0);
    expect(count(h.newEvents(h.recording), INVENTED_EVENTS)).toBe(0);
    expect(count((h.recording.session?.timeline ?? []).map((item) => item.kind), INVENTED_TIMELINE)).toBe(0);
    expect(h.recording.storage.lastWriteVerifiedAt).toBe(h.idle.storage.lastWriteVerifiedAt);
    // The rows of the session that ARE acts of an operator or of the machine stay.
    expect(auditTypes(h.recording, h.sessionId)).toContain('RECORDING_STARTED');
  });

  it('external capture: the idle stream states no storage integrity check and no time synchronisation', () => {
    const h = recorded('external');
    expect(count(h.newEvents(h.idle), ['STORAGE_WRITE_VERIFIED', 'TIME_SYNC'])).toBe(0);
    // Pin moved by closing pass Z1 (ruling D203 (4)): the health-check event is not written either.
    expect(h.newEvents(h.idle)).not.toContain('HEALTH_CHECK_OK');
  });

  it('CONTROL - simulated capture keeps its demo stream: the same run holds every one of those rows', () => {
    const h = recorded('simulated');
    const session = auditTypes(h.recording, h.sessionId);
    for (const type of INVENTED_AUDIT) expect(session, type).toContain(type);
    expect(h.newEvents(h.recording)).toContain('AUTOSAVE');
    const kinds = (h.recording.session?.timeline ?? []).map((item) => item.kind);
    for (const kind of INVENTED_TIMELINE) expect(kinds, kind).toContain(kind);
    expect(h.recording.storage.lastWriteVerifiedAt).not.toBe(h.idle.storage.lastWriteVerifiedAt);
    expect(count(h.newEvents(h.idle), ['STORAGE_WRITE_VERIFIED', 'TIME_SYNC'])).toBeGreaterThan(0);
  });
});

describe('the capture facts a session surface may state', () => {
  it('a session without the member is the simulator\'s own capture: no capture facts', () => {
    expect(captureFactsOf(null)).toBeNull();
    expect(captureFactsOf({ state: 'RECORDING' })).toBeNull();
  });

  it('a session that carries the member states the capture state and, sealed, that it was encrypted at the seal - never before', () => {
    expect(captureFactsOf({ state: 'RECORDING', captureDurable: false })).toEqual({ capture: 'CONNECTING', protection: 'AT_SEAL' });
    expect(captureFactsOf({ state: 'RECORDING', captureDurable: true })).toEqual({ capture: 'DURABLE', protection: 'AT_SEAL' });
    expect(captureFactsOf({ state: 'FINALIZING', captureDurable: true })).toEqual({ capture: 'ENDED', protection: 'AT_SEAL' });
    expect(captureFactsOf({ state: 'FAULT', captureDurable: false })).toEqual({ capture: 'NOTHING_RECORDED', protection: 'NOTHING_RECORDED' });
    expect(captureFactsOf({ state: 'SEALED', captureDurable: true })).toEqual({ capture: 'ENDED', protection: 'SEALED' });
  });
});
