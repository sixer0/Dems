/**
 * The `CapturePlan` builder (blueprint row 66 / M4-W2; capture spec §A.3, §B.2 `START`, §A.1.1;
 * decisions D72(g), D72(l), D82, D86 C-5; check `M4-LOCAL-PLAN-1`, plan-builder half).
 *
 * A PURE function: from the capture configuration (the selector, slice 29, or the copy an open
 * session took of it) and the device registry of the adapter layer to the payload of `START`. It
 * opens nothing, reads no file, no flag and no clock, and it names no process: where a camera
 * pushes, where its file goes and where a microphone's samples come from are GIVEN by the caller
 * (the session start, row 71), which decides them per session.
 *
 * WHAT THE WIRE NAMES (D72(g)). Every subject of the plan is a DEVICE ID of the registry: a camera
 * is `deviceId: CAM-nn`, a microphone `deviceId: MIC-nn` keyed by its numbered CHANNEL. `VIDEO-01`
 * to `VIDEO-04` appear in ONE member only, `trackId`: the name of the output the camera records to.
 * Nothing the worker reports back names a track. D61 (2026-11-04): the microphone plane is the four
 * numbered channels `MIC-01`..`MIC-04` on the wire too (the protocol's D61 wave landed the `channel`
 * member; the two-role lane survives only on `SWITCH_AUDIO_SOURCE` and the record/telemetry `role`).
 *
 * WHAT IS REFUSED, BEFORE ANYTHING IS OPENED (D86 C-5, D82; C3 §4 `SOURCE_KIND_NOT_RECORDABLE`).
 * `assertRecordableSelector` looks at ALL EIGHT slots of the selector (D61: four video, four
 * microphone; D60: six), whether or not the caller will record them:
 *   - a device no registered adapter serves (in `SIMULATED` that is every device: no adapter is
 *     registered there, rule RG-1), or whose adapter has no opener (`ONVIF_RTSP`, `USB_AUDIO` in
 *     this phase): no listener and no session for it;
 *   - a selector that mixes production and development sources, or whose sources are not of the
 *     class of the running capture operation (rule RG-3): one session is never both.
 * Both are the one refusal `SOURCE_KIND_NOT_RECORDABLE`; `reason` says which. The caller turns it
 * into `409 INVALID_STATE` and the BLOCK item of the pre-check (C3 §3.1).
 *
 * A refusal carries a code, a reason and at most a device ID. Its text is one of the fixed
 * sentences below: no path and no address is ever put into a message (a path of the plan is never
 * logged, `packages/capture-protocol`).
 */
import { VIDEO_TRACK_IDS, type VideoTrackId } from '@dems/shared/domain';
import { MIC_CHANNEL_IDS as SHARED_MIC_CHANNEL_IDS, PRIMARY_MIC_CHANNEL, type MicChannel } from '@dems/shared/sim'; // D61 (2026-11-04): the four numbered microphone channels
import { CapturePlanSchema, type CapturePlan, type CapturePlanCamera, type CapturePlanConstants, type CapturePlanMic } from '@dems/capture-protocol';
import {
  CAPTURE_AUDIO_CHANNELS,
  CAPTURE_AUDIO_SAMPLE_RATE_HZ,
  CAPTURE_FRAGMENT_TARGET_MS,
  CAPTURE_GOP_FRAMES,
  CAPTURE_METER_RATE_HZ,
  CAPTURE_MIN_FRAG_DURATION_MS,
  type CaptureConfigSliceBody,
} from '@dems/shared/api';
import { CaptureAdapterError, CaptureAdapterRefusal, sourceClassOfOperation, type CaptureDeviceDescriptor, type CaptureDeviceRegistry, type CaptureSourceClass } from '../../capture/adapters';

/** The two refusals of the builder. `SOURCE_KIND_NOT_RECORDABLE` is the contract's `details.reason` (C3 §4). */
export const CapturePlanRefusal = {
  SOURCE_KIND_NOT_RECORDABLE: 'SOURCE_KIND_NOT_RECORDABLE',
  PLAN_INVALID: 'CAPTURE_PLAN_INVALID',
} as const;
export type CapturePlanRefusal = (typeof CapturePlanRefusal)[keyof typeof CapturePlanRefusal];

