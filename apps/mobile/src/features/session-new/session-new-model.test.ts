// Start Session rules (step 78; 04_mobile_specs §4.4, §1.3, §3.7): the step the screen shows, the
// §5.3 gate phases, Next enablement, stepper statuses, the form defaults and SIM-GAP-1's next case
// number. Pure functions over plain values and a real test simulator.
import { describe, expect, it } from '@jest/globals';
import type { SessionState } from '@dems/shared/domain';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, PRECHECK_ORDER, PrecheckCheckId, type PrecheckSlice, type SessionHistoryEntry } from '@dems/shared/sim';
import { createTestSim } from '@/runtime/testing/test-sim';
import {
  arrangementFor,
  canLeaveGate,
  checkMicBinding,
  decodeEvaluation,
  defaultInvestigatorId,
  effectiveStep,
  eligibleInvestigators,
  encodeEvaluation,
  filterInvestigators,
  formSessionGone,
  gatePhase,
  hasDeviceColumn,
  isWizardState,
  lastProfileValues,
  micRoleLine,
  newestHistoryEntry,
  precheckTone,
  resolvedCount,
  stepperOrientation,
  stepperStatuses,
  valueKey,
} from './session-new-model';
import { caseSeqOf, nextCaseNumber, nextCaseSeq } from './sim-adapter';
import { Camera, Mic } from 'lucide-react-native';
import { CheckIcon } from './check-icon';

const slice = (outcome: PrecheckSlice['outcome'], startedAt: number | null = 1): PrecheckSlice => ({
  items: [],
  startedAt,
  completedAt: null,
  outcome,
  warningsAcknowledged: false,
});

describe('effectiveStep: the simulator state wins over ?step= (§3.7)', () => {
  it.each([
    [null, 3, 1],
    ['SEALED', 2, 1],
    ['CREATE', 3, 1],
    ['PRECHECK', 1, 2],
    ['PRECHECK', 3, 2],
    ['ARMED', 1, 3],
    ['ARMED', 3, 3],
    ['ARMED', 2, 2],
  ] as [SessionState | null, number, number][])('state %s with ?step=%s shows step %s', (state, requested, shown) => {
    expect(effectiveStep(state, requested)).toBe(shown);
  });

  it('owns CREATE, PRECHECK and ARMED only', () => {
    expect(['CREATE', 'PRECHECK', 'ARMED'].every((s) => isWizardState(s as never))).toBe(true);
    expect([null, 'RECORDING', 'SEALED', 'FAULT'].some((s) => isWizardState(s as never))).toBe(false);
  });
});

describe('the §5.3 gate', () => {
  it('maps the precheck slice to a phase', () => {
    expect(gatePhase(null)).toBe('idle');
    expect(gatePhase(slice(null, null))).toBe('idle');
    expect(gatePhase(slice(null))).toBe('running');
    expect(gatePhase(slice('PASS'))).toBe('pass');
    expect(gatePhase(slice('WARN'))).toBe('warn');
    expect(gatePhase(slice('BLOCK'))).toBe('block');
  });

  it('lets Next leave only on PASS, on an acknowledged WARN, or once ARMED (G8 policy)', () => {
    expect(canLeaveGate('running', true, 'PRECHECK')).toBe(false);
    expect(canLeaveGate('block', true, 'PRECHECK')).toBe(false);
    expect(canLeaveGate('warn', false, 'PRECHECK')).toBe(false);
    expect(canLeaveGate('warn', true, 'PRECHECK')).toBe(true);
    expect(canLeaveGate('pass', false, 'ARMED')).toBe(true);
    expect(canLeaveGate('warn', false, 'ARMED')).toBe(true);
  });

  it('counts resolved checks and picks chip tones', () => {
    const items = [
      { id: 'CORE', status: 'PASS' },
      { id: 'LENS_1', status: 'WARN' },
      { id: 'LENS_2', status: 'BLOCK' },
      { id: 'MIC_1', status: 'RUNNING' },
      { id: 'MIC_2', status: 'PENDING' },
    ] as PrecheckSlice['items'];
    expect(resolvedCount(items)).toBe(3);
    expect(['PASS', 'WARN', 'BLOCK', 'RUNNING'].map((s) => precheckTone(s as never))).toEqual(['success', 'warning', 'danger', 'default']);
  });

  it('names each check value with a shared enum key', () => {
    expect(valueKey('CORE', 'OFFLINE')).toBe('common.enums.coreLinkState.OFFLINE');
    expect(valueKey('LENS_2', 'FAULT')).toBe('common.enums.lensState.FAULT');
    expect(valueKey('MIC_1', 'NO_SIGNAL')).toBe('common.enums.micState.NO_SIGNAL');
    expect(valueKey('STORAGE', 'FULL')).toBe('common.enums.storageState.FULL');
    expect(valueKey('TIME', 'RTC')).toBe('common.enums.timeSource.RTC');
    expect(valueKey('SECURITY', 'FAULT')).toBe('common.enums.securityState.FAULT');
  });

  // Audit M3-04 R2 (register C6; D53 twelve checks): cameras 3/4 read the lens words, mic channels 3/4 the
  // microphone words - before the fix the `default` branch gave MIC_3/MIC_4 the lens words.
  it('cameras 3/4 read the lens words and mic channels 3/4 the microphone words (M3-04 R2, C6)', () => {
    expect(valueKey('MIC_3', 'READY')).toBe('common.enums.micState.READY');
    expect(valueKey('MIC_4', 'NO_SIGNAL')).toBe('common.enums.micState.NO_SIGNAL');
    expect(valueKey('LENS_3', 'FAULT')).toBe('common.enums.lensState.FAULT');
    expect(valueKey('LENS_4', 'READY')).toBe('common.enums.lensState.READY');
  });

  it('round-trips the flat live-evaluation encoding (F74-13)', () => {
    expect(decodeEvaluation(encodeEvaluation('BLOCK', 'FULL'))).toEqual({ status: 'BLOCK', value: 'FULL' });
    expect(decodeEvaluation('nonsense')).toEqual({ status: 'PASS', value: '' });
  });
});

