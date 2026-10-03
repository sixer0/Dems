// Pure Settings models and the prefs parser (step 88; 04_mobile_specs §4.15, §5.3; D57, D88).
import { describe, expect, it } from '@jest/globals';
import { CRITICAL_FAULTS, FaultKind } from '@dems/shared/sim';
import { MOBILE_PREFS_KEY } from '@/motion';
import {
  AUTO_LOCK_POLICY_MINUTES,
  DEMO_FAULTS,
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

describe('settings model', () => {
  it('MB 10 rows: Application 3, System 5, in mockup order; System opens the existing screens', () => {
    expect(rowsOf('application').map((row) => row.id)).toEqual(['preferences', 'notifications', 'security']);
    expect(rowsOf('system').map((row) => row.id)).toEqual(['devices', 'storage', 'network-time', 'maintenance', 'about']);
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
