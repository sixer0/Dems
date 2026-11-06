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
 *
 * CAMERA-MICROPHONE PAIRS (audit 2026-11-05 row 147, C-P0-2b; D5 spec S5 §2.3-2.4; decisions D27, D30
 * K-3, D117 R144-1; protocol version 6). Pair N = `VIDEO-0N` <-> `MIC-0N`, fixed by number: every camera
 * line names the channel of its pair (`micChannel`). A camera whose paired channel has NO opened source is
 * NOT refused (D30 K-3 beats S5 N-37's refusal: an interview is never lost because one microphone failed):
 * its line states why (`micMissing`: `NOT_OPENED` when a device sits on the channel but the caller gave no
 * opened source for it, `NOT_ASSIGNED` when no device sits there), the worker writes a silent audio track,
 * and `capturePlanPairWarnings` gives the caller the WARN to raise. Channel 1 is the transcribed channel
 * (`activeMic` is always `MIC-01`, DF-09 R-T1): the PCM tap carries its samples, so a plan without the
 * `MIC-01` row records WITHOUT a tap (`pcmTapPath: null`) instead of being refused.
 */
import { VIDEO_TRACK_IDS, type VideoTrackId } from '@dems/shared/domain';
import { MIC_CHANNEL_IDS as SHARED_MIC_CHANNEL_IDS, PRIMARY_MIC_CHANNEL, type MicChannel } from '@dems/shared/sim'; // D61 (2026-11-04): the four numbered microphone channels
import { CapturePlanSchema, captureMicChannelOfVideoTrack, type CapturePairedMicMissingReason, type CapturePlan, type CapturePlanCamera, type CapturePlanConstants, type CapturePlanMic } from '@dems/capture-protocol';
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
  /**
   * The caller gave no source for any camera. Row 147 (D30 K-3): a missing microphone channel - channel 1, the
   * transcription channel, included - is no longer a refusal; its camera states it (`micMissing`) and records silence.
   */
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
  SOURCE_MISSING: 'no source was given for any camera',
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
 * session. Protocol version 6 (audit 2026-11-05 row 144, N-13): `outputPath` is REQUIRED - every
 * channel of the plan is recorded on its own file.
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
   * camera's, named per channel by the caller). A channel WITHOUT an entry is left out of the plan:
   * the camera of its pair states it (`micMissing`) and records a silent audio track (row 147, D30 K-3;
   * was: channel 1 had to have one, D83's rule - superseded, an interview is never lost because one
   * microphone failed). Without channel 1 the plan has nothing to transcribe and carries no tap.
   */
  readonly mics: Readonly<Partial<Record<MicChannelId, CapturePlanMicSource>>>;
  /**
   * The PCM tap of the transcriber, or null. The tap carries channel 1 (`MIC-01`, R-T1): when the plan holds
   * no `MIC-01` row the builder drops it (the plan's `pcmTapPath` is then null) - the caller reads the plan's
   * value, not its own, to know whether there is anything to transcribe (row 147).
   */
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
  // The microphones first (row 147): which channels the plan holds decides what each camera line states.
  const mics: CapturePlanMic[] = [];
  /** The channels a device sits on in the selector (assigned), and those the plan holds (assigned AND given an opened source). */
  const assignedChannels = new Set<string>();
  const planChannels = new Set<string>();
  for (const mic of input.selector.mics) {
    // D61 (2026-11-04): the sources arrive keyed by CHANNEL; the row names its own.
    const channel = mic.channel as MicChannelId | undefined;
    if (channel === undefined || !(MIC_CHANNEL_IDS as readonly string[]).includes(channel)) continue; // unreachable: `assertRecordableSelector` above refused such a selector
    if (mic.deviceId) assignedChannels.add(channel);
    const source = Object.hasOwn(input.mics, channel) ? input.mics[channel] : undefined;
    if (source === undefined) continue;
    planChannels.add(channel);
    // D61 (2026-11-04): the wire names the CHANNEL (protocol wave of the same date): the row is keyed like a camera row,
    // and carries the channel's own audio file - required since protocol version 6 (row 144, N-13).
    mics.push({ deviceId: mic.deviceId, channel, input: source.input, outputPath: source.outputPath });
  }
  const cameras: CapturePlanCamera[] = [];
  for (const camera of input.selector.cameras) {
    const source = Object.hasOwn(input.cameras, camera.trackId) ? input.cameras[camera.trackId] : undefined;
    if (source === undefined) continue;
    // `deviceId` is the wire subject; `trackId` is the output name and nothing else (D72(g)).
    // Protocol version 6 (row 147; D27, S5 §2.3, N-12): the camera names the channel of its pair, by number (a track word
    // without a pair fails the protocol below as PROTOCOL_SHAPE). D30 K-3 (D117 R144-1): a paired channel that is not in the
    // plan is STATED, not refused - `NOT_OPENED` when a device sits on it but no opened source was given, `NOT_ASSIGNED` when
    // none sits there - and the worker writes a silent audio track into this camera file. The caller warns (`capturePlanPairWarnings`).
    const micChannel = captureMicChannelOfVideoTrack(camera.trackId) as CapturePlanCamera['micChannel'];
    const micMissing: CapturePairedMicMissingReason | null = planChannels.has(micChannel) ? null : assignedChannels.has(micChannel) ? 'NOT_OPENED' : 'NOT_ASSIGNED';
    cameras.push({ deviceId: camera.deviceId, trackId: camera.trackId, profile: camera.profile, ingestUrl: source.ingestUrl, outputPath: source.outputPath, micChannel, micMissing });
  }
  // A plan records at least one camera. Row 147 (D30 K-3): a missing channel - channel 1 included - is no refusal any more.
  if (cameras.length === 0) {
    throw new CapturePlanError(CapturePlanRefusal.PLAN_INVALID, CapturePlanReason.SOURCE_MISSING);
  }
  const parsed = CapturePlanSchema.safeParse({
    cameras,
    mics,
    // D61 (2026-11-04), DF-09 R-T1 (row 147 pin): `activeMic` is the TRANSCRIBED CHANNEL of `AUDIO-01` = Pair 1 - always
    // `MIC-01` (the protocol validates the value). To transcribe another microphone the operator puts it in Pair 1 (op 80).
    activeMic: PRIMARY_MIC_CHANNEL,
    // R-T1: the tap carries channel 1's samples, so it exists only when the plan holds that row (the protocol's tap rule).
    pcmTapPath: planChannels.has(PRIMARY_MIC_CHANNEL) ? input.pcmTapPath : null,
    constants: input.constants ?? capturePlanConstants(),
  });
  if (!parsed.success) throw new CapturePlanError(CapturePlanRefusal.PLAN_INVALID, CapturePlanReason.PROTOCOL_SHAPE);
  return parsed.data;
}

