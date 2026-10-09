// Faults, scenarios, maintenance and the generator (masterplan/01_specs.md §14.7 `faults.ts`,
// `scenarios.ts`, `health.ts`, "Rates"; §14.5.8 Demo Control Panel; AC-65 unit form).
import { describe, expect, it } from 'vitest';
import {
  createManualClock,
  createSim,
  FaultKind,
  SimPermissionError,
  SimTransitionError,
  selectDeviceStats,
  selectSystemState,
  type FaultKind as FaultKindType,
  type ScenarioName,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 10:00 WIB

function harness(scenario: ScenarioName = 'idle') {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario });
  const run = (ms: number, step = 50) => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  return { sim, clock, run, state: () => sim.store.getState() };
}

describe('every fault emits an alert and an audit row, and clears (§6.4, SYS-014)', () => {
  const kinds = Object.values(FaultKind) as FaultKindType[];
  it.each(kinds)('%s', (kind) => {
    const h = harness();
    const before = h.state();
    h.sim.actions.inject(kind);
    const state = h.state();
    expect(state.faults.active.map((fault) => fault.kind)).toEqual([kind]);
    expect(state.alerts).toHaveLength(before.alerts.length + 1);
    expect(state.alerts.at(-1)).toMatchObject({ kind, active: true, acknowledged: false });
    expect(state.audit.total).toBe(before.audit.total + 1);
    expect(state.audit.rows.at(-1)?.type).toBe(kind === 'AUDIT_TAMPER' ? 'AUDIT_CHAIN_DISCONTINUITY' : 'FAULT_RAISED');
    expect(state.audit.rows.at(-1)?.details).toMatchObject({ kind });
    expect(state.events.at(-1)?.type).toBe(kind === 'AUDIT_TAMPER' ? 'AUDIT_CHAIN_BROKEN' : 'FAULT_RAISED');
    expect(selectSystemState(state).state).not.toBe('READY');

    h.sim.actions.inject(kind); // idempotent
    expect(h.state().audit.total).toBe(state.audit.total);

    h.sim.actions.clearFault(kind);
    const cleared = h.state();
    expect(cleared.faults.active).toEqual([]);
    expect(cleared.alerts.at(-1)).toMatchObject({ active: false, resolvedAt: START });
    expect(cleared.audit.rows.at(-1)).toMatchObject({ type: 'FAULT_CLEARED', details: { kind } });
    if (kind !== 'MIC_CLIP') expect(selectSystemState(cleared).state).toBe('READY'); // the CLIP latch outlives the fault
  });

  it('the audit row carries the EVT test ID and the book event kind (AC-65 "audit AUDIO_CLIP")', () => {
    const h = harness();
    h.sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-02' });
    expect(h.state().audit.rows.at(-1)).toMatchObject({
      type: 'FAULT_RAISED',
      category: 'DEVICE',
      deviceId: 'MIC-02',
      details: { kind: 'MIC_CLIP', evt: 'EVT-07', eventKind: 'AUDIO_CLIP', target: 'AUDIO-02' },
    });
  });

  it('acknowledgeAlert marks the alert acknowledged without resolving it', () => {
    const h = harness();
    h.sim.actions.inject('FAN_STALL');
    const alertId = h.state().alerts.at(-1)?.id ?? '';
    h.sim.actions.acknowledgeAlert(alertId);
    expect(h.state().alerts.at(-1)).toMatchObject({ acknowledged: true, active: true });
    h.sim.actions.acknowledgeAlert('ALR-999999'); // unknown: no-op
  });
});

