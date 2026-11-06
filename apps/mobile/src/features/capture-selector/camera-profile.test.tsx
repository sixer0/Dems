// Task 4 row W5 (review `verification/060d` finding Q-02; decisions C36, C60, C111): NO CLIENT COULD ASSIGN A
// PRODUCTION CAMERA. The tablet sent operation 79 with a track alone; the Core refuses a production camera
// without a profile of its own (`CAMERA_PROFILE_NOT_STATED`) and never picks one.
//
// | Case | Where |
// |------|-------|
// | the rule: who needs a profile, what is preselected, what a profile is in words | "the rule (pure)" |
// | the option carries the Core's list; the command and the request carry the chosen profile | "the command and the request" |
// | TWO stored profiles: both offered by what they are, none preselected, Save sends nothing until one is chosen | "two stored profiles" |
// | ONE stored profile: preselected, still shown, sent | "one stored profile" |
// | NO stored profile: nothing is offered and nothing is sent; the sheet says why | "no stored profile" |
// | a development source and Simulated mode are assigned exactly as before | the two CONTROL cases (and, unedited, the existing suites) |
// | the whole flow in the app, and a refused profile reading the Core's sentence | the last block of `selector-lines.test.tsx` |
//
// THE DOUBLE, AND WHAT IT DOES NOT PROVE. The sheet is rendered with the options it is handed (the pattern of
// `mic-limit-option.test.tsx`); the list of a camera is the member `profiles` of its device entry, which the
// contract does not carry today. Proven here: the screen, the command and the request, given the list. NOT
// proven: that a Core states the list (request lines of row W5). No emulator session.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import '@/features/devices/testing/devices-test-setup';

import { fireEvent, screen } from '@testing-library/react-native';
import { DEFAULT_CAPTURE_CONFIG, DEFAULT_CAPTURE_DEVICES } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import type { MobileCoreClient } from '@/runtime';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';
import { createTestSim, flushAsync, renderWithRuntime } from '@/runtime/testing/test-sim';
import { cameraAssignmentOf, profileWords, storedProfilesOf, STORED_PROFILES_MAX } from './camera-profile';
import { cameraOptions, isNoChange, type CameraOption, type SelectorCommand } from './capture-selector-model';
import { cameraProfileBody, liveSelectorPort, selectorPath } from './capture-selector-port';
import { CaptureSourceSheet, type SourceSheetRequest } from './capture-source-sheet';
import { captureSelectorEn as enCaptureSelector } from './i18n';

const TWO = ['HEVC_2560X1920P20', 'H264_720P30'] as const;
const ONE = ['HEVC_2160P'] as const;
const W = enCaptureSelector.selector.cameraProfile;

