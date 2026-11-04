/**
 * Pure model of the mobile Devices & Inputs screens (04_mobile_specs §4.12; MB 7). No React, no
 * simulator instance: plain reads of `SimState` that return primitives or flat records, so every
 * `useSim` selector built on them stays flat (D73 F74-13).
 *
 * Device IDs are the simulator's (`CAM-01`, `MIC-02`, `POE-SWITCH`, …): the Home tiles link to
 * `/devices/<deviceId>` with the same IDs (step 77), and the route parses them with `recordIdSchema`.
 */
import { SessionState } from '@dems/shared/domain';
import type { SimState } from '@dems/shared/sim';
import type { StatusTone } from '@dems/shared/tokens';
import { DEVICE_IDS, DEVICE_KIND, isDeviceId, type DeviceId } from './device-ids';
import { bookPoe } from './sim-adapter';

export { DEVICE_CAMERA, DEVICE_IDS, DEVICE_KIND, DEVICE_MIC, isDeviceId, type DeviceId, type DeviceKind } from './device-ids';

/** MB 7 sections in order (V2, V3, V4). */
export type DeviceSection = 'cameras' | 'audio' | 'other';

/**
 * D61 (2026-11-04): the mics slice states the CHANNEL CODE (`MIC-0N` for `AUDIO-0N`); the Devices
 * rows and the detail's "Channel" fact keep the book's ordinal word — the number of the code.
 */
export const micChannelNumber = (channel: string): number => Number(channel.slice(-1)) || 1;
export const SECTIONS: readonly { id: DeviceSection; titleKey: string; devices: readonly DeviceId[] }[] = [
  // D60 (2026-11-04): four camera tracks — the roster lists all four built-in cameras.
  { id: 'cameras', titleKey: 'devices.cameras.title', devices: ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04'] },
  { id: 'audio', titleKey: 'devices.audio.title', devices: ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] }, // D61 (2026-11-04): four simultaneous microphone channels — the roster lists all four built-in microphones
  { id: 'other', titleKey: 'devices.other.title', devices: ['POE-SWITCH', 'REC-INDICATOR', 'TABLET'] },
];

/** i18n key of a device's display name (MIC titles use the canonical "Interviewer", 04 §9 #8). */
export const DEVICE_NAME_KEY: Readonly<Record<DeviceId, string>> = {
  'CAM-01': 'common.devices.camera1',
  'CAM-02': 'common.devices.camera2',
  'CAM-03': 'common.devices.camera3', // D60 (2026-11-04): four camera tracks
  'CAM-04': 'common.devices.camera4', // D60
  'MIC-01': 'features.devices.mic.title1',
  'MIC-02': 'features.devices.mic.title2',
  // D61 (2026-11-04): the two further built-in microphones of the four-channel plane; the dataset
  // names no interview role for them, so they read by their shared channel word.
  'MIC-03': 'common.devices.mic3',
  'MIC-04': 'common.devices.mic4',
  'POE-SWITCH': 'devices.other.poeSwitch',
  'REC-INDICATOR': 'devices.other.recordingIndicator',
  // Fix wave J (JA2-13): the row stands for THIS device - a phone or a tablet.
  TABLET: 'features.devices.other.deviceControl',
};

/** Short name used in toasts and dialogs ("MIC 1", "Camera 2", …). */
export const DEVICE_SHORT_NAME_KEY: Readonly<Record<DeviceId, string>> = {
  ...DEVICE_NAME_KEY,
  'MIC-01': 'common.devices.mic1',
  'MIC-02': 'common.devices.mic2',
  'MIC-03': 'common.devices.mic3', // D61 (2026-11-04)
  'MIC-04': 'common.devices.mic4', // D61
};

// ── Status ───────────────────────────────────────────────────────────────────────────────
/**
 * One status code per device. MB 7 shows "Online" (cameras, mics), "Active" (recording indicator)
 * and "Connected" (tablet); faults escalate calmly to warning (NO_SIGNAL, CLIP, OFFLINE) or danger
 * (FAULT) and hold that colour (03M P7).
 */
