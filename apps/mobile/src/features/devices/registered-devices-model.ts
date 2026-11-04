/**
 * The registered devices beyond the built-in ids, as the tablet and the phone draw them (task 3,
 * R-11, blueprint row 140; rulings D137 (2), D128, D136 (3); ux spec §8f flow 12, §8f.3). Pure: no
 * React, no simulator instance.
 *
 * The Devices screens list a CLOSED set of ids (`DEVICE_IDS`). The Core registers more: its own
 * camera and microphone (`CAM-03` / `MIC-03`, D106 (4)) and every camera added on the web console.
 * This roster is built from the Core's device list — the replicated `captureDevices` slice
 * (operation 77) — and from nothing else:
 *
 * | Fact | From (never client state) |
 * |---|---|
 * | which devices | `captureDevices.devices` of kind CAMERA / MIC whose id is not a built-in id |
 * | badge, kind text, the name "Core Mac's ..." | `sourceClass`, `adapter` (decided by the Core; Live mode only, D83 / D131) |
 * | 'is on' | `sourceOpen` — an optional member of the shared `captureDevices` slice (SEC35-44 (4); `packages/shared/src/api/state-slices.ts`): a runtime fact, absent = not on. `sourceOnKeyOf` is the ONE rule of every surface (fix F-M4, R69-02) |
 * | used as | the selector line that names the device (`captureConfig`) |
 * | state | `online`, and the named cause of the active "not reachable" notice of the device |
 * | rate warning | an active advisory alert `params.reason: MIC_RATE_AT_LIMIT` with the device as `target` |
 *
 * A selector hands a screen `rosterLine(state)`: ONE string, so it compares by value (F74-13) and a
 * 20 Hz meter frame renders nothing.
 */
import type { SimState } from '@dems/shared/sim';
import { captureNoticesOf, developmentSourceOf, localDeviceStateOf, type DevelopmentSourceKind, type LocalDeviceState } from '@/features/capture-selector/capture-notices-model';
import { micInputName, type MicNameTranslate } from '@/features/capture-selector/mic-input-name';

/** The four ids the screens' own rows already draw. */
// D60 (2026-11-04): the built-in set is the seed's — four cameras and two microphones; the roster lists what the Core holds beyond these.
export const BUILT_IN_SOURCE_IDS: readonly string[] = ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02'];

/** `params.reason` of the advisory alert of a microphone whose rate controller is at its limit (capture protocol 4). */
export const MIC_RATE_AT_LIMIT = 'MIC_RATE_AT_LIMIT';

export type RosterKind = 'CAMERA' | 'MIC';
export type RosterSlot = 'VIDEO-01' | 'VIDEO-02' | 'PRIMARY' | 'STANDBY';

export interface RegisteredDevice {
  readonly id: string;
  readonly kind: RosterKind;
  /** What the device announced: untrusted text, never the name. */
  readonly model: string | null;
  readonly host: string | null;
  readonly adapter: string | null;
  readonly sourceClass: string | null;
  readonly online: boolean;
  readonly streamState: string | null;
  /** True only when the Core sent `sourceOpen: true`. */
  readonly sourceOpen: boolean;
  /** Fix wave L (G70c-02 ruling): the Core STATES when it last checked the device (`checkedAt`, a finite number). Absent / null: no checked fact. */
  readonly checked?: boolean;
  readonly slot: RosterSlot | null;
  /** The named cause of the device's active "not reachable" notice, or null. */
  readonly cause: string | null;
  readonly rateAtLimit: boolean;
}

type RosterState = Pick<SimState, 'captureDevices' | 'captureConfig' | 'alerts'>;

