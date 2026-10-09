// Step 54: the simulator closes the page SIM-GAPs (W43–W52, M78-1, M80-1, F-49-1/2, review 40 m4/m8)
// with selectors and actions, so the web and mobile adapters can read them instead of deriving.
import { describe, expect, it } from 'vitest';
import { createJSONStorage } from 'zustand/middleware';
import {
  createManualClock,
  createMemoryStateStorage,
  createSim,
  deviceHealthSeries,
  eventCategory,
  logBundle,
  RECORDING_BYTES_PER_HOUR,
  releaseInfo,
  selectAvSync,
  selectDomainStates,
  selectDriveHealth,
  selectFrontPanel,
  selectLastSignOut,
  selectNetworkTimeEvents,
  selectNextCaseNumber,
  selectPlatformDevices,
  selectPoeStatus,
  selectPresentationMode,
  selectReleaseInfo,
  selectServicesSince,
  selectStorageActivity,
  selectWriteRateHistory,
  SERIES_POINTS,
  SimPermissionError,
  SimTransitionError,
  simErrorCode,
  type ScenarioName,
  type SessionCreateInput,
  type SimPersistStorage,
  type SimSnapshot,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 10:00 WIB
type Operator = 'budi.santoso' | 'andi.pratama' | 'rina.wijaya';

const INPUT: SessionCreateInput = {
  caseNumber: 'LP/2026/1001-0008',
  subjectType: 'SAKSI',
  subjectName: 'Gap Saksi',
  investigatorId: 'OPR-001',
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
};

function harness(scenario: ScenarioName = 'idle', operator: Operator | null = 'budi.santoso', storage: SimPersistStorage | null = null) {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage, authStorage: null, scenario });
  if (operator) sim.actions.signIn(operator, 'demo-2026');
  const run = (ms: number, step = 50) => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  const state = () => sim.store.getState();
  const record = (input: SessionCreateInput = INPUT) => {
    sim.actions.createSession(input);
    sim.actions.beginPrecheck();
    run(5_000);
    sim.actions.startRecording();
  };
  const seal = (reason = 'Interview completed') => {
    sim.actions.stopRecording(reason);
    run(12_000, 100);
  };
  return { sim, clock, run, state, record, seal };
}

const thrown = (fn: () => void): unknown => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return null;
};

describe('machine-readable error codes (review 40 m8)', () => {
  it('stop reason, note, running checks and a session-time update each carry their code', () => {
    const h = harness();
    h.sim.actions.createSession(INPUT);
    h.sim.actions.beginPrecheck();
    expect(simErrorCode(thrown(() => h.sim.actions.retryPrecheck()))).toBe('CHECKS_RUNNING');
    expect(simErrorCode(thrown(() => h.sim.actions.acknowledgePrecheckWarnings()))).toBe('CHECKS_RUNNING');
    h.run(5_000);
    expect(simErrorCode(thrown(() => h.sim.actions.acknowledgePrecheckWarnings()))).toBe('ILLEGAL_STATE');
    h.sim.actions.startRecording();
    expect(simErrorCode(thrown(() => h.sim.actions.stopRecording('no')))).toBe('REASON_TOO_SHORT');
    expect(simErrorCode(thrown(() => h.sim.actions.addNote(' ')))).toBe('NOTE_INVALID');
    expect(simErrorCode(thrown(() => h.sim.actions.deviceCommand('CAM-99', 'TEST_SIGNAL')))).toBe('NOT_FOUND');
    expect(simErrorCode(new Error('plain'))).toBeNull();
  });
});

describe('case-number scanner (SIM-GAP-W46-1 / M78-1)', () => {
  it('selectNextCaseNumber offers 0008; scanCaseNumber reserves it; a created case at or past the counter advances it', () => {
    const h = harness();
    expect(selectNextCaseNumber(h.state())).toBe('LP/2026/1001-0008');
    expect(h.sim.actions.scanCaseNumber()).toBe('LP/2026/1001-0008');
    expect(selectNextCaseNumber(h.state())).toBe('LP/2026/1001-0009');
    h.sim.actions.createSession({ ...INPUT, caseNumber: 'LP/2026/1001-0012' });
    expect(selectNextCaseNumber(h.state())).toBe('LP/2026/1001-0013');
    // A case of another day, or below the counter, leaves it alone.
    h.sim.actions.cancel();
    h.sim.actions.createSession({ ...INPUT, caseNumber: 'LP/2026/0930-0099' });
    expect(selectNextCaseNumber(h.state())).toBe('LP/2026/1001-0013');
  });

  it('needs SESSION_START', () => {
    expect(() => harness('idle', 'rina.wijaya').sim.actions.scanCaseNumber()).toThrow(SimPermissionError);
    expect(() => harness('idle', null).sim.actions.scanCaseNumber()).toThrow(SimPermissionError);
  });
});

