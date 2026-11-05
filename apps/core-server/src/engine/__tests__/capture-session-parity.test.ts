// The capture transitions of the engine and of the shared simulator. Until fix pass F-M5 they existed
// TWICE and this file held the two copies equal on the same inputs, with one asserted difference
// (the engine's failed start gave `reason` / `evidenceFiles` to the alert only). Review R74-10: five
// of six pairs were compared and the sixth, the switch, had drifted. Now:
//   - the five transitions ARE the shared ones (the engine file re-exports them): held by identity,
//     and still run on every kind of input so that a copy that comes back is seen;
//   - the SIXTH pair, the switch (op 81), is retired on both sides: the shared action refuses it
//     (row 150) and the engine's switch door is removed (row W3T, D136);
//   - D84 R-3 in the failed start, and the rehydrate of a failed start in simulated capture.
import { describe, expect, it } from 'vitest';
import { AUDIO_SOURCE_FIXED_BY_PAIRING_MESSAGE } from '@dems/shared/api';
import {
  captureConnectingTransition as sharedConnecting,
  captureDurableOfSessionTransition as sharedDurable,
  clearCaptureFaultsTransition as sharedClear,
  createManualClock,
  createSim,
  failedCaptureStartTransition as sharedFailedStart,
  interruptedCaptureTransition as sharedInterrupted,
  raiseCaptureWarningTransition,
  switchAudioSourceTransition as sharedSwitch,
  SimErrorCode,
  CAPTURE_FAULT_KINDS as SHARED_KINDS,
  FAILED_START_REASON_UNKNOWN as SHARED_UNKNOWN,
  type CaptureWarningInput,
  type SessionCreateInput,
  type SimState,
} from '@dems/shared/sim';
import {
  CAPTURE_FAULT_KINDS,
  FAILED_START_REASON_UNKNOWN,
  captureConnectingTransition,
  captureDurableOfSessionTransition,
  clearCaptureFaultsTransition,
  failedCaptureStartTransition,
  failedStartAtRehydrateTransition,
  interruptedCaptureTransition,
} from '../capture-session';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);
const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };
const NOW = START + 60_000;

/** A session as the Core in capture mode `real` holds it: the simulator's start wrote no member. */
function states(): Record<string, SimState> {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, capture: 'external' });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  sim.actions.createSession(INPUT);
  sim.actions.beginPrecheck();
  for (let elapsed = 0; elapsed < 5_000; elapsed += 50) {
    clock.advance(50);
    sim.tick();
  }
  const armed = sim.store.getState();
  sim.actions.startRecording();
  clock.advance(2_000);
  sim.tick();
  const recording = sim.store.getState();
  const session = recording.session;
  if (session === null || armed.session === null) throw new Error('no session');
  const connecting: SimState = { ...recording, session: { ...session, captureDurable: false } };
  const durable: SimState = { ...recording, session: { ...session, captureDurable: true } };
  // The usual order on the Core: the forwarder raised the fault, with its facts, before the unit of the failed start.
  const raisedFirst = raiseCaptureWarningTransition(connecting, NOW - 10, { code: 'CAPTURE_FAULT', subject: null, reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 } as CaptureWarningInput);
  const micSilent = raiseCaptureWarningTransition(durable, NOW - 10, { code: 'MIC_SILENT', subject: null });
  return { armed, recording, connecting, durable, raisedFirst, micSilent };
}

const SESSION = (state: SimState): string => state.session?.id ?? '';
const OTHER = 'SES-20990101-0001';

/** The state without the audit chain's hashes and without the two keys of the known difference. */
function comparable(state: SimState): unknown {
  return {
    ...state,
    audit: {
      ...state.audit,
      // The head is the hash of the newest row: it follows the two keys.
      head: null,
      rows: state.audit.rows.map((row) => {
        const { reason: _reason, evidenceFiles: _files, ...details } = (row.type === 'FAULT_RAISED' ? (row.details ?? {}) : {}) as Record<string, unknown>;
        const rest = Object.fromEntries(Object.entries(row).filter(([key]) => !/hash/i.test(key)));
        return row.type === 'FAULT_RAISED' ? { ...rest, details } : rest;
      }),
    },
  };
}