/** The roster in the Core's order: cameras and microphones beyond the built-in ids. */
export function registeredDevicesOf(state: RosterState): RegisteredDevice[] {
  const notices = captureNoticesOf(state.alerts);
  const out: RegisteredDevice[] = [];
  for (const device of state.captureDevices.devices) {
    if ((device.kind !== 'CAMERA' && device.kind !== 'MIC') || BUILT_IN_SOURCE_IDS.includes(device.id)) continue;
    const kind: RosterKind = device.kind;
    const camera = kind === 'CAMERA' ? state.captureConfig.cameras.find((line) => line.deviceId === device.id) : undefined;
    const mic = kind === 'MIC' ? state.captureConfig.mics.find((line) => line.deviceId === device.id) : undefined;
    const slot: RosterSlot | null = camera !== undefined ? (camera.trackId === 'VIDEO-01' || camera.trackId === 'VIDEO-02' ? camera.trackId : null) : mic !== undefined ? (mic.role === 'PRIMARY' ? 'PRIMARY' : 'STANDBY') : null;
    const notice = notices.find((entry) => entry.kind === 'unreachable' && entry.deviceId === device.id);
    out.push({
      id: device.id,
      kind,
      model: device.model,
      host: device.host,
      adapter: device.adapter ?? null,
      checked: sourceChecked({ checkedAt: (device as { readonly checkedAt?: unknown }).checkedAt }),
      sourceClass: device.sourceClass ?? null,
      online: device.online,
      streamState: device.streamState,
      sourceOpen: device.sourceOpen === true,
      slot,
      cause: notice !== undefined && notice.kind === 'unreachable' ? notice.cause : null,
      rateAtLimit: kind === 'MIC' && state.alerts.some((alert) => alert.active && alert.kind === 'SYSTEM' && alert.params?.['reason'] === MIC_RATE_AT_LIMIT && (alert.target ?? null) === device.id),
    });
  }
  return out;
}

/** The roster as one comparable string (for a `useSim` selector). */
export function rosterLine(state: RosterState): string {
  return JSON.stringify(registeredDevicesOf(state));
}

export function parseRosterLine(line: string): RegisteredDevice[] {
  return JSON.parse(line) as RegisteredDevice[];
}

/** The badge kind of a roster device, by the one rule of the badge (`developmentSourceOf`). */
export function rosterSourceKind(device: Pick<RegisteredDevice, 'sourceClass' | 'adapter' | 'kind'>, live: boolean): DevelopmentSourceKind | null {
  return developmentSourceOf({ sourceClass: device.sourceClass ?? undefined, adapter: device.adapter ?? undefined, deviceKind: device.kind, live });
}

/**
 * The name of a roster device. The Core's local device, in Live mode: "Core Mac's camera" / "Core
 * Mac's microphone" (D83, OP-125-7: the tablet is not the Mac). Another microphone: "MIC 3". Another
 * camera: "Camera CAM-04" — its announced model is never the name.
 */
export function rosterDeviceName(t: MicNameTranslate, device: Pick<RegisteredDevice, 'id' | 'kind' | 'sourceClass' | 'adapter'>, live: boolean): string {
  const source = rosterSourceKind(device, live);
  if (device.kind === 'MIC') return micInputName(t, device.id, source);
  if (source === 'localCamera') return t('features.capture-selector.source.kind.localCamera');
  return t('common.developmentRoster.name', { kind: t('common.developmentRoster.kind.CAMERA'), id: device.id });
}

/** The state of a roster device: a named cause wins over `online` (§8f.3). */
export function rosterDeviceState(device: Pick<RegisteredDevice, 'online' | 'cause'>): LocalDeviceState {
  return localDeviceStateOf(device.online && device.cause === null, device.cause === 'UNREACHABLE' ? null : device.cause);
}

/**
 * FIX WAVE L, controller ruling on G70c-02 (the same rule as the web's `sourceLineState` /
 * `restingSourceChecked`): whether the Core holds a CHECKED fact of a source. At rest `online: true`
 * only says "the registry row is enabled" - a camera on a dead address read "Reachable". A source is
 * checked when the Core opened it (`sourceOpen`), when it states when it last checked it (`checkedAt`,
 * a finite number), or - for a source ON a line - while a session RECORDS (the recording's telemetry
 * makes it true; the caller says so with `recording`).
 */
export function sourceChecked(input: { readonly sourceOpen?: unknown; readonly checkedAt?: unknown; readonly checked?: boolean | null | undefined; readonly recording?: boolean }): boolean {
  if (input.recording === true || input.sourceOpen === true || input.checked === true) return true;
  return typeof input.checkedAt === 'number' && Number.isFinite(input.checkedAt);
}

/** The i18n key of "Not checked": a source the registry lists and the Core has no checked fact of. */
export const NOT_CHECKED_KEY = 'features.capture-selector.sourceState.notChecked';

/**
 * THE ONE WORD of a capture source's state on a Core in real capture (wave L ruling): a negative fact
 * is never hidden ("Not reachable", the local device's named cause); a source that reads READY
 * WITHOUT a checked fact is "Not checked" - never "Reachable" / "Ready"; with one, the roster's words.
 */