export type DeviceStatus = 'ONLINE' | 'ACTIVE' | 'CONNECTED' | 'OFFLINE' | 'FAULT' | 'NO_SIGNAL' | 'CLIP';

export const STATUS_TONE: Readonly<Record<DeviceStatus, StatusTone>> = {
  ONLINE: 'success',
  ACTIVE: 'success',
  CONNECTED: 'success',
  OFFLINE: 'warning',
  NO_SIGNAL: 'warning',
  CLIP: 'warning',
  FAULT: 'danger',
};

/** Escalation rank: success 0, warning 1, danger 2 (a rise pulses the chip once, R8). */
export const STATUS_RANK: Readonly<Record<DeviceStatus, number>> = {
  ONLINE: 0,
  ACTIVE: 0,
  CONNECTED: 0,
  OFFLINE: 1,
  NO_SIGNAL: 1,
  CLIP: 1,
  FAULT: 2,
};

export const STATUS_LABEL_KEY: Readonly<Record<DeviceStatus, string>> = {
  ONLINE: 'common.status.online',
  ACTIVE: 'common.status.active',
  CONNECTED: 'common.status.connected',
  OFFLINE: 'common.status.offline',
  FAULT: 'common.status.fault',
  NO_SIGNAL: 'common.status.noSignal',
  CLIP: 'features.devices.status.CLIP',
};

type StatusInput = Pick<SimState, 'cameras' | 'mics' | 'network' | 'tabletLink' | 'otherDevices'>;

export function deviceStatus(state: StatusInput, deviceId: DeviceId): DeviceStatus {
  switch (DEVICE_KIND[deviceId]) {
    case 'camera': {
      const camera = state.cameras.find((entry) => entry.deviceId === deviceId);
      return camera && camera.online && camera.lens === 'READY' ? 'ONLINE' : 'FAULT';
    }
    case 'microphone': {
      const mic = state.mics.find((entry) => entry.deviceId === deviceId);
      if (!mic) return 'FAULT';
      if (mic.state === 'NO_SIGNAL') return 'NO_SIGNAL';
      if (mic.state === 'CLIP' || mic.clipLatched) return 'CLIP';
      return 'ONLINE';
    }
    case 'poe': {
      // D60 (2026-11-04): the switch reads ACTIVE while ANY camera port feeds — not only the dual-lens CAM 1.
      const poe = bookPoe(state);
      return poe.cam1Link || poe.cam3Link || poe.cam4Link ? 'ACTIVE' : 'FAULT';
    }
    case 'relay': {
      const relay = state.otherDevices.find((entry) => entry.id === 'REC-INDICATOR');
      return relay?.online === false ? 'FAULT' : 'ACTIVE';
    }
    case 'tablet':
      return state.tabletLink.state === 'CONNECTED' ? 'CONNECTED' : 'OFFLINE';
  }
}

/** Every device's status in list order, as one comparable string (`CAM-01:ONLINE|…`). */
export function statusLine(state: StatusInput): string {
  return DEVICE_IDS.map((id) => `${id}:${deviceStatus(state, id)}`).join('|');
}

export function parseStatusLine(line: string): Record<DeviceId, DeviceStatus> {
  const out = {} as Record<DeviceId, DeviceStatus>;
  for (const part of line.split('|')) {
    const [id, status] = part.split(':');
    if (isDeviceId(id)) out[id] = status as DeviceStatus;
  }
  return out;
}

/** Devices that need attention, worst first (FAULT before warnings), list order inside a rank. */
export function attentionDevices(statuses: Readonly<Record<DeviceId, DeviceStatus>>): DeviceId[] {
  return DEVICE_IDS.filter((id) => STATUS_RANK[statuses[id]] > 0).sort((a, b) => STATUS_RANK[statuses[b]] - STATUS_RANK[statuses[a]]);
}

