/**
 * Session New pre-check: the selector mapping of the microphone checks and the role-keyed check ids
 * (task 3 row 68; register MB-02; ux spec §2, §8). Pure model. The rendered value line of a check row is
 * unchanged (`precheck.test.tsx` holds it); the role line is a second line under it.
 */
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CAPTURE_CONFIG, PRECHECK_ORDER, PrecheckCheckId } from '@dems/shared/sim';
import { CHECK_ORDER, checkMicBinding, micRoleLine, valueKey, liveCheckWhileLinkDown } from './session-new-model';
import { FEATURE_RESOURCES } from '@/i18n/features';

const idle = { session: null, captureConfig: DEFAULT_CAPTURE_CONFIG };
const swappedMics = DEFAULT_CAPTURE_CONFIG.mics.map((mic) => ({ ...mic, role: mic.role === 'PRIMARY' ? 'STANDBY' : 'PRIMARY' }));

describe('microphone checks and the selector (MB-02)', () => {
  it('the encoded line is the Core\'s current selector while idle, and the session\'s own snapshot once it holds one', () => {
    expect(micRoleLine(idle)).toBe('MIC-01:PRIMARY|MIC-02:STANDBY');
    // The selector may not change under a session (OD-10); if the store's did, the session's snapshot wins.
    expect(micRoleLine({ session: { state: 'ARMED', captureConfig: { mics: DEFAULT_CAPTURE_CONFIG.mics } }, captureConfig: { mics: swappedMics } })).toBe('MIC-01:PRIMARY|MIC-02:STANDBY');
    expect(micRoleLine({ session: { captureConfig: null }, captureConfig: { mics: swappedMics } })).toBe('MIC-01:STANDBY|MIC-02:PRIMARY');
  });

  it('MIC_1 / MIC_2 are bound by input; MIC_PRIMARY / MIC_STANDBY by role', () => {
    const line = micRoleLine(idle);
    expect(checkMicBinding('MIC_1', line)).toEqual({ inputId: 'MIC-01', role: 'PRIMARY' });
    expect(checkMicBinding('MIC_2', line)).toEqual({ inputId: 'MIC-02', role: 'STANDBY' });
    expect(checkMicBinding('MIC_PRIMARY', line)).toEqual({ inputId: 'MIC-01', role: 'PRIMARY' });
    expect(checkMicBinding('MIC_STANDBY', line)).toEqual({ inputId: 'MIC-02', role: 'STANDBY' });
  });

  it('follows a selector edit: after MIC-02 became primary, MIC_1 reads standby and MIC_PRIMARY names MIC-02', () => {
    const line = micRoleLine({ session: null, captureConfig: { mics: swappedMics } });
    expect(checkMicBinding('MIC_1', line)).toEqual({ inputId: 'MIC-01', role: 'STANDBY' });
    expect(checkMicBinding('MIC_PRIMARY', line)).toEqual({ inputId: 'MIC-02', role: 'PRIMARY' });
  });

  it('no binding for a check that is no microphone, for an empty selector, and for a malformed line', () => {
    const line = micRoleLine(idle);
    for (const id of ['CORE', 'LENS_1', 'LENS_2', 'STORAGE', 'TIME', 'SECURITY'] as const) expect(checkMicBinding(id, line)).toBeNull();
    expect(checkMicBinding('MIC_1', '')).toBeNull();
    expect(checkMicBinding('MIC_PRIMARY', 'MIC-01:LOUD|garbage')).toBeNull();
  });

  it('the role-keyed ids read the microphone state words, like the channel-keyed pair (not the lens words)', () => {
    expect(valueKey('MIC_PRIMARY', 'NO_SIGNAL')).toBe('common.enums.micState.NO_SIGNAL');
    expect(valueKey('MIC_STANDBY', 'CLIP')).toBe('common.enums.micState.CLIP');
    expect(valueKey('MIC_1', 'READY')).toBe('common.enums.micState.READY');
    expect(valueKey('LENS_1', 'READY')).toBe('common.enums.lensState.READY');
  });

  it('the rendered order is still the shared eight; every id of the vocabulary is a known id', () => {
    expect(CHECK_ORDER).toBe(PRECHECK_ORDER);
    expect(Object.keys(PrecheckCheckId)).toEqual(expect.arrayContaining(['MIC_PRIMARY', 'MIC_STANDBY']));
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-l-m-live-checks.test.ts` (test-suite consolidation, D233): every case as it was.
// Fix wave L, driver L-M - re-check 70 finding G70c-06: on the tablet's Session New with the Core link
// down, the banner said "Core server unreachable" while the card "Live device status" beside it still
// read "Core Machine ONLINE", "Video Lens 1 READY" (the Core's last report). ONE statement of the link
// per screen: while the link is down the Core row says OFFLINE and every other row says "Not known".
// The wiring (`LiveDeviceColumn` reads `useCoreLinkNotice()`) was proven on the tablet with the link cut
// (implementation/155_fix_wave_l_m.md); the rule is held here.
describe('Live device status while the link is down', () => {
describe('G70c-06 - a row of "Live device status" while the Core link is down', () => {
  it('the Core row states the one fact (OFFLINE, danger); every other row is "Not known" in a neutral tone', () => {
    expect(liveCheckWhileLinkDown('CORE', true)).toEqual({ key: 'common.enums.coreLinkState.OFFLINE', tone: 'danger' });
    for (const id of CHECK_ORDER.filter((check) => check !== 'CORE')) {
      expect(liveCheckWhileLinkDown(id, true)).toEqual({ key: 'features.session-new.devices.liveNotKnown', tone: 'default' });
    }
    expect(CHECK_ORDER).toContain('CORE');
  });

  it('CONTROL - the link is up: no row is overridden (each says its evaluated value)', () => {
    for (const id of CHECK_ORDER) expect(liveCheckWhileLinkDown(id, false)).toBeNull();
  });

  it('the words exist, and none of them says a device is online or ready', () => {
    const devices = (FEATURE_RESOURCES as unknown as Record<string, { devices: Record<string, string> }>)['session-new']!.devices;
    expect(devices.liveNotKnown).toBe('Not known');
    expect(devices.liveHintLinkDown).toBe('Not connected to the Core server. The device status is not known until the connection is back.');
    expect(`${devices.liveNotKnown} ${devices.liveHintLinkDown}`).not.toMatch(/online|ready/i);
  });
});
});