/** Why. A machine code for the log, the error log and the pre-check item; never a value of the input. */
export const CapturePlanReason = {
  /** No registered adapter serves the device (rule RG-1; a discovery candidate is never one, rule RG-4). */
  NO_ADAPTER: 'NO_ADAPTER',
  /** The device's adapter has no opener in this phase (D86 C-5). */
  NO_OPENER: 'NO_OPENER',
  /** The selector holds production and development sources (D82). */
  MIXED_SOURCE_CLASSES: 'MIXED_SOURCE_CLASSES',
  /** The sources are not of the class the running capture operation records (rule RG-3). */
  CLASS_NOT_OF_OPERATION: 'CLASS_NOT_OF_OPERATION',
  /** The selector is not four video tracks (D60) and four numbered microphone channels (D61, 2026-11-04). */
  SELECTOR_SHAPE: 'SELECTOR_SHAPE',
  /** The caller gave no source for any camera, or none for the first microphone channel (D61: the transcription channel). */
  SOURCE_MISSING: 'SOURCE_MISSING',
  /** The assembled plan is not a `CapturePlan` of the protocol (a path or an address used twice, a camera named twice). */
  PROTOCOL_SHAPE: 'PROTOCOL_SHAPE',
} as const;
export type CapturePlanReason = (typeof CapturePlanReason)[keyof typeof CapturePlanReason];

const TEXT: Readonly<Record<CapturePlanReason, string>> = Object.freeze({
  NO_ADAPTER: 'no registered capture adapter serves an assigned device',
  NO_OPENER: 'no opener exists for the source kind of an assigned device',
  MIXED_SOURCE_CLASSES: 'the selector mixes production and development sources',
  CLASS_NOT_OF_OPERATION: 'the assigned sources are not of the class the running capture operation records',
  // D60 (2026-11-04): the Core records FOUR video tracks at once - the shape text names four tracks (was two).
  // D61 (2026-11-04): and FOUR numbered microphone channels (was a primary and a standby role).
  SELECTOR_SHAPE: 'the selector does not name four video tracks and four numbered microphones',
  SOURCE_MISSING: 'no source was given for a camera, or for the first microphone channel',
  PROTOCOL_SHAPE: 'the plan is not a capture plan of the protocol',
});

export class CapturePlanError extends Error {
  readonly code: CapturePlanRefusal;
  readonly reason: CapturePlanReason;
  /** The device the refusal is about (a registry ID such as `CAM-03`), or null. Never an address or a path. */
  readonly deviceId: string | null;
  constructor(code: CapturePlanRefusal, reason: CapturePlanReason, deviceId: string | null = null) {
    super(TEXT[reason]);
    this.name = 'CapturePlanError';
    this.code = code;
    this.reason = reason;
    this.deviceId = deviceId;
  }
}

/** The part of the registry the builder asks: the operation it was built for, and rule D86 C-5. */
export type CapturePlanRegistry = Pick<CaptureDeviceRegistry, 'operation' | 'assertRecordable'>;

/** The selector as the builder reads it: slice 29, or the copy a session took (`session.captureConfig`). */
export interface CapturePlanSelector {
  readonly cameras: readonly Pick<CaptureConfigSliceBody['cameras'][number], 'trackId' | 'deviceId' | 'profile'>[];
  // D61 (2026-11-04): the mic row is keyed by its CHANNEL, as a camera row is by its track; the role member of the earlier eras is superseded.
  readonly mics: readonly Pick<CaptureConfigSliceBody['mics'][number], 'channel' | 'deviceId'>[];
}

/**
 * The four numbered microphone channels (D61, 2026-11-04): the microphone half of the eight slots,
 * the columns `mic_0N_id` of the selector row and the `MIC-01`..`MIC-04` values of
 * `session_capture_sources_slot_check` (migration 0040). The shared vocabulary is the one source;
 * the fence and the row mapping read the same list. The protocol's own D61 wave (2026-11-04) landed
 * the `channel` member on the plan: the LEGACY_ROLE_OF shim that bridged the two-role lane during
 * the split is dead and removed - the wire names the channel directly.
 */
