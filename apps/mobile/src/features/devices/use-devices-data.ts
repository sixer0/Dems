/**
 * Simulator reads for the Devices & Inputs screens. Every `useSim` selector returns a primitive, a
 * store-owned reference or a flat tuple of them (D73 F74-13), so a 20 Hz audio frame or a 1 Hz
 * health tick re-renders only what actually changed. Derived values (status codes, health lines)
 * are computed from those inputs in `useMemo`, never inside a selector.
 */
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AudioTrackId } from '@dems/shared/domain';
import { micChannelOfTrack, Permission, selectCan, SlotSourceState, useAudioChannel, useSim, type AuditRow, type CameraStatus, type CaptureSelectorSlot, type MicStatus, type SimState, type SlotSource } from '@dems/shared/sim';
import { deviceStatus, isRecording, parseStatusLine, statusLine, trackSourceOf, type DeviceId, type DeviceStatus } from './devices-model';
import type { StatusTone } from '@dems/shared/tokens';
import { developmentSourceOf } from '@/features/capture-selector/capture-notices-model';
import { useSourceBadgeMode } from '@/features/capture-selector/development-source-badge';
import { micInputName } from '@/features/capture-selector/mic-input-name';
import { micLinesInForce } from '@/features/capture-selector/selector-in-force';
import { cameraLineReportOf, deviceReportOf, realCaptureSources, sourceStateWord, type SourceReport } from '@/features/capture-selector/source-state';
import { DEVICE_CAMERA, DEVICE_KIND, DEVICE_MIC, DEVICE_NAME_KEY, STATUS_LABEL_KEY, STATUS_RANK } from './devices-model';
import { drawnByOwnTile } from './registered-devices-model';
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
/**
 * Audit row 191 (M3-08 R3/R4): the report a row's word is drawn from, AS THE ONE SOURCE READER STATES IT
 * (`trackSourceOf`, the shared `slotSourceOf`). The report's own `online` / `checkedAt` reading no longer decides
 * alone:
 *
 * | `trackSourceOf(...).state` | The word's report |
 * |---|---|
 * | `NOT_REACHABLE` (stated `reach`) or `OFFLINE` | not reachable (`online: false`): a negative fact is never hidden |
 * | `REACHABLE` (stated `reach`) | checked: the Core read it, so the roster's "Reachable" / "Ready" |
 * | `NOT_CHECKED` (no `reach`) | as the Core sent it: "Not checked" unless it states `checkedAt` (wave L, G70c-02; row 190) |
 */
function readerReport(report: SourceReport, source: SlotSource): SourceReport {
  if (source.state === SlotSourceState.NOT_REACHABLE || source.state === SlotSourceState.OFFLINE) return { ...report, online: false };
  if (source.state === SlotSourceState.REACHABLE) return { ...report, checked: true };
  return report;
}

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
    const word = sourceStateWord(readerReport(report, trackSourceOf(state, trackId)), live, recording);
    return recording && word.kind === 'REACHABLE' ? `${CAMERA_LIVE_KEY}|success||` : `${word.key}|${word.tone}||`;
  }
  // Audit row 229 (F1): the built-in row MIC-0N is the SLOT (channel MIC-0N), as its status (`trackStatus`) already was -
  // never the line whose input happens to carry the built-in id (that drew MIC-03 twice and FAKE MIC-01/02 once).
  const channel = builtInSlotOf(deviceId);
  const line = micLinesInForce(state).find((candidate) => candidate.channel === channel);
  if (line === undefined || line.deviceId === null || line.deviceId === undefined) return null;
  const report = deviceReportOf(state, line.deviceId, 'MIC');
  if (report.deviceId === null) return null;
  const word = sourceStateWord(typeof line.channel === 'string' ? readerReport(report, trackSourceOf(state, line.channel)) : report, live, recording);
  const source = developmentSourceOf({ sourceClass: report.sourceClass ?? undefined, adapter: report.adapter ?? undefined, deviceKind: 'MIC', live });
  return `${word.key}|${word.tone}|${line.channel ?? ''}|${source ?? ''}`; // D61 (2026-11-04): the line states its channel
}

