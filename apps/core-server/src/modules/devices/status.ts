/**
 * The answers of the four device reads, built from the engine's COMMITTED slices (plan row W36;
 * spec §7.10 operations 44 to 47, §7.1 API-5 and API-6). Pure functions: no clock, no engine, no
 * request. The module's routes hand them `app.engine.state()`, `app.clock.now()` and, for the
 * two answers with audio channels, the newest meter frame (`app.engine.meters()`).
 *
 * Operations 44, 45 and 46 are design-book operations: they keep the shape the in-app simulator
 * answers in Simulated mode (`packages/shared/src/sim/api.ts`, whose builders are not exported),
 * with ISO-8601 times at UTC+07:00. A test holds every answer of this file against that handler
 * on the same state, member by member. Operation 47 answers eight slices in their wire form
 * (schema v2 adds `captureConfig`; C3 §3 op 47).
 *
 * Schema v2 (task 3 M2-W10; blueprint row 52): the four reads answer the v2 shapes of C3 §3 -
 * cameras with `sourceDeviceId` and `streamState`, audio keyed by the mic INPUTS with their
 * PRIMARY/STANDBY roles, `activeInputId` on the two audio-bearing answers, and the selector
 * snapshot on operation 47. The selector slots come from the caller (the capture-config store of
 * the sibling module, row 52); a caller that passes none gets the built-in baseline, which is
 * what the simulator itself holds on an unedited state, so the parity rule keeps its force.
 *
 * WHAT IS NOT IN THE COMMITTED STATE: the 20 Hz meter levels. They are read from the engine's
 * newest meter frame; before the first frame of a start, see `stateLevelsOf`.
 */
import type {
  AudioChannelStatus,
  AudioStatusResponse,
  DeviceHealthResponse,
  DeviceInventory,
  StorageStatusResponse,
  VideoStatusResponse,
  VideoTrackStatus,
} from '@dems/shared/api';
import { CAMERA_FPS_MAX, CAMERA_RESOLUTION_PATTERN, type CaptureConfigSliceBody } from '@dems/shared/api';
import { MicState } from '@dems/shared/domain';
import {
  AUDIO_CLIP_BURST_DBFS,
  DEFAULT_CAPTURE_CONFIG,
  meterInputOfChannel,
  micInputOfRole,
  noSignalFrame,
  silentFrame,
  storageSummary,
  systemStatus,
  toWibIso,
  type AudioFrame,
  type MicStatus,
  type SimState,
} from '@dems/shared/sim';
import type { EngineHost, EngineMeterFrame } from '../../engine';

/** The committed state of the engine: the 28 durable slices, as `app.engine.state()` returns them. */
export type CommittedState = ReturnType<EngineHost['state']>;

/**
 * Schema v2 (task 3 M2-W10; register CS-06 read half, SH-05/SH-12/SH-15/SH-17; C3 §3 ops 44 to 47):
 * the selector slots the reads consult for `sourceDeviceId`, `streamState`, `role` and the active
 * input. The capture-config store (sibling module, row 52) is the live source once row 66 wires it;
 * until then every caller may pass nothing and the built-in baseline (`DEFAULT_CAPTURE_CONFIG`,
 * identical to the seeded idle selector) decides the slots - exactly what the simulator holds on an
 * unedited state, so the parity rule of this file keeps its full force.
 */
export type CaptureSlots = Pick<CaptureConfigSliceBody, 'cameras' | 'mics'>;

/** The four members of an audio channel's answer that the simulator takes from its 20 Hz frame. */
export type ChannelLevels = Pick<AudioFrame, 'dbfs' | 'peak' | 'clip' | 'noSignal' | 'notMeasured'>;

/**
 * The levels of one channel as the committed `mics` slice decides them: the frame the shared
 * simulator gives a channel at the moment it ENTERS the state the mic is in.
 *
 * THE FALLBACK OF `audioChannelsOf` (a recorded difference, ruled by decision D89; formerly listed as gap BE-GAP-W36-1). The simulator
 * answers `dbfs` and `peak` from the newest frame of its `audio` slice. That slice is streamed
 * only (spec §3.2, class X): it is no durable slice, so `app.engine.state()` does not hold it.
 * The engine seam returns the newest frame of a start (`app.engine.meters()`), and null before
 * the first tick of that start. With no frame, this module answers what the committed state
 * decides:
 *
 *   `clip`      the CLIP latch of the mic (`clipLatched`): exactly the simulator's value;
 *   `noSignal`  the mic is NO_SIGNAL: exactly the simulator's value;
 *   `dbfs`, `peak`, by the state of the mic:
 *     NO_SIGNAL   the flat -90 of the shared `noSignalFrame` (exact: such a channel does not move);
 *     CLIP        the burst level of the MIC_CLIP fault (`AUDIO_CLIP_BURST_DBFS`), the frame the
 *                 fault sets when it is injected;
 *     READY       the noise floor of the shared `silentFrame`, which is what a fresh engine
 *                 holds before its first tick (spec §8.6).
 *
 * So the answer is the simulator's own for a state whose generator has not run (every scenario
 * as it is loaded). From the first tick on, `audioChannelsOf` reads the frame and the answer
 * follows the 20 Hz motion: speech, the peak hold, a test tone.
 */