describe('the capture transitions of the engine and of the shared simulator are one rule', () => {
  it('the five transitions of the engine ARE the shared ones: one function each, not a copy', () => {
    expect(captureConnectingTransition).toBe(sharedConnecting);
    expect(captureDurableOfSessionTransition).toBe(sharedDurable);
    expect(failedCaptureStartTransition).toBe(sharedFailedStart);
    expect(interruptedCaptureTransition).toBe(sharedInterrupted);
    expect(clearCaptureFaultsTransition).toBe(sharedClear);
  });

  it('the constants agree', () => {
    expect([...SHARED_KINDS]).toEqual([...CAPTURE_FAULT_KINDS]);
    expect(SHARED_UNKNOWN).toBe(FAILED_START_REASON_UNKNOWN);
  });

  it.each(['armed', 'recording', 'connecting', 'durable', 'raisedFirst', 'micSilent'])('connecting, durable, interrupted, clear: identical on a %s state', (name) => {
    const state = states()[name] as SimState;
    for (const id of [SESSION(state), OTHER]) {
      expect(sharedConnecting(state, id), `connecting ${id}`).toEqual(captureConnectingTransition(state, id));
      expect(sharedDurable(state, id), `durable ${id}`).toEqual(captureDurableOfSessionTransition(state, id));
      expect(sharedInterrupted(state, NOW, id), `interrupted ${id}`).toEqual(interruptedCaptureTransition(state, NOW, id));
    }
    expect(sharedClear(state, NOW)).toEqual(clearCaptureFaultsTransition(state, NOW));
    // "Nothing changed" is the SAME object in both.
    expect(sharedConnecting(state, OTHER)).toBe(state);
    expect(captureConnectingTransition(state, OTHER)).toBe(state);
  });

  it.each([null, 'NO_CAMERA_CONNECTED', 'WORKER_START_FAILED', 'not a code'])('failed start with cause %s: identical, the two keys on the alert and on the audit row of a raise it makes itself', (cause) => {
    const all = states();
    for (const name of ['armed', 'recording', 'connecting', 'durable', 'raisedFirst'] as const) {
      const state = all[name] as SimState;
      const shared = sharedFailedStart(state, NOW, SESSION(state), cause);
      const engine = failedCaptureStartTransition(state, NOW, SESSION(state), cause);
      expect(comparable(shared), name).toEqual(comparable(engine));
      // Not connecting (no member, durable, not recording): both leave the state alone.
      if (name !== 'connecting' && name !== 'raisedFirst') {
        expect(shared, name).toBe(state);
        expect(engine, name).toBe(state);
      }
    }
    // The fault was raised first: the two are equal to the last byte (hashes included).
    expect(sharedFailedStart(all['raisedFirst'] as SimState, NOW, SESSION(all['raisedFirst'] as SimState), cause)).toEqual(
      failedCaptureStartTransition(all['raisedFirst'] as SimState, NOW, SESSION(all['raisedFirst'] as SimState), cause),
    );
    // The transition made the raise itself: BOTH hand the two keys to the audit row (the difference of the two copies is gone).
    const connecting = all['connecting'] as SimState;
    const reason = cause !== null && /^[A-Z][A-Z0-9_]{1,63}$/.test(cause) ? cause : FAILED_START_REASON_UNKNOWN;
    const rowOf = (state: SimState) => state.audit.rows.filter((row) => row.type === 'FAULT_RAISED').at(-1)?.details ?? {};
    expect(rowOf(sharedFailedStart(connecting, NOW, SESSION(connecting), cause))).toMatchObject({ reason, evidenceFiles: 0 });
    expect(rowOf(failedCaptureStartTransition(connecting, NOW, SESSION(connecting), cause))).toMatchObject({ reason, evidenceFiles: 0 });
    // And the words of the alert are those of the reason, in both (review R74-03).
    expect(failedCaptureStartTransition(connecting, NOW, SESSION(connecting), cause).alerts.at(-1)?.message).toBe(sharedFailedStart(connecting, NOW, SESSION(connecting), cause).alerts.at(-1)?.message);
    // Both give the alert the two keys.
    for (const result of [sharedFailedStart(connecting, NOW, SESSION(connecting), cause), failedCaptureStartTransition(connecting, NOW, SESSION(connecting), cause)]) {
      expect(result.alerts.find((alert) => alert.active && alert.kind === 'CAPTURE_FAULT')?.params).toMatchObject({ reason, evidenceFiles: 0 });
      expect(result.session).toMatchObject({ state: 'FAULT', startedAt: null, bytesWritten: 0, captureDurable: false });
    }
  });

  it('CONTROL: the comparison can fail - a state that differs in one session member is not equal', () => {
    const { connecting } = states();
    const session = (connecting as SimState).session;
    if (session === null) throw new Error('no session');
    const other: SimState = { ...(connecting as SimState), session: { ...session, bytesWritten: session.bytesWritten + 1 } };
    expect(comparable(sharedFailedStart(other, NOW, session.id, null))).toEqual(comparable(failedCaptureStartTransition(other, NOW, session.id, null)));
    expect(comparable(sharedInterrupted(other, NOW, session.id))).not.toEqual(comparable(interruptedCaptureTransition(connecting as SimState, NOW, session.id)));
  });
  // Review R74-01 (D84 R-3): a capture-wide fault another session left is ended by the failed start
  // itself - in BOTH copies, so the simulator's own capture and the Core's engine write the same rows.
  it('a failed start ends the capture-wide fault an EARLIER session left and raises its own: identical, two FAULT_RAISED rows', () => {
    const { connecting } = states();
    const state = connecting as SimState;
    const startedAt = state.session?.startedAt ?? 0;
    // Raised before this session started recording: another session's.
    const stale = raiseCaptureWarningTransition(state, startedAt - 60_000, { code: 'CAPTURE_FAULT', subject: null, reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 } as CaptureWarningInput);
    const staleAlert = stale.alerts.find((alert) => alert.active && alert.kind === 'CAPTURE_FAULT');
    const shared = sharedFailedStart(stale, NOW, SESSION(stale), 'NO_CAMERA_CONNECTED');
    const engine = failedCaptureStartTransition(stale, NOW, SESSION(stale), 'NO_CAMERA_CONNECTED');
    expect(comparable(shared)).toEqual(comparable(engine));
    for (const result of [shared, engine]) {
      const rows = result.audit.rows.slice(stale.audit.rows.length).map((row) => row.type);
      expect(rows).toEqual(['FAULT_CLEARED', 'FAULT_RAISED']);
      const active = result.alerts.filter((alert) => alert.active && alert.kind === 'CAPTURE_FAULT');
      expect(active).toHaveLength(1);
      expect(active[0]?.id).not.toBe(staleAlert?.id);
      expect(active[0]?.at).toBe(NOW);
      expect(result.alerts.find((alert) => alert.id === staleAlert?.id)).toMatchObject({ active: false, resolvedAt: NOW });
    }
    // CONTROL: a fault raised in THIS session (the forwarder's, the usual order) is kept: no second row.
    const { raisedFirst } = states();
    const own = failedCaptureStartTransition(raisedFirst as SimState, NOW, SESSION(raisedFirst as SimState), 'NO_CAMERA_CONNECTED');
    expect(own.audit.rows.slice((raisedFirst as SimState).audit.rows.length).map((row) => row.type)).toEqual([]);
  });

  // Review R74-10: THE SIXTH PAIR. Audit row 150 (D28 DQ-2; N-29, N-36): the simulator's own operation 81 is retired - it
  // REFUSES every input in every state with AUDIO_SOURCE_FIXED_BY_PAIRING and writes nothing. Audit row W3T (D136): the
  // engine's door (`audioSourceSwitchTransition` over the shared `applyAudioSourceSwitch`) lost its last caller with row
  // 149 and is removed, so there is no engine switch left to hold equal.
  it.each(['MIC-02', 'MIC-01', 'MIC-09'])('switch to %s: the shared op 81 refuses (pairing code, contract sentence, nothing written)', (inputId) => {
    const all = states();
    for (const name of ['armed', 'recording', 'durable'] as const) {
      const state = all[name] as SimState;
      expect(() => sharedSwitch(state, NOW, inputId as Parameters<typeof sharedSwitch>[2]), `${name} ${inputId}`).toThrow(
        expect.objectContaining({ code: SimErrorCode.AUDIO_SOURCE_FIXED_BY_PAIRING, event: 'switchAudioSource', message: AUDIO_SOURCE_FIXED_BY_PAIRING_MESSAGE }),
      );
    }
  });
  // Review R74-14 (1): a Core in SIMULATED capture stores no `captureDurable`. After a restart a failed
  // start that is still open read as durable, and both clients presented a recovery of evidence.
  it('rehydrate in simulated capture: an open session faulted from RECORDING with no start instant is a failed start again; every other session is left alone', () => {
    const { connecting, durable, recording, armed } = states();
    const failed = sharedFailedStart(connecting as SimState, NOW, SESSION(connecting as SimState), 'NO_CAMERA_CONNECTED');
    const session = failed.session;
    if (session === null) throw new Error('no session');
    // As the Core stores it: the member is not a column.
    const { captureDurable: _dropped, ...stored } = session;
    const restarted: SimState = { ...failed, session: stored };
    expect(failedStartAtRehydrateTransition(restarted).session).toMatchObject({ state: 'FAULT', captureDurable: false, startedAt: null });
    // The Core is closing it (RECOVERY): the same.
    const closing: SimState = { ...restarted, session: { ...stored, state: 'RECOVERY' } };
    expect(failedStartAtRehydrateTransition(closing).session?.captureDurable).toBe(false);
    // CONTROLS: an interrupted recording (it has a start instant), a recording, an armed session, no session.
    const interrupted = sharedInterrupted(durable as SimState, NOW, SESSION(durable as SimState));
    const { captureDurable: _kept, ...interruptedStored } = interrupted.session ?? session;
    const interruptedRestarted: SimState = { ...interrupted, session: interruptedStored };
    expect(failedStartAtRehydrateTransition(interruptedRestarted)).toBe(interruptedRestarted);
    for (const state of [recording, armed] as SimState[]) expect(failedStartAtRehydrateTransition(state)).toBe(state);
    const none: SimState = { ...(armed as SimState), session: null };
    expect(failedStartAtRehydrateTransition(none)).toBe(none);
  });
});
