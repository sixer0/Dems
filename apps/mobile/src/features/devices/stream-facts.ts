/**
 * THE STREAM FACTS OF A VIDEO TRACK, AS THE CORE THIS APP SHOWS STATES THEM (task 4 row W4; review
 * `verification/060c` findings R-02, R-04, `060b` S-01; decisions C36, C98, C105). The tablet's side of the
 * rule the web console holds in `apps/core-web/src/features/devices/stream-facts.ts`.
 *
 * | The Core this app shows | The picture, the rate and the codec are | A camera in fault |
 * |---|---|---|
 * | Simulated client mode, or a Core in simulated capture | the `cameras` slice: the dataset's own statement, exactly as before | as before |
 * | a Core in real capture | the STORED stream statement of the track's selector line in force (`profile`), read back as the Core's device reads do; "Not stated" where the line names none or its code is no statement | the fault is said in the place of the facts: a stored fact is not shown as if the stream were live |
 *
 * WHY THE SLICE IS NOT READ ON A REAL CORE. The `cameras` slice a client receives on the state stream of a
 * real Core still holds the simulator's record - `1080p / 25 / H.264`, the model, the firmware, the PoE
 * port, `9 Mbps` - because no writer of the Core puts a camera's facts into it (rows B2 and V6; request line
 * of row V6). What the Core does state to a client is the selector line: the profile code it minted from
 * the stream itself and stored (task 4 rows 50, 51). The Core's own device reads answer the three facts
 * from exactly that code (`cameraStreamFactsOf` of `apps/core-server/src/modules/devices/status.ts`);
 * `storedStreamFactsOf` is the same reading.
 *
 * It is a THIRD statement of that code form (the Core's, the web's, this one): a request line of row W4
 * asks for the one function in `packages/shared`. Until then the cases of `stream-facts.test.ts` hold it
 * to the Core's answers.
 */
import type { VideoTrackId } from '@dems/shared/domain';
import { isSlotSourceUp, SlotSourceState, type SimState } from '@dems/shared/sim';
import { captureNoticesOf } from '@/features/capture-selector/capture-notices-model';
import { cameraLinesInForce } from '@/features/capture-selector/selector-in-force';
import { trackSourceOf } from './devices-model';

export interface StreamFacts {
  readonly resolution: string | null;
  readonly fps: number | null;
  readonly codec: 'H.264' | 'HEVC' | null;
}

/** No stream statement: the picture, the rate and the codec are each not stated. */
export const STREAM_FACTS_NOT_STATED: StreamFacts = Object.freeze({ resolution: null, fps: null, codec: null });

/** `<codec>_<height>P<rate>` for a 16:9 picture, else `<codec>_<width>X<height>P<rate>`; the rate absent when the stream states none. */
const STREAM_STATEMENT = /^(H264|HEVC)_(?:([1-9][0-9]{0,4})X)?([1-9][0-9]{0,4})P([1-9][0-9]{0,2})?$/;
/** The picture as the contract carries it (`CAMERA_RESOLUTION_PATTERN`) and the highest rate it states (`CAMERA_FPS_MAX`). */
const RESOLUTION = /^(?:[1-9][0-9]{2,3}p|[1-9][0-9]{2,3}x[1-9][0-9]{2,3})$/;
const FPS_MAX = 240;

/**
 * What a stored profile code states of its stream. Every member null for a code that is no stream statement
 * (a development profile's name, an empty slot, a text that is no code) or whose numbers the contract cannot
 * carry: nothing is said in its place. Pure.
 */
export function storedStreamFactsOf(profile: unknown): StreamFacts {
  const stated = typeof profile === 'string' ? STREAM_STATEMENT.exec(profile) : null;
  if (stated === null) return STREAM_FACTS_NOT_STATED;
  const [, codec, width, height, rate] = stated;
  const resolution = width === undefined ? `${String(height)}p` : `${width}x${String(height)}`;
  // A code without a width states a 16:9 picture: one WITH a width that is 16:9 is not a code the mint makes.
  if (width !== undefined && Number(width) * 9 === Number(height) * 16) return STREAM_FACTS_NOT_STATED;
  const fps = rate === undefined ? null : Number(rate);
  if (!RESOLUTION.test(resolution) || (fps !== null && fps > FPS_MAX)) return STREAM_FACTS_NOT_STATED;
  return { resolution, fps, codec: codec === 'HEVC' ? 'HEVC' : 'H.264' };
}

/** The fault of the camera behind a track, in the words the app already has for it. */
export type TrackFault = 'STREAM_LOST' | 'NOT_REACHABLE' | 'NO_SIGNAL';

/** The i18n key of a fault: the selector line's "Stream lost", the roster's "Not reachable", "No signal". */
export const TRACK_FAULT_KEY: Readonly<Record<TrackFault, string>> = {
  STREAM_LOST: 'devices.selector.stream.LOST',
  NOT_REACHABLE: 'common.developmentRoster.notReachable',
  NO_SIGNAL: 'common.status.noSignal',
};

export interface StatedTrack extends StreamFacts {
  readonly fault: TrackFault | null;
}

type FactsState = Pick<SimState, 'cameras' | 'captureConfig' | 'captureDevices' | 'session' | 'alerts'>;

/** `params.reason` of the fault the camera watch raises for a camera that stopped delivering (task 4 rows 49, R1). */
export const CAMERA_STREAM_ENDED_REASON = 'CAMERA_STREAM_ENDED';

