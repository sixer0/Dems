// The pure parts of operation 70 (plan row W40; spec §7.15, §13.2; SR-82, AC-B-89): whether a
// call acknowledged an alert, and the fields of the log line. No app, no engine, no database.
import { ROLE_PERMISSIONS, acknowledgeAlertTransition, type SimAlert, type SimState } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import type { Principal } from '../../../plugins/authenticate';
import { ACKNOWLEDGE_UNIT_LABEL, ALERT_ACKNOWLEDGED_MESSAGE, acknowledgementLine, becameAcknowledged } from '../acknowledge';

const alert = (id: string, acknowledged: boolean, active = true): SimAlert => ({
  id,
  at: 1_000,
  severity: 'WARNING',
  kind: 'FAN_STALL',
  message: 'Cooling fan stalled',
  active,
  acknowledged,
  resolvedAt: active ? null : 2_000,
  target: null,
});

describe('becameAcknowledged: whether this call acknowledged the alert', () => {
  const open = [alert('ALR-000001', false), alert('ALR-000002', false), alert('ALR-000003', true)];

  it('true when the alert of that ID was not acknowledged before and is acknowledged after', () => {
    const after = [alert('ALR-000001', false), alert('ALR-000002', true), alert('ALR-000003', true)];
    expect(becameAcknowledged(open, after, 'ALR-000002')).toBe(true);
  });

  it('false for an alert that was acknowledged already, for one that still is not, and for an ID no alert has', () => {
    expect(becameAcknowledged(open, open, 'ALR-000003')).toBe(false);
    expect(becameAcknowledged(open, open, 'ALR-000001')).toBe(false);
    expect(becameAcknowledged(open, open, 'ALR-999999')).toBe(false);
    expect(becameAcknowledged([], [], 'ALR-000001')).toBe(false);
  });

  it('false for another alert that became acknowledged in the same lists: only the alert of that ID counts', () => {
    const after = [alert('ALR-000001', true), alert('ALR-000002', false), alert('ALR-000003', true)];
    expect(becameAcknowledged(open, after, 'ALR-000002')).toBe(false);
    expect(becameAcknowledged(open, after, 'ALR-000001')).toBe(true);
  });

  it('an alert that is in the list only afterwards and acknowledged there counts as acknowledged by the call', () => {
    expect(becameAcknowledged([], [alert('ALR-000001', true)], 'ALR-000001')).toBe(true);
    expect(becameAcknowledged([], [alert('ALR-000001', false)], 'ALR-000001')).toBe(false);
  });

  it('agrees with the simulator: true exactly when `acknowledgeAlertTransition` changed the state', () => {
    const state = { alerts: [alert('ALR-000001', false), alert('ALR-000002', true), alert('ALR-000003', false, false)] } as SimState;
    for (const id of ['ALR-000001', 'ALR-000002', 'ALR-000003', 'ALR-000004']) {
      const next = acknowledgeAlertTransition(state, id);
      expect(becameAcknowledged(state.alerts, next.alerts, id), id).toBe(next !== state);
    }
    expect(['ALR-000001', 'ALR-000002', 'ALR-000003', 'ALR-000004'].map((id) => acknowledgeAlertTransition(state, id) !== state)).toEqual([true, false, true, false]);
  });

  it('changes neither list', () => {
    const before = [alert('ALR-000001', false)];
    const after = [alert('ALR-000001', true)];
    const frozen = [Object.freeze(before), Object.freeze(after)] as const;
    expect(becameAcknowledged(frozen[0], frozen[1], 'ALR-000001')).toBe(true);
    expect(before).toEqual([alert('ALR-000001', false)]);
    expect(after).toEqual([alert('ALR-000001', true)]);
  });
});

describe('acknowledgementLine: the fields of the log line (SR-82)', () => {
  const operator: Principal = { kind: 'OPERATOR', operatorId: 'OPR-003', sessionId: 'auth-session-w40', deviceId: 'DEV-0007', role: 'TECHNICIAN', permissions: ROLE_PERMISSIONS.TECHNICIAN };

  it('holds the operator ID and the alert ID, and nothing else of the caller: no session, no device, no role, no permission', () => {
    const line = acknowledgementLine(operator, 'ALR-000012');
    expect(line).toEqual({ operatorId: 'OPR-003', alertId: 'ALR-000012' });
    expect(Object.keys(line)).toEqual(['operatorId', 'alertId']);
    expect(JSON.stringify(line)).not.toMatch(/auth-session-w40|DEV-0007|TECHNICIAN|MAINTENANCE/);
  });

  it('a caller that is no operator has no operator ID (stage 6 refuses such a caller before the handler; the engine refuses it again)', () => {
    expect(acknowledgementLine({ kind: 'ANONYMOUS', retiredDeviceId: 'DEV-0001' }, 'ALR-000001')).toEqual({ operatorId: null, alertId: 'ALR-000001' });
    expect(acknowledgementLine({ kind: 'DEVICE', deviceId: 'DEV-0001' }, 'ALR-000001')).toEqual({ operatorId: null, alertId: 'ALR-000001' });
  });

  it('the message and the unit label are fixed texts', () => {
    expect(ALERT_ACKNOWLEDGED_MESSAGE).toBe('alert acknowledged');
    expect(ACKNOWLEDGE_UNIT_LABEL).toBe('alerts.acknowledgeAlert');
  });
});
