/**
 * Simulator reads for the Devices & Inputs screens. Every `useSim` selector returns a primitive, a
 * store-owned reference or a flat tuple of them (D73 F74-13), so a 20 Hz audio frame or a 1 Hz
 * health tick re-renders only what actually changed. Derived values (status codes, health lines)
 * are computed from those inputs in `useMemo`, never inside a selector.
 */
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AudioTrackId } from '@dems/shared/domain';
import { Permission, selectCan, useAudioChannel, useSim, type AuditRow, type CameraStatus, type MicStatus, type SimState } from '@dems/shared/sim';
import { deviceStatus, isRecording, parseStatusLine, statusLine, type DeviceId, type DeviceStatus } from './devices-model';
import type { StatusTone } from '@dems/shared/tokens';
import { developmentSourceOf } from '@/features/capture-selector/capture-notices-model';
import { useSourceBadgeMode } from '@/features/capture-selector/development-source-badge';
import { micInputName } from '@/features/capture-selector/mic-input-name';
import { micLinesInForce } from '@/features/capture-selector/selector-in-force';
import { cameraLineReportOf, deviceReportOf, realCaptureSources, sourceStateWord } from '@/features/capture-selector/source-state';
import { DEVICE_CAMERA, DEVICE_KIND, DEVICE_NAME_KEY, STATUS_LABEL_KEY, STATUS_RANK } from './devices-model';
import { MicLevelSampler, bookPoe, deviceLog, healthSeries, type BookPoe, type HealthPoint, type HealthSeries } from './sim-adapter';

/** Every device's status, re-rendering only when one of them changes. */
export function useDeviceStatuses(): Readonly<Record<DeviceId, DeviceStatus>> {
  const line = useSim(statusLine);
  return useMemo(() => parseStatusLine(line), [line]);
}

export function useDeviceStatus(deviceId: DeviceId): DeviceStatus {
  return useSim((s) => deviceStatus(s, deviceId));
}

// ── Fix wave M (re-check 70 finding G70d-02): ONE wording rule for a capture source ─────────────────────
/** The stream word of a camera on a line while its session records ("Live"). */
const CAMERA_LIVE_KEY = 'features.capture-selector.selector.stream.LIVE';

/**
 * THE WORD AND THE ROLE OF A BUILT-IN CAPTURE ROW (`CAM-01`, `CAM-02`, `MIC-01`, `MIC-02`) ON A CORE IN ITS OWN
 * CAPTURE, as one flat line `key|tone|role|sourceKind` - or null on a simulated Core, for a row that is no
 * capture source, and for a line the selector in force does not hold. The rows and the detail drew the
 * simulator track's "Online" here, beside "Not checked" for the same source on the same pane. The word is the
 * selector line's own (`sourceStateWord`, decision D231): "Not checked" at rest unless the Core states a
 * checked fact; a negative fact is never hidden; "Live" only for a camera on a line while a session records.
 */
export function sourceRowLine(state: SimState, deviceId: DeviceId, live: boolean): string | null {
  const kind = DEVICE_KIND[deviceId];
  if (kind !== 'camera' && kind !== 'microphone') return null;
  if (!realCaptureSources(state.captureDevices.devices, live)) return null;
  const recording = state.session?.state === 'RECORDING';
  if (kind === 'camera') {
    const trackId = DEVICE_CAMERA[deviceId];
    if (trackId === undefined) return null;
    const report = cameraLineReportOf(state, trackId);
    if (report.deviceId === null) return null;
    const word = sourceStateWord(report, live, recording);
    return recording && word.kind === 'REACHABLE' ? `${CAMERA_LIVE_KEY}|success||` : `${word.key}|${word.tone}||`;
  }
  const line = micLinesInForce(state).find((candidate) => candidate.inputId === deviceId);
  if (line === undefined || line.deviceId === null || line.deviceId === undefined) return null;
  const report = deviceReportOf(state, line.deviceId, 'MIC');
  if (report.deviceId === null) return null;
  const word = sourceStateWord(report, live, recording);
  const source = developmentSourceOf({ sourceClass: report.sourceClass ?? undefined, adapter: report.adapter ?? undefined, deviceKind: 'MIC', live });
  return `${word.key}|${word.tone}|${line.role ?? ''}|${source ?? ''}`;
}

export interface SourceRow {
  /** The row's and the detail's name: the microphone line with its role in force on a Core in its own capture, else the built-in name. */
  readonly name: string;
  /** The status word in text (the detail's "Status" row, the row's accessibility label). */
  readonly statusLabel: string;
  /** The chip's word and tone when the one rule applies; null: the track's own status chip stands. */
  readonly word: { readonly label: string; readonly tone: StatusTone } | null;
}

/**
 * The name and status word of a Devices row / detail. On a simulated Core, and for a track that reports a
 * fault of its own (NO SIGNAL, CLIP, FAULT, OFFLINE - a negative fact is never replaced), it is exactly the
 * model's name and word, as before.
 */
export function useSourceRow(deviceId: DeviceId, status: DeviceStatus): SourceRow {
  const { t } = useTranslation();
  const { live } = useSourceBadgeMode();
  const line = useSim((s) => sourceRowLine(s, deviceId, live));
  return useMemo(() => {
    const model = { name: t(DEVICE_NAME_KEY[deviceId]), statusLabel: t(STATUS_LABEL_KEY[status]), word: null };
    if (line === null) return model;
    const [key = '', tone = 'default', role = '', source = ''] = line.split('|');
    // The simulator's room roles ("Interviewer", "Subject") are no fact of this Core: the line is named by its input and its role in force.
    const name =
      DEVICE_KIND[deviceId] === 'microphone'
        ? [micInputName(t, deviceId, source === '' ? null : (source as Parameters<typeof micInputName>[2])), role === '' ? null : t(`features.capture-selector.selector.role.${role}`)].filter((part) => part !== null).join(' · ')
        : model.name;
    if (STATUS_RANK[status] > 0) return { ...model, name };
    const label = t(key);
    return { name, statusLabel: label, word: { label, tone: tone as StatusTone } };
  }, [t, deviceId, status, line]);
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

/** PoE in the design book's camera-port view (SIM-GAP-M84-1; D60, 2026-11-04: four camera tracks); a flat record of primitives. */
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
