// Recovery Status maths and the local simulator adapter (step 81; 04_mobile_specs §4.8; SIM-GAP-M81-1..3).
import { describe, expect, it, jest } from '@jest/globals';
import { RECOVERY_MS, RECOVERY_SCAN_MS, SimPermissionError } from '@dems/shared/sim';
import {
  ACK_SETTLE_MS,
  MILESTONE_COUNT,
  ackSettled,
  findingsFor,
  outcomeKind,
  pipelineStatuses,
  recoveryMilestone,
  recoveryPhase,
  ringStateFor,
  segmentFinding,
  sizeParts,
  stageFor,
  timeFinding,
  trackChecking,
  trackFindings,
  trackIssueCount,
  trackResolved,
  type ActiveFaultFlag,
} from './recovery.model';
import { canStartRecovery, recoverySignatureOf, startRecovery } from './sim-adapter';

const T0 = 1_000_000;
const scan = { stage: 'RECOVERY_SCAN' as const, startedAt: T0, completesAt: T0 + RECOVERY_MS };
const NO_FINDINGS = { scan: false, tracks: false, segment: false, time: false, analysis: false };

describe('phase', () => {
  it('maps the live state and the followed outcome', () => {
    expect(recoveryPhase('FAULT', 'S', false)).toBe('fault');
    expect(recoveryPhase('RECOVERY', 'S', false)).toBe('analysing');
    expect(recoveryPhase('RECORDING', 'S', false)).toBe('other');
    expect(recoveryPhase(null, 'S', true)).toBe('complete');
    expect(recoveryPhase(null, 'S', false)).toBe('idle');
    expect(recoveryPhase(null, null, false)).toBe('idle');
  });
});

describe('milestones on the simulator clock (SIM-GAP-M81-3)', () => {
  it('counts 8 milestones over the 3 s and never lags the simulator stage', () => {
    expect(recoveryMilestone(null, T0)).toBe(0);
    expect(recoveryMilestone(scan, T0)).toBe(0);
    expect(recoveryMilestone(scan, T0 + 499)).toBe(0);
    expect(recoveryMilestone(scan, T0 + 500)).toBe(1);
    expect(recoveryMilestone(scan, T0 + 1_000)).toBe(3);
    expect(recoveryMilestone(scan, T0 + RECOVERY_SCAN_MS)).toBe(5);
    // The simulator already reports the second stage: every scan milestone counts as passed.
    expect(recoveryMilestone({ ...scan, stage: 'INCOMPLETE_SESSION_ANALYSIS' }, T0 + 100)).toBe(5);
    expect(recoveryMilestone(scan, T0 + RECOVERY_MS)).toBe(MILESTONE_COUNT);
    expect(stageFor(4)).toBe('RECOVERY_SCAN');
    expect(stageFor(5)).toBe('INCOMPLETE_SESSION_ANALYSIS');
  });

  it('resolves the four tracks in order, one checking at a time', () => {
    expect(trackChecking('VIDEO-01', 0, 'analysing')).toBe(false);
    expect(trackChecking('VIDEO-01', 1, 'analysing')).toBe(true);
    expect(trackResolved('VIDEO-01', 2)).toBe(true);
    expect(trackChecking('VIDEO-02', 2, 'analysing')).toBe(true);
    expect(trackChecking('AUDIO-01', 2, 'analysing')).toBe(false);
    expect(trackResolved('AUDIO-02', 5)).toBe(true);
    expect(trackChecking('VIDEO-01', 1, 'fault')).toBe(false);
  });
});

describe('pipeline statuses', () => {
  it('waits in FAULT, runs one step at a time in RECOVERY, finishes on the outcome', () => {
    expect(pipelineStatuses('fault', 0, NO_FINDINGS)).toEqual(['pending', 'pending', 'pending', 'pending', 'pending']);
    expect(pipelineStatuses('analysing', 0, NO_FINDINGS)).toEqual(['running', 'pending', 'pending', 'pending', 'pending']);
    expect(pipelineStatuses('analysing', 1, NO_FINDINGS)).toEqual(['done', 'running', 'pending', 'pending', 'pending']);
    expect(pipelineStatuses('analysing', 5, NO_FINDINGS)).toEqual(['done', 'done', 'running', 'pending', 'pending']);
    expect(pipelineStatuses('complete', 0, NO_FINDINGS)).toEqual(['done', 'done', 'done', 'done', 'done']);
  });

  it('marks a finished step with a finding as warn (one halo, then steady amber; P7)', () => {
    const findings = { ...NO_FINDINGS, tracks: true, time: true };
    expect(pipelineStatuses('complete', 0, findings)).toEqual(['done', 'warn', 'done', 'warn', 'done']);
    expect(pipelineStatuses('analysing', 5, findings)).toEqual(['done', 'warn', 'running', 'pending', 'pending']);
  });
});

