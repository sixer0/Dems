/**
 * Pure model of the mobile Devices & Inputs screens (04_mobile_specs §4.12; MB 7). No React, no
 * simulator instance: plain reads of `SimState` that return primitives or flat records, so every
 * `useSim` selector built on them stays flat (D73 F74-13).
 *
 * Device IDs are the simulator's (`CAM-01`, `MIC-02`, `POE-SWITCH`, …): the Home tiles link to
 * `/devices/<deviceId>` with the same IDs (step 77), and the route parses them with `recordIdSchema`.
 */
import { SessionState } from '@dems/shared/domain';
import { isSlotSourceUp, micChannelOfTrack, slotSourceOf, SlotSourceState, type CaptureSelectorSlot, type SimState, type SlotSource } from '@dems/shared/sim';
import type { StatusTone } from '@dems/shared/tokens';
import { selectorInForce } from '@/features/capture-selector/selector-in-force';
import { DEVICE_CAMERA, DEVICE_IDS, DEVICE_KIND, DEVICE_MIC, isDeviceId, type DeviceId } from './device-ids';
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

// ── Audit row 191 (M3-08 R3/R4; web rows 128, 128b, 129): ONE source reader and the track status rule ────────
/** What the track status reads: the slices of the tracks, the selector in force and the Core's device list. */
export type TrackStatusInput = Pick<SimState, 'cameras' | 'mics' | 'captureConfig' | 'captureDevices' | 'session'>;

/**
 * THE SOURCE OF A TRACK (a video track `VIDEO-0n` or a microphone channel `MIC-0n`): the shared one reader
 * `slotSourceOf` (register P12) over the selector IN FORCE and the `captureDevices` slice. The tablet's side of
 * the web's `trackSourceOf` (`apps/core-web/src/features/devices/model.ts`, row 128b). No reader of the Devices
 * screens spells its own reach rule (M3-08 R3). Pure.
 */
export function trackSourceOf(state: Pick<SimState, 'captureConfig' | 'captureDevices' | 'session'>, slot: CaptureSelectorSlot): SlotSource {
  return slotSourceOf(selectorInForce(state), state.captureDevices.devices, slot);
}

/**
 * THE STATUS OF A TRACK (row 129's rule, M3-08 R4), the same on the web and here:
 *
 * | The track's source (`trackSourceOf`) | Status |
 * |---|---|
 * | `NOT_ASSIGNED`: the selector names no device | OFFLINE |
 * | `NOT_REACHABLE` (a stated `reach`), `OFFLINE` (`online: false`, or a device the registry does not hold), or the camera line's own `online: false` | FAULT |
 * | `REACHABLE`, or `NOT_CHECKED` (`isSlotSourceUp`, P13) | the TRACK's own row: a camera `online && lens READY`, else FAULT; a microphone NO_SIGNAL / CLIP / ONLINE |
 *
 * `NOT_CHECKED` claims nothing against the source, so it is never a fault. It is never READY in words either:
 * the row and the detail say "Not checked" (C11) through `sourceRowLine` (`use-devices-data.ts`). Pure.
 */
export function trackStatus(state: TrackStatusInput, slot: CaptureSelectorSlot): DeviceStatus {
  const source = trackSourceOf(state, slot);
  if (source.state === SlotSourceState.NOT_ASSIGNED) return 'OFFLINE';
  if (!isSlotSourceUp(source)) return 'FAULT';
  if (slot.startsWith('VIDEO-')) {
    const line = selectorInForce(state).cameras.find((entry) => entry.trackId === slot) as { readonly online?: unknown } | undefined;
    if (line?.online === false) return 'FAULT';
    const camera = state.cameras.find((entry) => entry.id === slot);
    return camera && camera.online && camera.lens === 'READY' ? 'ONLINE' : 'FAULT';
  }
  const mic = state.mics.find((entry) => entry.channel === slot);
  if (!mic) return 'FAULT';
  if (mic.state === 'NO_SIGNAL') return 'NO_SIGNAL';
  if (mic.state === 'CLIP' || mic.clipLatched) return 'CLIP';
  return 'ONLINE';
}

/**
 * B16 (D114, row 190 -> 191): the status a REGISTERED device row ON a line shows besides its registry word -
 * the track's status (`trackStatus`) when it is not a ready one (a fault or a warning of the track), else null
 * (the registry rule stands: "Not checked" / "Reachable"). Null too on no line. The web's `rosterCardStatus`.
 */
export function rosterTrackStatusOf(state: TrackStatusInput, slot: CaptureSelectorSlot | null): DeviceStatus | null {
  if (slot === null) return null;
  const status = trackStatus(state, slot);
  return STATUS_RANK[status] > 0 ? status : null;
}

type StatusInput = Pick<SimState, 'network' | 'tabletLink' | 'otherDevices'> & TrackStatusInput;

export function deviceStatus(state: StatusInput, deviceId: DeviceId): DeviceStatus {
  switch (DEVICE_KIND[deviceId]) {
    // Audit row 191 (M3-08 R4; web row 129): a built-in camera / microphone row speaks for its TRACK, read through the
    // one source reader - not for a slice row looked up by the built-in id (the U-05 defect: on a Core whose lines hold
    // CAM-03 or MIC-03..06 the built-in id finds no row, or another channel's).
    case 'camera': {
      const track = DEVICE_CAMERA[deviceId];
      return track === undefined ? 'FAULT' : trackStatus(state, track);
    }
    case 'microphone': {
      const track = DEVICE_MIC[deviceId];
      return track === undefined ? 'FAULT' : trackStatus(state, micChannelOfTrack(track));
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

/**
 * Devices that need attention, worst first (FAULT before warnings), list order inside a rank.
 *
 * Audit row 227 (D213; follows row 198, M3-10 R3, D52 / I4): `notReported` names the devices whose state nobody
 * reports on this Core - on a Core in its own capture the model-only PoE switch and Recording Indicator
 * (`NO_PRODUCER_DEVICES` of `device-status-chip.tsx`, under the same gate `useNoProducerView`). Their status is the
 * simulator's model, read as "Not reported" in the list and the detail, so it never raises attention: the line would
 * otherwise name a device whose state is not reported. Real tracks (cameras, microphones: the row 191 reader) and the
 * tablet's own link still do. Empty (the default) on the simulated lane: unchanged. Pure.
 */
export function attentionDevices(statuses: Readonly<Record<DeviceId, DeviceStatus>>, notReported: ReadonlySet<DeviceId> = NONE_NOT_REPORTED): DeviceId[] {
  return DEVICE_IDS.filter((id) => !notReported.has(id) && STATUS_RANK[statuses[id]] > 0).sort((a, b) => STATUS_RANK[statuses[b]] - STATUS_RANK[statuses[a]]);
}

const NONE_NOT_REPORTED: ReadonlySet<DeviceId> = new Set<DeviceId>();

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