describe('codes and params instead of English text (W44-2, W46-2, review 40 m4)', () => {
  it('precheck items carry reasonCode and params', () => {
    const h = harness();
    h.sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-02' });
    h.sim.actions.inject('GNSS_LOSS', { fallback: 'RTC' });
    h.sim.actions.createSession(INPUT);
    h.sim.actions.beginPrecheck();
    expect(h.state().session?.precheck.items.every((item) => item.reasonCode === null)).toBe(true);
    h.run(5_000);
    const items = h.state().session?.precheck.items ?? [];
    expect(items.find((item) => item.id === 'MIC_STANDBY')).toMatchObject({ status: 'WARN', reasonCode: 'MIC_CLIP', params: { track: 'AUDIO-02' } });
    expect(items.find((item) => item.id === 'TIME')).toMatchObject({ status: 'WARN', reasonCode: 'TIME_RTC', params: { source: 'RTC' } });
    expect(items.find((item) => item.id === 'CORE')).toMatchObject({ status: 'PASS', reasonCode: null });
  });

  it('timeline items carry params (START, MARKER, NOTE, SNAPSHOT, AUTOSAVE, FAULT, AUDIO_PEAK)', () => {
    const h = harness();
    h.record();
    h.sim.actions.addMarker('Key statement');
    h.sim.actions.addNote('A note');
    h.sim.actions.snapshot();
    h.sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-01' });
    h.run(90_000, 100);
    const timeline = h.state().session?.timeline ?? [];
    const byKind = (kind: string) => timeline.find((item) => item.kind === kind);
    expect(byKind('START')?.params).toMatchObject({ sessionId: h.state().session?.id, timeSource: 'GNSS' });
    expect(byKind('MARKER')?.params).toEqual({ index: 1, label: 'Key statement' });
    expect(byKind('NOTE')?.params).toMatchObject({ length: 6 });
    expect(byKind('SNAPSHOT')?.params).toEqual({ index: 1, cameraId: 'VIDEO-01' });
    expect(byKind('FAULT')?.params).toMatchObject({ kind: 'MIC_CLIP', evt: 'EVT-07', target: 'AUDIO-01', critical: false });
    const autosave = byKind('AUTOSAVE');
    expect(typeof autosave?.params?.segment).toBe('number');
    expect(typeof autosave?.params?.bytesWritten).toBe('number');
    const peak = harness('recording').state().session?.timeline.find((item) => item.kind === 'AUDIO_PEAK');
    expect(peak?.params).toEqual({ dbfs: -3.1, track: 'AUDIO-02' });
  });

  it('alerts carry params', () => {
    const h = harness();
    h.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-02' });
    expect(h.state().alerts.at(-1)?.params).toMatchObject({ kind: 'CAMERA_LOSS', target: 'VIDEO-02', evt: 'EVT-04' });
  });
});

