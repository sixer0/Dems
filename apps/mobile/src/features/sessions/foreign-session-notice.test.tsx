// Fix wave J round two, ruling (d) (JM-09): "a session set up by another operator" - whose it is and what this
// operator can do, one sentence in both layouts. A new module: its own test file.
import { afterEach, describe, expect, it } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, OperatorRole } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { RuntimeTestProviders, createTestSim } from '@/runtime/testing/test-sim';
import { ForeignSessionNotice, foreignSessionOf } from './foreign-session-notice';

afterEach(() => resetMissingKeys());

const of = (role: OperatorRole) => OPERATORS.find((operator) => operator.role === role)!;
const INVESTIGATOR = of(OperatorRole.INVESTIGATOR);
const SUPERVISOR = of(OperatorRole.SUPERVISOR);
const TECHNICIAN = of(OperatorRole.TECHNICIAN);

describe('foreignSessionOf: the rule', () => {
  it('the operator\'s own session, nobody signed in, or no creator known: no notice', () => {
    expect(foreignSessionOf({ operatorId: 'OPR-001', role: OperatorRole.INVESTIGATOR, createdBy: 'OPR-001' })).toBeNull();
    expect(foreignSessionOf({ operatorId: null, role: null, createdBy: 'OPR-001' })).toBeNull();
    expect(foreignSessionOf({ operatorId: 'OPR-002', role: OperatorRole.SUPERVISOR, createdBy: null })).toBeNull();
  });

  it('another operator\'s session: a role that holds SESSION_START can act; one that does not can do nothing', () => {
    expect(foreignSessionOf({ operatorId: 'OPR-002', role: OperatorRole.SUPERVISOR, createdBy: 'OPR-001' })).toBe('ACT');
    expect(foreignSessionOf({ operatorId: 'OPR-009', role: OperatorRole.INVESTIGATOR, createdBy: 'OPR-001' })).toBe('ACT');
    expect(foreignSessionOf({ operatorId: 'OPR-003', role: OperatorRole.TECHNICIAN, createdBy: 'OPR-001' })).toBe('NOTHING');
  });
});

describe('ForeignSessionNotice: one sentence', () => {
  function mount(username: string, surface: 'setup' | 'summary', createdBy: string | null) {
    const test = createTestSim();
    expect(test.sim.actions.signIn(username, DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    render(
      <RuntimeTestProviders sim={test.sim}>
        <ForeignSessionNotice surface={surface} createdBy={createdBy} />
      </RuntimeTestProviders>,
    );
    return test;
  }
  const sentence = () => String(screen.getByTestId('foreign-session-notice-sentence').props.children);

  it('a supervisor on the investigator\'s unacknowledged Summary: whose it is, and "acknowledge it with Done"', async () => {
    mount(SUPERVISOR.username, 'summary', INVESTIGATOR.id);
    await act(async () => undefined);
    expect(sentence()).toBe(`This session was recorded by ${INVESTIGATOR.displayName} (${INVESTIGATOR.id}), not by you. You can read its summary and acknowledge it with Done.`);
    expect(getMissingKeys()).toEqual([]);
  });

  it('a supervisor on the investigator\'s open setup: "continue it or cancel it"', async () => {
    mount(SUPERVISOR.username, 'setup', INVESTIGATOR.id);
    await act(async () => undefined);
    expect(sentence()).toBe(`This session was set up by ${INVESTIGATOR.displayName} (${INVESTIGATOR.id}), not by you. You can continue it or cancel it.`);
  });

  it('a technician: the role cannot act on it - go to Home', async () => {
    mount(TECHNICIAN.username, 'summary', INVESTIGATOR.id);
    await act(async () => undefined);
    expect(sentence()).toBe(`This session belongs to ${INVESTIGATOR.displayName} (${INVESTIGATOR.id}). Your role (Technician) cannot act on it: go to Home.`);
  });

  it('CONTROL - the operator\'s own session draws nothing', async () => {
    mount(INVESTIGATOR.username, 'summary', INVESTIGATOR.id);
    await act(async () => undefined);
    expect(screen.queryByTestId('foreign-session-notice')).toBeNull();
  });
});
