/**
 * Device identities of the Devices & Inputs screens (04_mobile_specs §4.12). The IDs are the
 * simulator's (`CAM-01`, `MIC-02`, `POE-SWITCH`, …); the Home tiles link to `/devices/<deviceId>`
 * with the same IDs (step 77). Shared by `devices-model.ts` and `sim-adapter.ts`.
 */
import type { AudioTrackId, VideoTrackId } from '@dems/shared/domain';

export const DEVICE_IDS = ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02', 'POE-SWITCH', 'REC-INDICATOR', 'TABLET'] as const;
export type DeviceId = (typeof DEVICE_IDS)[number];

export type DeviceKind = 'camera' | 'microphone' | 'poe' | 'relay' | 'tablet';

export const DEVICE_KIND: Readonly<Record<DeviceId, DeviceKind>> = {
  'CAM-01': 'camera',
  'CAM-02': 'camera',
  'MIC-01': 'microphone',
  'MIC-02': 'microphone',
  'POE-SWITCH': 'poe',
  'REC-INDICATOR': 'relay',
  TABLET: 'tablet',
};

export const DEVICE_CAMERA: Readonly<Partial<Record<DeviceId, VideoTrackId>>> = { 'CAM-01': 'VIDEO-01', 'CAM-02': 'VIDEO-02' };
export const DEVICE_MIC: Readonly<Partial<Record<DeviceId, AudioTrackId>>> = { 'MIC-01': 'AUDIO-01', 'MIC-02': 'AUDIO-02' };

export function isDeviceId(value: string | null | undefined): value is DeviceId {
  return typeof value === 'string' && (DEVICE_IDS as readonly string[]).includes(value);
}
