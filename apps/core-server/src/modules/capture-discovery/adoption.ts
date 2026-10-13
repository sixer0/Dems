/**
 * The registry side of an adoption (blueprint rows 132 / 142; contract C3 §2.6 "Adoption: when a
 * `capture_devices` row comes into being", "What adoption stores"; database contract `dbc-4` §N).
 *
 * The connect flow (`connect/service.ts`) calls this as its `DeviceRegistrar`, INSIDE the unit of
 * work of operation 96, after every check and the re-verification of that operation:
 *
 *   1. the INTERNAL action `registerCaptureDevice` of the engine adds the camera to the replicated
 *      `captureDevices` slice; the durable mapping writes its `capture_devices` row (with the
 *      adapter kind, written once and never updated) through the same unit;
 *   2. ONE statement sets the columns of that row the slice does not model: the transport `RTSP`,
 *      the endpoint reference (`onvif_uuid`), the usable profile codes the re-verification read,
 *      and `last_seen_at`. The row count decides: anything but one row fails the unit;
 *   3. (task 4 row 51; design addendum 7.2; security AD-06 (4)) one row of `capture_device_streams`
 *      per stream the re-verification JUDGED FROM THE STREAM: the Core's minted code with the ONVIF
 *      tokens the stream is found by, its closed codec and its bounded picture. The profile list of
 *      step 2 is exactly those codes - held to the code pattern HERE, before any statement
 *      (`assertAdoptedProfiles`). An ONVIF token is never a member of the list: it may hold
 *      lower-case letters, and the list holds codes. A test that judged no stream stores an empty
 *      list and no stream row: no default profile stands in (C36).
 *
 * Both are part of the caller's unit: with the adoption's audit rows and the credential row they
 * commit together or not at all. Nothing here reads or holds a credential, and nothing is logged:
 * the endpoint reference and the address are in no log line (the caller's audit row carries them
 * for a PRODUCTION candidate only, D86 C-3).
 */
import type { CaptureDeviceStatus } from '@dems/shared/sim';
import { registerCaptureDeviceIn, type EngineUnit } from '../../engine';

/** The stored transport of an adopted camera (C3 §2.6 "What adoption stores"). */
export const ADOPTED_CAMERA_TRANSPORT = 'RTSP';

/** The discovery columns of the new row. Columns the runtime role may update (`0005_capture_privileges.sql`); never `adapter_kind`. */
export const SET_ADOPTED_CAMERA_COLUMNS =
  'UPDATE public.capture_devices SET transport = $2, onvif_uuid = $3, profiles = $4::jsonb, last_seen_at = $5 WHERE id = $1 AND kind = \'CAMERA\'';

/**
 * One stream row of the new camera (task 4 row 51; schema set A, table T-44): what a profile CODE
 * means on this camera. The runtime role may insert it and may not delete it.
 */
export const INSERT_ADOPTED_CAMERA_STREAM =
  'INSERT INTO public.capture_device_streams (device_id, profile, onvif_profile_token, video_source_token, lens, stream_role, codec, width, height, read_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)';

/** The role an adoption stores a judged stream with: the connection test probes the MAIN stream of each video source. */
export const ADOPTED_STREAM_ROLE = 'MAIN';

/** A stream the connection test judged FROM THE STREAM (`JudgedStream` of the adapter layer, by shape). */
export interface AdoptedCameraStream {
  /** The Core's own code of the stream (`HEVC_1080P`): minted by the stream test, never a text of the camera. */
  readonly code: string;
  /** The ONVIF profile token the stream is found by on the camera. Not a code: it may hold lower-case letters. */
  readonly onvifProfileToken: string;
  readonly videoSourceToken: string | null;
  readonly lens: number;
  readonly codec: string;
  readonly width: number;
  readonly height: number;
}

/** What an adoption registers, as the connect flow hands it in (`connect/service.ts` `AdoptedDevice`). */
export interface AdoptedCamera {
  readonly id: string;
  readonly adapterKind: string;
  readonly model: string | null;
  /** Host, or host and port: never a locator with a user part. */
  readonly address: string;
  readonly endpointRef: string | null;
  /** The profile CODES of the camera: exactly the codes of `streams`. Empty when the test judged no stream - then no code exists (C36). */
  readonly profiles: readonly string[];
  /** The judged streams of the re-verification (task 4 row 51). */
  readonly streams: readonly AdoptedCameraStream[];
  readonly at: number;
}

export class AdoptionRowMissing extends Error {
  readonly code = 'CAPTURE_ADOPTION_ROW_MISSING';
  constructor() {
    super('the registry row of an adopted camera was not there to take its discovery columns');
    this.name = 'AdoptionRowMissing';
  }
}

