// Fix pass F-M4 (review R69-01; decision D178): which local device a pre-check would turn on, decided
// from the two slices and the Live fact — the one rule of the notice on the tablet and the phone.
import { describe, expect, it } from '@jest/globals';
import { localSourceNoticeKey, localSourceNoticeOf } from './local-source-notice-model';

const SELECTOR = {
  cameras: [
    { trackId: 'VIDEO-01', deviceId: 'CAM-03' },
    { trackId: 'VIDEO-02', deviceId: 'CAM-02' },
  ],
  mics: [
    { inputId: 'MIC-03', role: 'PRIMARY', deviceId: 'MIC-03' },
    { inputId: 'MIC-02', role: 'STANDBY', deviceId: 'MIC-02' },
  ],
};
const LOCAL = { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' } as const;
const DEVICES = [
  { id: 'CAM-02', kind: 'CAMERA', sourceClass: 'PRODUCTION', adapter: 'ONVIF_RTSP' },
  { id: 'CAM-03', kind: 'CAMERA', ...LOCAL },
  { id: 'MIC-02', kind: 'MIC', sourceClass: 'DEVELOPMENT', adapter: 'FAKE' },
  { id: 'MIC-03', kind: 'MIC', ...LOCAL },
];

describe('localSourceNoticeOf', () => {
  it('names the local camera and the local microphone of the selector lines, in real capture (Live)', () => {
    expect(localSourceNoticeOf({ devices: DEVICES, selectors: [SELECTOR], live: true })).toEqual({ camera: 'CAM-03', microphone: 'MIC-03' });
  });

  it('one kind only: the other member is null', () => {
    expect(localSourceNoticeOf({ devices: DEVICES, selectors: [{ ...SELECTOR, mics: [SELECTOR.mics[1]!] }], live: true })).toEqual({ camera: 'CAM-03', microphone: null });
    expect(localSourceNoticeOf({ devices: DEVICES, selectors: [{ ...SELECTOR, cameras: [SELECTOR.cameras[1]!] }], live: true })).toEqual({ camera: null, microphone: 'MIC-03' });
  });

  it('CONTROL: a selector that names no local device -> null (a registered local device no line names does not count)', () => {
    const selector = { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }], mics: [{ inputId: 'MIC-02', role: 'PRIMARY', deviceId: 'MIC-02' }] };
    expect(localSourceNoticeOf({ devices: DEVICES, selectors: [selector], live: true })).toBeNull();
  });

  it('CONTROL: Simulated client mode, or a device the Core did not mark DEVELOPMENT -> null (the badge rule)', () => {
    expect(localSourceNoticeOf({ devices: DEVICES, selectors: [SELECTOR], live: false })).toBeNull();
    const unmarked = DEVICES.map((device) => ({ id: device.id, kind: device.kind, adapter: device.adapter }));
    expect(localSourceNoticeOf({ devices: unmarked, selectors: [SELECTOR], live: true })).toBeNull();
  });

  it('the open session\'s snapshot and the current selector both count; absent selectors are skipped', () => {
    const plain = { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }], mics: [] };
    expect(localSourceNoticeOf({ devices: DEVICES, selectors: [null, plain, SELECTOR], live: true })).toEqual({ camera: 'CAM-03', microphone: 'MIC-03' });
    expect(localSourceNoticeOf({ devices: DEVICES, selectors: [undefined, plain], live: true })).toBeNull();
  });
});

describe('localSourceNoticeKey', () => {
  it('the mobile wording: camera, microphone, or both', () => {
    expect(localSourceNoticeKey({ camera: 'CAM-03', microphone: null })).toBe('common.localSourceNotice.mobile.camera');
    expect(localSourceNoticeKey({ camera: null, microphone: 'MIC-03' })).toBe('common.localSourceNotice.mobile.microphone');
    expect(localSourceNoticeKey({ camera: 'CAM-03', microphone: 'MIC-03' })).toBe('common.localSourceNotice.mobile.both');
  });
});

describe('localSourceNoticeKey, kind START (decision D181 (7))', () => {
  it('the start wording: "... keep it on until the recording ends"', () => {
    expect(localSourceNoticeKey({ camera: 'CAM-03', microphone: null }, 'START')).toBe('common.localSourceStartNotice.mobile.camera');
    expect(localSourceNoticeKey({ camera: null, microphone: 'MIC-03' }, 'START')).toBe('common.localSourceStartNotice.mobile.microphone');
    expect(localSourceNoticeKey({ camera: 'CAM-03', microphone: 'MIC-03' }, 'START')).toBe('common.localSourceStartNotice.mobile.both');
    expect(localSourceNoticeKey({ camera: 'CAM-03', microphone: 'MIC-03' }, 'PRECHECK')).toBe('common.localSourceNotice.mobile.both');
  });
});