describe('analysis from the state at the interruption', () => {
  const faultAt = T0;
  const flags: ActiveFaultFlag[] = [
    { kind: 'CAMERA_LOSS', since: T0 - 95_000, target: 'VIDEO-02' },
    { kind: 'MIC_CLIP', since: T0 - 60_000, target: 'AUDIO-02' },
    { kind: 'GNSS_LOSS', since: T0 - 40_000, target: 'NTP' },
    // Raised after the interruption: does not count.
    { kind: 'MIC_NO_SIGNAL', since: T0 + 5_000, target: 'AUDIO-01' },
  ];

  it('tracks: GAP for a lost source, FLAGGED for clipping, INTACT otherwise, NO MEDIA before recording', () => {
    const tracks = trackFindings(true, faultAt, flags);
    expect(tracks.map((f) => [f.track, f.integrity, f.since])).toEqual([
      ['VIDEO-01', 'intact', null],
      ['VIDEO-02', 'gap', T0 - 95_000],
      ['AUDIO-01', 'intact', null],
      ['AUDIO-02', 'degraded', T0 - 60_000],
    ]);
    expect(trackIssueCount(tracks)).toBe(2);
    expect(trackFindings(false, faultAt, flags).every((f) => f.integrity === 'noMedia')).toBe(true);
  });

  it('time: GNSS → NTP (or RTC) from the loss; GNSS throughout without one', () => {
    expect(timeFinding(faultAt, flags)).toEqual({ from: 'GNSS', to: 'NTP', at: T0 - 40_000 });
    expect(timeFinding(faultAt, [{ kind: 'GNSS_LOSS', since: T0 - 1, target: 'RTC' }]).to).toBe('RTC');
    expect(timeFinding(faultAt, [])).toEqual({ from: 'GNSS', to: null, at: null });
    expect(findingsFor(trackFindings(true, faultAt, []), timeFinding(faultAt, []))).toEqual(NO_FINDINGS);
  });

  it('last good segment: the newest autosave, else the recording start, else none', () => {
    expect(segmentFinding(T0 - 1_000_000, T0 - 30_000)).toEqual({ endsAt: T0 - 30_000, basis: 'autosave', lengthMs: 970_000 });
    expect(segmentFinding(T0 - 10_000, null)).toEqual({ endsAt: T0 - 10_000, basis: 'start', lengthMs: 0 });
    expect(segmentFinding(null, null)).toEqual({ endsAt: null, basis: null, lengthMs: 0 });
  });
});

describe('outcome, ring and acknowledge', () => {
  it('maps the simulator outcome (RECOVERED only through SIM-GAP-M81-1)', () => {
    expect(outcomeKind('INCOMPLETE')).toBe('incomplete');
    expect(outcomeKind('SEALED')).toBe('recovered');
    expect(outcomeKind(null)).toBeNull();
  });

  it('ring: critical in FAULT, attention while recovering and when incomplete, ready once acknowledged', () => {
    expect(ringStateFor('fault', null, false)).toBe('critical');
    expect(ringStateFor('analysing', null, false)).toBe('attention');
    expect(ringStateFor('complete', 'incomplete', false)).toBe('attention');
    expect(ringStateFor('complete', 'incomplete', true)).toBe('ready');
    expect(ringStateFor('complete', 'recovered', false)).toBe('ready');
  });

  it('settles 600 ms after Acknowledge on the simulator clock', () => {
    expect(ackSettled(null, T0)).toBe(false);
    expect(ackSettled(T0, T0 + ACK_SETTLE_MS - 1)).toBe(false);
    expect(ackSettled(T0, T0 + ACK_SETTLE_MS)).toBe(true);
  });

  it('formats sizes in decimal units', () => {
    expect(sizeParts(806.6e9)).toEqual({ unit: 'gb', value: '806.6' });
    expect(sizeParts(0)).toEqual({ unit: 'mb', value: '0.0' });
  });
});

describe('sim-adapter', () => {
  it('SIM-GAP-M81-2: only SESSION_START roles start recovery; others get SimPermissionError before the simulator', () => {
    const recover = jest.fn();
    expect(canStartRecovery('INVESTIGATOR')).toBe(true);
    expect(canStartRecovery('SUPERVISOR')).toBe(true);
    expect(canStartRecovery('TECHNICIAN')).toBe(false);
    expect(() => startRecovery({ recover }, 'TECHNICIAN')).toThrow(SimPermissionError);
    expect(() => startRecovery({ recover }, null)).toThrow(SimPermissionError);
    expect(recover).not.toHaveBeenCalled();
    startRecovery({ recover }, 'INVESTIGATOR');
    expect(recover).toHaveBeenCalledTimes(1);
  });

  it('SIM-GAP-M81-1: a recovery signature only for a sealed item', () => {
    const signature = { value: 'abc', keyId: 'k', algorithm: 'SIMULATED-SHA256' as const, simulated: true as const };
    expect(recoverySignatureOf({ status: 'RECORDED', signature })).toBeNull();
    expect(recoverySignatureOf({ status: 'SEALED', signature })).toBe('abc');
    expect(recoverySignatureOf(null)).toBeNull();
  });
});