/**
 * THE ACTIVE CAPTURE FAULT OF A CAMERA (task 4 row W5; review `verification/060d` finding Q-01; decision C111).
 * The tablet's side of `cameraCaptureFaultOf` of the web console's `stream-facts.ts`.
 *
 * The Core raises a `CAPTURE_FAULT` about a camera device (the alert's `target` is the device id, `CAM-nn`)
 * when the camera stops delivering inside a session, and clears it when its watch sees the camera back
 * (decision C60 (2)). Raising it changes NO selector line: the line's `streamState` follows the worker's
 * ingest, which stays connected while the relay re-opens its camera - so a track read as live under a
 * critical notice. The alert is the fact: while it is ACTIVE the track is in fault; when the Core resolves
 * it the track reads as before.
 *
 * | The active fault's `params.reason` | Word |
 * |---|---|
 * | `CAMERA_STREAM_ENDED` | `STREAM_LOST` ("Stream lost") |
 * | any other reason, or none | `NO_SIGNAL` ("No signal") |
 *
 * Advice about a camera that keeps recording is a `SYSTEM` alert, never a `CAPTURE_FAULT`. A fault about the
 * capture as a whole has no target and names no track. Pure.
 */
export function cameraCaptureFaultOf(alerts: FactsState['alerts'], deviceId: unknown): TrackFault | null {
  if (typeof deviceId !== 'string') return null;
  let found: TrackFault | null = null;
  for (const alert of alerts) {
    if (!alert.active || alert.kind !== 'CAPTURE_FAULT' || (alert.target ?? null) !== deviceId) continue;
    if (alert.params?.['reason'] === CAMERA_STREAM_ENDED_REASON) return 'STREAM_LOST';
    found = 'NO_SIGNAL';
  }
  return found;
}
type Line = { readonly trackId?: unknown; readonly deviceId?: unknown; readonly profile?: unknown; readonly online?: unknown; readonly streamState?: unknown };

/**
 * What a Core in REAL capture states of the camera line `pick` chooses among the lines in force. Pure; a flat
 * object of primitives (it compares by value).
 *
 * The fault, from what the Core reports, in this order: the line's lost stream; the line or its registered
 * device not reachable (`online: false`), or an active "not reachable" notice that names the device; the
 * camera slice's own fault of the track (`online: false`, a lens fault) - the engine's fault state.
 *
 * Audit row 191 (M3-08 R3): the device's state is read through the ONE source reader (`trackSourceOf` of
 * `devices-model.ts`, the shared `slotSourceOf`): a stated `reach: NOT_REACHABLE`, `online: false` and a device
 * the registry does not hold are each "not reachable" (`isSlotSourceUp` false). A line that names no device
 * states no fault here (the track's status says OFFLINE).
 */
export function statedTrackOf(state: FactsState, pick: (line: Line) => boolean): StatedTrack {
  const line = (cameraLinesInForce(state) as readonly Line[]).find(pick);
  if (line === undefined) return { ...STREAM_FACTS_NOT_STATED, fault: null };
  const source = typeof line.trackId === 'string' ? trackSourceOf(state, line.trackId as VideoTrackId) : null;
  const sourceDown = source !== null && source.state !== SlotSourceState.NOT_ASSIGNED && !isSlotSourceUp(source);
  const camera = state.cameras.find((entry) => entry.id === line.trackId);
  const noticed = captureNoticesOf(state.alerts).some((notice) => notice.kind === 'unreachable' && notice.deviceId === line.deviceId);
  // Row W5 (Q-01): an active capture fault the Core raised about the line's camera, after the line's own lost stream.
  const raised = cameraCaptureFaultOf(state.alerts, line.deviceId);
  const fault: TrackFault | null =
    line.streamState === 'LOST'
      ? 'STREAM_LOST'
      : raised !== null
        ? raised
        : line.online === false || sourceDown || noticed
        ? 'NOT_REACHABLE'
        : camera !== undefined && (!camera.online || camera.lens === 'FAULT')
          ? 'NO_SIGNAL'
          : null;
  return { ...storedStreamFactsOf(line.profile), fault };
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Picture and rate (a chip): "Not stated" without a picture, no rate where the stream states none. */
export function formatChipText(t: Translate, facts: StreamFacts): string {
  if (facts.resolution === null) return t('common.devices.cameraFormatNotStated');
  if (facts.fps === null) return t('common.devices.cameraFormatNoRate', { resolution: facts.resolution });
  return t('common.devices.cameraFormat', { resolution: facts.resolution, fps: facts.fps });
}

/** Picture, rate and codec (a fact row): "Not stated" without a picture or a codec, no rate where the stream states none. */
export function formatLineText(t: Translate, facts: StreamFacts): string {
  if (facts.resolution === null || facts.codec === null) return t('common.devices.cameraFormatNotStated');
  if (facts.fps === null) return t('common.devices.cameraFormatCodecNoRate', { resolution: facts.resolution, codec: facts.codec });
  return t('common.devices.cameraFormatCodec', { resolution: facts.resolution, fps: facts.fps, codec: facts.codec });
}

/** What a reader on a Core in real capture prints: the fault where the Core reports one, else the stored facts. */
export function statedFormatText(t: Translate, stated: StatedTrack, form: 'chip' | 'line'): string {
  if (stated.fault !== null) return t(TRACK_FAULT_KEY[stated.fault]);
  return form === 'chip' ? formatChipText(t, stated) : formatLineText(t, stated);
}
