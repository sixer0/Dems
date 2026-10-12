// Task 3 M5, blueprint row 73 (ux spec §3 flow 2, G4 / G5; operation 81; specs R-3; OD-09, OD-11): the
// pure rules of the mic switch — the gate and its order, the session holder, the refusal classes, the
// input a silence warning names, and the defensive read of `captureDurable` (D84, D91).
import { describe, expect, it } from '@jest/globals';
import { MicInputId } from '@dems/shared/domain';
import { OperatorRole, SimNotFoundError, SimTransitionError, type SimState } from '@dems/shared/sim';
import {
  captureDurableOf,
  inputOfChannel,
  isSessionHolder,
  micSourceRole,
  micSwitchGate,
  selectActiveInputId,
  selectConnectingCameras,
  selectStandbyInputId,
  sessionStartRoles,
  noSignalInputOf,
  silentInputOf,
  switchFailureFacts,
  switchRefusal,
  type MicLine,
  type MicSwitchGateInput,
} from './mic-source-model';

const ALLOWED: MicSwitchGateInput = { roleKnown: true, linkDown: false, recording: true, canStart: true, holder: true };

describe('G4 / G5: the gate of the mic toggle (ux §3.4; E-16, P-13, OD-09)', () => {
  it('is open only when the role is known, the link is up, a session records, SESSION_START is held and the operator is the holder', () => {
    expect(micSwitchGate(ALLOWED)).toBeNull();
  });

  it('an unknown role is "Checking", never a refusal and never an enable — whatever else is true', () => {
    expect(micSwitchGate({ ...ALLOWED, roleKnown: false })).toEqual({ kind: 'CHECKING' });
    expect(micSwitchGate({ roleKnown: false, linkDown: true, recording: false, canStart: false, holder: false })).toEqual({ kind: 'CHECKING' });
  });

  it('the order of the reasons: checking, the link, the session, the role, the holder', () => {
    const nothing = { roleKnown: true, linkDown: true, recording: false, canStart: false, holder: false };
    expect(micSwitchGate(nothing)).toEqual({ kind: 'WAITING' });
    expect(micSwitchGate({ ...nothing, linkDown: false })).toEqual({ kind: 'NOT_RECORDING' });
    expect(micSwitchGate({ ...nothing, linkDown: false, recording: true })).toEqual({
      kind: 'ROLE',
      roles: [OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR],
    });
    expect(micSwitchGate({ ...nothing, linkDown: false, recording: true, canStart: true })).toEqual({ kind: 'HOLDER' });
  });

  it('the roles the sentence names are the ones that hold SESSION_START', () => {
    expect(sessionStartRoles()).toEqual([OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR]);
  });

  it('the session holder is the operator who opened it, or any SUPERVISOR (OD-09)', () => {
    expect(isSessionHolder({ operatorId: 'OPR-001', role: OperatorRole.INVESTIGATOR, createdBy: 'OPR-001' })).toBe(true);
    expect(isSessionHolder({ operatorId: 'OPR-009', role: OperatorRole.INVESTIGATOR, createdBy: 'OPR-001' })).toBe(false);
    expect(isSessionHolder({ operatorId: 'OPR-002', role: OperatorRole.SUPERVISOR, createdBy: 'OPR-001' })).toBe(true);
    expect(isSessionHolder({ operatorId: 'OPR-003', role: OperatorRole.TECHNICIAN, createdBy: 'OPR-001' })).toBe(false);
    // Nobody signed in and a session without a creator are not "the same nobody".
    expect(isSessionHolder({ operatorId: null, role: null, createdBy: null })).toBe(false);
  });
});

describe('the refusals of operation 81 (ux §3.2 steps 6-7, §3.5)', () => {
  it('classes a Live rejection by its code and status, never by its text', () => {
    expect(switchRefusal({ code: 'AUDIO_SOURCE_CONFLICT', status: 409, message: 'anything' })).toBe('CONFLICT');
    expect(switchRefusal({ code: 'INVALID_STATE', status: 409 })).toBe('NOT_RECORDING');
    expect(switchRefusal({ code: 'NOT_FOUND', status: 404 })).toBe('NOT_OPEN');
    expect(switchRefusal({ status: 404 })).toBe('NOT_OPEN');
    expect(switchRefusal({ code: 'INTERNAL', status: 500 })).toBe('OTHER');
    expect(switchRefusal(new Error('AUDIO_SOURCE_CONFLICT'))).toBe('OTHER');
    expect(switchRefusal(null)).toBe('OTHER');
  });

  it('classes what the simulator throws', () => {
    expect(switchRefusal(new SimTransitionError(null, 'switchAudioSource'))).toBe('NOT_RECORDING');
    expect(switchRefusal(new SimNotFoundError('captureMic', 'MIC-09'))).toBe('NOT_OPEN');
  });

  it('the facts for the runtime log hold the class, the code and the status only', () => {
    expect(switchFailureFacts({ code: 'AUDIO_SOURCE_CONFLICT', status: 409, message: 'secret text', token: 'x' })).toEqual({
      refusal: 'CONFLICT',
      code: 'AUDIO_SOURCE_CONFLICT',
      status: 409,
    });
    expect(switchFailureFacts(new Error('boom'))).toEqual({ refusal: 'OTHER', code: 'none', status: 0 });
  });
});

