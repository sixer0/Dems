// Pure Settings models and the prefs parser (step 88; 04_mobile_specs §4.15, §5.3; D57, D88).
import { describe, expect, it } from '@jest/globals';
import { CRITICAL_FAULTS, FAULT_SEVERITY, FaultKind } from '@dems/shared/sim';
import { MOBILE_PREFS_KEY } from '@/motion';
import {
  ALWAYS_SHOWN_KINDS,
  AUTO_LOCK_POLICY_MINUTES,
  DEMO_FAULTS,
  NOTIFICATION_KINDS,
  SETTINGS_ROWS,
  biometricSwitchView,
  isDemoFaultActive,
  paneSection,
  permissionsOf,
  rowsOf,
  shouldNotify,
  summarizeDiagnostics,
  updateStepStatuses,
  DEFAULT_NOTIFICATION_PREFS,
} from './settings-model';
import { parseSettingsPrefs } from './settings-prefs';
import { ALERT_TOAST_LABEL_MAX, NO_ALERT_TOASTS, alertToastKind, alertToastLabel, alertToastStep } from '@/features/alerts/alert-toasts-model';
import type { SimAlert } from '@dems/shared/sim';

describe('settings model', () => {
  it('MB 10 rows: Application 3, System 7 (5 of MB 10 + Capture, row 68 + Transcription status, row 118), in mockup order; System opens the existing screens', () => {
    expect(rowsOf('application').map((row) => row.id)).toEqual(['preferences', 'notifications', 'security']);
    expect(rowsOf('system').map((row) => row.id)).toEqual(['devices', 'storage', 'network-time', 'capture', 'transcription', 'maintenance', 'about']);
    expect(SETTINGS_ROWS.filter((row) => row.target.kind === 'route').map((row) => row.target)).toEqual([
      { kind: 'route', href: '/devices' },
      { kind: 'route', href: '/storage' },
      { kind: 'route', href: '/network-time' },
    ]);
    expect(paneSection(null)).toBe('preferences');
    expect(paneSection('about')).toBe('about');
  });

  it('demo faults: the §4.15 nine, MIC targets, critical flags match the simulator', () => {
    expect(DEMO_FAULTS.map((spec) => spec.kind)).toEqual([
      'CAMERA_LOSS',
      'MIC_CLIP',
      'MIC_NO_SIGNAL',
      'STORAGE_LOW',
      'STORAGE_FULL',
      'GNSS_LOSS',
      'TAMPER',
      'FAN_STALL',
      'POWER_FAIL',
    ]);
    for (const spec of DEMO_FAULTS) expect(spec.critical).toBe((CRITICAL_FAULTS as readonly string[]).includes(spec.kind));
    const clip = DEMO_FAULTS[1]!;
    expect(isDemoFaultActive([{ kind: FaultKind.MIC_CLIP, target: 'AUDIO-01' }], clip)).toBe(false);
    expect(isDemoFaultActive([{ kind: FaultKind.MIC_CLIP, target: 'AUDIO-02' }], clip)).toBe(true);
    const tamper = DEMO_FAULTS[6]!;
    expect(isDemoFaultActive([{ kind: FaultKind.TAMPER, target: 'evidence:EV-1:VIDEO-01' }], tamper)).toBe(false);
    expect(isDemoFaultActive([{ kind: FaultKind.TAMPER, target: null }], tamper)).toBe(true);
    expect(isDemoFaultActive([{ kind: FaultKind.CAMERA_LOSS, target: 'VIDEO-02' }], DEMO_FAULTS[0]!)).toBe(true);
  });

  it('notifications: switched categories filter their kinds; critical kinds always notify', () => {
    const off = { ...DEFAULT_NOTIFICATION_PREFS, devices: false };
    expect(shouldNotify(FaultKind.MIC_CLIP, off)).toBe(false);
    expect(shouldNotify(FaultKind.STORAGE_LOW, off)).toBe(true);
    const allOff = { devices: false, storage: false, time: false, system: false };
    for (const kind of CRITICAL_FAULTS) expect(shouldNotify(kind, allOff)).toBe(true);
  });

  // Fix wave Q (CP-06): Settings listed "Camera loss" under a switch, and a camera loss shows whatever that switch says.
  it('CP-06: no switch lists a kind whose alerts are CRITICAL; the critical kinds are the "always shown" list, a camera loss among them', () => {
    const switched = Object.values(NOTIFICATION_KINDS).flat();
    expect(switched.filter((kind) => FAULT_SEVERITY[kind] === 'CRITICAL')).toEqual([]);
    expect(switched.length).toBeGreaterThan(0);
    expect(ALWAYS_SHOWN_KINDS).toContain(FaultKind.CAMERA_LOSS);
    expect(ALWAYS_SHOWN_KINDS).toContain(FaultKind.AUDIT_TAMPER);
    for (const kind of ALWAYS_SHOWN_KINDS) expect([kind, FAULT_SEVERITY[kind]]).toEqual([kind, 'CRITICAL']);
    for (const kind of CRITICAL_FAULTS) expect(ALWAYS_SHOWN_KINDS).toContain(kind);
    const allOff = { devices: false, storage: false, time: false, system: false };
    for (const kind of ALWAYS_SHOWN_KINDS) expect([kind, alertToastKind({ kind, severity: FAULT_SEVERITY[kind] }, allOff)]).toEqual([kind, 'critical']);
  });

  // Fix wave J (JA2-05): the consumer of the switches (`<AlertToasts />`, `features/alerts`). Before it, nothing read them.
  describe('notifications: the alert-toast consumer of the switches (JA2-05)', () => {
    const alert = (id: string, kind: SimAlert['kind'], severity: SimAlert['severity'], over: Partial<SimAlert> = {}): SimAlert => ({ id, at: 1, severity, kind, message: kind, active: true, acknowledged: false, resolvedAt: null, ...over });
    const ON = DEFAULT_NOTIFICATION_PREFS;
    const ALL_OFF = { devices: false, storage: false, time: false, system: false };

    it('severity decides first: CRITICAL always toasts; a warning follows its switch; INFO and SUCCESS never toast', () => {
      for (const kind of CRITICAL_FAULTS) expect([kind, alertToastKind({ kind, severity: 'CRITICAL' }, ALL_OFF)]).toEqual([kind, 'critical']);
      expect(alertToastKind({ kind: FaultKind.STORAGE_LOW, severity: 'WARNING' }, ON)).toBe('warning');
      expect(alertToastKind({ kind: FaultKind.STORAGE_LOW, severity: 'WARNING' }, { ...ON, storage: false })).toBeNull();
      expect(alertToastKind({ kind: FaultKind.MIC_CLIP, severity: 'WARNING' }, { ...ON, storage: false })).toBe('warning');
      expect(alertToastKind({ kind: FaultKind.GNSS_LOSS, severity: 'WARNING' }, { ...ON, time: false })).toBeNull();
      expect(alertToastKind({ kind: 'SYSTEM', severity: 'INFO' }, ON)).toBeNull();
      expect(alertToastKind({ kind: 'SYSTEM', severity: 'SUCCESS' }, ON)).toBeNull();
    });

    it('one toast per alert id: a slice replicated again raises nothing; a critical one is persistent', () => {
      const critical = alert('ALR-1', FaultKind.STORAGE_FULL, 'CRITICAL');
      const warning = alert('ALR-2', FaultKind.STORAGE_LOW, 'WARNING');
      const started = alertToastStep(NO_ALERT_TOASTS, [], ON, true);
      const first = alertToastStep(started.state, [critical, warning], ON, false);
      expect(first.show.map((entry) => [entry.alert.id, entry.persistent])).toEqual([['ALR-1', true], ['ALR-2', false]]);
      const again = alertToastStep(first.state, [{ ...critical }, { ...warning }], ON, false);
      expect([again.show, again.hide]).toEqual([[], []]);
    });

    it('a critical toast leaves when the alert is acknowledged, resolved, or gone - a warning that was there at the start is never announced', () => {
      const critical = alert('ALR-1', FaultKind.TPM_FAILURE, 'CRITICAL');
      const atStart = alertToastStep(NO_ALERT_TOASTS, [critical, alert('ALR-2', FaultKind.FAN_STALL, 'WARNING')], ON, true);
      // At the start: the unacknowledged critical alert is shown at once ("stays until acknowledged"); the warning is not.
      expect(atStart.show.map((entry) => entry.alert.id)).toEqual(['ALR-1']);
      expect(alertToastStep(atStart.state, [{ ...critical, acknowledged: true }], ON, false).hide).toEqual(['ALR-1']);
      expect(alertToastStep(atStart.state, [{ ...critical, active: false }], ON, false).hide).toEqual(['ALR-1']);
      expect(alertToastStep(atStart.state, [], ON, false).hide).toEqual(['ALR-1']);
      // An acknowledged critical alert found at the start raises no toast.
      expect(alertToastStep(NO_ALERT_TOASTS, [{ ...critical, acknowledged: true }], ON, true).show).toEqual([]);
    });

    // Fix wave Q (CT-04: the critical toast of a blocked seal was five lines across the window - the Core's whole
    // notice, word for word what the page under it says).
    it('CT-04: a toast carries the first sentence of the alert\'s words, never more than the cap; a short label is unchanged', () => {
      expect(alertToastLabel('Storage full')).toBe('Storage full');
      expect(alertToastLabel('Camera 2 (CAM-02): not reachable')).toBe('Camera 2 (CAM-02): not reachable');
      const notice =
        'Sealing of session SES-20261012-0106 is blocked after 3 attempts. The recording is kept on the Core. To seal it: an investigator or a supervisor presses "Retry sealing" on the Session Monitor of the web console or on the session\'s screen of the tablet or phone, or the Core is restarted.';
      expect(alertToastLabel(notice)).toBe('Sealing of session SES-20261012-0106 is blocked after 3 attempts.');
      // An id, a decimal and a time hold no sentence break.
      expect(alertToastLabel('MIC-01 at 1.5 dB over the limit at 13:04:08')).toBe('MIC-01 at 1.5 dB over the limit at 13:04:08');
      // One very long sentence is cut on a word, with an ellipsis.
      const long = `${'word '.repeat(60)}end`;
      const cut = alertToastLabel(long);
      expect(cut.length).toBeLessThanOrEqual(ALERT_TOAST_LABEL_MAX + 1);
      expect(cut.endsWith('…')).toBe(true);
      expect(cut).not.toMatch(/\s…$/);
    });

    it('a switch that is off silences NEW warnings of its category only; turning it on later announces only later alerts', () => {
      const started = alertToastStep(NO_ALERT_TOASTS, [], ALL_OFF, true);
      const silent = alertToastStep(started.state, [alert('ALR-3', FaultKind.STORAGE_LOW, 'WARNING')], ALL_OFF, false);
      expect(silent.show).toEqual([]);
      const later = alertToastStep(silent.state, [alert('ALR-3', FaultKind.STORAGE_LOW, 'WARNING'), alert('ALR-4', FaultKind.STORAGE_LOW, 'WARNING')], ON, false);
      expect(later.show.map((entry) => entry.alert.id)).toEqual(['ALR-4']);
    });
  });

  it('biometric switch: on only for the bound operator; needs enrolled hardware to turn on', () => {
    expect(biometricSwitchView('available', true, 'OPR-001', 'OPR-001')).toMatchObject({ selected: true, disabled: false, boundToOther: false });
    expect(biometricSwitchView('available', true, 'OPR-002', 'OPR-001')).toMatchObject({ selected: false, disabled: false, boundToOther: true });
    expect(biometricSwitchView('not-enrolled', false, null, 'OPR-001')).toMatchObject({ selected: false, disabled: true, statusKey: 'mobile.biometric.notEnrolled' });
    expect(biometricSwitchView('unknown', false, null, 'OPR-001').statusKey).toBe('features.settings.security.biometricChecking');
    expect(AUTO_LOCK_POLICY_MINUTES).toBe(15);
  });

  it('permissions follow the simulator RBAC; diagnostics and update views', () => {
    expect(permissionsOf('INVESTIGATOR')).toContain('SESSION_START');
    expect(permissionsOf('INVESTIGATOR')).not.toContain('EVIDENCE_EXPORT');
    expect(summarizeDiagnostics(null)).toBeNull();
    expect(
      summarizeDiagnostics({
        id: 'DIAG-1',
        startedAt: 0,
        completedAt: null,
        checks: [
          { id: 'CPU', label: 'CPU', status: 'PASS', detail: null },
          { id: 'FAN', label: 'FAN', status: 'WARN', detail: null },
          { id: 'TIME', label: 'TIME', status: 'RUNNING', detail: null },
        ],
      }),
    ).toEqual({ done: 2, total: 3, pass: 1, warn: 1, fail: 0, complete: false });
    expect(
      updateStepStatuses({
        currentVersion: '2.4.1',
        availableVersion: '2.5.0',
        activeSlot: 'A',
        state: 'RUNNING',
        startedAt: 0,
        completedAt: null,
        steps: [
          { id: 'SIGNATURE_VERIFICATION', status: 'done' },
          { id: 'COMPATIBILITY_CHECK', status: 'active' },
          { id: 'ANTI_ROLLBACK_POLICY', status: 'pending' },
        ],
      }),
    ).toEqual(['done', 'running', 'pending']);
  });
});

describe('settings prefs parser (dems.mobile.prefs.v1)', () => {
  it('reads only the Settings fields; mistyped fields count as absent; partial notifications fill from defaults', () => {
    expect(parseSettingsPrefs(null)).toEqual({});
    expect(parseSettingsPrefs(JSON.stringify({ presentationMode: true, meterSize: 'compact', reduceMotion: true, railCollapsed: true }))).toEqual({
      presentationMode: true,
      meterSize: 'compact',
    });
    expect(parseSettingsPrefs(JSON.stringify({ presentationMode: 'yes', meterSize: 'huge', notifications: { storage: false, time: 'no' } }))).toEqual({
      notifications: { devices: true, storage: false, time: true, system: true },
    });
    expect(() => parseSettingsPrefs('[1]')).toThrow(`${MOBILE_PREFS_KEY} is not a JSON object`);
  });
});