// ── Audit row 229 (M3 cycle 2, F1; M3-08 E1; the web twin W4-2 / D226): a built-in row IS ITS SLOT ──────────────────
/** The slot a built-in capture row stands for: `CAM-0N` -> video track `VIDEO-0N`, `MIC-0N` -> microphone channel `MIC-0N`; null for any other row. */
export function builtInSlotOf(deviceId: DeviceId): CaptureSelectorSlot | null {
  const video = DEVICE_CAMERA[deviceId];
  if (video !== undefined) return video;
  const audio = DEVICE_MIC[deviceId];
  return audio === undefined ? null : micChannelOfTrack(audio);
}

/** What the slot of a built-in row holds on a Core in real capture (`assignedSourceLine`). */
export interface AssignedSource {
  readonly slot: CaptureSelectorSlot;
  /** The device the selector in force names for the slot (the one source reader, `trackSourceOf`); null: not assigned. */
  readonly deviceId: string | null;
  /** True when the roster does NOT list that device (`drawnByOwnTile`: a built-in id on its own line): the row then names its id, so the id appears once. */
  readonly ownTile: boolean;
  /** The assigned device is a generated test source (`adapter: FAKE`). */
  readonly generated: boolean;
  /** Its development badge kind (`developmentSourceOf`), or null. */
  readonly source: string | null;
}

/**
 * THE ASSIGNED SOURCE OF A BUILT-IN CAMERA / MICROPHONE ROW on a Core in real capture, as one flat line
 * `slot|deviceId|ownTile|generated|source` (a `useSim` selector compares it by value) - or null on the simulated lane
 * (Simulated client mode, or a Core whose devices state no class: `realCaptureSources`) and for any other row.
 *
 * The row is its slot (row 191 reads its status by the slot; the selector draws one row per slot): its device is
 * `trackSourceOf(slot).deviceId`, never the built-in id. So the fixed "CAM-0N" / "MIC-0N" of the seed is no device
 * fact on such a Core (F1 d), and an unassigned FAKE built-in is drawn nowhere (F1 b). Pure.
 */
export function assignedSourceLine(state: SimState, deviceId: DeviceId, live: boolean): string | null {
  const slot = builtInSlotOf(deviceId);
  if (slot === null) return null;
  if (!realCaptureSources(state.captureDevices.devices, live)) return null;
  const assigned = trackSourceOf(state, slot).deviceId;
  if (assigned === null) return `${slot}||||`;
  const device = state.captureDevices.devices.find((entry) => entry.id === assigned);
  const ownTile = device !== undefined && drawnByOwnTile(state.captureConfig, device);
  const source = device === undefined ? null : developmentSourceOf({ sourceClass: device.sourceClass ?? undefined, adapter: device.adapter ?? undefined, deviceKind: device.kind === 'MIC' ? 'MIC' : 'CAMERA', live });
  return `${slot}|${assigned}|${ownTile ? '1' : ''}|${device?.adapter === 'FAKE' ? '1' : ''}|${source ?? ''}`;
}

export function parseAssignedSource(line: string | null): AssignedSource | null {
  if (line === null) return null;
  const [slot = '', deviceId = '', ownTile = '', generated = '', source = ''] = line.split('|');
  return { slot: slot as CaptureSelectorSlot, deviceId: deviceId === '' ? null : deviceId, ownTile: ownTile === '1', generated: generated === '1', source: source === '' ? null : source };
}

/** The assigned source of a built-in row (null on the simulated lane), re-rendering only when it changes. */
export function useAssignedSource(deviceId: DeviceId): AssignedSource | null {
  const { live } = useSourceBadgeMode();
  const line = useSim((s) => assignedSourceLine(s, deviceId, live));
  return useMemo(() => parseAssignedSource(line), [line]);
}

/** The id a built-in row's detail shows: the assigned device on a Core in real capture ("Not assigned" when none), else the built-in id (simulated lane). */
export function assignedIdText(t: (key: string) => string, deviceId: DeviceId, assigned: AssignedSource | null): string {
  if (assigned === null) return deviceId;
  return assigned.deviceId ?? t('common.developmentRoster.usedAs.NONE');
}