describe('device effects (derived from the active faults)', () => {
  it('CAMERA_LOSS: lens FAULT; the 2-port PoE (D79) stays up until both lenses are lost; defaults to the active camera', () => {
    const h = harness();
    expect(h.state().network.poe).toMatchObject({ activePorts: 2, totalPorts: 2, poweredPorts: 1, sparePorts: 1, drawW: 18.6 });
    h.sim.actions.setActiveCamera('VIDEO-02');
    h.sim.actions.inject('CAMERA_LOSS');
    let state = h.state();
    expect(state.cameras.find((camera) => camera.id === 'VIDEO-02')).toMatchObject({ lens: 'FAULT', online: false });
    // One lens lost: the dual-lens camera is still powered on PoE CAM 1; CAM 2/AUX is the spare.
    expect(state.network.poe).toMatchObject({ activePorts: 2, totalPorts: 2, poweredPorts: 1, drawW: 18.6 });
    expect(state.otherDevices.find((device) => device.id === 'POE-SWITCH')?.status).toBe('2/2 Ports Active');
    expect(state.ports.find((port) => port.id === 'POE_CAM_1')?.link).toBe(true);
    expect(state.ports.find((port) => port.id === 'POE_CAM_2_AUX')).toMatchObject({ link: true, spare: true });
    expect(selectDeviceStats(state)).toMatchObject({ camerasOnline: 1, camerasTotal: 2 });
    expect(state.services.find((service) => service.name === 'Video Management Service')?.status).toBe('DEGRADED');
    // Both lenses lost: PoE CAM 1 goes down (0 W), the spare stays ready.
    h.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-01' });
    state = h.state();
    expect(state.network.poe).toMatchObject({ activePorts: 1, totalPorts: 2, poweredPorts: 0, drawW: 0 });
    expect(state.otherDevices.find((device) => device.id === 'POE-SWITCH')?.status).toBe('1/2 Ports Active');
    expect(state.ports.find((port) => port.id === 'POE_CAM_1')?.link).toBe(false);
  });

  it('GNSS_LOSS falls back to NTP, escalates to RTC, and returns to GNSS when cleared', () => {
    const h = harness();
    h.sim.actions.inject('GNSS_LOSS');
    expect(h.state().time).toMatchObject({ source: 'NTP', locked: true, stratum: 3, gnss: { locked: false, satellites: 0 } });
    h.sim.actions.inject('GNSS_LOSS', { fallback: 'RTC' });
    expect(h.state().faults.active).toHaveLength(1);
    expect(h.state().time).toMatchObject({ source: 'RTC', locked: false, ntp: { reachable: false } });
    h.run(10_000, 100);
    expect(h.state().time.offsetMs).toBeGreaterThan(3); // the RTC drifts
    h.sim.actions.clearFault('GNSS_LOSS');
    expect(h.state().time).toMatchObject({ source: 'GNSS', locked: true, stratum: 1, gnss: { locked: true } });
  });

  it('TPM_FAILURE: security FAULT, posture CRITICAL, and the gate blocks on SECURITY', () => {
    const h = harness();
    h.sim.actions.inject('TPM_FAILURE');
    expect(h.state().security).toMatchObject({ state: 'FAULT', posture: 'CRITICAL', tpm: { ok: false } });
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    h.sim.actions.createSession({
      caseNumber: 'LP/2026/1001-0008',
      subjectType: 'SAKSI',
      subjectName: 'Gate Saksi',
      investigatorId: 'OPR-001',
      room: 'Interview Room 1',
      profileId: 'STANDARD_1080P25',
    });
    h.sim.actions.beginPrecheck();
    h.run(5_000);
    expect(h.state().session?.precheck.items.find((item) => item.id === 'SECURITY')).toMatchObject({ status: 'BLOCK' });
  });

  it('enclosure TAMPER: posture ATTENTION, TAMPER control open, security state still READY', () => {
    const h = harness();
    h.sim.actions.inject('TAMPER');
    expect(h.state().security).toMatchObject({ state: 'READY', posture: 'ATTENTION', tamper: true });
    expect(h.state().security.controls.find((control) => control.id === 'TAMPER')).toMatchObject({ ok: false, detail: 'Open' });
  });

  it('FAN_STALL: 0 rpm and the temperatures climb at 1 Hz', () => {
    const h = harness();
    h.run(2_000);
    const before = h.state().health.cpuTempC;
    h.sim.actions.inject('FAN_STALL');
    h.run(60_000, 200);
    expect(h.state().health).toMatchObject({ fanOk: false, fanRpm: 0 });
    expect(h.state().health.cpuTempC).toBeGreaterThan(before + 10);
    expect(h.state().health.series.length).toBeGreaterThanOrEqual(60);
  });

  it('AC-65 unit form: MIC 2 clip latches, then Storage full turns FULL and the gate blocks', () => {
    const h = harness();
    h.sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-02' });
    expect(h.state().mics.find((mic) => mic.id === 'AUDIO-02')).toMatchObject({ clipLatched: true, state: 'CLIP' });
    h.sim.actions.inject('STORAGE_FULL');
    expect(h.state().storage.state).toBe('FULL');
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    h.sim.actions.createSession({
      caseNumber: 'LP/2026/1001-0008',
      subjectType: 'SAKSI',
      subjectName: 'Gate Saksi',
      investigatorId: 'OPR-001',
      room: 'Interview Room 1',
      profileId: 'STANDARD_1080P25',
    });
    h.sim.actions.beginPrecheck();
    h.run(5_000);
    const items = h.state().session?.precheck.items ?? [];
    expect(items.find((item) => item.id === 'STORAGE')).toMatchObject({ status: 'BLOCK', value: 'FULL' });
    expect(items.find((item) => item.id === 'MIC_STANDBY')).toMatchObject({ status: 'WARN', value: 'CLIP' });
    expect(h.state().session?.precheck.outcome).toBe('BLOCK');
  });
});