describe('stepper statuses (C-4)', () => {
  it('follows the step and the gate', () => {
    expect(stepperStatuses(1, 'idle', null)).toEqual(['active', 'pending', 'pending']);
    expect(stepperStatuses(2, 'running', 'PRECHECK')).toEqual(['done', 'running', 'pending']);
    expect(stepperStatuses(2, 'block', 'PRECHECK')).toEqual(['done', 'error', 'pending']);
    expect(stepperStatuses(2, 'warn', 'PRECHECK')).toEqual(['done', 'warn', 'pending']);
    expect(stepperStatuses(2, 'warn', 'ARMED')).toEqual(['done', 'active', 'pending']);
    expect(stepperStatuses(2, 'pass', 'ARMED')).toEqual(['done', 'active', 'pending']);
    expect(stepperStatuses(3, 'pass', 'ARMED')).toEqual(['done', 'done', 'active']);
  });
});

describe('layouts (§2.4 Start Session row)', () => {
  it('maps classes to arrangements, stepper orientation and the device column', () => {
    expect(arrangementFor('compact')).toBe('phone');
    expect(arrangementFor('compact-landscape')).toBe('phone-landscape');
    expect(arrangementFor('medium')).toBe('tablet-portrait');
    expect(arrangementFor('expanded')).toBe('tablet-landscape');
    expect(stepperOrientation('phone')).toBe('horizontal');
    expect(stepperOrientation('phone-landscape')).toBe('horizontal');
    expect(stepperOrientation('tablet-portrait')).toBe('vertical');
    expect(hasDeviceColumn('tablet-landscape')).toBe(true);
    expect(hasDeviceColumn('tablet-portrait')).toBe(false);
  });
});

describe('step 1 defaults', () => {
  it('offers only operators who may start sessions (no TECHNICIAN)', () => {
    expect(eligibleInvestigators(OPERATORS).map((o) => o.role)).toEqual(['INVESTIGATOR', 'SUPERVISOR']);
  });

  it('defaults the investigator to the signed-in operator, else the first eligible one', () => {
    expect(defaultInvestigatorId(OPERATORS, 'OPR-002')).toBe('OPR-002');
    expect(defaultInvestigatorId(OPERATORS, 'OPR-003')).toBe('OPR-001'); // Rina is a technician
    expect(defaultInvestigatorId(OPERATORS, null)).toBe('OPR-001');
    expect(defaultInvestigatorId([], 'OPR-001')).toBe('');
  });

  it('filters investigators by name or id', () => {
    const eligible = eligibleInvestigators(OPERATORS);
    expect(filterInvestigators(eligible, 'andi').map((o) => o.id)).toEqual(['OPR-002']);
    expect(filterInvestigators(eligible, 'opr-001').map((o) => o.id)).toEqual(['OPR-001']);
    expect(filterInvestigators(eligible, '  ')).toHaveLength(2);
  });

  it('copies case, investigator, room and profile from the newest session ("Start with last profile")', () => {
    const { sim } = createTestSim();
    const newest = newestHistoryEntry(sim.store.getState().sessionHistory) as SessionHistoryEntry;
    expect(newest).not.toBeNull();
    const values = lastProfileValues(newest, OPERATORS);
    expect(values).toEqual({ caseNumber: newest.caseNumber, investigatorId: newest.investigatorId, room: newest.room, profileId: newest.profileId });
    const byTechnician = lastProfileValues({ ...newest, investigatorId: 'OPR-003' }, OPERATORS);
    expect(byTechnician.investigatorId).toBe('OPR-001');
  });
});