export interface SourceRow {
  /** The row's and the detail's name: the microphone line with its role in force on a Core in its own capture, else the built-in name. */
  readonly name: string;
  /** The status word in text (the detail's "Status" row, the row's accessibility label). */
  readonly statusLabel: string;
  /** The chip's word and tone when the one rule applies; null: the track's own status chip stands. */
  readonly word: { readonly label: string; readonly tone: StatusTone } | null;
  /** Row 229: the row's second line on a Core in real capture (the assigned input, its id when the roster does not list it); null: the row's own line stands. */
  readonly detail: string | null;
  /** Row 229: what the slot holds on a Core in real capture; null on the simulated lane. */
  readonly assigned: AssignedSource | null;
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
  const assigned = useAssignedSource(deviceId);
  return useMemo(() => {
    const model = { name: t(DEVICE_NAME_KEY[deviceId]), statusLabel: t(STATUS_LABEL_KEY[status]), word: null, detail: null, assigned: null };
    if (assigned === null) return model;
    // Audit row 229 (F1): on a Core in real capture a microphone row is its PAIR SLOT, named by the pair words the selector
    // uses ("Mic N (Camera N)", `devices.pairs.micOfCamera`; D5), never by the simulator's room roles or a built-in id.
    const pair = Number(assigned.slot.slice(-1)) || 1;
    const name = DEVICE_KIND[deviceId] === 'microphone' ? t('devices.pairs.micOfCamera', { n: pair }) : model.name;
    const detail = assignedDetail(t, deviceId, assigned);
    const base = { ...model, name, detail, assigned };
    if (line === null || STATUS_RANK[status] > 0) return base;
    const [key = '', tone = 'default'] = line.split('|');
    const label = t(key);
    return { ...base, statusLabel: label, word: { label, tone: tone as StatusTone } };
  }, [t, deviceId, status, line, assigned]);
}

/**
 * Row 229 (F1, M3-08 E1): the second line of a built-in row on a Core in real capture. A microphone slot names its input
 * ("MIC 3", or "Core Mac's microphone"); "Not assigned" when the slot holds none. The device id is drawn here ONLY when
 * the registered roster does not list the device (`ownTile`), so each id of the Core's list appears exactly once
 * across these rows and the roster. A generated source says so. A camera keeps its own line unless it is on its own track.
 */
function assignedDetail(t: (key: string, options?: Record<string, unknown>) => string, deviceId: DeviceId, assigned: AssignedSource): string | null {
  const generated = assigned.generated ? t('common.developmentRoster.source.FAKE') : null;
  if (assigned.deviceId === null) return t('common.developmentRoster.usedAs.NONE');
  if (DEVICE_KIND[deviceId] === 'microphone') {
    const input = assigned.ownTile ? assigned.deviceId : micInputName(t, assigned.deviceId, assigned.source as Parameters<typeof micInputName>[2]);
    return [input, generated].filter((part) => part !== null).join(' · ');
  }
  return assigned.ownTile ? [assigned.deviceId, generated].filter((part) => part !== null).join(' · ') : null;
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

/**
 * The TRACK row of a built-in camera row (`cameras[].id === VIDEO-0N`). Audit row 229 (F1): by the slot, as `trackStatus`
 * reads it - not by the slice's `deviceId`, which on a Core in real capture names the camera on the track (CAM-03 on
 * VIDEO-01), so the built-in id found another track's row or a stale one. On the simulated seed the two are the same.
 */
export function useCamera(deviceId: DeviceId): CameraStatus | null {
  return useSim((s) => s.cameras.find((camera) => camera.id === DEVICE_CAMERA[deviceId]) ?? null);
}

/** The CHANNEL row of a built-in microphone row (`mics[].channel === MIC-0N`, as `trackStatus` reads it; row 229, F1). */
export function useMic(deviceId: DeviceId): MicStatus | null {
  return useSim((s) => {
    const slot = builtInSlotOf(deviceId);
    return slot === null ? null : (s.mics.find((mic) => mic.channel === slot) ?? null);
  });
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
