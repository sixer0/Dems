// E-fix FX-C (backend task 2026-10-04, decisions D198, D200, D201 ruling R1; E2E-W1-1, E2E-T-3,
// E2E-T-5). The sealed chain of custody names the operator who STARTED and the one who STOPPED
// the recording, as the session's own audit rows do; before the fix both entries named the
// session's creator (`session-machine.ts:840-841` at 057fc17). A note's timeline item names its
// author's role.
// D54 (a): every sim here uses storage: null and authStorage: null.
import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n';
import {
  createManualClock,
  createSim,
  DEMO_OPERATOR_PASSWORD,
  noteLabel,
  recordingActor,
  timelineTitleKey,
  type ActiveSession,
  type SessionCreateInput,
  type SimState,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 2026-10-01 10:00 WIB
const INVESTIGATOR = 'budi.santoso'; // OPR-001
const SUPERVISOR = 'andi.pratama'; // OPR-002

const INPUT: SessionCreateInput = {
  caseNumber: 'LP/2026/1001-0008',
  subjectType: 'SAKSI',
  subjectName: 'Test Saksi',
  investigatorId: 'OPR-001',
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
};

function harness() {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null });
  const state = (): SimState => sim.store.getState();
  const run = (ms: number, step = 50) => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  const signInAs = (username: string) => {
    if (state().auth.status === 'SIGNED_IN') sim.actions.signOut();
    sim.actions.signIn(username, DEMO_OPERATOR_PASSWORD);
  };
  const toArmed = () => {
    sim.actions.createSession(INPUT);
    sim.actions.beginPrecheck();
    run(5_000);
    expect(state().session?.state).toBe('ARMED');
  };
  const auditActor = (type: string) => state().audit.rows.filter((row) => row.type === type).at(-1)?.actorId;
  const lastEvidence = () => state().evidence.at(-1);
  const custodyActor = (action: string) => lastEvidence()?.custody.find((entry) => entry.action === action)?.actorId;
  return { sim, clock, state, run, signInAs, toArmed, auditActor, lastEvidence, custodyActor };
}

describe('E2E-W1-1 / E2E-T-3: the custody names who started and who stopped (ruling R1)', () => {
  it('an INVESTIGATOR starts, a SUPERVISOR stops: RECORDING_STOPPED names the SUPERVISOR, as the audit row does', () => {
    const h = harness();
    h.signInAs(INVESTIGATOR);
    h.toArmed();
    h.sim.actions.startRecording();
    h.run(10_000);
    h.signInAs(SUPERVISOR);
    h.sim.actions.stopRecording('Supervisor ended the interview');
    h.run(12_000);
    expect(h.state().session?.state).toBe('SEALED');
    expect(h.lastEvidence()?.status).toBe('SEALED');

    expect(h.state().session?.createdBy).toBe('OPR-001');
    expect(h.custodyActor('RECORDING_STARTED')).toBe('OPR-001');
    expect(h.custodyActor('RECORDING_STOPPED')).toBe('OPR-002');
    expect(h.custodyActor('SEALED')).toBeNull();
    // The two server records agree (E2E-T-3: "The two server records disagree on the actor").
    expect(h.custodyActor('RECORDING_STARTED')).toBe(h.auditActor('RECORDING_STARTED'));
    expect(h.custodyActor('RECORDING_STOPPED')).toBe(h.auditActor('RECORDING_STOPPED'));
    // The session's replicated shape is unchanged: no new member (the Core stores it as columns).
    expect(Object.keys(h.state().session ?? {})).not.toContain('stoppedBy');
  });

  it('a SUPERVISOR starts a session an INVESTIGATOR created: RECORDING_STARTED names the SUPERVISOR', () => {
    const h = harness();
    h.signInAs(INVESTIGATOR);
    h.toArmed();
    h.signInAs(SUPERVISOR);
    h.sim.actions.startRecording();
    h.run(5_000);
    h.sim.actions.stopRecording('Interview completed');
    h.run(12_000);
    expect(h.custodyActor('RECORDING_STARTED')).toBe('OPR-002');
    expect(h.custodyActor('RECORDING_STOPPED')).toBe('OPR-002');
    expect(h.auditActor('SESSION_CREATED')).toBe('OPR-001');
  });

  it('one operator throughout: both entries name that operator (no change for the usual session)', () => {
    const h = harness();
    h.signInAs(INVESTIGATOR);
    h.toArmed();
    h.sim.actions.startRecording();
    h.run(3_000);
    h.sim.actions.stopRecording('Interview completed');
    h.run(12_000);
    expect(h.custodyActor('RECORDING_STARTED')).toBe('OPR-001');
    expect(h.custodyActor('RECORDING_STOPPED')).toBe('OPR-001');
  });

  it('recordingActor reads the session\'s own audit row, newest first; the creator stands in only when the row left the ring', () => {
    const h = harness();
    h.signInAs(INVESTIGATOR);
    h.toArmed();
    h.signInAs(SUPERVISOR);
    h.sim.actions.startRecording();
    h.run(3_000);
    h.sim.actions.stopRecording('Supervisor ended the interview');
    const state = h.state();
    const session = state.session as ActiveSession;
    expect(recordingActor(state, session, 'START')).toBe('OPR-002');
    expect(recordingActor(state, session, 'STOP')).toBe('OPR-002');
    // The ring dropped the session's rows (more than 1,000 newer rows): the creator, as before the fix.
    const evicted: Pick<SimState, 'audit'> = {
      audit: { ...state.audit, rows: state.audit.rows.filter((row) => row.sessionId !== session.id) },
    };
    expect(recordingActor(evicted, session, 'START')).toBe('OPR-001');
    expect(recordingActor(evicted, session, 'STOP')).toBe('OPR-001');
    // Another session's rows are never taken.
    const otherSession: ActiveSession = { ...session, id: 'SES-20261001-0099' };
    expect(recordingActor(state, otherSession, 'STOP')).toBe('OPR-001');
    // A row without an actor (the system) is followed as it is.
    const systemRow: Pick<SimState, 'audit'> = {
      audit: {
        ...state.audit,
        rows: state.audit.rows.map((row) => (row.type === 'RECORDING_STOPPED' && row.sessionId === session.id ? { ...row, actorId: null } : row)),
      },
    };
    expect(recordingActor(systemRow, session, 'STOP')).toBeNull();
  });

  it('a recording interrupted by a fault: the INCOMPLETE item names who started it; SESSION_INCOMPLETE follows its audit row (no actor)', () => {
    const h = harness();
    h.signInAs(INVESTIGATOR);
    h.toArmed();
    h.signInAs(SUPERVISOR);
    h.sim.actions.startRecording();
    h.run(4_000);
    h.sim.actions.inject('POWER_FAIL');
    expect(h.state().session?.state).toBe('FAULT');
    h.sim.actions.recover();
    h.run(5_000);
    const item = h.lastEvidence();
    expect(item?.status).toBe('RECORDED');
    expect(item?.custody.find((entry) => entry.action === 'RECORDING_STARTED')?.actorId).toBe('OPR-002');
    expect(item?.custody.find((entry) => entry.action === 'SESSION_INCOMPLETE')?.actorId).toBeNull();
    expect(h.auditActor('SESSION_INCOMPLETE')).toBeNull();
  });
});