describe('stored evidence keeps case type, markers, notes and time sources (W47-2, W47-3, M80-1)', () => {
  it('a sealed live session', () => {
    const h = harness();
    h.record();
    h.run(3_000);
    h.sim.actions.addMarker('Key statement');
    h.sim.actions.addNote('Subject confirmed identity');
    h.sim.actions.inject('GNSS_LOSS');
    h.run(2_000);
    h.seal();
    const item = h.state().evidence.at(-1);
    expect(item).toMatchObject({ caseType: 'SAKSI', startTimeSource: 'GNSS', endTimeSource: 'NTP', integritySource: 'SIMULATED' });
    expect(item?.markers).toEqual([expect.objectContaining({ index: 1, label: 'Key statement' })]);
    expect(item?.notes?.map((note) => note.text)).toEqual(['Subject confirmed identity']);
    const entry = h.state().sessionHistory.find((history) => history.id === item?.sessionId);
    expect(entry).toMatchObject({ startTimeSource: 'GNSS', endTimeSource: 'NTP' });
  });

  it('an incomplete (power fail) session records the source at the fault', () => {
    const h = harness();
    h.record();
    h.run(2_000);
    h.sim.actions.inject('POWER_FAIL');
    h.sim.actions.recover();
    h.run(4_000);
    const entry = h.state().sessionHistory[0];
    expect(entry).toMatchObject({ outcome: 'INCOMPLETE', startTimeSource: 'GNSS', endTimeSource: 'GNSS' });
    // The reboot restarted every service.
    expect(h.state().services.every((service) => typeof service.startedAt === 'number' && service.startedAt > START)).toBe(true);
  });

  it('dataset history entries carry GNSS', () => {
    expect(harness().state().sessionHistory.every((entry) => entry.startTimeSource === 'GNSS' && entry.endTimeSource === 'GNSS')).toBe(true);
  });
});

describe('storage (W44-1, W49-1, W49-2, F-49-1, F-49-2)', () => {
  it('write-rate history: 120 back-filled idle points at load, then the measured rate (nominal ±3%) while recording', () => {
    const h = harness();
    expect(selectWriteRateHistory(h.state())).toHaveLength(SERIES_POINTS);
    expect(selectWriteRateHistory(h.state()).every((point) => point.bytesPerSec === 0)).toBe(true);
    h.record();
    h.run(10_000);
    const nominal = Math.round(RECORDING_BYTES_PER_HOUR / 3_600);
    const recent = selectWriteRateHistory(h.state()).slice(-8);
    expect(recent.every((point) => Math.abs(point.bytesPerSec - nominal) <= nominal * 0.03 + 1)).toBe(true);
    expect(new Set(recent.map((point) => point.bytesPerSec)).size).toBeGreaterThan(1);
    expect(h.state().storage.writeBytesPerSec).toBe(nominal); // AC-54 keeps the nominal rate
  });

  it('a STORAGE_FULL demo fill never becomes a spike in the 24 h history (F-49-2)', () => {
    const h = harness();
    h.run(1_500);
    const before = h.state().storage.history.at(-1)?.usedBytes ?? 0;
    h.sim.actions.inject('STORAGE_FULL');
    h.run(2_000);
    expect(h.state().storage.state).toBe('FULL');
    expect(h.state().storage.history.at(-1)?.usedBytes).toBe(before);
  });

  it('drive health per volume (synthetic SMART, live temperatures)', () => {
    const drives = selectDriveHealth(harness().state());
    expect(drives.map((drive) => [drive.id, drive.smart, drive.tempLevel])).toEqual([
      ['NVME-SYS', 'PASSED', 'OK'],
      ['HDD-EVIDENCE', 'PASSED', 'OK'],
    ]);
    expect(drives[1]).toMatchObject({ reallocatedSectors: 0, pendingSectors: 0, wearPercent: null });
  });

  it('storage activity: storage-relevant events, incl. the storage faults, newest first', () => {
    const h = harness();
    h.sim.actions.inject('STORAGE_LOW');
    h.sim.actions.inject('FAN_STALL');
    const activity = selectStorageActivity(h.state(), 3);
    expect(activity[0]).toMatchObject({ type: 'FAULT_RAISED', params: { kind: 'STORAGE_LOW' } });
    expect(activity.some((event) => event.params.kind === 'FAN_STALL')).toBe(false);
  });

  it('setStoragePolicy: TECHNICIAN may, INVESTIGATOR may not (F-49-1)', () => {
    expect(() => harness().sim.actions.setStoragePolicy({ retentionPolicy: 'YEAR_1' })).toThrow(SimPermissionError);
    const h = harness('idle', 'rina.wijaya');
    h.sim.actions.setStoragePolicy({ retentionPolicy: 'YEAR_1' });
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'STORAGE_POLICY_CHANGED', actorId: 'OPR-003' });
  });
});

