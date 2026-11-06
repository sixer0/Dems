// Storage maths and the SIM-GAP-M85 adapter (step 85; 04_mobile_specs §4.13; web parity with
// implementation/28 model tests).
import { describe, expect, it } from '@jest/globals';
import { GB, TB, createSim, selectStorage, type SimEvent } from '@dems/shared/sim';
import { canManageStoragePolicy, isStorageEvent, selectFaultSessionId, selectStorageActivity } from './sim-adapter';
import {
  RATE_GB_PER_HOUR,
  activityDetail,
  activityTone,
  donutGeometry,
  faultClearedStillInFault,
  formatShortBytes,
  hoursMinutes,
  isEscalation,
  megabytesPerSecond,
  ringColorIndex,
  storageFaultKind,
  sweepEnd,
} from './storage-model';

function event(partial: Partial<SimEvent> & Pick<SimEvent, 'type'>): SimEvent {
  return { id: `e-${partial.type}`, seq: 1, at: 0, severity: 'INFO', message: '', params: {}, sessionId: null, deviceId: null, ...partial };
}

describe('storage-model', () => {
  it('formats the MB 8 capacity figures (decimal units)', () => {
    expect(formatShortBytes(4 * TB)).toBe('4.0 TB');
    expect(formatShortBytes(4 * TB - 804 * GB)).toBe('3.2 TB');
    expect(formatShortBytes(804 * GB)).toBe('804 GB');
    expect(formatShortBytes(48.14 * GB)).toBe('48.1 GB');
    expect(formatShortBytes(2.561 * GB)).toBe('2.56 GB');
  });

  it('est. remaining at load is 389h 45m at 8.2 GB/h (AC-54)', () => {
    const sim = createSim({ storage: null, authStorage: null });
    const summary = selectStorage(sim.store.getState());
    expect(summary.usedPercent).toBe(20);
    expect(hoursMinutes(summary.estimatedRemainingMs)).toEqual({ hours: 389, minutes: 45 });
    expect(RATE_GB_PER_HOUR.toFixed(1)).toBe('8.2');
    expect(megabytesPerSecond(Math.round((8.2 * GB) / 3600))).toBe('2.3');
    expect(megabytesPerSecond(-5)).toBe('0.0');
  });

  it('ring: sweep end, escalation rule, colour index, geometry', () => {
    expect(sweepEnd(20.1)).toBeCloseTo(0.201);
    expect(sweepEnd(0)).toBe(0);
    expect(sweepEnd(0.1)).toBe(0.005);
    expect(sweepEnd(140)).toBe(1);
    expect(sweepEnd(Number.NaN)).toBe(0);
    expect(isEscalation('READY', 'LOW')).toBe(true);
    expect(isEscalation('LOW', 'FULL')).toBe(true);
    expect(isEscalation('READY', 'FULL')).toBe(true);
    expect(isEscalation('FULL', 'LOW')).toBe(false);
    expect(isEscalation('LOW', 'LOW')).toBe(false);
    expect([ringColorIndex('READY'), ringColorIndex('LOW'), ringColorIndex('FULL')]).toEqual([0, 1, 2]);
    const g = donutGeometry(148);
    expect(g.center).toBe(74);
    // The glow (half its width + 3 sigma beyond the radius) fades out inside the canvas (F-85-2).
    expect(g.radius + g.glowWidth / 2 + 3 * g.glowBlur).toBeLessThanOrEqual(g.center);
    expect(g.radius * 2 + g.stroke).toBeGreaterThanOrEqual(148 * 0.75);
  });

  it('activity rows: tone, detail and storage fault kind', () => {
    expect(activityTone(event({ type: 'EVIDENCE_SEALED' }))).toBe('sealed');
    expect(activityTone(event({ type: 'EVIDENCE_EXPORTED' }))).toBe('info');
    expect(activityTone(event({ type: 'FAULT_RAISED', severity: 'CRITICAL' }))).toBe('danger');
    expect(activityTone(event({ type: 'AUTOSAVE', severity: 'INFO' }))).toBe('accent');
    expect(activityDetail(event({ type: 'EVIDENCE_SEALED', params: { evidenceId: 'EV-20261001-0013' } }))).toEqual({
      kind: 'text',
      text: 'EV-20261001-0013',
    });
    expect(activityDetail(event({ type: 'AUTOSAVE', params: { segment: 3, bytesWritten: 2.5 * GB } }))).toEqual({
      kind: 'segment',
      segment: '3',
      sizeGb: '2.50',
    });
    expect(activityDetail(event({ type: 'STORAGE_POLICY_CHANGED', params: { retentionDays: 365, autoArchive: false } }))).toEqual({
      kind: 'policy',
      days: 365,
      autoArchive: false,
    });
    expect(activityDetail(event({ type: 'RECORDING_STOPPED' }))).toBeNull();
    expect(storageFaultKind(event({ type: 'FAULT_RAISED', params: { kind: 'STORAGE_FULL' } }))).toBe('STORAGE_FULL');
    expect(storageFaultKind(event({ type: 'EVIDENCE_SEALED' }))).toBeNull();
  });

  it('M3-13 (row 203, W5; web row 110b): a FAULT_CLEARED of the session still in FAULT is the amber mark; any other row keeps its tone', () => {
    const cleared = event({ type: 'FAULT_CLEARED', severity: 'SUCCESS', params: { kind: 'STORAGE_FULL' }, sessionId: 'SES-20261105-0032' });
    expect(faultClearedStillInFault(cleared, 'SES-20261105-0032')).toBe(true);
    expect(activityTone(cleared, 'SES-20261105-0032')).toBe('warning');
    // CONTROL: no FAULT session, another session, no session on the event, the Core-not-running clear, a raise.
    expect(faultClearedStillInFault(cleared, null)).toBe(false);
    expect(activityTone(cleared, null)).toBe('success');
    expect(activityTone(cleared)).toBe('success');
    expect(faultClearedStillInFault(cleared, 'SES-20261105-0001')).toBe(false);
    expect(faultClearedStillInFault({ ...cleared, sessionId: null }, 'SES-20261105-0032')).toBe(false);
    expect(faultClearedStillInFault({ ...cleared, params: { kind: 'STORAGE_FULL', coreNotRunning: true } }, 'SES-20261105-0032')).toBe(false);
    const raised = { ...cleared, type: 'FAULT_RAISED' as const, severity: 'CRITICAL' as const };
    expect(faultClearedStillInFault(raised, 'SES-20261105-0032')).toBe(false);
    expect(activityTone(raised, 'SES-20261105-0032')).toBe('danger');
  });
});