export const MIC_CHANNEL_IDS = SHARED_MIC_CHANNEL_IDS;
export type MicChannelId = MicChannel;

/** One slot of the selector with the descriptor of the device assigned to it. */
export interface RecordableSlot {
  // D61 (2026-11-04): the eight slots - four video tracks (D60) and four numbered microphone channels (was the two mic roles).
  readonly slot: 'VIDEO-01' | 'VIDEO-02' | 'VIDEO-03' | 'VIDEO-04' | MicChannelId;
  readonly descriptor: CaptureDeviceDescriptor;
}

/** What `assertRecordableSelector` found: the eight slots (D61: four video, four microphone), and the one source class they share. */
export interface RecordableSelector {
  readonly slots: readonly RecordableSlot[];
  readonly sourceClass: CaptureSourceClass;
}

/**
 * Rule D86 C-5 and D82 over the whole selector: every assigned device has an adapter with an
 * opener, and all of them are of the one source class the running operation records. Throws
 * `CapturePlanError` (`SOURCE_KIND_NOT_RECORDABLE`) otherwise. Call it BEFORE a source is opened
 * or a listener address is chosen: it needs nothing of a session.
 */
export function assertRecordableSelector(selector: CapturePlanSelector, registry: CapturePlanRegistry): RecordableSelector {
  // D60 (2026-11-04): the selector names FOUR video tracks once each (was two).
  // D61 (2026-11-04): and FOUR numbered microphone channels once each (was one PRIMARY and one STANDBY role) - symmetric with the video plane.
  const cameraOf = new Map<string, CapturePlanSelector['cameras'][number]>();
  for (const camera of selector.cameras) {
    if (!(VIDEO_TRACK_IDS as readonly string[]).includes(camera.trackId) || cameraOf.has(camera.trackId)) {
      throw new CapturePlanError(CapturePlanRefusal.PLAN_INVALID, CapturePlanReason.SELECTOR_SHAPE);
    }
    cameraOf.set(camera.trackId, camera);
  }
  const micOf = new Map<MicChannelId, CapturePlanSelector['mics'][number]>();
  for (const mic of selector.mics) {
    const channel = mic.channel as MicChannelId | undefined;
    if (channel === undefined || !(MIC_CHANNEL_IDS as readonly string[]).includes(channel) || micOf.has(channel)) {
      throw new CapturePlanError(CapturePlanRefusal.PLAN_INVALID, CapturePlanReason.SELECTOR_SHAPE);
    }
    micOf.set(channel, mic);
  }
  if (cameraOf.size !== VIDEO_TRACK_IDS.length || micOf.size !== MIC_CHANNEL_IDS.length) {
    throw new CapturePlanError(CapturePlanRefusal.PLAN_INVALID, CapturePlanReason.SELECTOR_SHAPE);
  }
  const cameras = VIDEO_TRACK_IDS.map((trackId) => cameraOf.get(trackId) as CapturePlanSelector['cameras'][number]);
  // Row R2 (ruling C93 on review finding F3-11; D60 of 2026-11-04 makes it PAIRWISE over the four tracks, as
  // `capture_config_selector_check` of migration 0039 states): ONE DEVICE ON TWO TRACKS WITH THE SAME PROFILE IS
  // NOT A PLAN - two lines of one device are legal only as the dual-lens case, distinct profiles (OD-05). The
  // selector's edit refuses that state on a Core in real capture (`routes.ts`, `CAMERA_ON_BOTH_TRACKS`); this is
  // the second line of defence, for a selector that held it before that rule or was put in place otherwise. The
  // protocol holds the matching rule over the assembled plan (`CapturePlanSchema`), so `buildCapturePlan` below
  // would refuse it too (`PROTOCOL_SHAPE`) - but only after the sources were opened. Here it is refused under the
  // same existing reason BEFORE the registry is asked and before anything is opened, and the refusal names the device.
  for (const [leftIndex, left] of cameras.entries()) {
    for (const right of cameras.slice(leftIndex + 1)) {
      if (left.deviceId === right.deviceId && left.profile === right.profile) {
        throw new CapturePlanError(CapturePlanRefusal.PLAN_INVALID, CapturePlanReason.PROTOCOL_SHAPE, left.deviceId);
      }
    }
  }
  const assigned: readonly { readonly slot: RecordableSlot['slot']; readonly deviceId: string }[] = [
    ...cameras.map((camera) => ({ slot: camera.trackId as RecordableSlot['slot'], deviceId: camera.deviceId })), // D60: all four video slots
    ...MIC_CHANNEL_IDS.map((channel) => ({ slot: channel as RecordableSlot['slot'], deviceId: (micOf.get(channel) as CapturePlanSelector['mics'][number]).deviceId })), // D61: all four numbered microphone channels
  ];
  const slots = assigned.map(({ slot, deviceId }): RecordableSlot => {
    try {
      return { slot, descriptor: registry.assertRecordable(deviceId) };
    } catch (cause) {
      if (cause instanceof CaptureAdapterError && cause.code === CaptureAdapterRefusal.SOURCE_KIND_NOT_RECORDABLE) {
        throw new CapturePlanError(CapturePlanRefusal.SOURCE_KIND_NOT_RECORDABLE, CapturePlanReason.NO_OPENER, deviceId);
      }
      if (cause instanceof CaptureAdapterError && cause.code === CaptureAdapterRefusal.DEVICE_UNKNOWN) {
        throw new CapturePlanError(CapturePlanRefusal.SOURCE_KIND_NOT_RECORDABLE, CapturePlanReason.NO_ADAPTER, deviceId);
      }
      throw cause;
    }
  });
  const classes = new Set(slots.map(({ descriptor }) => descriptor.sourceClass));
  const [sourceClass] = classes;
  if (classes.size !== 1 || sourceClass === undefined) {
    throw new CapturePlanError(CapturePlanRefusal.SOURCE_KIND_NOT_RECORDABLE, CapturePlanReason.MIXED_SOURCE_CLASSES);
  }
  if (sourceClass !== sourceClassOfOperation(registry.operation)) {
    throw new CapturePlanError(CapturePlanRefusal.SOURCE_KIND_NOT_RECORDABLE, CapturePlanReason.CLASS_NOT_OF_OPERATION);
  }
  return { slots, sourceClass };
}