describe('SIM-GAP-1: the next synthetic case number (local sim-adapter)', () => {
  it('reads the sequence from a case number', () => {
    expect(caseSeqOf('LP/2026/1001-0007')).toBe(7);
    expect(caseSeqOf('LP/123/2025')).toBe(0);
    expect(caseSeqOf(null)).toBe(0);
  });

  it('is LP/{YYYY}/{MMDD}-0008 on the canonical dataset (04 §4.4), on the simulator day (WIB)', () => {
    const { sim } = createTestSim();
    expect(nextCaseSeq(sim.store.getState())).toBe(8);
    expect(nextCaseNumber(sim.store.getState())).toBe('LP/2026/1001-0008');
  });

  it('never repeats a case number an open session already uses', () => {
    const { sim } = createTestSim();
    const operator = OPERATORS[0]!;
    expect(sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    const result = sim.actions.createSession({
      caseNumber: nextCaseNumber(sim.store.getState()),
      subjectType: 'SAKSI',
      subjectName: 'Test Subject',
      investigatorId: operator.id,
      room: 'Interview Room 1',
      profileId: 'STANDARD_1080P25',
    });
    expect(result.ok).toBe(true);
    expect(nextCaseNumber(sim.store.getState())).toBe('LP/2026/1001-0009');
  });
});

// Fix wave M (G70d-03): when the session a form belongs to is gone.
describe('formSessionGone: the wizard followed a session that is no longer in setup and did not move on', () => {
  it.each([
    ['SES-1', null, null, true], // cancelled: no session
    ['SES-1', 'SES-2', 'SES-2', true], // cancelled, and another client opened a new one
    ['SES-1', null, 'SES-1', false], // CONTROL: the same session started recording
    ['SES-1', 'SES-1', 'SES-1', false], // CONTROL: still in setup
    [null, 'SES-1', 'SES-1', false], // CONTROL: the form just created its session
    [null, null, null, false],
  ] as [string | null, string | null, string | null, boolean][])('owned %s, followed %s, current %s -> %s', (owned, followed, current, gone) => {
    expect(formSessionGone(owned, followed, current)).toBe(gone);
  });
});

// Audit M3-04 R1/R3 (G-1, P0; register C5; D53): the twelve-check pre-check names LENS_3/4 and MIC_3/4. A check
// row whose icon is undefined crashes the screen ("Element type is invalid"), so every id of the vocabulary needs one.
describe('the twelve-check pre-check: icons and microphone channels (M3-04, G-1)', () => {
  it('CheckIcon has an element type for every PrecheckCheckId (all 14), cameras 3/4 a camera and channels 3/4 a mic', () => {
    const ids = Object.values(PrecheckCheckId);
    expect(ids).toHaveLength(14);
    for (const id of ids) {
      const element = CheckIcon({ id, tone: 'default' });
      expect({ id, defined: element.type !== undefined && element.type !== null }).toEqual({ id, defined: true });
    }
    expect(CheckIcon({ id: 'LENS_3', tone: 'default' }).type).toBe(Camera);
    expect(CheckIcon({ id: 'LENS_4', tone: 'default' }).type).toBe(Camera);
    expect(CheckIcon({ id: 'MIC_3', tone: 'default' }).type).toBe(Mic);
    expect(CheckIcon({ id: 'MIC_4', tone: 'default' }).type).toBe(Mic);
    for (const id of PRECHECK_ORDER) expect(CheckIcon({ id, tone: 'success' }).type).toBeDefined();
  });

  it('MIC_3 / MIC_4 are bound by CHANNEL to MIC-03 / MIC-04 (M3-04 R3; D61)', () => {
    const line = micRoleLine({ session: null, captureConfig: { mics: [{ inputId: 'MIC-01', channel: 'MIC-01' }, { inputId: 'MIC-02', channel: 'MIC-02' }, { inputId: 'MIC-03', channel: 'MIC-03' }, { inputId: 'MIC-04', channel: 'MIC-04' }] } });
    expect(checkMicBinding('MIC_3', line)).toEqual({ inputId: 'MIC-03', channel: 'MIC-03' });
    expect(checkMicBinding('MIC_4', line)).toEqual({ inputId: 'MIC-04', channel: 'MIC-04' });
    // A selector that moved input MIC-01 onto channel 3: the channel-3 check names that input.
    const moved = 'MIC-03:MIC-01|MIC-02:MIC-02|MIC-01:MIC-03|MIC-04:MIC-04';
    expect(checkMicBinding('MIC_3', moved)).toEqual({ inputId: 'MIC-01', channel: 'MIC-03' });
    // CONTROL: the cameras carry no microphone binding.
    expect(checkMicBinding('LENS_3', line)).toBeNull();
    expect(checkMicBinding('LENS_4', line)).toBeNull();
  });
});