export function sourceStateLabelKey(state: LocalDeviceState, local: boolean, checked: boolean): string {
  return state === 'READY' && !checked ? NOT_CHECKED_KEY : rosterStateLabelKey(state, local);
}

/** The chip words of a state: the local-device words for the Core's local device, "Reachable" / "Not reachable" for any other. */
export function rosterStateLabelKey(state: LocalDeviceState, local: boolean): string {
  if (local) return `features.capture-selector.localDevice.state.${state}`;
  return state === 'READY' ? 'common.developmentRoster.reachable' : 'common.developmentRoster.notReachable';
}

/** The facts of a capture device the "is on" rule reads, as the Core sent them (`captureDevices` slice). */
export interface SourceOnInput {
  readonly sourceClass?: string | null | undefined;
  readonly adapter?: string | null | undefined;
  /** `CAMERA`, `MIC` (the device's `kind`). */
  readonly deviceKind: string;
  /** Only the boolean `true` counts: absent, false or anything else is "not on". */
  readonly sourceOpen?: unknown;
}

/**
 * 'Is on' (SEC35-44 (4); ux spec §8f.3: fixed, non-dismissable, on every client, the short open of a
 * pre-check included): the Core's local device, open, in Live mode. The key of its fixed line
 * ("Core Mac's camera is on" / "Core Mac's microphone is on"), or null.
 *
 * Fix F-M4 (review R69-02, decision D178): the ONE rule of the Devices roster, the Session New
 * pre-check rows, Session Live and the Home tiles — the three session surfaces read it through the
 * badge components of `capture-selector/development-source-badge.tsx`.
 */
export function sourceOnKeyOf(input: SourceOnInput, live: boolean): string | null {
  if (input.sourceOpen !== true) return null;
  const source = developmentSourceOf({ sourceClass: input.sourceClass ?? undefined, adapter: input.adapter ?? undefined, deviceKind: input.deviceKind, live });
  if (source === 'localCamera') return 'common.sourceClass.cameraOn.mobile';
  if (source === 'localMicrophone') return 'common.sourceClass.microphoneOn.mobile';
  return null;
}

/** One open local device and the key of its fixed line. */
export interface OpenLocalSource {
  readonly deviceId: string;
  readonly key: string;
}

/**
 * Every local device the Core holds open (`sourceOnKeyOf`), in the Core's order, except the ids a
 * screen already draws itself (fix F-M4 follow-up, R69-02; ux spec §8f.3: the state is shown whenever
 * a local device is open — on Session Live also for the camera of the track that is not on screen).
 */
export function openLocalSourcesOf(
  devices: readonly { readonly id: string; readonly kind: string; readonly sourceClass?: string | null | undefined; readonly adapter?: string | null | undefined; readonly sourceOpen?: unknown }[],
  live: boolean,
  drawn: readonly string[],
): OpenLocalSource[] {
  const out: OpenLocalSource[] = [];
  for (const device of devices) {
    if (drawn.includes(device.id)) continue;
    const key = sourceOnKeyOf({ sourceClass: device.sourceClass, adapter: device.adapter, deviceKind: device.kind, sourceOpen: device.sourceOpen }, live);
    if (key !== null) out.push({ deviceId: device.id, key });
  }
  return out;
}

/** 'Is on' of a roster device: `sourceOnKeyOf` on the roster's own facts. */
export function rosterOnKey(device: Pick<RegisteredDevice, 'sourceOpen' | 'sourceClass' | 'adapter' | 'kind'>, live: boolean): string | null {
  return sourceOnKeyOf({ sourceClass: device.sourceClass, adapter: device.adapter, deviceKind: device.kind, sourceOpen: device.sourceOpen }, live);
}

/** The stated limit of a development source (D128, D136 (3)); null for any other device and outside Live mode. */
export function rosterLimitKey(device: Pick<RegisteredDevice, 'sourceClass' | 'adapter' | 'kind'>, live: boolean): string | null {
  const source = rosterSourceKind(device, live);
  return source === null ? null : `common.developmentRoster.limits.${source}`;
}

/** The words for the adapter kind the Core sent. */
export function rosterSourceKey(adapter: string | null): string {
  return `common.developmentRoster.source.${adapter === 'LOCAL_DEVICE' || adapter === 'FAKE' || adapter === 'ONVIF_RTSP' || adapter === 'USB_AUDIO' ? adapter : 'OTHER'}`;
}
