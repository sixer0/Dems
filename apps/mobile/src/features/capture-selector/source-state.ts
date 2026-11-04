/**
 * WHAT THE CORE REPORTED FOR A CAPTURE SOURCE, in words (fix wave I, driver C; re-gate 70 finding
 * G70b-06, the Home microphone item of re-gate 75; contract note `contract_wave_i_a2.md` §4).
 *
 * On a Core in REAL capture `online` / `streamState` of a device are read from its registration and
 * change only when the Core reads the device (a pre-check, a re-read, the telemetry of a recording).
 * So on an idle Core "online" means "registered and not known to be gone", and nothing is "live".
 * The rules, for every surface that words a source of such a Core:
 *
 * | The Core says | The surface says |
 * |---|---|
 * | the device is its local device and `sourceOpen: true` | "On" (`sourceOnKeyOf`; the fixed sentence is the badge's) |
 * | `checkedAt: null` on the device (the Core has not read it since it started) | "Not checked" |
 * | a named cause on an active "not reachable" notice, or `online: false` | the roster's words: "Not reachable" / the local-device cause |
 * | `online: true` (and `checkedAt` a number, or absent = the Core does not state it) | "Reachable" / "Ready" (the roster's words) |
 * | the selector names a device the registry does not hold | "State not known" |
 *
 * "Live" is said of a camera ONLY while a session of the Core is RECORDING (`cameraLineWord`).
 *
 * `checkedAt` is a PLANNED additive member (the name is fixed by the contract note; it is not in the
 * shared types yet), so it is read defensively: absent = the Core does not state it = as before.
 * Pure: no React, no store.
 */
import { micLinesInForce, selectorInForce } from '@/features/capture-selector/selector-in-force';
import type { AudioTrackId } from '@dems/shared/domain';
import { meterInputOfChannel, PRIMARY_MIC_CHANNEL, type SimState } from '@dems/shared/sim'; // D61 (2026-11-04): the transcribed channel
import type { StatusTone } from '@dems/shared/tokens';
import { NOT_CHECKED_KEY, rosterDeviceState, rosterStateLabelKey, sourceChecked, sourceOnKeyOf } from '@/features/devices/registered-devices-model';
import { captureNoticesOf, developmentSourceOf } from './capture-notices-model';

/** `true`: the Core read the device; `false`: it says it has not (`checkedAt: null`); `null`: it does not state it. */
export function checkedFactOf(device: object | null | undefined): boolean | null {
  if (device === null || device === undefined || !('checkedAt' in device)) return null;
  const value = (device as { readonly checkedAt?: unknown }).checkedAt;
  if (value === null) return false;
  return typeof value === 'number' ? true : null;
}

/** The facts of the capture device behind a line, as the Core sent them. */
export interface SourceReport {
  /** The registered device, or null when the selector names none or the registry does not hold it. */
  readonly deviceId: string | null;
  readonly kind: 'CAMERA' | 'MIC';
  readonly sourceClass: string | null;
  readonly adapter: string | null;
  readonly online: boolean;
  readonly sourceOpen: boolean;
  readonly checked: boolean | null;
  /** The named cause of the device's active "not reachable" notice, or null. */
  readonly cause: string | null;
}

type ReportState = Pick<SimState, 'captureDevices' | 'captureConfig' | 'alerts' | 'session'>;

const UNKNOWN_SOURCE = (kind: SourceReport['kind']): SourceReport => ({ deviceId: null, kind, sourceClass: null, adapter: null, online: false, sourceOpen: false, checked: null, cause: null });

function reportOfDevice(state: ReportState, deviceId: string | null, kind: SourceReport['kind']): SourceReport {
  const device = deviceId === null ? undefined : state.captureDevices.devices.find((candidate) => candidate.id === deviceId);
  if (device === undefined) return UNKNOWN_SOURCE(kind);
  const notice = captureNoticesOf(state.alerts).find((entry) => entry.kind === 'unreachable' && entry.deviceId === device.id);
  return {
    deviceId: device.id,
    kind,
    sourceClass: device.sourceClass ?? null,
    adapter: device.adapter ?? null,
    online: device.online,
    sourceOpen: device.sourceOpen === true,
    checked: checkedFactOf(device),
    cause: notice !== undefined && notice.kind === 'unreachable' ? notice.cause : null,
  };
}

/** The facts of ONE registered capture device, whether a line names it or not (wave L, G70c-02: the options of the source sheet). */
export function deviceReportOf(state: Pick<ReportState, 'captureDevices' | 'alerts'>, deviceId: string, kind: SourceReport['kind']): SourceReport {
  return reportOfDevice(state as ReportState, deviceId, kind);
}

/**
 * The microphone ON the line of a meter channel (the open session's selector snapshot, else the current selector).
 *
 * Task 4 row 171 (site M5; decision C18 (2)): the input of the channel is found by the lookup of row 164
 * (`meterInputOfChannel`). A channel WITHOUT an input - the selector holds no complete microphone pair -
 * names no device: the report is the unknown source (`deviceId: null`), never the device behind
 * `MIC-01` / `MIC-02`.
 */
