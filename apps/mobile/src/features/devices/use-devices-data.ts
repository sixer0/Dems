/**
 * Simulator reads for the Devices & Inputs screens. Every `useSim` selector returns a primitive, a
 * store-owned reference or a flat tuple of them (D73 F74-13), so a 20 Hz audio frame or a 1 Hz
 * health tick re-renders only what actually changed. Derived values (status codes, health lines)
 * are computed from those inputs in `useMemo`, never inside a selector.
 */
import { useMemo, useRef, useState } from 'react';
import type { AudioTrackId } from '@dems/shared/domain';
import { Permission, selectCan, useAudioChannel, useSim, type AuditRow, type CameraStatus, type MicStatus } from '@dems/shared/sim';
import { deviceStatus, isRecording, parseStatusLine, statusLine, type DeviceId, type DeviceStatus } from './devices-model';
import { MicLevelSampler, bookPoe, deviceLog, healthSeries, type BookPoe, type HealthPoint, type HealthSeries } from './sim-adapter';

/** Every device's status, re-rendering only when one of them changes. */
export function useDeviceStatuses(): Readonly<Record<DeviceId, DeviceStatus>> {
  const line = useSim(statusLine);
  return useMemo(() => parseStatusLine(line), [line]);
}

export function useDeviceStatus(deviceId: DeviceId): DeviceStatus {
  return useSim((s) => deviceStatus(s, deviceId));
}

export function useIsRecording(): boolean {
  return useSim(isRecording);
}

/**
 * Restart needs DEVICE_MANAGE (TECHNICIAN, D79; SIM-GAP-M84-3).
 *
 * Site S5-4 (backend task W78): a display hint in both modes. In LIVE mode the role comes from the
 * replicated `operators` slice and the Core server enforces DEVICE_MANAGE on operation 48 itself.
 */
export function useCanManageDevices(): boolean {
  return useSim((s) => selectCan(s, Permission.DEVICE_MANAGE));
}

export function useCamera(deviceId: DeviceId): CameraStatus | null {
  return useSim((s) => s.cameras.find((camera) => camera.deviceId === deviceId) ?? null);
}

export function useMic(deviceId: DeviceId): MicStatus | null {
  return useSim((s) => s.mics.find((mic) => mic.deviceId === deviceId) ?? null);
}

/** PoE in the design book's 2-port view (SIM-GAP-M84-1); a flat record of primitives. */
export function useBookPoe(): BookPoe {
  return useSim((s) => bookPoe(s));
}

export function useTabletLink() {
  return useSim((s) => s.tabletLink);
}

/** Newest first; the rows are store-owned references. */
export function useDeviceLog(deviceId: DeviceId): AuditRow[] {
  return useSim((s) => deviceLog(s.audit.rows, deviceId));
}

/** The 1 Hz health line of a non-microphone device (SIM-GAP-M84-2). */
export function useHealthSeries(deviceId: DeviceId): HealthSeries {
  const [history, poeDrawW, cameras, faults, tabletLink, session] = useSim(
    (s) => [s.network.bandwidth.history, s.network.poe.drawW, s.cameras, s.faults, s.tabletLink, s.session] as const,
  );
  return useMemo(
    () => healthSeries({ history, poeDrawW, cameras, faults, tabletLink, session }, deviceId),
    [history, poeDrawW, cameras, faults, tabletLink, session, deviceId],
  );
}

/**
 * The 1 s peak line of a microphone (SIM-GAP-M84-2), sampled from the moment it mounts. Frames
 * arrive at 20 Hz without renders (`useAudioChannel`); a point closes on each new SIMULATOR second
 * of the frame clock, so this renders at most once per second and needs no wall-clock timer.
 */
export function useMicLevelSeries(channel: AudioTrackId): HealthSeries {
  const sampler = useRef<MicLevelSampler | null>(null);
  const [points, setPoints] = useState<readonly HealthPoint[]>([]);
  useAudioChannel(channel, (frame) => {
    if (sampler.current === null) sampler.current = new MicLevelSampler();
    if (sampler.current.push(frame)) setPoints(sampler.current.points());
  });
  return useMemo(() => ({ metric: 'signal' as const, domain: [-90, 0] as const, points }), [points]);
}
