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
import type { CaptureConfigSliceBody } from '@dems/shared/api';
import { MicState } from '@dems/shared/domain';
import {
  AUDIO_CLIP_BURST_DBFS,
  DEFAULT_CAPTURE_CONFIG,
  micInputOfChannel,
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

/**
 * Operation 46, and `cameras` of operation 44: one entry per video track.
 *
 * Schema v2 (C3 §3 ops 44/46; SH-05; OD-22): each track carries the capture-config device feeding
 * it (`sourceDeviceId`, equal to `deviceId` on the built-in topology, moved by op 79) and its
 * stream state - the selector slot's when it has one, else LIVE while the camera is online. A LOST
 * stream is what makes operation 48's PoE cycle legal (OD-22). The member order mirrors the
 * simulator's own builder (`sim/api.ts videoTracks`), which the parity test holds member by member.
 */
export function videoTracksOf(cameras: CommittedState['cameras'], slots: CaptureSlots = BUILTIN_SLOTS): VideoTrackStatus[] {
  return cameras.map((camera) => {
    const slot = slots.cameras.find((entry) => entry.trackId === camera.id);
    return {
      trackId: camera.id,
      deviceId: camera.deviceId,
      sourceDeviceId: slot?.deviceId ?? camera.deviceId,
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
 * of its place in the selector slots (the shared `micInputOfChannel`; ruling D137: channel 1 is
 * the first line, channel 2 the second, whatever their IDs - `MIC-03` among them, D133 (1)), and
 * the role and the device are that slot's when it has one, else the mic's own - the same order the
 * simulator's builder uses.
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
  const slotRoleOf = new Map(slots.mics.map(({ inputId, role }) => [inputId, role] as const));
  const slotDeviceOf = new Map(slots.mics.map(({ inputId, deviceId }) => [inputId, deviceId] as const));
  return mics.map((mic) => {
    const inputId = micInputOfChannel(slots.mics, mic.id);
    const live = frame?.audio.inputs[inputId];
    const levels: ChannelLevels = live === undefined ? stateLevelsOf(mic, at) : { dbfs: live.dbfs, peak: live.peak, clip: mic.clipLatched, noSignal: live.noSignal, ...(live.notMeasured === true ? { notMeasured: true as const } : {}) };
    return {
      inputId,
      deviceId: slotDeviceOf.get(inputId) ?? mic.deviceId,
      name: mic.name,
      role: slotRoleOf.get(inputId) ?? mic.micRole,
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
    };
  });
}

/**
 * The input feeding `AUDIO-01` right now: the frame's when the engine has produced one (the switch
 * of op 81 moves it between frames), else the PRIMARY of the selector slots, else the mic whose own
 * capture role is PRIMARY. The same value the simulator answers from its `audio` slice.
 */
export function activeInputOf(mics: CommittedState['mics'], frame: EngineMeterFrame | null = null, slots: CaptureSlots = BUILTIN_SLOTS): AudioStatusResponse['activeInputId'] {
  const fromFrame = frame?.audio.activeInputId;
  if (fromFrame !== undefined) return fromFrame;
  // Destructured for the same reason as in `audioChannelsOf`: the capture role of a slot is read
  // without the member token the M3 guard reserves for access control.
  const primary = slots.mics.find(({ role }) => role === 'PRIMARY');
  // The PRIMARY line of the selector, whatever its ID (`MIC-NN`; D133 (1), ruling D137).
  if (primary !== undefined) return primary.inputId;
  const mic = mics.find((candidate) => candidate.micRole === 'PRIMARY') ?? mics[0];
  return mic === undefined ? 'MIC-01' : micInputOfChannel(slots.mics, mic.id);
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
  return { channels: audioChannelsOf(state.mics, now, frame, slots), activeInputId: activeInputOf(state.mics, frame, slots) };
}

/** Operation 46. */
export function videoStatusOf(state: Pick<CommittedState, 'cameras'> & Partial<Pick<CommittedState, 'captureConfig'>>, slots: CaptureSlots = captureSlotsOf(state)): VideoStatusResponse {
  return { tracks: videoTracksOf(state.cameras, slots) };
}

/**
 * Operation 44: the health of camera, audio, storage, time and security, and the services.
 * Schema v2 (C3 §3 op 44): the cameras carry their stream state, the audio is keyed by the mic
 * inputs with their roles, and `activeInputId` names the input feeding `AUDIO-01` right now.
 */
export function deviceHealthOf(state: CommittedState, now: number, frame: EngineMeterFrame | null = null, slots: CaptureSlots = captureSlotsOf(state)): DeviceHealthResponse {
  // The shared rule of the Dashboard ring. It is typed for the whole simulator state and reads
  // nine slices of it, all of them durable (a test calls it on a state that holds no other).
  const system = systemStatus(state as SimState);
  return {
    device: { id: state.device.id, name: state.device.name, softwareVersion: state.device.softwareVersion },
    systemState: system.state,
    flags: system.flags.map((flag) => ({ id: flag.id, severity: flag.severity, message: flag.message })),
    cameras: videoTracksOf(state.cameras, slots),
    audio: audioChannelsOf(state.mics, now, frame, slots),
    activeInputId: activeInputOf(state.mics, frame, slots),
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
export function deviceInventoryOf(state: CommittedState, captureConfig: CaptureConfigSliceBody = (state as { readonly captureConfig?: CaptureConfigSliceBody }).captureConfig ?? DEFAULT_CAPTURE_CONFIG): DeviceInventory {
  return {
    device: state.device,
    cameras: state.cameras,
    mics: state.mics,
    otherDevices: state.otherDevices,
    ports: state.ports,
    activeCameraId: state.activeCameraId,
    tabletLink: state.tabletLink,
    captureConfig,
  };
}