describe('scenarios (§14.7 scenarios.ts)', () => {
  it('recording: session 0024, case 0007, Ahmad Fauzi, 00:18:42 in, with a coherent audit trail and timeline', () => {
    const state = harness('recording').state();
    expect(state.meta.scenario).toBe('recording');
    expect(state.session).toMatchObject({
      id: 'SES-20261001-0024',
      state: 'RECORDING',
      createdBy: 'OPR-001',
      input: { caseNumber: 'LP/2026/1001-0007', subjectName: 'Ahmad Fauzi', subjectType: 'TERSANGKA', investigatorId: 'OPR-001' },
    });
    expect(START - (state.session?.startedAt ?? 0)).toBe((18 * 60 + 42) * 1_000);
    const kinds = new Set(state.session?.timeline.map((item) => item.kind));
    for (const kind of ['START', 'NOTE', 'MARKER', 'AUDIO_PEAK', 'SNAPSHOT', 'AUTOSAVE', 'CHECK', 'HEALTH']) expect(kinds).toContain(kind);
    const sessionRows = state.audit.rows.filter((row) => row.sessionId === state.session?.id).map((row) => row.type);
    expect(sessionRows.slice(0, 3)).toEqual(['SESSION_CREATED', 'PRECHECK_PASSED', 'RECORDING_STARTED']);
    expect(sessionRows.filter((type) => type === 'FRAME_HASH' || type === 'WRITE_VERIFIED' || type === 'TIMESTAMP_CONFIRMED').length).toBeGreaterThan(80);
    expect(state.auth.status).toBe('SIGNED_OUT'); // auth is never part of a scenario
    expect(state.cameras.every((camera) => camera.recState === 'REC')).toBe(true);
    expect(selectSystemState(state).state).toBe('RECORDING');
  });

  it('finalizing: seals within 10 s of ticking', () => {
    const h = harness('finalizing');
    expect(h.state().session?.state).toBe('FINALIZING');
    h.run(10_000);
    expect(h.state().session?.state).toBe('SEALED');
    expect(h.state().evidence.at(-1)).toMatchObject({ id: 'EV-20261001-0014', status: 'SEALED', subjectName: 'Ahmad Fauzi' });
  });

  it('fault-demo: still RECORDING with Camera 2 lost, MIC 2 clipping and time from NTP', () => {
    const state = harness('fault-demo').state();
    expect(state.session?.state).toBe('RECORDING');
    expect(state.faults.active.map((fault) => `${fault.kind}:${fault.target}`)).toEqual(['CAMERA_LOSS:VIDEO-02', 'MIC_CLIP:AUDIO-02', 'GNSS_LOSS:NTP']);
    expect(selectSystemState(state).flags.map((flag) => flag.id)).toEqual(
      expect.arrayContaining(['CAMERA_VIDEO-02', 'MIC_AUDIO-02_CLIP', 'TIME_FALLBACK']),
    );
    expect(state.session?.timeline.filter((item) => item.kind === 'FAULT')).toHaveLength(3);
  });

  it('loadScenario keeps the operator, the pairing and the tablet link, and writes SCENARIO_LOADED', () => {
    const h = harness();
    h.sim.actions.signIn('andi.pratama', 'demo-2026');
    h.sim.actions.setTabletLink('OFFLINE');
    h.sim.actions.unpair();
    h.sim.actions.inject('FAN_STALL');
    h.sim.actions.loadScenario('recording');
    const state = h.state();
    expect(state.session?.state).toBe('RECORDING');
    expect(state.auth).toMatchObject({ status: 'SIGNED_IN', operatorId: 'OPR-002' });
    expect(state.pairing.state).toBe('UNPAIRED');
    expect(state.tabletLink.state).toBe('OFFLINE');
    expect(state.faults.active).toEqual([]);
    expect(state.audit.rows.at(-1)).toMatchObject({ type: 'SCENARIO_LOADED', actorId: 'OPR-002', details: { scenario: 'recording' } });
    expect(h.sim.actions.verifyAuditChain().ok).toBe(true);
    h.sim.actions.loadScenario('idle');
    expect(h.state().session).toBeNull();
    expect(() => h.sim.actions.loadScenario('bogus' as ScenarioName)).toThrow(RangeError);
  });
});