const stateOf = (session: unknown, activeInputId: MicInputId): SimState => ({ session, audio: { activeInputId } }) as unknown as SimState;

/**
 * The microphone lines of the SEEDED selector, as the lookups of task 4 row 164 read them (input and role).
 * Since row 170 the model has no default list: a caller states the lines, as every screen does
 * (`micLinesInForce(state)`). The expectations below are the ones of before.
 */
const SEEDED: MicLine[] = [
  { inputId: 'MIC-01', role: 'PRIMARY' },
  { inputId: 'MIC-02', role: 'STANDBY' },
];

describe('the pair as the Core holds it', () => {
  it('reads the session\'s pair first, the meters\' member behind it', () => {
    const switched = stateOf({ state: 'RECORDING', audioSource: { activeInputId: 'MIC-02', standbyInputId: 'MIC-01' } }, MicInputId.MIC_01);
    expect(selectActiveInputId(switched)).toBe('MIC-02');
    expect(selectStandbyInputId(switched)).toBe('MIC-01');
    const never = stateOf({ state: 'RECORDING', audioSource: null }, MicInputId.MIC_01);
    expect(selectActiveInputId(never)).toBe('MIC-01');
    // An open session that states no pair, recording under the SEEDED selector: the standby is its STANDBY line, as before.
    expect(selectStandbyInputId({ ...never, captureConfig: { cameras: [], mics: SEEDED } } as unknown as SimState)).toBe('MIC-02');
    // After a switch the holder did not state (the meters say MIC-02 is active): the standby is the PRIMARY line.
    expect(selectStandbyInputId({ ...stateOf({ state: 'RECORDING', audioSource: null }, MicInputId.MIC_02), captureConfig: { cameras: [], mics: SEEDED } } as unknown as SimState)).toBe('MIC-01');
    // MOVED by task 4 row 170 (were `'MIC-02'` and `'MIC-01'`, "the other input of the built-in pair"): these two
    // states hold NO selector at all, so no line holds the standby role - it is absent, never a built-in input.
    expect(selectStandbyInputId(never)).toBeNull();
    expect(selectStandbyInputId(stateOf(null, MicInputId.MIC_02))).toBeNull();
  });

  it('a card\'s word follows the active input; the channels map to their inputs', () => {
    expect(inputOfChannel('AUDIO-01', SEEDED)).toBe('MIC-01');
    expect(inputOfChannel('AUDIO-02', SEEDED)).toBe('MIC-02');
    expect(micSourceRole(MicInputId.MIC_01, MicInputId.MIC_01)).toBe('ACTIVE');
    expect(micSourceRole(MicInputId.MIC_02, MicInputId.MIC_01)).toBe('STANDBY');
  });
});

describe('MIC_SILENT names an input and nothing else (ux §3.2 step 8; OD-11)', () => {
  const fault = (kind: string, target: string | null) => ({ kind, target }) as unknown as SimState['faults']['active'][number];

  it('no warning: null', () => {
    expect(silentInputOf([], MicInputId.MIC_01, SEEDED)).toBeNull();
    expect(silentInputOf([fault('MIC_CLIP', 'AUDIO-01')], MicInputId.MIC_01, SEEDED)).toBeNull();
  });

  it('the target is the input, or the channel of the input; an unreadable target is the active input', () => {
    expect(silentInputOf([fault('MIC_SILENT', 'MIC-02')], MicInputId.MIC_01, SEEDED)).toBe('MIC-02');
    expect(silentInputOf([fault('MIC_SILENT', 'AUDIO-02')], MicInputId.MIC_01, SEEDED)).toBe('MIC-02');
    expect(silentInputOf([fault('MIC_SILENT', 'AUDIO-01')], MicInputId.MIC_02, SEEDED)).toBe('MIC-01');
    expect(silentInputOf([fault('MIC_SILENT', null)], MicInputId.MIC_02, SEEDED)).toBe('MIC-02');
    expect(silentInputOf([fault('MIC_SILENT', 'PRIMARY')], MicInputId.MIC_01, SEEDED)).toBe('MIC-01');
  });
});