describe('row W5 (Q-02): the stream profile of a camera assignment', () => {
  unmountBeforeTheHooksOfThisGroup();
  beforeEach(() => resetMissingKeys());
  afterEach(() => expect(getMissingKeys()).toEqual([]));

  const t = (key: string, options?: Record<string, unknown>): string => {
    const text = key
      .replace('features.capture-selector.', '')
      .split('.')
      .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], enCaptureSelector as unknown);
    return String(text).replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name]));
  };

  describe('the rule (pure)', () => {
    it('`storedProfilesOf` reads the member `profiles` of a device entry as untrusted data: codes only, each once, in the Core\'s order', () => {
      expect(storedProfilesOf({ id: 'CAM-01', profiles: ['HEVC_2160P', 'H264_720P30', 'HEVC_2160P'] })).toEqual(['HEVC_2160P', 'H264_720P30']);
      // Row V7: an entry of the contract is `{ code, codec, resolution, fps }` - its `code` is read; an object without a code states nothing.
      expect(storedProfilesOf({ id: 'CAM-01', profiles: ['H264_720P30', 7, null, 'rtsp://camera/stream', '', 'h264_720p30', { codec: 'HEVC' }, { code: 'rtsp://camera/2' }] })).toEqual(['H264_720P30']);
      expect(storedProfilesOf({ id: 'CAM-01', profiles: [{ code: 'HEVC_2560X1920P', codec: 'HEVC', resolution: '2560x1920', fps: null }, { code: 'H264_720P30', codec: 'H.264', resolution: '720p', fps: 30 }] })).toEqual(['HEVC_2560X1920P', 'H264_720P30']);
      // An entry without the member (a Core before row V7, a built-in device) states nothing.
      for (const entry of [{ id: 'CAM-01' }, { profiles: 'H264_720P30' }, { profiles: null }, null, undefined, 'CAM-01']) expect(storedProfilesOf(entry)).toEqual([]);
      expect(storedProfilesOf({ profiles: Array.from({ length: 100 }, (_unused, index) => `P${String(index)}`) })).toHaveLength(STORED_PROFILES_MAX);
    });

    it('`cameraAssignmentOf`: a profile is asked only for a production camera on a Core in real capture; one stored profile is preselected, several are not, a held one is kept', () => {
      for (const adapter of ['FAKE', 'LOCAL_DEVICE', null, undefined]) expect(cameraAssignmentOf({ realCapture: true, adapter, profiles: [...TWO], heldProfile: null })).toEqual({ kind: 'PLAIN' });
      expect(cameraAssignmentOf({ realCapture: false, adapter: 'ONVIF_RTSP', profiles: [...TWO], heldProfile: null })).toEqual({ kind: 'PLAIN' });
      expect(cameraAssignmentOf({ realCapture: true, adapter: 'ONVIF_RTSP', profiles: [], heldProfile: null })).toEqual({ kind: 'NO_PROFILE' });
      expect(cameraAssignmentOf({ realCapture: true, adapter: 'ONVIF_RTSP', profiles: [...ONE], heldProfile: null })).toEqual({ kind: 'CHOOSE', profiles: [...ONE], preselected: 'HEVC_2160P' });
      expect(cameraAssignmentOf({ realCapture: true, adapter: 'ONVIF_RTSP', profiles: [...TWO], heldProfile: null })).toEqual({ kind: 'CHOOSE', profiles: [...TWO], preselected: null });
      expect(cameraAssignmentOf({ realCapture: true, adapter: 'ONVIF_RTSP', profiles: [...TWO], heldProfile: 'H264_720P30' })).toMatchObject({ preselected: 'H264_720P30' });
      // A held profile the camera no longer lists is never kept as the choice: no default stands in (C36).
      expect(cameraAssignmentOf({ realCapture: true, adapter: 'ONVIF_RTSP', profiles: [...TWO], heldProfile: 'H264_1080P25' })).toMatchObject({ preselected: null });
    });

    it('`profileWords`: the codec, the picture and the rate as the stream stated them; "not stated" where the code states none', () => {
      expect(profileWords(t, 'HEVC_2560X1920P20')).toBe('HEVC • 2560x1920 • 20 fps');
      expect(profileWords(t, 'H264_720P30')).toBe('H.264 • 720p • 30 fps');
      expect(profileWords(t, 'HEVC_2160P')).toBe(`HEVC • 2160p • ${W.rateNotStated}`);
      expect(profileWords(t, 'STANDARD')).toBe('Not stated (STANDARD)');
    });
  });

  describe('the command and the request', () => {
    it('an option carries the list the Core states for its camera and the profile of the line it feeds; an entry without a list reads as before', () => {
      const devices = { devices: DEFAULT_CAPTURE_DEVICES.devices.map((device) => (device.id === 'CAM-01' ? ({ ...device, adapter: 'ONVIF_RTSP', profiles: TWO.map((code) => ({ code, codec: null, resolution: null, fps: null })) } as typeof device) : device)) };
      const [first, second] = cameraOptions(DEFAULT_CAPTURE_CONFIG, devices);
      expect(first).toMatchObject({ deviceId: 'CAM-01', profiles: [...TWO], lineProfile: DEFAULT_CAPTURE_CONFIG.cameras[0]!.profile });
      expect(second).not.toHaveProperty('profiles');
    });

    it('a camera command with a profile is ONE camera line of operation 78; without one it is operation 79 as before', async () => {
      const withProfile: SelectorCommand = { kind: 'camera', trackId: 'VIDEO-01', deviceId: 'CAM-07', profile: 'H264_720P30' };
      const plain: SelectorCommand = { kind: 'camera', trackId: 'VIDEO-01', deviceId: 'CAM-07' };
      expect(selectorPath(withProfile)).toBe('/api/v1/capture/config');
      expect(selectorPath(plain)).toBe('/api/v1/capture/cameras/CAM-07/source');
      expect(cameraProfileBody({ trackId: 'VIDEO-01', deviceId: 'CAM-07', profile: 'H264_720P30' })).toEqual({ cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-07', profile: 'H264_720P30' }] });
      const calls: { operationId: string; input: unknown }[] = [];
      const client = {
        call: (operationId: string, input: unknown) => {
          calls.push({ operationId, input });
          return Promise.resolve({ ok: true, status: 200, data: { updatedAt: 7 } });
        },
      } as unknown as Pick<MobileCoreClient, 'call'>;
      const port = liveSelectorPort(client);
      await expect(port.send(withProfile)).resolves.toMatchObject({ result: 'ok', updatedAt: 7 });
      await port.send(plain);
      expect(calls).toEqual([
        { operationId: 'updateCaptureConfig', input: { body: { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-07', profile: 'H264_720P30' }] } } },
        { operationId: 'setCaptureCameraSource', input: { params: { id: 'CAM-07' }, body: { trackId: 'VIDEO-01' } } },
      ]);
    });

    it('`isNoChange`: the camera a track holds with ANOTHER of its profiles is a change; with the held one, or with none named, it is not', () => {
      const [line] = DEFAULT_CAPTURE_CONFIG.cameras;
      const held = { kind: 'camera', trackId: line!.trackId, deviceId: line!.deviceId } as const;
      expect(isNoChange(held, DEFAULT_CAPTURE_CONFIG)).toBe(true);
      expect(isNoChange({ ...held, profile: line!.profile }, DEFAULT_CAPTURE_CONFIG)).toBe(true);
      expect(isNoChange({ ...held, profile: 'HEVC_2160P' }, DEFAULT_CAPTURE_CONFIG)).toBe(false);
    });
  });

  describe('the camera sheet', () => {
    const REACHABLE = { key: 'common.developmentRoster.reachable', tone: 'success' } as const;
    const option = (deviceId: string, more: Partial<CameraOption> = {}): CameraOption => ({
      deviceId,
      model: null,
      online: true,
      streamState: 'LIVE',
      assignedTo: null,
      sourceClass: 'PRODUCTION',
      adapter: 'ONVIF_RTSP',
      ...more,
    });
    const OPTIONS: readonly CameraOption[] = [
      option('CAM-01', { profiles: [...TWO] }),
      option('CAM-02', { profiles: [...ONE] }),
      option('CAM-03'),
      option('CAM-04', { sourceClass: 'DEVELOPMENT', adapter: 'FAKE' }),
    ];
    const reported = { 'CAM-01': REACHABLE, 'CAM-02': REACHABLE, 'CAM-03': REACHABLE, 'CAM-04': REACHABLE };
    const request = (more: Partial<Extract<SourceSheetRequest, { kind: 'camera' }>> = {}): SourceSheetRequest => ({
      kind: 'camera',
      trackId: 'VIDEO-01',
      currentDeviceId: null,
      options: OPTIONS,
      badgeMode: { live: true },
      reported,
      ...more,
    });
    async function sheet(given: SourceSheetRequest) {
      const onSave = jest.fn();
      renderWithRuntime(<CaptureSourceSheet request={given} fullHeight busy={false} pending={false} onSave={onSave} onClose={jest.fn()} />, { sim: createTestSim().sim });
      await flushAsync();
      await flushAsync();
      return onSave;
    }
    const save = () => fireEvent.press(screen.getByTestId('capture-source-save'));

    // Seen RED on the mutation "the sheet builds the camera command without the profile": `onSave` got `{ kind, trackId, deviceId }`.
    it('two stored profiles: both are offered by what they are, none is preselected, Save sends nothing until one is chosen, then the command carries it', async () => {
      const onSave = await sheet(request());
      expect(screen.queryByTestId('capture-source-profiles')).toBeNull();
      fireEvent.press(screen.getByTestId('capture-source-option-CAM-01'));
      expect(screen.getByTestId('capture-source-profile-hint')).toHaveTextContent(W.choose.replace('{{count}}', '2'));
      expect(screen.getByTestId('capture-source-profile-HEVC_2560X1920P20')).toHaveTextContent('HEVC • 2560x1920 • 20 fps');
      expect(screen.getByTestId('capture-source-profile-H264_720P30')).toHaveTextContent('H.264 • 720p • 30 fps');
      for (const code of TWO) expect(screen.getByTestId(`capture-source-profile-${code}`).props.accessibilityState).toMatchObject({ checked: false });
      save();
      expect(onSave).not.toHaveBeenCalled();
      fireEvent.press(screen.getByTestId('capture-source-profile-H264_720P30'));
      expect(screen.getByTestId('capture-source-profile-H264_720P30').props.accessibilityState).toMatchObject({ checked: true });
      save();
      expect(onSave.mock.calls).toEqual([[{ kind: 'camera', trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_720P30' }]]);
    });

    it('one stored profile: it is preselected and still shown, and the command carries it', async () => {
      const onSave = await sheet(request({ trackId: 'VIDEO-02' }));
      fireEvent.press(screen.getByTestId('capture-source-option-CAM-02'));
      expect(screen.getByTestId('capture-source-profile-hint')).toHaveTextContent(W.one);
      expect(screen.getByTestId('capture-source-profile-HEVC_2160P')).toHaveTextContent(`HEVC • 2160p • ${W.rateNotStated}`);
      expect(screen.getByTestId('capture-source-profile-HEVC_2160P').props.accessibilityState).toMatchObject({ checked: true });
      save();
      expect(onSave.mock.calls).toEqual([[{ kind: 'camera', trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: 'HEVC_2160P' }]]);
    });

    it('no stored profile: no profile is offered, nothing is sent, and the sheet says why', async () => {
      const onSave = await sheet(request());
      fireEvent.press(screen.getByTestId('capture-source-option-CAM-03'));
      // Row W6 (C117, C126 (d)): EXPECTATION MOVED - the sentence names the remedy, "Test connection" on the web console (operation 108 is web-console only).
      expect(screen.getByTestId('capture-source-profile-hint')).toHaveTextContent(
        'This camera cannot be assigned yet: the Core holds no stream profile for it, and it does not pick one for a camera. On the web console, open Devices and press "Test connection" for this camera: when the test reads its stream, the Core stores the profiles it states and they are offered here. Nothing was changed.',
      );
      expect(screen.queryAllByTestId(/^capture-source-profile-(?!hint)/)).toHaveLength(0);
      save();
      expect(onSave).not.toHaveBeenCalled();
    });

    it('a held line: its profile is the checked one and Save sends nothing; another of the camera\'s profiles is an edit', async () => {
      const held = OPTIONS.map((entry) => (entry.deviceId === 'CAM-01' ? { ...entry, assignedTo: 'VIDEO-01' as const, lineProfile: 'H264_720P30' } : entry));
      const onSave = await sheet(request({ currentDeviceId: 'CAM-01', options: held }));
      expect(screen.getByTestId('capture-source-profile-H264_720P30').props.accessibilityState).toMatchObject({ checked: true });
      save();
      expect(onSave).not.toHaveBeenCalled();
      fireEvent.press(screen.getByTestId('capture-source-profile-HEVC_2560X1920P20'));
      save();
      expect(onSave.mock.calls).toEqual([[{ kind: 'camera', trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'HEVC_2560X1920P20' }]]);
    });

    it('CONTROL - a development source of the same Core: no profile section, and the command of before', async () => {
      const onSave = await sheet(request());
      fireEvent.press(screen.getByTestId('capture-source-option-CAM-04'));
      expect(screen.queryByTestId('capture-source-profiles')).toBeNull();
      save();
      expect(onSave.mock.calls).toEqual([[{ kind: 'camera', trackId: 'VIDEO-01', deviceId: 'CAM-04' }]]);
    });

    it('CONTROL - off a Core in real capture (no reported states: Simulated mode, a Core in simulated capture) even a production adapter is assigned as before', async () => {
      const { reported: _left, ...simulated } = request() as Extract<SourceSheetRequest, { kind: 'camera' }>;
      const onSave = await sheet({ ...simulated, badgeMode: { live: false } });
      fireEvent.press(screen.getByTestId('capture-source-option-CAM-03'));
      expect(screen.queryByTestId('capture-source-profiles')).toBeNull();
      save();
      expect(onSave.mock.calls).toEqual([[{ kind: 'camera', trackId: 'VIDEO-01', deviceId: 'CAM-03' }]]);
    });
  });

  // The refused profile on the screen (the notice of the selector) is the last block of `selector-lines.test.tsx`.
});