describe('maintenance', () => {
  it('runDiagnostics resolves 8 checks one by one and reflects the faults; a second call returns the same run', () => {
    const h = harness();
    h.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-01' });
    h.sim.actions.inject('GNSS_LOSS');
    expect(() => h.sim.actions.runDiagnostics()).toThrow(SimPermissionError); // step 54: DIAGNOSTICS_RUN
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    const runId = h.sim.actions.runDiagnostics();
    expect(h.sim.actions.runDiagnostics()).toBe(runId);
    expect(h.state().diagnostics?.checks.map((check) => check.status)).toEqual(['RUNNING', ...Array(7).fill('PENDING')]);
    h.run(6_000);
    const run = h.state().diagnostics;
    expect(run?.completedAt).not.toBeNull();
    expect(Object.fromEntries(run?.checks.map((check) => [check.id, check.status]) ?? [])).toMatchObject({
      CPU: 'PASS',
      CAMERA: 'FAIL',
      // One lens lost keeps PoE CAM 1 powered (2-port model, D79).
      NETWORK: 'PASS',
      TIME: 'WARN',
      SECURITY: 'PASS',
    });
    expect(run?.checks.find((check) => check.id === 'TIME')?.params).toMatchObject({ source: 'NTP' });
    expect(h.state().audit.rows.some((row) => row.type === 'DIAGNOSTICS_RUN')).toBe(true);
    expect(h.state().events.at(-1)).toMatchObject({ type: 'DIAGNOSTICS_COMPLETED', severity: 'CRITICAL' });
    expect(h.sim.actions.runDiagnostics()).not.toBe(runId);
  });

  it('startSoftwareUpdate installs 2.5.0 into slot B through the 6 §20.2 steps, with a reboot', () => {
    const h = harness();
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    expect(() => h.sim.actions.startSoftwareUpdate()).toThrow(SimPermissionError); // MAINTENANCE only
    h.sim.actions.signOut();
    h.sim.actions.signIn('rina.wijaya', 'demo-2026');
    h.sim.actions.startSoftwareUpdate();
    expect(h.state().update).toMatchObject({ state: 'RUNNING' });
    h.run(15_000, 100);
    const state = h.state();
    expect(state.update).toMatchObject({ state: 'PASS', currentVersion: '2.5.0', availableVersion: null, activeSlot: 'B' });
    expect(state.update.steps.every((step) => step.status === 'done')).toBe(true);
    expect(state.device.softwareVersion).toBe('2.5.0');
    const types = state.audit.rows.map((row) => row.type);
    expect(types.slice(-3)).toEqual(['UPDATE_STARTED', 'SYSTEM_BOOT', 'UPDATE_COMPLETED']);
    // The reboot restarted the services (uptime counts from the SYSTEM_BOOT row).
    const boot = state.audit.rows.at(-2);
    expect(state.services.every((service) => service.startedAt === boot?.at)).toBe(true);
  });

  it('refuses an update during a session', () => {
    const h = harness('recording');
    h.sim.actions.signIn('rina.wijaya', 'demo-2026');
    expect(() => h.sim.actions.startSoftwareUpdate()).toThrow(SimTransitionError);
    try {
      h.sim.actions.startSoftwareUpdate();
    } catch (error) {
      expect((error as SimTransitionError).code).toBe('SESSION_ACTIVE');
    }
  });

  it('setStoragePolicy audits a change, ignores a no-op and rejects bad values', () => {
    const h = harness();
    // Step 54 (F-49-1): SUPERVISOR or TECHNICIAN only.
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    expect(() => h.sim.actions.setStoragePolicy({ retentionPolicy: 'YEAR_1' })).toThrow(SimPermissionError);
    h.sim.actions.signOut();
    h.sim.actions.signIn('andi.pratama', 'demo-2026');
    h.sim.actions.setStoragePolicy({ retentionPolicy: 'YEAR_1' });
    expect(h.state().storagePolicy).toEqual({ retentionPolicy: 'YEAR_1', retentionDays: 365, autoArchive: true });
    const total = h.state().audit.total;
    h.sim.actions.setStoragePolicy({ retentionPolicy: 'YEAR_1' });
    expect(h.state().audit.total).toBe(total);
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'STORAGE_POLICY_CHANGED', details: { retentionDays: 365 } });
    expect(() => h.sim.actions.setStoragePolicy({ retentionDays: 0 })).toThrow(SimTransitionError);
  });

  it('deviceCommand audits known devices and rejects unknown ones', () => {
    const h = harness();
    // Step 54 (D79): RESTART needs DEVICE_MANAGE (TECHNICIAN).
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    expect(() => h.sim.actions.deviceCommand('CAM-02', 'RESTART')).toThrow(SimPermissionError);
    h.sim.actions.signOut();
    h.sim.actions.signIn('rina.wijaya', 'demo-2026');
    h.sim.actions.deviceCommand('CAM-02', 'RESTART');
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'DEVICE_COMMAND', deviceId: 'CAM-02', details: { command: 'RESTART' } });
    expect(() => h.sim.actions.deviceCommand('CAM-99', 'RESTART')).toThrow(/not found/);
  });
});

