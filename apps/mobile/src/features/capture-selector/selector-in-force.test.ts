// Fix wave L, driver L-M - re-check 70 finding G70c-01 (MAJOR, ruling D227): tablet Home and Session
// New kept naming the camera a track had BEFORE a selector change.
//
// Cause: every reader spelled `state.session?.captureConfig ?? state.captureConfig`, and the `session`
// slice still holds the selector snapshot of the last SEALED session - which then hid every later edit
// of the selector. Rule: a session's snapshot names the sources ONLY while that session is OPEN (not
// sealed / closed); otherwise the Core's current selector. ONE helper (`selector-in-force.ts`).
//
// The order held here is the one of the defect: a session is SEALED with CAM-02 on VIDEO-02, THEN the
// selector is changed. Each reader must name the new source. The control in every case is the same
// state with the session still OPEN: the snapshot is the truth then (OD-10).
import { describe, expect, it, jest } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createIdleState, DEFAULT_SEED, type SimState } from '@dems/shared/sim';
import { noPreviewFactsOf } from '@/features/devices/camera-preview';
import { selectStandbyInputId } from '@/features/session-live/mic-source-model';
import { micRoleLine } from '@/features/session-new/session-new-model';
import { precheckDeviceOf } from './development-source-badge';
import { localSourceNoticeLine } from './local-source-notice-model';
import { cameraLinesInForce, micLinesInForce, openSessionSnapshot, selectorInForce, sessionIsOpen } from './selector-in-force';
import { cameraLineReportOf, micLineDeviceIdOf, primaryMicReportOf } from './source-state';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);

const idle = (): SimState => createIdleState({ now: 1_791_636_968_000, seed: DEFAULT_SEED });