export function stateLevelsOf(mic: Pick<MicStatus, 'state' | 'clipLatched'>, at: number): ChannelLevels {
  const clip = mic.clipLatched;
  if (mic.state === MicState.NO_SIGNAL) {
    const frame = noSignalFrame(at);
    return { dbfs: frame.dbfs, peak: frame.peak, clip, noSignal: frame.noSignal };
  }
  const frame = silentFrame(at);
  if (mic.state === MicState.CLIP) return { dbfs: AUDIO_CLIP_BURST_DBFS, peak: AUDIO_CLIP_BURST_DBFS, clip, noSignal: frame.noSignal };
  return { dbfs: frame.dbfs, peak: frame.peak, clip, noSignal: frame.noSignal };
}

/** The slots a caller did not pass: the built-in idle selector (the simulator's own baseline). */
const BUILTIN_SLOTS: CaptureSlots = { cameras: DEFAULT_CAPTURE_CONFIG.cameras, mics: DEFAULT_CAPTURE_CONFIG.mics };

/**
 * The selector slots of a committed state (task 3 row 140; R-11; ruling D137 (2)): the stored
 * selector of the `captureConfig` slice - the lines that name an adopted camera, this Mac's camera
 * (`CAM-03`) or this Mac's microphone (`MIC-03`) among them - so that the four reads answer the
 * device that REALLY feeds a track or holds a microphone line, as the in-app simulator's own
 * builders do (`sim/api.ts videoTracks`: `state.captureConfig`). Until this row the routes passed no
 * slots and the built-in pair answered whatever the selector said. A state that holds no selector
 * (a partial state of a test) gets the built-in baseline.
 */
export function captureSlotsOf(state: { readonly captureConfig?: CaptureSlots | null }): CaptureSlots {
  const stored = state.captureConfig;
  return stored === undefined || stored === null ? BUILTIN_SLOTS : stored;
}

/** The picture, the rate and the codec of a camera's stream, as the `cameras` slice and the video track status state them (`CameraStreamFactSchemas`). */
export type CameraStreamFacts = Pick<CommittedState['cameras'][number], 'resolution' | 'fps' | 'codec'>;

/**
 * A profile code that is a STREAM STATEMENT: the form the seal's `streamProfileOf` makes and the
 * connection test mints (task 4 rows 50, 51) - `<codec>_<height>P<rate>` for a 16:9 picture, else
 * `<codec>_<width>X<height>P<rate>`, the rate absent when the stream states none. The codec is of
 * the closed set of two.
 */
const STREAM_STATEMENT = /^(H264|HEVC)_(?:([1-9][0-9]{0,4})X)?([1-9][0-9]{0,4})P([1-9][0-9]{0,2})?$/;

/**
 * WHAT A STORED PROFILE CODE STATES OF ITS STREAM (task 4 row 53, WP-10b; design addendum 7.2;
 * security AD-06 (1), (2)). The code of a video slot is the key of the camera's stored stream row
 * (`capture_device_streams.profile`) and was minted by the Core from the stream itself, by the
 * function the seal uses; it is held to the code pattern at every write. Reading it back is that
 * function's inverse, so these three facts are the stored ones, with no read of a table:
 *
 *   resolution   `<height>p` for a 16:9 picture, else `<width>x<height>` - lower case, as the slice has it;
 *   fps          the whole-number rate the code states, or NULL when it states none. An HEVC code
 *                states none (the seal's reader reads no rate from an HEVC parameter set,
 *                `test/011_e8_reader.md`): the rate is then null, NEVER a default;
 *   codec        `H.264` or `HEVC`: the screen words of the closed set.
 *
 * Null for a code that is no stream statement (the name of a development profile, an empty slot)
 * or whose numbers the slice cannot carry (a side outside 100 to 9999, a rate above 240): then
 * nothing is said in its place - the caller keeps what it had.
 */
