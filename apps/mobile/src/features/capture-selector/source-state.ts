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
 * | a named cause on an active "not reachable" notice, `online: false`, or a stated `reach: NOT_REACHABLE` (row 192: `isSlotSourceUp` false) | the roster's words: "Not reachable" / the local-device cause |
 * | `online: true` and no checked fact (`checkedAt` null or absent, no stated reach, nothing records) | "Not checked" (wave L) |
 * | `online: true` and a checked fact (`checkedAt` a number, a stated `reach: REACHABLE`, the source open, or a recording) | "Reachable" / "Ready" (the roster's words) |
 * | the selector names a device the registry does not hold | "State not known" |
 *
 * "Live" is said of a camera ONLY while a session of the Core is RECORDING (`cameraLineWord`).
 *
 * `checkedAt` and `reach` are typed members of a capture device (register P10). Audit row 192
 * (M3-08 R3, D173): whether the source of a line is UP is decided by the ONE shared reader
 * `slotSourceOf` / `isSlotSourceUp` (P12, P13; `@dems/shared/sim` capture-notices), the reader the
 * Core, the LCD and the web read. This module adds only the words: a named cause, "Not checked", "On".
 * Pure: no React, no store.
 */
import { micLinesInForce, selectorInForce } from '@/features/capture-selector/selector-in-force';
import type { AudioTrackId, VideoTrackId } from '@dems/shared/domain';
import { isSlotSourceUp, meterInputOfChannel, PRIMARY_MIC_CHANNEL, slotSourceOf, SlotSourceState, type CaptureSelectorSlot, type SimState, type SlotSourceSelector } from '@dems/shared/sim'; // D61 (2026-11-04): the transcribed channel
import type { StatusTone } from '@dems/shared/tokens';
import { NOT_CHECKED_KEY, rosterDeviceState, rosterStateLabelKey, sourceChecked, sourceOnKeyOf, type CaptureDeviceReachWord } from '@/features/devices/registered-devices-model';
import { captureNoticesOf, developmentSourceOf } from './capture-notices-model';

/** `true`: the Core read the device; `false`: it says it has not (`checkedAt: null`); `null`: it does not state it. */
export function checkedFactOf(device: { readonly id?: string; readonly checkedAt?: number | null | undefined } | null | undefined): boolean | null {
  // Row 192 (D173, P10): the typed member, no cast. The number test stays: the wire may still carry junk.
  const value = device?.checkedAt;
  if (value === undefined) return null;
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
  /** The Core's stated reach of the device (P10), or null when it states none. */
  readonly reach: CaptureDeviceReachWord | null;
  /** Row 192 (M3-08 R3): the state of the device as the source of its slot, by the shared `slotSourceOf` (P12). */
  readonly source: SlotSourceState;
}

type ReportState = Pick<SimState, 'captureDevices' | 'captureConfig' | 'alerts' | 'session'>;

const UNKNOWN_SOURCE = (kind: SourceReport['kind']): SourceReport => ({ deviceId: null, kind, sourceClass: null, adapter: null, online: false, sourceOpen: false, checked: null, cause: null, reach: null, source: SlotSourceState.NOT_ASSIGNED });

/** The selector and the slot the shared reader reads for a report: a line of the selector in force, or one device alone (`deviceReportOf`). */
interface SlotRead {
  readonly selector: SlotSourceSelector;
  readonly slot: CaptureSelectorSlot;
}

/**
 * A device not (necessarily) on a line - an option of the source sheet - is read as the source of a
 * one-line selector of its own kind: the sheet asks "what would this device be as the source of the
 * line". The slot name is a placeholder; `slotSourceOf` reads the device by id and kind.
 */
function loneSlotRead(deviceId: string, kind: SourceReport['kind']): SlotRead {
  return kind === 'CAMERA'
    ? { selector: { cameras: [{ trackId: 'VIDEO-01', deviceId }], mics: [] }, slot: 'VIDEO-01' }
    : { selector: { cameras: [], mics: [{ channel: 'MIC-01', deviceId }] }, slot: 'MIC-01' };
}

function reportOfDevice(state: ReportState, deviceId: string | null, kind: SourceReport['kind'], read: SlotRead | null): SourceReport {
  const device = deviceId === null ? undefined : state.captureDevices.devices.find((candidate) => candidate.id === deviceId);
  // A line that names no device, or a device the registry does not hold: "State not known" (header table).
  if (device === undefined) return UNKNOWN_SOURCE(kind);
  const notice = captureNoticesOf(state.alerts).find((entry) => entry.kind === 'unreachable' && entry.deviceId === device.id);
  const { selector, slot } = read ?? loneSlotRead(device.id, kind);
  return {
    deviceId: device.id,
    kind,
    sourceClass: device.sourceClass ?? null,
    adapter: device.adapter ?? null,
    online: device.online,
    sourceOpen: device.sourceOpen === true,
    checked: checkedFactOf(device),
    cause: notice !== undefined && notice.kind === 'unreachable' ? notice.cause : null,
    reach: device.reach ?? null,
    source: slotSourceOf(selector, state.captureDevices.devices, slot).state,
  };
}

/** The facts of ONE registered capture device, whether a line names it or not (wave L, G70c-02: the options of the source sheet). */
export function deviceReportOf(state: Pick<ReportState, 'captureDevices' | 'alerts'>, deviceId: string, kind: SourceReport['kind']): SourceReport {
  return reportOfDevice(state as ReportState, deviceId, kind, null);
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
  return micReportOfLine(state, micLineOf(state, channel));
}

/**
 * The camera behind a video track (the open session's selector snapshot, else the current selector).
 * Row 192 (M3-08 R3): the assigned device and its state are the shared reader's (`slotSourceOf`), so the
 * track id is typed as the slot it is.
 */
export function cameraLineReportOf(state: ReportState, trackId: VideoTrackId): SourceReport {
  const read: SlotRead = { selector: selectorInForce(state), slot: trackId };
  return reportOfDevice(state, slotSourceOf(read.selector, state.captureDevices.devices, read.slot).deviceId, 'CAMERA', read);
}

/** The microphone on the TRANSCRIBED channel 1 (D61 of 2026-11-04: the PRIMARY role became the numbered channel). */
export function primaryMicReportOf(state: ReportState): SourceReport {
  return micReportOfLine(state, micLinesInForce(state).find((candidate) => candidate.channel === PRIMARY_MIC_CHANNEL) ?? null);
}

type MicLineInForce = Pick<SimState['captureConfig']['mics'][number], 'channel' | 'deviceId' | 'inputId'>;

/** The report of a microphone line in force: its device, read by the shared reader on the line's own channel (row 192). */
function micReportOfLine(state: ReportState, line: MicLineInForce | null): SourceReport {
  if (line === null) return UNKNOWN_SOURCE('MIC');
  return reportOfDevice(state, line.deviceId ?? null, 'MIC', { selector: { cameras: [], mics: micLinesInForce(state) }, slot: line.channel });
}

/** The microphone line of a meter channel, or null: no line, or a channel without an input (`meterInputOfChannel`, row 171). */
function micLineOf(state: Pick<SimState, 'captureConfig' | 'session'>, channel: AudioTrackId): MicLineInForce | null {
  const lines = micLinesInForce(state);
  const inputId = meterInputOfChannel(lines, channel);
  if (inputId === null) return null;
  return lines.find((candidate) => candidate.inputId === inputId) ?? null;
}

/** The registered device id of the microphone on a meter channel's line, or null: no line, or a channel without an input (`meterInputOfChannel`). */
export function micLineDeviceIdOf(state: Pick<SimState, 'captureConfig' | 'session'>, channel: AudioTrackId): string | null {
  return micLineOf(state, channel)?.deviceId ?? null;
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
  // Row 192 (M3-08 R3, D173): UP is the shared reader's (`isSlotSourceUp`: online and not stated NOT_REACHABLE);
  // a named cause of an active "not reachable" notice is a negative fact on top of it. The roster state only
  // picks the words (the local device's named cause, or "Not reachable").
  const up = isSlotSourceUp({ state: report.source }) && report.cause === null;
  const state = rosterDeviceState({ online: report.online, cause: report.cause, reach: report.reach });
  const source = developmentSourceOf({ sourceClass: report.sourceClass ?? undefined, adapter: report.adapter ?? undefined, deviceKind: report.kind, live });
  const local = source === 'localCamera' || source === 'localMicrophone';
  // `READY` while not up is only a device whose kind is not the line's (the reader reads it OFFLINE): say it absent.
  if (!up) return { kind: 'NOT_REACHABLE', key: rosterStateLabelKey(state === 'READY' ? 'ABSENT' : state, local), tone: 'danger' };
  // Reachable by its registration only: the Core states no checked fact of the device (it says it has not read
  // it since it started, or it says nothing), states no reach, and nothing records on the line. A stated
  // REACHABLE is a checked fact (it comes dated by `checkedAt`), as on the web (row 129, R7) and the roster (row 190).
  const checked = sourceChecked({ checked: report.checked, sourceOpen: report.sourceOpen, recording }) || report.source === SlotSourceState.REACHABLE;
  if (!checked) return { kind: 'NOT_CHECKED', key: NOT_CHECKED_KEY, tone: 'default' };
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