/** The contract constants a worker records with (`@dems/shared/api` `capture.ts`; never restated in the worker). */
export function capturePlanConstants(): CapturePlanConstants {
  return {
    fragmentTargetMs: CAPTURE_FRAGMENT_TARGET_MS,
    minFragDurationMs: CAPTURE_MIN_FRAG_DURATION_MS,
    gopFrames: CAPTURE_GOP_FRAMES,
    meterRateHz: CAPTURE_METER_RATE_HZ,
    audioSampleRateHz: CAPTURE_AUDIO_SAMPLE_RATE_HZ,
    audioChannels: CAPTURE_AUDIO_CHANNELS,
  };
}

/** Where one camera of the session pushes and records. Chosen by the caller, per session. */
export type CapturePlanCameraSource = Pick<CapturePlanCamera, 'ingestUrl' | 'outputPath'>;

/**
 * Where one microphone channel of the session takes its samples and — D61 (2026-11-04) — where its
 * OWN audio file goes: the microphone twin of `CapturePlanCameraSource`, chosen by the caller per
 * session. `outputPath` stays optional on the member: a channel without one is read, metered and
 * warned for but not recorded on a file of its own (the protocol's D61 wave keeps the member optional).
 */
export type CapturePlanMicSource = Pick<CapturePlanMic, 'input' | 'outputPath'>;

export interface CapturePlanInput {
  readonly selector: CapturePlanSelector;
  readonly registry: CapturePlanRegistry;
  /**
   * Per output track, where its camera pushes and where its file goes. A track WITHOUT an entry is
   * left out of the plan: the session start decides which of the four cameras (D60, 2026-11-04; was one
   * camera of two, D72(k), D84; row 71) a session records with. At least one track must have one.
   */
  readonly cameras: Readonly<Partial<Record<VideoTrackId, CapturePlanCameraSource>>>;
  /**
   * Per microphone CHANNEL (D61, 2026-11-04: the four numbered channels, was per device with the
   * PRIMARY rule), the source of its opened stream: the input of `AudioStreamHandle.input` (taken
   * unchanged: D72(e)) and the channel's OWN audio file (`outputPath`, D61: the microphone twin of a
   * camera's, named per channel by the caller). A channel WITHOUT an entry is left out; channel 1
   * must have one - it feeds the transcription track `AUDIO-01` (D83's rule, carried onto the numbered
   * plane: an unreachable transcription channel blocks the start; a later channel no longer guards
   * anything, the failover concept dying with D61).
   */
  readonly mics: Readonly<Partial<Record<MicChannelId, CapturePlanMicSource>>>;
  /** The PCM tap of the transcriber, or null. */
  readonly pcmTapPath: string | null;
  /** Default: the contract's constants. */
  readonly constants?: CapturePlanConstants;
}