/** Every subject the worker may name about this plan: its device IDs (D61, 2026-11-04: the microphone rows are keyed by their numbered channel; the two-role lane's words are no longer plan members and are never warning subjects). */
export function capturePlanSubjects(plan: CapturePlan): string[] {
  return [...plan.cameras.map((camera) => camera.deviceId), ...plan.mics.map((mic) => mic.deviceId), ...plan.mics.map((mic) => mic.channel)];
}

/**
 * Row 147 (D30 K-3; S5 N-37 re-ruled from a refusal into a warning): the code of the WARN a plan whose camera
 * records without its paired microphone gives the operator. Never a refusal: the recording starts.
 */
export const CapturePlanWarningCode = {
  PAIRED_MIC_MISSING: 'PAIRED_MIC_MISSING',
} as const;
export type CapturePlanWarningCode = (typeof CapturePlanWarningCode)[keyof typeof CapturePlanWarningCode];

/** One warning of a plan. Device IDs, track and channel words only - never an address or a path. */
export interface CapturePlanPairWarning {
  readonly code: CapturePlanWarningCode;
  /** The camera line that records a silent audio track. */
  readonly trackId: string;
  readonly deviceId: string;
  /** The channel of its pair that is not in the plan, and why (the words of the manifest's missing-mic statement). */
  readonly micChannel: CapturePlanCamera['micChannel'];
  readonly reason: CapturePairedMicMissingReason;
  /** True for Pair 1: the session also has nothing to transcribe (the plan carries no PCM tap). */
  readonly transcribed: boolean;
}

/**
 * Row 147 (D30 K-3): the WARNs of a plan - one per camera line that states a missing paired microphone, in the
 * plan's camera order; empty when every camera has its microphone. Pure: the caller (the session start) logs
 * them at level `warn` and shows them to the operator.
 */
export function capturePlanPairWarnings(plan: CapturePlan): CapturePlanPairWarning[] {
  return plan.cameras.flatMap((camera) =>
    camera.micMissing === null
      ? []
      : [{ code: CapturePlanWarningCode.PAIRED_MIC_MISSING, trackId: camera.trackId, deviceId: camera.deviceId, micChannel: camera.micChannel, reason: camera.micMissing, transcribed: camera.micChannel === PRIMARY_MIC_CHANNEL }],
  );
}