export function cameraStreamFactsOf(profile: unknown): CameraStreamFacts | null {
  const stated = typeof profile === 'string' ? STREAM_STATEMENT.exec(profile) : null;
  if (stated === null) return null;
  const [, codec, width, height, rate] = stated;
  const resolution = width === undefined ? `${String(height)}p` : `${width}x${String(height)}`;
  // A code without a width states a 16:9 picture: one WITH a width that is 16:9 is not a code the mint makes.
  if (width !== undefined && Number(width) * 9 === Number(height) * 16) return null;
  const fps = rate === undefined ? null : Number(rate);
  if (!CAMERA_RESOLUTION_PATTERN.test(resolution) || (fps !== null && fps > CAMERA_FPS_MAX)) return null;
  return { resolution, fps, codec: codec === 'HEVC' ? 'HEVC' : 'H.264' };
}

/**
 * The `cameras` slice with the stream facts of each track's selector slot (task 4 row 53): a track
 * whose slot holds a stream statement states that picture, rate and codec; every other track, and
 * every other member, is as it was. The SAME array when nothing differs, so that a caller can tell
 * "nothing to say" by identity (the shape a pure transition of the engine needs).
 */
export function withCameraStreamFacts(cameras: CommittedState['cameras'], slots: Pick<CaptureSlots, 'cameras'>): CommittedState['cameras'] {
  let changed = false;
  const next = cameras.map((camera) => {
    const facts = cameraStreamFactsOf(slots.cameras.find((entry) => entry.trackId === camera.id)?.profile);
    if (facts === null || (facts.resolution === camera.resolution && facts.fps === camera.fps && facts.codec === camera.codec)) return camera;
    changed = true;
    return { ...camera, ...facts };
  });
  return changed ? next : cameras;
}

/**
 * Operation 46, and `cameras` of operation 44: one entry per video track.
 *
 * Task 4 row 53: `streamFacts` (true in a real capture operation, handed in by the routes) makes
 * `resolution`, `fps` and `codec` the stored statement of the stream that feeds the track
 * (`withCameraStreamFacts`). Without it the three are the slice's own, as the simulator answers.
 *
 * Schema v2 (C3 §3 ops 44/46; SH-05; OD-22): each track carries the capture-config device feeding
 * it (`sourceDeviceId`, equal to `deviceId` on the built-in topology, moved by op 79) and its
 * stream state - the selector slot's when it has one, else LIVE while the camera is online. A LOST
 * stream is what makes operation 48's PoE cycle legal (OD-22). The member order mirrors the
 * simulator's own builder (`sim/api.ts videoTracks`), which the parity test holds member by member.
 *
 * Task 4 row 150 (AD-04 (2); site B11; names register E39): the selector line of a track is found
 * BY ITS TRACK. A track whose slot is not assigned has no source: `sourceDeviceId` is `null`. The
 * built-in camera of the hardware slice (`deviceId`, a fact of the unit's own port) never stands
 * in for it. `tracks` stays one entry per track.
 */
export function videoTracksOf(cameras: CommittedState['cameras'], slots: CaptureSlots = BUILTIN_SLOTS, streamFacts = false): VideoTrackStatus[] {
  // Task 4 row 53: in a real capture operation the picture, the rate and the codec of a track are the STORED statement of its stream.
  return (streamFacts ? withCameraStreamFacts(cameras, slots) : cameras).map((camera) => {
    const slot = slots.cameras.find((entry) => entry.trackId === camera.id);
    return {
      trackId: camera.id,
      deviceId: camera.deviceId,
      sourceDeviceId: slot?.deviceId ?? null,
      streamState: slot?.streamState ?? (camera.online ? 'LIVE' : 'LOST'),
      name: camera.name,
      lens: camera.lens,
      online: camera.online,
      recState: camera.recState,
      resolution: camera.resolution,
      fps: camera.fps,
      codec: camera.codec,
      bitrateMbps: camera.bitrateMbps,
    };
  });
}