// Task 4 row 170 (site M4; decision C18 (2); names register section 7, file 16): the model finds an input by the
// lookups of row 164 and states "absent" (`null`) for a role or a channel without a line.
describe('task 4 row 170: an ABSENT microphone line - no line stands in, no built-in input is answered', () => {
  const fault = (kind: string, target: string | null) => ({ kind, target }) as unknown as SimState['faults']['active'][number];
  const state = (mics: readonly MicLine[], over: Record<string, unknown> = {}): SimState =>
    ({ session: null, audio: { activeInputId: null, inputs: {} }, captureConfig: { cameras: [], mics }, faults: { active: [] }, ...over }) as unknown as SimState;
  const LONE_STANDBY: MicLine[] = [{ inputId: 'MIC-02', role: 'STANDBY' }];
  const LONE_PRIMARY: MicLine[] = [{ inputId: 'MIC-01', role: 'PRIMARY' }];

  it('a meter channel has an input only for a COMPLETE pair: no line and a lone line answer null for both channels', () => {
    for (const lines of [[], LONE_PRIMARY, LONE_STANDBY]) {
      expect(inputOfChannel('AUDIO-01', lines)).toBeNull();
      expect(inputOfChannel('AUDIO-02', lines)).toBeNull();
    }
    // D137 kept for a complete pair, in both role arrangements: the line at the channel's place.
    expect(inputOfChannel('AUDIO-01', [...SEEDED].reverse())).toBe('MIC-02');
    expect(inputOfChannel('AUDIO-02', [...SEEDED].reverse())).toBe('MIC-01');
  });

  it('no microphone line: no active input and no standby - neither MIC-01 nor MIC-02', () => {
    const s = state([]);
    expect(selectActiveInputId(s)).toBeNull();
    expect(selectStandbyInputId(s)).toBeNull();
  });

  it('a lone STANDBY line is the standby and never the active input; a lone PRIMARY line has no standby', () => {
    expect(selectActiveInputId(state(LONE_STANDBY))).toBeNull();
    expect(selectStandbyInputId(state(LONE_STANDBY))).toBe('MIC-02');
    expect(selectActiveInputId(state(LONE_PRIMARY))).toBe('MIC-01');
    expect(selectStandbyInputId(state(LONE_PRIMARY))).toBeNull();
    // The same under an open session that states no pair: read from the selector by role, nothing stands in.
    const open = state(LONE_PRIMARY, { session: { state: 'RECORDING', audioSource: null }, audio: { activeInputId: 'MIC-01', inputs: {} } });
    expect(selectActiveInputId(open)).toBe('MIC-01');
    expect(selectStandbyInputId(open)).toBeNull();
  });

  it('a card says no role for a channel without an input, and no input is "Standby" to an absent active input', () => {
    expect(micSourceRole(null, 'MIC-01')).toBeNull();
    expect(micSourceRole('MIC-02', null)).toBeNull();
    expect(micSourceRole(null, null)).toBeNull();
    expect(micSourceRole(inputOfChannel('AUDIO-01', LONE_PRIMARY), selectActiveInputId(state(LONE_PRIMARY)))).toBeNull();
  });

  it('a fault on a channel without an input names NO input; a fault that names its input still does; an unreadable target is the active input, which may be absent', () => {
    for (const read of [silentInputOf, noSignalInputOf]) {
      const kind = read === silentInputOf ? 'MIC_SILENT' : 'MIC_NO_SIGNAL';
      expect(read([fault(kind, 'AUDIO-01')], 'MIC-01', [])).toBeNull();
      expect(read([fault(kind, 'AUDIO-02')], 'MIC-01', LONE_PRIMARY)).toBeNull();
      expect(read([fault(kind, 'MIC-02')], null, [])).toBe('MIC-02');
      expect(read([fault(kind, null)], null, [])).toBeNull();
      expect(read([fault(kind, null)], 'MIC-01', LONE_PRIMARY)).toBe('MIC-01');
    }
  });
});