/** A profile list or a stream of an adoption that may not be stored. The text names the rule, never the value. */
export class AdoptionProfileInvalid extends Error {
  readonly code = 'CAPTURE_ADOPTION_PROFILE_INVALID';
  constructor() {
    super('a profile of an adopted camera is not a code of the Core, or a stream of it is outside its bounds; nothing was stored');
    this.name = 'AdoptionProfileInvalid';
  }
}

/** The form of a profile code (`capture_device_streams_profile_check`, the selector's column, the seal). */
const PROFILE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
/** The form of an ONVIF token as the session file admits it (`capture_device_streams_token_check`). */
const ONVIF_TOKEN = /^[A-Za-z0-9_.:-]{1,64}$/;
/** The codecs a stream is judged as: the closed set of the stream test (the stored value set also holds `OTHER`, which no adoption writes). */
const JUDGED_CODECS: readonly string[] = ['H264', 'HEVC'];
const whole = (value: unknown, least: number, most: number): boolean => typeof value === 'number' && Number.isInteger(value) && value >= least && value <= most;

/**
 * THE CODE RULE AT THE WRITE (security AD-06 (4), in code; its CHECK is the schema's): each
 * element of the profile list is a code of the profile pattern, the list names no code twice, and
 * it is EXACTLY the codes of the streams - so `capture_devices.profiles` can hold nothing but a
 * code the Core minted from a stream. Each stream is inside the bounds of its table. Throws
 * before anything is written; the caller's unit rolls back.
 */
export function assertAdoptedProfiles(device: Pick<AdoptedCamera, 'profiles' | 'streams'>): void {
  const { profiles, streams } = device;
  const refuse = (): never => {
    throw new AdoptionProfileInvalid();
  };
  if (!Array.isArray(profiles) || !Array.isArray(streams)) return refuse();
  if (profiles.some((profile) => typeof profile !== 'string' || !PROFILE_CODE.test(profile)) || new Set(profiles).size !== profiles.length) return refuse();
  for (const stream of streams) {
    if (typeof stream.code !== 'string' || !PROFILE_CODE.test(stream.code) || typeof stream.onvifProfileToken !== 'string' || !ONVIF_TOKEN.test(stream.onvifProfileToken)) return refuse();
    if (stream.videoSourceToken !== null && (typeof stream.videoSourceToken !== 'string' || !ONVIF_TOKEN.test(stream.videoSourceToken))) return refuse();
    if (!JUDGED_CODECS.includes(stream.codec) || !stream.code.startsWith(`${stream.codec}_`)) return refuse();
    if (!whole(stream.lens, 1, 4) || !whole(stream.width, 1, 16_384) || !whole(stream.height, 1, 16_384)) return refuse();
  }
  const codes = streams.map((stream) => stream.code);
  if (new Set(codes).size !== codes.length || codes.length !== profiles.length || codes.some((code) => !profiles.includes(code))) return refuse();
}

/** The stream rows of an adopted camera, in the caller's unit: one row per judged stream, read at the adoption's instant. */
export async function writeAdoptedCameraStreams(unit: Pick<EngineUnit['unit'], 'query'>, device: Pick<AdoptedCamera, 'id' | 'profiles' | 'streams' | 'at'>): Promise<void> {
  assertAdoptedProfiles(device);
  for (const stream of device.streams) {
    await unit.query(INSERT_ADOPTED_CAMERA_STREAM, [device.id, stream.code, stream.onvifProfileToken, stream.videoSourceToken, stream.lens, ADOPTED_STREAM_ROLE, stream.codec, stream.width, stream.height, device.at]);
  }
}

/** Registers `device` in `scope`. Resolves with the device as the slice holds it. Throws to roll the caller's unit back. */
export async function registerAdoptedCamera(scope: EngineUnit, device: AdoptedCamera): Promise<CaptureDeviceStatus> {
  // The code rule first: a list that is not the Core's codes reaches neither the engine nor a statement.
  assertAdoptedProfiles(device);
  const registered = await registerCaptureDeviceIn(scope, { id: device.id, model: device.model, host: device.address, adapter: device.adapterKind });
  const updated = await scope.unit.query(SET_ADOPTED_CAMERA_COLUMNS, [device.id, ADOPTED_CAMERA_TRANSPORT, device.endpointRef, JSON.stringify(device.profiles), device.at]);
  if (updated.rowCount !== 1) throw new AdoptionRowMissing();
  await writeAdoptedCameraStreams(scope.unit, device);
  return registered;
}