export function micLineReportOf(state: ReportState, channel: AudioTrackId): SourceReport {
  return reportOfDevice(state, micLineDeviceIdOf(state, channel), 'MIC');
}

/** The camera behind a video track (the open session's selector snapshot, else the current selector). */
export function cameraLineReportOf(state: ReportState, trackId: string): SourceReport {
  const selector = selectorInForce(state);
  return reportOfDevice(state, selector.cameras.find((line) => line.trackId === trackId)?.deviceId ?? null, 'CAMERA');
}

/** The microphone on the TRANSCRIBED channel 1 (D61 of 2026-11-04: the PRIMARY role became the numbered channel). */
export function primaryMicReportOf(state: ReportState): SourceReport {
  const line = micLinesInForce(state).find((candidate) => candidate.channel === PRIMARY_MIC_CHANNEL);
  return reportOfDevice(state, line?.deviceId ?? null, 'MIC');
}

/** The registered device id of the microphone on a meter channel's line, or null: no line, or a channel without an input (`meterInputOfChannel`). */
export function micLineDeviceIdOf(state: Pick<SimState, 'captureConfig' | 'session'>, channel: AudioTrackId): string | null {
  const lines = micLinesInForce(state);
  const inputId = meterInputOfChannel(lines, channel);
  if (inputId === null) return null;
  return lines.find((candidate) => candidate.inputId === inputId)?.deviceId ?? null;
}

export type SourceStateKind = 'UNKNOWN' | 'ON' | 'NOT_CHECKED' | 'REACHABLE' | 'NOT_REACHABLE';

export interface SourceStateWord {
  readonly kind: SourceStateKind;
  /** The i18n key of the word. */
  readonly key: string;
  readonly tone: StatusTone;
}

/**
 * The one word a surface shows for a source of a Core in real capture, and its tone.
 *
 * Fix wave L, controller ruling on G70c-02: a source AT REST of which the Core holds no checked fact
 * is "Not checked" - on the web and here. "Reachable" only with a checked fact (`checkedAt` stated,
 * the source open, or `recording`: a session records on the line). `recording` is the caller's:
 * true only for a source ON a line while a session of the Core records.
 */
export function sourceStateWord(report: SourceReport, live: boolean, recording = false): SourceStateWord {
  if (report.deviceId === null) return { kind: 'UNKNOWN', key: 'features.capture-selector.preview.stateUnknown', tone: 'default' };
  if (sourceOnKeyOf({ sourceClass: report.sourceClass, adapter: report.adapter, deviceKind: report.kind, sourceOpen: report.sourceOpen }, live) !== null) {
    return { kind: 'ON', key: 'features.capture-selector.preview.on', tone: 'warning' };
  }
  const state = rosterDeviceState({ online: report.online, cause: report.cause });
  const source = developmentSourceOf({ sourceClass: report.sourceClass ?? undefined, adapter: report.adapter ?? undefined, deviceKind: report.kind, live });
  const local = source === 'localCamera' || source === 'localMicrophone';
  if (state !== 'READY') return { kind: 'NOT_REACHABLE', key: rosterStateLabelKey(state, local), tone: 'danger' };
  // Reachable by its registration only: the Core states no checked fact of the device (it says it has not read
  // it since it started, or it says nothing) and nothing records on the line.
  if (!sourceChecked({ checked: report.checked, sourceOpen: report.sourceOpen, recording })) return { kind: 'NOT_CHECKED', key: NOT_CHECKED_KEY, tone: 'default' };
  return { kind: 'REACHABLE', key: rosterStateLabelKey(state, local), tone: 'success' };
}

/**
 * Whether the data is a Core server's and that Core is in REAL capture: it sent a `sourceClass` on a
 * capture device, or its device list is not there. THE SAME RULE as `realCaptureView` of
 * `@/features/devices/camera-preview` (held equal on vectors by `source-state.test.ts`); it
 * stands here too because that module also loads the Skia feed, which the selector card must not.
 */
export function realCaptureSources(devices: readonly { readonly sourceClass?: string | null | undefined }[], live: boolean): boolean {
  if (!live) return false;
  return devices.length === 0 || devices.some((device) => device.sourceClass !== undefined && device.sourceClass !== null);
}

/**
 * The chip word of a CAMERA line of the selector on a Core in real capture (contract note A2 §4, RULED):
 * "Live" / "Lost" only while a session of the Core is RECORDING (the recording's telemetry is the one
 * thing that makes it true); outside a recording `null` = say the device's reported state
 * (`sourceStateWord`) instead.
 */
export function cameraStreamWordApplies(input: { readonly realCapture: boolean; readonly recording: boolean }): boolean {
  return !input.realCapture || input.recording;
}