describe('"Connecting cameras…": the defensive read of `captureDurable` (D84, D91 R-1 option A)', () => {
  it('only an explicit false means "not durable yet"; a session without the member reads as durable', () => {
    expect(captureDurableOf({ captureDurable: false })).toBe(false);
    expect(captureDurableOf({ captureDurable: true })).toBe(true);
    expect(captureDurableOf({})).toBe(true);
    expect(captureDurableOf({ captureDurable: null })).toBe(true);
    expect(captureDurableOf({ captureDurable: 'false' })).toBe(true);
    expect(captureDurableOf(null)).toBe(true);
    expect(captureDurableOf(undefined)).toBe(true);
  });

  it('connecting is RECORDING and not durable; no other state connects', () => {
    expect(selectConnectingCameras(stateOf({ state: 'RECORDING', captureDurable: false }, MicInputId.MIC_01))).toBe(true);
    expect(selectConnectingCameras(stateOf({ state: 'RECORDING' }, MicInputId.MIC_01))).toBe(false);
    expect(selectConnectingCameras(stateOf({ state: 'ARMED', captureDurable: false }, MicInputId.MIC_01))).toBe(false);
    expect(selectConnectingCameras(stateOf(null, MicInputId.MIC_01))).toBe(false);
  });
});

// Integration pass D2, item 5 (D133 (1)): the pair is read by the ids the Core sends — `MIC-NN` of
// any number — never by the two built-in literals. Plain strings, so this compiles before and after
// the contract's mic id is widened.
describe('a microphone beyond the built-in pair (MIC-03)', () => {
  const state = (over: Record<string, unknown>): SimState => ({ session: null, audio: { activeInputId: 'MIC-01' }, captureConfig: { cameras: [], mics: [] }, faults: { active: [] }, ...over }) as unknown as SimState;
  const lines = [
    { inputId: 'MIC-03', deviceId: 'MIC-03', role: 'PRIMARY' },
    { inputId: 'MIC-01', deviceId: 'MIC-01', role: 'STANDBY' },
  ];

  it('the session names the pair: both ids are passed through as sent', () => {
    const s = state({ session: { state: 'RECORDING', audioSource: { activeInputId: 'MIC-03', standbyInputId: 'MIC-01' } } });
    expect(selectActiveInputId(s)).toBe('MIC-03');
    expect(selectStandbyInputId(s)).toBe('MIC-01');
    expect(micSourceRole('MIC-03', selectActiveInputId(s))).toBe('ACTIVE');
    expect(micSourceRole('MIC-01', selectActiveInputId(s))).toBe('STANDBY');
  });

  it('no pair on the session: the standby is the other line of the selector the session records under, then of the stored selector', () => {
    const snapshot = state({ session: { state: 'RECORDING', audioSource: null, captureConfig: { cameras: [], mics: lines } }, audio: { activeInputId: 'MIC-03' } });
    expect(selectStandbyInputId(snapshot)).toBe('MIC-01');
    // Moved by fix 157 (was `'MIC-03'`, "the other line than the meters' MIC-01"): with no open session the pair is the
    // stored selector's own - MIC-03 is its PRIMARY (active), MIC-01 its STANDBY.
    const stored = state({ audio: { activeInputId: 'MIC-01' }, captureConfig: { cameras: [], mics: lines } });
    expect(selectActiveInputId(stored)).toBe('MIC-03');
    expect(selectStandbyInputId(stored)).toBe('MIC-01');
  });

  it('a silence warning that names MIC-03 is about MIC-03', () => {
    const fault = (target: string | null) => ({ kind: 'MIC_SILENT', target }) as unknown as SimState['faults']['active'][number];
    expect(silentInputOf([fault('MIC-03')], 'MIC-01', lines as MicLine[])).toBe('MIC-03');
    expect(silentInputOf([fault(null)], 'MIC-03', lines as MicLine[])).toBe('MIC-03');
  });
});

// Fix wave J round two (JA2-06).
describe('MIC_NO_SIGNAL names an input (the same target rule as MIC_SILENT)', () => {
  const fault = (kind: string, target: string | null) => ({ kind, target }) as unknown as SimState['faults']['active'][number];
  it('null without the fault; the input, the channel of the input, or the active input', () => {
    expect(noSignalInputOf([], MicInputId.MIC_01, SEEDED)).toBeNull();
    expect(noSignalInputOf([fault('MIC_SILENT', 'MIC-01')], MicInputId.MIC_01, SEEDED)).toBeNull();
    expect(noSignalInputOf([fault('MIC_NO_SIGNAL', 'MIC-02')], MicInputId.MIC_01, SEEDED)).toBe('MIC-02');
    expect(noSignalInputOf([fault('MIC_NO_SIGNAL', 'AUDIO-01')], MicInputId.MIC_02, SEEDED)).toBe('MIC-01');
    expect(noSignalInputOf([fault('MIC_NO_SIGNAL', null)], MicInputId.MIC_02, SEEDED)).toBe('MIC-02');
  });
});