describe('sim-adapter (SIM-GAP-M85-1, SIM-GAP-M85-2)', () => {
  it('filters storage events newest first with store-owned objects', () => {
    const events = [
      event({ id: 'a', type: 'EVIDENCE_SEALED' }),
      event({ id: 'b', type: 'AUTH_LOGIN' }),
      event({ id: 'c', type: 'FAULT_RAISED', params: { kind: 'CAMERA_LOSS' } }),
      event({ id: 'd', type: 'FAULT_RAISED', params: { kind: 'STORAGE_LOW' } }),
      event({ id: 'e', type: 'STORAGE_POLICY_CHANGED' }),
    ];
    const state = { events };
    expect(isStorageEvent(events[1]!)).toBe(false);
    expect(isStorageEvent(events[2]!)).toBe(false);
    const rows = selectStorageActivity(state, 5);
    expect(rows.map((row) => row.id)).toEqual(['e', 'd', 'a']);
    expect(rows[0]).toBe(events[4]);
    expect(selectStorageActivity(state, 2).map((row) => row.id)).toEqual(['e', 'd']);
    // M3-13 (row 203): the FAULT session's id, else null (web `selectFaultSessionId`, row 110b).
    const session = (state: string) => ({ session: { id: 'SES-20261105-0032', state } }) as unknown as Parameters<typeof selectFaultSessionId>[0];
    expect(selectFaultSessionId(session('FAULT'))).toBe('SES-20261105-0032');
    expect(selectFaultSessionId(session('RECOVERY'))).toBeNull();
    expect(selectFaultSessionId(session('RECORDING'))).toBeNull();
    expect(selectFaultSessionId({ session: null })).toBeNull();
  });

  it('only Supervisor and Technician may change the storage policy', () => {
    expect(canManageStoragePolicy('SUPERVISOR')).toBe(true);
    expect(canManageStoragePolicy('TECHNICIAN')).toBe(true);
    expect(canManageStoragePolicy('INVESTIGATOR')).toBe(false);
    expect(canManageStoragePolicy(null)).toBe(false);
  });
});