/**
 * Operation 45, and `audio` of operation 44: one entry per mic INPUT, never merged (SYS-003).
 *
 * Schema v2 (C3 §3 ops 44/45; SH-15/SH-17; OD-01 T1; E-02): the entry is keyed by the input
 * `MIC-01`/`MIC-02` - never by a track - and carries the PRIMARY/STANDBY role the selector holds
 * inside `AUDIO-01` (`AUDIO-01` itself is the one session track, not a channel). The committed
 * `mics` slice is still the two meter channels of v1, so the input of a mic is the microphone line
 * its meter channel has in the selector slots (the shared `meterInputOfChannel`, names register N5;
 * ruling D137 kept by C21 (7): on a COMPLETE pair channel 1 is the first line, channel 2 the second,
 * whatever their IDs - `MIC-03` among them, D133 (1)).
 *
 * Task 4 row 150 (AD-04 (2); site B12; names register E40): a meter channel WITHOUT an input - a
 * microphone slot is not assigned, so the lines are no complete pair - has NO entry: an entry IS an
 * input. No built-in input is answered for it, and the device and the capture role of an entry are
 * its selector line's, never the hardware slice's own (`mic.deviceId`, `mic.micRole`): the entry
 * exists only because that line does. At most two entries, two on a complete selector.
 *
 * `frame` is the engine's newest meter frame (`app.engine.meters()`), or null before the first
 * tick of a start. With a frame, `dbfs`, `peak` and `noSignal` of an input are the frame's, as
 * the in-app simulator answers them; `clip` is the latch of the committed `mics` slice, which a
 * command changes between two frames. Without one: `stateLevelsOf`.
 */
export function audioChannelsOf(mics: CommittedState['mics'], at: number, frame: EngineMeterFrame | null = null, slots: CaptureSlots = BUILTIN_SLOTS): AudioChannelStatus[] {
  // The slot's capture role is read through a destructured map, not a `.role` member access: the
  // static guard of the folder (M3) forbids the token that could be read as naming an RBAC role,
  // and the mic's PRIMARY/STANDBY is a capture fact of the selector, never an access rule (row 52).
  const lineOf = new Map(slots.mics.map(({ inputId, deviceId, role }) => [inputId, { deviceId, lineRole: role }] as const));
  return mics.flatMap((mic): AudioChannelStatus[] => {
    const inputId = meterInputOfChannel(slots.mics, mic.id);
    // Row 150: no input behind this meter channel, hence no entry. Nothing stands in for the line.
    if (inputId === null) return [];
    const line = lineOf.get(inputId);
    if (line === undefined) return [];
    const live = frame?.audio.inputs[inputId];
    const levels: ChannelLevels = live === undefined ? stateLevelsOf(mic, at) : { dbfs: live.dbfs, peak: live.peak, clip: mic.clipLatched, noSignal: live.noSignal, ...(live.notMeasured === true ? { notMeasured: true as const } : {}) };
    return [{
      inputId,
      deviceId: line.deviceId,
      name: mic.name,
      role: line.lineRole,
      state: mic.state,
      recState: mic.recState,
      dbfs: levels.dbfs,
      peak: levels.peak,
      clip: levels.clip,
      noSignal: levels.noSignal,
      // Fix wave J (JW-08): a level the Core does not measure now is "not measured", never NO SIGNAL.
      ...(levels.notMeasured === true ? { notMeasured: true as const } : {}),
      gainDb: mic.gainDb,
      phantom: mic.phantom,
    }];
  });
}

/**
 * The input feeding `AUDIO-01` right now: the frame's when the engine has produced one that names
 * an input (the switch of op 81 moves it between frames), else the PRIMARY line of the selector
 * slots, whatever its ID (`MIC-NN`; D133 (1)).
 *
 * Task 4 row 150 (AD-04 (2); site B13; names register N4, E40): the line is found BY ITS ROLE
 * (the shared `micInputOfRole`), and with no PRIMARY line and no frame that names an input the
 * answer is `null`. The three stand-ins this function had are gone: the hardware slice's microphone
 * whose own capture role is PRIMARY, the first microphone of that slice, and a built-in input. The
 * hardware slice is therefore no parameter any more.
 */
export function activeInputOf(frame: EngineMeterFrame | null = null, slots: CaptureSlots = BUILTIN_SLOTS): AudioStatusResponse['activeInputId'] {
  const fromFrame = frame?.audio.activeInputId;
  if (fromFrame !== undefined && fromFrame !== null) return fromFrame;
  return micInputOfRole(slots.mics, 'PRIMARY');
}

/** `storage` of operation 44: the evidence volume, the write rate and the retention policy. */
export function storageStatusOf(state: Pick<CommittedState, 'storage' | 'storagePolicy'>): StorageStatusResponse {
  const summary = storageSummary(state);
  return {
    state: summary.state,
    totalBytes: summary.totalBytes,
    usedBytes: summary.usedBytes,
    freeBytes: summary.freeBytes,
    usedPercent: summary.usedPercent,
    estimatedRemainingMs: Math.round(summary.estimatedRemainingMs),
    writeBytesPerSec: state.storage.writeBytesPerSec,
    bitrateMbps: state.storage.bitrateMbps,
    volumes: state.storage.volumes.map((volume) => ({
      id: volume.id,
      kind: volume.kind,
      label: volume.label,
      totalBytes: volume.totalBytes,
      usedBytes: volume.usedBytes,
    })),
    retention: {
      policy: state.storagePolicy.retentionPolicy,
      days: state.storagePolicy.retentionDays,
      autoArchive: state.storagePolicy.autoArchive,
    },
  };
}