describe('E2E-T-5: a note is labelled by its author\'s role', () => {
  it('a SUPERVISOR\'s note: "Supervisor note", params.authorRole SUPERVISOR, titled "Supervisor Note Added"', () => {
    const h = harness();
    h.signInAs(INVESTIGATOR);
    h.toArmed();
    h.sim.actions.startRecording();
    h.sim.actions.addNote('Investigator background note');
    h.signInAs(SUPERVISOR);
    h.sim.actions.addNote('Supervisor note E2E-T: confirm subject ID before questioning');
    const notes = h.state().session?.timeline.filter((item) => item.kind === 'NOTE') ?? [];
    expect(notes.map((item) => item.label)).toEqual(['Investigator note', 'Supervisor note']);
    expect(notes.map((item) => item.params?.authorRole)).toEqual(['INVESTIGATOR', 'SUPERVISOR']);
    expect(notes.map((item) => timelineTitleKey(item))).toEqual(['session.timeline.noteBy.INVESTIGATOR', 'session.timeline.noteBy.SUPERVISOR']);
    expect(en.session.timeline.noteBy.SUPERVISOR).toBe('Supervisor Note Added');
    expect(en.session.timeline.noteBy.INVESTIGATOR).toBe('Investigator Note Added');
    // The note record keeps its author.
    expect(h.state().session?.notes.map((note) => note.authorId)).toEqual(['OPR-001', 'OPR-002']);
    // The audit row and the event say whose note it was in their English fallback.
    const rows = h.state().audit.rows.filter((row) => row.type === 'NOTE_ADDED');
    expect(rows.map((row) => [row.actorId, row.message])).toEqual([
      ['OPR-001', 'Investigator note added'],
      ['OPR-002', 'Supervisor note added'],
    ]);
  });

  it('an item without the role (written before the fix) is titled neutrally; other kinds keep their kind title', () => {
    expect(timelineTitleKey({ kind: 'NOTE', params: { noteId: 'NOTE-000001', length: 12 } })).toBe('session.timeline.kind.NOTE');
    expect(timelineTitleKey({ kind: 'NOTE' })).toBe('session.timeline.kind.NOTE');
    expect(timelineTitleKey({ kind: 'NOTE', params: { authorRole: 'ADMIN' } })).toBe('session.timeline.kind.NOTE');
    expect(timelineTitleKey({ kind: 'MARKER', params: { authorRole: 'SUPERVISOR' } })).toBe('session.timeline.kind.MARKER');
    expect(en.session.timeline.kind.NOTE).toBe('Note Added');
    // The type labels of the audit log and the event feed are neutral too.
    expect(en.common.auditType.NOTE_ADDED).toBe('Note added');
    expect(en.common.eventType.NOTE_ADDED).toBe('Note added');
  });

  it('noteLabel names each role and falls back to "Note"', () => {
    expect([noteLabel('SUPERVISOR'), noteLabel('INVESTIGATOR'), noteLabel('TECHNICIAN'), noteLabel(null)]).toEqual([
      'Supervisor note',
      'Investigator note',
      'Technician note',
      'Note',
    ]);
  });
});