export function isRecording(state: Pick<SimState, 'session'>): boolean {
  return state.session?.state === SessionState.RECORDING;
}

// ── What a detail block may draw (fix wave L, closing pass L-Z; THE ONE RULE of a Core in its own capture) ──
/**
 * | The Core this app shows | The device | A detail block draws |
 * |---|---|---|
 * | Simulated client mode, or a Core in simulated capture | any | `SIMULATED`: the simulator's values, exactly as before |
 * | a Core in real capture | a capture source with `adapter: 'FAKE'` | `GENERATED`: it is named a generated test source; no model, firmware, port, format, bitrate, channel, gain, phantom power or converter of the simulator's model is drawn |
 * | a Core in real capture | anything else (another adapter, the PoE switch, the indicator, the tablet row) | `MODEL_VALUES`: the block still shows the simulator's model values, so it carries the "Synthetic demo values" chip |
 *
 * `realCapture` is `realCaptureView` of `camera-preview.tsx` (Live mode AND a Core that states a source
 * class). Pure.
 */
export type DetailFacts = 'SIMULATED' | 'GENERATED' | 'MODEL_VALUES';

export function detailFactsOf(realCapture: boolean, adapter: string | null | undefined): DetailFacts {
  if (!realCapture) return 'SIMULATED';
  return adapter === 'FAKE' ? 'GENERATED' : 'MODEL_VALUES';
}

/**
 * WHAT THE DETAIL BLOCK OF A CAMERA MAY DRAW (task 4 row W4; review `verification/060c` finding R-02).
 *
 * Until row W4 a camera followed `detailFactsOf`: on a Core in real capture every adapter but `FAKE` was
 * `MODEL_VALUES`, so a PRODUCTION camera (`ONVIF_RTSP`, the camera phase 3 brings) read the simulator's model,
 * firmware, PoE port, `1080p / 25 / H.264` and `9 Mbps` under a chip. None of these is a fact of that camera:
 * the Core states no model, firmware, port or bitrate of a source, and the three stream facts on the state
 * stream are the simulator's (`stream-facts.ts`). A chip does not make a record another camera's.
 *
 * | The Core this app shows | The camera | The block draws |
 * |---|---|---|
 * | Simulated client mode, or a Core in simulated capture | any | `SIMULATED`: the dataset's values, exactly as before |
 * | a Core in real capture | `adapter: 'FAKE'` | `GENERATED`: as before (named a generated test source; the line's profile code) |
 * | a Core in real capture | any other adapter, or none stated | `STATED`: only what the Core states - the status, the id, the STORED stream statement of its selector line ("Not stated" where null; the fault where the Core reports one) and the recording state. No model value, so no chip |
 *
 * `detailFactsOf` is unchanged and still rules every other block (a microphone, the PoE switch, the indicator,
 * the tablet row). Pure.
 */
export type CameraDetailFacts = 'SIMULATED' | 'GENERATED' | 'STATED';

export function cameraDetailFactsOf(realCapture: boolean, adapter: string | null | undefined): CameraDetailFacts {
  const facts = detailFactsOf(realCapture, adapter);
  return facts === 'MODEL_VALUES' ? 'STATED' : facts;
}

// ── The Recording Indicator (fix wave J, JA2-33) ─────────────────────────────────────────────────────────
/**
 * The ONE statement of the Recording Indicator, from the Core's session fact: the lamp is lit exactly while
 * a session records; at rest it is "Lamp off" (never "Active" beside a red beacon); a fault keeps its word.
 * Pure: `key` is an i18n key.
 */
export function relayWords(status: DeviceStatus, recording: boolean): { readonly key: string; readonly lit: boolean; readonly fault: boolean } {
  if (status === 'FAULT' || status === 'OFFLINE') return { key: STATUS_LABEL_KEY[status], lit: false, fault: true };
  return recording ? { key: 'devices.other.recordingLamp', lit: true, fault: false } : { key: 'features.devices.other.lampOff', lit: false, fault: false };
}
