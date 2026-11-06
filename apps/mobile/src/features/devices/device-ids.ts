/**
 * Device identities of the Devices & Inputs screens (04_mobile_specs §4.12). The IDs are the
 * simulator's (`CAM-01`, `MIC-02`, `POE-SWITCH`, …); the Home tiles link to `/devices/<deviceId>`
 * with the same IDs (step 77). Shared by `devices-model.ts` and `sim-adapter.ts`.
 */
import type { AudioTrackId, VideoTrackId } from '@dems/shared/domain';

// D60 (2026-11-04): the simulator seeds four cameras (CAM-01..CAM-04), one track each.
// D61 (2026-11-04): and four microphones (MIC-01..MIC-04), one channel each.
export const DEVICE_IDS = ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04', 'POE-SWITCH', 'REC-INDICATOR', 'TABLET'] as const;
export type DeviceId = (typeof DEVICE_IDS)[number];

export type DeviceKind = 'camera' | 'microphone' | 'poe' | 'relay' | 'tablet';

export const DEVICE_KIND: Readonly<Record<DeviceId, DeviceKind>> = {
  'CAM-01': 'camera',
  'CAM-02': 'camera',
  'CAM-03': 'camera', // D60 (2026-11-04)
  'CAM-04': 'camera', // D60
  'MIC-01': 'microphone',
  'MIC-02': 'microphone',
  'MIC-03': 'microphone', // D61 (2026-11-04)
  'MIC-04': 'microphone', // D61
  'POE-SWITCH': 'poe',
  'REC-INDICATOR': 'relay',
  TABLET: 'tablet',
};

// D60 (2026-11-04): four camera tracks — CAM-03 and CAM-04 join the pair.
export const DEVICE_CAMERA: Readonly<Partial<Record<DeviceId, VideoTrackId>>> = { 'CAM-01': 'VIDEO-01', 'CAM-02': 'VIDEO-02', 'CAM-03': 'VIDEO-03', 'CAM-04': 'VIDEO-04' };
// D61 (2026-11-04): four simultaneous microphone channels — MIC-03 and MIC-04 join the pair.
export const DEVICE_MIC: Readonly<Partial<Record<DeviceId, AudioTrackId>>> = { 'MIC-01': 'AUDIO-01', 'MIC-02': 'AUDIO-02', 'MIC-03': 'AUDIO-03', 'MIC-04': 'AUDIO-04' };

export function isDeviceId(value: string | null | undefined): value is DeviceId {
  return typeof value === 'string' && (DEVICE_IDS as readonly string[]).includes(value);
}