describe('exports (W47-4, W51-1, W52-7)', () => {
  it('evidence and audit exports share one counter after EXP-000031', () => {
    const h = harness('idle', 'andi.pratama');
    const sealed = h.state().evidence.find((item) => item.status === 'SEALED')?.id ?? '';
    expect(h.sim.actions.exportEvidence(sealed, { reason: 'Prosecutor request', destination: '' })).toMatchObject({ exportId: 'EXP-000032' });
    expect(h.sim.actions.exportAudit()).toMatchObject({ exportId: 'EXP-000033' });
  });

  it('exportAudit(request): 422 below 5 characters (no row), 202 with the reason in the AUDIT_EXPORTED row', () => {
    const h = harness('idle', 'andi.pratama');
    const total = h.state().audit.total;
    expect(h.sim.actions.exportAudit({ reason: 'no' })).toEqual({ ok: false, status: 422, reason: 'INVALID_REASON' });
    expect(h.state().audit.total).toBe(total);
    expect(h.sim.actions.exportAudit({ reason: 'Quarterly audit review' })).toMatchObject({ ok: true, status: 202 });
    expect(h.state().audit.rows.at(-1)).toMatchObject({
      type: 'AUDIT_EXPORTED',
      details: { reason: 'Quarterly audit review', destination: 'Audit archive (simulated)', chainOk: true },
    });
    // RBAC first: an INVESTIGATOR gets 403 (audited) even with a bad reason.
    expect(harness().sim.actions.exportAudit({ reason: 'no' })).toMatchObject({ status: 403 });
  });

  it('exportLogs: AUDIT_EXPORT RBAC, scope LOGS, and a bundle of the audit ring and the events', () => {
    expect(harness().sim.actions.exportLogs()).toMatchObject({ ok: false, status: 403 });
    const h = harness('idle', 'andi.pratama');
    const result = h.sim.actions.exportLogs({ reason: 'Support ticket 42' });
    expect(result).toMatchObject({ ok: true, status: 202 });
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'AUDIT_EXPORTED', details: { scope: 'LOGS', reason: 'Support ticket 42' } });
    const bundle = logBundle(h.state(), result.ok ? result.exportId : null);
    expect(bundle).toMatchObject({ schema: 'dems.log-bundle/1', simulated: true, deviceId: 'DEMS-IR-01' });
    expect(bundle.audit.head).toBe(h.state().audit.head);
    expect(bundle.events.length).toBe(h.state().events.length);
  });
});

describe('System & Maintenance (W52-1, W52-2, W52-3, W52-4, W52-5, W52-8)', () => {
  it('restartServices: MAINTENANCE only, refused during a session, one DEVICE_COMMAND row, uptime restarts', () => {
    expect(() => harness().sim.actions.restartServices()).toThrow(SimPermissionError);
    const busy = harness('recording', 'rina.wijaya');
    expect(simErrorCode(thrown(() => busy.sim.actions.restartServices()))).toBe('SESSION_ACTIVE');
    const h = harness('idle', 'rina.wijaya');
    const bootSince = selectServicesSince(h.state());
    expect(bootSince).toBeLessThan(START);
    h.run(2_000);
    expect(h.sim.actions.restartServices()).toBe(17);
    expect(h.state().audit.rows.at(-1)).toMatchObject({
      type: 'DEVICE_COMMAND',
      actorId: 'OPR-003',
      details: { command: 'RESTART', scope: 'CORE_SERVICES', services: 17 },
    });
    expect(selectServicesSince(h.state())).toBe(h.clock.now());
  });

  it('settings: presentation mode needs no sign-in, invalid patches are ignored, scenarios keep settings', () => {
    const h = harness('idle', null);
    expect(selectPresentationMode(h.state())).toBe(false);
    h.sim.actions.setPresentationMode(true);
    expect(selectPresentationMode(h.state())).toBe(true);
    const before = h.state().settings;
    h.sim.actions.updateSettings({ timeFormat: '13' as never, notifySound: 'yes' as never });
    expect(h.state().settings).toBe(before);
    h.sim.actions.updateSettings({ timeFormat: '12' });
    expect(h.state().settings).toEqual({ presentationMode: true, timeFormat: '12', notifyWarnings: true, notifySound: false });
    h.sim.actions.loadScenario('recording');
    expect(h.state().settings.presentationMode).toBe(true);
  });

  it('resetDemo: a fresh idle dataset, audited as a reset', () => {
    const h = harness();
    h.sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-02' });
    h.sim.actions.resetDemo();
    expect(h.state().faults.active).toEqual([]);
    expect(h.state().mics.every((mic) => !mic.clipLatched)).toBe(true);
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'SCENARIO_LOADED', details: { scenario: 'idle', reset: true } });
  });

  it('release info is synthetic, deterministic and stable per version', () => {
    const h = harness();
    expect(selectReleaseInfo(h.state())).toBe(selectReleaseInfo(h.state()));
    expect(releaseInfo('2.4.1')).toEqual(releaseInfo('2.4.1'));
    expect(selectReleaseInfo(h.state())).toMatchObject({ version: '2.4.1', components: 27, format: 'SPDX 2.3 (synthetic)' });
  });

  it('settings persist in the snapshot, and a snapshot from before step 54 (no settings) still resumes', async () => {
    const memory = createMemoryStateStorage();
    const storage = createJSONStorage<SimSnapshot>(() => memory) as SimPersistStorage;
    const first = harness('idle', null, storage);
    await first.sim.ready;
    first.sim.actions.setPresentationMode(true);
    first.sim.flush();
    const second = harness('idle', null, storage);
    await second.sim.ready;
    expect(second.sim.wasRestored()).toBe(true);
    expect(selectPresentationMode(second.state())).toBe(true);

    const raw = JSON.parse(memory.getItem('dems.sim.v1') as string) as { state: Record<string, unknown> };
    delete raw.state.settings;
    memory.setItem('dems.sim.v1', JSON.stringify(raw));
    const legacy = harness('idle', null, storage);
    await legacy.sim.ready;
    expect(legacy.sim.wasRestored()).toBe(true);
    expect(legacy.state().settings.presentationMode).toBe(false);
  });
});

