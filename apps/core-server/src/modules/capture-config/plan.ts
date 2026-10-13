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
 * is `deviceId: CAM-nn`, a microphone `deviceId: MIC-nn` with its role. `VIDEO-01` / `VIDEO-02`
 * appear in ONE member only, `trackId`: the name of the output the camera records to. Nothing the
 * worker reports back names a track.
 *
 * WHAT IS REFUSED, BEFORE ANYTHING IS OPENED (D86 C-5, D82; C3 §4 `SOURCE_KIND_NOT_RECORDABLE`).
 * `assertRecordableSelector` looks at ALL FOUR slots of the selector, whether or not the caller
 * will record them:
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
  /** The selector is not two video tracks and a PRIMARY and a STANDBY microphone. */
  SELECTOR_SHAPE: 'SELECTOR_SHAPE',
  /** The caller gave no source for any camera, or none for the PRIMARY microphone. */
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
  SELECTOR_SHAPE: 'the selector does not name two video tracks and a primary and a standby microphone',
  SOURCE_MISSING: 'no source was given for a camera, or for the primary microphone',
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
  readonly mics: readonly Pick<CaptureConfigSliceBody['mics'][number], 'deviceId' | 'role'>[];
}

/** One slot of the selector with the descriptor of the device assigned to it. */
export interface RecordableSlot {
  readonly slot: 'VIDEO-01' | 'VIDEO-02' | 'PRIMARY' | 'STANDBY';
  readonly descriptor: CaptureDeviceDescriptor;
}

/** What `assertRecordableSelector` found: the four slots, and the one source class they share. */
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
  const [first, second] = selector.cameras;
  const primary = selector.mics.find((mic) => mic.role === 'PRIMARY');
  const standby = selector.mics.find((mic) => mic.role === 'STANDBY');
  if (selector.cameras.length !== 2 || first?.trackId !== 'VIDEO-01' || second?.trackId !== 'VIDEO-02' || selector.mics.length !== 2 || primary === undefined || standby === undefined) {
    throw new CapturePlanError(CapturePlanRefusal.PLAN_INVALID, CapturePlanReason.SELECTOR_SHAPE);
  }
  // Row R2 (ruling C93 on review finding F3-11): ONE CAMERA ON BOTH VIDEO TRACKS IS NOT A PLAN. The selector's edit refuses that
  // state on a Core in real capture (`routes.ts`, `CAMERA_ON_BOTH_TRACKS`); this is the second line of defence, for a selector that
  // held it before that rule or was put in place otherwise. The protocol refuses a camera named twice, so `buildCapturePlan` below
  // would refuse it too (`PROTOCOL_SHAPE`) - but only after the sources were opened. Here it is refused under the same existing
  // reason BEFORE the registry is asked and before anything is opened, and the refusal names the device.
  if (first.deviceId === second.deviceId) {
    throw new CapturePlanError(CapturePlanRefusal.PLAN_INVALID, CapturePlanReason.PROTOCOL_SHAPE, first.deviceId);
  }
  const assigned: readonly { readonly slot: RecordableSlot['slot']; readonly deviceId: string }[] = [
    { slot: 'VIDEO-01', deviceId: first.deviceId },
    { slot: 'VIDEO-02', deviceId: second.deviceId },
    { slot: 'PRIMARY', deviceId: primary.deviceId },
    { slot: 'STANDBY', deviceId: standby.deviceId },
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

export interface CapturePlanInput {
  readonly selector: CapturePlanSelector;
  readonly registry: CapturePlanRegistry;
  /**
   * Per output track, where its camera pushes and where its file goes. A track WITHOUT an entry is
   * left out of the plan: the session start decides that a session records with one camera of two
   * (D72(k), D84; row 71). At least one track must have one.
   */
  readonly cameras: Readonly<Partial<Record<'VIDEO-01' | 'VIDEO-02', CapturePlanCameraSource>>>;
  /**
   * Per microphone DEVICE ID, the input of its opened stream (`AudioStreamHandle.input`, taken
   * unchanged: D72(e)). A microphone without an entry is left out; the PRIMARY one must have one
   * (D83: an unreachable active microphone blocks the start).
   */
  readonly mics: Readonly<Record<string, CapturePlanMic['input']>>;
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
  for (const mic of input.selector.mics) {
    const source = Object.hasOwn(input.mics, mic.deviceId) ? input.mics[mic.deviceId] : undefined;
    if (source === undefined) continue;
    mics.push({ deviceId: mic.deviceId, role: mic.role, input: source });
  }
  if (cameras.length === 0 || !mics.some((mic) => mic.role === 'PRIMARY')) {
    throw new CapturePlanError(CapturePlanRefusal.PLAN_INVALID, CapturePlanReason.SOURCE_MISSING);
  }
  const parsed = CapturePlanSchema.safeParse({
    cameras,
    mics,
    // The session starts on the PRIMARY input; the operator switches (operation 81), never the Core (OD-11).
    activeMic: 'PRIMARY',
    pcmTapPath: input.pcmTapPath,
    constants: input.constants ?? capturePlanConstants(),
  });
  if (!parsed.success) throw new CapturePlanError(CapturePlanRefusal.PLAN_INVALID, CapturePlanReason.PROTOCOL_SHAPE);
  return parsed.data;
}

/** Every subject the worker may name about this plan: its device IDs and its microphone roles (spec §B.2 R-5). */
export function capturePlanSubjects(plan: CapturePlan): string[] {
  return [...plan.cameras.map((camera) => camera.deviceId), ...plan.mics.map((mic) => mic.deviceId), ...plan.mics.map((mic) => mic.role)];
}
