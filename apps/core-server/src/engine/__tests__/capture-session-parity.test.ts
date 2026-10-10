// Integration pass D10, item 1: the capture transitions exist TWICE until the engine re-exports the
// shared ones - `../capture-session.ts` (the Core runs them in capture mode `real`) and
// `@dems/shared/sim` `capture-session.ts` (the simulator decides its own start with them). This file
// holds the two equal: the same state in, the same state out, for every transition and every kind
// of input, with ONE known difference that is asserted, not ignored.
//
// THE DIFFERENCE: when the failed start itself makes the raise of the capture fault, the shared
// copy hands `reason` / `evidenceFiles: 0` to the shared raise (pass D6 item 14), so the
// FAULT_RAISED audit row carries the two keys; the engine's copy gives them to the alert only.
// When the capture side raised first (the usual order on the Core) the two are equal throughout.
import { describe, expect, it } from 'vitest';
import {
  captureConnectingTransition as sharedConnecting,
  captureDurableOfSessionTransition as sharedDurable,
  clearCaptureFaultsTransition as sharedClear,
  createManualClock,
  createSim,
  failedCaptureStartTransition as sharedFailedStart,
  interruptedCaptureTransition as sharedInterrupted,
  raiseCaptureWarningTransition,
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

  it.each([null, 'NO_CAMERA_CONNECTED', 'WORKER_START_FAILED', 'not a code'])('failed start with cause %s: identical, except the two keys on the audit row of a raise it makes itself', (cause) => {
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
    // CONTROL of the comparison and the known difference: the transition made the raise itself.
    const connecting = all['connecting'] as SimState;
    const reason = cause !== null && /^[A-Z][A-Z0-9_]{1,63}$/.test(cause) ? cause : FAILED_START_REASON_UNKNOWN;
    const rowOf = (state: SimState) => state.audit.rows.filter((row) => row.type === 'FAULT_RAISED').at(-1)?.details ?? {};
    expect(rowOf(sharedFailedStart(connecting, NOW, SESSION(connecting), cause))).toMatchObject({ reason, evidenceFiles: 0 });
    expect(rowOf(failedCaptureStartTransition(connecting, NOW, SESSION(connecting), cause))).not.toHaveProperty('reason');
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
});