/** Operation 45: the two mic inputs and the input whose audio is inside `AUDIO-01` right now. */
export function audioStatusOf(state: Pick<CommittedState, 'mics'> & Partial<Pick<CommittedState, 'captureConfig'>>, now: number, frame: EngineMeterFrame | null = null, slots: CaptureSlots = captureSlotsOf(state)): AudioStatusResponse {
  return { channels: audioChannelsOf(state.mics, now, frame, slots), activeInputId: activeInputOf(frame, slots) };
}

/** Operation 46. */
export function videoStatusOf(state: Pick<CommittedState, 'cameras'> & Partial<Pick<CommittedState, 'captureConfig'>>, slots: CaptureSlots = captureSlotsOf(state), streamFacts = false): VideoStatusResponse {
  return { tracks: videoTracksOf(state.cameras, slots, streamFacts) };
}

/**
 * Operation 44: the health of camera, audio, storage, time and security, and the services.
 * Schema v2 (C3 §3 op 44): the cameras carry their stream state, the audio is keyed by the mic
 * inputs with their roles, and `activeInputId` names the input feeding `AUDIO-01` right now.
 */
export function deviceHealthOf(state: CommittedState, now: number, frame: EngineMeterFrame | null = null, slots: CaptureSlots = captureSlotsOf(state), streamFacts = false): DeviceHealthResponse {
  // The shared rule of the Dashboard ring. It is typed for the whole simulator state and reads
  // nine slices of it, all of them durable (a test calls it on a state that holds no other).
  const system = systemStatus(state as SimState);
  return {
    device: { id: state.device.id, name: state.device.name, softwareVersion: state.device.softwareVersion },
    systemState: system.state,
    flags: system.flags.map((flag) => ({ id: flag.id, severity: flag.severity, message: flag.message })),
    cameras: videoTracksOf(state.cameras, slots, streamFacts),
    audio: audioChannelsOf(state.mics, now, frame, slots),
    activeInputId: activeInputOf(frame, slots),
    storage: storageStatusOf(state),
    time: {
      source: state.time.source,
      locked: state.time.locked,
      stratum: state.time.stratum,
      offsetMs: state.time.offsetMs,
      lastSyncAt: toWibIso(state.time.lastSyncAt),
    },
    security: {
      state: state.security.state,
      posture: state.security.posture,
      tpmOk: state.security.tpm.ok,
      secureBoot: state.security.secureBoot,
      tamper: state.security.tamper,
      // Fix wave J (truth rule 3c; JW-04 / JT-03): a Core in its own capture reads no TPM - the placeholders above are then no readings.
      ...(state.security.platformNotReported === true ? { platformNotReported: true as const } : {}),
    },
    services: state.services.map((service) => ({ id: service.id, name: service.name, status: service.status })),
    serverTime: toWibIso(now),
  };
}

/**
 * Operation 47: the slices, each under its slice name, by reference (API-6).
 * Schema v2 (C3 §3 op 47; SH-12; E-04): the `captureConfig` snapshot joins the answer - the
 * selector in its wire form, never the paired-client registry and never a credential (RK-12).
 * Row 140: the selector is the committed state's own `captureConfig` slice, by reference like the
 * seven others (it holds the lines of an adopted or local device); a state without one (a partial
 * state of a test) answers the built-in baseline, which is what an unedited seed holds.
 */
export function deviceInventoryOf(
  state: CommittedState,
  captureConfig: CaptureConfigSliceBody = (state as { readonly captureConfig?: CaptureConfigSliceBody }).captureConfig ?? DEFAULT_CAPTURE_CONFIG,
  streamFacts = false,
): DeviceInventory {
  return {
    device: state.device,
    // Task 4 row 53: in a real capture operation the `cameras` of this answer state the stored stream facts of each track's slot; else the slice by reference.
    cameras: streamFacts ? withCameraStreamFacts(state.cameras, captureConfig) : state.cameras,
    mics: state.mics,
    otherDevices: state.otherDevices,
    ports: state.ports,
    activeCameraId: state.activeCameraId,
    tabletLink: state.tabletLink,
    captureConfig,
  };
}