describe('Login: the last sign-out reason (W43-2)', () => {
  it('USER, LOCK, EXPIRED, and null after the next sign-in', () => {
    const h = harness();
    h.sim.actions.signOut();
    expect(selectLastSignOut(h.state())).toMatchObject({ reason: 'USER', operatorId: 'OPR-001' });
    expect(selectLastSignOut(h.state())).toBe(selectLastSignOut(h.state()));
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    expect(selectLastSignOut(h.state())).toBeNull();
    h.sim.actions.signOut('LOCK');
    expect(selectLastSignOut(h.state())?.reason).toBe('LOCK');
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    h.run(15 * 60_000 + 2_000, 1_000);
    expect(selectLastSignOut(h.state())?.reason).toBe('EXPIRED');
  });
});

describe('Devices (W48-1..5)', () => {
  it('PoE status follows the book: PoE CAM 1 powered, CAM 2/AUX spare', () => {
    expect(selectPoeStatus(harness().state())).toMatchObject({
      cam1Link: true,
      poweredPorts: 1,
      sparePorts: 1,
      healthyPorts: 2,
      totalPorts: 2,
      budgetW: 60,
      drawW: 18.6,
      portBudgetW: 30,
    });
  });

  it('GNSS and TPM are devices; IDENTIFY works on every device and writes an audit row', () => {
    const h = harness();
    expect(selectPlatformDevices(h.state()).map((device) => [device.id, device.online, device.status])).toEqual([
      ['GNSS', true, 'LOCKED'],
      ['TPM', true, 'OK'],
      ['FRONT-PANEL', true, 'ON'],
    ]);
    h.sim.actions.inject('GNSS_LOSS');
    h.sim.actions.inject('TPM_FAILURE');
    expect(selectPlatformDevices(h.state()).map((device) => device.online)).toEqual([false, false, true]);
    h.sim.actions.deviceCommand('GNSS', 'IDENTIFY');
    expect(h.state().audit.rows.at(-1)).toMatchObject({
      type: 'DEVICE_COMMAND',
      deviceId: 'GNSS',
      actorId: 'OPR-001',
      details: { command: 'IDENTIFY', blinks: 3, periodMs: 500 },
    });
    h.sim.actions.deviceCommand('CAM-01', 'IDENTIFY');
    expect(simErrorCode(thrown(() => h.sim.actions.deviceCommand('TPM', 'TEST_SIGNAL')))).toBe('COMMAND_UNSUPPORTED');
  });

  it('RESTART is refused while recording, even for a TECHNICIAN (D79)', () => {
    const h = harness('recording', 'rina.wijaya');
    const error = thrown(() => h.sim.actions.deviceCommand('CAM-01', 'RESTART'));
    expect(error).toBeInstanceOf(SimTransitionError);
    expect(simErrorCode(error)).toBe('RECORDING_ACTIVE');
  });

  it('front panel: LEDs and LCD follow the session and the faults', () => {
    const idle = harness();
    expect(selectFrontPanel(idle.state())).toMatchObject({
      leds: { POWER: 'on', RECORD: 'off', NETWORK: 'activity', STORAGE: 'on', FAULT: 'off' },
      lcd: { mode: 'IDLE', camsOk: 2, micsOk: 2, timeSource: 'GNSS' },
    });
    const rec = harness('recording');
    rec.sim.actions.inject('STORAGE_FULL');
    expect(selectFrontPanel(rec.state()).leds).toMatchObject({ RECORD: 'fault', STORAGE: 'fault', FAULT: 'fault' });
    expect(selectFrontPanel(rec.state()).lcd.mode).toBe('FAULT');
  });

  it('per-device health series: microphones from the 1 Hz level history (full at load)', () => {
    const h = harness('recording');
    const mic = deviceHealthSeries(h.state(), 'MIC-02');
    expect(mic).toMatchObject({ metric: 'signal', domain: [-90, 0], unit: 'dbfs' });
    expect(mic.points).toHaveLength(90);
    h.run(3_000);
    const live = deviceHealthSeries(h.state(), 'MIC-02').points.at(-1);
    expect(live?.v).toBeGreaterThan(-60);
    expect(deviceHealthSeries(h.state(), 'GNSS').metric).toBe('offset');
    expect(deviceHealthSeries(h.state(), 'POE-SWITCH').points.at(-1)?.v).toBe(18.6);
  });
});