/**
 * The payload of `START` for one session. Throws `CapturePlanError`: `SOURCE_KIND_NOT_RECORDABLE`
 * as `assertRecordableSelector` does, `CAPTURE_PLAN_INVALID` when the sources given do not make a
 * plan of the protocol. The plan it returns has passed `CapturePlanSchema`.
 */
export function buildCapturePlan(input: CapturePlanInput): CapturePlan {
  assertRecordableSelector(input.selector, input.registry);
  const cameras: CapturePlanCamera[] = [];
  for (const camera of input.selector.cameras) {
    const source = Object.hasOwn(input.cameras, camera.trackId) ? input.cameras[camera.trackId] : undefined;
    if (source === undefined) continue;
    // `deviceId` is the wire subject; `trackId` is the output name and nothing else (D72(g)).
    cameras.push({ deviceId: camera.deviceId, trackId: camera.trackId, profile: camera.profile, ingestUrl: source.ingestUrl, outputPath: source.outputPath });
  }
  const mics: CapturePlanMic[] = [];
  let channelOneGiven = false;
  for (const mic of input.selector.mics) {
    // D61 (2026-11-04): the sources arrive keyed by CHANNEL; the row names its own.
    const channel = mic.channel as MicChannelId | undefined;
    if (channel === undefined || !(MIC_CHANNEL_IDS as readonly string[]).includes(channel)) continue; // unreachable: `assertRecordableSelector` above refused such a selector
    const source = Object.hasOwn(input.mics, channel) ? input.mics[channel] : undefined;
    if (source === undefined) continue;
    if (channel === PRIMARY_MIC_CHANNEL) channelOneGiven = true;
    // D61 (2026-11-04): the wire names the CHANNEL (protocol wave of the same date): the row is keyed like a camera row,
    // and carries the channel's own audio file when the caller named one (optional on the protocol member, so a channel
    // without one is put on the wire without the member rather than with an empty path).
    mics.push({ deviceId: mic.deviceId, channel, input: source.input, ...(source.outputPath === undefined ? {} : { outputPath: source.outputPath }) });
  }
  // D61 (2026-11-04): channel 1 is the transcription channel of `AUDIO-01`; without it the plan has no audio to transcribe.
  if (cameras.length === 0 || !channelOneGiven) {
    throw new CapturePlanError(CapturePlanRefusal.PLAN_INVALID, CapturePlanReason.SOURCE_MISSING);
  }
  const parsed = CapturePlanSchema.safeParse({
    cameras,
    mics,
    // D61 (2026-11-04): `activeMic` is the TRANSCRIBED CHANNEL of `AUDIO-01` - always channel 1 now (the failover concept died with the decision; the protocol validates the value). The operator switches (operation 81), never the Core (OD-11).
    activeMic: PRIMARY_MIC_CHANNEL,
    pcmTapPath: input.pcmTapPath,
    constants: input.constants ?? capturePlanConstants(),
  });
  if (!parsed.success) throw new CapturePlanError(CapturePlanRefusal.PLAN_INVALID, CapturePlanReason.PROTOCOL_SHAPE);
  return parsed.data;
}

/** Every subject the worker may name about this plan: its device IDs (D61, 2026-11-04: the microphone rows are keyed by their numbered channel; the two-role lane's words are no longer plan members and are never warning subjects). */
export function capturePlanSubjects(plan: CapturePlan): string[] {
  return [...plan.cameras.map((camera) => camera.deviceId), ...plan.mics.map((mic) => mic.deviceId), ...plan.mics.map((mic) => mic.channel)];
}
