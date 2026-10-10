/**
 * Which local device a pre-check would turn on (fix pass F-M4; review R69-01; decisions D163, D178).
 * Pure: no React, no simulator instance.
 *
 * A pre-check on a selector that names the Core Mac's camera or microphone OPENS that device on the
 * Core Mac. The tablet and the phone therefore ask first: an explicit notice with a confirm step,
 * naming the device(s), before anything is sent. This file holds the ONE decision.
 *
 * | Fact | From (never client state) |
 * |---|---|
 * | which devices are named | the lines of the capture selector: the open session's own snapshot and the Core's current `captureConfig` (a session created now takes the current one; a retry runs on the snapshot) |
 * | which of them is the Core's local device | `adapter: LOCAL_DEVICE` of the device in the `captureDevices` slice |
 * | real capture | the fact of the "Development source" badge (`developmentSourceOf`): the Core sent `sourceClass: DEVELOPMENT` and the data is a Core server's (Live mode). In Simulated mode, and in a Core's simulated capture, nothing is opened and nothing is asked |
 *
 * This is a client rule only: the Core does not require the confirmation.
 */
import { developmentSourceOf } from './capture-notices-model';

/** The device ids the notice names; at least one is not null. */
export interface LocalSourceNotice {
  readonly camera: string | null;
  readonly microphone: string | null;
}

interface NoticeDevice {
  readonly id: string;
  readonly kind: string;
  readonly adapter?: string | null | undefined;
  readonly sourceClass?: string | null | undefined;
}

interface NoticeSelector {
  readonly cameras: readonly { readonly deviceId: string }[];
  readonly mics: readonly { readonly deviceId: string }[];
}

export interface LocalSourceNoticeInput {
  readonly devices: readonly NoticeDevice[];
  /** The selectors a pre-check may run on; null / undefined entries are skipped. */
  readonly selectors: readonly (NoticeSelector | null | undefined)[];
  /** The data comes from a Core server (Live mode). */
  readonly live: boolean;
}

/** The local camera and microphone the selector lines name, or null when a pre-check opens no local device. */
export function localSourceNoticeOf({ devices, selectors, live }: LocalSourceNoticeInput): LocalSourceNotice | null {
  const kindOf = (deviceId: string, deviceKind: 'CAMERA' | 'MIC') => {
    const device = devices.find((candidate) => candidate.id === deviceId);
    return device === undefined ? null : developmentSourceOf({ sourceClass: device.sourceClass ?? undefined, adapter: device.adapter ?? undefined, deviceKind, live });
  };
  let camera: string | null = null;
  let microphone: string | null = null;
  for (const selector of selectors) {
    if (selector === null || selector === undefined) continue;
    camera ??= selector.cameras.find((line) => kindOf(line.deviceId, 'CAMERA') === 'localCamera')?.deviceId ?? null;
    microphone ??= selector.mics.find((line) => kindOf(line.deviceId, 'MIC') === 'localMicrophone')?.deviceId ?? null;
  }
  return camera === null && microphone === null ? null : { camera, microphone };
}

/** The slices the decision reads, as a simulator or Live store holds them. */
export interface LocalSourceNoticeState {
  readonly captureDevices: { readonly devices: readonly NoticeDevice[] };
  readonly captureConfig: NoticeSelector;
  readonly session?: { readonly captureConfig?: NoticeSelector | null } | null;
}

export function localSourceNoticeOfState(state: LocalSourceNoticeState, live: boolean): LocalSourceNotice | null {
  return localSourceNoticeOf({ devices: state.captureDevices.devices, selectors: [state.session?.captureConfig, state.captureConfig], live });
}

/** The decision as one comparable string for a `useSim` selector (F74-13); `''` = no notice. */
export function localSourceNoticeLine(state: LocalSourceNoticeState, live: boolean): string {
  const notice = localSourceNoticeOfState(state, live);
  return notice === null ? '' : `${notice.camera ?? ''}|${notice.microphone ?? ''}`;
}

export function parseLocalSourceNoticeLine(line: string): LocalSourceNotice | null {
  if (line === '') return null;
  const [camera = '', microphone = ''] = line.split('|');
  return { camera: camera === '' ? null : camera, microphone: microphone === '' ? null : microphone };
}

/**
 * What the operator is about to send (decision D181, ruling 7). `PRECHECK` opens the device for the
 * short check; `START` turns it on and keeps it on until the recording ends. The two are asked
 * separately: a pre-check consent never counts for the start.
 */
export type LocalSourceNoticeKind = 'PRECHECK' | 'START';

/** The i18n block of a kind (`title`, `mobile.*`, `body`, `confirm`, `cancel`). */
export function localSourceNoticeBlock(kind: LocalSourceNoticeKind): string {
  return kind === 'START' ? 'common.localSourceStartNotice' : 'common.localSourceNotice';
}

/** The sentence of the notice on the tablet and the phone ("the Core Mac's ...": the tablet is not the Mac, OP-125-7). */
export function localSourceNoticeKey(notice: LocalSourceNotice, kind: LocalSourceNoticeKind = 'PRECHECK'): string {
  const block = localSourceNoticeBlock(kind);
  if (notice.camera !== null && notice.microphone !== null) return `${block}.mobile.both`;
  return notice.camera !== null ? `${block}.mobile.camera` : `${block}.mobile.microphone`;
}
