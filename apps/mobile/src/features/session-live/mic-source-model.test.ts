// Task 3 M5, blueprint row 73 (ux spec §3 flow 2; OD-11): the pure reads of the monitor's microphone pair -
// the pair as the Core holds it, the input a silence or no-signal warning names, and the defensive read of
// `captureDurable` (D84, D91).
//
// Audit row 185 (M3-05 R1/R3; D5, D134, D136): op 81 is retired, so the gate of the toggle and the refusal
// classes (`micSwitchGate`, `isSessionHolder`, `sessionStartRoles`, `switchRefusal`, `switchFailureFacts`) were
// removed with it. Their cases (the G4 / G5 order, the holder, the CONFLICT / NOT_RECORDING / NOT_OPEN / OTHER
// classes; I63 §4.4 `mic-source-model.test.ts:64-84`) are replaced by the pin below that none is exported:
// spec M3-05 R3, second branch - no refusal path is left, so no `'FIXED_BY_PAIRING'` class (O7) is added.
import { describe, expect, it } from '@jest/globals';
import { MicInputId } from '@dems/shared/domain';
import type { SimState } from '@dems/shared/sim';
import * as model from './mic-source-model';

const { captureDurableOf, inputOfChannel, micSourceRole, selectActiveInputId, selectConnectingCameras, selectStandbyInputId, noSignalInputOf, silentInputOf } = model;
type MicLine = model.MicLine;

describe('row 185 (M3-05; D136): op 81 is retired - the model offers no switch gate and no refusal class', () => {
  it('none of the switch-era exports is left; the reads the cards and the warnings use are', () => {
    for (const name of ['micSwitchGate', 'isSessionHolder', 'sessionStartRoles', 'switchRefusal', 'switchFailureFacts']) {
      expect(Object.prototype.hasOwnProperty.call(model, name)).toBe(false);
    }
    // CONTROL: the reads that stay are still exported functions.
    for (const name of ['selectActiveInputId', 'selectStandbyInputId', 'micSourceRole', 'silentInputOf', 'noSignalInputOf', 'captureDurableOf']) {
      expect(typeof (model as Readonly<Record<string, unknown>>)[name]).toBe('function');
    }
  });
});

const stateOf = (session: unknown, activeInputId: MicInputId): SimState => ({ session, audio: { activeInputId } }) as unknown as SimState;

/**
 * The microphone lines of the SEEDED selector, as the lookups of task 4 row 164 read them (input and
 * CHANNEL — D61 of 2026-11-04: four simultaneous channels MIC-01..MIC-04, the roles are gone).
 * Since row 170 the model has no default list: a caller states the lines, as every screen does
 * (`micLinesInForce(state)`). The expectations below are the ones of before.
 */