/** The registry of a Core in real capture: two generated cameras, a third generated one, the Mac's own devices. */
function registry(state: SimState): SimState {
  const base = state.captureDevices.devices;
  const camera = base.find((device) => device.kind === 'CAMERA')!;
  const mic = base.find((device) => device.kind === 'MIC')!;
  const marked = base.map((device) => ({ ...device, sourceClass: 'DEVELOPMENT', adapter: 'FAKE' }) as typeof device);
  return {
    ...state,
    captureDevices: {
      ...state.captureDevices,
      devices: [
        ...marked,
        { ...camera, id: 'CAM-05', sourceClass: 'DEVELOPMENT', adapter: 'FAKE' } as typeof camera,
        { ...camera, id: 'CAM-03', sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' } as typeof camera,
        { ...mic, id: 'MIC-03', sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' } as typeof mic,
      ],
    },
  };
}

type Session = NonNullable<SimState['session']>;
/**
 * `state`: the session's state. The session recorded with CAM-01 / CAM-02 and MIC-01 primary / MIC-02
 * standby (its snapshot); AFTER it the selector was changed to `CAM-05` on VIDEO-02 and `MIC-03` on standby.
 */
function afterSelectorChange(sessionState: Session['state'] | null): SimState {
  const base = registry(idle());
  const snapshot = { cameras: base.captureConfig.cameras, mics: base.captureConfig.mics, revision: 2, updatedAt: base.captureConfig.updatedAt };
  const changed = {
    ...base.captureConfig,
    cameras: base.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-02' ? { ...line, deviceId: 'CAM-05' } : line)),
    mics: base.captureConfig.mics.map((line) => (line.role === 'STANDBY' ? { ...line, inputId: 'MIC-03', deviceId: 'MIC-03' } : line)),
    updatedAt: base.captureConfig.updatedAt + 60_000,
  };
  const session = sessionState === null ? null : ({ id: 'SES-20261011-0043', state: sessionState, startedAt: 1, captureConfig: snapshot } as unknown as Session);
  return { ...base, captureConfig: changed, session };
}

describe('G70c-01 - the ONE helper', () => {
  it('OPEN = a session whose state is stated and is not SEALED', () => {
    for (const state of ['CREATE', 'PRECHECK', 'ARMED', 'RECORDING', 'STOPPING', 'FINALIZING', 'FAULT', 'RECOVERY']) expect(sessionIsOpen({ state })).toBe(true);
    expect(sessionIsOpen({ state: 'SEALED' })).toBe(false);
    expect(sessionIsOpen(null)).toBe(false);
    expect(sessionIsOpen(undefined)).toBe(false);
    // A holder that states no state is not known to be open: its snapshot is not taken as the selector.
    expect(sessionIsOpen({})).toBe(false);
  });

  it('a SEALED session\'s snapshot is not the selector: the current selector is in force', () => {
    const state = afterSelectorChange('SEALED');
    expect(state.session?.captureConfig?.cameras.find((line) => line.trackId === 'VIDEO-02')?.deviceId).toBe('CAM-02');
    expect(openSessionSnapshot(state.session)).toBeNull();
    expect(selectorInForce(state)).toBe(state.captureConfig);
    expect(cameraLinesInForce(state).map((line) => line.deviceId)).toEqual(['CAM-01', 'CAM-05']);
    expect(micLinesInForce(state).map((line) => line.inputId)).toEqual(['MIC-01', 'MIC-03']);
  });

  it('CONTROL - while that session is OPEN its snapshot is in force, whatever the stored selector says', () => {
    const state = afterSelectorChange('RECORDING');
    expect(selectorInForce(state)).toBe(state.session?.captureConfig);
    expect(cameraLinesInForce(state).map((line) => line.deviceId)).toEqual(['CAM-01', 'CAM-02']);
    expect(micLinesInForce(state).map((line) => line.inputId)).toEqual(['MIC-01', 'MIC-02']);
  });

  it('no session, and an open session without a snapshot: the current selector', () => {
    const none = afterSelectorChange(null);
    expect(selectorInForce(none)).toBe(none.captureConfig);
    const open = afterSelectorChange('ARMED');
    const without = { ...open, session: { ...open.session!, captureConfig: null } } as SimState;
    expect(selectorInForce(without)).toBe(without.captureConfig);
  });
});

describe('G70c-01 - every reader, in the order of the defect (sealed session, THEN the selector changed)', () => {
  const sealed = afterSelectorChange('SEALED');
  const open = afterSelectorChange('RECORDING');

  it('the "No preview" tile of Home / Session New names the camera of the CURRENT selector (CONTROL: the open session\'s)', () => {
    expect(noPreviewFactsOf(sealed, 'VIDEO-02').deviceId).toBe('CAM-05');
    expect(noPreviewFactsOf(sealed, 'VIDEO-01').deviceId).toBe('CAM-01');
    expect(noPreviewFactsOf(open, 'VIDEO-02').deviceId).toBe('CAM-02');
  });

  it('the state word of a camera line and of the microphone lines follows the same selector', () => {
    expect(cameraLineReportOf(sealed, 'VIDEO-02').deviceId).toBe('CAM-05');
    expect(cameraLineReportOf(open, 'VIDEO-02').deviceId).toBe('CAM-02');
    expect(micLineDeviceIdOf(sealed, 'AUDIO-02')).toBe('MIC-03');
    expect(micLineDeviceIdOf(open, 'AUDIO-02')).toBe('MIC-02');
    expect(primaryMicReportOf(sealed).deviceId).toBe('MIC-01');
  });

  it('the badge of a pre-check row and the microphone roles of Session New', () => {
    expect(precheckDeviceOf('LENS_2', selectorInForce(sealed))).toBe('CAM-05');
    expect(precheckDeviceOf('MIC_STANDBY', selectorInForce(sealed))).toBe('MIC-03');
    expect(precheckDeviceOf('LENS_2', selectorInForce(open))).toBe('CAM-02');
    expect(micRoleLine(sealed)).toBe('MIC-01:PRIMARY|MIC-03:STANDBY');
    expect(micRoleLine(open)).toBe('MIC-01:PRIMARY|MIC-02:STANDBY');
  });

  it('the hot standby of Session Live', () => {
    expect(selectStandbyInputId({ ...sealed, audio: { ...sealed.audio, activeInputId: 'MIC-01' } })).toBe('MIC-03');
  });

  it('THE LOCAL-DEVICE NOTICE names the devices of the selector in force only: a sealed session that recorded the Mac\'s camera raises no notice once the selector names generated sources again', () => {
    // The sealed session recorded with CAM-03 (this Mac's camera); the selector was put back to CAM-01 afterwards.
    const base = registry(idle());
    const local = { cameras: base.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-01' ? { ...line, deviceId: 'CAM-03' } : line)), mics: base.captureConfig.mics, revision: 3, updatedAt: base.captureConfig.updatedAt };
    const wasLocal = { ...base, session: { id: 'SES-20261011-0044', state: 'SEALED', startedAt: 1, captureConfig: local } as unknown as Session };
    expect(localSourceNoticeLine(wasLocal, true)).toBe('');
    // And the reverse (the gate's own picture): the last sealed session used CAM-01, the selector now names CAM-03.
    const nowLocal = { ...base, captureConfig: { ...base.captureConfig, cameras: local.cameras }, session: { id: 'SES-20261011-0043', state: 'SEALED', startedAt: 1, captureConfig: { ...local, cameras: base.captureConfig.cameras } } as unknown as Session };
    expect(localSourceNoticeLine(nowLocal, true)).not.toBe('');
    expect(noPreviewFactsOf(nowLocal, 'VIDEO-01')).toMatchObject({ deviceId: 'CAM-03', adapter: 'LOCAL_DEVICE' });
    // CONTROL: while the session that records the Mac's camera is OPEN, the notice is its own.
    expect(localSourceNoticeLine({ ...wasLocal, session: { ...wasLocal.session, state: 'ARMED' } as unknown as Session }, true)).not.toBe('');
  });
});

describe('G70c-01 - static: ONE reader of the rule in apps/mobile', () => {
  const SRC = join(__dirname, '..', '..');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !path.includes(`${join('', 'testing')}`)) files.push(path);
    }
  };
  walk(SRC);
  const code = (path: string): string =>
    readFileSync(path, 'utf8')
      .split('\n')
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .join('\n');

  it('no product file spells "the session\'s snapshot, else the selector" itself, and none calls the shared `captureMicLines`', () => {
    const offenders: string[] = [];
    for (const path of files) {
      if (path.endsWith(join('capture-selector', 'selector-in-force.ts'))) continue;
      const text = code(path);
      if (/session\??\.captureConfig\s*(\?\?|\?\.)/.test(text) || /session\?\.captureConfig\s*[,\]]/.test(text) || /\bcaptureMicLines\s*\(/.test(text) || /useSim\(captureMicLines\)/.test(text)) offenders.push(relative(SRC, path));
    }
    expect(offenders).toEqual([]);
    expect(files.length).toBeGreaterThan(300);
  });

  // Fix 157 - the same class, another member: the active / standby pair (`session.audioSource`) is read through
  // `audioPairInForce` of the one door only. (`**/testing/**` is not walked: the model Core of the monitor bed answers
  // operation 81 with the pair of ITS session.)
  it('fix 157: no product file reads `session.audioSource` itself', () => {
    const PAIR_SPELLING = /(?<!['"`])\bsession\??\.audioSource\b/;
    const offenders = files.filter((path) => !path.endsWith(join('capture-selector', 'selector-in-force.ts')) && PAIR_SPELLING.test(code(path))).map((path) => relative(SRC, path));
    expect(offenders).toEqual([]);
    // CONTROL: the pattern finds the expression of the defect, and not the i18n key of the same name.
    expect(PAIR_SPELLING.test('s.session?.audioSource?.activeInputId ?? s.audio.activeInputId')).toBe(true);
    expect(PAIR_SPELLING.test("t('session.audioSource.switched')")).toBe(false);
  });
});