describe('Network & Time (W50-1..4)', () => {
  it('domain states move with the cameras, the update and an export', () => {
    const h = harness('idle', 'andi.pratama');
    expect(selectDomainStates(h.state())).toEqual({
      CAMERA: 'ACTIVE',
      MANAGEMENT: 'ACTIVE',
      SERVICE_UPDATE: 'RESTRICTED',
      EXPORT_TRANSFER: 'ON_DEMAND',
    });
    h.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-02' });
    const sealed = h.state().evidence.find((item) => item.status === 'SEALED')?.id ?? '';
    h.sim.actions.exportEvidence(sealed, { reason: 'Prosecutor request', destination: '' });
    h.run(1_000);
    expect(selectDomainStates(h.state())).toMatchObject({ CAMERA: 'DEGRADED', EXPORT_TRANSFER: 'TRANSFER' });
    h.run(21_000, 500);
    expect(selectDomainStates(h.state()).EXPORT_TRANSFER).toBe('ON_DEMAND');
  });

  it('A/V sync degrades on the RTC fallback and on a lost microphone', () => {
    const h = harness();
    expect(selectAvSync(h.state())).toEqual({ state: 'HEALTHY', source: 'GNSS', locked: true });
    h.sim.actions.inject('GNSS_LOSS', { fallback: 'RTC' });
    expect(selectAvSync(h.state()).state).toBe('DEGRADED');
  });

  it('event categories (faults by kind) and the network/time event list', () => {
    const h = harness();
    h.sim.actions.inject('GNSS_LOSS');
    const raised = h.state().events.at(-1);
    expect(raised && eventCategory(raised)).toBe('TIME');
    expect(eventCategory({ type: 'EVIDENCE_EXPORTED', params: {} })).toBe('EXPORT');
    expect(selectNetworkTimeEvents(h.state(), 1)[0]).toBe(raised);
  });

  it('offset, bandwidth and health histories are full at load (back-filled since boot)', () => {
    const state = harness().state();
    expect(state.network.bandwidth.history).toHaveLength(SERIES_POINTS);
    expect(state.time.history).toHaveLength(SERIES_POINTS);
    expect(state.health.series).toHaveLength(SERIES_POINTS);
    expect(state.time.history.every((point) => point.at < START && point.source === 'GNSS')).toBe(true);
    const times = state.network.bandwidth.history.map((point) => point.at);
    expect(times.every((at, index) => index === 0 || at > (times[index - 1] ?? 0))).toBe(true);
  });
});
