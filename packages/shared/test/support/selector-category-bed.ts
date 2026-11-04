// Test bed of task 4 WP-13a (rows 162, 163, 165): the seven selector categories of the design
// addendum 1.5 as hand-built selector lines over one registry. Each slot of a selector is U
// (unassigned: no line), D (a development kind: FAKE) or P (a production kind: ONVIF_RTSP,
// USB_AUDIO). The shared code under test is blind to the class; the categories are the ones the
// Core's 21-state table (row 33) walks, so the shared rules are proven over the same seven.
// One definition; the test files that use it are `sim-capture-config`, `sim-capture-notices`,
// `sim-capture-start` and `sim-api`.
import type { CaptureConfigCamera, CaptureConfigMic, CaptureDeviceStatus, CaptureSelectorSlot, SimState } from '../../src/sim';
import type { VideoTrackId } from '../../src/domain';

export const PROFILE = 'H264_1080P25';

const device = (id: string, kind: 'CAMERA' | 'MIC', adapter: string, sourceClass: 'PRODUCTION' | 'DEVELOPMENT'): CaptureDeviceStatus => ({
  id,
  kind,
  model: null,
  firmware: null,
  host: null,
  poePort: null,
  online: true,
  streamState: kind === 'CAMERA' ? 'LIVE' : null,
  capabilities: [],
  adapter,
  sourceClass,
});

/** D: CAM-01, CAM-02, CAM-05, CAM-06, MIC-01, MIC-02. P: CAM-03, CAM-04, CAM-07, CAM-08, MIC-03, MIC-04. All online.
 *  D60 (2026-11-04): the four-track selector needs FOUR development and FOUR production cameras. */
export const REGISTRY: CaptureDeviceStatus[] = [
  device('CAM-01', 'CAMERA', 'FAKE', 'DEVELOPMENT'),
  device('CAM-02', 'CAMERA', 'FAKE', 'DEVELOPMENT'),
  device('CAM-03', 'CAMERA', 'ONVIF_RTSP', 'PRODUCTION'),
  device('CAM-04', 'CAMERA', 'ONVIF_RTSP', 'PRODUCTION'),
  device('CAM-05', 'CAMERA', 'FAKE', 'DEVELOPMENT'), // D60: development camera for the third track
  device('CAM-06', 'CAMERA', 'FAKE', 'DEVELOPMENT'), // D60: development camera for the fourth track
  device('CAM-07', 'CAMERA', 'ONVIF_RTSP', 'PRODUCTION'), // D60: production camera for the third track
  device('CAM-08', 'CAMERA', 'ONVIF_RTSP', 'PRODUCTION'), // D60: production camera for the fourth track
  device('MIC-01', 'MIC', 'FAKE', 'DEVELOPMENT'),
  device('MIC-02', 'MIC', 'FAKE', 'DEVELOPMENT'),
  device('MIC-03', 'MIC', 'USB_AUDIO', 'PRODUCTION'),
  device('MIC-04', 'MIC', 'USB_AUDIO', 'PRODUCTION'),
];

export const cam = (trackId: VideoTrackId, deviceId: string): CaptureConfigCamera => ({ trackId, deviceId, profile: PROFILE, online: true, streamState: 'LIVE' }); // D60: any of the four tracks
export const mic = (inputId: string, role: 'PRIMARY' | 'STANDBY'): CaptureConfigMic => ({ inputId, deviceId: inputId, role, transport: 'USB', online: true });

export interface SelectorLines {
  cameras: CaptureConfigCamera[];
  mics: CaptureConfigMic[];
}

// D60 (2026-11-04): the selector carries SIX slots - the four video tracks and the two mic roles.
export const SEEDED_CATEGORY = '5. six assigned, the seeded selector';

/** The seven categories of addendum 1.5. The mic lines are in input order, as the selector holds them. */
export const CATEGORIES: Record<string, SelectorLines> = {
  '1. all six U': { cameras: [], mics: [] },
  '2. some U, the rest D (VIDEO-02 and PRIMARY held)': { cameras: [cam('VIDEO-02', 'CAM-02')], mics: [mic('MIC-01', 'PRIMARY')] },
  '3. some U, the rest P (VIDEO-01 and a lone STANDBY held)': { cameras: [cam('VIDEO-01', 'CAM-03')], mics: [mic('MIC-04', 'STANDBY')] },
  '4. some U, D and P (STANDBY empty)': { cameras: [cam('VIDEO-01', 'CAM-01'), cam('VIDEO-02', 'CAM-04')], mics: [mic('MIC-03', 'PRIMARY')] },
  [SEEDED_CATEGORY]: { cameras: [cam('VIDEO-01', 'CAM-01'), cam('VIDEO-02', 'CAM-02'), cam('VIDEO-03', 'CAM-05'), cam('VIDEO-04', 'CAM-06')], mics: [mic('MIC-01', 'PRIMARY'), mic('MIC-02', 'STANDBY')] }, // D60: all six slots hold
  '6. six assigned, all P': { cameras: [cam('VIDEO-01', 'CAM-03'), cam('VIDEO-02', 'CAM-04'), cam('VIDEO-03', 'CAM-07'), cam('VIDEO-04', 'CAM-08')], mics: [mic('MIC-03', 'PRIMARY'), mic('MIC-04', 'STANDBY')] }, // D60
  '7. six assigned, D and P (the PRIMARY is the second line)': { cameras: [cam('VIDEO-01', 'CAM-01'), cam('VIDEO-02', 'CAM-04'), cam('VIDEO-03', 'CAM-02'), cam('VIDEO-04', 'CAM-03')], mics: [mic('MIC-02', 'STANDBY'), mic('MIC-03', 'PRIMARY')] }, // D60
};

/** The six slots of the widened selector (D60, 2026-11-04), in the contract's order. */
export const SLOTS: readonly CaptureSelectorSlot[] = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'PRIMARY', 'STANDBY'];
/** The four slots with a §5.3 pre-check item of their own (LENS_1, LENS_2, MIC_PRIMARY, MIC_STANDBY);
 *  an unassigned VIDEO-03/VIDEO-04 blocks the START (the required-slot rule), not a check item. */
export const CHECKED_SLOTS: readonly CaptureSelectorSlot[] = ['VIDEO-01', 'VIDEO-02', 'PRIMARY', 'STANDBY'];

/** The slots of these lines that hold no source, in the contract's order - said by the bed itself, not by the code under test. */
export const emptySlotsOf = (lines: SelectorLines): CaptureSelectorSlot[] =>
  SLOTS.filter((slot) => !lines.cameras.some((line) => line.trackId === slot) && !lines.mics.some((line) => line.role === slot));

/**
 * The slices of a state that holds these lines: the registry above, the selector, and meters that
 * agree with it (one frame per microphone line, as a state the hosted action produced has; a camera
 * edit never touches the meters, so it would not repair them). `activeInputId` is the PRIMARY line's
 * input, else `null`: without a PRIMARY line the state holds no active input (task 4 row 149).
 */
export function selectorPatch(state: SimState, lines: SelectorLines): Pick<SimState, 'captureDevices' | 'captureConfig' | 'audio'> {
  const frame = state.audio.inputs['MIC-01'];
  if (frame === undefined) throw new Error('the seeded meters hold no MIC-01 frame');
  return {
    captureDevices: { devices: REGISTRY },
    captureConfig: { ...state.captureConfig, cameras: lines.cameras, mics: lines.mics },
    audio: { inputs: Object.fromEntries(lines.mics.map((line) => [line.inputId, frame])), activeInputId: lines.mics.find((line) => line.role === 'PRIMARY')?.inputId ?? null },
  };
}