describe('evidence lifecycle actions (RBAC)', () => {
  it('archive needs EVIDENCE_REVIEW and a sealed item', () => {
    const h = harness();
    const sealed = h.state().evidence[0]?.id ?? '';
    const recorded = h.state().evidence.find((item) => item.status === 'RECORDED')?.id ?? '';
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    expect(() => h.sim.actions.archiveEvidence(sealed)).toThrow(SimPermissionError);
    h.sim.actions.signOut();
    h.sim.actions.signIn('andi.pratama', 'demo-2026');
    expect(() => h.sim.actions.archiveEvidence(recorded)).toThrow(SimTransitionError);
    h.sim.actions.archiveEvidence(sealed);
    expect(h.state().evidence[0]).toMatchObject({ status: 'ARCHIVED', lifecycleStage: 'RETENTION_ARCHIVE_DISPOSITION' });
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'EVIDENCE_ARCHIVED', evidenceId: sealed });
  });

  it('exportAudit: INVESTIGATOR 403 with EXPORT_DENIED, SUPERVISOR 202 with AUDIT_EXPORTED', () => {
    const h = harness();
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    expect(h.sim.actions.exportAudit()).toEqual({ ok: false, status: 403, reason: 'FORBIDDEN' });
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'EXPORT_DENIED', details: { scope: 'AUDIT' } });
    h.sim.actions.signOut();
    h.sim.actions.signIn('andi.pratama', 'demo-2026');
    expect(h.sim.actions.exportAudit()).toMatchObject({ ok: true, status: 202 });
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'AUDIT_EXPORTED', details: { chainOk: true } });
  });
});

describe('generator rates (§14.7)', () => {
  it('while recording: integrity rows at about 1 per 8 s (Poisson)', () => {
    const h = harness('recording');
    const count = () =>
      h.state().audit.rows.filter((row) => ['FRAME_HASH', 'WRITE_VERIFIED', 'TIMESTAMP_CONFIRMED'].includes(row.type) && row.at > START).length;
    h.run(600_000, 250);
    expect(count()).toBeGreaterThanOrEqual(50); // mean 75 in 10 min
    expect(count()).toBeLessThanOrEqual(100);
  });

  it('idle: one operational event per 60 s', () => {
    const h = harness();
    // The first idle event comes 60 s after the engine's first tick (START + 250 ms here).
    h.run(301_000, 250);
    const idle = h.state().events.filter((event) => event.at > START && ['HEALTH_CHECK_OK', 'TIME_SYNC', 'STORAGE_WRITE_VERIFIED'].includes(event.type));
    expect(idle).toHaveLength(5);
    expect(idle.map((event) => event.at - START)).toEqual([60_250, 120_250, 180_250, 240_250, 300_250]);
  });

  it('health publishes at 1 Hz and keeps the time disciplined while GNSS is locked', () => {
    const h = harness();
    h.run(40_000, 100);
    const state = h.state();
    expect(state.health.series.length).toBeGreaterThanOrEqual(40);
    expect(state.network.bandwidth.history.length).toBeGreaterThanOrEqual(40);
    expect(START + 40_000 - state.time.lastSyncAt).toBeLessThanOrEqual(16_000);
    expect(state.time.history.length).toBeGreaterThanOrEqual(4);
    expect(Math.abs(state.time.offsetMs)).toBeLessThanOrEqual(4);
  });
});