const SEEDED: MicLine[] = [
  { inputId: 'MIC-01', channel: 'MIC-01' },
  { inputId: 'MIC-02', channel: 'MIC-02' },
  { inputId: 'MIC-03', channel: 'MIC-03' },
  { inputId: 'MIC-04', channel: 'MIC-04' },
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
    // D61 (2026-11-04): the pair words belong to the transcription pair alone.
    expect(inputOfChannel('AUDIO-03', SEEDED)).toBe('MIC-03');
    expect(inputOfChannel('AUDIO-04', SEEDED)).toBe('MIC-04');
    expect(micSourceRole(MicInputId.MIC_01, MicInputId.MIC_01, MicInputId.MIC_02)).toBe('ACTIVE');
    expect(micSourceRole(MicInputId.MIC_02, MicInputId.MIC_01, MicInputId.MIC_02)).toBe('STANDBY');
    // D61: channel 3 records beside the pair - neither Active nor Standby.
    expect(micSourceRole('MIC-03', MicInputId.MIC_01, MicInputId.MIC_02)).toBeNull();
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

// Task 4 row 170 (site M4; decision C18 (2); names register section 7, file 16; D61 of 2026-11-04 renumbers the plane): the model finds an input by the
// lookups of row 164 and states "absent" (`null`) for a CHANNEL without a line.
describe('task 4 row 170 (D61): an ABSENT microphone line - no line stands in, no built-in input is answered', () => {
  const fault = (kind: string, target: string | null) => ({ kind, target }) as unknown as SimState['faults']['active'][number];
  const state = (mics: readonly MicLine[], over: Record<string, unknown> = {}): SimState =>
    ({ session: null, audio: { activeInputId: null, inputs: {} }, captureConfig: { cameras: [], mics }, faults: { active: [] }, ...over }) as unknown as SimState;
  const LONE_CHANNEL_2: MicLine[] = [{ inputId: 'MIC-02', channel: 'MIC-02' }];
  const LONE_CHANNEL_1: MicLine[] = [{ inputId: 'MIC-01', channel: 'MIC-01' }];

  it('D61: a meter channel has an input exactly when a line NAMES it - the complete-pair rule of D137 is superseded', () => {
    // No line names channel 3 or 4 in any of these lists: those channels answer null.
    for (const lines of [[], LONE_CHANNEL_1, LONE_CHANNEL_2]) {
      expect(inputOfChannel('AUDIO-03', lines)).toBeNull();
      expect(inputOfChannel('AUDIO-04', lines)).toBeNull();
    }
    // A lone line answers ITS OWN channel (D61); the other channels stay absent.
    expect(inputOfChannel('AUDIO-01', LONE_CHANNEL_1)).toBe('MIC-01');
    expect(inputOfChannel('AUDIO-02', LONE_CHANNEL_1)).toBeNull();
    expect(inputOfChannel('AUDIO-02', LONE_CHANNEL_2)).toBe('MIC-02');
    expect(inputOfChannel('AUDIO-01', LONE_CHANNEL_2)).toBeNull();
    // D61 (2026-11-04): the lookup names the CHANNEL, never the place - reversed order reads the same.
    expect(inputOfChannel('AUDIO-01', [...SEEDED].reverse())).toBe('MIC-01');
    expect(inputOfChannel('AUDIO-02', [...SEEDED].reverse())).toBe('MIC-02');
  });

  it('no microphone line: no active input and no standby - neither MIC-01 nor MIC-02', () => {
    const s = state([]);
    expect(selectActiveInputId(s)).toBeNull();
    expect(selectStandbyInputId(s)).toBeNull();
  });

  it('a lone channel-2 line is the standby and never the active input; a lone channel-1 line has no standby', () => {
    expect(selectActiveInputId(state(LONE_CHANNEL_2))).toBeNull();
    expect(selectStandbyInputId(state(LONE_CHANNEL_2))).toBe('MIC-02');
    expect(selectActiveInputId(state(LONE_CHANNEL_1))).toBe('MIC-01');
    expect(selectStandbyInputId(state(LONE_CHANNEL_1))).toBeNull();
    // The same under an open session that states no pair: read from the selector by channel, nothing stands in.
    const open = state(LONE_CHANNEL_1, { session: { state: 'RECORDING', audioSource: null }, audio: { activeInputId: 'MIC-01', inputs: {} } });
    expect(selectActiveInputId(open)).toBe('MIC-01');
    expect(selectStandbyInputId(open)).toBeNull();
  });

  it('a card says no role for a channel without an input, and no input is "Standby" to an absent active input', () => {
    expect(micSourceRole(null, 'MIC-01', 'MIC-02')).toBeNull();
    expect(micSourceRole('MIC-02', null, null)).toBeNull();
    expect(micSourceRole(null, null, null)).toBeNull();
    // D61: channel 2 has no line here - its card says no role.
    expect(micSourceRole(inputOfChannel('AUDIO-02', LONE_CHANNEL_1), selectActiveInputId(state(LONE_CHANNEL_1)), selectStandbyInputId(state(LONE_CHANNEL_1)))).toBeNull();
  });

  it('a fault on a channel without an input names NO input; a fault that names its input still does; an unreadable target is the active input, which may be absent', () => {
    for (const read of [silentInputOf, noSignalInputOf]) {
      const kind = read === silentInputOf ? 'MIC_SILENT' : 'MIC_NO_SIGNAL';
      expect(read([fault(kind, 'AUDIO-01')], 'MIC-01', [])).toBeNull();
      expect(read([fault(kind, 'AUDIO-02')], 'MIC-01', LONE_CHANNEL_1)).toBeNull();
      expect(read([fault(kind, 'MIC-02')], null, [])).toBe('MIC-02');
      expect(read([fault(kind, null)], null, [])).toBeNull();
      expect(read([fault(kind, null)], 'MIC-01', LONE_CHANNEL_1)).toBe('MIC-01');
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
// the contract's mic id is widened. D61 (2026-11-04): the lines state their CHANNEL.
describe('a microphone beyond the built-in pair (MIC-03)', () => {
  const state = (over: Record<string, unknown>): SimState => ({ session: null, audio: { activeInputId: 'MIC-01' }, captureConfig: { cameras: [], mics: [] }, faults: { active: [] }, ...over }) as unknown as SimState;
  const lines = [
    { inputId: 'MIC-03', deviceId: 'MIC-03', channel: 'MIC-01' },
    { inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-02' },
  ];

  it('the session names the pair: both ids are passed through as sent', () => {
    const s = state({ session: { state: 'RECORDING', audioSource: { activeInputId: 'MIC-03', standbyInputId: 'MIC-01' } } });
    expect(selectActiveInputId(s)).toBe('MIC-03');
    expect(selectStandbyInputId(s)).toBe('MIC-01');
    expect(micSourceRole('MIC-03', selectActiveInputId(s), selectStandbyInputId(s))).toBe('ACTIVE');
    expect(micSourceRole('MIC-01', selectActiveInputId(s), selectStandbyInputId(s))).toBe('STANDBY');
  });

  it('no pair on the session: the standby is the other line of the selector the session records under, then of the stored selector', () => {
    const snapshot = state({ session: { state: 'RECORDING', audioSource: null, captureConfig: { cameras: [], mics: lines } }, audio: { activeInputId: 'MIC-03' } });
    expect(selectStandbyInputId(snapshot)).toBe('MIC-01');
    // Moved by fix 157 (was `'MIC-03'`, "the other line than the meters' MIC-01"): with no open session the pair is the
    // stored selector's own - MIC-03 holds its channel 1 (active), MIC-01 its channel 2 (D61).
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
