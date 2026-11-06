// Backend task, plan row W82: the pure parts of Settings in LIVE mode (04_client_integration_spec §3.3,
// §9.3 MB-1, MB-6a, §9.5; AC-C-31, AC-C-52, AC-C-68; finding CPM1-1). The step-88 model test
// (`settings-model.test.ts`) is a baseline file and stays as it is; this file adds the new inputs.
import { describe, expect, it } from '@jest/globals';
import { getMissingKeys, i18n, resetMissingKeys } from '@/i18n';
import '@/auth';
import {
  BIOMETRIC_NOTE_CHANGE_BLOCKED,
  BIOMETRIC_NOTE_LIVE,
  BIOMETRIC_NOTE_LIVE_PROTECTED,
  BIOMETRIC_NOTE_SIMULATED,
  biometricSwitchView,
  crossesLiveBoundary,
  dataModeOf,
  demoControlsAccess,
} from './settings-model';

describe('the LIVE boundary of the Core link source (§3.3)', () => {
  it('only a change into or out of LIVE crosses it; SIMULATED <-> HEARTBEAT and no change do not', () => {
    const table: [Parameters<typeof crossesLiveBoundary>[0], Parameters<typeof crossesLiveBoundary>[1], boolean][] = [
      ['SIMULATED', 'LIVE', true],
      ['HEARTBEAT', 'LIVE', true],
      ['LIVE', 'SIMULATED', true],
      ['LIVE', 'HEARTBEAT', true],
      ['SIMULATED', 'HEARTBEAT', false],
      ['HEARTBEAT', 'SIMULATED', false],
      ['LIVE', 'LIVE', false],
      ['SIMULATED', 'SIMULATED', false],
    ];
    for (const [from, to, crosses] of table) expect({ from, to, crosses: crossesLiveBoundary(from, to) }).toEqual({ from, to, crosses });
  });

  it('the data mode a source shows: HEARTBEAT is SIMULATED data (§3.1)', () => {
    expect(dataModeOf('SIMULATED')).toBe('SIMULATED');
    expect(dataModeOf('HEARTBEAT')).toBe('SIMULATED');
    expect(dataModeOf('LIVE')).toBe('LIVE');
  });
});

describe('the biometric switch (CPM1-1, MB-1, MB-6a, AC-C-68)', () => {
  it('without LIVE inputs it is exactly the step-88 view, with the simulated note', () => {
    const view = biometricSwitchView('available', true, 'OPR-001', 'OPR-001');
    expect(view).toEqual({ selected: true, disabled: false, statusKey: 'features.settings.security.biometricAvailable', boundToOther: false, noteKey: BIOMETRIC_NOTE_SIMULATED, changeBlocked: false });
    expect(biometricSwitchView('not-enrolled', false, null, 'OPR-001')).toMatchObject({ selected: false, disabled: true, noteKey: BIOMETRIC_NOTE_SIMULATED });
  });

  it('LIVE: worded on how the token is stored; a session created with the fingerprint disables it whatever else holds', () => {
    expect(biometricSwitchView('available', false, null, 'OPR-002', { changeBlocked: false, protected: null })).toMatchObject({ disabled: false, noteKey: BIOMETRIC_NOTE_LIVE });
    expect(biometricSwitchView('available', true, 'OPR-002', 'OPR-002', { changeBlocked: false, protected: false })).toMatchObject({ selected: true, disabled: false, noteKey: BIOMETRIC_NOTE_LIVE });
    expect(biometricSwitchView('available', true, 'OPR-002', 'OPR-002', { changeBlocked: false, protected: true })).toMatchObject({ noteKey: BIOMETRIC_NOTE_LIVE_PROTECTED });
    for (const availability of ['available', 'not-enrolled', 'unavailable', 'unknown'] as const) {
      expect(biometricSwitchView(availability, true, 'OPR-002', 'OPR-002', { changeBlocked: true, protected: true })).toMatchObject({
        selected: true,
        disabled: true,
        changeBlocked: true,
        noteKey: BIOMETRIC_NOTE_CHANGE_BLOCKED,
      });
    }
  });

  it('the note keys resolve, and none of the LIVE ones says "simulated" or claims hardware protection (MB-6a (3))', () => {
    resetMissingKeys();
    const claims = /hardware|keystore|secure (?:enclave|element|chip)|protected by|encrypted|simulat/i;
    expect(i18n.t(BIOMETRIC_NOTE_SIMULATED)).toBe('Simulated identity binding');
    for (const key of [BIOMETRIC_NOTE_LIVE, BIOMETRIC_NOTE_LIVE_PROTECTED, BIOMETRIC_NOTE_CHANGE_BLOCKED]) {
      const text = i18n.t(key);
      expect({ key, claims: claims.test(text), resolved: text !== key }).toEqual({ key, claims: false, resolved: true });
    }
    expect(getMissingKeys()).toEqual([]);
  });
});

describe('who sees the Demo controls (AC-C-52)', () => {
  it('SIMULATED as before (presentation mode hides them); LIVE only with DEMO_CONTROL and the demo flag', () => {
    expect(demoControlsAccess({ presentationMode: false, live: false, permitted: false, demoFlag: false })).toBe('shown');
    expect(demoControlsAccess({ presentationMode: true, live: false, permitted: false, demoFlag: false })).toBe('presentation');
    expect(demoControlsAccess({ presentationMode: true, live: true, permitted: true, demoFlag: true })).toBe('presentation');
    expect(demoControlsAccess({ presentationMode: false, live: true, permitted: true, demoFlag: true })).toBe('shown');
    expect(demoControlsAccess({ presentationMode: false, live: true, permitted: true, demoFlag: false })).toBe('flag-off');
    expect(demoControlsAccess({ presentationMode: false, live: true, permitted: false, demoFlag: true })).toBe('not-permitted');
    // Fix wave Q (CT-07) REPLACES "the screen says NOT_PERMITTED whatever the flag": on a Core without its demo flag
    // no role has the controls, and every role reads that ONE caption - a supervisor and a technician alike.
    expect(demoControlsAccess({ presentationMode: false, live: true, permitted: false, demoFlag: false })).toBe('flag-off');
    expect(demoControlsAccess({ presentationMode: false, live: true, permitted: true, demoFlag: false })).toBe(demoControlsAccess({ presentationMode: false, live: true, permitted: false, demoFlag: false }));
  });
});
