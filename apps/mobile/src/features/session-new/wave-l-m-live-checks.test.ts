// Fix wave L, driver L-M - re-check 70 finding G70c-06: on the tablet's Session New with the Core link
// down, the banner said "Core server unreachable" while the card "Live device status" beside it still
// read "Core Machine ONLINE", "Video Lens 1 READY" (the Core's last report). ONE statement of the link
// per screen: while the link is down the Core row says OFFLINE and every other row says "Not known".
// The wiring (`LiveDeviceColumn` reads `useCoreLinkNotice()`) was proven on the tablet with the link cut
// (implementation/155_fix_wave_l_m.md); the rule is held here.
import { describe, expect, it } from '@jest/globals';
import { FEATURE_RESOURCES } from '@/i18n/features';
import { CHECK_ORDER, liveCheckWhileLinkDown } from './session-new-model';

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
